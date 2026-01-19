import { NextRequest, NextResponse } from 'next/server';
import { sql, DbSubscription } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/supabase/server'; // January 19th, 2026: Migrated from Stack Auth

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
    const authUser = await getAuthenticatedUser();
    
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
      SELECT email FROM crewcast.users WHERE id = ${userIdNum}
    `;

    if (users.length === 0) {
      return NextResponse.json({ subscription: null });
    }

    if (authUser.email !== users[0].email) {
      console.error(`[Subscriptions] Authorization failed: ${authUser.email} tried to access subscription for user ${userIdNum}`);
      return NextResponse.json(
        { error: 'Not authorized to access this resource' },
        { status: 403 }
      );
    }

    // ==========================================================================
    // FETCH SUBSCRIPTION
    // 
    // KNOWN LOCAL DEV ISSUE (January 14th, 2026):
    // Timestamp fields (first_payment_at, next_auto_scan_at) may display 
    // incorrectly in LOCAL development if your machine is not in UTC timezone.
    // 
    // Root cause: The Neon serverless driver interprets TIMESTAMP columns 
    // using the local machine's timezone. On Vercel (UTC), this works correctly.
    // On a local PC in IST (UTC+5:30), timestamps appear 5.5 hours behind.
    // 
    // PRODUCTION IS NOT AFFECTED - Vercel servers run in UTC.
    // This only affects local development countdown display.
    // 
    // To fix locally, you could use: SET timezone = 'UTC' or format timestamps
    // explicitly as UTC in the SQL query. Not implemented since prod works fine.
    // ==========================================================================
    const subscriptions = await sql`
      SELECT * FROM crewcast.subscriptions WHERE user_id = ${userIdNum}
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
