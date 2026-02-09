/**
 * N8N Webhook Integration
 * 
 * Sends event data to n8n workflow for email notifications.
 * N8N workflow name: "CrewCast-Transactional-Emails"
 * 
 * SUPPORTED EVENTS:
 * - signup: New user registered
 * - trial_ending: Trial ends in 3 days (Stripe: customer.subscription.trial_will_end)
 * - payment_success: Invoice paid (Stripe: invoice.paid)
 * - payment_failed: Invoice payment failed (Stripe: invoice.payment_failed)
 * - subscription_canceled: Subscription deleted (Stripe: customer.subscription.deleted)
 * - credit_purchase_success: One-time credit pack purchased (Stripe: checkout.session.completed)
 * 
 * SECURITY:
 * - Server-side only (never expose webhook URL to client)
 * - HTTPS connection (encrypted in transit)
 * - Fire-and-forget (doesn't wait for response)
 * - Non-blocking (doesn't fail app flow if webhook fails)
 * 
 * Created: December 2025
 * Updated: February 2026 - Added multi-event support for transactional emails
 */

// =============================================================================
// EVENT TYPES
// =============================================================================

export type N8NEventType = 
  | 'signup'
  | 'trial_ending'
  | 'payment_success'
  | 'payment_failed'
  | 'subscription_canceled'
  | 'credit_purchase_success';

// Base event data - all events include these fields
export interface N8NBaseEvent {
  event_type: N8NEventType;
  email: string;
  name: string;
}

// Signup event
export interface N8NSignupEvent extends N8NBaseEvent {
  event_type: 'signup';
  plan: 'free_trial' | 'pro' | 'business' | 'enterprise';
  onboardingCompleted: boolean;
  signupDate: string;
}

// Trial ending event (3 days before expiry)
export interface N8NTrialEndingEvent extends N8NBaseEvent {
  event_type: 'trial_ending';
  plan: string;
  trialEndsAt: string;
  daysRemaining: number;
}

// Payment success event
export interface N8NPaymentSuccessEvent extends N8NBaseEvent {
  event_type: 'payment_success';
  plan: string;
  amountPaid: number; // in cents
  currency: string;
}

// Payment failed event
export interface N8NPaymentFailedEvent extends N8NBaseEvent {
  event_type: 'payment_failed';
  plan: string;
}

// Subscription canceled event
export interface N8NSubscriptionCanceledEvent extends N8NBaseEvent {
  event_type: 'subscription_canceled';
  plan: string;
}

// Credit purchase success (one-time pack)
export interface N8NCreditPurchaseSuccessEvent extends N8NBaseEvent {
  event_type: 'credit_purchase_success';
  creditType: 'email' | 'ai' | 'topic_search';
  creditsAmount: number;
  amountPaid: number; // in cents
  currency: string;
}

// Union type for all events
export type N8NEventData = 
  | N8NSignupEvent
  | N8NTrialEndingEvent
  | N8NPaymentSuccessEvent
  | N8NPaymentFailedEvent
  | N8NSubscriptionCanceledEvent
  | N8NCreditPurchaseSuccessEvent;

// =============================================================================
// LEGACY TYPE (backwards compatibility)
// =============================================================================

export interface N8NUserData {
  email: string;
  name: string;
  plan: 'free_trial' | 'pro' | 'business' | 'enterprise';
  onboardingCompleted: boolean;
  signupDate: string;
}

// =============================================================================
// TRANSACTIONAL EMAILS: Send events to N8N
// Uses N8N_TRANSACTIONAL_EMAILS_URL env var
// =============================================================================

/**
 * Send event data to n8n webhook for transactional email notifications.
 * N8N routes by event_type field to send appropriate email template.
 * 
 * ENV VAR: N8N_TRANSACTIONAL_EMAILS_URL
 * 
 * @param data Event data with event_type field
 * @returns Promise that resolves when webhook completes (fire-and-forget)
 */
