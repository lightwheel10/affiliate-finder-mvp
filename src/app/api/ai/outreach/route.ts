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
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { stackServerApp } from '@/stack/server';
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
    const authUser = await stackServerApp.getUser();
    
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
    const { affiliateId, affiliate: affiliateData } = body;

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
      FROM users 
      WHERE email = ${authUser.primaryEmail}
    `;

    if (users.length === 0) {
      console.error(`[AI Outreach] User not found: ${authUser.primaryEmail}`);
      return NextResponse.json(
        { error: 'User account not found. Please complete onboarding.' },
        { status: 404 }
      );
    }

    const user = users[0];
    const userId = user.id as number;

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
        FROM saved_affiliates
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
    // STEP 9.5: SAVE GENERATED MESSAGE TO DATABASE (Added Dec 17, 2025)
    // 
    // Persist the AI-generated email to the database so it survives page
    // refreshes. This prevents users from losing their generated emails and
    // having to regenerate (consuming more credits).
    // =========================================================================
    try {
      await sql`
        UPDATE saved_affiliates
        SET 
          ai_generated_message = ${result.message},
          ai_generated_subject = ${result.subject || null},
          ai_generated_at = NOW()
        WHERE id = ${affiliate.id} AND user_id = ${userId}
      `;
      console.log(`[AI Outreach] 💾 Saved message to database for affiliate ${affiliate.id}`);
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

    return NextResponse.json({
      success: true,
      message: result.message,
      subject: result.subject || null,
      affiliateId: affiliate.id,
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
