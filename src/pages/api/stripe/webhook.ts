/**
 * =============================================================================
 * STRIPE WEBHOOK HANDLER - Pages Router Version
 * =============================================================================
 * 
 * TRIAL EXPIRY & SUBSCRIPTION HANDLING (REV-58) - 29th December 2025
 * -------------------------------------------------------------------
 * This webhook handles all subscription lifecycle events including trial expiry.
 * 
 * HOW TRIAL EXPIRY WORKS:
 * 1. Stripe automatically charges the customer when trial ends
 * 2. We receive `invoice.paid` event → status becomes 'active', credits reset
 * 3. If payment fails → we receive `invoice.payment_failed` → status 'past_due'
 * 4. User gets `trial_will_end` notification 3 days before expiry
 * 
 * NO CRON JOB NEEDED: Stripe handles trial-to-paid transitions automatically.
 * 
 * FUTURE: Add email notifications for trial reminders (see separate issue).
 * 
 * WHY PAGES ROUTER INSTEAD OF APP ROUTER?
 * ----------------------------------------
 * This webhook uses the legacy Pages Router (/pages/api/) instead of the newer
 * App Router (/app/api/) for a critical technical reason:
 * 
 * PROBLEM: Stripe webhook signature verification FAILS on App Router (Next.js 15/16)
 * when deployed to Vercel. The signature verification requires the EXACT raw bytes
 * that Stripe sent. However, somewhere in the App Router + Vercel serverless pipeline,
 * the request body gets modified (encoding changes, line ending normalization, etc.),
 * causing the computed signature to never match Stripe's signature.
 * 
 * Error seen: "No signatures found matching the expected signature for payload"
 * 
 * SOLUTION: Pages Router has explicit body parsing control via:
 *   export const config = { api: { bodyParser: false } }
 * 
 * Combined with the `micro` package's `buffer()` function, we can access the
 * true raw bytes before any processing occurs.
 * 
 * This is the officially documented approach by Stripe and Vercel for webhooks.
 * 
 * REFERENCES:
 * - https://stripe.com/docs/webhooks/signatures
 * - https://vercel.com/guides/getting-started-with-nextjs-typescript-stripe
 * - https://github.com/vercel/next.js/discussions/48885
 * 
 * DO NOT MIGRATE THIS TO APP ROUTER without extensive testing on Vercel production.
 * 
 * Created: December 2025
 * Last Updated: 29th December 2025
 * =============================================================================
 */

import { buffer } from 'micro';
import { createHash } from 'node:crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { sql } from '@/lib/db';
import {
  initializeTrialCredits,
  resetCreditsForNewPeriod,
  normalizePlan,
  type CreditSqlExecutor,
} from '@/lib/credits';
import {
  CreditCheckoutValidationError,
  fulfillPaidCreditCheckoutSession,
} from '@/lib/stripe/credit-fulfillment';
import {
  processDurableStripeWebhookEvent,
  type StripeWebhookEnvelope,
} from '@/lib/stripe/webhook-events';
import {
  createStripeWebhookEventStore,
  type StripeWebhookSqlExecutor,
} from '@/lib/stripe/webhook-events-postgres';
import {
  isZeroValueTrialStartInvoice,
  selectAuthoritativeCustomerSubscription,
} from '@/lib/stripe/subscription-creation';
import { decideStripeCustomerEventOwnership } from '@/lib/stripe/customer-event-ownership';
import { assertMatchingTrialCredits } from '@/lib/stripe/initial-subscription-postgres';
import {
  extractInvoiceSubscriptionId,
  extractInvoiceSubscriptionServicePeriod,
  extractStripeId,
  snapshotStripeSubscription,
  type StripeSubscriptionSnapshot,
} from '@/lib/stripe/subscription-state';
import {
  synchronizePendingSubscriptionPlanChange,
  type PendingPlanSyncOutcome,
  type SubscriptionPlanChangeSql,
} from '@/lib/stripe/subscription-plan-changes-postgres';
import {
  recoverPreparedStripeDowngradeOperation,
  type StripeDowngradeOperationSql,
} from '@/lib/stripe/downgrade-operations-postgres';
import { recoverStripePaymentMethodUpdate } from '@/lib/stripe/payment-method-update-recovery';
import type { StripePaymentMethodUpdateSql } from '@/lib/stripe/payment-method-update-postgres';
import { readAuthoritativeStripeSubscriptionForCustomer } from '@/lib/stripe/payment-method-update-server';
import { isPlanCapacityIncrease } from '@/lib/plans/catalog';
import {
  restoreDowngradeArchivedCapacity,
  type UpgradeCapacityRestorationOutcome,
  type UpgradeCapacitySql,
} from '@/lib/stripe/upgrade-capacity-postgres';
// 2026-05-01: n8n transactional email integration removed (unreliable in production). See git history.
// 2026-05-03/04: Resend integration. Wired below: payment-success, subscription-canceled,
// credits-added. Welcome lives in src/app/api/users/route.ts. Pending: trial-ending, scan-summary.
import { waitUntil } from '@vercel/functions';
import { sendEmail } from '@/lib/email';
import { getAppUrl } from '@/lib/app-url';
import { PaymentSuccessEmail, paymentSuccessEmailSubject } from '@/emails/payment-success';
import { SubscriptionCanceledEmail, subscriptionCanceledEmailSubject } from '@/emails/subscription-canceled';
import { CreditsAddedEmail, creditsAddedEmailSubject } from '@/emails/credits-added'; // 2026-05-04

