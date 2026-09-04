/**
 * Search Start API - Initiates async Apify Google Search Scraper run
 * 
 * =============================================================================
 * Created: January 29, 2026
 * 
 * PURPOSE:
 * Starts a non-blocking Apify google-search-scraper run and returns immediately
 * with a jobId. The search runs in the background for 40-95 seconds.
 * 
 * FLOW:
 * 1. Resolve the authenticated application account
 * 2. Resolve and snapshot an active owned brand location
 * 3. Atomically reserve one account-level topic-search credit by request UUID
 * 4. Start Apify and atomically revalidate + persist the attributed job
 * 5. Abort Apify and release the reservation if persistence fails
 * 6. Return { jobId, status: 'started', runId }
 * 
 * POLLING:
 * Client should poll /api/search/status?jobId=X every 3-5 seconds until done.
 * 
 * CREDITS:
 * A durable credit reservation is created before paid provider work. The status
 * finalizer consumes it once for non-empty results or releases it on failure /
 * zero results. Onboarding remains free and does not create a reservation.
 * =============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveAuthenticatedAccount } from '@/lib/auth/account';
import { BrandLocationContextError } from '@/lib/brand-locations/context';
import { trackApiCall } from '@/app/services/tracking';
import { startSearchInputSchema } from '@/lib/search/input';
import {
  SearchStartError,
} from '@/lib/search/start';
import { completeServerSearchStart } from '@/lib/search/start-server';

// =============================================================================
// VERCEL FUNCTION CONFIGURATION
// January 29, 2026
// 
// This endpoint is fast (just starts the run), so we don't need long timeout.
// =============================================================================
export const maxDuration = 30; // 30 seconds is plenty

// =============================================================================
// REQUEST/RESPONSE TYPES
// January 29, 2026
// February 4, 2026: Added keywords[] for multi-keyword batching (1 credit per session)
// =============================================================================

interface StartSearchResponse {
  jobId: number;
  status: 'started';
  message: string;
}

interface ErrorResponse {
  error: string;
  code?: string;
}

// =============================================================================
// POST /api/search/start
// January 29, 2026
// =============================================================================

export async function POST(req: NextRequest): Promise<NextResponse<StartSearchResponse | ErrorResponse>> {
  const startTime = Date.now();
  
  try {
    let requestBody: unknown;
    try {
      requestBody = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Request body must be valid JSON', code: 'INVALID_JSON' },
        { status: 400 },
      );
    }

    const parsedInput = startSearchInputSchema.safeParse(requestBody);
    if (!parsedInput.success) {
      return NextResponse.json(
        { error: 'Invalid search input', code: 'INVALID_SEARCH_INPUT' },
        { status: 400 },
      );
    }

    const {
      keyword,
      keywords,
      sources,
      competitors,
      brandLocationId,
      requestId,
    } = parsedInput.data;
    const competitorList = competitors ?? [];

    // February 4, 2026: Support both single keyword and keywords array
    // Prefer keywords[] for multi-keyword batch (1 credit per session)
    const keywordList: string[] = keywords && keywords.length > 0
      ? keywords
      : keyword ? [keyword.trim()] : [];
    const filteredSources = sources;
    
    // February 4, 2026: Log all keywords in batch
    const combinedKeyword = keywordList.join(' | ');
    console.log(`🔍 [Search/Start] Keywords: "${combinedKeyword}", Sources: ${filteredSources.join(', ')}`);
    
    // ==========================================================================
    // AUTHENTICATION CHECK
    // January 29, 2026
    // ==========================================================================
    const authenticated = await resolveAuthenticatedAccount();

    if (!authenticated) {
      console.error('[Search/Start] Unauthorized: No authenticated user');
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    
    if (!authenticated.account) {
      console.error(`[Search/Start] Application account not found for auth user ${authenticated.authUser.id}`);
      return NextResponse.json(
        { error: 'User account not found. Please complete onboarding.', code: 'USER_NOT_FOUND' },
        { status: 404 }
      );
    }
    
    const userId = authenticated.account.id;
    const started = await completeServerSearchStart({
      accountId: userId,
      requestedBrandLocationId: brandLocationId,
      requestId,
      keywords: keywordList,
      competitors: competitorList,
      sources: filteredSources,
    });

    console.log(
      `🔍 [Search/Start] Job ${started.jobId} started for brand ${started.brandId}, location ${started.brandLocationId}`,
    );
    
    // ==========================================================================
    // TRACK API CALL
    // January 29, 2026
    // ==========================================================================
    // February 4, 2026: Track with combined keywords
    if (!started.reused) {
      await trackApiCall({
        userId,
        service: 'apify_google_scraper',
        endpoint: 'start',
        keyword: started.combinedKeyword,
        status: 'success',
        apifyRunId: started.runId,
        durationMs: Date.now() - startTime,
        brandId: started.brandId,
        brandLocationId: started.brandLocationId,
      });
    }
    
    // ==========================================================================
    // RETURN SUCCESS RESPONSE
    // January 29, 2026
    // ==========================================================================
    return NextResponse.json({
      jobId: started.jobId,
      status: 'started',
      message: 'Search started. Poll /api/search/status?jobId=' + started.jobId + ' for results.',
    });
    
  } catch (error: unknown) {
    console.error('[Search/Start] Error:', error);

    if (error instanceof BrandLocationContextError) {
      return NextResponse.json(
        {
          error: error.status >= 500 ? 'Unable to resolve the brand location.' : error.message,
          code: error.code,
        },
        { status: error.status },
      );
    }

    if (error instanceof SearchStartError) {
      return NextResponse.json(
        {
          error: error.status >= 500 ? 'Unable to start the search safely.' : error.message,
          code: error.code,
        },
        { status: error.status },
      );
    }

    const errorType =
      typeof error === 'object' && error !== null && 'type' in error
        ? String(error.type)
        : '';
    const errorMessage = error instanceof Error ? error.message : '';

    // ==========================================================================
    // August 3, 2026 (Paras): APIFY MONTHLY USAGE CAP
    //
    // Incident: the production Apify account hit its monthly usage hard limit,
    // so Apify rejected every actor start (403, type 'platform-feature-disabled',
    // message "Monthly usage hard limit exceeded"). The UI showed the generic
    // "Search failed. Please try again." toast, and users kept retrying even
    // though retries cannot succeed until the cap is raised (Apify Console ->
    // Billing -> Limits) or the billing cycle resets (the 12th of each month).
    // Return a distinct code so the Find page can show an honest message.
    // ==========================================================================
    if (errorType === 'platform-feature-disabled' || /usage hard limit/i.test(errorMessage)) {
      return NextResponse.json(
        { error: 'Search service temporarily at capacity', code: 'SERVICE_AT_CAPACITY' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: errorMessage || 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
