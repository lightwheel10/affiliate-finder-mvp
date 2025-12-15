import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { sql } from '@/lib/db';
import Stripe from 'stripe';
import { initializeTrialCredits, resetCreditsForNewPeriod, normalizePlan } from '@/lib/credits';

// =============================================================================
// POST /api/stripe/webhook
// 
// Handles incoming webhook events from Stripe.
// This is how Stripe notifies us of important events like:
// - Payment successful/failed
// - Subscription created/updated/canceled
// - Trial ending/ended
// - Invoice paid/payment_failed
//
// SECURITY:
// - Verifies webhook signature using STRIPE_WEBHOOK_SECRET
// - Only processes events from Stripe (prevents spoofing)
// - Uses raw body for signature verification (Next.js specific)
// - Implements idempotency to prevent duplicate event processing
// 
// IMPORTANT: This endpoint must be added to public routes in middleware.ts
// =============================================================================

// Disable body parsing - we need raw body for signature verification
export const dynamic = 'force-dynamic';

// =============================================================================
// IDEMPOTENCY: Track processed events to prevent duplicates
// Using in-memory Set for simplicity. In a multi-instance deployment,
// consider using Redis or database-backed tracking.
// Events are automatically cleaned up after 24 hours.
// =============================================================================
const processedEvents = new Map<string, number>();
const EVENT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function isEventProcessed(eventId: string): boolean {
  const timestamp = processedEvents.get(eventId);
  if (timestamp) {
    // Check if event is still within TTL
    if (Date.now() - timestamp < EVENT_TTL_MS) {
      return true;
    }
    // Event has expired, remove it
    processedEvents.delete(eventId);
  }
  return false;
}

function markEventProcessed(eventId: string): void {
  processedEvents.set(eventId, Date.now());
  
  // Cleanup old events periodically (every 100 events)
  if (processedEvents.size > 100) {
    const now = Date.now();
    for (const [id, timestamp] of processedEvents.entries()) {
      if (now - timestamp >= EVENT_TTL_MS) {
        processedEvents.delete(id);
      }
    }
  }
}

