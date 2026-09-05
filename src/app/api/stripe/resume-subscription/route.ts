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
import { snapshotStripeSubscription } from '@/lib/stripe/subscription-state';
import {
  readStripeMutationJson,
  StripeMutationRequestError,
} from '@/lib/stripe/mutation-request';
import { subscriptionLifecycleMutationIdempotencyKey } from '@/lib/stripe/subscription-creation';

const resumeSubscriptionSchema = z.object({
  userId: z.number().int().positive(),
  requestId: z.uuid().optional(),
}).strict();

// =============================================================================
// POST /api/stripe/resume-subscription
// 
// Resumes a subscription that was set to cancel at period end.
// This removes the cancellation and the subscription continues normally.
//
// SECURITY:
// - Requires an authenticated Supabase application account
// - Verifies authenticated user matches the requested userId
// - Validates userId exists
// - Verifies user owns the subscription
// - Uses Stripe API to resume (source of truth)
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    // ==========================================================================
    // AUTHENTICATION CHECK
    // Verify the user is authenticated via Stack Auth
    // ==========================================================================
    const authenticated = await requireAuthenticatedAccount();

    const parsedBody = resumeSubscriptionSchema.safeParse(await readStripeMutationJson(request));
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Invalid request input.', code: 'INVALID_INPUT' },
        { status: 400 },
      );
    }
    const { userId: legacyUserId, requestId } = parsedBody.data;

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
    // GET SUBSCRIPTION FROM DATABASE
    // ==========================================================================
    const subscriptions = await sql`
      SELECT stripe_subscription_id, stripe_customer_id, status, cancel_at_period_end
      FROM crewcast.subscriptions
      WHERE user_id = ${userId}
    `;

    if (subscriptions.length === 0) {
      return NextResponse.json(
        { error: 'No subscription found' },
        { status: 404 }
      );
    }

    const { stripe_subscription_id, stripe_customer_id } = subscriptions[0];

    if (!stripe_subscription_id) {
      return NextResponse.json(
        { error: 'No active Stripe subscription' },
        { status: 400 }
      );
    }

    if (!stripe_customer_id) {
      return NextResponse.json(
        { error: 'No Stripe customer found' },
        { status: 400 }
      );
    }

    // ==========================================================================
    // RESUME SUBSCRIPTION IN STRIPE
    // ==========================================================================
    console.log(`[Stripe] Resuming subscription ${stripe_subscription_id} for user ${userId}`);

    const currentSubscription = await stripe.subscriptions.retrieve(stripe_subscription_id);
    const currentSnapshot = snapshotStripeSubscription(currentSubscription, {
      proMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
      proAnnual: process.env.STRIPE_PRICE_PRO_ANNUAL,
      businessMonthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY,
      businessAnnual: process.env.STRIPE_PRICE_BUSINESS_ANNUAL,
    });
    if (currentSnapshot.customerId !== stripe_customer_id) {
      throw new Error('The stored Stripe subscription belongs to a different customer.');
    }
    const subscription = currentSnapshot.cancelAtPeriodEnd
      ? await stripe.subscriptions.update(
          stripe_subscription_id,
          { cancel_at_period_end: false },
          {
            idempotencyKey: subscriptionLifecycleMutationIdempotencyKey(
              'resume',
              stripe_customer_id,
              stripe_subscription_id,
              requestId ?? randomUUID(),
            ),
          },
        )
      : currentSubscription;

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
    const updated = await sql<{ user_id: number }[]>`
      UPDATE crewcast.subscriptions
      SET
        cancel_at_period_end = false,
        updated_at = NOW()
      WHERE user_id = ${userId}
        AND stripe_customer_id = ${stripe_customer_id}
        AND stripe_subscription_id = ${stripe_subscription_id}
      RETURNING user_id
    `;
    if (updated.length !== 1) {
      throw new Error('Resume did not update exactly one application subscription.');
    }

    console.log(`[Stripe] Subscription ${stripe_subscription_id} resumed`);

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
    if (error instanceof AccountAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[Stripe] Error resuming subscription:', error);
    
    if (error instanceof Error && 'type' in error) {
      const stripeError = error as { type: string; message: string };
      return NextResponse.json(
        { error: stripeError.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to resume subscription' },
      { status: 500 }
    );
  }
}
