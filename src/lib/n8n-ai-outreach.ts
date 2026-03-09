/**
 * N8N AI Outreach Webhook Integration
 * 
 * Sends affiliate + user business data to n8n for AI-powered email generation.
 * Unlike the signup webhook (fire-and-forget), this one waits for a response
 * containing the AI-generated email.
 * 
 * ARCHITECTURE:
 * 1. Frontend calls /api/ai/outreach
 * 2. API validates auth, checks credits
 * 3. API calls this function to send data to n8n
 * 4. n8n processes with AI (GPT/Claude/etc - client controls the prompt)
 * 5. n8n returns generated email
 * 6. API consumes credit and returns email to frontend
 * 
 * SECURITY:
 * - Server-side only (webhook URL never exposed to client)
 * - HTTPS connection (encrypted in transit)
 * - Timeout handling (doesn't hang forever)
 * - Error handling for n8n failures
 * 
 * Created: December 17, 2025
 */

// =============================================================================
// DATA STRUCTURES - These are what n8n receives and returns
// =============================================================================

/**
 * User's business context - helps AI personalize the outreach
 * This comes from the user's onboarding data in the database
 */
export interface UserBusinessContext {
  // User identity
  name: string;
  email: string;
  
  // Business info (from onboarding)
  brand: string | null;           // Company/brand name
  bio: string | null;             // What their business does
  targetCountry: string | null;   // Target market country
  targetLanguage: string | null;  // Preferred language for outreach
  
  // Discovery context
  competitors: string[];          // Competitors they're tracking
  topics: string[];               // Topics/keywords they're interested in
  affiliateTypes: string[];       // Types of affiliates they want
}

/**
 * Affiliate data - the person/entity they want to reach out to
 */
export interface AffiliateData {
  // Identity
  id: number;
  personName: string | null;
  email: string | null;
  
  // Content context
  domain: string;
  source: string;                 // 'Web' | 'YouTube' | 'Instagram' | 'TikTok'
  title: string;                  // Article/video title
  snippet: string;                // Content snippet/description
  link: string | null;            // Full page URL (for Web results)

  // Discovery context
  keyword: string | null;         // How they were discovered
  discoveryMethodType: string | null;  // 'keyword' | 'competitor' | 'topic'
  discoveryMethodValue: string | null;
  
  // Social media specific (when applicable)
  instagramUsername: string | null;
  instagramBio: string | null;
  instagramFollowers: number | null;
  
  tiktokUsername: string | null;
  tiktokBio: string | null;
  tiktokFollowers: number | null;
  
  // YouTube specific
  channelName: string | null;
  channelSubscribers: string | null;
}

/**
 * Complete payload sent to n8n webhook
 */
export interface N8NAIOutreachRequest {
  // Unique request ID for tracking
  requestId: string;
  
  // Timestamp
  timestamp: string;
  
  // User's business context
  user: UserBusinessContext;
  
  // Affiliate to reach out to
  affiliate: AffiliateData;
  
  // Optional customization (for future use)
  options?: {
    tone?: 'formal' | 'casual' | 'friendly';
    length?: 'short' | 'medium' | 'long';
    includeSubject?: boolean;
  };

  // Firecrawl markdown of affiliate's page (Web only). Omitted if not scraped.
  scrapedPageContent?: string | null;
}

/**
 * Response expected from n8n
 */
export interface N8NAIOutreachResponse {
  // Generated email content (primary email body - kept for backwards compatibility)
  message: string;
  
  // Optional subject line (primary email subject - kept for backwards compatibility)
  subject?: string;
  
  // Optional multi-channel messages (new format - March 2026)
  channels?: ChannelMessages;
  
  // Success indicator
  success: boolean;
  
  // Error message if failed
  error?: string;
}

