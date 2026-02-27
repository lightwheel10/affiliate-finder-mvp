import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { sql } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/supabase/server';

// =============================================================================
// POST /api/stripe/validate-promo-code
//
// Validates a Stripe promotion code before applying it to a subscription.
//
// SECURITY:
// - Requires authenticated Supabase session
// - Verifies authenticated user matches requested userId
// - Returns only safe promo metadata for the UI
// =============================================================================

interface ValidatePromoCodeBody {
  userId: number;
  code: string;
}

function formatAmount(amountInMinorUnits: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amountInMinorUnits / 100);
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: ValidatePromoCodeBody = await request.json();
    const { userId, code } = body;

    if (!userId || typeof userId !== 'number') {
      return NextResponse.json({ error: 'Valid user ID is required' }, { status: 400 });
    }

    if (!code || typeof code !== 'string' || !code.trim()) {
      return NextResponse.json({ error: 'Discount code is required' }, { status: 400 });
    }

    const userRows = await sql`
      SELECT u.id, u.email, s.stripe_customer_id
      FROM crewcast.users u
      LEFT JOIN crewcast.subscriptions s ON u.id = s.user_id
      WHERE u.id = ${userId}
    `;

    if (userRows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = userRows[0];
    if (authUser.email !== user.email) {
      return NextResponse.json({ error: 'Not authorized to access this resource' }, { status: 403 });
    }

    const normalizedCode = code.trim().toUpperCase();

    const promoList = await stripe.promotionCodes.list({
      code: normalizedCode,
      active: true,
      limit: 10,
    });

    // Stripe code matching is case-insensitive, but we still prefer exact trimmed match.
    const promotionCode = promoList.data.find((promo) => promo.code?.toUpperCase() === normalizedCode) || promoList.data[0];

    if (!promotionCode) {
      return NextResponse.json({ error: 'Invalid or expired discount code' }, { status: 400 });
    }

    if (!promotionCode.active) {
      return NextResponse.json({ error: 'This discount code is not active' }, { status: 400 });
    }

    if (promotionCode.expires_at && promotionCode.expires_at < Math.floor(Date.now() / 1000)) {
      return NextResponse.json({ error: 'This discount code has expired' }, { status: 400 });
    }

    if (
      typeof promotionCode.max_redemptions === 'number' &&
      typeof promotionCode.times_redeemed === 'number' &&
      promotionCode.times_redeemed >= promotionCode.max_redemptions
    ) {
      return NextResponse.json({ error: 'This discount code has reached its redemption limit' }, { status: 400 });
    }

    const promoCustomerId = typeof promotionCode.customer === 'string'
      ? promotionCode.customer
      : (promotionCode.customer as Stripe.Customer | null)?.id || null;

    if (promoCustomerId && user.stripe_customer_id && promoCustomerId !== user.stripe_customer_id) {
      return NextResponse.json({ error: 'This discount code is not valid for your account' }, { status: 400 });
    }

    const promoCoupon = promotionCode.promotion?.coupon;
    if (!promoCoupon) {
      return NextResponse.json({ error: 'This discount code has no valid coupon' }, { status: 400 });
    }

    let coupon: Stripe.Coupon;
    if (typeof promoCoupon === 'string') {
      coupon = await stripe.coupons.retrieve(promoCoupon);
    } else {
      coupon = promoCoupon as Stripe.Coupon;
    }

    if (!coupon.valid) {
      return NextResponse.json({ error: 'This discount code is no longer valid' }, { status: 400 });
    }

    const percentOff = coupon.percent_off ?? null;
    const amountOff = coupon.amount_off ?? null;
    const currency = coupon.currency ?? null;

    let discountLabel = 'Discount applied';
    if (typeof percentOff === 'number') {
      discountLabel = `${percentOff}% off`;
    } else if (typeof amountOff === 'number' && currency) {
      discountLabel = `${formatAmount(amountOff, currency)} off`;
    }

    return NextResponse.json({
      valid: true,
      promotionCodeId: promotionCode.id,
      code: promotionCode.code,
      discountLabel,
      discount: {
        type: typeof percentOff === 'number' ? 'percent' : 'amount',
        percentOff,
        amountOff,
        currency,
        duration: coupon.duration,
        durationInMonths: coupon.duration_in_months,
      },
    });
  } catch (error) {
    console.error('[Stripe Promo] Error validating promotion code:', error);

    if (error instanceof Error && 'type' in error) {
      const stripeError = error as { message: string };
      return NextResponse.json({ error: stripeError.message }, { status: 400 });
    }

    return NextResponse.json({ error: 'Failed to validate discount code' }, { status: 500 });
  }
}
