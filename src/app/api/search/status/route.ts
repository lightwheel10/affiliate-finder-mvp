/**
 * Search Status API - Polls Apify run status and returns results
 * 
 * =============================================================================
 * Created: January 29, 2026
 * 
 * PURPOSE:
 * Polls the status of an Apify google-search-scraper run and returns results
 * when complete. Handles enrichment and filtering.
 * 
 * FLOW:
 * 1. Auth check
 * 2. Get job from search_jobs (verify user owns it)
 * 3. Check Apify run status via getRunStatus()
 * 4. If RUNNING: return { status: 'running', elapsed }
 * 5. If SUCCEEDED:
 *    a) Fetch raw results via fetchAndProcessResults()
 *    b) Categorize by platform (YouTube, Instagram, TikTok, Web)
 *    c) Enrich each platform (enrichYouTubeByUrls, etc.)
 *    d) Apply filtering (different per platform - see below)
 *    e) Consume credit
 *    f) Update job status
 *    g) Return { status: 'done', results }
 * 6. If FAILED: return error
 * 
 * FILTERING (January 29, 2026):
 * 
 * WEB results get full filtering:
 *   1. ECOMMERCE_DOMAINS block
 *   2. User brand exclusion
 *   3. SHOP_URL_PATTERNS block
 *   4. Language filter (franc)
 *   5. TLD filter (country)
 *   6. Affiliate signal prioritization
 * 
 * SOCIAL results (YouTube/Instagram/TikTok) get minimal filtering:
 *   1. Enrichment required (skip if no metadata)
 *   2. Language filter (franc)
 *   (No domain/shop filtering needed - site: filter already constrains)
 * =============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { sql } from '@/lib/db';
import { consumeCredits } from '@/lib/credits';
import { 
  getRunStatus, 
  fetchAndProcessResults,
  GoogleScraperStatus,
} from '@/app/services/apify-google-scraper';
import { 
  Platform, 
  SearchResult,
  filterWebResults,
  filterSocialResults,
} from '@/app/services/search';
import {
  enrichYouTubeByUrls,
  enrichInstagramByUrls,
  enrichTikTokByUrls,
} from '@/app/services/apify';
import { trackApiCall } from '@/app/services/tracking';

// =============================================================================
// HELPER FUNCTIONS
// January 29, 2026
// =============================================================================

/**
 * Format a number for display (e.g., 5700 -> "5.7K")
 */
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toString();
}

// =============================================================================
// VERCEL FUNCTION CONFIGURATION
// January 29, 2026
// 
// This endpoint does heavy lifting (enrichment + filtering).
// Allow longer timeout for enrichment calls.
// =============================================================================
export const maxDuration = 120; // 2 minutes

// =============================================================================
// REQUEST/RESPONSE TYPES
// January 29, 2026
// =============================================================================

interface StatusResponse {
  status: 'running' | 'processing' | 'done' | 'failed' | 'timeout';
  elapsedSeconds?: number;
  message?: string;
  results?: SearchResult[];
  resultsCount?: number;
  breakdown?: Record<string, number>;
}

interface ErrorResponse {
  error: string;
  code?: string;
}

// =============================================================================
// GET /api/search/status?jobId=X
// January 29, 2026
// =============================================================================

