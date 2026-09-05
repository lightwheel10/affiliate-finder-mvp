import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { stripe, getPriceId, isValidPlan, isValidInterval, TRIAL_DAYS } from '@/lib/stripe';
import { sql } from '@/lib/db';
import {
  AccountAccessError,
  assertLegacyAccountId,
  requireAuthenticatedAccount,
} from '@/lib/auth/account';
import {
  requireServerOwnedStripeCustomerId,
  StripeCustomerOwnershipError,
} from '@/lib/stripe-customer-ownership';
import {
  initialSubscriptionIdempotencyKey,
  initialSubscriptionAccessState,
  latestTerminalSubscriptionId,
  paymentMethodMutationIdempotencyKey,
  recoveredInitialPaymentMethodDecision,
  selectSingleReusableInitialSubscription,
} from '@/lib/stripe/subscription-creation';
import {
  extractInvoiceConfirmationClientSecret,
  extractInvoiceSubscriptionId,
  extractInvoiceSubscriptionServicePeriod,
  extractStripeId,
  snapshotStripeSubscription,
} from '@/lib/stripe/subscription-state';
import { reconcileInitialSubscription } from '@/lib/stripe/initial-subscription-postgres';
import Stripe from 'stripe';
import {
  readStripeMutationJson,
  StripeMutationRequestError,
} from '@/lib/stripe/mutation-request';
import {
  readInitialTrialDays,
  type InitialTrialSql,
} from '@/lib/stripe/initial-trial-postgres';

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
// - Stripe-idempotent across concurrent requests and server retries
// =============================================================================

const createSubscriptionSchema = z.object({
  userId: z.number().int().positive(),
  plan: z.enum(['pro', 'business']),
  billingInterval: z.enum(['monthly', 'annual']),
  paymentMethodId: z.string().regex(/^pm_[A-Za-z0-9_]+$/).max(255),
  promotionCodeId: z.string().regex(/^promo_[A-Za-z0-9_]+$/).max(255).optional(),
  // The server remains authoritative. This only prevents stale browser terms
  // from becoming an unexpected charge.
  expectedTrialDays: z.number().int().min(0).max(730).optional(),
  // Rolling-client compatibility only. This value is never billing authority.
  customerId: z.unknown().optional(),
}).strict();

