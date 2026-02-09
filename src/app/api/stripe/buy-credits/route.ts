import { NextRequest, NextResponse } from 'next/server';
import { stripe, getCreditPackDetails, isValidCreditPackId } from '@/lib/stripe';
import { sql } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/supabase/server';

// =============================================================================
// POST /api/stripe/buy-credits
//
// Creates a Stripe Checkout Session for one-time credit pack purchase.
// User must have an active or trialing subscription.
//
// SECURITY:
// - Auth + email match (same as change-subscription)
// - Subscription gate: only active/trialing users can buy
// - Pack ID validated against CREDIT_PACK_PRICES
// - DB insert (credit_purchases pending) before redirect for idempotency
// =============================================================================

export const dynamic = 'force-dynamic';

interface BuyCreditsBody {
  userId: number;
  packId: string;
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: BuyCreditsBody = await request.json();
    const { userId, packId } = body;

    if (!userId || typeof userId !== 'number') {
      return NextResponse.json({ error: 'Valid user ID is required' }, { status: 400 });
    }
    if (!packId || typeof packId !== 'string' || !isValidCreditPackId(packId)) {
      return NextResponse.json({ error: 'Valid credit pack is required' }, { status: 400 });
    }

    const packDetails = getCreditPackDetails(packId);
    if (!packDetails) {
      return NextResponse.json({ error: 'Credit pack not found' }, { status: 400 });
    }

    const userAndSub = await sql`
      SELECT u.id, u.email, u.name, s.stripe_customer_id, s.status
      FROM crewcast.users u
      LEFT JOIN crewcast.subscriptions s ON u.id = s.user_id
      WHERE u.id = ${userId}
    `;

    if (userAndSub.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const row = userAndSub[0];
    if (authUser.email !== row.email) {
      return NextResponse.json({ error: 'Not authorized to access this resource' }, { status: 403 });
    }

    const status = row.status?.toLowerCase();
    if (!row.stripe_customer_id || status !== 'active') {
      return NextResponse.json(
        {
          error:
            status === 'trialing'
              ? 'Credit packs are for paid subscribers only. Subscribe or end your trial to purchase.'
              : 'An active paid subscription is required to buy credit packs.',
        },
        { status: 400 }
      );
    }

    const origin = request.headers.get('origin') || request.headers.get('referer')?.replace(/\/$/, '') || '';
    const baseUrl = origin || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const successUrl = `${baseUrl}/settings?tab=buy_credits&credit_purchase=success`;
    const cancelUrl = `${baseUrl}/settings?tab=buy_credits&credit_purchase=cancelled`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: row.stripe_customer_id,
      line_items: [
        {
          price: packDetails.priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      invoice_creation: { enabled: true },
      metadata: {
        user_id: String(userId),
        pack_id: packId,
        credit_type: packDetails.creditType,
        credits_amount: String(packDetails.credits),
      },
    });

    if (!session.id) {
      return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
    }

    await sql`
      INSERT INTO crewcast.credit_purchases (
        user_id,
        stripe_checkout_session_id,
        credit_type,
        credits_amount,
        amount_paid,
        currency,
        status
      ) VALUES (
        ${userId},
        ${session.id},
        ${packDetails.creditType},
        ${packDetails.credits},
        0,
        'eur',
        'pending'
      )
    `;

    return NextResponse.json({
      url: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error('[Stripe Buy Credits] Error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
