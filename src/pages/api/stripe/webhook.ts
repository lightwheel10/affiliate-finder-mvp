/**
 * =============================================================================
 * STRIPE WEBHOOK HANDLER - Pages Router Version
 * =============================================================================
 * 
 * TRIAL EXPIRY & SUBSCRIPTION HANDLING (REV-58) - 29th December 2025
 * -------------------------------------------------------------------
 * This webhook handles all subscription lifecycle events including trial expiry.
 * 
 * HOW TRIAL EXPIRY WORKS:
 * 1. Stripe automatically charges the customer when trial ends
 * 2. We receive `invoice.paid` event → status becomes 'active', credits reset
 * 3. If payment fails → we receive `invoice.payment_failed` → status 'past_due'
 * 4. User gets `trial_will_end` notification 3 days before expiry
 * 
 * NO CRON JOB NEEDED: Stripe handles trial-to-paid transitions automatically.
 * 
 * FUTURE: Add email notifications for trial reminders (see separate issue).
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
 * Last Updated: 29th December 2025
 * =============================================================================
 */

import { buffer } from 'micro';
import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { sql } from '@/lib/db';
import { initializeTrialCredits, resetCreditsForNewPeriod, normalizePlan, addTopupCredits } from '@/lib/credits';
import { getCreditPackDetails, CREDIT_PACK_PRICES } from '@/lib/stripe';
// 2026-05-01: n8n transactional email integration removed (unreliable in production). See git history.
// 2026-05-03: imports for Resend transactional email integration (replaces n8n).
// First wired email is payment-success below; trial-ending, subscription-canceled,
// and credits-added are pending — see remaining marker comments in the handlers.
import { waitUntil } from '@vercel/functions';
import { sendEmail } from '@/lib/email';
import { PaymentSuccessEmail, paymentSuccessEmailSubject } from '@/emails/payment-success';
import { SubscriptionCanceledEmail, subscriptionCanceledEmailSubject } from '@/emails/subscription-canceled'; // 2026-05-03

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

    console.log(`[Webhook] Received event: ${event.type} (${event.id})`);

    // =========================================================================
    // IDEMPOTENCY CHECK
    // =========================================================================
    if (isEventProcessed(event.id)) {
      console.log(`[Webhook] Skipping duplicate event: ${event.id}`);
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
        // 2026-05-03: pass previous_attributes so handler can detect the
        // cancel_at_period_end false→true transition (= user clicked cancel).
        const previousAttributes = event.data.previous_attributes as
          | Partial<Stripe.Subscription>
          | undefined;
        await handleSubscriptionUpdate(subscription, previousAttributes);
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

      // ONE-TIME CREDIT PACK PURCHASE (February 2026)
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutSessionCompleted(session);
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }

    // 2026-05-01: pending-N8N-calls flush block removed here (n8n unreliable). See git history.

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
 * Handle one-time credit pack purchase (checkout.session.completed, mode=payment).
 * Validates metadata and price, then adds top-up credits via addTopupCredits (idempotent).
 * 
 * IMPORTANT (February 2026): This function now THROWS on DB failures instead of
 * silently returning. This ensures Stripe gets a 500 response and retries the event.
 * Validation errors (bad metadata, etc.) still return silently since retrying won't help.
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== 'payment' || session.payment_status !== 'paid') {
    return;
  }
  const metadata = session.metadata;
  if (!metadata?.user_id || !metadata?.pack_id || !metadata?.credit_type || !metadata?.credits_amount) {
    console.error('[Webhook] checkout.session.completed: missing metadata for credit purchase');
    return;
  }

  const packId = metadata.pack_id as string;
  const packDetails = getCreditPackDetails(packId);
  if (!packDetails || packDetails.creditType !== metadata.credit_type || packDetails.credits !== parseInt(String(metadata.credits_amount), 10)) {
    console.error('[Webhook] checkout.session.completed: metadata does not match allowed pack', { packId, metadata });
    return;
  }

  const allowedPriceIds = Object.values(CREDIT_PACK_PRICES).map((p) => p.priceId);
  const lineItems = session.line_items?.data ?? (session as { line_items?: { data?: Stripe.LineItem[] } }).line_items?.data;
  if (lineItems && lineItems.length > 0) {
    const priceId = typeof lineItems[0].price === 'string' ? lineItems[0].price : lineItems[0].price?.id;
    if (priceId && !allowedPriceIds.includes(priceId)) {
      console.error('[Webhook] checkout.session.completed: price ID not in allowlist', priceId);
      return;
    }
  }

  const userId = parseInt(String(metadata.user_id), 10);
  if (isNaN(userId)) {
    console.error('[Webhook] checkout.session.completed: invalid user_id', metadata.user_id);
    return;
  }

  const creditType = metadata.credit_type as 'email' | 'ai' | 'topic_search';
  const amount = packDetails.credits;
  const sessionId = session.id;
  if (!sessionId) {
    console.error('[Webhook] checkout.session.completed: no session id');
    return;
  }

  console.log(`[Webhook] Processing credit pack: user=${userId}, type=${creditType}, amount=${amount}, session=${sessionId}`);

  const ok = await addTopupCredits(userId, creditType, amount, sessionId);
  if (!ok) {
    // CRITICAL: Throw so the main handler returns 500 and Stripe retries.
    // addTopupCredits returns false when DB operations fail.
    // Stripe will retry the event up to ~16 times over 72 hours.
    const errorMsg = `[Webhook] checkout.session.completed: addTopupCredits FAILED for user ${userId}, session ${sessionId}. Throwing to trigger Stripe retry.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  
  console.log(`[Webhook] ✅ Credit pack completed: ${amount} ${creditType} for user ${userId}`);

  // 2026-05-01: n8n credit_purchase_success email call removed here (n8n unreliable). See git history.
}

/**
 * Handle subscription created or updated
 * 
 * FIXED (Dec 2025): Properly extract customer ID from both string and object formats
 */
async function handleSubscriptionUpdate(
  subscription: Stripe.Subscription,
  previousAttributes?: Partial<Stripe.Subscription> // 2026-05-03: for cancel-transition detection
) {
  console.log(`[Webhook] Processing subscription update: ${subscription.id}, status: ${subscription.status}`);

  // Safely extract customer ID (can be string or Customer object)
  const customerId = typeof subscription.customer === 'string' 
    ? subscription.customer 
    : (subscription.customer as { id: string })?.id;
  
  if (!customerId) {
    console.error(`[Webhook] Subscription ${subscription.id} has no customer ID`);
    return;
  }

  const users = await sql`
    SELECT u.id FROM crewcast.users u
    JOIN crewcast.subscriptions s ON u.id = s.user_id
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
    UPDATE crewcast.subscriptions
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
    UPDATE crewcast.users
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

  // SUBSCRIPTION-CANCELED EMAIL — added 2026-05-03
  // Fires when cancel_at_period_end flips false→true (= user just clicked cancel),
  // not when subscription.deleted runs (by then access is already gone, so the
  // "you have access until X" copy would be stale).
  // Locale/name/plan trade-offs: same as the payment-success block in handleInvoicePaid.
  const justCanceled =
    previousAttributes?.cancel_at_period_end === false &&
    subData.cancel_at_period_end === true;

  if (justCanceled) {
    // The query above only fetched u.id — fetch email/name/plan now.
    const emailRecipients = await sql`
      SELECT u.email, u.name, u.plan
      FROM crewcast.users u
      WHERE u.id = ${dbUserId}
    `;

    if (emailRecipients.length > 0 && emailRecipients[0].email) {
      const recipient = emailRecipients[0];
      const cancelEmailLocale = 'de' as const;
      const cancelCustomerName = recipient.name ?? 'there';
      const cancelPlanForEmail =
        recipient.plan && recipient.plan !== 'free_trial' ? recipient.plan : 'pro';
      const cancelPlanLabel =
        cancelPlanForEmail.charAt(0).toUpperCase() + cancelPlanForEmail.slice(1);

      const accessUntilIso = subData.current_period_end
        ? new Date(subData.current_period_end * 1000).toISOString()
        : new Date().toISOString();

      waitUntil(
        sendEmail({
          to: recipient.email,
          subject: subscriptionCanceledEmailSubject(cancelEmailLocale),
          react: SubscriptionCanceledEmail({
            name: cancelCustomerName,
            locale: cancelEmailLocale,
            plan: cancelPlanLabel,
            accessUntil: accessUntilIso,
            appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'https://afforce.one',
          }),
        })
      );

      console.log(`[Webhook] ✅ Cancellation email queued for user ${dbUserId} (access until ${accessUntilIso})`);
    } else {
      console.error(`[Webhook] Cannot send cancellation email — no email found for user ${dbUserId}`);
    }
  }
}