export async function POST(request: Request) {
  try {
    // ==========================================================================
    // GET RAW BODY FOR SIGNATURE VERIFICATION
    // Using request.text() as recommended by Next.js and Stripe docs
    // This returns the raw body as a string without any parsing
    // ==========================================================================
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      console.error('[Webhook] No Stripe signature found');
      return NextResponse.json(
        { error: 'No signature' },
        { status: 400 }
      );
    }

    // ==========================================================================
    // VERIFY WEBHOOK SIGNATURE
    // This ensures the event actually came from Stripe
    // ==========================================================================
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const isProduction = process.env.NODE_ENV === 'production';
    
    // DEBUG: Log secret prefix to verify correct env var is loaded
    const expectedPrefix = 'whsec_kV7kAyLt'; // First 16 chars of production secret
    const actualPrefix = webhookSecret?.substring(0, 16) || 'UNDEFINED';
    const secretMatch = actualPrefix === expectedPrefix;
    console.log(`[Webhook] Debug: Expected prefix: ${expectedPrefix}, Actual: ${actualPrefix}, Match: ${secretMatch}, Body length: ${body.length}`);
    
    if (!webhookSecret) {
      console.error('[Webhook] STRIPE_WEBHOOK_SECRET not configured');
      
      // In production, ALWAYS require webhook secret - fail closed
      if (isProduction) {
        console.error('[Webhook] CRITICAL: Cannot process webhooks without signature verification in production');
        return NextResponse.json(
          { error: 'Webhook configuration error' },
          { status: 500 }
        );
      }
      
      // In development only, allow processing with warning
      console.warn('[Webhook] ⚠️ Development mode: Processing without signature verification');
    }

    let event: Stripe.Event;

    try {
      if (webhookSecret) {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      } else {
        // Development fallback only - production already rejected above
        event = JSON.parse(body) as Stripe.Event;
        console.warn('[Webhook] ⚠️ Processing unverified event (development only)');
      }
    } catch (err) {
      const error = err as Error;
      console.error('[Webhook] Signature verification failed:', error.message);
      return NextResponse.json(
        { error: `Webhook signature verification failed: ${error.message}` },
        { status: 400 }
      );
    }

    console.log(`[Webhook] Received event: ${event.type} (${event.id})`);

    // ==========================================================================
    // IDEMPOTENCY CHECK
    // Skip if we've already processed this event (handles Stripe retries)
    // ==========================================================================
    if (isEventProcessed(event.id)) {
      console.log(`[Webhook] Skipping already processed event: ${event.id}`);
      return NextResponse.json({ received: true, skipped: true });
    }

    // Mark event as being processed
    markEventProcessed(event.id);

    // ==========================================================================
    // HANDLE SPECIFIC EVENTS
    // ==========================================================================
    switch (event.type) {
      // ========================================================================
      // SUBSCRIPTION EVENTS
      // ========================================================================
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCanceled(subscription);
        break;
      }

      case 'customer.subscription.trial_will_end': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleTrialWillEnd(subscription);
        break;
      }

      // ========================================================================
      // INVOICE EVENTS
      // ========================================================================
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(invoice);
        break;
      }

      // ========================================================================
      // PAYMENT METHOD EVENTS
      // ========================================================================
      case 'payment_method.attached': {
        const paymentMethod = event.data.object as Stripe.PaymentMethod;
        await handlePaymentMethodAttached(paymentMethod);
        break;
      }

      // ========================================================================
      // CUSTOMER EVENTS
      // ========================================================================
      case 'customer.updated': {
        const customer = event.data.object as Stripe.Customer;
        console.log(`[Webhook] Customer updated: ${customer.id}`);
        break;
      }

      // ========================================================================
      // DEFAULT - Log unhandled events
      // ========================================================================
      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }

    // Return 200 to acknowledge receipt
    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('[Webhook] Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// =============================================================================
// EVENT HANDLERS
// =============================================================================

/**
 * Handle subscription created or updated
 * 
 * Updated December 2025 to handle plan changes (upgrades/downgrades)
 * This webhook now extracts plan and billing_interval from metadata
 * or from the subscription items to keep our database in sync.
 */
async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  console.log(`[Webhook] Processing subscription update: ${subscription.id}, status: ${subscription.status}`);

  const customerId = subscription.customer as string;

  // Get user from database by Stripe customer ID
  const users = await sql`
    SELECT u.id FROM users u
    JOIN subscriptions s ON u.id = s.user_id
    WHERE s.stripe_customer_id = ${customerId}
  `;

  if (users.length === 0) {
    console.error(`[Webhook] No user found for customer: ${customerId}`);
    return;
  }

  const dbUserId = users[0].id;

  // Access subscription properties safely with validation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subObj = subscription as any;
  
  const subData = {
    id: subscription.id,
    status: subscription.status,
    current_period_start: typeof subObj.current_period_start === 'number' ? subObj.current_period_start : null,
    current_period_end: typeof subObj.current_period_end === 'number' ? subObj.current_period_end : null,
    trial_end: typeof subObj.trial_end === 'number' ? subObj.trial_end : null,
    cancel_at_period_end: !!subObj.cancel_at_period_end,
  };

  // =========================================================================
  // EXTRACT PLAN AND BILLING INTERVAL
  // Updated December 2025 to support plan changes
  // 
  // We get this from metadata (set by our API) or infer from the price
  // =========================================================================
  let plan: string | null = null;
  let billingInterval: string | null = null;

  // Try to get plan from metadata (most reliable - set by our API)
  if (subscription.metadata?.plan) {
    plan = subscription.metadata.plan;
  }
  if (subscription.metadata?.billing_interval) {
    billingInterval = subscription.metadata.billing_interval;
  }

  // If not in metadata, try to infer from the subscription items
  // This handles cases where subscription was created outside our API
  if (!plan || !billingInterval) {
    const items = subscription.items?.data;
    if (items && items.length > 0) {
      const price = items[0].price;
      const priceId = price?.id;
      
      // Map price IDs to our plans
      // Note: These must match the STRIPE_PRICE_* env vars
      const priceProMonthly = process.env.STRIPE_PRICE_PRO_MONTHLY;
      const priceProAnnual = process.env.STRIPE_PRICE_PRO_ANNUAL;
      const priceBusinessMonthly = process.env.STRIPE_PRICE_BUSINESS_MONTHLY;
      const priceBusinessAnnual = process.env.STRIPE_PRICE_BUSINESS_ANNUAL;

      if (priceId === priceProMonthly) {
        plan = 'pro';
        billingInterval = 'monthly';
      } else if (priceId === priceProAnnual) {
        plan = 'pro';
        billingInterval = 'annual';
      } else if (priceId === priceBusinessMonthly) {
        plan = 'business';
        billingInterval = 'monthly';
      } else if (priceId === priceBusinessAnnual) {
        plan = 'business';
        billingInterval = 'annual';
      }

      // Fallback: infer interval from price recurring data
      if (!billingInterval && price?.recurring?.interval) {
        billingInterval = price.recurring.interval === 'year' ? 'annual' : 'monthly';
      }
    }
  }

  console.log(`[Webhook] Extracted plan: ${plan}, interval: ${billingInterval}`);

  // Map Stripe status to our status
  let dbStatus: string;
  switch (subData.status) {
    case 'trialing':
      dbStatus = 'trialing';
      break;
    case 'active':
      dbStatus = 'active';
      break;
    case 'canceled':
      dbStatus = 'canceled';
      break;
    case 'past_due':
      dbStatus = 'past_due';
      break;
    case 'incomplete':
    case 'incomplete_expired':
      dbStatus = 'incomplete';
      break;
    default:
      dbStatus = subData.status;
  }

  // Calculate dates safely
  const periodStartIso = subData.current_period_start 
    ? new Date(subData.current_period_start * 1000).toISOString() 
    : new Date().toISOString();
  const periodEndIso = subData.current_period_end 
    ? new Date(subData.current_period_end * 1000).toISOString() 
    : null;
  const trialEndIso = subData.trial_end 
    ? new Date(subData.trial_end * 1000).toISOString() 
    : null;

  // =========================================================================
  // UPDATE SUBSCRIPTIONS TABLE
  // Now includes plan and billing_interval for plan change support
  // =========================================================================
  await sql`
    UPDATE subscriptions
    SET
      stripe_subscription_id = ${subData.id},
      status = ${dbStatus},
      plan = COALESCE(${plan}, plan),
      billing_interval = COALESCE(${billingInterval}, billing_interval),
      current_period_start = ${periodStartIso},
      current_period_end = ${periodEndIso},
      trial_ends_at = ${trialEndIso},
      cancel_at_period_end = ${subData.cancel_at_period_end},
      updated_at = NOW()
    WHERE user_id = ${dbUserId}
  `;

  // =========================================================================
  // UPDATE USERS TABLE
  // Keep user's plan field in sync for quick access
  // =========================================================================
  await sql`
    UPDATE users
    SET
      plan = COALESCE(${plan}, plan),
      has_subscription = ${dbStatus === 'active' || dbStatus === 'trialing'},
      updated_at = NOW()
    WHERE id = ${dbUserId}
  `;

  console.log(`[Webhook] Updated subscription for user ${dbUserId} to status: ${dbStatus}, plan: ${plan}, interval: ${billingInterval}`);

  // =========================================================================
  // INITIALIZE TRIAL CREDITS (December 2025)
  // When a new trial subscription is created, initialize credits
  // =========================================================================
  if (dbStatus === 'trialing' && subData.trial_end) {
    const trialStart = subData.current_period_start 
      ? new Date(subData.current_period_start * 1000) 
      : new Date();
    const trialEnd = new Date(subData.trial_end * 1000);
    
    try {
      await initializeTrialCredits(dbUserId, trialStart, trialEnd);
      console.log(`[Webhook] Initialized trial credits for user ${dbUserId}`);
    } catch (creditError) {
      // Log error but don't fail the webhook - subscription is still valid
      console.error(`[Webhook] Failed to initialize trial credits for user ${dbUserId}:`, creditError);
    }
  }
}

