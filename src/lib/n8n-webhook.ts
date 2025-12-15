/**
 * N8N Webhook Integration
 * 
 * Sends user signup data to n8n workflow for client automation.
 * 
 * SECURITY:
 * - Server-side only (never expose webhook URL to client)
 * - HTTPS connection (encrypted in transit)
 * - Fire-and-forget (doesn't wait for response)
 * - Non-blocking (doesn't fail user signup if webhook fails)
 * 
 * Created: December 2025
 */

export interface N8NUserData {
  // User Identity
  email: string;
  name: string;
  
  // Subscription Info
  plan: 'free_trial' | 'pro' | 'business' | 'enterprise';
  trialPlan: 'pro' | 'business' | null;
  trialStartDate: string | null;
  trialEndDate: string | null;
  
  // Metadata
  onboardingCompleted: boolean;
  signupDate: string;
}

/**
 * Send user signup data to n8n webhook (Fire-and-Forget)
 * 
 * This is called after user creation in the database.
 * We don't wait for a response - just send and move on.
 * 
 * @param data User data to send
 */
export function sendUserToN8N(data: N8NUserData): void {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;

  // Skip if webhook URL is not configured
  if (!webhookUrl) {
    return;
  }

  // Fire and forget - don't await, don't care about response
  fetch(webhookUrl, {
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
  }).catch(() => {
    // Silently ignore errors - this is fire-and-forget
  });
}

/**
 * Helper function to format user data for n8n webhook
 * 
 * @param user Database user object
 * @returns Formatted data for n8n
 */
export function formatUserDataForN8N(user: {
  email: string;
  name: string;
  plan: 'free_trial' | 'pro' | 'business' | 'enterprise';
  trial_plan: 'pro' | 'business' | null;
  trial_start_date: string | null;
  trial_end_date: string | null;
  is_onboarded: boolean;
  created_at: string;
}): N8NUserData {
  return {
    email: user.email,
    name: user.name,
    plan: user.plan,
    trialPlan: user.trial_plan,
    trialStartDate: user.trial_start_date,
    trialEndDate: user.trial_end_date,
    onboardingCompleted: user.is_onboarded,
    signupDate: user.created_at,
  };
}
