import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import type Stripe from 'stripe';
import { z } from 'zod';
import { stripe, getPriceId, isValidPlan, isValidInterval, PLAN_DETAILS } from '@/lib/stripe';
import { sql } from '@/lib/db';
import {
  AccountAccessError,
  assertLegacyAccountId,
  requireAuthenticatedAccount,
} from '@/lib/auth/account';
import { resetCreditsForNewPeriod, normalizePlan } from '@/lib/credits';
import {
  extractInvoiceConfirmationClientSecret,
  extractInvoiceSubscriptionServicePeriod,
  extractPendingSubscriptionPriceId,
  extractStripeId,
  snapshotStripeSubscription,
} from '@/lib/stripe/subscription-state';
import {
  ensureDeferredDowngradeSchedule,
  isPlanChangeEligibleSubscriptionStatus,
  releaseManagedPlanSchedule,
  UnsupportedSubscriptionScheduleError,
} from '@/lib/stripe/subscription-change';
import {
  cancelPendingSubscriptionPlanChange,
  recordDeferredPlanChange,
  type SubscriptionPlanChangeSql,
} from '@/lib/stripe/subscription-plan-changes-postgres';
import {
  completeStripeDowngradeOperation,
  prepareStripeDowngradeOperation,
  StripeDowngradeOperationConflictError,
} from '@/lib/stripe/downgrade-operations-postgres';
import {
  DowngradeCapacityError,
  type DowngradeRetentionSelection,
} from '@/lib/plans/downgrade-capacity';
import { prepareDowngradeCapacitySelection } from '@/lib/stripe/downgrade-capacity-postgres';
import { isPlanCapacityIncrease } from '@/lib/plans/catalog';
import {
  restoreDowngradeArchivedCapacity,
  type UpgradeCapacityRestorationOutcome,
  type UpgradeCapacitySql,
} from '@/lib/stripe/upgrade-capacity-postgres';
import { immediateSubscriptionChangeIdempotencyKey } from '@/lib/stripe/subscription-creation';
import {
  readStripeMutationJson,
  StripeMutationRequestError,
} from '@/lib/stripe/mutation-request';

// =============================================================================
// POST /api/stripe/change-subscription
// 
// Created: December 2025
// Author: Development Team
// 
// PURPOSE:
// Allows users to change their subscription plan and/or billing interval.
// This handles upgrades, downgrades, and billing interval changes.
//
// USE CASES:
// 1. Upgrade: Pro → Business (immediate, prorated charge)
// 2. Downgrade: Business → Pro (takes effect at next billing cycle)
// 3. Interval Change: Monthly → Annual or Annual → Monthly
// 4. Trial User: Can upgrade plan OR end trial early and start billing
//
// STRIPE BEHAVIOR:
// - Upgrades: Immediate with proration (user charged difference today)
// - Downgrades: Takes effect at end of current billing period
// - Trial + Upgrade: Option to keep trial or end trial and start billing
//
// SECURITY:
// - Requires authenticated Stack Auth session
// - Verifies authenticated user matches the requested userId
// - Validates all inputs server-side (plan, interval)
// - Verifies user has an existing Stripe subscription
// - Prevents no-op changes (same plan + interval)
// - All changes go through Stripe API (source of truth)
// - Webhook will sync any changes back to our database
//
// IMPORTANT:
// - This route MODIFIES an existing subscription
// - For NEW subscriptions, use /api/stripe/create-subscription
// - Database is updated via webhook (customer.subscription.updated event)
// =============================================================================

const postgresBigintId = z.string().regex(/^[1-9][0-9]{0,18}$/);
const changeSubscriptionSchema = z.object({
  userId: z.number().int().positive(),
  newPlan: z.enum(['pro', 'business']),
  newBillingInterval: z.enum(['monthly', 'annual']),
  endTrialNow: z.boolean().optional(),
  downgradeRetention: z.object({
    brandIds: z.array(postgresBigintId).min(1).max(100),
    locationIds: z.array(postgresBigintId).min(1).max(500),
  }).strict().optional(),
}).strict();

class PendingSubscriptionChangeConflictError extends Error {
  constructor() {
    super('A different paid subscription change is already waiting for payment.');
    this.name = 'PendingSubscriptionChangeConflictError';
  }
}

async function lockStripeSubscriptionOwner(
  transaction: SubscriptionPlanChangeSql,
  input: { userId: number; stripeCustomerId: string; stripeSubscriptionId: string },
): Promise<void> {
  await transaction`
    SELECT pg_advisory_xact_lock(
      hashtextextended(${`stripe-subscription:${input.stripeCustomerId}`}, 0)
    )
  `;
  const accounts = await transaction<{ id: number }[]>`
    SELECT id
    FROM crewcast.users
    WHERE id = ${input.userId}
    LIMIT 2
    FOR UPDATE
  `;
  if (accounts.length !== 1) {
    throw new Error('Application account changed while scheduling the downgrade.');
  }
  const owners = await transaction<{ user_id: number }[]>`
    SELECT user_id
    FROM crewcast.subscriptions
    WHERE user_id = ${input.userId}
      AND stripe_customer_id = ${input.stripeCustomerId}
      AND stripe_subscription_id = ${input.stripeSubscriptionId}
    LIMIT 2
    FOR UPDATE
  `;
  if (owners.length !== 1) {
    throw new Error('Stripe subscription ownership changed while scheduling the downgrade.');
  }
}

