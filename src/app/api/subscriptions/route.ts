import { NextRequest, NextResponse } from 'next/server';
import { sql, DbSubscription } from '@/lib/db';
import { stackServerApp } from '@/stack/server';

// =============================================================================
// GET /api/subscriptions?userId=xxx
//
// Fetches subscription data for a user.
// 
// SECURITY:
// - Requires authenticated Stack Auth session
// - Verifies authenticated user matches the requested userId
//
// NOTE: All subscription MODIFICATIONS (create, cancel, resume, update payment)
// should use the Stripe API routes:
// - POST /api/stripe/create-subscription
// - POST /api/stripe/cancel-subscription
// - POST /api/stripe/resume-subscription
// - POST /api/stripe/update-payment-method
// =============================================================================

export async function GET(request: NextRequest) {
  console.log('[API /api/subscriptions] ========== REQUEST ==========');
  
  try {
    // ==========================================================================
    // AUTHENTICATION CHECK
    // ==========================================================================
    const authUser = await stackServerApp.getUser();
    console.log('[API /api/subscriptions] Auth user:', authUser?.primaryEmail || 'NOT AUTHENTICATED');
    
    if (!authUser) {
      console.log('[API /api/subscriptions] Returning 401 - Unauthorized');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    console.log('[API /api/subscriptions] Requested userId:', userId);

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const userIdNum = parseInt(userId);
    if (isNaN(userIdNum)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    // ==========================================================================
    // AUTHORIZATION CHECK
    // Verify the authenticated user matches the requested user
    // ==========================================================================
    const users = await sql`
      SELECT email FROM users WHERE id = ${userIdNum}
    `;

    if (users.length === 0) {
      console.log('[API /api/subscriptions] User not found in DB');
      return NextResponse.json({ subscription: null });
    }

    if (authUser.primaryEmail !== users[0].email) {
      console.error(`[API /api/subscriptions] Authorization failed: ${authUser.primaryEmail} tried to access subscription for user ${userIdNum}`);
      return NextResponse.json(
        { error: 'Not authorized to access this resource' },
        { status: 403 }
      );
    }

    // ==========================================================================
    // FETCH SUBSCRIPTION
    // ==========================================================================
    console.log('[API /api/subscriptions] Querying subscriptions table for user_id:', userIdNum);
    const subscriptions = await sql`
      SELECT * FROM subscriptions WHERE user_id = ${userIdNum}
    `;

    if (subscriptions.length === 0) {
      console.log('[API /api/subscriptions] No subscription found for user');
      return NextResponse.json({ subscription: null });
    }

    const sub = subscriptions[0] as DbSubscription;
    
    // DEBUG: Log all important fields
    console.log('[API /api/subscriptions] ========== SUBSCRIPTION DATA ==========');
    console.log('[API /api/subscriptions] id:', sub.id);
    console.log('[API /api/subscriptions] user_id:', sub.user_id);
    console.log('[API /api/subscriptions] status:', sub.status);
    console.log('[API /api/subscriptions] plan:', sub.plan);
    console.log('[API /api/subscriptions] first_payment_at:', sub.first_payment_at);
    console.log('[API /api/subscriptions] next_auto_scan_at:', sub.next_auto_scan_at);
    console.log('[API /api/subscriptions] last_auto_scan_at:', sub.last_auto_scan_at);
    console.log('[API /api/subscriptions] stripe_subscription_id:', sub.stripe_subscription_id);
    console.log('[API /api/subscriptions] trial_ends_at:', sub.trial_ends_at);
    console.log('[API /api/subscriptions] cancel_at_period_end:', sub.cancel_at_period_end);
    console.log('[API /api/subscriptions] ========================================');

    return NextResponse.json({ subscription: sub });
  } catch (error) {
    console.error('[API /api/subscriptions] Error fetching subscription:', error);
    return NextResponse.json({ error: 'Failed to fetch subscription' }, { status: 500 });
  }
}

// =============================================================================
// DEPRECATED: POST and PATCH endpoints have been removed.
//
// All subscription modifications should now use Stripe API routes:
// - Create subscription: POST /api/stripe/create-subscription
// - Cancel subscription: POST /api/stripe/cancel-subscription  
// - Resume subscription: POST /api/stripe/resume-subscription
// - Update payment method: POST /api/stripe/update-payment-method
//
// This ensures Stripe is always the source of truth for subscription state.
// =============================================================================