// =============================================================================
// CRITICAL: Disable Next.js body parsing
// This is the key difference from App Router - we MUST have raw bytes
// =============================================================================
export const config = {
  api: {
    bodyParser: false,
  },
};

const stripeWebhookEventStore = createStripeWebhookEventStore();

// =============================================================================
// MAIN WEBHOOK HANDLER
// =============================================================================
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // =========================================================================
    // GET RAW BODY USING MICRO'S BUFFER FUNCTION
    // This is the key to making signature verification work on Vercel
    // =========================================================================
    const rawBody = await buffer(req);
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      console.error('[Webhook] No Stripe signature found');
      return res.status(400).json({ error: 'No signature' });
    }

    // =========================================================================
    // VERIFY WEBHOOK SIGNATURE
    // =========================================================================
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      console.error('[Webhook] STRIPE_WEBHOOK_SECRET not configured');
      return res.status(500).json({ error: 'Webhook configuration error' });
    }

    let event: Stripe.Event;

    try {
      // Use rawBody directly - it's a Buffer which Stripe SDK accepts
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      const error = err as Error;
      console.error('[Webhook] Signature verification failed:', error.message);
      return res.status(400).json({ 
        error: `Webhook signature verification failed: ${error.message}` 
      });
    }

    console.log(`[Webhook] Received event: ${event.type} (${event.id})`);

    const objectId = extractStripeId(event.data.object);
    const receipt: StripeWebhookEnvelope = {
      eventId: event.id,
      eventType: event.type,
      objectId,
      createdAtSeconds: event.created,
      livemode: event.livemode,
      payloadSha256: createHash('sha256').update(rawBody).digest('hex'),
    };

    const processing = await processDurableStripeWebhookEvent(
      stripeWebhookEventStore,
      receipt,
      () => handleVerifiedStripeEvent(event),
    );

    if (processing.outcome === 'busy') {
      // A non-2xx response keeps Stripe's retry path alive if the active worker
      // crashes before completing its lease.
      return res.status(409).json({ received: true, processing: true });
    }
    if (processing.outcome === 'completed') {
      console.log(`[Webhook] Skipping completed duplicate event: ${event.id}`);
      return res.status(200).json({ received: true, skipped: true });
    }

    // 2026-05-01: pending-N8N-calls flush block removed here (n8n unreliable). See git history.

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('[Webhook] Error processing webhook:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}

async function handleVerifiedStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.pending_update_applied':
    case 'customer.subscription.pending_update_expired': {
      const subscription = event.data.object as Stripe.Subscription;
      const previousAttributes = event.data.previous_attributes as
        | Partial<Stripe.Subscription>
        | undefined;
      await handleSubscriptionUpdate(subscription, previousAttributes);
      return;
    }
    case 'customer.subscription.deleted':
      await handleSubscriptionCanceled(event.data.object as Stripe.Subscription);
      return;
    case 'subscription_schedule.updated': {
      const schedule = event.data.object as Stripe.SubscriptionSchedule;
      const subscriptionId = extractStripeId(schedule.subscription);
      if (!subscriptionId) {
        throw new Error(`Stripe schedule ${schedule.id} has no subscription ID.`);
      }
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await handleSubscriptionUpdate(subscription);
      return;
    }
    case 'customer.subscription.trial_will_end':
      await handleTrialWillEnd(event.data.object as Stripe.Subscription);
      return;
    case 'invoice.paid':
      await handleInvoicePaid(event.data.object as Stripe.Invoice);
      return;
    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
      return;
    case 'payment_method.attached':
      await handlePaymentMethodAttached(event.data.object as Stripe.PaymentMethod);
      return;
    case 'customer.updated':
      await synchronizeCustomerPaymentMethod((event.data.object as Stripe.Customer).id);
      return;
    case 'checkout.session.completed':
      await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
      return;
    default:
      console.log(`[Webhook] Unhandled event type: ${event.type}`);
  }
}

interface SubscriptionOwnerRow {
  user_id: number;
  stripe_subscription_id: string | null;
  plan: string;
  billing_interval: string | null;
  email: string | null;
  name: string | null;
}

type LockedSubscriptionOwnerRow = Omit<SubscriptionOwnerRow, 'email' | 'name'>;

interface LockedAccountOwnerRow {
  id: number;
  email: string | null;
  name: string | null;
}

interface CurrentSubscriptionContext {
  userId: number;
  email: string | null;
  name: string | null;
  plan: 'pro' | 'business' | 'enterprise';
  billingInterval: 'monthly' | 'annual' | null;
  snapshot: StripeSubscriptionSnapshot;
  eventMatchesCurrentSubscription: boolean;
  pendingPlanChangeOutcome: PendingPlanSyncOutcome;
  capacityRestoration: UpgradeCapacityRestorationOutcome;
}

function stripePriceConfiguration() {
  return {
    proMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
    proAnnual: process.env.STRIPE_PRICE_PRO_ANNUAL,
    businessMonthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY,
    businessAnnual: process.env.STRIPE_PRICE_BUSINESS_ANNUAL,
  };
}

