import { NextRequest, NextResponse } from 'next/server';
import { sql, DbSubscription } from '@/lib/db';

// GET /api/subscriptions?userId=xxx - Get subscription by user ID
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const subscriptions = await sql`
      SELECT * FROM subscriptions WHERE user_id = ${parseInt(userId)}
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

// POST /api/subscriptions - Create a new subscription (during onboarding with card details)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, plan, billingInterval, cardLast4, cardBrand, cardExpMonth, cardExpYear } = body;

    if (!userId || !plan) {
      return NextResponse.json({ error: 'User ID and plan are required' }, { status: 400 });
    }

    // Calculate trial end date (3 days from now)
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 3);

    // Check if subscription already exists
    const existing = await sql`
      SELECT * FROM subscriptions WHERE user_id = ${userId}
    `;

    if (existing.length > 0) {
      // Update existing subscription with card details
      const updated = await sql`
        UPDATE subscriptions
        SET 
          plan = ${plan},
          billing_interval = ${billingInterval || 'monthly'},
          status = 'trialing',
          trial_ends_at = ${trialEndsAt.toISOString()},
          current_period_start = NOW(),
          card_last4 = COALESCE(${cardLast4 ?? null}, card_last4),
          card_brand = COALESCE(${cardBrand ?? null}, card_brand),
          card_exp_month = COALESCE(${cardExpMonth ?? null}, card_exp_month),
          card_exp_year = COALESCE(${cardExpYear ?? null}, card_exp_year),
          updated_at = NOW()
        WHERE user_id = ${userId}
        RETURNING *
      `;
      
      // Also update user's billing info
      if (cardLast4) {
        const expiry = cardExpMonth && cardExpYear 
          ? `${String(cardExpMonth).padStart(2, '0')}/${String(cardExpYear).slice(-2)}`
          : null;
        await sql`
          UPDATE users
          SET
            billing_last4 = ${cardLast4},
            billing_brand = ${cardBrand ?? null},
            billing_expiry = ${expiry},
            updated_at = NOW()
          WHERE id = ${userId}
        `;
      }
      
      return NextResponse.json({ subscription: updated[0] as DbSubscription, created: false });
    }

    // Create new subscription with card details
    const result = await sql`
      INSERT INTO subscriptions (
        user_id, 
        plan, 
        billing_interval,
        status, 
        trial_ends_at,
        current_period_start,
        card_last4,
        card_brand,
        card_exp_month,
        card_exp_year
      )
      VALUES (
        ${userId}, 
        ${plan}, 
        ${billingInterval || 'monthly'},
        'trialing',
        ${trialEndsAt.toISOString()},
        NOW(),
        ${cardLast4 ?? null},
        ${cardBrand ?? null},
        ${cardExpMonth ?? null},
        ${cardExpYear ?? null}
      )
      RETURNING *
    `;

    // Also update the user's plan field and billing info for quick access
    const expiry = cardExpMonth && cardExpYear 
      ? `${String(cardExpMonth).padStart(2, '0')}/${String(cardExpYear).slice(-2)}`
      : null;
    
    await sql`
      UPDATE users 
      SET 
        plan = ${plan},
        has_subscription = true,
        trial_start_date = NOW(),
        trial_end_date = ${trialEndsAt.toISOString()},
        billing_last4 = ${cardLast4 ?? null},
        billing_brand = ${cardBrand ?? null},
        billing_expiry = ${expiry},
        updated_at = NOW()
      WHERE id = ${userId}
    `;

    return NextResponse.json({ subscription: result[0] as DbSubscription, created: true });
  } catch (error) {
    console.error('Error creating subscription:', error);
    return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 });
  }
}

// PATCH /api/subscriptions - Update subscription (for Stripe webhook or manual updates)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, ...updates } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const updatedSubscriptions = await sql`
      UPDATE subscriptions
      SET 
        stripe_customer_id = COALESCE(${updates.stripeCustomerId ?? null}, stripe_customer_id),
        stripe_subscription_id = COALESCE(${updates.stripeSubscriptionId ?? null}, stripe_subscription_id),
        stripe_payment_method_id = COALESCE(${updates.stripePaymentMethodId ?? null}, stripe_payment_method_id),
        plan = COALESCE(${updates.plan ?? null}, plan),
        status = COALESCE(${updates.status ?? null}, status),
        billing_interval = COALESCE(${updates.billingInterval ?? null}, billing_interval),
        current_period_start = COALESCE(${updates.currentPeriodStart ?? null}, current_period_start),
        current_period_end = COALESCE(${updates.currentPeriodEnd ?? null}, current_period_end),
        trial_ends_at = COALESCE(${updates.trialEndsAt ?? null}, trial_ends_at),
        cancel_at_period_end = COALESCE(${updates.cancelAtPeriodEnd ?? null}, cancel_at_period_end),
        card_last4 = COALESCE(${updates.cardLast4 ?? null}, card_last4),
        card_brand = COALESCE(${updates.cardBrand ?? null}, card_brand),
        card_exp_month = COALESCE(${updates.cardExpMonth ?? null}, card_exp_month),
        card_exp_year = COALESCE(${updates.cardExpYear ?? null}, card_exp_year),
        updated_at = NOW()
      WHERE user_id = ${userId}
      RETURNING *
    `;

    if (updatedSubscriptions.length === 0) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    // Also update user's billing info if card details provided
    if (updates.cardLast4 || updates.cardBrand) {
      const expiry = updates.cardExpMonth && updates.cardExpYear 
        ? `${String(updates.cardExpMonth).padStart(2, '0')}/${String(updates.cardExpYear).slice(-2)}`
        : null;
      
      await sql`
        UPDATE users
        SET
          billing_last4 = COALESCE(${updates.cardLast4 ?? null}, billing_last4),
          billing_brand = COALESCE(${updates.cardBrand ?? null}, billing_brand),
          billing_expiry = COALESCE(${expiry}, billing_expiry),
          updated_at = NOW()
        WHERE id = ${userId}
      `;
    }

    return NextResponse.json({ subscription: updatedSubscriptions[0] as DbSubscription });
  } catch (error) {
    console.error('Error updating subscription:', error);
    return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
  }
}

