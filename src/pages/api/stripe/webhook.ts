/**
 * =============================================================================
 * STRIPE WEBHOOK HANDLER - Pages Router Version
 * =============================================================================
 * 
 * WHY PAGES ROUTER INSTEAD OF APP ROUTER?
 * ----------------------------------------
 * This webhook uses the legacy Pages Router (/pages/api/) instead of the newer
 * App Router (/app/api/) for a critical technical reason:
 * 
 * PROBLEM: Stripe webhook signature verification FAILS on App Router (Next.js 15/16)
 * when deployed to Vercel. The signature verification requires the EXACT raw bytes
 * that Stripe sent. However, somewhere in the App Router + Vercel serverless pipeline,
 * the request body gets modified (encoding changes, line ending normalization, etc.),
 * causing the computed signature to never match Stripe's signature.
 * 
 * Error seen: "No signatures found matching the expected signature for payload"
 * 
 * SOLUTION: Pages Router has explicit body parsing control via:
 *   export const config = { api: { bodyParser: false } }
 * 
 * Combined with the `micro` package's `buffer()` function, we can access the
 * true raw bytes before any processing occurs.
 * 
 * This is the officially documented approach by Stripe and Vercel for webhooks.
 * 
 * REFERENCES:
 * - https://stripe.com/docs/webhooks/signatures
 * - https://vercel.com/guides/getting-started-with-nextjs-typescript-stripe
 * - https://github.com/vercel/next.js/discussions/48885
 * 
 * DO NOT MIGRATE THIS TO APP ROUTER without extensive testing on Vercel production.
 * 
 * Created: December 2025
 * Last Updated: December 2025
 * =============================================================================
 */

import { buffer } from 'micro';
import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { sql } from '@/lib/db';
import { initializeTrialCredits, resetCreditsForNewPeriod, normalizePlan } from '@/lib/credits';

// =============================================================================
// CRITICAL: Disable Next.js body parsing
// This is the key difference from App Router - we MUST have raw bytes
// =============================================================================
export const config = {
  api: {
    bodyParser: false,
  },
};

// =============================================================================
// IDEMPOTENCY: Track processed events to prevent duplicates
// Using in-memory Map for simplicity. In a multi-instance deployment,
// consider using Redis or database-backed tracking.
// Events are automatically cleaned up after 24 hours.
// =============================================================================
const processedEvents = new Map<string, number>();
const EVENT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function isEventProcessed(eventId: string): boolean {
  const timestamp = processedEvents.get(eventId);
  if (timestamp) {
    if (Date.now() - timestamp < EVENT_TTL_MS) {
      return true;
    }
    processedEvents.delete(eventId);
  }
  return false;
}

function markEventProcessed(eventId: string): void {
  processedEvents.set(eventId, Date.now());
  
  if (processedEvents.size > 100) {
    const now = Date.now();
    for (const [id, timestamp] of processedEvents.entries()) {
      if (now - timestamp >= EVENT_TTL_MS) {
        processedEvents.delete(id);
      }
    }
  }
}