function isSupportedPlan(value: string): value is CurrentSubscriptionContext['plan'] {
  return value === 'pro' || value === 'business' || value === 'enterprise';
}

function unixSecondsToIso(value: number | null): string | null {
  return value === null ? null : new Date(value * 1000).toISOString();
}

/**
 * Serializes all subscription state changes for one Stripe customer, then
 * retrieves the subscription currently owned by the account from Stripe while
 * holding that lock. This makes delayed events converge to today's Stripe state
 * instead of writing the stale snapshot carried by the delayed event.
 */
async function withCurrentStripeSubscription<T>(
  customerId: string,
  eventSubscriptionId: string | null,
  effect: (
    transaction: StripeWebhookSqlExecutor,
    context: CurrentSubscriptionContext,
  ) => Promise<T>,
): Promise<T> {
  return (sql as {
    begin<R>(callback: (transaction: StripeWebhookSqlExecutor) => Promise<R>): Promise<R>;
  }).begin(async (transaction) => {
    await transaction`
      SELECT pg_advisory_xact_lock(
        hashtextextended(${`stripe-subscription:${customerId}`}, 0)
      )
    `;

    // Discover the account without taking the subscription row lock. We then
    // take every cross-table lock in the canonical order used by onboarding:
    // account root first, subscription second. The final locked lookup below
    // revalidates the customer mapping, so a concurrent change cannot be used.
    const ownerCandidates = await transaction<{ user_id: number }>`
      SELECT user_id
      FROM crewcast.subscriptions
      WHERE stripe_customer_id = ${customerId}
      ORDER BY id
      LIMIT 2
    `;
    if (ownerCandidates.length !== 1) {
      // This is retryable: customer.subscription.created can beat the route that
      // records the new customer/subscription IDs in PostgreSQL.
      throw new Error(
        `Expected one application account for Stripe customer ${customerId}; found ${ownerCandidates.length}.`,
      );
    }

    const accounts = await transaction<LockedAccountOwnerRow>`
      SELECT id, email, name
      FROM crewcast.users
      WHERE id = ${ownerCandidates[0].user_id}
      LIMIT 2
      FOR UPDATE
    `;
    if (accounts.length !== 1) {
      throw new Error(`Application account for Stripe customer ${customerId} no longer exists.`);
    }

    const owners = await transaction<LockedSubscriptionOwnerRow>`
      SELECT
        user_id,
        stripe_subscription_id,
        plan,
        billing_interval
      FROM crewcast.subscriptions
      WHERE stripe_customer_id = ${customerId}
      ORDER BY id
      LIMIT 2
      FOR UPDATE
    `;
    if (
      owners.length !== 1
      || owners[0].user_id !== ownerCandidates[0].user_id
      || accounts[0].id !== ownerCandidates[0].user_id
    ) {
      throw new Error(`Stripe customer ${customerId} changed application owner while being synchronized.`);
    }

    const owner: SubscriptionOwnerRow = {
      ...owners[0],
      email: accounts[0].email,
      name: accounts[0].name,
    };
    const previousPlan = isSupportedPlan(owner.plan) ? owner.plan : null;

    // Do not blindly trust the subscription ID last written to PostgreSQL. A
    // returning customer can pay for a new subscription and close the browser
    // before that ID is saved. Stripe's current customer subscription list lets
    // this webhook recover that paid subscription instead of re-reading the old
    // canceled one forever.
    const customerSubscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 100,
    });
    const authoritativeSubscription = selectAuthoritativeCustomerSubscription(
      customerSubscriptions.data,
      customerSubscriptions.has_more,
    );
    const currentSubscriptionId = authoritativeSubscription?.id
      ?? owner.stripe_subscription_id
      ?? eventSubscriptionId;
    if (!currentSubscriptionId) {
      throw new Error(`No Stripe subscription is recorded for customer ${customerId}.`);
    }

    // Resolve Stripe's current subscription before recovery. If the durable
    // operation points at an obsolete same-customer subscription, recovery
    // abandons that operation instead of publishing the wrong card as current.
    const paymentMethodRecovery = await recoverStripePaymentMethodUpdate(
      transaction as unknown as StripePaymentMethodUpdateSql,
      stripe,
      {
        userId: owner.user_id,
        stripeCustomerId: customerId,
        stripeSubscriptionId: currentSubscriptionId,
      },
    );
    if (paymentMethodRecovery === 'completed') {
      console.log(
        `[Webhook] Recovered prepared payment-method update for user ${owner.user_id}.`,
      );
    } else if (paymentMethodRecovery === 'abandoned') {
      console.warn(
        `[Webhook] Abandoned obsolete or permanently invalid payment-method update for user ${owner.user_id}.`,
      );
    }

    // Stripe is the source of truth. Retrieval occurs after taking the per-
    // customer lock, so concurrent old/new deliveries cannot finish in reverse
    // order with different snapshots.
    const currentSubscription = await stripe.subscriptions.retrieve(currentSubscriptionId);
    const snapshot = snapshotStripeSubscription(
      currentSubscription,
      stripePriceConfiguration(),
    );
    if (snapshot.customerId !== customerId) {
      throw new Error(`Stripe subscription ${snapshot.subscriptionId} belongs to a different customer.`);
    }

    const plan = snapshot.plan;
    if (!plan) {
      throw new Error(`Cannot derive a supported plan for Stripe subscription ${snapshot.subscriptionId}.`);
    }
    const billingInterval = snapshot.billingInterval;
    if (!billingInterval && plan !== 'enterprise') {
      throw new Error(
        `Cannot derive a supported billing interval for Stripe subscription ${snapshot.subscriptionId}.`,
      );
    }
    const hasSubscription = snapshot.status === 'active' || snapshot.status === 'trialing';

    const updatedSubscriptions = await transaction<{ user_id: number }>`
      UPDATE crewcast.subscriptions
      SET
        stripe_subscription_id = ${snapshot.subscriptionId},
        status = ${snapshot.status},
        plan = ${plan},
        billing_interval = ${billingInterval},
        current_period_start = COALESCE(
          ${unixSecondsToIso(snapshot.currentPeriodStartSeconds)}::timestamptz,
          current_period_start
        ),
        current_period_end = ${unixSecondsToIso(snapshot.currentPeriodEndSeconds)}::timestamptz,
        trial_ends_at = ${unixSecondsToIso(snapshot.trialEndSeconds)}::timestamptz,
        cancel_at_period_end = ${snapshot.cancelAtPeriodEnd},
        updated_at = NOW()
      WHERE user_id = ${owner.user_id}
        AND stripe_customer_id = ${customerId}
      RETURNING user_id
    `;
    if (updatedSubscriptions.length !== 1) {
      throw new Error(`Stripe subscription state did not update exactly one account for customer ${customerId}.`);
    }

    const updatedUsers = await transaction<{ id: number }>`
      UPDATE crewcast.users
      SET
        plan = ${plan},
        has_subscription = ${hasSubscription},
        updated_at = NOW()
      WHERE id = ${owner.user_id}
      RETURNING id
    `;
    if (updatedUsers.length !== 1) {
      throw new Error(`Stripe subscription state did not update user ${owner.user_id}.`);
    }

    // The normal plan-change route performs this immediately. Repeating the
    // same idempotent recovery here covers a closed browser, a route timeout,
    // or a delayed Stripe confirmation without restoring manually archived data.
    const capacityRestoration = previousPlan
      && isPlanCapacityIncrease(previousPlan, plan)
      && hasSubscription
      ? await restoreDowngradeArchivedCapacity(
          transaction as unknown as UpgradeCapacitySql,
          {
            userId: owner.user_id,
            targetPlan: plan,
            stripeSubscriptionId: snapshot.subscriptionId,
          },
        )
      : {
          status: 'none' as const,
          restoredBrands: 0 as const,
          restoredLocations: 0 as const,
        };

    if (snapshot.scheduleId) {
      const schedule = await stripe.subscriptionSchedules.retrieve(snapshot.scheduleId);
      const recovery = await recoverPreparedStripeDowngradeOperation(
        transaction as unknown as StripeDowngradeOperationSql,
        { userId: owner.user_id, schedule },
      );
      if (recovery === 'completed') {
        console.log(
          `[Webhook] Recovered prepared downgrade operation for user ${owner.user_id}.`,
        );
      }
    }

    // Settle the durable future-change record from the same authoritative
    // Stripe snapshot and inside the same transaction as plan synchronization.
    // A target-price transition marks it applied; a detached/released schedule
    // marks it canceled; otherwise it remains pending.
    const pendingPlanChangeOutcome = await synchronizePendingSubscriptionPlanChange(
      transaction as unknown as SubscriptionPlanChangeSql,
      {
        userId: owner.user_id,
        stripeSubscriptionId: snapshot.subscriptionId,
        stripeScheduleId: snapshot.scheduleId,
        currentPlan: plan,
        currentBillingInterval: billingInterval,
      },
    );

    return effect(transaction, {
      userId: owner.user_id,
      email: owner.email,
      name: owner.name,
      plan,
      billingInterval,
      snapshot,
      eventMatchesCurrentSubscription:
        eventSubscriptionId === null || eventSubscriptionId === snapshot.subscriptionId,
      pendingPlanChangeOutcome,
      capacityRestoration,
    });
  });
}