/**
 * Handle subscription canceled
 * 
 * FIXED (Dec 2025): Properly extract customer ID from both string and object formats
 * February 2026: Added N8N webhook for subscription_canceled email notification.
 */
async function handleSubscriptionCanceled(subscription: Stripe.Subscription) {
  console.log(`[Webhook] Processing subscription cancellation: ${subscription.id}`);

  const customerId = typeof subscription.customer === 'string' 
    ? subscription.customer 
    : (subscription.customer as { id: string })?.id;
  
  if (!customerId) {
    console.error(`[Webhook] Subscription ${subscription.id} has no customer ID`);
    return;
  }

  // Extended query to include email/name for notification
  const users = await sql`
    SELECT u.id, u.email, u.name, u.plan
    FROM crewcast.users u
    JOIN crewcast.subscriptions s ON u.id = s.user_id
    WHERE s.stripe_customer_id = ${customerId}
  `;

  if (users.length === 0) {
    console.error(`[Webhook] No user found for customer: ${customerId}`);
    return;
  }

  const user = users[0];
  const dbUserId = user.id;

  await sql`
    UPDATE crewcast.subscriptions
    SET
      status = 'canceled',
      cancel_at_period_end = true,
      updated_at = NOW()
    WHERE user_id = ${dbUserId}
  `;

  await sql`
    UPDATE crewcast.users
    SET
      has_subscription = false,
      plan = 'free_trial',
      updated_at = NOW()
    WHERE id = ${dbUserId}
  `;

  // 2026-05-03: Cancellation email is sent in handleSubscriptionUpdate() when
  // cancel_at_period_end flips false→true (= user just clicked cancel), not here.
  // By the time .deleted fires, access has already ended.

  console.log(`[Webhook] ✅ Subscription canceled for user ${dbUserId}`);
}

