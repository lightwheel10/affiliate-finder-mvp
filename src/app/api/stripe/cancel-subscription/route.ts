import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { sql } from '@/lib/db';
import { stackServerApp } from '@/stack/server';

// =============================================================================
// POST /api/stripe/cancel-subscription
// 
// Cancels a Stripe subscription at the end of the current billing period.
// This means the user keeps access until their paid period ends.
//
// SECURITY:
// - Requires authenticated Stack Auth session
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
    const authUser = await stackServerApp.getUser();
    
    if (!authUser) {
      console.error('[Stripe] Unauthorized: No authenticated user');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { userId } = body;

    // ==========================================================================
    // INPUT VALIDATION
    // ==========================================================================
    if (!userId || typeof userId !== 'number') {
      return NextResponse.json(
        { error: 'Valid user ID is required' },
        { status: 400 }
      );
    }

    // ==========================================================================
    // GET USER AND SUBSCRIPTION FROM DATABASE
    // ==========================================================================
    const userAndSub = await sql`
      SELECT u.email, s.stripe_subscription_id, s.stripe_customer_id, s.status
      FROM users u
      LEFT JOIN subscriptions s ON u.id = s.user_id
      WHERE u.id = ${userId}
    `;

    if (userAndSub.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userAndSub[0];

    // ==========================================================================
    // AUTHORIZATION CHECK
    // Verify the authenticated user matches the requested user
    // ==========================================================================
    if (authUser.primaryEmail !== userData.email) {
      console.error(`[Stripe] Authorization failed: ${authUser.primaryEmail} tried to cancel subscription for user ${userId}`);
      return NextResponse.json(
        { error: 'Not authorized to access this resource' },
        { status: 403 }
      );
    }

    // ==========================================================================
    // VALIDATE SUBSCRIPTION EXISTS
    // ==========================================================================
    const subscriptions = await sql`
      SELECT stripe_subscription_id, stripe_customer_id, status
      FROM subscriptions
      WHERE user_id = ${userId}
    `;

    if (subscriptions.length === 0) {
      return NextResponse.json(
        { error: 'No subscription found' },
        { status: 404 }
      );
    }

    const { stripe_subscription_id, status } = subscriptions[0];

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

    const subscription = await stripe.subscriptions.update(stripe_subscription_id, {
      cancel_at_period_end: true,
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
      UPDATE subscriptions
      SET
        cancel_at_period_end = true,
        updated_at = NOW()
      WHERE user_id = ${userId}
    `;

    console.log(`[Stripe] Subscription ${stripe_subscription_id} set to cancel at period end`);

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
    console.error('[Stripe] Error canceling subscription:', error);
    
    if (error instanceof Error && 'type' in error) {
      const stripeError = error as { type: string; message: string };
      return NextResponse.json(
        { error: stripeError.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}
