/**
 * Email Discovery API
 * 
 * POST /api/enrich/email - Find email for a saved affiliate
 * 
 * This endpoint uses the multi-provider enrichment service to find email
 * addresses. It supports Apollo.io and Lusha, with configurable fallback.
 * 
 * =============================================================================
 * PROVIDER DECISION - 29th December 2025
 * 
 * David decided to use LUSHA as the primary email enrichment provider.
 * Apollo is still available as a fallback but Lusha provides better results
 * including multiple contacts, phone numbers, and job titles.
 * 
 * CREDIT COST: 1 credit per email lookup
 * (Originally planned as 2 credits in Linear, but kept at 1 for simplicity)
 * =============================================================================
 * 
 * The endpoint accepts data from multiple sources (Web, YouTube, Instagram, TikTok)
 * and extracts all relevant information to maximize email discovery chances.
 * 
 * Request body:
 * - affiliateId: number (saved_affiliates.id)
 * - userId: number (for tracking)
 * - domain: string (website domain or social platform domain)
 * - originalDomain?: string (original domain before extraction)
 * - personName?: string (full name from any source)
 * - linkedinUrl?: string (LinkedIn URL if found in bio)
 * - source?: string (Web, YouTube, Instagram, TikTok)
 * - instagramUsername?: string
 * - tiktokUsername?: string
 * - channelName?: string (YouTube channel name)
 * - channelLink?: string (YouTube channel URL)
 * - provider?: 'apollo' | 'lusha' (optional, force specific provider)
 * 
 * Returns:
 * - email: string | null
 * - emails?: string[] (all emails found, Lusha only)
 * - status: 'found' | 'not_found' | 'error'
 * - provider: 'apollo' | 'lusha'
 * - firstName?: string
 * - lastName?: string
 * - title?: string
 * 
 * @module api/enrich/email
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { 
  enrichmentService, 
  EnrichmentProviderName,
  EnrichmentRequest 
} from '@/app/services/enrichment/index';
// =============================================================================
// January 17th, 2026: Added ApiService type import
// 
// FIX for TypeScript errors TS2322 and TS7053:
// - serviceName was typed as 'string' but trackApiCall expects ApiService type
// - API_COSTS couldn't be indexed with 'string', needs specific key type
// 
// ApiService is defined as: keyof typeof API_COSTS
// This ensures type safety when tracking API calls.
// =============================================================================
import { trackApiCall, API_COSTS, ApiService } from '@/app/services/tracking';
import { checkCredits, consumeCredits, refundCredits } from '@/lib/credits';
import {
  affiliateRequestErrorResponse,
  resolveAffiliateRequestContext,
} from '@/lib/affiliates/server';

// Check if credit enforcement is enabled
function isCreditEnforcementEnabled(): boolean {
  const flag = process.env.ENFORCE_CREDITS;
  if (!flag) return false;
  return flag.toLowerCase() === 'true' || flag === '1';
}

/**
 * Helper to extract a clean domain from various URL formats
 */
function cleanDomain(domain: string): string {
  return domain
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .split('?')[0]
    .toLowerCase()
    .trim();
}

/**
 * Helper to check if domain is a social media platform
 */
function isSocialPlatformDomain(domain: string): boolean {
  const socialPlatforms = [
    'youtube.com', 'youtu.be',
    'instagram.com',
    'tiktok.com',
    'twitter.com', 'x.com',
    'facebook.com', 'fb.com',
    'linkedin.com'
  ];
  const cleanedDomain = cleanDomain(domain);
  return socialPlatforms.some(platform => cleanedDomain.includes(platform));
}

/**
 * Helper to parse a full name into first and last name
 */
