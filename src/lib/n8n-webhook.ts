/**
 * N8N Webhook Integration
 * 
 * Sends user signup data to n8n workflow for client automation.
 * 
 * SECURITY:
 * - Server-side only (never expose webhook URL to client)
 * - HTTPS connection (encrypted in transit)
 * - Non-blocking (doesn't fail user signup if webhook fails)
 * - Timeout protection (15 second max, handles n8n cold starts)
 * - Error logging for monitoring
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
 * Send user signup data to n8n webhook
 * 
 * This is called after user creation in the database (Option 1).
 * 
 * NOTE: If needed in the future, we can also send data after onboarding
 * completion (Option 2) which would include additional fields like:
 * - role, brand, targetCountry, targetLanguage
 * - competitors, topics, affiliateTypes
 * 
 * @param data User data to send
 * @returns Promise<boolean> - true if successful, false if failed
 */
export async function sendUserToN8N(data: N8NUserData): Promise<boolean> {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;

  // Skip if webhook URL is not configured
  if (!webhookUrl) {
    console.warn('[N8N] Webhook URL not configured, skipping...');
    return false;
  }

  try {
    console.log(`[N8N] Sending user data for: ${data.email}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout (handles n8n cold starts)

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CrewCast-Studio/1.0',
      },
      body: JSON.stringify({
        ...data,
        source: 'crewcast_signup', // Identify the source
        timestamp: new Date().toISOString(),
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`N8N webhook returned ${response.status}: ${response.statusText}`);
    }

    console.log(`[N8N] ✅ Successfully sent data for: ${data.email}`);
    return true;

  } catch (error) {
    // DON'T throw - we don't want to break user signup if n8n is down
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.error(`[N8N] ❌ Timeout sending data for: ${data.email}`);
      } else {
        console.error(`[N8N] ❌ Failed to send data for: ${data.email}`, error.message);
      }
    } else {
      console.error(`[N8N] ❌ Unknown error for: ${data.email}`, error);
    }
    
    // TODO: Consider implementing a retry queue for failed webhooks
    // For now, we just log and continue
    
    return false;
  }
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
