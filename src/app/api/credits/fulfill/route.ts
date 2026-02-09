import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { addTopupCredits } from '@/lib/credits';

// =============================================================================
// POST /api/credits/fulfill
//
// FALLBACK FULFILLMENT ENDPOINT (February 2026)
//
// Checks if the authenticated user has any pending credit purchases
// and fulfills them. This acts as a safety net when the Stripe webhook
// fails to process checkout.session.completed events.
//
// Called automatically from the settings page when credit_purchase=success
// URL param is detected, BEFORE the webhook has a chance to process.
//
// This is safe because addTopupCredits is idempotent -- if the webhook
// already processed the purchase, this call will detect status='completed'
// and skip it.
//
// SECURITY:
// - Requires authenticated Supabase session
// - Only processes purchases for the authenticated user
// =============================================================================

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { userId } = body;

    if (!userId || typeof userId !== 'number') {
      return NextResponse.json({ error: 'Valid user ID is required' }, { status: 400 });
    }

    // Authorization check
    const users = await sql`
      SELECT email FROM crewcast.users WHERE id = ${userId}
    `;
    if (users.length === 0 || authUser.email !== users[0].email) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Find all pending credit purchases for this user
    const pendingPurchases = await sql`
      SELECT id, stripe_checkout_session_id, credit_type, credits_amount, status
      FROM crewcast.credit_purchases
      WHERE user_id = ${userId} AND status = 'pending'
      ORDER BY created_at DESC
    `;

    if (pendingPurchases.length === 0) {
      return NextResponse.json({
        fulfilled: 0,
        message: 'No pending purchases (webhook may have already processed them)',
      });
    }

    console.log(`[Credits Fulfill] Found ${pendingPurchases.length} pending purchase(s) for user ${userId}`);

    let fulfilled = 0;
    const results = [];

    for (const purchase of pendingPurchases) {
      const creditType = purchase.credit_type as 'email' | 'ai' | 'topic_search';
      const amount = purchase.credits_amount;
      const sessionId = purchase.stripe_checkout_session_id;

      console.log(`[Credits Fulfill] Attempting to fulfill purchase #${purchase.id}: ${amount} ${creditType}`);

      const ok = await addTopupCredits(userId, creditType, amount, sessionId);
      if (ok) {
        fulfilled++;
        results.push({ id: purchase.id, status: 'fulfilled', creditType, amount });
        console.log(`[Credits Fulfill] ✅ Fulfilled purchase #${purchase.id}`);
      } else {
        results.push({ id: purchase.id, status: 'failed', creditType, amount });
        console.error(`[Credits Fulfill] ❌ Failed to fulfill purchase #${purchase.id}`);
      }
    }

    return NextResponse.json({
      fulfilled,
      total: pendingPurchases.length,
      results,
      message: fulfilled > 0
        ? `Fulfilled ${fulfilled} pending purchase(s)`
        : 'No purchases could be fulfilled',
    });

  } catch (error) {
    console.error('[Credits Fulfill] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fulfill pending purchases' },
      { status: 500 }
    );
  }
}
