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
  | 'subscription_canceled';

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

// Union type for all events
export type N8NEventData = 
  | N8NSignupEvent
  | N8NTrialEndingEvent
  | N8NPaymentSuccessEvent
  | N8NPaymentFailedEvent
  | N8NSubscriptionCanceledEvent;

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
// MAIN FUNCTION: Send any event to N8N
// =============================================================================

/**
 * Send event data to n8n webhook for email notifications.
 * N8N routes by event_type field to send appropriate email template.
 * 
 * @param data Event data with event_type field
 * @returns Promise that resolves when webhook completes (fire-and-forget)
 */
export function sendEventToN8N(data: N8NEventData): Promise<void> {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log('[N8N] ⚠️ Webhook URL not configured, skipping');
    return Promise.resolve();
  }

  console.log(`[N8N] 🚀 Firing ${data.event_type} event for: ${data.email}`);

  const startTime = Date.now();

  return fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'CrewCast-Studio/1.0',
    },
    body: JSON.stringify({
      ...data,
      source: 'crewcast',
      timestamp: new Date().toISOString(),
    }),
  })
    .then((response) => {
      const elapsed = Date.now() - startTime;
      console.log(`[N8N] ✅ ${data.event_type}: ${response.status} in ${elapsed}ms for ${data.email}`);
    })
    .catch((error) => {
      const elapsed = Date.now() - startTime;
      console.log(`[N8N] ❌ ${data.event_type} failed after ${elapsed}ms for ${data.email}: ${error.message}`);
    });
}

// =============================================================================
// LEGACY FUNCTION (backwards compatibility with existing signup code)
// =============================================================================

/**
 * Send user signup data to n8n webhook (legacy function).
 * Kept for backwards compatibility - internally calls sendEventToN8N.
 */
export function sendUserToN8N(data: N8NUserData): Promise<void> {
  return sendEventToN8N({
    event_type: 'signup',
    ...data,
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
