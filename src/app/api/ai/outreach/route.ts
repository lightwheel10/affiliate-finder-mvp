/**
 * AI Outreach Email Generation API
 * 
 * POST /api/ai/outreach - Generate personalized outreach email for an affiliate
 * 
 * This endpoint:
 * 1. Validates user authentication (Stack Auth)
 * 2. Checks AI credits
 * 3. Fetches user's business context from database
 * 4. Sends data to n8n webhook for AI processing
 * 5. Returns generated email
 * 6. Consumes 1 AI credit on success
 * 
 * The actual AI prompt is controlled in n8n by the client, giving them
 * full flexibility without code access.
 * 
 * Created: December 17, 2025
 * 
 * =============================================================================
 * MULTI-CONTACT SUPPORT (Added December 25, 2025)
 * =============================================================================
 * 
 * When Lusha returns multiple contacts for an affiliate (e.g., Marketing Director,
 * Partnerships Manager, etc.), users can now select which specific contact to
 * generate an email for.
 * 
 * New request parameters:
 * - selectedContact: { email, firstName, lastName, title } - Optional override
 *   for the contact to address in the email. If provided, uses this instead of
 *   the affiliate's primary email/personName.
 * 
 * Credits: 1 AI credit per email generated (regardless of which contact)
 * 
 * Storage: Messages are now stored in a JSONB column `ai_generated_messages`
 * keyed by contact email, allowing multiple messages per affiliate.
 * =============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import {
  affiliateRequestErrorResponse,
  resolveAffiliateRequestContext,
} from '@/lib/affiliates/server';
import {
  releaseOutreachGeneration,
  reserveOutreachGeneration,
  type OutreachGenerationInput,
  type OutreachGenerationLease,
} from '@/lib/affiliates/outreach-generation-postgres';
import { 
  generateOutreachEmail, 
  generateRequestId,
  N8NAIOutreachRequest,
  UserBusinessContext,
  AffiliateData
} from '@/lib/n8n-ai-outreach';

// =============================================================================
// CONFIGURATION
// =============================================================================

// Check if credit enforcement is enabled
function isCreditEnforcementEnabled(): boolean {
  const flag = process.env.ENFORCE_CREDITS;
  if (!flag) return false;
  return flag.toLowerCase() === 'true' || flag === '1';
}

// Vercel function timeout (Pro plan). n8n call ~15-25s; Firecrawl adds ~3-8s.
export const maxDuration = 60;

// =============================================================================
// FIRECRAWL SCRAPING (Web results only - for n8n AI context)
// Same API pattern as suggestions/generate. Self-contained in this file.
// =============================================================================

const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v1/scrape';
const FIRECRAWL_TIMEOUT_MS = 15000;
const SCRAPED_CONTENT_MAX_LENGTH = 6000;

/**
 * Scrape a URL with Firecrawl and return markdown content (truncated).
 * Returns null on any failure; does not throw. Used only for Web affiliates.
 */