// =============================================================================
// EVENT HANDLERS
// =============================================================================

/**
 * Handle a one-time credit pack purchase. The shared fulfillment service
 * re-reads Stripe's current session and validates the durable server-owned
 * operation before granting anything. Permanent identity failures are handled
 * once; temporary Stripe/database failures throw so Stripe retries delivery.
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== 'payment') return;
  let fulfillment;
  try {
    fulfillment = await fulfillPaidCreditCheckoutSession(session.id);
  } catch (error) {
    if (error instanceof CreditCheckoutValidationError) {
      console.error('[Webhook] checkout.session.completed rejected permanently:', error.message);
      return;
    }
    throw error;
  }
  if (fulfillment.status === 'awaiting_payment' || !fulfillment.identity) return;

  const authoritativeSession = fulfillment.session;
  const userId = fulfillment.identity.userId;
  const creditType = fulfillment.identity.creditType;
  const amount = fulfillment.identity.creditsAmount;
  const sessionId = authoritativeSession.id;
  console.log(
    `[Webhook] Credit pack ${fulfillment.status}: user=${userId}, type=${creditType}, amount=${amount}, session=${sessionId}`,
  );

  // CREDITS-ADDED EMAIL — added 2026-05-04
  // Only fires when the atomic grant reports `applied`, not on Stripe retries of an
  // already-completed session. Locale/name trade-offs: same as the payment-success block in
  // handleInvoicePaid. Currency falls back to 'eur' if Stripe somehow returns null.
  if (fulfillment.status === 'applied') {
    const recipients = await sql`
      SELECT email, name FROM crewcast.users WHERE id = ${userId}
    `;

    if (recipients.length > 0 && recipients[0].email) {
      const recipient = recipients[0];
      const creditsEmailLocale = 'de' as const;
      const creditsCustomerName = recipient.name ?? 'there';
      const amountTotal = typeof authoritativeSession.amount_total === 'number'
        ? authoritativeSession.amount_total
        : 0;
      const amountFormatted = new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: (authoritativeSession.currency || 'eur').toUpperCase(),
      }).format(amountTotal / 100);

      waitUntil(
        sendEmail({
          to: recipient.email,
          subject: creditsAddedEmailSubject(creditsEmailLocale, amount, creditType),
          idempotencyKey: `stripe-checkout/${sessionId}/credits-added`,
          react: CreditsAddedEmail({
            name: creditsCustomerName,
            locale: creditsEmailLocale,
            creditType,
            creditsAmount: amount,
            amountFormatted,
            appUrl: getAppUrl(),
          }),
        })
      );

      console.log(`[Webhook] ✅ Credits-added email queued for user ${userId} (${amount} ${creditType})`);
    } else {
      console.error(`[Webhook] Cannot send credits-added email — no email found for user ${userId}`);
    }
  }
}

/**
 * Handle subscription created or updated
 * 
 * FIXED (Dec 2025): Properly extract customer ID from both string and object formats
 */
