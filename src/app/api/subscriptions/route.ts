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
  try {
    // ==========================================================================
    // AUTHENTICATION CHECK
    // ==========================================================================
    const authUser = await stackServerApp.getUser();
    
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

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
      return NextResponse.json({ subscription: null });
    }

    if (authUser.primaryEmail !== users[0].email) {
      console.error(`[Subscriptions] Authorization failed: ${authUser.primaryEmail} tried to access subscription for user ${userIdNum}`);
      return NextResponse.json(
        { error: 'Not authorized to access this resource' },
        { status: 403 }
      );
    }

    // ==========================================================================
    // FETCH SUBSCRIPTION
    // ==========================================================================
    const subscriptions = await sql`
      SELECT * FROM subscriptions WHERE user_id = ${userIdNum}
    `;

    if (subscriptions.length === 0) {
      return NextResponse.json({ subscription: null });
    }

    return NextResponse.json({ subscription: subscriptions[0] as DbSubscription });
  } catch (error) {
    console.error('Error fetching subscription:', error);
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
