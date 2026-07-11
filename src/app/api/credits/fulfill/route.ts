import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { addTopupCredits } from '@/lib/credits';
import { stripe } from '@/lib/stripe';
import type Stripe from 'stripe';

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

      // ========================================================================
      // SECURITY (C1 fix): Verify with Stripe that this checkout session was
      // actually PAID before granting credits. Previously any 'pending' row was
      // fulfilled without asking Stripe, letting any logged-in user mint free
      // credits by creating a checkout session and never paying.
      //
      // Same contract as the webhook (payment_status === 'paid'). On any
      // uncertainty (Stripe error, unpaid) we SKIP and leave the row 'pending'
      // so the webhook can still fulfill it later if payment eventually lands.
      // ========================================================================
      let session: Stripe.Checkout.Session;
      try {
        session = await stripe.checkout.sessions.retrieve(sessionId);
      } catch (stripeError) {
        console.error(`[Credits Fulfill] ⚠️ Stripe retrieve failed for purchase #${purchase.id} (session ${sessionId}) - skipping, leaving pending`, stripeError);
        results.push({ id: purchase.id, status: 'skipped_stripe_error', creditType, amount });
        continue;
      }

      if (session.payment_status !== 'paid' || !session.amount_total || session.amount_total <= 0) {
        console.log(`[Credits Fulfill] Purchase #${purchase.id} not paid (payment_status=${session.payment_status}, amount_total=${session.amount_total}) - skipping, leaving pending`);
        results.push({ id: purchase.id, status: 'skipped_unpaid', creditType, amount });
        continue;
      }

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