async function handleSubscriptionUpdate(
  subscription: Stripe.Subscription,
  previousAttributes?: Partial<Stripe.Subscription> // 2026-05-03: for cancel-transition detection
) {
  console.log(`[Webhook] Processing subscription update: ${subscription.id}, status: ${subscription.status}`);
  const customerId = extractStripeId(subscription.customer);
  if (!customerId) throw new Error(`Stripe subscription ${subscription.id} has no customer ID.`);

  const cancellationEmail = await withCurrentStripeSubscription(
    customerId,
    subscription.id,
    async (transaction, context) => {
      if (!context.eventMatchesCurrentSubscription) {
        console.log(`[Webhook] Ignored stale subscription event for ${subscription.id}; current subscription is ${context.snapshot.subscriptionId}`);
        return null;
      }

      if (context.capacityRestoration.status !== 'none') {
        console.log(
          `[Webhook] Upgrade capacity restoration for user ${context.userId}:`,
          context.capacityRestoration,
        );
      }

      if (
        context.snapshot.status === 'trialing'
        && context.snapshot.trialEndSeconds !== null
      ) {
        const trialStartSeconds = context.snapshot.currentPeriodStartSeconds;
        if (trialStartSeconds === null) {
          throw new Error(`Trialing subscription ${context.snapshot.subscriptionId} has no period start.`);
        }
        const initialized = await initializeTrialCredits(
          context.userId,
          new Date(trialStartSeconds * 1000),
          new Date(context.snapshot.trialEndSeconds * 1000),
          transaction as CreditSqlExecutor,
        );
        if (initialized) {
          console.log(`[Webhook] Trial credits are ready for user ${context.userId}`);
        } else {
          console.log(`[Webhook] Existing trial history prevented a second grant for user ${context.userId}`);
        }
        await assertMatchingTrialCredits(transaction as CreditSqlExecutor, {
          userId: context.userId,
          stripeSubscriptionId: context.snapshot.subscriptionId,
          periodStart: new Date(trialStartSeconds * 1000),
          periodEnd: new Date(context.snapshot.trialEndSeconds * 1000),
        });
      }

      const justCanceled =
        previousAttributes?.cancel_at_period_end === false
        && context.snapshot.cancelAtPeriodEnd;
      if (!justCanceled || !context.email) return null;

      const accessUntil = unixSecondsToIso(context.snapshot.currentPeriodEndSeconds);
      if (!accessUntil) {
        throw new Error(`Canceling subscription ${context.snapshot.subscriptionId} has no access end.`);
      }
      return {
        email: context.email,
        name: context.name ?? 'there',
        plan: context.plan.charAt(0).toUpperCase() + context.plan.slice(1),
        accessUntil,
      };
    },
  );

  if (cancellationEmail) {
    const locale = 'de' as const;
    waitUntil(sendEmail({
      to: cancellationEmail.email,
      subject: subscriptionCanceledEmailSubject(locale),
      idempotencyKey: `stripe-subscription/${subscription.id}/${cancellationEmail.accessUntil}/canceled`,
      react: SubscriptionCanceledEmail({
        name: cancellationEmail.name,
        locale,
        plan: cancellationEmail.plan,
        accessUntil: cancellationEmail.accessUntil,
        appUrl: getAppUrl(),
      }),
    }));
    console.log(`[Webhook] Cancellation email queued for ${cancellationEmail.email}`);
  }
}

/**
 * Handle subscription canceled
 * 
 * FIXED (Dec 2025): Properly extract customer ID from both string and object formats
 * February 2026: Added N8N webhook for subscription_canceled email notification.
 */