async function readPendingPaymentAction(
  subscription: Stripe.Subscription,
  targetPriceId: string,
): Promise<{ clientSecret: string; invoiceId: string } | null> {
  const pendingPriceId = extractPendingSubscriptionPriceId(subscription);
  if (!pendingPriceId) return null;
  if (pendingPriceId !== targetPriceId) {
    throw new PendingSubscriptionChangeConflictError();
  }

  const invoiceId = extractStripeId(subscription.latest_invoice);
  if (!invoiceId) {
    throw new Error('Stripe returned a pending subscription change without an invoice.');
  }
  const expandedInvoice = typeof subscription.latest_invoice === 'object'
    && subscription.latest_invoice !== null
    ? subscription.latest_invoice
    : await stripe.invoices.retrieve(invoiceId, { expand: ['confirmation_secret'] });
  let clientSecret = extractInvoiceConfirmationClientSecret(expandedInvoice);
  if (!clientSecret) {
    const refreshedInvoice = await stripe.invoices.retrieve(
      invoiceId,
      { expand: ['confirmation_secret'] },
    );
    clientSecret = extractInvoiceConfirmationClientSecret(refreshedInvoice);
  }
  if (!clientSecret) {
    throw new Error('Stripe did not provide a safe payment confirmation secret.');
  }
  return { clientSecret, invoiceId };
}