/**
 * Handle trial ending soon (3 days before)
 * 
 * 29th December 2025 (REV-58):
 * Stripe sends this event 3 days before trial ends.
 * 
 * February 2026: Added N8N webhook for trial_ending email notification.
 */
async function handleTrialWillEnd(subscription: Stripe.Subscription) {
  console.log(`[Webhook] Trial will end soon for subscription: ${subscription.id}`);
  
  const customerId = typeof subscription.customer === 'string' 
    ? subscription.customer 
    : (subscription.customer as { id: string })?.id;
    
  if (!customerId) {
    console.error(`[Webhook] Subscription ${subscription.id} has no customer ID`);
    return;
  }

  // Fetch user for email notification
  const users = await sql`
    SELECT u.email, u.name, u.plan
    FROM crewcast.users u
    JOIN crewcast.subscriptions s ON u.id = s.user_id
    WHERE s.stripe_customer_id = ${customerId}
  `;

  if (users.length === 0) {
    console.error(`[Webhook] No user found for customer: ${customerId}`);
    return;
  }

  const user = users[0];

  // 2026-05-01: n8n trial_ending email call removed here (n8n unreliable). See git history.

  console.log(`[Webhook] ✅ Trial-will-end event handled for user ${user.email}`);
}

/**
 * Handle successful invoice payment
 * 
 * CRITICAL FIX (Dec 2025): Properly extract subscription ID from both string and object formats.
 * The Stripe API (especially version 2025-11-17.clover) can return subscription as:
 * - A string: 'sub_xxx'
 * - An expanded object: { id: 'sub_xxx', ... }
 * - null: for one-time payments
 * 
 * Previous code used dangerous `as unknown as` type casting which broke when
 * subscription was an object, causing credits to never reset after payment.
 */
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  // ==========================================================================
  // SAFELY EXTRACT INVOICE DATA
  // Handle both string and object formats for customer and subscription
  // ==========================================================================
  
  // Use 'any' cast to safely access properties that may vary across Stripe API versions
  // The Stripe SDK types may not reflect all properties returned by the webhook
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invoiceObj = invoice as any;
  
  // Extract customer ID (can be string or Customer object)
  let customerId: string | null = null;
  const customerField = invoiceObj.customer;
  if (typeof customerField === 'string') {
    customerId = customerField;
  } else if (customerField && typeof customerField === 'object' && customerField.id) {
    customerId = customerField.id;
  }
  
  // Extract subscription ID - IMPORTANT: API version 2025-11-17.clover changed the structure!
  // OLD location: invoice.subscription (string or object)
  // NEW location: invoice.parent.subscription_details.subscription (string)
  let subscriptionId: string | null = null;
  
  // Try OLD location first (for backwards compatibility)
  const subscriptionField = invoiceObj.subscription;
  if (typeof subscriptionField === 'string') {
    subscriptionId = subscriptionField;
  } else if (subscriptionField && typeof subscriptionField === 'object' && subscriptionField.id) {
    subscriptionId = subscriptionField.id;
  }
  
  // Try NEW location (API version 2025-11-17.clover)
  // Structure: invoice.parent.subscription_details.subscription
  if (!subscriptionId && invoiceObj.parent?.subscription_details?.subscription) {
    const parentSubId = invoiceObj.parent.subscription_details.subscription;
    if (typeof parentSubId === 'string') {
      subscriptionId = parentSubId;
      console.log(`[Webhook] Found subscription ID in new location (parent.subscription_details): ${subscriptionId}`);
    }
  }
  
  // Also check line items as another fallback
  // Structure: invoice.lines.data[0].parent.subscription_item_details.subscription
  if (!subscriptionId && invoiceObj.lines?.data?.[0]?.parent?.subscription_item_details?.subscription) {
    const lineSubId = invoiceObj.lines.data[0].parent.subscription_item_details.subscription;
    if (typeof lineSubId === 'string') {
      subscriptionId = lineSubId;
      console.log(`[Webhook] Found subscription ID in line items: ${subscriptionId}`);
    }
  }
  
  // Get amount and billing reason safely
  const amountPaid = typeof invoiceObj.amount_paid === 'number' ? invoiceObj.amount_paid : 0;
  const billingReason: string | null = typeof invoiceObj.billing_reason === 'string' ? invoiceObj.billing_reason : null;
  
  console.log(`[Webhook] Invoice paid: ${invoice.id}, amount: ${amountPaid}, billing_reason: ${billingReason}, customer: ${customerId}`);

  // ==========================================================================
  // VALIDATE CUSTOMER ID
  // ==========================================================================
  if (!customerId) {
    console.error(`[Webhook] Invoice ${invoice.id} has no customer ID - cannot process`);
    return;
  }

  // ==========================================================================
  // FIND USER BY CUSTOMER ID
  // Extended query includes name for email notification (February 2026)
  // ==========================================================================
  const users = await sql`
    SELECT u.id, u.email, u.name, u.plan, s.stripe_subscription_id, s.status, s.first_payment_at
    FROM crewcast.users u
    JOIN crewcast.subscriptions s ON u.id = s.user_id
    WHERE s.stripe_customer_id = ${customerId}
  `;

  if (users.length === 0) {
    console.error(`[Webhook] No user found for customer: ${customerId}`);
    return;
  }

  const dbUserId = users[0].id;
  const userEmail = users[0].email;
  const userName = users[0].name;
  const userPlan = users[0].plan;
  const dbSubscriptionId = users[0].stripe_subscription_id;

  // ==========================================================================
  // FALLBACK: If invoice doesn't have subscription ID, use the one from DB
  // This handles cases where Stripe's invoice.subscription is null but we
  // know the user has a subscription (e.g., trial-to-paid conversion)
  // ==========================================================================
  if (!subscriptionId && dbSubscriptionId) {
    console.log(`[Webhook] Using subscription ID from database: ${dbSubscriptionId}`);
    subscriptionId = dbSubscriptionId;
  }

  // ==========================================================================
  // Skip ONLY $0 trial-start invoices (billing_reason: subscription_create).
  // Do NOT skip $0 invoices from coupons/discounts — those have
  // billing_reason: subscription_cycle and must be processed so that
  // credits are reset and period_end is updated for the new billing period.
  // ==========================================================================
  if (amountPaid === 0 && billingReason === 'subscription_create') {
    console.log(`[Webhook] Skipping $0 trial-start invoice (billing_reason=${billingReason})`);
    return;
  }

  if (amountPaid === 0) {
    console.log(`[Webhook] Processing $0 invoice with billing_reason=${billingReason} (coupon/discount)`);
  }

  // ==========================================================================
  // UPDATE SUBSCRIPTION STATUS (only for actual payments)
  // ==========================================================================
  await sql`
    UPDATE crewcast.subscriptions
    SET
      status = 'active',
      updated_at = NOW()
    WHERE user_id = ${dbUserId}
  `;

  await sql`
    UPDATE crewcast.users
    SET
      has_subscription = true,
      updated_at = NOW()
    WHERE id = ${dbUserId}
  `;

  console.log(`[Webhook] Payment successful for user ${dbUserId}`);

  try {
    let periodStart = new Date();
    let periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default 30 days
    let plan = userPlan || 'pro';

    // Try to get accurate period from Stripe subscription
    if (subscriptionId) {
      try {
        const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subObj = stripeSubscription as any;
        
        if (typeof subObj.current_period_start === 'number') {
          periodStart = new Date(subObj.current_period_start * 1000);
        }
        if (typeof subObj.current_period_end === 'number') {
          periodEnd = new Date(subObj.current_period_end * 1000);
        }
        
        // Get plan from subscription metadata (most accurate source)
        if (stripeSubscription.metadata?.plan) {
          plan = stripeSubscription.metadata.plan;
        }
        
        console.log(`[Webhook] Got subscription details: plan=${plan}, period=${periodStart.toISOString()} to ${periodEnd.toISOString()}`);
      } catch (subError) {
        console.error(`[Webhook] Failed to retrieve subscription ${subscriptionId}, using defaults:`, subError);
      }
    } else {
      console.log(`[Webhook] No subscription ID available, using defaults for credit reset`);
    }
    
    const normalizedPlan = normalizePlan(plan);

    // April 20th, 2026: resetCreditsForNewPeriod ignores the passed periodEnd
    // and always creates a 1-month entitlement window from periodStart — see
    // the policy comment on that function in src/lib/credits.ts. The
    // periodEnd computed above (from Stripe's current_period_end) is still
    // used for logging and for the subscriptions table (updated elsewhere in
    // the webhook), but not for the credit window.
    await resetCreditsForNewPeriod(dbUserId, normalizedPlan, periodStart, periodEnd);
    console.log(`[Webhook] ✅ Reset credits for user ${dbUserId} to ${normalizedPlan} plan`);
  } catch (creditError) {
    console.error(`[Webhook] Failed to reset credits for user ${dbUserId}:`, creditError);
  }

  // ============================================================================
  // AUTO-SCAN SCHEDULING - January 13th, 2026
  // Updated: January 14th, 2026 - Cleaned up debug logging
  // 
  // When a user makes their first payment, we unlock the auto-scan feature:
  // 1. Set first_payment_at to NOW() (only if not already set)
  // 2. Set next_auto_scan_at to NOW() + 7 days
  // 
  // On subsequent payments (renewals), we don't reset the scan schedule -
  // the scan continues on its 7-day cycle independent of billing cycles.
  // 
  // NOTE: first_payment_at may already be set by change-subscription route
  // when user clicks "Buy Now". This webhook acts as a backup.
  // ============================================================================
  try {
    const subscriptionCheck = await sql`
      SELECT first_payment_at FROM crewcast.subscriptions WHERE user_id = ${dbUserId}
    `;
    
    if (subscriptionCheck.length > 0 && !subscriptionCheck[0].first_payment_at) {
      // This is the user's FIRST payment - unlock auto-scan!
      const now = new Date();
      const nextScanAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
      
      await sql`
        UPDATE crewcast.subscriptions
        SET
          first_payment_at = ${now.toISOString()},
          next_auto_scan_at = ${nextScanAt.toISOString()},
          updated_at = NOW()
        WHERE user_id = ${dbUserId}
      `;
      
      console.log(`[Webhook] Auto-scan unlocked for user ${dbUserId}`);
    }
  } catch (autoScanError) {
    // Non-critical: Don't fail the webhook if auto-scan scheduling fails
    console.error(`[Webhook] Failed to set auto-scan schedule for user ${dbUserId}:`, autoScanError);
  }

  // ============================================================================
  // SEND PAYMENT-SUCCESS EMAIL VIA RESEND — added 2026-05-03
  //
  // Replaces the n8n call removed on 2026-05-01 (see git history). Fires for BOTH
  // first-time conversion AND every monthly/annual renewal, because invoice.paid
  // is the same event for both.
  //
  // SAFETY: sendEmail() never throws — it swallows and logs errors internally.
  // We wrap with waitUntil() so the serverless function stays alive until the
  // email is delivered, while Stripe still gets its 200 response immediately.
  //
  // LOCALE: hardcoded to 'de' for now. Target market is German-speaking and we
  // don't yet have a `preferred_language` column on users. If David asks for
  // both EN and DE, add the column + detect locale from there. If he asks for
  // EN only, swap this to 'en'.
  //
  // PLAN NAME CAVEAT: we use `userPlan` from the original DB fetch (above).
  // On first-time conversion this MIGHT still read 'free_trial' if Stripe fires
  // invoice.paid before customer.subscription.updated. We fall back to 'pro' in
  // that case as a sensible default. If wrong plan names show up in receipts,
  // hoist `plan` (declared inside the try block above) into outer scope and
  // use that here instead.
  //
  // CURRENCY: amount uses German number formatting via Intl.NumberFormat with
  // the de-DE locale (e.g. "29,00 €", with comma decimal and trailing €).
  // Currency code comes from Stripe (lowercase ISO 4217) and is uppercased for
  // the formatter. Falls back to 'EUR' if Stripe ever returns null.
  // ============================================================================
  const emailLocale = 'de' as const;
  const customerName = userName ?? 'there';
  const planForEmail = (userPlan && userPlan !== 'free_trial') ? userPlan : 'pro';
  const planLabel = planForEmail.charAt(0).toUpperCase() + planForEmail.slice(1);
  const amountFormatted = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: (invoice.currency || 'eur').toUpperCase(),
  }).format(amountPaid / 100);

  waitUntil(
    sendEmail({
      to: userEmail,
      subject: paymentSuccessEmailSubject(emailLocale),
      react: PaymentSuccessEmail({
        name: customerName,
        locale: emailLocale,
        plan: planLabel,
        amountFormatted,
        appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'https://afforce.one',
      }),
    })
  );

  console.log(`[Webhook] ✅ Payment success handled for user ${userEmail} (amount=${amountPaid}, plan=${userPlan})`);
}

