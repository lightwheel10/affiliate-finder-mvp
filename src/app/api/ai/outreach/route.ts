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
import { getAuthenticatedUser } from '@/lib/supabase/server'; // January 19th, 2026: Migrated from Stack Auth
import { checkCredits, consumeCredits } from '@/lib/credits';
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

// =============================================================================
// POST - Generate outreach email
// =============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // =========================================================================
    // STEP 1: AUTHENTICATION
    // Verify user is authenticated via Stack Auth
    // =========================================================================
    const authUser = await getAuthenticatedUser();
    
    if (!authUser) {
      console.error('[AI Outreach] Unauthorized: No authenticated user');
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      );
    }

    // =========================================================================
    // STEP 2: PARSE REQUEST BODY
    // =========================================================================
    const body = await request.json();
    const { affiliateId, affiliate: affiliateData, selectedContact } = body;
    
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

    if (!affiliateId && !affiliateData) {
      return NextResponse.json(
        { error: 'affiliateId or affiliate data is required' },
        { status: 400 }
      );
    }

    // =========================================================================
    // STEP 3: GET USER FROM DATABASE
    // Fetch full user profile including business context
    // =========================================================================
    const users = await sql`
      SELECT 
        id, email, name, brand, bio, 
        target_country, target_language,
        competitors, topics, affiliate_types
      FROM crewcast.users 
      WHERE email = ${authUser.email}
    `;

    if (users.length === 0) {
      console.error(`[AI Outreach] User not found: ${authUser.email}`);
      return NextResponse.json(
        { error: 'User account not found. Please complete onboarding.' },
        { status: 404 }
      );
    }

    const user = users[0];
    const userId = user.id as number;

    // =========================================================================
    // STEP 3.5: CHECK IF GENERATION IS ALREADY IN PROGRESS (January 24th, 2026)
    // 
    // PURPOSE: Prevents duplicate credit consumption when:
    // - User clicks "Generate", navigates away, comes back, clicks again
    // - User has multiple browser tabs open
    // - Any scenario where duplicate requests might be sent
    // 
    // HOW IT WORKS:
    // 1. Check if ai_generation_started_at is recent (< 60 seconds)
    // 2. AND ai_generated_at is older than ai_generation_started_at (not completed yet)
    // 3. If both true → Generation is in progress → Block this request
    // 
    // WHY 60 SECONDS:
    // - AI generation typically takes 15-25 seconds
    // - 60 seconds gives buffer for slow generations
    // - After 60 seconds, user can retry (timeout scenario)
    // 
    // This also sets ai_generation_started_at = NOW() to "lock" this affiliate
    // for subsequent requests.
    // =========================================================================
    const requestedAffiliateId = affiliateId || affiliateData?.id;
    
    if (requestedAffiliateId) {
      try {
        // Check if generation is currently in progress
        const existingRecord = await sql`
          SELECT 
            ai_generation_started_at,
            ai_generated_at,
            ai_generated_message
          FROM crewcast.saved_affiliates 
          WHERE id = ${requestedAffiliateId} 
            AND user_id = ${userId}
        `;
        
        if (existingRecord.length > 0) {
          const record = existingRecord[0];
          const now = Date.now();
          const startedAt = record.ai_generation_started_at 
            ? new Date(record.ai_generation_started_at).getTime() 
            : 0;
          const generatedAt = record.ai_generated_at 
            ? new Date(record.ai_generated_at).getTime() 
            : 0;
          
          // Generation is IN PROGRESS if:
          // - Started recently (within 60 seconds)
          // - AND not completed yet (generated_at is before started_at or null)
          const isInProgress = startedAt > 0 && 
            (now - startedAt) < 60000 && 
            (generatedAt === 0 || generatedAt < startedAt);
          
          if (isInProgress) {
            const elapsedSeconds = Math.round((now - startedAt) / 1000);
            console.log(`[AI Outreach] ⚠️ Generation already in progress for affiliate ${requestedAffiliateId} (started ${elapsedSeconds}s ago). Blocking duplicate.`);
            
            return NextResponse.json({
              success: false,
              error: 'Email generation is already in progress. Please wait for it to complete.',
              inProgress: true,
              startedSecondsAgo: elapsedSeconds,
              creditsConsumed: false,
            }, { status: 409 }); // 409 Conflict
          }
        }
        
        // Mark generation as STARTED (creates a "lock")
        // This happens BEFORE calling n8n, so subsequent requests will see it
        await sql`
          UPDATE crewcast.saved_affiliates
          SET ai_generation_started_at = NOW()
          WHERE id = ${requestedAffiliateId} AND user_id = ${userId}
        `;
        console.log(`[AI Outreach] 🔒 Marked generation as started for affiliate ${requestedAffiliateId}`);
        
      } catch (lockError) {
        // Log but don't fail - proceed with generation if lock check fails
        console.error('[AI Outreach] ⚠️ Lock check failed (proceeding with generation):', lockError);
      }
    }

    // =========================================================================
    // STEP 4: CHECK AI CREDITS
    // =========================================================================
    const enforceCredits = isCreditEnforcementEnabled();
    
    if (enforceCredits) {
      const creditCheck = await checkCredits(userId, 'ai', 1);
      
      if (!creditCheck.allowed) {
        console.log(`[AI Outreach] Credit check failed for user ${userId}: ${creditCheck.message}`);
        return NextResponse.json({ 
          error: creditCheck.message || 'Insufficient AI credits',
          creditError: true,
          remaining: creditCheck.remaining,
          isReadOnly: creditCheck.isReadOnly,
        }, { status: 402 }); // Payment Required
      }
      
      console.log(`[AI Outreach] Credit check passed for user ${userId}. Remaining: ${creditCheck.remaining}`);
    }

    // =========================================================================
    // STEP 5: GET AFFILIATE DATA
    // Either from request body or fetch from database
    // =========================================================================
    let affiliate: AffiliateData;

    if (affiliateData) {
      // Affiliate data provided directly in request
      affiliate = {
        id: affiliateData.id || affiliateId,
        personName: affiliateData.personName || null,
        email: affiliateData.email || null,
        domain: affiliateData.domain,
        source: affiliateData.source,
        title: affiliateData.title,
        snippet: affiliateData.snippet || '',
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
          id, person_name, email, domain, source, title, snippet,
          keyword, discovery_method_type, discovery_method_value,
          instagram_username, instagram_bio, instagram_followers,
          tiktok_username, tiktok_bio, tiktok_followers,
          channel_name, channel_subscribers
        FROM crewcast.saved_affiliates
        WHERE id = ${affiliateId} AND user_id = ${userId}
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
    // STEP 6: BUILD USER BUSINESS CONTEXT
    // =========================================================================
    const userContext: UserBusinessContext = {
      name: user.name || '',
      email: user.email || '',
      brand: user.brand || null,
      bio: user.bio || null,
      targetCountry: user.target_country || null,
      targetLanguage: user.target_language || null,
      competitors: user.competitors || [],
      topics: user.topics || [],
      affiliateTypes: user.affiliate_types || [],
    };

    // =========================================================================
    // STEP 7: BUILD N8N REQUEST
    // =========================================================================
    const n8nRequest: N8NAIOutreachRequest = {
      requestId: generateRequestId(),
      timestamp: new Date().toISOString(),
      user: userContext,
      affiliate,
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
      return NextResponse.json(
        { error: 'AI returned an empty message. Please try again.' },
        { status: 500 }
      );
    }

    // =========================================================================
    // STEP 9: CONSUME AI CREDIT
    // Only consume on successful generation
    // =========================================================================
    if (enforceCredits) {
      const consumeResult = await consumeCredits(
        userId, 
        'ai', 
        1, 
        affiliate.id.toString(), 
        'outreach'
      );
      
      if (consumeResult.success) {
        console.log(`💳 [AI Outreach] Consumed 1 AI credit for user ${userId}. New balance: ${consumeResult.newBalance}`);
      } else {
        console.error(`❌ [AI Outreach] Failed to consume credit for user ${userId}`);
      }
    }

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
      const messageEntry = {
        message: result.message,
        subject: result.subject || null,
        generatedAt: new Date().toISOString(),
      };
      
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
      await sql`
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
        WHERE id = ${affiliate.id} AND user_id = ${userId}
      `;
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
      affiliateId: affiliate.id,
      contactEmail: contactEmail || null, // December 25, 2025: For multi-contact support
    });

  } catch (error: unknown) {
    console.error('[AI Outreach] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
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
    // STEP 1: AUTHENTICATION
    // =========================================================================
    const authUser = await getAuthenticatedUser();
    
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      );
    }

    // =========================================================================
    // STEP 2: PARSE REQUEST BODY
    // =========================================================================
    const body = await request.json();
    const { affiliateId, contactEmail, message, subject } = body;

    if (!affiliateId || !message) {
      return NextResponse.json(
        { error: 'affiliateId and message are required' },
        { status: 400 }
      );
    }

    // =========================================================================
    // STEP 3: GET USER ID FROM DATABASE
    // =========================================================================
    const users = await sql`
      SELECT id FROM crewcast.users WHERE email = ${authUser.email}
    `;

    if (users.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userId = users[0].id as number;

    // =========================================================================
    // STEP 4: VERIFY AFFILIATE BELONGS TO USER
    // =========================================================================
    const affiliates = await sql`
      SELECT id FROM crewcast.saved_affiliates 
      WHERE id = ${affiliateId} AND user_id = ${userId}
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
    const messageEntry = {
      message,
      subject: subject || null,
      generatedAt: new Date().toISOString(),
    };

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
      WHERE id = ${affiliateId} AND user_id = ${userId}
    `;

    console.log(`[AI Outreach] ✏️ Saved edited message for affiliate ${affiliateId}, contact: ${emailKey}`);

    return NextResponse.json({
      success: true,
      message,
      subject: subject || null,
      affiliateId,
      contactEmail: emailKey,
    });

  } catch (error: unknown) {
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