export function sendEventToN8N(data: N8NEventData): Promise<void> {
  const webhookUrl = process.env.N8N_TRANSACTIONAL_EMAILS_URL;

  // Enhanced logging for debugging - February 2026
  console.log(`[N8N] 📧 sendEventToN8N called with event_type: ${data.event_type}`);
  console.log(`[N8N] 📧 N8N_TRANSACTIONAL_EMAILS_URL configured: ${webhookUrl ? 'YES (' + webhookUrl.substring(0, 50) + '...)' : 'NO'}`);

  if (!webhookUrl) {
    console.error('[N8N] ❌ N8N_TRANSACTIONAL_EMAILS_URL is NOT configured in environment variables!');
    console.error('[N8N] ❌ Transactional email will NOT be sent for:', data.event_type, data.email);
    return Promise.resolve();
  }

  const payload = {
    ...data,
    source: 'crewcast',
    timestamp: new Date().toISOString(),
  };

  console.log(`[N8N] 🚀 Firing ${data.event_type} event for: ${data.email}`);
  console.log(`[N8N] 🚀 Webhook URL: ${webhookUrl}`);
  console.log(`[N8N] 🚀 Payload: ${JSON.stringify(payload)}`);

  const startTime = Date.now();

  return fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'CrewCast-Studio/1.0',
    },
    body: JSON.stringify(payload),
  })
    .then(async (response) => {
      const elapsed = Date.now() - startTime;
      const responseText = await response.text().catch(() => 'Could not read response body');
      console.log(`[N8N] ✅ ${data.event_type}: HTTP ${response.status} in ${elapsed}ms for ${data.email}`);
      console.log(`[N8N] ✅ Response body: ${responseText.substring(0, 200)}`);
      
      if (!response.ok) {
        console.error(`[N8N] ⚠️ Non-OK response: ${response.status} ${response.statusText}`);
      }
    })
    .catch((error) => {
      const elapsed = Date.now() - startTime;
      console.error(`[N8N] ❌ ${data.event_type} FAILED after ${elapsed}ms for ${data.email}`);
      console.error(`[N8N] ❌ Error details:`, error.message);
      console.error(`[N8N] ❌ Error stack:`, error.stack);
    });
}

// =============================================================================
// LEGACY FUNCTION (backwards compatibility with existing signup webhook)
// Uses N8N_WEBHOOK_URL env var (existing integration)
// =============================================================================

/**
 * Send user signup data to n8n webhook (legacy function).
 * Uses separate N8N_WEBHOOK_URL for backwards compatibility with existing integration.
 * 
 * ENV VAR: N8N_WEBHOOK_URL
 */
export function sendUserToN8N(data: N8NUserData): Promise<void> {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log('[N8N] ⚠️ N8N_WEBHOOK_URL not configured, skipping legacy signup webhook');
    return Promise.resolve();
  }

  console.log(`[N8N] 🚀 Firing legacy signup webhook for: ${data.email}`);

  const startTime = Date.now();

  return fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'CrewCast-Studio/1.0',
    },
    body: JSON.stringify({
      ...data,
      source: 'crewcast_signup',
      timestamp: new Date().toISOString(),
    }),
  })
    .then((response) => {
      const elapsed = Date.now() - startTime;
      console.log(`[N8N] ✅ Legacy signup: ${response.status} in ${elapsed}ms for ${data.email}`);
    })
    .catch((error) => {
      const elapsed = Date.now() - startTime;
      console.log(`[N8N] ❌ Legacy signup failed after ${elapsed}ms for ${data.email}: ${error.message}`);
    });
}

/**
 * Helper function to format user data for n8n webhook (legacy).
 */
export function formatUserDataForN8N(user: {
  email: string;
  name: string;
  plan: 'free_trial' | 'pro' | 'business' | 'enterprise';
  is_onboarded: boolean;
  created_at: string;
}): N8NUserData {
  return {
    email: user.email,
    name: user.name,
    plan: user.plan,
    onboardingCompleted: user.is_onboarded,
    signupDate: user.created_at,
  };
}