/**
 * Handle subscription canceled
 */
async function handleSubscriptionCanceled(subscription: Stripe.Subscription) {
  console.log(`[Webhook] Processing subscription cancellation: ${subscription.id}`);

  const customerId = subscription.customer as string;

  const users = await sql`
    SELECT u.id FROM users u
    JOIN subscriptions s ON u.id = s.user_id
    WHERE s.stripe_customer_id = ${customerId}
  `;

  if (users.length === 0) {
    console.error(`[Webhook] No user found for customer: ${customerId}`);
    return;
  }

  const dbUserId = users[0].id;

  await sql`
    UPDATE subscriptions
    SET
      status = 'canceled',
      cancel_at_period_end = true,
      updated_at = NOW()
    WHERE user_id = ${dbUserId}
  `;

  await sql`
    UPDATE users
    SET
      has_subscription = false,
      plan = 'free_trial',
      updated_at = NOW()
    WHERE id = ${dbUserId}
  `;

  console.log(`[Webhook] Subscription canceled for user ${dbUserId}`);
}

/**
 * Handle trial ending soon (3 days before)
 */
async function handleTrialWillEnd(subscription: Stripe.Subscription) {
  console.log(`[Webhook] Trial will end soon for subscription: ${subscription.id}`);
  
  // Here you could:
  // - Send an email reminder to the user
  // - Update a flag in the database
  // - Trigger a notification
  
  const customerId = subscription.customer as string;
  console.log(`[Webhook] Trial ending soon for customer: ${customerId}`);
  
  // For now, just log - email notifications are handled by Stripe if enabled
}