async function handleSubscriptionCanceled(subscription: Stripe.Subscription) {
  console.log(`[Webhook] Processing subscription cancellation: ${subscription.id}`);
  const customerId = extractStripeId(subscription.customer);
  if (!customerId) throw new Error(`Stripe subscription ${subscription.id} has no customer ID.`);
  await withCurrentStripeSubscription(
    customerId,
    subscription.id,
    async (_transaction, context) => {
      console.log(`[Webhook] Subscription truth synchronized for user ${context.userId}: ${context.snapshot.status}`);
    },
  );
}

/**
 * Handle trial ending soon (3 days before)
 * 
 * 29th December 2025 (REV-58):
 * Stripe sends this event 3 days before trial ends.
 * 
 * February 2026: Added N8N webhook for trial_ending email notification.
 */
async function handleTrialWillEnd(subscription: Stripe.Subscription) {
  console.log(`[Webhook] Trial will end soon for subscription: ${subscription.id}`);
  
  const customerId = typeof subscription.customer === 'string' 
    ? subscription.customer 
    : (subscription.customer as { id: string })?.id;
    
  if (!customerId) {
    console.error(`[Webhook] Subscription ${subscription.id} has no customer ID`);
    return;
  }

  // Fetch user for email notification
  const users = await sql`
    SELECT u.email, u.name, u.plan
    FROM crewcast.users u
    JOIN crewcast.subscriptions s ON u.id = s.user_id
    WHERE s.stripe_customer_id = ${customerId}
  `;

  if (users.length === 0) {
    console.error(`[Webhook] No user found for customer: ${customerId}`);
    return;
  }

  const user = users[0];

  // 2026-05-01: n8n trial_ending email call removed here (n8n unreliable). See git history.

  console.log(`[Webhook] ✅ Trial-will-end event handled for user ${user.email}`);
}

/**
 * Handle successful invoice payment
 * 
 * CRITICAL FIX (Dec 2025): Properly extract subscription ID from both string and object formats.
 * The Stripe API (especially version 2025-11-17.clover) can return subscription as:
 * - A string: 'sub_xxx'
 * - An expanded object: { id: 'sub_xxx', ... }
 * - null: for one-time payments
 * 
 * Previous code used dangerous `as unknown as` type casting which broke when
 * subscription was an object, causing credits to never reset after payment.
 */
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const invoiceObject = invoice as Stripe.Invoice & {
    amount_paid?: number;
    billing_reason?: string | null;
    status_transitions?: { paid_at?: number | null } | null;
  };
  const customerId = extractStripeId(invoice.customer);
  if (!customerId) throw new Error(`Stripe invoice ${invoice.id} has no customer ID.`);

  const eventSubscriptionId = extractInvoiceSubscriptionId(invoice);
  if (!eventSubscriptionId) {
    console.log(`[Webhook] Ignoring non-subscription paid invoice ${invoice.id}.`);
    return;
  }
  const amountPaid = typeof invoiceObject.amount_paid === 'number'
    ? invoiceObject.amount_paid
    : 0;
  const billingReason = typeof invoiceObject.billing_reason === 'string'
    ? invoiceObject.billing_reason
    : null;

  console.log(
    `[Webhook] Invoice paid: ${invoice.id}, amount: ${amountPaid}, billing_reason: ${billingReason}`,
  );

  const paymentEmail = await withCurrentStripeSubscription(
    customerId,
    eventSubscriptionId,
    async (transaction, context) => {
      if (!context.eventMatchesCurrentSubscription) {
        console.log(
          `[Webhook] Ignored invoice ${invoice.id} for stale subscription ${eventSubscriptionId}; `
          + `current subscription is ${context.snapshot.subscriptionId}`,
        );
        return null;
      }

      // Stripe emits a zero-value invoice when a trial starts. A zero-value
      // ACTIVE invoice can instead be a legitimate 100% promotion and must
      // still provision the purchased entitlement.
      if (isZeroValueTrialStartInvoice({
        amountPaid,
        billingReason,
        subscriptionStatus: context.snapshot.status as Stripe.Subscription.Status,
      })) {
        console.log(`[Webhook] Skipping zero-value trial-start invoice ${invoice.id}`);
        return null;
      }

      if (context.snapshot.status !== 'active') {
        // A delayed paid event can arrive after cancellation or another newer
        // state. We synchronized that newer state above and must not re-grant
        // access or credits from this older delivery.
        console.log(
          `[Webhook] Invoice ${invoice.id} is paid, but current subscription `
          + `status is ${context.snapshot.status}; no current entitlement was reset.`,
        );
        return null;
      }

      const servicePeriod = extractInvoiceSubscriptionServicePeriod(
        invoice,
        eventSubscriptionId,
        { allowProrationFallback: billingReason === 'subscription_update' },
      );
      if (servicePeriod === null) {
        throw new Error(
          `Stripe invoice ${invoice.id} has no non-proration subscription service period.`,
        );
      }
      const periodStart = new Date(servicePeriod.startSeconds * 1000);

      const creditResetOutcome = await resetCreditsForNewPeriod(
        context.userId,
        normalizePlan(context.plan),
        periodStart,
        periodStart,
        {
          executor: transaction as CreditSqlExecutor,
          stripeInvoiceId: invoice.id,
        },
      );

      if (creditResetOutcome !== 'applied') {
        console.log(
          `[Webhook] Invoice ${invoice.id} did not reset credits: ${creditResetOutcome}.`,
        );
        return null;
      }

      const paidAtSeconds =
        invoiceObject.status_transitions?.paid_at
        ?? (typeof invoice.created === 'number' ? invoice.created : null);
      if (
        typeof paidAtSeconds !== 'number'
        || !Number.isSafeInteger(paidAtSeconds)
        || paidAtSeconds <= 0
      ) {
        throw new Error(`Stripe invoice ${invoice.id} has no valid paid timestamp.`);
      }
      const paidAt = new Date(paidAtSeconds * 1000).toISOString();

      const scheduled = await transaction<{ user_id: number }>`
        UPDATE crewcast.subscriptions
        SET
          first_payment_at = COALESCE(first_payment_at, ${paidAt}::timestamptz),
          next_auto_scan_at = CASE
            WHEN first_payment_at IS NULL AND next_auto_scan_at IS NULL
              THEN ${paidAt}::timestamptz + INTERVAL '7 days'
            ELSE next_auto_scan_at
          END,
          updated_at = NOW()
        WHERE user_id = ${context.userId}
          AND status = 'active'
        RETURNING user_id
      `;
      if (scheduled.length !== 1) {
        throw new Error(`Paid subscription scheduling did not update user ${context.userId}.`);
      }

      if (!context.email) return null;
      return {
        email: context.email,
        name: context.name ?? 'there',
        plan: context.plan.charAt(0).toUpperCase() + context.plan.slice(1),
      };
    },
  );

  if (paymentEmail) {
    const locale = 'de' as const;
    const amountFormatted = new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: (invoice.currency || 'eur').toUpperCase(),
    }).format(amountPaid / 100);

    waitUntil(sendEmail({
      to: paymentEmail.email,
      subject: paymentSuccessEmailSubject(locale),
      idempotencyKey: `stripe-invoice/${invoice.id}/payment-success`,
      react: PaymentSuccessEmail({
        name: paymentEmail.name,
        locale,
        plan: paymentEmail.plan,
        amountFormatted,
        appUrl: getAppUrl(),
      }),
    }));
    console.log(`[Webhook] Payment-success email queued for ${paymentEmail.email}`);
  }
}

