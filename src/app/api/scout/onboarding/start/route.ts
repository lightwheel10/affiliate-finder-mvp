/**
 * =============================================================================
 * ONBOARDING SCOUT START API - January 30, 2026
 * =============================================================================
 * 
 * PURPOSE:
 * Starts the onboarding affiliate search and returns immediately with a jobId.
 * The frontend polls /api/search/status?jobId=X until complete.
 * 
 * WHY THIS EXISTS (January 30, 2026):
 * The old /api/scout/onboarding endpoint did everything synchronously:
 * - Start Google Scraper
 * - Poll until complete (40-95s)
 * - Enrich social results (20-30s each, blocking)
 * - Filter and save
 * 
 * This caused Vercel 504 timeouts because enrichment actors blocked the request.
 * 
 * NEW FLOW:
 * 1. POST /api/scout/onboarding/start → returns { jobId }
 * 2. Frontend polls /api/search/status?jobId=X
 * 3. Status endpoint handles non-blocking enrichment
 * 4. When done, frontend fetches results and saves to discovered_affiliates
 * 
 * IMPORTANT:
 * - This endpoint does NOT save to discovered_affiliates (status endpoint does)
 * - This endpoint does NOT consume credits (onboarding is free)
 * - The old /api/scout/onboarding route is kept for rollback
 * 
 * =============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { startGoogleSearchRun } from '@/app/services/apify-google-scraper';
import { Platform } from '@/app/services/search';

// =============================================================================
// TYPES
// =============================================================================

interface OnboardingStartRequest {
  userId: number;
  topics: string[];
  competitors?: string[];
}

interface OnboardingStartResponse {
  success: boolean;
  jobId?: number;
  runId?: string;
  message: string;
  error?: string;
}

// =============================================================================
// POST /api/scout/onboarding/start
// January 30, 2026
// =============================================================================

export async function POST(req: NextRequest): Promise<NextResponse<OnboardingStartResponse>> {
  const startTime = Date.now();
  
  try {
    // =========================================================================
    // PARSE REQUEST
    // =========================================================================
    const body = await req.json() as OnboardingStartRequest;
    const { userId, topics, competitors } = body;

    // Validate required fields
    if (!userId) {
      console.error('[Onboarding Start] Missing userId');
      return NextResponse.json({ 
        success: false, 
        message: 'Missing userId',
        error: 'MISSING_USER_ID'
      }, { status: 400 });
    }

    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      console.error('[Onboarding Start] Missing or empty topics array');
      return NextResponse.json({ 
        success: false, 
        message: 'No topics provided for search',
        error: 'MISSING_TOPICS'
      }, { status: 400 });
    }

    console.log(`\n${'='.repeat(70)}`);
    console.log(`[Onboarding Start] NON-BLOCKING ARCHITECTURE - January 30, 2026`);
    console.log(`[Onboarding Start] User: ${userId}`);
    console.log(`[Onboarding Start] Topics: ${topics.join(', ')}`);
    console.log(`[Onboarding Start] Competitors: ${competitors?.join(', ') || 'none'}`);
    console.log(`${'='.repeat(70)}\n`);

    // =========================================================================
    // VERIFY USER EXISTS AND GET TARGET SETTINGS
    // =========================================================================
    const userCheck = await sql`
      SELECT id, target_country, target_language, brand 
      FROM crewcast.users 
      WHERE id = ${userId}
    `;

    if (userCheck.length === 0) {
      console.error(`[Onboarding Start] User ${userId} not found`);
      return NextResponse.json({ 
        success: false, 
        message: 'User not found',
        error: 'USER_NOT_FOUND'
      }, { status: 404 });
    }

    const targetCountry = userCheck[0].target_country as string | null;
    const targetLanguage = userCheck[0].target_language as string | null;
    const userBrand = userCheck[0].brand as string | null;

    console.log(`[Onboarding Start] User settings: country=${targetCountry}, language=${targetLanguage}, brand=${userBrand}`);

    // =========================================================================
    // START APIFY GOOGLE SCRAPER (NON-BLOCKING)
    // January 30, 2026
    // =========================================================================
    const sources: Platform[] = ['Web', 'YouTube', 'Instagram', 'TikTok'];
    
    console.log(`[Onboarding Start] Starting Apify Google Scraper...`);
    
    let runId: string;
    try {
      const runResult = await startGoogleSearchRun({
        keywords: topics,
        competitors: competitors || [],
        sources,
        targetCountry: targetCountry || undefined,
        targetLanguage: targetLanguage || undefined,
      });
      
      runId = runResult.runId;
      console.log(`[Onboarding Start] Apify run started: ${runId}`);
    } catch (error: any) {
      console.error(`[Onboarding Start] Failed to start Apify run:`, error.message);
      return NextResponse.json({ 
        success: false, 
        message: 'Failed to start search',
        error: error.message
      }, { status: 500 });
    }

    // =========================================================================
    // CREATE SEARCH JOB RECORD
    // January 30, 2026
    // 
    // We create a search_jobs record so we can poll /api/search/status.
    // The keyword is set to 'onboarding:<primaryTopic>' for identification.
    // =========================================================================
    const primaryTopic = topics[0];
    const jobKeyword = `onboarding:${primaryTopic}`;
    
    const insertResult = await sql`
      INSERT INTO crewcast.search_jobs (
        user_id,
        keyword,
        sources,
        apify_run_id,
        status,
        created_at,
        started_at,
        user_settings
      ) VALUES (
        ${userId},
        ${jobKeyword},
        ${sources}::text[],
        ${runId},
        'running',
        NOW(),
        NOW(),
        ${JSON.stringify({
          targetCountry: targetCountry || null,
          targetLanguage: targetLanguage || null,
          userBrand: userBrand || null,
          // January 30, 2026: Store onboarding context for saving results
          isOnboarding: true,
          topics: topics,
          competitors: competitors || [],
        })}::jsonb
      )
      RETURNING id
    `;
    
    const jobId = insertResult[0].id as number;
    
    console.log(`[Onboarding Start] Created search job: ${jobId}`);
    console.log(`[Onboarding Start] Duration: ${Date.now() - startTime}ms`);

    // =========================================================================
    // RETURN SUCCESS
    // January 30, 2026
    // 
    // Frontend will now poll /api/search/status?jobId=X
    // =========================================================================
    return NextResponse.json({
      success: true,
      jobId,
      runId,
      message: 'Onboarding search started. Poll /api/search/status for results.',
    });

  } catch (error: any) {
    console.error('[Onboarding Start] Error:', error);
    
    return NextResponse.json({
      success: false,
      message: error.message || 'Internal server error',
      error: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}
