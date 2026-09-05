import 'server-only';

import type Stripe from 'stripe';
import {
  initializeTrialCredits,
  resetCreditsForNewPeriod,
  type CreditSqlExecutor,
  type CreditResetOutcome,
} from '@/lib/credits';

export interface InitialSubscriptionDatabase {
  begin<T>(operation: (transaction: CreditSqlExecutor) => Promise<T>): Promise<T>;
}

export interface InitialSubscriptionReconciliationInput {
  userId: number;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePaymentMethodId: string;
  plan: 'pro' | 'business';
  billingInterval: 'monthly' | 'annual';
  status: Stripe.Subscription.Status;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEnd: string | null;
  cancelAtPeriodEnd: boolean;
  card: {
    last4: string | null;
    brand: string | null;
    expMonth: number | null;
    expYear: number | null;
  };
  paidInvoice: {
    invoiceId: string;
    periodStart: Date;
    paidAt: string;
  } | null;
}

export interface InitialSubscriptionReconciliationOutcome {
  creditReset: CreditResetOutcome | null;
}

function requireDate(value: string, label: string): Date {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error(`${label} is invalid.`);
  return date;
}

/**
 * Proves that the account has one trial-credit window covering the Stripe trial.
 * Callers run this inside the same transaction that grants subscription access,
 * so a missing or stale credit row rolls the access change back as one unit.
 */
export async function assertMatchingTrialCredits(
  transaction: CreditSqlExecutor,
  input: {
    userId: number;
    stripeSubscriptionId: string;
    periodStart: Date;
    periodEnd: Date;
  },
): Promise<void> {
  if (!Number.isSafeInteger(input.userId) || input.userId <= 0) {
    throw new Error('Application account ID is invalid.');
  }
  if (!/^sub_[A-Za-z0-9_]+$/.test(input.stripeSubscriptionId)) {
    throw new Error('Stripe subscription ID is invalid.');
  }
  if (
    !Number.isFinite(input.periodStart.getTime())
    || !Number.isFinite(input.periodEnd.getTime())
    || input.periodEnd.getTime() <= input.periodStart.getTime()
  ) {
    throw new Error('Stripe trial credit period is invalid.');
  }

  const readyTrialCredits = await transaction<{
    is_trial_period: boolean;
    period_start: string | Date;
    period_end: string | Date;
  }>`
    SELECT is_trial_period, period_start, period_end
    FROM crewcast.user_credits
    WHERE user_id = ${input.userId}
    LIMIT 2
  `;
  const storedStart = readyTrialCredits.length === 1
    ? new Date(readyTrialCredits[0].period_start)
    : null;
  const storedEnd = readyTrialCredits.length === 1
    ? new Date(readyTrialCredits[0].period_end)
    : null;
  if (
    readyTrialCredits.length !== 1
    || readyTrialCredits[0].is_trial_period !== true
    || !storedStart
    || !storedEnd
    || !Number.isFinite(storedStart.getTime())
    || !Number.isFinite(storedEnd.getTime())
    || storedStart.getTime() > input.periodStart.getTime()
    || storedEnd.getTime() < input.periodEnd.getTime()
  ) {
    throw new Error(
      `Trialing Stripe subscription ${input.stripeSubscriptionId} has no matching trial credits.`,
    );
  }
}

/**
 * Persists one authoritative Stripe subscription snapshot and its credits as a
 * single database unit. The customer advisory lock is shared with the webhook,
 * so browser retries and Stripe deliveries cannot commit contradictory states.
 */
