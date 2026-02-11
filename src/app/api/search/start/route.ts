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
 * 1. Auth check via getAuthenticatedUser()
 * 2. Get user settings from DB (target_country, target_language, brand)
 * 3. Credit check via checkCredits()
 * 4. Call startGoogleSearchRun() - returns immediately with runId
 * 5. Insert job into search_jobs table
 * 6. Return { jobId, status: 'started', runId }
 * 
 * POLLING:
 * Client should poll /api/search/status?jobId=X every 3-5 seconds until done.
 * 
 * CREDITS:
 * Credit is RESERVED at start but only CONSUMED when results are delivered.
 * If search fails, credit is not consumed.
 * =============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { sql } from '@/lib/db';
import { checkCredits } from '@/lib/credits';
import { startGoogleSearchRun } from '@/app/services/apify-google-scraper';
import { Platform } from '@/app/services/search';
import { trackApiCall } from '@/app/services/tracking';

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

interface StartSearchRequest {
  keyword?: string;        // Single keyword (backward compat)
  keywords?: string[];     // February 4, 2026: Multi-keyword batch (preferred)
  sources?: Platform[];
  competitors?: string[];  // Optional competitor domains for Find Affiliates run
}

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
    // Parse request body
    const body = await req.json() as StartSearchRequest;
    const { keyword, keywords, sources = ['Web', 'YouTube', 'Instagram', 'TikTok'], competitors: rawCompetitors } = body;

    // Normalize competitors: trim, strip protocol, lowercase (optional for Find run)
    const competitorList: string[] = Array.isArray(rawCompetitors)
      ? rawCompetitors
          .map((c) => typeof c === 'string' ? c.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase() : '')
          .filter((c) => c.length > 0)
      : [];
    
    // February 4, 2026: Support both single keyword and keywords array
    // Prefer keywords[] for multi-keyword batch (1 credit per session)
    const keywordList: string[] = keywords && keywords.length > 0 
      ? keywords.map(k => k.trim()).filter(k => k.length > 0)
      : keyword ? [keyword.trim()] : [];
    
    // Validate keywords
    if (keywordList.length === 0) {
      return NextResponse.json(
        { error: 'At least one keyword is required', code: 'MISSING_KEYWORD' },
        { status: 400 }
      );
    }
    
    // Validate sources
    const validSources: Platform[] = ['Web', 'YouTube', 'Instagram', 'TikTok'];
    const filteredSources = sources.filter(s => validSources.includes(s));
    
    if (filteredSources.length === 0) {
      return NextResponse.json(
        { error: 'At least one valid source is required', code: 'INVALID_SOURCES' },
        { status: 400 }
      );
    }
    
    // February 4, 2026: Log all keywords in batch
    const combinedKeyword = keywordList.join(' | ');
    console.log(`🔍 [Search/Start] Keywords: "${combinedKeyword}", Sources: ${filteredSources.join(', ')}`);
    
    // ==========================================================================
    // AUTHENTICATION CHECK
    // January 29, 2026
    // ==========================================================================
    const authUser = await getAuthenticatedUser();
    
    if (!authUser) {
      console.error('[Search/Start] Unauthorized: No authenticated user');
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    
    // ==========================================================================
    // GET USER FROM DATABASE
    // January 29, 2026
    // 
    // Fetch user settings needed for:
    // - target_country: For location config (gl, hl params)
    // - target_language: For localized search terms
    // - brand: For filtering (stored in job for status endpoint)
    // ==========================================================================
    const users = await sql`
      SELECT id, brand, target_country, target_language
      FROM crewcast.users WHERE email = ${authUser.email}
    `;
    
    if (users.length === 0) {
      console.error(`[Search/Start] User not found: ${authUser.email}`);
      return NextResponse.json(
        { error: 'User account not found. Please complete onboarding.', code: 'USER_NOT_FOUND' },
        { status: 404 }
      );
    }
    
    const user = users[0];
    const userId = user.id as number;
    const targetCountry = user.target_country as string | null;
    const targetLanguage = user.target_language as string | null;
    const userBrand = user.brand as string | null;
    
    console.log(`🔍 [Search/Start] User: ${userId}, Country: ${targetCountry}, Language: ${targetLanguage}`);
    
    // ==========================================================================
    // CREDIT CHECK
    // January 29, 2026
    // 
    // Check if user has credits for topic_search.
    // Credit is reserved but not consumed until results are delivered.
    // ==========================================================================
    const creditCheck = await checkCredits(userId, 'topic_search', 1);
    
    if (!creditCheck.allowed) {
      console.log(`[Search/Start] Insufficient credits for user ${userId}: ${creditCheck.message}`);
      return NextResponse.json(
        { error: creditCheck.message || 'Insufficient credits. Please upgrade your plan.', code: 'INSUFFICIENT_CREDITS' },
        { status: 402 }
      );
    }
    
    // ==========================================================================
    // START APIFY RUN
    // January 29, 2026
    // February 4, 2026: Use keywords[] for batched search (1 Apify run for all keywords)
    // 
    // This returns immediately with a runId. The actual search runs
    // in the background on Apify's servers.
    // ==========================================================================
    const runResult = await startGoogleSearchRun({
      keywords: keywordList,  // February 4, 2026: Batch all keywords in single run
      competitors: competitorList.length > 0 ? competitorList : undefined,
      sources: filteredSources,
      targetCountry,
      targetLanguage,
    });
    
    console.log(`🔍 [Search/Start] Apify run started: ${runResult.runId}`);
    
    // ==========================================================================
    // INSERT JOB INTO DATABASE
    // January 29, 2026
    // 
    // Store job with user settings so status endpoint can apply filtering.
    // user_settings JSON contains: targetCountry, targetLanguage, userBrand, competitors
    // ==========================================================================
    const userSettings = JSON.stringify({
      targetCountry,
      targetLanguage,
      userBrand,
      competitors: competitorList,
    });
    
    const sourcesArray = `{${filteredSources.join(',')}}`;
    
    // February 4, 2026: Store combined keywords for display/attribution
    const jobs = await sql`
      INSERT INTO crewcast.search_jobs (
        user_id,
        keyword,
        sources,
        apify_run_id,
        status,
        user_settings
      ) VALUES (
        ${userId},
        ${combinedKeyword},
        ${sourcesArray}::text[],
        ${runResult.runId},
        'running',
        ${userSettings}::jsonb
      )
      RETURNING id
    `;
    
    const jobId = jobs[0].id as number;
    
    console.log(`🔍 [Search/Start] Job created: ${jobId}`);
    
    // ==========================================================================
    // TRACK API CALL
    // January 29, 2026
    // ==========================================================================
    // February 4, 2026: Track with combined keywords
    await trackApiCall({
      userId,
      service: 'apify_google_scraper',
      endpoint: 'start',
      keyword: combinedKeyword,
      status: 'success',
      apifyRunId: runResult.runId,
      durationMs: Date.now() - startTime,
    });
    
    // ==========================================================================
    // RETURN SUCCESS RESPONSE
    // January 29, 2026
    // ==========================================================================
    return NextResponse.json({
      jobId,
      status: 'started',
      message: 'Search started. Poll /api/search/status?jobId=' + jobId + ' for results.',
    });
    
  } catch (error: any) {
    console.error('[Search/Start] Error:', error);
    
    return NextResponse.json(
      { error: error.message || 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