export async function POST(request: NextRequest) {
  try {
    // =========================================================================
    // STEP 1: AUTHENTICATION
    // Verify the user is authenticated via Stack Auth
    // =========================================================================
    const authenticated = await requireAuthenticatedAccount();

    // =========================================================================
    // STEP 2: PARSE AND VALIDATE REQUEST BODY
    // =========================================================================
    const parsedBody = changeSubscriptionSchema.safeParse(await readStripeMutationJson(request));
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Invalid request input.', code: 'INVALID_INPUT' },
        { status: 400 },
      );
    }
    const {
      userId: legacyUserId,
      newPlan,
      newBillingInterval,
      endTrialNow = false,
      downgradeRetention,
    } = parsedBody.data;

    // Validate userId
    if (!legacyUserId || typeof legacyUserId !== 'number') {
      return NextResponse.json(
        { error: 'Valid user ID is required' },
        { status: 400 }
      );
    }
    assertLegacyAccountId(legacyUserId, authenticated.account.id);
    const userId = authenticated.account.id;

    // Validate plan
    if (!newPlan || !isValidPlan(newPlan)) {
      return NextResponse.json(
        { error: 'Valid plan is required (pro or business)' },
        { status: 400 }
      );
    }

    // Validate billing interval
    if (!newBillingInterval || !isValidInterval(newBillingInterval)) {
      return NextResponse.json(
        { error: 'Valid billing interval is required (monthly or annual)' },
        { status: 400 }
      );
    }

    // =========================================================================
    // STEP 3: GET USER AND CURRENT SUBSCRIPTION FROM DATABASE
    // =========================================================================
    const userAndSub = await sql`
      SELECT 
        u.id,
        u.email, 
        u.name,
        s.stripe_customer_id, 
        s.stripe_subscription_id
      FROM crewcast.users u
      LEFT JOIN crewcast.subscriptions s ON u.id = s.user_id
      WHERE u.id = ${userId}
    `;

    if (userAndSub.length === 0) {
      console.error(`[Stripe Change] User not found: ${userId}`);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userAndSub[0];

    // =========================================================================
    // STEP 5: VERIFY USER HAS AN ACTIVE SUBSCRIPTION
    // =========================================================================
    const { stripe_subscription_id, stripe_customer_id } = userData;

    if (!stripe_subscription_id) {
      console.error(`[Stripe Change] No subscription found for user ${userId}`);
      return NextResponse.json(
        { error: 'No active subscription found. Please subscribe first.' },
        { status: 400 }
      );
    }

    if (!stripe_customer_id) {
      console.error(`[Stripe Change] No Stripe customer for user ${userId}`);
      return NextResponse.json(
        { error: 'No Stripe customer found' },
        { status: 400 }
      );
    }

    // =========================================================================
    // STEP 6: CHECK IF THIS IS A NO-OP (same plan + interval)
    // Prevent unnecessary Stripe API calls
    //
    // IMPORTANT (December 2025): If user is on trial and wants to end trial
    // (endTrialNow = true), we MUST proceed even if plan/interval are the same.
    // This allows trial users to "Buy Now" their current plan.
    // =========================================================================
    // =========================================================================
    // STEP 7: GET THE NEW PRICE ID FROM STRIPE
    // =========================================================================
    const newPriceId = getPriceId(newPlan, newBillingInterval);
    
    if (!newPriceId) {
      console.error(`[Stripe Change] Price ID not found for plan: ${newPlan}, interval: ${newBillingInterval}`);
      return NextResponse.json(
        { error: 'Invalid plan configuration' },
        { status: 500 }
      );
    }

    // =========================================================================
    // STEP 8: RETRIEVE CURRENT SUBSCRIPTION FROM STRIPE
    // We need to know the current subscription item ID to update it
    // =========================================================================
    console.log(`[Stripe Change] Retrieving subscription ${stripe_subscription_id} from Stripe`);
    
    let stripeSubscription;
    try {
      stripeSubscription = await stripe.subscriptions.retrieve(stripe_subscription_id);
    } catch (error) {
      console.error(`[Stripe Change] Failed to retrieve subscription from Stripe:`, error);
      return NextResponse.json(
        { error: 'Failed to retrieve subscription from Stripe' },
        { status: 500 }
      );
    }

    const stripeSnapshot = snapshotStripeSubscription(stripeSubscription, {
      proMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
      proAnnual: process.env.STRIPE_PRICE_PRO_ANNUAL,
      businessMonthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY,
      businessAnnual: process.env.STRIPE_PRICE_BUSINESS_ANNUAL,
    });
    if (stripeSnapshot.customerId !== stripe_customer_id) {
      throw new Error('The stored Stripe subscription belongs to a different customer.');
    }
    if (!isPlanChangeEligibleSubscriptionStatus(stripeSnapshot.status)) {
      return NextResponse.json(
        { error: 'The current Stripe subscription is not eligible for a plan change.' },
        { status: 409 },
      );
    }
    if (stripeSubscription.collection_method !== 'charge_automatically') {
      return NextResponse.json(
        {
          error: 'This subscription cannot be changed through automatic card billing.',
          code: 'UNSUPPORTED_COLLECTION_METHOD',
        },
        { status: 409 },
      );
    }


    // A failed/3DS-required paid update remains in Stripe as a pending update.
    // Reuse its invoice instead of voiding it and creating another charge.
    const existingPaymentAction = await readPendingPaymentAction(
      stripeSubscription,
      newPriceId,
    );
    if (existingPaymentAction) {
      return NextResponse.json(
        {
          error: 'Please confirm the payment to finish this plan change.',
          code: 'PAYMENT_ACTION_REQUIRED',
          clientSecret: existingPaymentAction.clientSecret,
          invoiceId: existingPaymentAction.invoiceId,
        },
        { status: 402 },
      );
    }
    const effectiveCurrentPlanValue: unknown = stripeSnapshot.plan;
    const effectiveCurrentIntervalValue: unknown = stripeSnapshot.billingInterval;
    if (
      effectiveCurrentPlanValue !== 'pro'
      && effectiveCurrentPlanValue !== 'business'
      && effectiveCurrentPlanValue !== 'enterprise'
    ) {
      throw new Error('The current Stripe plan cannot be determined safely.');
    }
    if (effectiveCurrentIntervalValue !== 'monthly' && effectiveCurrentIntervalValue !== 'annual') {
      throw new Error('The current Stripe billing interval cannot be determined safely.');
    }
    const effectiveCurrentPlan = effectiveCurrentPlanValue;
    const effectiveCurrentInterval = effectiveCurrentIntervalValue;
    const isSamePlanAndInterval = effectiveCurrentPlan === newPlan
      && effectiveCurrentInterval === newBillingInterval;
    const isTrialing = stripeSnapshot.status === 'trialing';
    if (isSamePlanAndInterval && !(isTrialing && endTrialNow)) {
      console.log(`[Stripe Change] No change needed for user ${userId} - already on ${newPlan} ${newBillingInterval}`);
      return NextResponse.json({
        success: true,
        message: 'You are already on this plan',
        noChange: true,
      });
    }
    if (isSamePlanAndInterval && isTrialing && endTrialNow) {
      console.log(`[Stripe Change] User ${userId} is ending trial early on ${newPlan} ${newBillingInterval}`);
    }

    // Get the subscription item ID (we need this to update the price)
    // A subscription can have multiple items, but we only have one (the plan)
    const subscriptionItemId = stripeSubscription.items.data[0]?.id;
    const sourcePriceId = extractStripeId(stripeSubscription.items.data[0]?.price);
    
    if (!subscriptionItemId || !sourcePriceId) {
      console.error(`[Stripe Change] No subscription item found for subscription ${stripe_subscription_id}`);
      return NextResponse.json(
        { error: 'Invalid subscription structure' },
        { status: 500 }
      );
    }

    // =========================================================================
    // STEP 9: DETERMINE UPGRADE VS DOWNGRADE
    // This affects proration behavior
    // =========================================================================
    const planHierarchy = { 'pro': 1, 'business': 2, 'enterprise': 3 };
    const currentPlanLevel = planHierarchy[effectiveCurrentPlan];
    const newPlanLevel = planHierarchy[newPlan as keyof typeof planHierarchy] || 0;
    
    const isUpgrade = newPlanLevel > currentPlanLevel;
    const isDowngrade = newPlanLevel < currentPlanLevel;
    const isSamePlanIntervalChange = effectiveCurrentPlan === newPlan
      && effectiveCurrentInterval !== newBillingInterval;
    const restoresCapacity = isPlanCapacityIncrease(effectiveCurrentPlan, newPlan);

    if (!isDowngrade && downgradeRetention) {
      return NextResponse.json(
        {
          error: 'A downgrade retention choice is valid only for a lower plan.',
          code: 'INVALID_DOWNGRADE_SELECTION',
        },
        { status: 400 },
      );
    }

    console.log(`[Stripe Change] User ${userId}: ${effectiveCurrentPlan}/${effectiveCurrentInterval} → ${newPlan}/${newBillingInterval}`);
    console.log(`[Stripe Change] isUpgrade: ${isUpgrade}, isDowngrade: ${isDowngrade}, isSamePlanIntervalChange: ${isSamePlanIntervalChange}, isTrialing: ${isTrialing}`);

    // =========================================================================
    // STEP 10: DEFER DOWNGRADES WITH A REAL STRIPE SCHEDULE
    //
    // Changing a subscription item with `proration_behavior: none` changes the
    // price immediately; it only suppresses proration. A two-phase Stripe
    // schedule keeps today's paid plan intact and lets Stripe apply the lower
    // price at the current phase boundary.
    // =========================================================================
    if (isDowngrade) {
      let sourceSubscription = stripeSubscription;
      const sourcePeriodEndSeconds = stripeSnapshot.currentPeriodEndSeconds;
      if (sourcePeriodEndSeconds === null) {
        throw new Error('The current Stripe billing period has no safe end time.');
      }

      // Commit the exact customer choice before Stripe is mutated. If this
      // server stops after Stripe accepts the schedule, the next request or
      // webhook can replay the same operation instead of guessing.
      const durableOperation = await (sql as unknown as {
        begin<T>(callback: (transaction: SubscriptionPlanChangeSql) => Promise<T>): Promise<T>;
      }).begin(async (transaction) => {
        await lockStripeSubscriptionOwner(transaction, {
          userId,
          stripeCustomerId: stripe_customer_id,
          stripeSubscriptionId: stripe_subscription_id,
        });
        const capacity = await prepareDowngradeCapacitySelection(transaction, {
          userId,
          targetPlan: newPlan,
          requestedSelection: downgradeRetention as DowngradeRetentionSelection | undefined,
        });
        return prepareStripeDowngradeOperation(transaction, {
          operationId: randomUUID(),
          attachedScheduleId: stripeSnapshot.scheduleId,
          userId,
          stripeCustomerId: stripe_customer_id,
          stripeSubscriptionId: stripe_subscription_id,
          fromPlan: effectiveCurrentPlan,
          fromBillingInterval: effectiveCurrentInterval,
          sourcePeriodEndSeconds,
          toPlan: newPlan,
          toBillingInterval: newBillingInterval,
          capacitySelectionVersion: capacity.selectionVersion,
          retainedBrandIds: capacity.selection.brandIds,
          retainedLocationIds: capacity.selection.locationIds,
        });
      });

      const scheduledResult = await (sql as unknown as {
        begin<T>(callback: (transaction: SubscriptionPlanChangeSql) => Promise<T>): Promise<T>;
      }).begin(async (transaction) => {
        await lockStripeSubscriptionOwner(transaction, {
          userId,
          stripeCustomerId: stripe_customer_id,
          stripeSubscriptionId: stripe_subscription_id,
        });
        const capacity = await prepareDowngradeCapacitySelection(transaction, {
          userId,
          targetPlan: newPlan,
          requestedSelection: downgradeRetention as DowngradeRetentionSelection | undefined,
        });
        const confirmedOperation = await prepareStripeDowngradeOperation(transaction, {
          operationId: durableOperation.operationId,
          attachedScheduleId: stripeSnapshot.scheduleId,
          userId,
          stripeCustomerId: stripe_customer_id,
          stripeSubscriptionId: stripe_subscription_id,
          fromPlan: effectiveCurrentPlan,
          fromBillingInterval: effectiveCurrentInterval,
          sourcePeriodEndSeconds,
          toPlan: newPlan,
          toBillingInterval: newBillingInterval,
          capacitySelectionVersion: capacity.selectionVersion,
          retainedBrandIds: capacity.selection.brandIds,
          retainedLocationIds: capacity.selection.locationIds,
        });

        if (stripeSnapshot.cancelAtPeriodEnd) {
          sourceSubscription = await stripe.subscriptions.update(
            stripe_subscription_id,
            { cancel_at_period_end: false },
            {
              idempotencyKey:
                `prepare-plan-downgrade:${confirmedOperation.operationId}:resume`.slice(0, 255),
            },
          );
        }
        const scheduled = await ensureDeferredDowngradeSchedule(
          stripe.subscriptionSchedules,
          {
            subscription: sourceSubscription,
            operationId: confirmedOperation.operationId,
            sourcePlan: effectiveCurrentPlan,
            sourceBillingInterval: effectiveCurrentInterval,
            targetPlan: newPlan,
            targetBillingInterval: newBillingInterval,
            targetPriceId: newPriceId,
            accountId: userId,
            changedAt: confirmedOperation.createdAt,
          },
        );
        const effectiveAt = new Date(scheduled.effectiveAtSeconds * 1000).toISOString();

        await recordDeferredPlanChange(transaction, {
          userId,
          stripeSubscriptionId: stripe_subscription_id,
          stripeScheduleId: scheduled.scheduleId,
          fromPlan: effectiveCurrentPlan,
          fromBillingInterval: effectiveCurrentInterval,
          toPlan: newPlan,
          toBillingInterval: newBillingInterval,
          effectiveAt,
          capacitySelectionVersion: capacity.selectionVersion,
          retainedBrandIds: capacity.selection.brandIds,
          retainedLocationIds: capacity.selection.locationIds,
        });
        await completeStripeDowngradeOperation(transaction, {
          userId,
          operationId: confirmedOperation.operationId,
          stripeScheduleId: scheduled.scheduleId,
          effectiveAt,
        });
        await transaction`
          UPDATE crewcast.subscriptions
          SET cancel_at_period_end = false, updated_at = NOW()
          WHERE user_id = ${userId}
            AND stripe_customer_id = ${stripe_customer_id}
            AND stripe_subscription_id = ${stripe_subscription_id}
        `;
        return { effectiveAt, capacity };
      });
      const { effectiveAt, capacity } = scheduledResult;

      return NextResponse.json({
        success: true,
        subscription: {
          id: sourceSubscription.id,
          status: sourceSubscription.status,
          plan: effectiveCurrentPlan,
          billingInterval: effectiveCurrentInterval,
          currentPeriodEnd: effectiveAt,
          trialEnd: stripeSnapshot.trialEndSeconds
            ? new Date(stripeSnapshot.trialEndSeconds * 1000).toISOString()
            : null,
          cancelAtPeriodEnd: false,
        },
        pendingPlanChange: {
          plan: newPlan,
          billingInterval: newBillingInterval,
          effectiveAt,
          retainedBrandIds: capacity.selection.brandIds,
          retainedLocationIds: capacity.selection.locationIds,
        },
        change: {
          type: 'downgrade',
          from: { plan: effectiveCurrentPlan, interval: effectiveCurrentInterval },
          to: { plan: newPlan, interval: newBillingInterval },
          effectiveImmediately: false,
          trialEnded: false,
        },
        message: 'Your plan will be downgraded at the end of your current billing period.',
      });
    }

    // A customer can change direction while a managed downgrade is pending.
    // Release only schedules created by this application; an unknown Stripe
    // schedule is never overwritten or silently discarded.
    const releasedScheduleId = await releaseManagedPlanSchedule(
      stripe.subscriptionSchedules,
      stripeSubscription,
      `immediate-change-${newPlan}-${newBillingInterval}`,
    );
    if (releasedScheduleId) {
      await cancelPendingSubscriptionPlanChange(
        sql as unknown as SubscriptionPlanChangeSql,
        userId,
        releasedScheduleId,
      );
    }

    // =========================================================================
    // STEP 11: UPDATE SUBSCRIPTION IN STRIPE
    //
    // This branch now handles only immediate changes. Downgrades returned from
    // the schedule branch above and never reach a direct price replacement.
    // Upgrades and same-plan interval changes use Stripe prorations.
    // =========================================================================

    const updateParams: Stripe.SubscriptionUpdateParams = {
      items: [{
        id: subscriptionItemId,
        price: newPriceId,
      }],
      // Stripe's documented pending-update flow keeps the old plan in force
      // until the upgrade/interval-change invoice is actually paid.
      payment_behavior: 'pending_if_incomplete',
      proration_behavior: 'always_invoice',
      expand: ['latest_invoice.confirmation_secret'],
    };

    // Every branch reaching this point is an immediate, potentially chargeable
    // change. `always_invoice` above attempts the prorated payment now; the old
    // `create_prorations` value could defer it until a later invoice.
    if (isUpgrade || isSamePlanIntervalChange) {
      console.log(`[Stripe Change] Applying an immediate, payment-gated prorated change`);
    }

    // Handle trial ending option
    if (isTrialing && endTrialNow) {
      // User wants to end trial and start paying immediately
      updateParams.trial_end = 'now';
      console.log(`[Stripe Change] Ending trial immediately for user ${userId}`);
    }

    // `cancel_at_period_end` is not supported inside Stripe pending updates.
    // Clear it separately and idempotently before attempting the paid change.
    if (stripeSnapshot.cancelAtPeriodEnd) {
      stripeSubscription = await stripe.subscriptions.update(
        stripe_subscription_id,
        { cancel_at_period_end: false },
        {
          idempotencyKey:
            `resume-for-plan-change:${stripe_subscription_id}:${stripeSnapshot.currentPeriodEndSeconds ?? 'unknown'}`
              .slice(0, 255),
        },
      );
      console.log(`[Stripe Change] Removing pending cancellation`);
    }

    // =========================================================================
    // STEP 11: EXECUTE THE UPDATE
    // =========================================================================
    console.log(`[Stripe Change] Updating subscription ${stripe_subscription_id} with new price ${newPriceId}`);
    
    let updatedSubscription;
    const stripeChangeIdempotencyKey = immediateSubscriptionChangeIdempotencyKey({
      accountId: userId,
      stripeCustomerId: stripe_customer_id,
      stripeSubscriptionId: stripe_subscription_id,
      sourcePriceId,
      sourceStatus: stripeSubscription.status,
      sourcePeriodEndSeconds: stripeSnapshot.currentPeriodEndSeconds,
      attachedScheduleId: stripeSnapshot.scheduleId,
    });
    try {
      updatedSubscription = await stripe.subscriptions.update(
        stripe_subscription_id,
        updateParams,
        {
          idempotencyKey: stripeChangeIdempotencyKey,
        },
      );
    } catch (error) {
      console.error(`[Stripe Change] Failed to update subscription in Stripe:`, error);
      
      // Handle specific Stripe errors
      if (error instanceof Error && 'type' in error) {
        const stripeError = error as { type: string; message: string; code?: string };
        
        if (stripeError.code === 'card_declined') {
          return NextResponse.json(
            { error: 'Your card was declined. Please update your payment method.' },
            { status: 400 }
          );
        }
        
        return NextResponse.json(
          { error: stripeError.message },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to update subscription' },
        { status: 500 }
      );
    }

    const paymentAction = await readPendingPaymentAction(updatedSubscription, newPriceId);
    if (paymentAction) {
      console.log(`[Stripe Change] Payment action required before applying ${newPlan}/${newBillingInterval}`);
      return NextResponse.json(
        {
          error: 'Please confirm the payment to finish this plan change.',
          code: 'PAYMENT_ACTION_REQUIRED',
          clientSecret: paymentAction.clientSecret,
          invoiceId: paymentAction.invoiceId,
        },
        { status: 402 },
      );
    }

    console.log(`[Stripe Change] Payment confirmed and subscription updated to ${newPlan}/${newBillingInterval}`);

    // =========================================================================
    // STEP 12: UPDATE OUR DATABASE
    // Note: The webhook will also update our database, but we do it here
    // for immediate consistency. The webhook acts as a backup/sync.
    // =========================================================================
    const updatedSnapshot = snapshotStripeSubscription(updatedSubscription, {
      proMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
      proAnnual: process.env.STRIPE_PRICE_PRO_ANNUAL,
      businessMonthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY,
      businessAnnual: process.env.STRIPE_PRICE_BUSINESS_ANNUAL,
    });
    if (
      updatedSnapshot.plan !== newPlan
      || updatedSnapshot.billingInterval !== newBillingInterval
    ) {
      throw new Error('Stripe did not apply the requested subscription price.');
    }
    const newStatus = updatedSnapshot.status;
    const periodEndIso = updatedSnapshot.currentPeriodEndSeconds
      ? new Date(updatedSnapshot.currentPeriodEndSeconds * 1000).toISOString()
      : null;
    const trialEndIso = updatedSnapshot.trialEndSeconds
      ? new Date(updatedSnapshot.trialEndSeconds * 1000).toISOString()
      : null;

    let capacityRestoration: UpgradeCapacityRestorationOutcome = {
      status: 'none',
      restoredBrands: 0,
      restoredLocations: 0,
    };
    capacityRestoration = await (sql as unknown as {
      begin<T>(callback: (transaction: UpgradeCapacitySql) => Promise<T>): Promise<T>;
    }).begin(async (transaction) => {
      await lockStripeSubscriptionOwner(
        transaction as unknown as SubscriptionPlanChangeSql,
        {
          userId,
          stripeCustomerId: stripe_customer_id,
          stripeSubscriptionId: stripe_subscription_id,
        },
      );
      const updatedSubscriptions = await transaction<{ user_id: number }[]>`
        UPDATE crewcast.subscriptions
        SET
          plan = ${newPlan},
          billing_interval = ${newBillingInterval},
          status = ${newStatus},
          current_period_end = ${periodEndIso},
          trial_ends_at = ${trialEndIso},
          cancel_at_period_end = ${updatedSnapshot.cancelAtPeriodEnd},
          updated_at = NOW()
        WHERE user_id = ${userId}
          AND stripe_customer_id = ${stripe_customer_id}
          AND stripe_subscription_id = ${stripe_subscription_id}
        RETURNING user_id
      `;
      const updatedUsers = await transaction<{ id: number }[]>`
        UPDATE crewcast.users
        SET
          plan = ${newPlan},
          updated_at = NOW()
        WHERE id = ${userId}
        RETURNING id
      `;
      if (updatedSubscriptions.length !== 1 || updatedUsers.length !== 1) {
        throw new Error('The confirmed Stripe upgrade did not update exactly one application account.');
      }

      // Restore only downgrade-archived capacity, never rows the customer
      // archived manually. The shared function is idempotent, so the Stripe
      // webhook can safely run the same recovery as a delayed backup.
      if (restoresCapacity && (newStatus === 'active' || newStatus === 'trialing')) {
        return restoreDowngradeArchivedCapacity(transaction, {
          userId,
          targetPlan: newPlan,
          stripeSubscriptionId: stripe_subscription_id,
        });
      }
      return capacityRestoration;
    });

    console.log(`[Stripe Change] Database updated for user ${userId}`);

    // =========================================================================
    // STEP 12.5: RESET CREDITS IMMEDIATELY FOR UPGRADES AND TRIAL ENDINGS
    // 
    // CRITICAL FIX (Dec 2025): Reset credits immediately when:
    // 1. Trial user ends trial early (endTrialNow=true) - gets paid plan credits
    // 2. Active user UPGRADES (Pro → Business) - gets new plan credits immediately
    // 
    // Why immediate reset is needed:
    // - The invoice.paid webhook may be delayed or only fire at next billing cycle
    // - User sees new plan in UI but would have old credits without this fix
    // - Downgrades should NOT reset immediately (change takes effect at period end)
    // 
    // The webhook still acts as a backup/sync mechanism.
    // =========================================================================
    const shouldResetCredits = 
      (isTrialing && endTrialNow && newStatus === 'active') || // Trial → Paid
      (isUpgrade && newStatus === 'active') || // Pro → Business upgrade
      (isSamePlanIntervalChange && newStatus === 'active'); // Monthly → Annual (or vice versa)
    
    if (shouldResetCredits) {
      const reason = isTrialing && endTrialNow 
        ? 'Trial ended' 
        : isUpgrade 
          ? 'Plan upgraded' 
          : 'Billing interval changed';
      console.log(`[Stripe Change] ${reason} - resetting credits immediately for user ${userId}`);
      
      try {
        const normalizedPlan = normalizePlan(newPlan);

        // April 20th, 2026: resetCreditsForNewPeriod ignores the passed
        // periodEnd and always creates a 1-month entitlement window from
        // periodStart — see the policy comment on that function in
        // src/lib/credits.ts. The periodEnd computed above (from Stripe's
        // current_period_end, potentially 1 year out for annual) is kept
        // here so future refactors can decide whether to drop the retrieval
        // entirely, but it does not affect the credit window.
        // Every immediate paid change now creates an invoice. Use that exact
        // invoice as the shared idempotency key so this fast UX path and the
        // durable invoice.paid webhook can never reset balances twice.
        const stripeInvoiceId = extractStripeId(updatedSubscription.latest_invoice);
        if (!stripeInvoiceId) {
          console.warn(
            `[Stripe Change] No latest invoice returned for paid plan change; `
            + `leaving the durable invoice.paid webhook to reset credits.`,
          );
        } else {
          const invoice = typeof updatedSubscription.latest_invoice === 'object'
            && updatedSubscription.latest_invoice !== null
            ? updatedSubscription.latest_invoice
            : await stripe.invoices.retrieve(stripeInvoiceId);
          const servicePeriod = extractInvoiceSubscriptionServicePeriod(
            invoice,
            stripe_subscription_id,
            { allowProrationFallback: true },
          );
          if (!servicePeriod) {
            console.warn(
              `[Stripe Change] Invoice ${stripeInvoiceId} has no safe service period; `
              + `leaving the durable invoice.paid webhook to reset credits.`,
            );
          } else {
            const periodStart = new Date(servicePeriod.startSeconds * 1000);
            const periodEnd = new Date(servicePeriod.endSeconds * 1000);
          const resetOutcome = await resetCreditsForNewPeriod(
            userId,
            normalizedPlan,
            periodStart,
            periodEnd,
            { stripeInvoiceId },
          );
          console.log(
            `[Stripe Change] Credit reset outcome for user ${userId} `
            + `on ${normalizedPlan}: ${resetOutcome}.`,
          );
          }
        }
      } catch (creditError) {
        // Log error but don't fail the request - webhook will retry
        console.error(`[Stripe Change] Failed to reset credits for user ${userId}:`, creditError);
      }
    }

    // =========================================================================
    // STEP 12.6: SET FIRST_PAYMENT_AT FOR AUTO-SCAN ACCESS (January 14th, 2026)
    // 
    // CRITICAL FIX: Set first_payment_at directly when trial ends or user becomes active.
    // This unlocks the auto-scan countdown clock immediately.
    // 
    // SECURITY:
    // - This code ONLY runs AFTER stripe.subscriptions.update() succeeds
    // - If Stripe's API call fails (e.g., card declined), we never reach here
    // - Stripe validates the payment method and charges the user
    // - We verify: user is authenticated, owns this subscription, and Stripe confirmed active
    // 
    // CONDITIONS:
    // - Status is now 'active' (confirmed by Stripe)
    // - User was on trial and ended it (endTrialNow=true), OR
    // - User upgraded and is active
    // - first_payment_at is not already set (prevent duplicate updates)
    // 
    // This is MORE reliable than waiting for webhook because:
    // - No race conditions with frontend refetch
    // - Immediate UI update
    // - Webhook still acts as backup
    // =========================================================================
    const shouldSetFirstPayment = 
      newStatus === 'active' && // Stripe confirmed active status
      (isTrialing && endTrialNow); // Trial was just ended (user clicked "Buy Now")
    
    if (shouldSetFirstPayment) {
      try {
        // Check if first_payment_at is not already set
        const currentSub = await sql`
          SELECT first_payment_at FROM crewcast.subscriptions WHERE user_id = ${userId}
        `;
        
        if (currentSub.length > 0 && !currentSub[0].first_payment_at) {
          const now = new Date();
          const nextScanAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
          
          await sql`
            UPDATE crewcast.subscriptions
            SET
              first_payment_at = ${now.toISOString()},
              next_auto_scan_at = ${nextScanAt.toISOString()},
              updated_at = NOW()
            WHERE user_id = ${userId}
          `;
          
          console.log(`[Stripe Change] ✅ AUTO-SCAN UNLOCKED for user ${userId}`);
          console.log(`[Stripe Change]    first_payment_at: ${now.toISOString()}`);
          console.log(`[Stripe Change]    next_auto_scan_at: ${nextScanAt.toISOString()}`);
        } else if (currentSub.length > 0 && currentSub[0].first_payment_at) {
          console.log(`[Stripe Change] first_payment_at already set, skipping`);
        }
      } catch (autoScanError) {
        // Log error but don't fail the request - webhook will retry
        console.error(`[Stripe Change] Failed to set auto-scan schedule for user ${userId}:`, autoScanError);
      }
    }

    // =========================================================================
    // STEP 13: CALCULATE PRORATION AMOUNT FOR RESPONSE
    // This is informational for the frontend
    // =========================================================================
    let prorationMessage = '';
    
    if (isUpgrade) {
      const newPlanDetails = PLAN_DETAILS[newPlan];
      const newPrice = newBillingInterval === 'monthly' 
        ? newPlanDetails.monthly.amount / 100 
        : newPlanDetails.annual.amount / 100;
      prorationMessage = `Your plan has been upgraded. You may see a prorated charge for €${newPrice.toFixed(2)}.`;
    } else if (isSamePlanIntervalChange) {
      prorationMessage = `Your billing interval has been updated. Any difference will be prorated.`;
    }

    // =========================================================================
    // STEP 14: RETURN SUCCESS RESPONSE
    // =========================================================================
    console.log(`[Stripe Change] Subscription changed successfully for user ${userId}: ${effectiveCurrentPlan}/${effectiveCurrentInterval} → ${newPlan}/${newBillingInterval}`);
    
    return NextResponse.json({
      success: true,
      subscription: {
        id: updatedSubscription.id,
        status: updatedSubscription.status,
        plan: newPlan,
        billingInterval: newBillingInterval,
        currentPeriodEnd: periodEndIso,
        trialEnd: trialEndIso,
        cancelAtPeriodEnd: updatedSnapshot.cancelAtPeriodEnd,
      },
      change: {
        type: isUpgrade ? 'upgrade' : 'interval_change',
        from: { plan: effectiveCurrentPlan, interval: effectiveCurrentInterval },
        to: { plan: newPlan, interval: newBillingInterval },
        effectiveImmediately: isUpgrade || isSamePlanIntervalChange,
        trialEnded: isTrialing && endTrialNow,
      },
      capacityRestoration,
      message: prorationMessage,
    });

  } catch (error) {
    if (error instanceof PendingSubscriptionChangeConflictError) {
      return NextResponse.json(
        { error: error.message, code: 'SUBSCRIPTION_CHANGE_IN_PROGRESS' },
        { status: 409 },
      );
    }
    if (error instanceof DowngradeCapacityError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          ...(error.assessment ? { downgradeCapacity: error.assessment } : {}),
        },
        { status: error.status },
      );
    }
    if (error instanceof StripeMutationRequestError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    if (error instanceof AccountAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof UnsupportedSubscriptionScheduleError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof StripeDowngradeOperationConflictError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    // =========================================================================
    // ERROR HANDLING
    // Log error and return generic message to avoid leaking details
    // =========================================================================
    console.error('[Stripe Change] Unexpected error:', error);
    
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
