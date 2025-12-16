/**
 * Email Discovery API
 * 
 * POST /api/enrich/email - Find email for a saved affiliate
 * 
 * This endpoint uses the multi-provider enrichment service to find email
 * addresses. It supports Apollo.io and Lusha, with configurable fallback.
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
import { trackApiCall, API_COSTS } from '@/app/services/tracking';
import { stackServerApp } from '@/stack/server';
import { checkCredits, consumeCredits } from '@/lib/credits';

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
  
  try {
    // ==========================================================================
    // AUTHENTICATION CHECK (December 2025)
    // Verify user is authenticated via Stack Auth
    // ==========================================================================
    const authUser = await stackServerApp.getUser();
    
    if (!authUser) {
      console.error('[Email Enrich] Unauthorized: No authenticated user');
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { 
      affiliateId, 
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

    // ==========================================================================
    // GET USER FROM DATABASE (December 2025)
    // Use authenticated email to get userId - never trust client-provided userId
    // ==========================================================================
    const users = await sql`
      SELECT id FROM users WHERE email = ${authUser.primaryEmail}
    `;

    if (users.length === 0) {
      console.error(`[Email Enrich] User not found in database: ${authUser.primaryEmail}`);
      return NextResponse.json(
        { error: 'User account not found. Please complete onboarding.' },
        { status: 404 }
      );
    }

    const userId = users[0].id as number;

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
    if (forcedProvider && !['apollo', 'lusha'].includes(forcedProvider)) {
      return NextResponse.json(
        { error: 'Invalid provider. Must be "apollo" or "lusha"' },
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
    // UPDATE STATUS TO SEARCHING
    // ==========================================================================

    await sql`
      UPDATE saved_affiliates 
      SET email_status = 'searching'
      WHERE id = ${affiliateId} AND user_id = ${userId}
    `;

    // ==========================================================================
    // BUILD ENRICHMENT REQUEST WITH ALL AVAILABLE DATA
    // ==========================================================================
    
    // Clean and validate domain
    let searchDomain = cleanDomain(domain);
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
    const enrichmentRequest: EnrichmentRequest = {
      domain: searchDomain,
      personName: effectivePersonName,
      firstName,
      lastName,
      linkedinUrl,
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
    // ==========================================================================
    
    // Determine the service name for tracking
    const serviceName = result.provider === 'lusha' ? 'lusha_email' : 'apollo_email';
    const endpoint = result.provider === 'lusha' ? 'v2/person' : 'mixed_people/search';
    
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
      UPDATE saved_affiliates 
      SET 
        email = ${result.email || null},
        email_status = ${emailStatus},
        email_searched_at = NOW(),
        email_provider = ${result.provider},
        email_results = ${emailResultsData ? JSON.stringify(emailResultsData) : null}
      WHERE id = ${affiliateId} AND user_id = ${userId}
    `;

    // ==========================================================================
    // CONSUME CREDIT (December 2025)
    // Deduct 1 email credit after successful lookup
    // Only consume if enforcement is enabled AND email was found
    // ==========================================================================
    if (enforceCredits && emailStatus === 'found') {
      const consumeResult = await consumeCredits(
        userId, 
        'email', 
        1, 
        affiliateId.toString(), 
        'affiliate'
      );
      if (consumeResult.success) {
        console.log(`💳 [Email Enrich] Consumed 1 email credit for user ${userId}. New balance: ${consumeResult.newBalance}`);
      } else {
        console.error(`❌ [Email Enrich] Failed to consume credit for user ${userId}`);
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
    console.error('Email enrichment error:', error);
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
