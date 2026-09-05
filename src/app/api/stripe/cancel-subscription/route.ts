import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { stripe } from '@/lib/stripe';
import { sql } from '@/lib/db';
import {
  AccountAccessError,
  assertLegacyAccountId,
  requireAuthenticatedAccount,
} from '@/lib/auth/account';
import { extractStripeId, snapshotStripeSubscription } from '@/lib/stripe/subscription-state';
import {
  isManagedPlanSchedule,
  releaseManagedPlanSchedule,
  subscriptionScheduleId,
  UnsupportedSubscriptionScheduleError,
} from '@/lib/stripe/subscription-change';
import {
  cancelPendingSubscriptionPlanChange,
  type SubscriptionPlanChangeSql,
} from '@/lib/stripe/subscription-plan-changes-postgres';
import {
  readStripeMutationJson,
  StripeMutationRequestError,
} from '@/lib/stripe/mutation-request';
import { subscriptionLifecycleMutationIdempotencyKey } from '@/lib/stripe/subscription-creation';

const cancellationSchema = z.object({
  userId: z.number().int().positive(),
  // Optional during a rolling deployment so an already-open settings page is
  // not broken. New clients send it; old clients get a safe server ID.
  requestId: z.uuid().optional(),
  reason: z.enum(['too_expensive', 'not_what_looking_for', 'didnt_find_enough', 'other']).optional(),
  reasonText: z.string().trim().max(1_000).optional(),
}).strict();