/**
 * Handle failed invoice payment
 * 
 * FIXED (Dec 2025): Properly extract customer ID from both string and object formats
 * February 2026: Added N8N webhook for payment_failed email notification.
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = extractStripeId(invoice.customer);
  if (!customerId) throw new Error(`Stripe invoice ${invoice.id} has no customer ID.`);

  const eventSubscriptionId = extractInvoiceSubscriptionId(invoice);
  if (!eventSubscriptionId) {
    console.log(`[Webhook] Ignoring non-subscription failed invoice ${invoice.id}.`);
    return;
  }

  await withCurrentStripeSubscription(
    customerId,
    eventSubscriptionId,
    async (_transaction, context) => {
      // Never write 'past_due' from the event snapshot. A delayed failure can
      // arrive after payment recovery; the authoritative retrieval above writes
      // whichever status Stripe has now.
      console.log(
        `[Webhook] Payment-failure event ${invoice.id} synchronized user `
        + `${context.userId} to current status ${context.snapshot.status}`,
      );
    },
  );
}

/**
 * Handle payment method attached to customer
 * 
 * FIXED (Dec 2025): Properly extract customer ID from both string and object formats
 */
async function handlePaymentMethodAttached(paymentMethod: Stripe.PaymentMethod) {
  const customerId = extractStripeId(paymentMethod.customer);
  if (!customerId) {
    console.log(`[Webhook] Payment method ${paymentMethod.id} is not attached to a customer.`);
    return;
  }

  await synchronizeCustomerPaymentMethod(customerId, paymentMethod);
}