export async function reconcileInitialSubscription(
  database: InitialSubscriptionDatabase,
  input: InitialSubscriptionReconciliationInput,
): Promise<InitialSubscriptionReconciliationOutcome> {
  if (!Number.isSafeInteger(input.userId) || input.userId <= 0) {
    throw new Error('Application account ID is invalid.');
  }
  if (!/^cus_[A-Za-z0-9_]+$/.test(input.stripeCustomerId)) {
    throw new Error('Stripe customer ID is invalid.');
  }
  if (!/^sub_[A-Za-z0-9_]+$/.test(input.stripeSubscriptionId)) {
    throw new Error('Stripe subscription ID is invalid.');
  }
  if (!/^pm_[A-Za-z0-9_]+$/.test(input.stripePaymentMethodId)) {
    throw new Error('Stripe payment method ID is invalid.');
  }
  const currentPeriodStart = requireDate(input.currentPeriodStart, 'Subscription period start');
  const currentPeriodEnd = requireDate(input.currentPeriodEnd, 'Subscription period end');
  if (currentPeriodEnd.getTime() <= currentPeriodStart.getTime()) {
    throw new Error('Subscription period end must follow its start.');
  }
  const trialEnd = input.trialEnd === null
    ? null
    : requireDate(input.trialEnd, 'Subscription trial end');
  if (input.status === 'trialing' && trialEnd === null) {
    throw new Error('A trialing subscription must have a trial end.');
  }
  if (input.status === 'active' && input.paidInvoice === null) {
    throw new Error('An active initial subscription must have a paid invoice.');
  }
  if (input.status !== 'active' && input.paidInvoice !== null) {
    throw new Error('Only an active initial subscription may reconcile a paid invoice.');
  }
  if (input.paidInvoice) {
    if (!/^in_[A-Za-z0-9_]+$/.test(input.paidInvoice.invoiceId)) {
      throw new Error('Stripe invoice ID is invalid.');
    }
    if (!Number.isFinite(input.paidInvoice.periodStart.getTime())) {
      throw new Error('Paid entitlement period start is invalid.');
    }
    requireDate(input.paidInvoice.paidAt, 'Stripe invoice paid timestamp');
  }

  const hasAccess = input.status === 'active' || input.status === 'trialing';
  const billingExpiry = input.card.expMonth && input.card.expYear
    ? `${String(input.card.expMonth).padStart(2, '0')}/${String(input.card.expYear).slice(-2)}`
    : null;

  return database.begin(async (transaction) => {
    await transaction`
      SELECT pg_advisory_xact_lock(
        hashtextextended(${`stripe-subscription:${input.stripeCustomerId}`}, 0)
      )
    `;

    // Every transaction that needs both rows must take the account root first
    // and the subscription second. Onboarding already uses this order. Keeping
    // billing on the same order prevents a webhook and onboarding request from
    // each holding one row while waiting forever for the other.
    const lockedAccounts = await transaction<{ id: number }>`
      SELECT id
      FROM crewcast.users
      WHERE id = ${input.userId}
      LIMIT 2
      FOR UPDATE
    `;
    if (lockedAccounts.length !== 1) {
      throw new Error(`Subscription reconciliation could not lock account ${input.userId}.`);
    }

    const reconciledSubscriptions = await transaction<{ user_id: number }>`
      INSERT INTO crewcast.subscriptions (
        user_id,
        stripe_customer_id,
        stripe_subscription_id,
        stripe_payment_method_id,
        plan,
        status,
        billing_interval,
        current_period_start,
        current_period_end,
        trial_ends_at,
        cancel_at_period_end,
        card_last4,
        card_brand,
        card_exp_month,
        card_exp_year
      ) VALUES (
        ${input.userId},
        ${input.stripeCustomerId},
        ${input.stripeSubscriptionId},
        ${input.stripePaymentMethodId},
        ${input.plan},
        ${input.status},
        ${input.billingInterval},
        ${currentPeriodStart.toISOString()}::timestamptz,
        ${currentPeriodEnd.toISOString()}::timestamptz,
        ${trialEnd?.toISOString() ?? null}::timestamptz,
        ${input.cancelAtPeriodEnd},
        ${input.card.last4},
        ${input.card.brand},
        ${input.card.expMonth},
        ${input.card.expYear}
      )
      ON CONFLICT (user_id) DO UPDATE
      SET
        stripe_customer_id = EXCLUDED.stripe_customer_id,
        stripe_subscription_id = EXCLUDED.stripe_subscription_id,
        stripe_payment_method_id = EXCLUDED.stripe_payment_method_id,
        plan = EXCLUDED.plan,
        status = EXCLUDED.status,
        billing_interval = EXCLUDED.billing_interval,
        current_period_start = EXCLUDED.current_period_start,
        current_period_end = EXCLUDED.current_period_end,
        trial_ends_at = EXCLUDED.trial_ends_at,
        cancel_at_period_end = EXCLUDED.cancel_at_period_end,
        card_last4 = EXCLUDED.card_last4,
        card_brand = EXCLUDED.card_brand,
        card_exp_month = EXCLUDED.card_exp_month,
        card_exp_year = EXCLUDED.card_exp_year,
        updated_at = NOW()
      RETURNING user_id
    `;
    if (reconciledSubscriptions.length !== 1) {
      throw new Error(`Subscription reconciliation did not update user ${input.userId}.`);
    }

    const reconciledUsers = await transaction<{ id: number }>`
      UPDATE crewcast.users
      SET
        plan = ${input.plan},
        has_subscription = ${hasAccess},
        trial_start_date = CASE
          WHEN ${input.status === 'trialing'}
            THEN COALESCE(trial_start_date, ${currentPeriodStart.toISOString()}::timestamptz)
          ELSE trial_start_date
        END,
        trial_end_date = ${trialEnd?.toISOString() ?? null}::timestamptz,
        billing_last4 = ${input.card.last4},
        billing_brand = ${input.card.brand},
        billing_expiry = ${billingExpiry},
        updated_at = NOW()
      WHERE id = ${input.userId}
      RETURNING id
    `;
    if (reconciledUsers.length !== 1) {
      throw new Error(`Subscription reconciliation did not update account ${input.userId}.`);
    }

    if (input.status === 'trialing') {
      await initializeTrialCredits(
        input.userId,
        currentPeriodStart,
        trialEnd!,
        transaction,
      );
      await assertMatchingTrialCredits(transaction, {
        userId: input.userId,
        stripeSubscriptionId: input.stripeSubscriptionId,
        periodStart: currentPeriodStart,
        periodEnd: trialEnd!,
      });
    }

    let creditReset: CreditResetOutcome | null = null;
    if (input.paidInvoice) {
      creditReset = await resetCreditsForNewPeriod(
        input.userId,
        input.plan,
        input.paidInvoice.periodStart,
        input.paidInvoice.periodStart,
        {
          executor: transaction,
          stripeInvoiceId: input.paidInvoice.invoiceId,
        },
      );
      const scheduled = await transaction<{ user_id: number }>`
        UPDATE crewcast.subscriptions
        SET
          first_payment_at = COALESCE(first_payment_at, ${input.paidInvoice.paidAt}::timestamptz),
          next_auto_scan_at = CASE
            WHEN first_payment_at IS NULL AND next_auto_scan_at IS NULL
              THEN ${input.paidInvoice.paidAt}::timestamptz + INTERVAL '7 days'
            ELSE next_auto_scan_at
          END,
          updated_at = NOW()
        WHERE user_id = ${input.userId}
          AND stripe_subscription_id = ${input.stripeSubscriptionId}
          AND status = 'active'
        RETURNING user_id
      `;
      if (scheduled.length !== 1) {
        throw new Error(`Paid subscription scheduling did not update user ${input.userId}.`);
      }
    }

    return { creditReset };
  });
}