// =============================================================================
// POST /api/stripe/cancel-subscription
// 
// Cancels a Stripe subscription at the end of the current billing period.
// This means the user keeps access until their paid period ends.
//
// SECURITY:
// - Requires an authenticated Supabase application account
// - Verifies authenticated user matches the requested userId
// - Validates userId exists
// - Verifies user owns the subscription
// - Uses Stripe API to cancel (source of truth)
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    // ==========================================================================
    // AUTHENTICATION CHECK
    // Verify the user is authenticated via Stack Auth
    // ==========================================================================
    const authenticated = await requireAuthenticatedAccount();

    const parsedBody = cancellationSchema.safeParse(await readStripeMutationJson(request));
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Invalid request input.', code: 'INVALID_INPUT' },
        { status: 400 },
      );
    }
    const { userId: legacyUserId, requestId, reason, reasonText } = parsedBody.data;

    // ==========================================================================
    // INPUT VALIDATION
    // ==========================================================================
    if (!legacyUserId || typeof legacyUserId !== 'number') {
      return NextResponse.json(
        { error: 'Valid user ID is required' },
        { status: 400 }
      );
    }
    assertLegacyAccountId(legacyUserId, authenticated.account.id);
    const userId = authenticated.account.id;

    // ==========================================================================
    // 2026-08-03 (Paras): OPTIONAL CANCELLATION REASON (David's request)
    //
    // The cancel modal offers a 4-option churn survey; selection is optional.
    // Server-side allowlist — anything else is treated as "not provided" so a
    // tampered payload can never fail the cancellation or store junk codes.
    // Free text (only meaningful for 'other') is length-capped at 1000 chars.
    // Stored in crewcast.cancellation_reasons AND forwarded to Stripe's native
    // cancellation_details so it shows up in Stripe's churn analytics too.
    // ==========================================================================
    const safeReason: string | null = reason ?? null;
    const safeReasonText: string | null =
      safeReason === 'other' && typeof reasonText === 'string' && reasonText.trim()
        ? reasonText.trim().slice(0, 1000)
        : null;
    // Map our codes onto Stripe's fixed feedback enum (SubscriptionUpdateParams.CancellationDetails.Feedback)
    const STRIPE_FEEDBACK: Record<string, 'too_expensive' | 'missing_features' | 'low_quality' | 'other'> = {
      too_expensive: 'too_expensive',
      not_what_looking_for: 'missing_features',
      didnt_find_enough: 'low_quality',
      other: 'other',
    };

    // ==========================================================================
    // VALIDATE SUBSCRIPTION EXISTS
    // ==========================================================================
    const subscriptions = await sql`
      SELECT stripe_subscription_id, stripe_customer_id, status, plan
      FROM crewcast.subscriptions
      WHERE user_id = ${userId}
    `;

    if (subscriptions.length === 0) {
      return NextResponse.json(
        { error: 'No subscription found' },
        { status: 404 }
      );
    }

    const { stripe_subscription_id, stripe_customer_id, status } = subscriptions[0];

    if (!stripe_subscription_id) {
      return NextResponse.json(
        { error: 'No active Stripe subscription' },
        { status: 400 }
      );
    }

    if (status === 'canceled') {
      return NextResponse.json(
        { error: 'Subscription is already canceled' },
        { status: 400 }
      );
    }

    // ==========================================================================
    // CANCEL SUBSCRIPTION IN STRIPE (at period end)
    // ==========================================================================
    console.log(`[Stripe] Canceling subscription ${stripe_subscription_id} for user ${userId}`);

    // A future schedule must not survive a full subscription cancellation or it
    // could later override cancel_at_period_end. Customer cancellation takes
    // precedence, so release the attached schedule first. App-managed schedules
    // additionally close their private pending-change audit row below.
    const currentSubscription = await stripe.subscriptions.retrieve(stripe_subscription_id);
    if (extractStripeId(currentSubscription.customer) !== stripe_customer_id) {
      throw new Error('The stored Stripe subscription belongs to a different customer.');
    }
    const attachedScheduleId = subscriptionScheduleId(currentSubscription);
    let releasedScheduleId: string | null = null;
    if (attachedScheduleId) {
      const attachedSchedule = await stripe.subscriptionSchedules.retrieve(attachedScheduleId);
      if (!isManagedPlanSchedule(attachedSchedule)) {
        throw new UnsupportedSubscriptionScheduleError(
          'This subscription has a Stripe schedule that is not managed by this application.',
        );
      }
      releasedScheduleId = await releaseManagedPlanSchedule(
        stripe.subscriptionSchedules,
        currentSubscription,
        'subscription-canceled',
      );
    }

    // 2026-08-03 (Paras): forward the survey answer to Stripe's native churn
    // analytics in the SAME update call — no extra request. Omitted entirely
    // when the user skipped the survey.
    const subscription = await stripe.subscriptions.update(
      stripe_subscription_id,
      {
        cancel_at_period_end: true,
        ...(safeReason
          ? {
              cancellation_details: {
                feedback: STRIPE_FEEDBACK[safeReason],
                ...(safeReasonText ? { comment: safeReasonText } : {}),
              },
            }
          : {}),
      },
      {
        idempotencyKey: subscriptionLifecycleMutationIdempotencyKey(
          'cancel-at-period-end',
          stripe_customer_id,
          stripe_subscription_id,
          requestId ?? randomUUID(),
        ),
      },
    );

    const updatedSnapshot = snapshotStripeSubscription(subscription, {
      proMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
      proAnnual: process.env.STRIPE_PRICE_PRO_ANNUAL,
      businessMonthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY,
      businessAnnual: process.env.STRIPE_PRICE_BUSINESS_ANNUAL,
    });
    const periodEndIso = updatedSnapshot.currentPeriodEndSeconds
      ? new Date(updatedSnapshot.currentPeriodEndSeconds * 1000).toISOString()
      : null;

    // ==========================================================================
    // UPDATE DATABASE
    // ==========================================================================
    await (sql as unknown as {
      begin<T>(callback: (transaction: SubscriptionPlanChangeSql) => Promise<T>): Promise<T>;
    }).begin(async (transaction) => {
      const updated = await transaction<{ user_id: number }[]>`
        UPDATE crewcast.subscriptions
        SET
          cancel_at_period_end = true,
          updated_at = NOW()
        WHERE user_id = ${userId}
          AND stripe_customer_id = ${stripe_customer_id}
          AND stripe_subscription_id = ${stripe_subscription_id}
        RETURNING user_id
      `;
      if (updated.length !== 1) {
        throw new Error('Cancellation did not update exactly one application subscription.');
      }
      if (releasedScheduleId) {
        await cancelPendingSubscriptionPlanChange(
          transaction,
          userId,
          releasedScheduleId,
        );
      }
    });

    console.log(`[Stripe] Subscription ${stripe_subscription_id} set to cancel at period end`);

    // ==========================================================================
    // 2026-08-03 (Paras): STORE CANCELLATION REASON (fail-safe)
    //
    // Runs AFTER the successful Stripe cancel and MUST NEVER fail the request:
    // a user cancelling their subscription may not be blocked by a survey
    // insert (missing table, DB hiccup, etc). Any error is logged loudly and
    // swallowed. No selection -> no row.
    // ==========================================================================
    if (safeReason) {
      try {
        await sql`
          INSERT INTO crewcast.cancellation_reasons (user_id, reason, reason_text, plan, stripe_subscription_id)
          VALUES (${userId}, ${safeReason}, ${safeReasonText}, ${subscriptions[0].plan ?? null}, ${stripe_subscription_id})
        `;
        console.log(`[Stripe] Cancellation reason stored for user ${userId}: ${safeReason}`);
      } catch (reasonError) {
        console.error(
          `[Stripe] FAILED to store cancellation reason for user ${userId} (reason=${safeReason}). Cancellation itself succeeded. Investigate crewcast.cancellation_reasons.`,
          reasonError
        );
      }
    }

    return NextResponse.json({
      success: true,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        cancelAtPeriodEnd: updatedSnapshot.cancelAtPeriodEnd,
        currentPeriodEnd: periodEndIso,
      },
    });

  } catch (error) {
    if (error instanceof StripeMutationRequestError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    if (error instanceof UnsupportedSubscriptionScheduleError) {
      return NextResponse.json(
        { error: error.message, code: 'UNSUPPORTED_SUBSCRIPTION_SCHEDULE' },
        { status: 409 },
      );
    }
    if (error instanceof AccountAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[Stripe] Error canceling subscription:', error);
    
    return NextResponse.json(
      { error: 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}
