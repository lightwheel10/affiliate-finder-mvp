import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { sql } from '@/lib/db';
import {
  AccountAccessError,
  assertLegacyAccountId,
  requireAuthenticatedAccount,
} from '@/lib/auth/account';

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

    const body = await request.json();
    const { userId: legacyUserId } = body;

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

    const { stripe_subscription_id, cancel_at_period_end } = subscriptions[0];

    if (!stripe_subscription_id) {
      return NextResponse.json(
        { error: 'No active Stripe subscription' },
        { status: 400 }
      );
    }

    if (!cancel_at_period_end) {
      return NextResponse.json(
        { error: 'Subscription is not set to cancel' },
        { status: 400 }
      );
    }

    // ==========================================================================
    // RESUME SUBSCRIPTION IN STRIPE
    // ==========================================================================
    console.log(`[Stripe] Resuming subscription ${stripe_subscription_id} for user ${userId}`);

    const subscription = await stripe.subscriptions.update(stripe_subscription_id, {
      cancel_at_period_end: false,
    });

    // Access subscription properties safely with validation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subObj = subscription as any;
    const periodEndTimestamp = typeof subObj.current_period_end === 'number' ? subObj.current_period_end : null;
    const periodEndIso = periodEndTimestamp ? new Date(periodEndTimestamp * 1000).toISOString() : null;

    // ==========================================================================
    // UPDATE DATABASE
    // ==========================================================================
    await sql`
      UPDATE crewcast.subscriptions
      SET
        cancel_at_period_end = false,
        updated_at = NOW()
      WHERE user_id = ${userId}
    `;

    console.log(`[Stripe] Subscription ${stripe_subscription_id} resumed`);

    return NextResponse.json({
      success: true,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        cancelAtPeriodEnd: !!subObj.cancel_at_period_end,
        currentPeriodEnd: periodEndIso,
      },
    });

  } catch (error) {
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