export async function POST(request: NextRequest) {
  try {
    // ==========================================================================
    // AUTHENTICATION CHECK
    // Verify the user is authenticated via Stack Auth
    // ==========================================================================
    const authenticated = await requireAuthenticatedAccount();

    const parsedBody = createSubscriptionSchema.safeParse(await readStripeMutationJson(request));
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Invalid request input.', code: 'INVALID_INPUT' },
        { status: 400 },
      );
    }
    const {
      userId: legacyUserId,
      plan,
      billingInterval,
      paymentMethodId,
      promotionCodeId,
      expectedTrialDays,
      customerId: providedCustomerId,
    } = parsedBody.data;

    // ==========================================================================
    // INPUT VALIDATION
    // ==========================================================================
    if (!legacyUserId || typeof legacyUserId !== 'number') {
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
    assertLegacyAccountId(legacyUserId, authenticated.account.id);
    const userId = authenticated.account.id;

    if (promotionCodeId && (typeof promotionCodeId !== 'string' || !promotionCodeId.startsWith('promo_'))) {
      return NextResponse.json(
        { error: 'Invalid promotion code' },
        { status: 400 }
      );
    }

    // ==========================================================================
    // VERIFY USER AND GET STRIPE CUSTOMER
    // ==========================================================================
    const users = await sql`
      SELECT u.id, u.email, u.name, s.stripe_customer_id, s.stripe_subscription_id, s.status
      FROM crewcast.users u
      LEFT JOIN crewcast.subscriptions s ON u.id = s.user_id
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

    const stripeCustomerId = requireServerOwnedStripeCustomerId(
      user.stripe_customer_id,
      providedCustomerId,
    );

    // A trial belongs to the application account, not to a Stripe Customer or
    // subscription. The same durable rule powers the pre-card checkout copy.
    const initialTrialDays = await readInitialTrialDays(
      sql as unknown as InitialTrialSql,
      userId,
      TRIAL_DAYS,
    );
    const authoritativeTrialDays = initialTrialDays ?? 0;
    if (
      expectedTrialDays !== undefined
      && expectedTrialDays !== authoritativeTrialDays
    ) {
      return NextResponse.json(
        {
          error: 'Your billing terms changed before checkout. Please review them and try again.',
          code: 'CHECKOUT_TERMS_CHANGED',
        },
        { status: 409 },
      );
    }

    // Stripe is also checked directly. This repairs the important case where
    // Stripe created the subscription but this server died before PostgreSQL
    // recorded it or before the webhook finished retrying.
    const customerSubscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'all',
      limit: 100,
    });
    const recoveredSubscription = selectSingleReusableInitialSubscription(
      customerSubscriptions.data,
      customerSubscriptions.has_more,
    );
    if (recoveredSubscription) {
      const recoveredSnapshot = snapshotStripeSubscription(recoveredSubscription, {
        proMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
        proAnnual: process.env.STRIPE_PRICE_PRO_ANNUAL,
        businessMonthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY,
        businessAnnual: process.env.STRIPE_PRICE_BUSINESS_ANNUAL,
      });
      if (recoveredSnapshot.plan !== plan || recoveredSnapshot.billingInterval !== billingInterval) {
        return NextResponse.json(
          {
            error: 'A different subscription already exists for this account. Refresh billing before trying again.',
            code: 'STRIPE_SUBSCRIPTION_CONFLICT',
          },
          { status: 409 },
        );
      }
      const recoveredPaymentMethodId = extractStripeId(recoveredSubscription.default_payment_method);
      let existingDefaultPaymentMethodId = recoveredPaymentMethodId;
      if (!existingDefaultPaymentMethodId) {
        const recoveredCustomer = await stripe.customers.retrieve(stripeCustomerId);
        if (recoveredCustomer.deleted) {
          throw new Error(`Stripe customer ${stripeCustomerId} is deleted.`);
        }
        existingDefaultPaymentMethodId = extractStripeId(
          recoveredCustomer.invoice_settings.default_payment_method,
        );
      }
      const recoveredPaymentDecision = recoveredInitialPaymentMethodDecision({
        subscriptionStatus: recoveredSubscription.status,
        existingPaymentMethodId: existingDefaultPaymentMethodId,
        requestedPaymentMethodId: paymentMethodId,
      });
      if (recoveredPaymentDecision === 'conflict') {
        return NextResponse.json(
          {
            error: 'The existing subscription uses a different payment method. Refresh billing before trying again.',
            code: 'STRIPE_PAYMENT_METHOD_CONFLICT',
          },
          { status: 409 },
        );
      }
      if (recoveredPaymentDecision === 'replace_incomplete') {
        console.log(
          `[Stripe] Reusing incomplete subscription ${recoveredSubscription.id} with a replacement payment method`,
        );
      }
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
    const paymentMethodCustomerId = extractStripeId(paymentMethod.customer);
    if (paymentMethodCustomerId && paymentMethodCustomerId !== stripeCustomerId) {
      return NextResponse.json(
        {
          error: 'This payment method belongs to a different Stripe customer.',
          code: 'STRIPE_PAYMENT_METHOD_OWNERSHIP_MISMATCH',
        },
        { status: 409 },
      );
    }
    if (!paymentMethodCustomerId) {
      console.log(`[Stripe] Attaching PaymentMethod ${paymentMethodId} to customer ${stripeCustomerId}`);
      
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: stripeCustomerId,
      }, {
        idempotencyKey: paymentMethodMutationIdempotencyKey(
          'attach',
          stripeCustomerId,
          paymentMethodId,
        ),
      });
    }

    // ==========================================================================
    // SET AS DEFAULT PAYMENT METHOD
    // ==========================================================================
    await stripe.customers.update(
      stripeCustomerId,
      {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      },
      {
        idempotencyKey: paymentMethodMutationIdempotencyKey(
          'make-default',
          stripeCustomerId,
          paymentMethodId,
        ),
      },
    );

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

    if (promotionCodeId) {
      const promoCode = await stripe.promotionCodes.retrieve(promotionCodeId);
      if (!promoCode.active) {
        return NextResponse.json(
          { error: 'This discount code is no longer active' },
          { status: 400 }
        );
      }
      const promotionCustomerId = extractStripeId(promoCode.customer);
      if (promotionCustomerId && promotionCustomerId !== stripeCustomerId) {
        return NextResponse.json(
          { error: 'This discount code is not available for this account.' },
          { status: 400 },
        );
      }
    }

    const subscriptionParams: Stripe.SubscriptionCreateParams = {
      customer: stripeCustomerId,
      items: [{ price: priceId }],
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
        ...(promotionCodeId ? { promotion_code_id: promotionCodeId } : {}),
      },
      // Stripe documents this as the first-payment confirmation source.
      expand: ['latest_invoice.confirmation_secret'],
    };

    if (initialTrialDays !== undefined) {
      subscriptionParams.trial_period_days = initialTrialDays;
    }

    if (promotionCodeId) {
      subscriptionParams.discounts = [{ promotion_code: promotionCodeId }];
    }

    const subscriptionCandidate = recoveredSubscription ?? await stripe.subscriptions.create(
      subscriptionParams,
      {
        idempotencyKey: initialSubscriptionIdempotencyKey(
          userId,
          stripeCustomerId,
          latestTerminalSubscriptionId(customerSubscriptions.data),
        ),
      },
    );

    // Always re-read after create/recovery. A browser may have confirmed the
    // first invoice between requests, and the list response is not guaranteed
    // to contain the expanded confirmation secret used for 3DS.
    const subscription = await stripe.subscriptions.retrieve(
      subscriptionCandidate.id,
      { expand: ['latest_invoice.confirmation_secret'] },
    );

    console.log(`[Stripe] Created subscription: ${subscription.id} with status: ${subscription.status}`);

    // ==========================================================================
    // EXTRACT CARD DETAILS FROM PAYMENT METHOD (for display only)
    // ==========================================================================
    const card = paymentMethod.card;
    const cardLast4 = card?.last4 || null;
    const cardBrand = card?.brand || null;
    const cardExpMonth = card?.exp_month || null;
    const cardExpYear = card?.exp_year || null;

    const subscriptionSnapshot = snapshotStripeSubscription(subscription, {
      proMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
      proAnnual: process.env.STRIPE_PRICE_PRO_ANNUAL,
      businessMonthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY,
      businessAnnual: process.env.STRIPE_PRICE_BUSINESS_ANNUAL,
    });
    if (
      subscriptionSnapshot.plan !== plan
      || subscriptionSnapshot.billingInterval !== billingInterval
    ) {
      throw new Error(`Stripe subscription ${subscription.id} has an unexpected price.`);
    }
    if (subscriptionSnapshot.customerId !== stripeCustomerId) {
      throw new Error(`Stripe subscription ${subscription.id} belongs to a different customer.`);
    }
    if (subscription.collection_method !== 'charge_automatically') {
      throw new Error(`Stripe subscription ${subscription.id} does not use automatic card billing.`);
    }
    if (
      subscriptionSnapshot.currentPeriodStartSeconds === null
      || subscriptionSnapshot.currentPeriodEndSeconds === null
    ) {
      throw new Error(`Stripe subscription ${subscription.id} has no valid billing period.`);
    }
    const trialEnd = subscriptionSnapshot.trialEndSeconds
      ? new Date(subscriptionSnapshot.trialEndSeconds * 1000).toISOString()
      : null;
    const currentPeriodStart = new Date(
      subscriptionSnapshot.currentPeriodStartSeconds * 1000,
    ).toISOString();
    const currentPeriodEnd = new Date(
      subscriptionSnapshot.currentPeriodEndSeconds * 1000,
    ).toISOString();
    const latestInvoice = subscription.latest_invoice;
    const confirmationSecret = extractInvoiceConfirmationClientSecret(latestInvoice);
    const accessState = initialSubscriptionAccessState(
      subscription.status,
      confirmationSecret !== null,
    );

    let paidInvoiceContext: {
      invoiceId: string;
      periodStart: Date;
      paidAt: string;
    } | null = null;
    if (subscription.status === 'active') {
      const latestInvoiceId = extractStripeId(latestInvoice);
      if (!latestInvoiceId) {
        throw new Error(`Active Stripe subscription ${subscription.id} has no invoice.`);
      }
      const paidInvoice = await stripe.invoices.retrieve(latestInvoiceId);
      if (extractStripeId(paidInvoice.customer) !== stripeCustomerId) {
        throw new Error(`Stripe invoice ${latestInvoiceId} belongs to a different customer.`);
      }
      if (extractInvoiceSubscriptionId(paidInvoice) !== subscription.id) {
        throw new Error(`Stripe invoice ${latestInvoiceId} belongs to a different subscription.`);
      }
      if (paidInvoice.status !== 'paid') {
        throw new Error(`Active Stripe subscription ${subscription.id} has an unpaid latest invoice.`);
      }
      const servicePeriod = extractInvoiceSubscriptionServicePeriod(
        paidInvoice,
        subscription.id,
      );
      if (!servicePeriod) {
        throw new Error(`Stripe invoice ${latestInvoiceId} has no subscription service period.`);
      }
      const paidAtSeconds = paidInvoice.status_transitions.paid_at ?? paidInvoice.created;
      if (!Number.isSafeInteger(paidAtSeconds) || paidAtSeconds <= 0) {
        throw new Error(`Stripe invoice ${latestInvoiceId} has no valid paid timestamp.`);
      }
      paidInvoiceContext = {
        invoiceId: latestInvoiceId,
        periodStart: new Date(servicePeriod.startSeconds * 1000),
        paidAt: new Date(paidAtSeconds * 1000).toISOString(),
      };
    }

    const reconciliation = await reconcileInitialSubscription(sql, {
      userId,
      stripeCustomerId,
      stripeSubscriptionId: subscription.id,
      stripePaymentMethodId: paymentMethodId,
      plan,
      billingInterval,
      status: subscription.status,
      currentPeriodStart,
      currentPeriodEnd,
      trialEnd,
      cancelAtPeriodEnd: subscriptionSnapshot.cancelAtPeriodEnd,
      card: {
        last4: cardLast4,
        brand: cardBrand,
        expMonth: cardExpMonth,
        expYear: cardExpYear,
      },
      paidInvoice: paidInvoiceContext,
    });
    if (reconciliation.creditReset) {
      console.log(
        `[Stripe] Invoice ${paidInvoiceContext?.invoiceId} credit reconciliation: `
        + reconciliation.creditReset,
      );
    }

    console.log(`[Stripe] Reconciled subscription ${subscription.id} for user ${userId} (${subscription.status})`);

    if (accessState === 'payment_action_required') {
      return NextResponse.json(
        {
          error: 'Please confirm the payment to activate your subscription.',
          code: 'PAYMENT_ACTION_REQUIRED',
          clientSecret: confirmationSecret,
          subscriptionId: subscription.id,
        },
        { status: 402 },
      );
    }
    if (accessState === 'payment_pending') {
      return NextResponse.json(
        {
          error: 'Your payment is still being prepared. Please try again shortly.',
          code: 'PAYMENT_PENDING',
        },
        { status: 409 },
      );
    }
    if (accessState === 'blocked') {
      return NextResponse.json(
        {
          error: 'This Stripe subscription is not active. Please update your billing details.',
          code: 'SUBSCRIPTION_NOT_ACTIVE',
        },
        { status: 409 },
      );
    }

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
    });

  } catch (error) {
    if (error instanceof StripeMutationRequestError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    if (error instanceof StripeCustomerOwnershipError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    if (error instanceof AccountAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
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