async function synchronizeCustomerPaymentMethod(
  customerId: string,
  attachedPaymentMethod?: Stripe.PaymentMethod,
) {
  await (sql as {
    begin<T>(callback: (transaction: StripeWebhookSqlExecutor) => Promise<T>): Promise<T>;
  }).begin(async (transaction) => {
    await transaction`
      SELECT pg_advisory_xact_lock(
        hashtextextended(${`stripe-subscription:${customerId}`}, 0)
      )
    `;

    const ownerCandidates = await transaction<{
      user_id: number;
      stripe_subscription_id: string | null;
    }>`
      SELECT user_id, stripe_subscription_id
      FROM crewcast.subscriptions
      WHERE stripe_customer_id = ${customerId}
      ORDER BY id
      LIMIT 2
    `;
    const customer = await stripe.customers.retrieve(customerId);
    const ownershipDecision = decideStripeCustomerEventOwnership({
      applicationOwnerCount: ownerCandidates.length,
      applicationAccountMarker: customer.deleted
        ? null
        : customer.metadata.neon_user_id,
    });
    if (ownershipDecision === 'ignore_external') {
      console.log(`[Webhook] Ignoring external Stripe customer event for ${customerId}.`);
      return;
    }
    if (ownershipDecision === 'retry_unreconciled') {
      throw new Error(
        `Stripe customer ${customerId} is marked for this application but is not linked yet.`,
      );
    }
    if (ownershipDecision === 'reject_ambiguous') {
      throw new Error(
        `Expected one application account for Stripe customer ${customerId}; found ${ownerCandidates.length}.`,
      );
    }
    if (customer.deleted) {
      throw new Error(`Stripe customer ${customerId} was deleted before card synchronization.`);
    }

    const accounts = await transaction<{ id: number }>`
      SELECT id
      FROM crewcast.users
      WHERE id = ${ownerCandidates[0].user_id}
      LIMIT 2
      FOR UPDATE
    `;
    if (accounts.length !== 1) {
      throw new Error(`Application account for Stripe customer ${customerId} no longer exists.`);
    }

    const owners = await transaction<{
      user_id: number;
      stripe_subscription_id: string | null;
    }>`
      SELECT user_id, stripe_subscription_id
      FROM crewcast.subscriptions
      WHERE stripe_customer_id = ${customerId}
      ORDER BY id
      LIMIT 2
      FOR UPDATE
    `;
    if (
      owners.length !== 1
      || owners[0].user_id !== ownerCandidates[0].user_id
      || accounts[0].id !== ownerCandidates[0].user_id
    ) {
      throw new Error(`Stripe customer ${customerId} changed application owner during card synchronization.`);
    }

    const authoritativeSubscription = await readAuthoritativeStripeSubscriptionForCustomer(
      stripe,
      customerId,
    );
    const currentSubscription = authoritativeSubscription
      ?? (owners[0].stripe_subscription_id
        ? await stripe.subscriptions.retrieve(owners[0].stripe_subscription_id)
        : null);
    if (
      currentSubscription
      && extractStripeId(currentSubscription.customer) !== customerId
    ) {
      throw new Error(
        `Stripe subscription ${currentSubscription.id} belongs to a different customer.`,
      );
    }

    // payment_method.attached and customer.updated can arrive while the route
    // that started the update is gone. The prepared operation safely replays
    // any missing Stripe step and commits the local card only after both Stripe
    // defaults agree.
    const paymentMethodRecovery = await recoverStripePaymentMethodUpdate(
      transaction as unknown as StripePaymentMethodUpdateSql,
      stripe,
      {
        userId: owners[0].user_id,
        stripeCustomerId: customerId,
        stripeSubscriptionId: currentSubscription?.id ?? null,
      },
    );
    if (
      paymentMethodRecovery === 'completed'
      || paymentMethodRecovery === 'abandoned'
    ) {
      console.log(
        paymentMethodRecovery === 'completed'
          ? `[Webhook] Recovered prepared payment-method update for user ${owners[0].user_id}.`
          : `[Webhook] Abandoned obsolete or permanently invalid payment-method update for user ${owners[0].user_id}.`,
      );
      return;
    }

    // The current subscription is what Stripe will actually invoice. Prefer
    // its card over a customer-wide fallback when both are present.
    const defaultPaymentMethodId = extractStripeId(
      currentSubscription?.default_payment_method,
    ) ?? extractStripeId(customer.invoice_settings.default_payment_method);

    // Attaching a card does not necessarily make it the customer's default.
    // If Stripe has no authoritative default yet, preserve the current display
    // data; the create/update-payment route will write it after its own success.
    if (!defaultPaymentMethodId) {
      console.log(
        `[Webhook] Customer ${customerId} has no current default payment method; `
        + `${attachedPaymentMethod ? `attached event ${attachedPaymentMethod.id}` : 'customer update'} `
        + `did not overwrite card display data.`,
      );
      return;
    }

    const currentPaymentMethod = attachedPaymentMethod
      && defaultPaymentMethodId === attachedPaymentMethod.id
      ? attachedPaymentMethod
      : await stripe.paymentMethods.retrieve(defaultPaymentMethodId);
    if (extractStripeId(currentPaymentMethod.customer) !== customerId) {
      throw new Error(
        `Default payment method ${currentPaymentMethod.id} belongs to a different customer.`,
      );
    }
    const card = currentPaymentMethod.card;
    if (!card) {
      console.log(
        `[Webhook] Current default payment method ${currentPaymentMethod.id} is not a card.`,
      );
      return;
    }

    const updatedSubscriptions = await transaction<{ user_id: number }>`
      UPDATE crewcast.subscriptions
      SET
        stripe_payment_method_id = ${currentPaymentMethod.id},
        card_last4 = ${card.last4},
        card_brand = ${card.brand},
        card_exp_month = ${card.exp_month},
        card_exp_year = ${card.exp_year},
        updated_at = NOW()
      WHERE user_id = ${owners[0].user_id}
        AND stripe_customer_id = ${customerId}
      RETURNING user_id
    `;
    const updatedUsers = await transaction<{ id: number }>`
      UPDATE crewcast.users
      SET
        billing_last4 = ${card.last4},
        billing_brand = ${card.brand},
        billing_expiry = ${`${String(card.exp_month).padStart(2, '0')}/${String(card.exp_year).slice(-2)}`},
        updated_at = NOW()
      WHERE id = ${owners[0].user_id}
      RETURNING id
    `;
    if (updatedSubscriptions.length !== 1 || updatedUsers.length !== 1) {
      throw new Error(`Card synchronization did not update exactly one account for ${customerId}.`);
    }

    console.log(
      `[Webhook] Current default card ${currentPaymentMethod.id} synchronized for user `
      + `${owners[0].user_id}`,
    );
  });
}