/**
 * Handle successful invoice payment
 * 
 * Updated December 2025 to reset credits for new billing period
 */
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  // Cast invoice to access properties (Stripe SDK type handling)
  const invoiceData = invoice as unknown as {
    id: string;
    amount_paid: number;
    customer: string;
    subscription: string | null;
  };
  
  console.log(`[Webhook] Invoice paid: ${invoiceData.id}, amount: ${invoiceData.amount_paid}`);

  const customerId = invoiceData.customer;
  const subscriptionId = invoiceData.subscription;

  if (!subscriptionId) {
    console.log(`[Webhook] Invoice ${invoiceData.id} has no subscription (one-time payment)`);
    return;
  }

  const users = await sql`
    SELECT u.id, u.plan FROM users u
    JOIN subscriptions s ON u.id = s.user_id
    WHERE s.stripe_customer_id = ${customerId}
  `;

  if (users.length === 0) {
    console.error(`[Webhook] No user found for customer: ${customerId}`);
    return;
  }

  const dbUserId = users[0].id;
  const userPlan = users[0].plan;

  // Update subscription to active (in case it was trialing)
  await sql`
    UPDATE subscriptions
    SET
      status = 'active',
      updated_at = NOW()
    WHERE user_id = ${dbUserId}
  `;

  await sql`
    UPDATE users
    SET
      has_subscription = true,
      updated_at = NOW()
    WHERE id = ${dbUserId}
  `;

  console.log(`[Webhook] Payment successful for user ${dbUserId}`);

  // =========================================================================
  // RESET CREDITS FOR NEW BILLING PERIOD (December 2025)
  // When invoice is paid, reset credits based on user's plan
  // This handles both trial-to-paid conversion and monthly renewals
  // =========================================================================
  try {
    // Get subscription details from Stripe for period dates
    const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subObj = stripeSubscription as any;
    
    const periodStart = typeof subObj.current_period_start === 'number'
      ? new Date(subObj.current_period_start * 1000)
      : new Date();
    const periodEnd = typeof subObj.current_period_end === 'number'
      ? new Date(subObj.current_period_end * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default 30 days
    
    // Get plan from subscription metadata or user's current plan
    const plan = stripeSubscription.metadata?.plan || userPlan || 'pro';
    const normalizedPlan = normalizePlan(plan);
    
    await resetCreditsForNewPeriod(dbUserId, normalizedPlan, periodStart, periodEnd);
    console.log(`[Webhook] Reset credits for user ${dbUserId} to ${normalizedPlan} plan`);
  } catch (creditError) {
    // Log error but don't fail the webhook - payment is still successful
    console.error(`[Webhook] Failed to reset credits for user ${dbUserId}:`, creditError);
  }
}

/**
 * Handle failed invoice payment
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  console.log(`[Webhook] Invoice payment failed: ${invoice.id}`);

  const customerId = invoice.customer as string;

  const users = await sql`
    SELECT u.id FROM users u
    JOIN subscriptions s ON u.id = s.user_id
    WHERE s.stripe_customer_id = ${customerId}
  `;

  if (users.length === 0) {
    console.error(`[Webhook] No user found for customer: ${customerId}`);
    return;
  }

  const dbUserId = users[0].id;

  // Update subscription status to past_due
  await sql`
    UPDATE subscriptions
    SET
      status = 'past_due',
      updated_at = NOW()
    WHERE user_id = ${dbUserId}
  `;

  console.log(`[Webhook] Payment failed for user ${dbUserId} - status set to past_due`);
  
  // Here you could:
  // - Send a custom email to the user
  // - Show a banner in the app prompting card update
  // - Stripe will automatically retry and send dunning emails if configured
}

/**
 * Handle payment method attached to customer
 */
async function handlePaymentMethodAttached(paymentMethod: Stripe.PaymentMethod) {
  console.log(`[Webhook] Payment method attached: ${paymentMethod.id}`);

  const customerId = paymentMethod.customer as string;
  
  if (!customerId) {
    console.log(`[Webhook] Payment method ${paymentMethod.id} has no customer`);
    return;
  }

  const card = paymentMethod.card;
  if (!card) {
    console.log(`[Webhook] Payment method ${paymentMethod.id} is not a card`);
    return;
  }

  const users = await sql`
    SELECT u.id FROM users u
    JOIN subscriptions s ON u.id = s.user_id
    WHERE s.stripe_customer_id = ${customerId}
  `;

  if (users.length === 0) {
    console.log(`[Webhook] No user found for customer: ${customerId} (might be new customer)`);
    return;
  }

  const dbUserId = users[0].id;

  // Update card details in database
  await sql`
    UPDATE subscriptions
    SET
      stripe_payment_method_id = ${paymentMethod.id},
      card_last4 = ${card.last4},
      card_brand = ${card.brand},
      card_exp_month = ${card.exp_month},
      card_exp_year = ${card.exp_year},
      updated_at = NOW()
    WHERE user_id = ${dbUserId}
  `;

  await sql`
    UPDATE users
    SET
      billing_last4 = ${card.last4},
      billing_brand = ${card.brand},
      billing_expiry = ${`${String(card.exp_month).padStart(2, '0')}/${String(card.exp_year).slice(-2)}`},
      updated_at = NOW()
    WHERE id = ${dbUserId}
  `;

  console.log(`[Webhook] Updated card details for user ${dbUserId}`);
}