// =============================================================================
// MAIN WEBHOOK HANDLER
// =============================================================================
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // =========================================================================
    // GET RAW BODY USING MICRO'S BUFFER FUNCTION
    // This is the key to making signature verification work on Vercel
    // =========================================================================
    const rawBody = await buffer(req);
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      console.error('[Webhook] No Stripe signature found');
      return res.status(400).json({ error: 'No signature' });
    }

    // =========================================================================
    // VERIFY WEBHOOK SIGNATURE
    // =========================================================================
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      console.error('[Webhook] STRIPE_WEBHOOK_SECRET not configured');
      return res.status(500).json({ error: 'Webhook configuration error' });
    }

    let event: Stripe.Event;

    try {
      // Use rawBody directly - it's a Buffer which Stripe SDK accepts
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      const error = err as Error;
      console.error('[Webhook] Signature verification failed:', error.message);
      return res.status(400).json({ 
        error: `Webhook signature verification failed: ${error.message}` 
      });
    }

    console.log(`[Webhook] ✅ Verified event: ${event.type} (${event.id})`);

    // =========================================================================
    // IDEMPOTENCY CHECK
    // =========================================================================
    if (isEventProcessed(event.id)) {
      console.log(`[Webhook] Skipping already processed event: ${event.id}`);
      return res.status(200).json({ received: true, skipped: true });
    }

    markEventProcessed(event.id);

    // =========================================================================
    // HANDLE SPECIFIC EVENTS
    // =========================================================================
    switch (event.type) {
      // SUBSCRIPTION EVENTS
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

      // INVOICE EVENTS
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

      // PAYMENT METHOD EVENTS
      case 'payment_method.attached': {
        const paymentMethod = event.data.object as Stripe.PaymentMethod;
        await handlePaymentMethodAttached(paymentMethod);
        break;
      }

      // CUSTOMER EVENTS
      case 'customer.updated': {
        const customer = event.data.object as Stripe.Customer;
        console.log(`[Webhook] Customer updated: ${customer.id}`);
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('[Webhook] Error processing webhook:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}

// =============================================================================
// EVENT HANDLERS
// =============================================================================

/**
 * Handle subscription created or updated
 */
async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  console.log(`[Webhook] Processing subscription update: ${subscription.id}, status: ${subscription.status}`);

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

  // Extract plan and billing interval
  let plan: string | null = null;
  let billingInterval: string | null = null;

  if (subscription.metadata?.plan) {
    plan = subscription.metadata.plan;
  }
  if (subscription.metadata?.billing_interval) {
    billingInterval = subscription.metadata.billing_interval;
  }

  if (!plan || !billingInterval) {
    const items = subscription.items?.data;
    if (items && items.length > 0) {
      const price = items[0].price;
      const priceId = price?.id;
      
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

  const periodStartIso = subData.current_period_start 
    ? new Date(subData.current_period_start * 1000).toISOString() 
    : new Date().toISOString();
  const periodEndIso = subData.current_period_end 
    ? new Date(subData.current_period_end * 1000).toISOString() 
    : null;
  const trialEndIso = subData.trial_end 
    ? new Date(subData.trial_end * 1000).toISOString() 
    : null;

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

  await sql`
    UPDATE users
    SET
      plan = COALESCE(${plan}, plan),
      has_subscription = ${dbStatus === 'active' || dbStatus === 'trialing'},
      updated_at = NOW()
    WHERE id = ${dbUserId}
  `;

  console.log(`[Webhook] Updated subscription for user ${dbUserId} to status: ${dbStatus}, plan: ${plan}`);

  // Initialize trial credits
  if (dbStatus === 'trialing' && subData.trial_end) {
    const trialStart = subData.current_period_start 
      ? new Date(subData.current_period_start * 1000) 
      : new Date();
    const trialEnd = new Date(subData.trial_end * 1000);
    
    try {
      await initializeTrialCredits(dbUserId, trialStart, trialEnd);
      console.log(`[Webhook] ✅ Initialized trial credits for user ${dbUserId}`);
    } catch (creditError) {
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
  const customerId = subscription.customer as string;
  console.log(`[Webhook] Trial ending soon for customer: ${customerId}`);
}

/**
 * Handle successful invoice payment
 */
async function handleInvoicePaid(invoice: Stripe.Invoice) {
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

  // Reset credits for new billing period
  try {
    const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subObj = stripeSubscription as any;
    
    const periodStart = typeof subObj.current_period_start === 'number'
      ? new Date(subObj.current_period_start * 1000)
      : new Date();
    const periodEnd = typeof subObj.current_period_end === 'number'
      ? new Date(subObj.current_period_end * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    
    const plan = stripeSubscription.metadata?.plan || userPlan || 'pro';
    const normalizedPlan = normalizePlan(plan);
    
    await resetCreditsForNewPeriod(dbUserId, normalizedPlan, periodStart, periodEnd);
    console.log(`[Webhook] ✅ Reset credits for user ${dbUserId} to ${normalizedPlan} plan`);
  } catch (creditError) {
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

  await sql`
    UPDATE subscriptions
    SET
      status = 'past_due',
      updated_at = NOW()
    WHERE user_id = ${dbUserId}
  `;

  console.log(`[Webhook] Payment failed for user ${dbUserId} - status set to past_due`);
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