async function scrapeAffiliatePage(url: string): Promise<string | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    console.warn('[AI Outreach] FIRECRAWL_API_KEY not configured, skipping page scrape');
    return null;
  }

  const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FIRECRAWL_TIMEOUT_MS);

    const response = await fetch(FIRECRAWL_API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: normalizedUrl,
        formats: ['markdown'],
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[AI Outreach] Firecrawl HTTP ${response.status} for ${normalizedUrl}:`, errorText.substring(0, 200));
      return null;
    }

    const result = await response.json();
    if (!result.success || !result.data?.markdown) {
      console.warn('[AI Outreach] Firecrawl returned no content for', normalizedUrl);
      return null;
    }

    const content = result.data.markdown as string;
    const truncated = content.length > SCRAPED_CONTENT_MAX_LENGTH
      ? content.slice(0, SCRAPED_CONTENT_MAX_LENGTH) + '\n\n[... content truncated for length ...]'
      : content;
    return truncated;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('[AI Outreach] Firecrawl timeout for', normalizedUrl);
    } else {
      console.warn('[AI Outreach] Firecrawl error for', normalizedUrl, error);
    }
    return null;
  }
}

// =============================================================================
// POST - Generate outreach email
// =============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let activeReservation: {
    input: OutreachGenerationInput;
    lease: OutreachGenerationLease;
  } | null = null;

  const releaseActiveReservation = async (): Promise<void> => {
    if (!activeReservation) return;
    const reservation = activeReservation;
    const released = await releaseOutreachGeneration(
      reservation.input,
      reservation.lease,
    );
    if (released) activeReservation = null;
  };
  
  try {
    // =========================================================================
    // STEP 2: PARSE REQUEST BODY
    // =========================================================================
    const body = await request.json();
    const {
      affiliateId,
      affiliate: affiliateData,
      selectedContact,
      userId: legacyUserId,
      brandLocationId,
    } = body;
    
    // =========================================================================
    // MULTI-CONTACT SUPPORT (December 25, 2025)
    // 
    // selectedContact is an optional object containing:
    // - email: string (required) - The specific contact's email
    // - firstName: string - Contact's first name
    // - lastName: string - Contact's last name  
    // - title: string - Contact's job title (e.g., "Marketing Director")
    //
    // When provided, this overrides the affiliate's primary email/personName
    // to generate a more personalized email for the specific contact.
    // =========================================================================

    const requestedAffiliateId = Number(affiliateId ?? affiliateData?.id);
    if (!Number.isSafeInteger(requestedAffiliateId) || requestedAffiliateId <= 0) {
      return NextResponse.json(
        { error: 'A valid affiliateId is required' },
        { status: 400 }
      );
    }

    // =========================================================================
    // STEP 3: GET USER FROM DATABASE
    // Fetch full user profile including business context
    // =========================================================================
    const context = await resolveAffiliateRequestContext({
      legacyAccountId: legacyUserId,
      requestedBrandLocationId: brandLocationId,
    });
    const users = await sql`
      SELECT 
        id, email, name
      FROM crewcast.users 
      WHERE id = ${context.accountId}
    `;

    if (users.length === 0) {
      return NextResponse.json(
        { error: 'User account not found. Please complete onboarding.' },
        { status: 404 }
      );
    }

    const user = users[0];
    const userId = context.accountId;
    const enforceCredits = isCreditEnforcementEnabled();
    const reservationInput: OutreachGenerationInput = {
      accountId: userId,
      brandId: context.brandId,
      brandLocationId: context.brandLocationId,
      affiliateId: requestedAffiliateId,
      enforceCredits,
    };
    let reservation;
    try {
      reservation = await reserveOutreachGeneration(reservationInput);
    } catch (reservationError) {
      console.error('[AI Outreach] Failed to reserve generation safely:', reservationError);
      return NextResponse.json(
        { error: 'Unable to start generation safely. Please try again.' },
        { status: 503 },
      );
    }

    if (reservation.outcome === 'affiliate_not_found') {
      return NextResponse.json({ error: 'Affiliate not found' }, { status: 404 });
    }
    if (reservation.outcome === 'in_progress') {
      console.log(`[AI Outreach] Generation already in progress for affiliate ${requestedAffiliateId} (started ${reservation.startedSecondsAgo}s ago). Blocking duplicate.`);
      return NextResponse.json({
        success: false,
        error: 'Email generation is already in progress. Please wait for it to complete.',
        inProgress: true,
        startedSecondsAgo: reservation.startedSecondsAgo,
        creditsConsumed: false,
      }, { status: 409 });
    }
    if (reservation.outcome === 'insufficient_credits') {
      console.log(`[AI Outreach] Credit reservation failed for user ${userId}: ${reservation.message}`);
      return NextResponse.json({
          error: reservation.message,
          creditError: true,
          remaining: reservation.remaining,
          isReadOnly: reservation.isReadOnly,
        }, { status: 402 });
    }

    activeReservation = { input: reservationInput, lease: reservation.lease };
    console.log(`[AI Outreach] Reserved generation for affiliate ${requestedAffiliateId}. New balance: ${reservation.lease.creditsRemaining}`);

    // =========================================================================
    // STEP 5: GET AFFILIATE DATA
    // Either from request body or fetch from database
    // =========================================================================
    let affiliate: AffiliateData;

    if (affiliateData) {
      // Affiliate data provided directly in request
      affiliate = {
        // The database-owned ID is authoritative; never let request data point
        // the paid generation at a different affiliate than the locked row.
        id: requestedAffiliateId,
        personName: affiliateData.personName || null,
        email: affiliateData.email || null,
        domain: affiliateData.domain,
        source: affiliateData.source,
        title: affiliateData.title,
        snippet: affiliateData.snippet || '',
        link: affiliateData.link || null,
        keyword: affiliateData.keyword || null,
        discoveryMethodType: affiliateData.discoveryMethod?.type || null,
        discoveryMethodValue: affiliateData.discoveryMethod?.value || null,
        instagramUsername: affiliateData.instagramUsername || null,
        instagramBio: affiliateData.instagramBio || null,
        instagramFollowers: affiliateData.instagramFollowers || null,
        tiktokUsername: affiliateData.tiktokUsername || null,
        tiktokBio: affiliateData.tiktokBio || null,
        tiktokFollowers: affiliateData.tiktokFollowers || null,
        channelName: affiliateData.channel?.name || null,
        channelSubscribers: affiliateData.channel?.subscribers || null,
      };
    } else {
      // Fetch affiliate from database
      const affiliates = await sql`
        SELECT 
          id, person_name, email, domain, source, title, snippet, link,
          keyword, discovery_method_type, discovery_method_value,
          instagram_username, instagram_bio, instagram_followers,
          tiktok_username, tiktok_bio, tiktok_followers,
          channel_name, channel_subscribers
        FROM crewcast.saved_affiliates
        WHERE id = ${affiliateId}
          AND user_id = ${userId}
          AND brand_id = ${context.brandId}::bigint
          AND brand_location_id = ${context.brandLocationId}::bigint
      `;

      if (affiliates.length === 0) {
        return NextResponse.json(
          { error: 'Affiliate not found' },
          { status: 404 }
        );
      }

      const a = affiliates[0];
      affiliate = {
        id: a.id,
        personName: a.person_name,
        email: a.email,
        domain: a.domain,
        source: a.source,
        title: a.title,
        snippet: a.snippet || '',
        link: a.link ?? null,
        keyword: a.keyword,
        discoveryMethodType: a.discovery_method_type,
        discoveryMethodValue: a.discovery_method_value,
        instagramUsername: a.instagram_username,
        instagramBio: a.instagram_bio,
        instagramFollowers: a.instagram_followers,
        tiktokUsername: a.tiktok_username,
        tiktokBio: a.tiktok_bio,
        tiktokFollowers: a.tiktok_followers,
        channelName: a.channel_name,
        channelSubscribers: a.channel_subscribers,
      };
    }
    
    // =========================================================================
    // STEP 5.5: APPLY SELECTED CONTACT OVERRIDE (December 25, 2025)
    // 
    // If a specific contact was selected from the multi-contact picker,
    // override the affiliate's email and personName with the selected contact's
    // information. This allows generating personalized emails for different
    // contacts at the same company.
    //
    // The selectedContact object comes from emailResults.contacts[] which
    // Lusha provides when multiple contacts are found.
    // =========================================================================
    let contactEmail = affiliate.email;
    
    if (selectedContact && selectedContact.email) {
      // Build full name from firstName + lastName
      const contactFullName = [
        selectedContact.firstName,
        selectedContact.lastName
      ].filter(Boolean).join(' ') || null;
      
      // Override affiliate's contact info with selected contact
      affiliate.personName = contactFullName;
      affiliate.email = selectedContact.email;
      contactEmail = selectedContact.email;
      
      // Log for debugging
      console.log(`[AI Outreach] Using selected contact: ${contactFullName || 'Unknown'} <${selectedContact.email}> (${selectedContact.title || 'No title'})`);
    }

    // =========================================================================
    // STEP 5.6: SCRAPE AFFILIATE PAGE (Web results only)
    //
    // For Web affiliates with a link, scrape the page with Firecrawl and pass
    // content to n8n so the AI can write more personalized emails. Failure is
    // silent: we continue without scraped content and do not refund credits.
    // =========================================================================
    let scrapedPageContent: string | null = null;
    if (affiliate.source === 'Web' && affiliate.link) {
      scrapedPageContent = await scrapeAffiliatePage(affiliate.link);
      if (scrapedPageContent) {
        console.log(`[AI Outreach] Scraped ${scrapedPageContent.length} chars for ${affiliate.domain}`);
      }
    }

    // =========================================================================
    // STEP 6: BUILD USER BUSINESS CONTEXT
    // =========================================================================
    const userContext: UserBusinessContext = {
      name: user.name || '',
      email: user.email || '',
      brand: context.brand.name,
      bio: context.brand.bio,
      targetCountry: context.location.countryCode,
      targetLanguage: context.location.languageCode,
      competitors: context.location.competitors,
      topics: context.location.topics,
      affiliateTypes: context.brand.affiliateTypes,
    };

    // =========================================================================
    // STEP 7: BUILD N8N REQUEST
    // =========================================================================
    const n8nRequest: N8NAIOutreachRequest = {
      requestId: generateRequestId(),
      timestamp: new Date().toISOString(),
      user: userContext,
      affiliate,
      scrapedPageContent,
      options: {
        tone: 'friendly',
        length: 'medium',
        includeSubject: true,
      },
    };

    console.log(`[AI Outreach] Sending request to n8n for affiliate ${affiliate.domain}`);

    // =========================================================================
    // STEP 8: CALL N8N WEBHOOK
    // =========================================================================
    const result = await generateOutreachEmail(n8nRequest);

    if (!result.success) {
      console.error(`[AI Outreach] n8n failed: ${result.error}`);
      
      // =========================================================================
      // REFUND CREDIT ON N8N FAILURE (January 24th, 2026)
      // 
      // Since we consumed the credit upfront (before n8n call), we must refund
      // it when generation fails. This ensures users only pay for successful
      // email generation.
      // =========================================================================
      await releaseActiveReservation();
      
      return NextResponse.json(
        { error: result.error || 'Failed to generate email' },
        { status: 500 }
      );
    }

    // =========================================================================
    // STEP 8.5: VALIDATE MESSAGE CONTENT (Added January 22, 2026)
    // 
    // BUG FIX: Ensure the message is a non-empty string before proceeding.
    // This prevents storing empty messages in the database and displaying
    // blank content in the UI.
    // =========================================================================
    if (!result.message || typeof result.message !== 'string' || !result.message.trim()) {
      console.error(`[AI Outreach] ❌ Empty message returned from n8n for ${affiliate.domain}`);
      
      // =========================================================================
      // REFUND CREDIT ON EMPTY MESSAGE (January 24th, 2026)
      // =========================================================================
      await releaseActiveReservation();
      
      return NextResponse.json(
        { error: 'AI returned an empty message. Please try again.' },
        { status: 500 }
      );
    }

    // =========================================================================
    // STEP 9: CREDIT ALREADY CONSUMED (Updated January 24th, 2026)
    // 
    // NOTE: Credit consumption was MOVED to STEP 4 (before n8n call) to fix
    // the TOCTOU race condition. See STEP 4 comments for details.
    // 
    // At this point:
    // - Credit was already consumed in STEP 4
    // - If we reached here, generation was successful
    // - No refund needed
    // =========================================================================
    console.log(`[AI Outreach] ✅ Generation successful, credit was consumed in STEP 4`);

    // =========================================================================
    // STEP 9.5: SAVE GENERATED MESSAGE TO DATABASE (Updated January 22, 2026)
    // 
    // Persist the AI-generated email to the database so it survives page
    // refreshes. This prevents users from losing their generated emails and
    // having to regenerate (consuming more credits).
    //
    // MULTI-CONTACT SUPPORT (December 25, 2025):
    // Messages are now stored in a JSONB column `ai_generated_messages` keyed
    // by contact email. This allows storing multiple messages per affiliate
    // when Lusha returns multiple contacts.
    //
    // Structure: { "email@example.com": { message, subject, generatedAt } }
    //
    // We also keep updating the legacy `ai_generated_message` field with the
    // most recent message for backwards compatibility.
    //
    // BUG FIX (January 22, 2026): Fixed race condition where concurrent 
    // email generations for the same affiliate would overwrite each other.
    // Now using jsonb_set with FOR UPDATE lock to ensure atomic merge.
    // =========================================================================
    try {
      // Build the message entry for this contact
      const messageEntry: Record<string, unknown> = {
        message: result.message,
        subject: result.subject || null,
        generatedAt: new Date().toISOString(),
      };
      if (result.channels) {
        messageEntry.channels = result.channels;
      }
      
      // The email key to store under (use contactEmail or fallback to 'primary')
      const emailKey = contactEmail || 'primary';
      
      // =====================================================================
      // JSONB UPDATE - CRITICAL IMPLEMENTATION NOTES
      // =====================================================================
      // 
      // This supports UNLIMITED emails per affiliate. Each email address is
      // stored as a key in the JSONB object:
      //   { "email1@test.com": {...}, "email2@test.com": {...}, ... }
      //
      // IMPORTANT - USE sql.json() NOT JSON.stringify():
      // ------------------------------------------------
      // The postgres package (porsager/postgres) has its own JSON handling.
      // - WRONG: ${JSON.stringify(messageEntry)}::jsonb  → DOUBLE-ENCODES!
      // - RIGHT: ${sql.json(messageEntry)}               → Correct encoding
      //
      // Double-encoding causes data like: {"email": "{\"message\":\"...\"}"} 
      // instead of:                       {"email": {"message": "..."}}
      //
      // IMPORTANT - USE jsonb_set() NOT || OPERATOR:
      // ---------------------------------------------
      // - jsonb_set() atomically updates a specific key without affecting others
      // - The || operator merges objects but can cause overwrites in concurrent updates
      //
      // IMPORTANT - ARRAY SYNTAX FOR postgres PACKAGE:
      // ----------------------------------------------
      // - WRONG: ARRAY[${emailKey}] or ${'{' + emailKey + '}'}::text[]
      // - RIGHT: ${[emailKey]}::text[]  (pass JS array directly)
      // =====================================================================
      const savedMessages = await sql`
        UPDATE crewcast.saved_affiliates
        SET 
          ai_generated_message = ${result.message},
          ai_generated_subject = ${result.subject || null},
          ai_generated_at = NOW(),
          ai_generated_messages = jsonb_set(
            COALESCE(ai_generated_messages, '{}'::jsonb),
            ${[emailKey]}::text[],
            ${sql.json(messageEntry)},
            true
          )
        WHERE id = ${affiliate.id}
          AND user_id = ${userId}
          AND brand_id = ${context.brandId}::bigint
          AND brand_location_id = ${context.brandLocationId}::bigint
          AND ai_generation_started_at = ${activeReservation.lease.startedAt}::timestamptz
          AND (ai_generated_at IS NULL OR ai_generated_at < ai_generation_started_at)
        RETURNING id
      `;
      if (savedMessages.length !== 1) {
        throw new Error('The outreach generation lease was lost before the message was saved.');
      }
      activeReservation = null;
      console.log(`[AI Outreach] 💾 Saved message for affiliate ${affiliate.id}, contact: ${emailKey}`);
    } catch (saveError) {
      // Log but don't fail - the message was generated successfully
      // User can still see it in the current session
      console.error(`[AI Outreach] ⚠️ Failed to save message to database:`, saveError);
    }

    // =========================================================================
    // STEP 10: RETURN SUCCESS RESPONSE
    // =========================================================================
    const elapsed = Date.now() - startTime;
    console.log(`[AI Outreach] ✅ Generated email in ${elapsed}ms for ${affiliate.domain}`);

    // Include contactEmail in response so frontend knows which contact's message was generated
    return NextResponse.json({
      success: true,
      message: result.message,
      subject: result.subject || null,
      channels: result.channels || null,
      affiliateId: affiliate.id,
      contactEmail: contactEmail || null,
    });

  } catch (error: unknown) {
    const requestError = affiliateRequestErrorResponse(error);
    if (requestError) {
      return NextResponse.json(requestError.body, { status: requestError.status });
    }
    console.error('[AI Outreach] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // =========================================================================
    // REFUND CREDIT ON UNEXPECTED ERROR (January 24th, 2026)
    // 
    // If we consumed a credit but hit an unexpected error, refund it.
    // The refund identifiers are initialized before parsing so an unexpected
    // failure can be compensated without out-of-scope variables or ts-ignore.
    // =========================================================================
    if (activeReservation) {
      try {
        await releaseActiveReservation();
      } catch (refundError) {
        console.error('[AI Outreach] Failed to release generation credit after error:', refundError);
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to generate email', details: errorMessage },
      { status: 500 }
    );
  }
}

// =============================================================================
// PATCH - Update/Save edited outreach message (January 16, 2026)
// 
// PURPOSE:
// Allows users to edit AI-generated messages and save their changes.
// This is useful when the AI generates a good base email but the user
// wants to make manual tweaks before sending.
//
// Request body:
// - affiliateId: number (required) - The saved_affiliates.id
// - contactEmail: string (required) - The contact's email (key for JSONB)
// - message: string (required) - The edited message text
// - subject: string (optional) - The edited subject line
//
// Returns:
// - success: boolean
// - message: string (the saved message)
// =============================================================================
export async function PATCH(request: NextRequest) {
  try {
    // =========================================================================
    // STEP 2: PARSE REQUEST BODY
    // =========================================================================
    const body = await request.json();
    const {
      affiliateId,
      contactEmail,
      message,
      subject,
      channel,
      channels,
      userId: legacyUserId,
      brandLocationId,
    } = body;

    if (!affiliateId || !message) {
      return NextResponse.json(
        { error: 'affiliateId and message are required' },
        { status: 400 }
      );
    }

    const context = await resolveAffiliateRequestContext({
      legacyAccountId: legacyUserId,
      requestedBrandLocationId: brandLocationId,
    });
    const userId = context.accountId;

    // =========================================================================
    // STEP 4: VERIFY AFFILIATE BELONGS TO USER
    // =========================================================================
    const affiliates = await sql`
      SELECT id FROM crewcast.saved_affiliates 
      WHERE id = ${affiliateId}
        AND user_id = ${userId}
        AND brand_id = ${context.brandId}::bigint
        AND brand_location_id = ${context.brandLocationId}::bigint
    `;

    if (affiliates.length === 0) {
      return NextResponse.json(
        { error: 'Affiliate not found' },
        { status: 404 }
      );
    }

    // =========================================================================
    // STEP 5: UPDATE THE MESSAGE IN DATABASE
    // =========================================================================
    // Updates both the legacy single message field AND the JSONB multi-contact
    // field. Uses the same pattern as POST endpoint.
    // 
    // IMPORTANT: Use sql.json() for proper encoding - see POST endpoint comments.
    // =========================================================================
    const emailKey = contactEmail || 'primary';

    // First, read the existing JSONB entry so we can merge channel edits
    const existing = await sql`
      SELECT ai_generated_messages FROM crewcast.saved_affiliates
      WHERE id = ${affiliateId}
        AND user_id = ${userId}
        AND brand_id = ${context.brandId}::bigint
        AND brand_location_id = ${context.brandLocationId}::bigint
    `;
    const existingMessages = existing[0]?.ai_generated_messages || {};
    const existingEntry = existingMessages[emailKey] || {};
    const existingChannels = existingEntry.channels || {};

    // If a specific channel is being edited, update only that channel
    let updatedChannels = existingChannels;
    if (channel && typeof channel === 'string') {
      updatedChannels = { ...existingChannels, [channel]: { message, ...(subject ? { subject } : {}) } };
    } else if (channels) {
      updatedChannels = channels;
    }

    const messageEntry: Record<string, unknown> = {
      message,
      subject: subject || null,
      generatedAt: new Date().toISOString(),
    };
    if (updatedChannels && Object.keys(updatedChannels).length > 0) {
      messageEntry.channels = updatedChannels;
    }

    await sql`
      UPDATE crewcast.saved_affiliates
      SET 
        ai_generated_message = ${message},
        ai_generated_subject = ${subject || null},
        ai_generated_at = NOW(),
        ai_generated_messages = jsonb_set(
          COALESCE(ai_generated_messages, '{}'::jsonb),
          ${[emailKey]}::text[],
          ${sql.json(messageEntry)},
          true
        )
      WHERE id = ${affiliateId}
        AND user_id = ${userId}
        AND brand_id = ${context.brandId}::bigint
        AND brand_location_id = ${context.brandLocationId}::bigint
    `;

    console.log(`[AI Outreach] ✏️ Saved edited message for affiliate ${affiliateId}, contact: ${emailKey}${channel ? `, channel: ${channel}` : ''}`);

    return NextResponse.json({
      success: true,
      message,
      subject: subject || null,
      channels: updatedChannels && Object.keys(updatedChannels).length > 0 ? updatedChannels : null,
      affiliateId,
      contactEmail: emailKey,
    });

  } catch (error: unknown) {
    const requestError = affiliateRequestErrorResponse(error);
    if (requestError) {
      return NextResponse.json(requestError.body, { status: requestError.status });
    }
    console.error('[AI Outreach] Error saving edited message:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to save message', details: errorMessage },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET - Check webhook configuration status
// =============================================================================

export async function GET() {
  const webhookUrl = process.env.N8N_AI_OUTREACH_WEBHOOK_URL;
  
  return NextResponse.json({
    configured: !!webhookUrl,
    message: webhookUrl 
      ? 'AI outreach webhook is configured' 
      : 'AI outreach webhook is not configured',
  });
}