/**
 * Handle failed invoice payment
 * 
 * FIXED (Dec 2025): Properly extract customer ID from both string and object formats
 * February 2026: Added N8N webhook for payment_failed email notification.
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  console.log(`[Webhook] Invoice payment failed: ${invoice.id}`);

  const customerId = typeof invoice.customer === 'string' 
    ? invoice.customer 
    : (invoice.customer as { id: string })?.id;
  
  if (!customerId) {
    console.error(`[Webhook] Invoice ${invoice.id} has no customer ID`);
    return;
  }

  // Extended query to include email/name for notification
  const users = await sql`
    SELECT u.id, u.email, u.name, u.plan
    FROM crewcast.users u
    JOIN crewcast.subscriptions s ON u.id = s.user_id
    WHERE s.stripe_customer_id = ${customerId}
  `;

  if (users.length === 0) {
    console.error(`[Webhook] No user found for customer: ${customerId}`);
    return;
  }

  const user = users[0];
  const dbUserId = user.id;

  await sql`
    UPDATE crewcast.subscriptions
    SET
      status = 'past_due',
      updated_at = NOW()
    WHERE user_id = ${dbUserId}
  `;

  // 2026-05-01: n8n payment_failed email call removed here (n8n unreliable). See git history.

  console.log(`[Webhook] ✅ Payment failed for user ${dbUserId} - status set to past_due`);
}

/**
 * Handle payment method attached to customer
 * 
 * FIXED (Dec 2025): Properly extract customer ID from both string and object formats
 */
async function handlePaymentMethodAttached(paymentMethod: Stripe.PaymentMethod) {
  console.log(`[Webhook] Payment method attached: ${paymentMethod.id}`);

  // Safely extract customer ID (can be string or Customer object)
  const customerId = typeof paymentMethod.customer === 'string' 
    ? paymentMethod.customer 
    : (paymentMethod.customer as { id: string })?.id;
  
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
    SELECT u.id FROM crewcast.users u
    JOIN crewcast.subscriptions s ON u.id = s.user_id
    WHERE s.stripe_customer_id = ${customerId}
  `;

  if (users.length === 0) {
    console.log(`[Webhook] No user found for customer: ${customerId} (might be new customer)`);
    return;
  }

  const dbUserId = users[0].id;

  await sql`
    UPDATE crewcast.subscriptions
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
    UPDATE crewcast.users
    SET
      billing_last4 = ${card.last4},
      billing_brand = ${card.brand},
      billing_expiry = ${`${String(card.exp_month).padStart(2, '0')}/${String(card.exp_year).slice(-2)}`},
      updated_at = NOW()
    WHERE id = ${dbUserId}
  `;

  console.log(`[Webhook] Updated card details for user ${dbUserId}`);
}