function parseName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  const firstName = parts[0] || '';
  const lastName = parts.slice(1).join(' ') || '';
  return { firstName, lastName };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // 2026-08-04 (Paras): hoisted out of the try block so the catch handler can
  // refund a reserved credit if the lookup throws mid-flight. See the
  // "RESERVE CREDIT BEFORE THE PAID LOOKUP" block below for the full why.
  let creditConsumed = false;
  let refundUserId: number | null = null;
  let refundAffiliateId = 'unknown';

  try {
    const body = await request.json();
    const { 
      affiliateId, 
      userId: legacyUserId,
      brandLocationId,
      domain,
      originalDomain,
      personName,
      linkedinUrl,
      source,
      instagramUsername,
      tiktokUsername,
      channelName,
      channelLink,
      provider: forcedProvider 
    } = body;

    // ==========================================================================
    // VALIDATION
    // ==========================================================================
    
    if (!affiliateId || !domain) {
      return NextResponse.json(
        { error: 'affiliateId and domain are required' },
        { status: 400 }
      );
    }

    const context = await resolveAffiliateRequestContext({
      legacyAccountId: legacyUserId,
      requestedBrandLocationId: brandLocationId,
    });
    const userId = context.accountId;
    const targetLanguage = context.location.languageCode;

    // Prove ownership before reserving a credit or calling a paid provider.
    const ownedAffiliates = await sql`
      SELECT id
      FROM crewcast.saved_affiliates
      WHERE id = ${affiliateId}
        AND user_id = ${userId}
        AND brand_id = ${context.brandId}::bigint
        AND brand_location_id = ${context.brandLocationId}::bigint
      LIMIT 1
    `;
    if (ownedAffiliates.length !== 1) {
      return NextResponse.json({ error: 'Affiliate not found' }, { status: 404 });
    }

    // 2026-08-04 (Paras): captured for the catch-block refund (see above).
    refundUserId = userId;
    refundAffiliateId = String(affiliateId);

    // ==========================================================================
    // CREDIT CHECK (December 2025)
    // Verify user has email credits before proceeding
    // ==========================================================================
    const enforceCredits = isCreditEnforcementEnabled();
    
    if (enforceCredits) {
      const creditCheck = await checkCredits(userId, 'email', 1);
      
      if (!creditCheck.allowed) {
        console.log(`[Email Enrich] Credit check failed for user ${userId}: ${creditCheck.message}`);
        return NextResponse.json({ 
          error: creditCheck.message || 'Insufficient email credits',
          creditError: true,
          remaining: creditCheck.remaining,
          isReadOnly: creditCheck.isReadOnly,
        }, { status: 402 }); // Payment Required
      }
      
      console.log(`[Email Enrich] Credit check passed for user ${userId}. Remaining: ${creditCheck.remaining}`);
    }

    // Validate forced provider if specified
    // January 16, 2026: Added website_scraper as valid provider
    if (forcedProvider && !['apollo', 'lusha', 'website_scraper'].includes(forcedProvider)) {
      return NextResponse.json(
        { error: 'Invalid provider. Must be "apollo", "lusha", or "website_scraper"' },
        { status: 400 }
      );
    }

    // ==========================================================================
    // CHECK PROVIDER AVAILABILITY
    // ==========================================================================
    
    const availableProviders = enrichmentService.getAvailableProviders();
    
    if (availableProviders.length === 0) {
      return NextResponse.json(
        { error: 'No email enrichment providers are configured' },
        { status: 503 }
      );
    }

    // If a specific provider is forced, check if it's available
    if (forcedProvider && !availableProviders.includes(forcedProvider)) {
      return NextResponse.json(
        { error: `Provider '${forcedProvider}' is not available. Available: ${availableProviders.join(', ')}` },
        { status: 400 }
      );
    }

    // ==========================================================================
    // RESERVE CREDIT BEFORE THE PAID LOOKUP (2026-08-04, Paras)
    //
    // WHY: This route used to only CHECK credits (above) and consume them at
    // the very end, after the paid Apollo/Lusha lookup — and only when an
    // email was found. That gap meant N parallel requests could each pass the
    // check and each trigger a paid lookup while only 1 credit existed; when
    // the late consume then failed, the email was still saved and returned
    // anyway. Security audit finding H3 (SECURITY_AUDIT.md).
    //
    // HOW: consumeCredits() is atomic as of PR #78 (availability check inside
    // the UPDATE's WHERE clause), so this reservation is the real enforcement
    // point: reserve 1 email credit NOW, run the lookup, refund if no email
    // is found (or on error/exception — see the refund blocks below). Same
    // reserve-then-refund pattern as /api/ai/outreach. The checkCredits()
    // call above stays purely for a friendly early 402.
    //
    // Placed after all cheap validations so an invalid request can't consume,
    // and before the email_status='searching' UPDATE so a rejected request
    // doesn't leave the affiliate stuck in 'searching'.
    // ==========================================================================
    if (enforceCredits) {
      const reserveResult = await consumeCredits(userId, 'email', 1, affiliateId.toString(), 'affiliate');
      if (!reserveResult.success) {
        return NextResponse.json({
          error: 'Unable to reserve email credit. Please try again.',
          creditError: true,
          remaining: 0,
        }, { status: 402 });
      }
      creditConsumed = true;
      console.log(`💳 [Email Enrich] Reserved 1 email credit for user ${userId}. Balance: ${reserveResult.newBalance}`);
    }

    // ==========================================================================
    // UPDATE STATUS TO SEARCHING
    // ==========================================================================

    await sql`
      UPDATE crewcast.saved_affiliates 
      SET email_status = 'searching'
      WHERE id = ${affiliateId}
        AND user_id = ${userId}
        AND brand_id = ${context.brandId}::bigint
        AND brand_location_id = ${context.brandLocationId}::bigint
    `;

    // ==========================================================================
    // BUILD ENRICHMENT REQUEST WITH ALL AVAILABLE DATA
    // ==========================================================================
    
    // Clean and validate domain
    const searchDomain = cleanDomain(domain);
    const isFromSocialPlatform = isSocialPlatformDomain(searchDomain);
    
    // Log what we're working with
    console.log(`📧 [API] Email search request:`, {
      source,
      domain: searchDomain,
      originalDomain,
      personName,
      linkedinUrl,
      instagramUsername,
      tiktokUsername,
      channelName,
      isFromSocialPlatform,
    });

    // ==========================================================================
    // DETERMINE BEST SEARCH PARAMETERS BASED ON SOURCE
    // ==========================================================================
    
    let firstName: string | undefined;
    let lastName: string | undefined;
    let effectivePersonName = personName;
    
    // Parse person name if available
    if (personName) {
      const parsed = parseName(personName);
      firstName = parsed.firstName;
      lastName = parsed.lastName;
    }
    
    // For social media sources, we need special handling
    if (isFromSocialPlatform) {
      console.log(`📧 [API] Detected social platform source: ${source}`);
      
      // If we don't have a good domain, we might need to search differently
      // For now, we'll still try with the person's name
      
      // For Instagram/TikTok, the username might be useful
      // Some enrichment services can search by social handles
      if (!effectivePersonName) {
        // Use channel name or social username as fallback
        effectivePersonName = channelName || instagramUsername || tiktokUsername;
        if (effectivePersonName) {
          const parsed = parseName(effectivePersonName);
          firstName = parsed.firstName;
          lastName = parsed.lastName;
        }
      }
    }
    
    // Build the enrichment request
    // January 16, 2026: Added targetLanguage for website scraper path prioritization
    const enrichmentRequest: EnrichmentRequest = {
      domain: searchDomain,
      personName: effectivePersonName,
      firstName,
      lastName,
      linkedinUrl,
      targetLanguage: targetLanguage || undefined,
    };
    
    console.log(`📧 [API] Enrichment request:`, enrichmentRequest);

    // ==========================================================================
    // CALL ENRICHMENT SERVICE
    // ==========================================================================
    
    let result;
    
    if (forcedProvider) {
      // Use specific provider
      result = await enrichmentService.findEmailWithProvider(
        forcedProvider as EnrichmentProviderName,
        enrichmentRequest
      );
    } else {
      // Use configured strategy (primary + fallback)
      result = await enrichmentService.findEmail(enrichmentRequest);
    }

    // ==========================================================================
    // TRACK API CALL
    // 
    // Updated January 16, 2026: Added website_scraper provider tracking
    // The website scraper has $0 cost since it's just HTTP requests
    // 
    // January 17th, 2026 FIX: Changed serviceName type from 'string' to 'ApiService'
    // 
    // PREVIOUS BUG:
    // - serviceName was typed as 'string'
    // - trackApiCall expected ApiService (specific union type)
    // - API_COSTS[serviceName] failed because string can't index the object
    // 
    // FIX:
    // - Now using ApiService type which is: keyof typeof API_COSTS
    // - This ensures type safety and proper indexing of API_COSTS
    // ==========================================================================
    
    // Determine the service name for tracking
    // Using ApiService type for type safety (not plain string)
    let serviceName: ApiService;
    let endpoint: string;
    
    switch (result.provider) {
      case 'lusha':
        serviceName = 'lusha_email';
        endpoint = 'v2/person';
        break;
      case 'website_scraper':
        serviceName = 'website_scraper';
        endpoint = 'scrape';
        break;
      default:
        serviceName = 'apollo_email';
        endpoint = 'mixed_people/search';
    }
    
    await trackApiCall({
      userId,
      service: serviceName,
      endpoint,
      domain: searchDomain,
      status: result.error ? 'error' : 'success',
      resultsCount: result.found ? 1 : 0,
      errorMessage: result.error,
      estimatedCost: result.costEstimate || API_COSTS[serviceName],
      durationMs: Date.now() - startTime,
      brandId: context.brandId,
      brandLocationId: context.brandLocationId,
    });

    // ==========================================================================
    // DETERMINE FINAL STATUS
    // ==========================================================================
    
    let emailStatus: 'found' | 'not_found' | 'error';
    if (result.error) {
      emailStatus = 'error';
    } else if (result.found && result.email) {
      emailStatus = 'found';
    } else {
      emailStatus = 'not_found';
    }

    // ==========================================================================
    // UPDATE DATABASE WITH RESULTS
    // 
    // CRITICAL FIX (Dec 2025): Save full email_results JSON, not just primary email
    // 
    // Previously, only `result.email` (single string) was saved. Lusha can return
    // 1-50 emails across multiple contacts, plus phone numbers, job titles, etc.
    // All this rich data was lost on page refresh because it only existed in
    // React state (via the API response).
    //
    // Now we save the complete enrichment response to `email_results` JSONB column.
    // This ensures:
    // - All emails persist (not just the first one)
    // - Contact details persist (firstName, lastName, title, LinkedIn)
    // - Phone numbers persist (Lusha provides these)
    // - Users see full data even after page refresh
    //
    // The `email` column still stores the primary email for quick access/queries.
    // ==========================================================================
    
    // Build email_results object with all enrichment data
    const emailResultsData = result.found ? {
      emails: result.emails || (result.email ? [result.email] : []),
      contacts: result.contacts || [],
      firstName: result.firstName,
      lastName: result.lastName,
      title: result.title,
      linkedinUrl: result.linkedinUrl,
      phoneNumbers: result.phoneNumbers,
      provider: result.provider,
    } : null;
    
    await sql`
      UPDATE crewcast.saved_affiliates 
      SET 
        email = ${result.email || null},
        email_status = ${emailStatus},
        email_searched_at = NOW(),
        email_provider = ${result.provider},
        email_results = ${emailResultsData ? JSON.stringify(emailResultsData) : null}
      WHERE id = ${affiliateId}
        AND user_id = ${userId}
        AND brand_id = ${context.brandId}::bigint
        AND brand_location_id = ${context.brandLocationId}::bigint
    `;

    // ==========================================================================
    // REFUND RESERVED CREDIT IF NO EMAIL FOUND (2026-08-04, Paras)
    //
    // The credit was already reserved BEFORE the paid lookup (replaces the
    // old post-lookup consume that lived here since December 2025). Users
    // only pay for found emails, so refund on 'not_found' / 'error'.
    //
    // NOTE: refundCredits() restores to the subscription pool even if the
    // reserve drew from topup — pre-existing behavior shared with
    // /api/ai/outreach (audit finding L2, accepted for now).
    // ==========================================================================
    if (creditConsumed && emailStatus !== 'found') {
      const refundResult = await refundCredits(userId, 'email', 1, affiliateId.toString(), 'enrich_not_found');
      if (refundResult.success) {
        console.log(`↩️ [Email Enrich] Refunded 1 email credit for user ${userId} (status: ${emailStatus})`);
      } else {
        console.error(`❌ [Email Enrich] Failed to refund credit for user ${userId} (status: ${emailStatus})`);
      }
    }

    // ==========================================================================
    // RETURN RESPONSE
    // ==========================================================================
    
    return NextResponse.json({
      email: result.email,
      emails: result.emails,  // All emails (Lusha can return multiple)
      contacts: result.contacts,  // All contacts with full details
      status: emailStatus,
      provider: result.provider,
      firstName: result.firstName,
      lastName: result.lastName,
      title: result.title,
      linkedinUrl: result.linkedinUrl,
      phoneNumbers: result.phoneNumbers,  // Phone numbers (Lusha only)
    });

  } catch (error: unknown) {
    const requestError = affiliateRequestErrorResponse(error);
    if (requestError) {
      return NextResponse.json(requestError.body, { status: requestError.status });
    }
    console.error('Email enrichment error:', error);

    // 2026-08-04 (Paras): if the lookup threw AFTER the reserve-first block
    // consumed a credit, give it back — the user got no result.
    if (creditConsumed && refundUserId !== null) {
      try {
        const refundResult = await refundCredits(refundUserId, 'email', 1, refundAffiliateId, 'enrich_error');
        if (refundResult.success) {
          console.log(`↩️ [Email Enrich] Refunded 1 email credit for user ${refundUserId} after error`);
        }
      } catch (refundError) {
        console.error('❌ [Email Enrich] Failed to refund credit after error:', refundError);
      }
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to find email', details: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * GET /api/enrich/email - Get available providers and configuration
 * 
 * Returns information about which enrichment providers are available
 * and the current configuration.
 */
export async function GET() {
  const availableProviders = enrichmentService.getAvailableProviders();
  const estimatedCost = enrichmentService.getEstimatedCost();
  
  return NextResponse.json({
    providers: availableProviders,
    estimatedCost,
    config: {
      hasApollo: availableProviders.includes('apollo'),
      hasLusha: availableProviders.includes('lusha'),
    },
  });
}