// Multi-channel messages returned by n8n (March 2026)
export interface ChannelMessages {
  email?: {
    subject: string;
    message: string;
  };
  instagram_dm?: {
    message: string;
  };
  whatsapp_sms?: {
    message: string;
  };
  linkedin_dm?: {
    message: string;
  };
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Send data to n8n and receive AI-generated email
 * 
 * @param request - Complete request payload
 * @returns Promise with generated email or error
 */
export async function generateOutreachEmail(
  request: N8NAIOutreachRequest
): Promise<N8NAIOutreachResponse> {
  const webhookUrl = process.env.N8N_AI_OUTREACH_WEBHOOK_URL;

  // Check if webhook URL is configured
  if (!webhookUrl) {
    console.error('[N8N AI Outreach] ❌ Webhook URL not configured');
    return {
      success: false,
      message: '',
      error: 'AI outreach webhook not configured. Please contact support.',
    };
  }

  console.log(`[N8N AI Outreach] 🚀 Generating email for affiliate: ${request.affiliate.domain}`);
  const startTime = Date.now();

  try {
    // Call n8n webhook with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'AffiliateFinder/1.0',
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const elapsed = Date.now() - startTime;

    if (!response.ok) {
      console.error(`[N8N AI Outreach] ❌ HTTP ${response.status} after ${elapsed}ms`);
      return {
        success: false,
        message: '',
        error: `AI service returned error: ${response.status}`,
      };
    }

    // Parse response from n8n
    const rawData = await response.json();
    
    console.log(`[N8N AI Outreach] ✅ Generated email in ${elapsed}ms for ${request.affiliate.domain}`);
    console.log('[N8N AI Outreach] 📥 Raw response:', JSON.stringify(rawData).substring(0, 500));

    // =========================================================================
    // RESPONSE PARSING (Updated December 17, 2025, March 2026)
    // 
    // n8n can return different formats:
    // 1. Array with output object: [{ output: { subject, greeting, ... } }]
    // 2. Plain string - use directly
    // 3. { message: "..." } - use message field
    // 4. Structured format { subject, greeting, opening, body, cta, closing, 
    //    signature_name, signature_email, signature_website, signature_location }
    //    - reconstruct the full email from parts
    // =========================================================================
    let message = '';
    let subject = '';
    let channels: ChannelMessages | undefined;
    
    // Normalize the data - n8n often returns an array with one item
    // Also handle nested output field
    let data = rawData;
    
    // If it's an array, take the first element
    if (Array.isArray(data)) {
      console.log('[N8N AI Outreach] 📦 Response is an array, extracting first element');
      data = data[0] || {};
    }
    
    // If data has an "output" field, use that (n8n Information Extractor wraps in output)
    if (data.output && typeof data.output === 'object') {
      console.log('[N8N AI Outreach] 📦 Found nested output field, unwrapping');
      data = data.output;
    }
    
    console.log('[N8N AI Outreach] 📧 Normalized data keys:', Object.keys(data));

    // =======================================================================
    // NEW FORMAT (March 2026): Multi-channel object under data.email + DMs
    // Structure (after unwrapping output):
    // {
    //   email: { subject, greeting, opening, body, cta, closing, signature_* },
    //   instagram_dm: { message },
    //   whatsapp_sms: { message },
    //   linkedin_dm: { message }
    // }
    // =======================================================================
    if (data && typeof data === 'object' && (data as any).email && typeof (data as any).email === 'object') {
      console.log('[N8N AI Outreach] 📧 Detected multi-channel format with nested email object');
      const emailData = (data as any).email as Record<string, unknown>;

      // Rebuild email from structured parts (mirrors structured format branch below)
      const parts: string[] = [];
      const emailSubject = typeof emailData.subject === 'string' ? emailData.subject : '';

      const greeting = typeof emailData.greeting === 'string' ? emailData.greeting : '';
      const opening = typeof emailData.opening === 'string' ? emailData.opening : '';
      const body = typeof emailData.body === 'string' ? emailData.body : '';
      const cta = typeof emailData.cta === 'string' ? emailData.cta : '';
      const closing = typeof emailData.closing === 'string' ? emailData.closing : '';
      const signature_name = typeof emailData.signature_name === 'string' ? emailData.signature_name : '';
      const signature_email = typeof emailData.signature_email === 'string' ? emailData.signature_email : '';
      const signature_website = typeof emailData.signature_website === 'string' ? emailData.signature_website : '';
      const signature_location = typeof emailData.signature_location === 'string' ? emailData.signature_location : '';
      const ps = typeof emailData.ps === 'string' ? emailData.ps : '';

      if (greeting) {
        parts.push(greeting);
      }
      if (opening) {
        parts.push('');
        parts.push(opening);
      }
      if (body) {
        parts.push('');
        parts.push(body);
      }
      if (cta) {
        parts.push('');
        parts.push(cta);
      }
      if (closing) {
        parts.push('');
        parts.push(closing);
      }

      const signatureParts: string[] = [];
      if (signature_name) signatureParts.push(signature_name);
      if (signature_email) signatureParts.push(signature_email);
      if (signature_website) signatureParts.push(signature_website);
      if (signature_location) signatureParts.push(signature_location);

      if (signatureParts.length > 0) {
        parts.push(signatureParts.join('\n'));
      }

      if (ps) {
        parts.push('');
        parts.push('---');
        parts.push('');
        parts.push(ps);
      }

      message = parts.join('\n');
      subject = emailSubject;

      const channelMessages: ChannelMessages = {
        email: {
          subject,
          message,
        },
      };

      // Optional DM-style channels
      const anyData = data as any;
      if (anyData.instagram_dm && typeof anyData.instagram_dm === 'object' && typeof anyData.instagram_dm.message === 'string') {
        channelMessages.instagram_dm = { message: anyData.instagram_dm.message };
      }
      if (anyData.whatsapp_sms && typeof anyData.whatsapp_sms === 'object' && typeof anyData.whatsapp_sms.message === 'string') {
        channelMessages.whatsapp_sms = { message: anyData.whatsapp_sms.message };
      }
      if (anyData.linkedin_dm && typeof anyData.linkedin_dm === 'object' && typeof anyData.linkedin_dm.message === 'string') {
        channelMessages.linkedin_dm = { message: anyData.linkedin_dm.message };
      }

      channels = channelMessages;

    } else if (typeof data === 'string') {
      // Format 1: Plain string
      message = data;
    } else if (typeof data.message === 'string') {
      // Format 2: { message: "..." } - message is a string
      message = data.message;
      subject = data.subject || '';
    } else if (data.body && data.greeting) {
      // =====================================================================
      // Format 3: STRUCTURED EMAIL FORMAT from n8n Information Extractor
      // 
      // Expected fields:
      // - subject: Email subject line
      // - greeting: "Bonjour Amelia," or "Hi John,"
      // - opening: "I hope this message finds you well!"
      // - body: Main email content
      // - cta: Call-to-action question
      // - closing: Sign-off phrase
      // - signature_name, signature_email, signature_website, signature_location
      // - ps: Optional P.S. note
      // =====================================================================
      console.log('[N8N AI Outreach] 📧 Reconstructing email from structured format');
      
      subject = data.subject || '';
      
      // Reconstruct the full email from parts
      const parts: string[] = [];
      
      // Greeting
      if (data.greeting) {
        parts.push(data.greeting);
      }
      
      // Opening line (with blank line after greeting)
      if (data.opening) {
        parts.push('');
        parts.push(data.opening);
      }
      
      // Main body
      if (data.body) {
        parts.push('');
        parts.push(data.body);
      }
      
      // Call-to-action
      if (data.cta) {
        parts.push('');
        parts.push(data.cta);
      }
      
      // Closing
      if (data.closing) {
        parts.push('');
        parts.push(data.closing);
      }
      
      // Signature block
      const signatureParts: string[] = [];
      if (data.signature_name) signatureParts.push(data.signature_name);
      if (data.signature_email) signatureParts.push(data.signature_email);
      if (data.signature_website) signatureParts.push(data.signature_website);
      if (data.signature_location) signatureParts.push(data.signature_location);
      
      if (signatureParts.length > 0) {
        parts.push(signatureParts.join('\n'));
      }
      
      // P.S. note (optional)
      if (data.ps) {
        parts.push('');
        parts.push('---');
        parts.push('');
        parts.push(data.ps);
      }
      
      message = parts.join('\n');
      
    } else if (data.output) {
      // Legacy format: { output: "..." }
      message = data.output;
      subject = data.subject || '';
    } else if (typeof data.email === 'string') {
      // Legacy format: { email: "..." }
      message = data.email as string;
      subject = data.subject || '';
    } else if (data.text) {
      // Legacy format: { text: "..." }
      message = data.text;
      subject = data.subject || '';
    }

    if (!message) {
      console.error('[N8N AI Outreach] ❌ No message in response:', data);
      return {
        success: false,
        message: '',
        error: 'AI did not return a message. Please try again.',
      };
    }

    const responsePayload: N8NAIOutreachResponse = {
      success: true,
      message,
      subject,
    };
    if (channels) {
      responsePayload.channels = channels;
    }
    return responsePayload;

  } catch (error) {
    const elapsed = Date.now() - startTime;
    
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`[N8N AI Outreach] ❌ Timeout after ${elapsed}ms`);
      return {
        success: false,
        message: '',
        error: 'AI took too long to respond. Please try again.',
      };
    }

    console.error(`[N8N AI Outreach] ❌ Error after ${elapsed}ms:`, error);
    return {
      success: false,
      message: '',
      error: 'Failed to connect to AI service. Please try again.',
    };
  }
}

/**
 * Generate a unique request ID for tracking
 */
export function generateRequestId(): string {
  return `outreach-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