export async function GET(req: NextRequest): Promise<NextResponse<StatusResponse | ErrorResponse>> {
  const startTime = Date.now();
  
  try {
    // Get jobId from query params
    const jobId = req.nextUrl.searchParams.get('jobId');
    
    if (!jobId || isNaN(parseInt(jobId))) {
      return NextResponse.json(
        { error: 'jobId query parameter is required', code: 'MISSING_JOB_ID' },
        { status: 400 }
      );
    }
    
    const jobIdNum = parseInt(jobId);
    
    // ==========================================================================
    // AUTHENTICATION CHECK
    // January 29, 2026
    // ==========================================================================
    const authUser = await getAuthenticatedUser();
    
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    
    // ==========================================================================
    // GET USER FROM DATABASE
    // January 29, 2026
    // ==========================================================================
    const users = await sql`
      SELECT id FROM crewcast.users WHERE email = ${authUser.email}
    `;
    
    if (users.length === 0) {
      return NextResponse.json(
        { error: 'User account not found.', code: 'USER_NOT_FOUND' },
        { status: 404 }
      );
    }
    
    const userId = users[0].id as number;
    
    // ==========================================================================
    // GET JOB FROM DATABASE
    // January 29, 2026
    // 
    // Verify user owns this job to prevent unauthorized access.
    // ==========================================================================
    const jobs = await sql`
      SELECT id, user_id, keyword, sources, apify_run_id, status, 
             created_at, user_settings, results_count
      FROM crewcast.search_jobs 
      WHERE id = ${jobIdNum} AND user_id = ${userId}
    `;
    
    if (jobs.length === 0) {
      return NextResponse.json(
        { error: 'Job not found or access denied.', code: 'JOB_NOT_FOUND' },
        { status: 404 }
      );
    }
    
    const job = jobs[0];
    const apifyRunId = job.apify_run_id as string;
    const jobStatus = job.status as string;
    const userSettings = job.user_settings as {
      targetCountry?: string | null;
      targetLanguage?: string | null;
      userBrand?: string | null;
    } | null;
    
    // ==========================================================================
    // CHECK IF ALREADY COMPLETE
    // January 29, 2026
    // 
    // If job is already done/failed, return immediately without checking Apify.
    // ==========================================================================
    if (jobStatus === 'done') {
      return NextResponse.json({
        status: 'done',
        message: 'Search completed previously.',
        resultsCount: job.results_count as number,
      });
    }
    
    if (jobStatus === 'failed' || jobStatus === 'timeout') {
      return NextResponse.json({
        status: jobStatus as 'failed' | 'timeout',
        message: 'Search failed. Please try again.',
      });
    }
    
    // ==========================================================================
    // CHECK APIFY RUN STATUS
    // January 29, 2026
    // ==========================================================================
    console.log(`🔍 [Search/Status] Checking run: ${apifyRunId}`);
    
    let runStatus: GoogleScraperStatus;
    try {
      runStatus = await getRunStatus(apifyRunId);
    } catch (error: any) {
      console.error(`[Search/Status] Error checking run status:`, error);
      
      // Update job as failed
      await sql`
        UPDATE crewcast.search_jobs 
        SET status = 'failed', error_message = ${error.message}
        WHERE id = ${jobIdNum}
      `;
      
      return NextResponse.json({
        status: 'failed',
        message: 'Failed to check search status.',
      });
    }
    
    console.log(`🔍 [Search/Status] Run status: ${runStatus.status}`);
    
    // ==========================================================================
    // HANDLE RUNNING STATUS
    // January 29, 2026
    // ==========================================================================
    if (runStatus.status === 'RUNNING') {
      const elapsedMs = runStatus.startedAt 
        ? Date.now() - new Date(runStatus.startedAt).getTime()
        : 0;
      
      return NextResponse.json({
        status: 'running',
        elapsedSeconds: Math.round(elapsedMs / 1000),
        message: 'Search in progress...',
      });
    }
    
    // ==========================================================================
    // HANDLE FAILED/ABORTED STATUS
    // January 29, 2026
    // ==========================================================================
    if (runStatus.status === 'FAILED' || runStatus.status === 'ABORTED') {
      await sql`
        UPDATE crewcast.search_jobs 
        SET status = 'failed', error_message = ${'Apify run ' + runStatus.status}
        WHERE id = ${jobIdNum}
      `;
      
      return NextResponse.json({
        status: 'failed',
        message: `Search ${runStatus.status.toLowerCase()}.`,
      });
    }
    
    // ==========================================================================
    // HANDLE TIMED-OUT STATUS
    // January 29, 2026
    // ==========================================================================
    if (runStatus.status === 'TIMED-OUT') {
      await sql`
        UPDATE crewcast.search_jobs 
        SET status = 'timeout', error_message = 'Apify run timed out'
        WHERE id = ${jobIdNum}
      `;
      
      return NextResponse.json({
        status: 'timeout',
        message: 'Search timed out. Please try again.',
      });
    }
    
    // ==========================================================================
    // HANDLE SUCCEEDED STATUS - FETCH AND PROCESS RESULTS
    // January 29, 2026
    // ==========================================================================
    console.log(`🔍 [Search/Status] Run succeeded, processing results...`);
    
    // Update job to processing
    await sql`
      UPDATE crewcast.search_jobs SET status = 'processing' WHERE id = ${jobIdNum}
    `;
    
    // Fetch raw results from Apify
    let rawResults: SearchResult[];
    try {
      rawResults = await fetchAndProcessResults(apifyRunId, {
        targetCountry: userSettings?.targetCountry,
        targetLanguage: userSettings?.targetLanguage,
      });
    } catch (error: any) {
      console.error(`[Search/Status] Error fetching results:`, error);
      
      await sql`
        UPDATE crewcast.search_jobs 
        SET status = 'failed', error_message = ${error.message}
        WHERE id = ${jobIdNum}
      `;
      
      return NextResponse.json({
        status: 'failed',
        message: 'Failed to fetch search results.',
      });
    }
    
    console.log(`🔍 [Search/Status] Raw results: ${rawResults.length}`);
    
    // ==========================================================================
    // CATEGORIZE BY PLATFORM
    // January 29, 2026
    // ==========================================================================
    const youtubeResults = rawResults.filter(r => r.source === 'YouTube');
    const instagramResults = rawResults.filter(r => r.source === 'Instagram');
    const tiktokResults = rawResults.filter(r => r.source === 'TikTok');
    const webResults = rawResults.filter(r => r.source === 'Web');
    
    console.log(`🔍 [Search/Status] Breakdown: YouTube=${youtubeResults.length}, Instagram=${instagramResults.length}, TikTok=${tiktokResults.length}, Web=${webResults.length}`);
    
    // ==========================================================================
    // ENRICH SOCIAL PLATFORMS
    // January 29, 2026
    // 
    // Enrichment adds metadata (subscribers, followers, etc.) to social results.
    // This is done BEFORE filtering because we need metadata for filtering.
    // ==========================================================================
    let enrichedYouTube = youtubeResults;
    let enrichedInstagram = instagramResults;
    let enrichedTikTok = tiktokResults;
    
    // Enrich YouTube
    // January 29, 2026: Maps Apify data to SearchResult format (same as searchYouTubeSerper)
    if (youtubeResults.length > 0) {
      try {
        const urls = youtubeResults.map(r => r.link).filter(Boolean);
        console.log(`🎬 [Search/Status] Enriching ${urls.length} YouTube URLs...`);
        
        const enrichmentMap = await enrichYouTubeByUrls(urls);
        
        enrichedYouTube = youtubeResults.map(result => {
          const apifyData = enrichmentMap.get(result.link);
          if (apifyData) {
            return {
              ...result,
              // CRITICAL: Populate channel field for UI compatibility
              channel: {
                name: apifyData.channelName || 'Unknown Channel',
                link: apifyData.channelUrl || `https://www.youtube.com/@${apifyData.channelUsername || 'unknown'}`,
                verified: apifyData.isVerified,
                subscribers: apifyData.numberOfSubscribers ? formatNumber(apifyData.numberOfSubscribers) : undefined,
              },
              // Video metadata
              views: apifyData.viewCount ? formatNumber(apifyData.viewCount) : undefined,
              youtubeVideoLikes: apifyData.likes,
              youtubeVideoComments: apifyData.commentsCount,
              duration: apifyData.duration,
              thumbnail: apifyData.thumbnailUrl,
              title: apifyData.title || result.title,
              snippet: apifyData.text?.substring(0, 300) || result.snippet,
              date: apifyData.date || apifyData.uploadDate || result.date,
            };
          }
          return result;
        });
        
        console.log(`🎬 [Search/Status] YouTube enrichment complete`);
      } catch (error: any) {
        console.warn(`⚠️ [Search/Status] YouTube enrichment failed:`, error.message);
      }
    }
    
    // Enrich Instagram
    // January 29, 2026: Maps Apify data to SearchResult format (same as searchInstagramSerper)
    if (instagramResults.length > 0) {
      try {
        const urls = instagramResults.map(r => r.link).filter(Boolean);
        console.log(`📸 [Search/Status] Enriching ${urls.length} Instagram URLs...`);
        
        const enrichmentMap = await enrichInstagramByUrls(urls);
        
        enrichedInstagram = instagramResults.map(result => {
          const apifyData = enrichmentMap.get(result.link);
          if (apifyData && apifyData.username) {
            // Get first post for engagement data
            const firstPost = (apifyData as any).latestPosts?.[0];
            
            return {
              ...result,
              // CRITICAL: Populate channel field for UI compatibility
              channel: {
                name: apifyData.fullName || apifyData.username,
                link: apifyData.url || `https://www.instagram.com/${apifyData.username}/`,
                thumbnail: apifyData.profilePicUrlHD || apifyData.profilePicUrl,
                verified: apifyData.verified,
                subscribers: apifyData.followersCount ? formatNumber(apifyData.followersCount) : undefined,
              },
              // Profile metadata
              instagramUsername: apifyData.username,
              instagramFullName: apifyData.fullName,
              instagramBio: apifyData.biography,
              instagramFollowers: apifyData.followersCount,
              instagramFollowing: apifyData.followsCount,
              instagramPostsCount: apifyData.postsCount,
              instagramIsBusiness: apifyData.isBusinessAccount,
              instagramIsVerified: apifyData.verified,
              // Latest post engagement
              instagramPostLikes: firstPost?.likesCount,
              instagramPostComments: firstPost?.commentsCount,
              instagramPostViews: firstPost?.videoViewCount,
              // Profile picture and display name
              thumbnail: apifyData.profilePicUrlHD || apifyData.profilePicUrl,
              personName: apifyData.fullName || apifyData.username,
              title: apifyData.fullName || `@${apifyData.username}` || result.title,
              snippet: apifyData.biography?.substring(0, 300) || result.snippet,
            };
          }
          return result;
        });
        
        console.log(`📸 [Search/Status] Instagram enrichment complete`);
      } catch (error: any) {
        console.warn(`⚠️ [Search/Status] Instagram enrichment failed:`, error.message);
      }
    }
    
    // Enrich TikTok
    // January 29, 2026: Maps Apify data to SearchResult format (same as searchTikTokSerper)
    if (tiktokResults.length > 0) {
      try {
        const urls = tiktokResults.map(r => r.link).filter(Boolean);
        console.log(`🎵 [Search/Status] Enriching ${urls.length} TikTok URLs...`);
        
        const enrichmentMap = await enrichTikTokByUrls(urls);
        
        enrichedTikTok = tiktokResults.map(result => {
          const apifyData = enrichmentMap.get(result.link);
          if (apifyData && apifyData.authorMeta) {
            const author = apifyData.authorMeta;
            
            return {
              ...result,
              // CRITICAL: Populate channel field for UI compatibility
              channel: {
                name: author.nickName || author.name || result.tiktokUsername || 'Unknown',
                link: author.profileUrl || `https://www.tiktok.com/@${author.name}`,
                thumbnail: author.avatar,
                verified: author.verified,
                subscribers: author.fans ? formatNumber(author.fans) : undefined,
              },
              // Author data
              tiktokUsername: author.name || result.tiktokUsername,
              tiktokDisplayName: author.nickName,
              tiktokBio: author.signature,
              tiktokFollowers: author.fans,
              tiktokLikes: author.heart,
              tiktokVideosCount: author.video,
              tiktokIsVerified: author.verified,
              // Video data
              tiktokVideoPlays: apifyData.playCount,
              tiktokVideoLikes: apifyData.diggCount,
              tiktokVideoComments: apifyData.commentCount,
              tiktokVideoShares: apifyData.shareCount,
              // Thumbnail and date
              thumbnail: apifyData.videoMeta?.coverUrl || author.avatar,
              date: apifyData.createTimeISO || result.date,
            };
          }
          return result;
        });
        
        console.log(`🎵 [Search/Status] TikTok enrichment complete`);
      } catch (error: any) {
        console.warn(`⚠️ [Search/Status] TikTok enrichment failed:`, error.message);
      }
    }
    
    // ==========================================================================
    // APPLY FILTERING
    // January 29, 2026
    // 
    // IMPORTANT: Different filtering for Web vs Social!
    // ==========================================================================
    
    // Filter Web results (full filtering pipeline)
    const filteredWeb = filterWebResults(webResults, {
      userBrand: userSettings?.userBrand || undefined,
      targetCountry: userSettings?.targetCountry || undefined,
      targetLanguage: userSettings?.targetLanguage || undefined,
    });
    
    // Filter Social results (enrichment required + language + brand exclusion)
    // January 29, 2026: Added brand exclusion to filter out user's own social accounts
    const filteredYouTube = filterSocialResults(enrichedYouTube, {
      requireEnrichment: true,
      targetLanguage: userSettings?.targetLanguage || undefined,
      userBrand: userSettings?.userBrand || undefined,
    });
    
    const filteredInstagram = filterSocialResults(enrichedInstagram, {
      requireEnrichment: true,
      targetLanguage: userSettings?.targetLanguage || undefined,
      userBrand: userSettings?.userBrand || undefined,
    });
    
    const filteredTikTok = filterSocialResults(enrichedTikTok, {
      requireEnrichment: true,
      targetLanguage: userSettings?.targetLanguage || undefined,
      userBrand: userSettings?.userBrand || undefined,
    });
    
    // ==========================================================================
    // COMBINE RESULTS
    // January 29, 2026
    // ==========================================================================
    const allResults = [
      ...filteredYouTube,
      ...filteredInstagram,
      ...filteredTikTok,
      ...filteredWeb,
    ];
    
    const breakdown = {
      YouTube: filteredYouTube.length,
      Instagram: filteredInstagram.length,
      TikTok: filteredTikTok.length,
      Web: filteredWeb.length,
    };
    
    console.log(`🔍 [Search/Status] Final results: ${allResults.length}`);
    console.log(`🔍 [Search/Status] Breakdown: ${JSON.stringify(breakdown)}`);
    
    // ==========================================================================
    // CONSUME CREDIT
    // January 29, 2026
    // 
    // Only consume credit on successful search with results.
    // ==========================================================================
    if (allResults.length > 0) {
      await consumeCredits(userId, 'topic_search', 1);
      console.log(`💳 [Search/Status] Credit consumed for user ${userId}`);
    }
    
    // ==========================================================================
    // UPDATE JOB STATUS
    // January 29, 2026
    // ==========================================================================
    await sql`
      UPDATE crewcast.search_jobs 
      SET 
        status = 'done',
        completed_at = NOW(),
        results_count = ${allResults.length}
      WHERE id = ${jobIdNum}
    `;
    
    // ==========================================================================
    // TRACK API CALL
    // January 29, 2026
    // ==========================================================================
    await trackApiCall({
      userId,
      service: 'apify_google_scraper',
      endpoint: 'status',
      keyword: job.keyword as string,
      status: 'success',
      resultsCount: allResults.length,
      apifyRunId,
      durationMs: Date.now() - startTime,
    });
    
    // ==========================================================================
    // RETURN RESULTS
    // January 29, 2026
    // ==========================================================================
    return NextResponse.json({
      status: 'done',
      results: allResults,
      resultsCount: allResults.length,
      breakdown,
    });
    
  } catch (error: any) {
    console.error('[Search/Status] Error:', error);
    
    return NextResponse.json(
      { error: error.message || 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
