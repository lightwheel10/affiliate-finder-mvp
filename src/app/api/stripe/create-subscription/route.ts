import { NextRequest, NextResponse } from 'next/server';
import { stripe, getPriceId, isValidPlan, isValidInterval, TRIAL_DAYS } from '@/lib/stripe';
import { sql } from '@/lib/db';
import { stackServerApp } from '@/stack/server';

// =============================================================================
// POST /api/stripe/create-subscription
// 
// Creates a Stripe Subscription with a free trial after card has been saved.
// This is called AFTER the SetupIntent has been confirmed and PaymentMethod created.
//
// FLOW:
// 1. Validate all inputs (userId, plan, interval, paymentMethodId)
// 2. Verify user exists and has a Stripe customer
// 3. Attach PaymentMethod to Customer (if not already attached)
// 4. Set PaymentMethod as default for the customer
// 5. Create Subscription with trial period
// 6. Update our database with Stripe IDs
//
// SECURITY:
// - Requires authenticated Stack Auth session
// - Verifies authenticated user matches the requested userId
// - Validates all inputs server-side
// - Verifies user exists in database
// - Verifies Stripe customer exists
// - Uses Stripe's PaymentMethod (never raw card data)
// - Idempotent - checks for existing subscription
// =============================================================================

interface CreateSubscriptionBody {
  userId: number;
  plan: string;
  billingInterval: string;
  paymentMethodId: string;
  customerId?: string; // Optional - can be retrieved from DB
}

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

    // Parse request body
    const body: CreateSubscriptionBody = await request.json();
    const { userId, plan, billingInterval, paymentMethodId, customerId: providedCustomerId } = body;

    // ==========================================================================
    // INPUT VALIDATION
    // ==========================================================================
    if (!userId || typeof userId !== 'number') {
      return NextResponse.json(
        { error: 'Valid user ID is required' },
        { status: 400 }
      );
    }

    if (!plan || !isValidPlan(plan)) {
      return NextResponse.json(
        { error: 'Valid plan is required (pro or business)' },
        { status: 400 }
      );
    }

    if (!billingInterval || !isValidInterval(billingInterval)) {
      return NextResponse.json(
        { error: 'Valid billing interval is required (monthly or annual)' },
        { status: 400 }
      );
    }

    if (!paymentMethodId || typeof paymentMethodId !== 'string' || !paymentMethodId.startsWith('pm_')) {
      return NextResponse.json(
        { error: 'Valid payment method ID is required' },
        { status: 400 }
      );
    }

    // ==========================================================================
    // VERIFY USER AND GET STRIPE CUSTOMER
    // ==========================================================================
    const users = await sql`
      SELECT u.id, u.email, u.name, s.stripe_customer_id, s.stripe_subscription_id, s.status
      FROM users u
      LEFT JOIN subscriptions s ON u.id = s.user_id
      WHERE u.id = ${userId}
    `;

    if (users.length === 0) {
      console.error(`[Stripe] User not found: ${userId}`);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const user = users[0];

    // ==========================================================================
    // AUTHORIZATION CHECK
    // Verify the authenticated user matches the requested user
    // This prevents users from creating subscriptions for other users
    // ==========================================================================
    if (authUser.primaryEmail !== user.email) {
      console.error(`[Stripe] Authorization failed: ${authUser.primaryEmail} tried to access user ${userId} (${user.email})`);
      return NextResponse.json(
        { error: 'Not authorized to access this resource' },
        { status: 403 }
      );
    }
    const stripeCustomerId = providedCustomerId || user.stripe_customer_id;

    if (!stripeCustomerId) {
      console.error(`[Stripe] No Stripe customer for user ${userId}. SetupIntent must be created first.`);
      return NextResponse.json(
        { error: 'No Stripe customer found. Please complete card setup first.' },
        { status: 400 }
      );
    }

    // ==========================================================================
    // CHECK FOR EXISTING ACTIVE SUBSCRIPTION
    // Prevent creating duplicate subscriptions
    // ==========================================================================
    if (user.stripe_subscription_id && user.status && user.status !== 'incomplete' && user.status !== 'canceled') {
      console.log(`[Stripe] User ${userId} already has active subscription: ${user.stripe_subscription_id}`);
      
      // Fetch the existing subscription from Stripe
      const existingSub = await stripe.subscriptions.retrieve(user.stripe_subscription_id);
      
      // Access properties safely with validation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existingSubObj = existingSub as any;
      const existingPeriodEnd = (typeof existingSubObj.current_period_end === 'number' && existingSubObj.current_period_end > 0)
        ? new Date(existingSubObj.current_period_end * 1000).toISOString()
        : null;
      
      return NextResponse.json({
        subscription: {
          id: existingSub.id,
          status: existingSub.status,
          currentPeriodEnd: existingPeriodEnd,
        },
        message: 'Subscription already exists',
        alreadyExists: true,
      });
    }

    // ==========================================================================
    // VERIFY PAYMENT METHOD EXISTS IN STRIPE
    // ==========================================================================
    let paymentMethod;
    try {
      paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    } catch (error) {
      console.error(`[Stripe] Invalid payment method: ${paymentMethodId}`, error);
      return NextResponse.json(
        { error: 'Invalid payment method' },
        { status: 400 }
      );
    }

    // ==========================================================================
    // ATTACH PAYMENT METHOD TO CUSTOMER (if not already attached)
    // ==========================================================================
    if (paymentMethod.customer !== stripeCustomerId) {
      console.log(`[Stripe] Attaching PaymentMethod ${paymentMethodId} to customer ${stripeCustomerId}`);
      
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: stripeCustomerId,
      });
    }

    // ==========================================================================
    // SET AS DEFAULT PAYMENT METHOD
    // ==========================================================================
    await stripe.customers.update(stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    console.log(`[Stripe] Set default payment method for customer ${stripeCustomerId}`);

    // ==========================================================================
    // GET PRICE ID FOR SELECTED PLAN
    // ==========================================================================
    const priceId = getPriceId(plan, billingInterval);
    
    if (!priceId) {
      console.error(`[Stripe] Price ID not found for plan: ${plan}, interval: ${billingInterval}`);
      return NextResponse.json(
        { error: 'Price configuration error' },
        { status: 500 }
      );
    }

    // ==========================================================================
    // CREATE SUBSCRIPTION WITH TRIAL
    // ==========================================================================
    console.log(`[Stripe] Creating subscription for customer ${stripeCustomerId} with price ${priceId}`);

    const subscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: priceId }],
      trial_period_days: TRIAL_DAYS,
      default_payment_method: paymentMethodId,
      payment_behavior: 'default_incomplete', // Wait for payment confirmation if needed
      payment_settings: {
        payment_method_types: ['card'],
        save_default_payment_method: 'on_subscription',
      },
      metadata: {
        neon_user_id: userId.toString(),
        plan: plan,
        billing_interval: billingInterval,
      },
      // Expand latest invoice for immediate access
      expand: ['latest_invoice.payment_intent'],
    });

    console.log(`[Stripe] Created subscription: ${subscription.id} with status: ${subscription.status}`);

    // ==========================================================================
    // EXTRACT CARD DETAILS FROM PAYMENT METHOD (for display only)
    // ==========================================================================
    const card = paymentMethod.card;
    const cardLast4 = card?.last4 || null;
    const cardBrand = card?.brand || null;
    const cardExpMonth = card?.exp_month || null;
    const cardExpYear = card?.exp_year || null;

    // ==========================================================================
    // CALCULATE DATES
    // Access subscription properties directly - Stripe returns timestamps in seconds
    // Add defensive checks to prevent "Invalid time value" errors
    // ==========================================================================
    
    // Safely extract timestamps from subscription object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subObj = subscription as any;
    
    const trialEndTimestamp = subObj.trial_end;
    const periodStartTimestamp = subObj.current_period_start;
    const periodEndTimestamp = subObj.current_period_end;
    
    // Log for debugging
    console.log(`[Stripe] Subscription timestamps - trial_end: ${trialEndTimestamp}, period_start: ${periodStartTimestamp}, period_end: ${periodEndTimestamp}`);
    
    // Convert Unix timestamps (seconds) to ISO strings with validation
    const trialEnd = (typeof trialEndTimestamp === 'number' && trialEndTimestamp > 0)
      ? new Date(trialEndTimestamp * 1000).toISOString()
      : null;
    
    const currentPeriodStart = (typeof periodStartTimestamp === 'number' && periodStartTimestamp > 0)
      ? new Date(periodStartTimestamp * 1000).toISOString()
      : new Date().toISOString(); // Fallback to now
    
    const currentPeriodEnd = (typeof periodEndTimestamp === 'number' && periodEndTimestamp > 0)
      ? new Date(periodEndTimestamp * 1000).toISOString()
      : null; // Allow null if not available

    // ==========================================================================
    // UPDATE DATABASE
    // ==========================================================================
    // Update subscriptions table
    const existingSub = await sql`
      SELECT id FROM subscriptions WHERE user_id = ${userId}
    `;

    if (existingSub.length > 0) {
      await sql`
        UPDATE subscriptions
        SET
          stripe_customer_id = ${stripeCustomerId},
          stripe_subscription_id = ${subscription.id},
          stripe_payment_method_id = ${paymentMethodId},
          plan = ${plan},
          status = ${subscription.status === 'trialing' ? 'trialing' : subscription.status},
          billing_interval = ${billingInterval},
          current_period_start = ${currentPeriodStart},
          current_period_end = ${currentPeriodEnd},
          trial_ends_at = ${trialEnd},
          cancel_at_period_end = false,
          card_last4 = ${cardLast4},
          card_brand = ${cardBrand},
          card_exp_month = ${cardExpMonth},
          card_exp_year = ${cardExpYear},
          updated_at = NOW()
        WHERE user_id = ${userId}
      `;
    } else {
      await sql`
        INSERT INTO subscriptions (
          user_id,
          stripe_customer_id,
          stripe_subscription_id,
          stripe_payment_method_id,
          plan,
          status,
          billing_interval,
          current_period_start,
          current_period_end,
          trial_ends_at,
          cancel_at_period_end,
          card_last4,
          card_brand,
          card_exp_month,
          card_exp_year
        ) VALUES (
          ${userId},
          ${stripeCustomerId},
          ${subscription.id},
          ${paymentMethodId},
          ${plan},
          ${subscription.status === 'trialing' ? 'trialing' : subscription.status},
          ${billingInterval},
          ${currentPeriodStart},
          ${currentPeriodEnd},
          ${trialEnd},
          false,
          ${cardLast4},
          ${cardBrand},
          ${cardExpMonth},
          ${cardExpYear}
        )
      `;
    }

    // Update users table
    await sql`
      UPDATE users
      SET
        plan = ${plan},
        has_subscription = true,
        trial_start_date = NOW(),
        trial_end_date = ${trialEnd},
        billing_last4 = ${cardLast4},
        billing_brand = ${cardBrand},
        billing_expiry = ${cardExpMonth && cardExpYear ? `${String(cardExpMonth).padStart(2, '0')}/${String(cardExpYear).slice(-2)}` : null},
        updated_at = NOW()
      WHERE id = ${userId}
    `;

    console.log(`[Stripe] Updated database for user ${userId} with subscription ${subscription.id}`);
    
    // ==========================================================================
    // DEBUG: Log the subscription state after creation
    // ==========================================================================
    const verifySubscription = await sql`
      SELECT id, user_id, status, plan, first_payment_at, next_auto_scan_at, trial_ends_at
      FROM subscriptions WHERE user_id = ${userId}
    `;
    console.log(`[Stripe] ========== SUBSCRIPTION CREATED DEBUG ==========`);
    console.log(`[Stripe] User ID: ${userId}`);
    console.log(`[Stripe] Stripe subscription status: ${subscription.status}`);
    console.log(`[Stripe] DB subscription state:`, verifySubscription.length > 0 ? {
      status: verifySubscription[0].status,
      plan: verifySubscription[0].plan,
      first_payment_at: verifySubscription[0].first_payment_at,
      next_auto_scan_at: verifySubscription[0].next_auto_scan_at,
      trial_ends_at: verifySubscription[0].trial_ends_at,
    } : 'NOT FOUND');
    console.log(`[Stripe] NOTE: first_payment_at is NULL because this is a TRIAL subscription`);
    console.log(`[Stripe] NOTE: first_payment_at will be set when invoice.paid webhook fires (after trial or immediate payment)`);
    console.log(`[Stripe] ===================================================`);

    // ==========================================================================
    // RETURN SUCCESS RESPONSE
    // ==========================================================================
    return NextResponse.json({
      success: true,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        plan: plan,
        billingInterval: billingInterval,
        trialEnd: trialEnd,
        currentPeriodStart: currentPeriodStart,
        currentPeriodEnd: currentPeriodEnd,
        cardLast4: cardLast4,
        cardBrand: cardBrand,
      },
      customerId: stripeCustomerId,
    });

  } catch (error) {
    console.error('[Stripe] Error creating subscription:', error);
    
    // Handle specific Stripe errors
    if (error instanceof Error && 'type' in error) {
      const stripeError = error as { type: string; message: string; code?: string };
      
      // Handle card declined errors
      if (stripeError.code === 'card_declined') {
        return NextResponse.json(
          { error: 'Your card was declined. Please try a different card.' },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: stripeError.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create subscription' },
      { status: 500 }
    );
  }
}
