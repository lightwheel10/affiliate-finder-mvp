/**
 * Search Status API - Polls Apify run status and returns results
 * 
 * =============================================================================
 * Created: January 29, 2026
 * Updated: January 30, 2026 - Non-blocking enrichment architecture
 * 
 * PURPOSE:
 * Polls the status of an Apify google-search-scraper run and returns results
 * when complete. Now uses non-blocking enrichment to avoid Vercel timeouts.
 * 
 * FLOW (Updated January 30, 2026):
 * 1. Auth check
 * 2. Get job from search_jobs (verify user owns it)
 * 3. If job.enrichment_status='running' → check enrichment actors, return 'enriching'
 * 4. Check Apify Google Scraper run status via getRunStatus()
 * 5. If RUNNING: return { status: 'running', elapsed }
 * 6. If SUCCEEDED (first time):
 *    a) Fetch raw results via fetchAndProcessResults()
 *    b) Save to raw_results column
 *    c) Start enrichment actors (non-blocking via .start())
 *    d) Save enrichment_run_ids, set enrichment_status='running'
 *    e) Return { status: 'enriching' }
 * 7. When all enrichment actors complete:
 *    a) Fetch enrichment results from datasets
 *    b) Apply filtering
 *    c) Consume credit
 *    d) Return { status: 'done', results }
 * 
 * WHY NON-BLOCKING (January 30, 2026):
 * The old approach used blocking .call() for enrichment actors, which took
 * 20-30 seconds each. With 3 platforms, this exceeded Vercel's timeout limit.
 * Now we use .start() to begin enrichment actors and poll their status.
 * 
 * FILTERING:
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
// January 30, 2026: Import both blocking (legacy) and non-blocking enrichment functions
import {
  enrichYouTubeByUrls,
  enrichInstagramByUrls,
  enrichTikTokByUrls,
  // Non-blocking enrichment functions
  startAllEnrichment,
  checkAllEnrichmentStatus,
  fetchYouTubeEnrichmentResults,
  fetchInstagramEnrichmentResults,
  fetchTikTokEnrichmentResults,
  fetchSimilarWebEnrichmentResults,
  EnrichmentRunIds,
  SimilarWebData,
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
// Updated: January 30, 2026 - Added 'enriching' status for non-blocking enrichment
// =============================================================================

interface StatusResponse {
  status: 'running' | 'processing' | 'enriching' | 'done' | 'failed' | 'timeout';
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
    // Updated: January 30, 2026 - Added enrichment columns
    // 
    // Verify user owns this job to prevent unauthorized access.
    // ==========================================================================
    const jobs = await sql`
      SELECT id, user_id, keyword, sources, apify_run_id, status, 
             created_at, user_settings, results_count,
             enrichment_status, enrichment_run_ids, raw_results
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
    // January 30, 2026: Non-blocking enrichment state
    const enrichmentStatus = job.enrichment_status as string | null;
    const enrichmentRunIds = job.enrichment_run_ids as EnrichmentRunIds | null;
    
    // Ensure rawResults is an array (JSONB may come back in unexpected formats)
    let rawResults: SearchResult[] | null = null;
    if (job.raw_results) {
      if (Array.isArray(job.raw_results)) {
        rawResults = job.raw_results as SearchResult[];
      } else if (typeof job.raw_results === 'string') {
        try {
          const parsed = JSON.parse(job.raw_results);
          rawResults = Array.isArray(parsed) ? parsed : null;
        } catch (e) {
          console.error(`[Search/Status] Failed to parse raw_results:`, e);
        }
      } else {
        console.error(`[Search/Status] raw_results is not an array, type: ${typeof job.raw_results}`);
      }
    }
    
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
    // JANUARY 30, 2026: CHECK ENRICHMENT STATUS (NON-BLOCKING)
    // 
    // If enrichment actors are running, check their status.
    // This is the new non-blocking enrichment flow to avoid Vercel timeouts.
    // ==========================================================================
    if (enrichmentStatus === 'running' && enrichmentRunIds && rawResults) {
      console.log(`🔄 [Search/Status] Checking enrichment status...`);
      
      const { allComplete, statuses } = await checkAllEnrichmentStatus(enrichmentRunIds);
      
      console.log(`🔄 [Search/Status] Enrichment status:`, statuses);
      
      if (!allComplete) {
        // Enrichment still running - return enriching status
        return NextResponse.json({
          status: 'enriching',
          message: 'Enriching results with social media data...',
        });
      }
      
      // All enrichment actors complete - process results
      console.log(`✅ [Search/Status] All enrichment actors complete, processing results...`);
      
      // Check if any enrichment failed
      const anyFailed = Object.values(statuses).some(s => 
        s.status === 'FAILED' || s.status === 'ABORTED'
      );
      
      if (anyFailed) {
        console.warn(`⚠️ [Search/Status] Some enrichment actors failed, continuing with partial data`);
      }
      
      // Fetch enrichment results from completed runs
      const [youtubeEnrichment, instagramEnrichment, tiktokEnrichment, similarwebEnrichment] = await Promise.all([
        enrichmentRunIds.youtube && statuses.youtube?.status === 'SUCCEEDED'
          ? fetchYouTubeEnrichmentResults(enrichmentRunIds.youtube)
          : Promise.resolve(new Map()),
        enrichmentRunIds.instagram && statuses.instagram?.status === 'SUCCEEDED'
          ? fetchInstagramEnrichmentResults(enrichmentRunIds.instagram)
          : Promise.resolve(new Map()),
        enrichmentRunIds.tiktok && statuses.tiktok?.status === 'SUCCEEDED'
          ? fetchTikTokEnrichmentResults(enrichmentRunIds.tiktok)
          : Promise.resolve(new Map()),
        enrichmentRunIds.similarweb && statuses.similarweb?.status === 'SUCCEEDED'
          ? fetchSimilarWebEnrichmentResults(enrichmentRunIds.similarweb)
          : Promise.resolve(new Map<string, SimilarWebData>()),
      ]);
      
      console.log(`📥 [Search/Status] Enrichment results fetched: YouTube=${youtubeEnrichment.size}, Instagram=${instagramEnrichment.size}, TikTok=${tiktokEnrichment.size}, SimilarWeb=${similarwebEnrichment.size}`);
      
      // Apply enrichment to raw results
      const youtubeResults = rawResults.filter(r => r.source === 'YouTube');
      const instagramResults = rawResults.filter(r => r.source === 'Instagram');
      const tiktokResults = rawResults.filter(r => r.source === 'TikTok');
      const webResults = rawResults.filter(r => r.source === 'Web');
      
      // Enrich YouTube results
      const enrichedYouTube = youtubeResults.map(result => {
        const apifyData = youtubeEnrichment.get(result.link);
        if (apifyData) {
          return {
            ...result,
            channel: {
              name: apifyData.channelName || 'Unknown Channel',
              link: apifyData.channelUrl || '',
              verified: apifyData.isVerified,
              subscribers: apifyData.numberOfSubscribers ? formatNumber(apifyData.numberOfSubscribers) : undefined,
            },
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
      
      // Enrich Instagram results
      const enrichedInstagram = instagramResults.map(result => {
        const apifyData = instagramEnrichment.get(result.link);
        if (apifyData && apifyData.username) {
          const firstPost = (apifyData as any).latestPosts?.[0];
          return {
            ...result,
            channel: {
              name: apifyData.fullName || apifyData.username,
              link: apifyData.url || `https://www.instagram.com/${apifyData.username}/`,
              thumbnail: apifyData.profilePicUrlHD || apifyData.profilePicUrl,
              verified: apifyData.verified,
              subscribers: apifyData.followersCount ? formatNumber(apifyData.followersCount) : undefined,
            },
            instagramUsername: apifyData.username,
            instagramFullName: apifyData.fullName,
            instagramBio: apifyData.biography,
            instagramFollowers: apifyData.followersCount,
            instagramFollowing: apifyData.followsCount,
            instagramPostsCount: apifyData.postsCount,
            instagramIsBusiness: apifyData.isBusinessAccount,
            instagramIsVerified: apifyData.verified,
            instagramPostLikes: firstPost?.likesCount,
            instagramPostComments: firstPost?.commentsCount,
            instagramPostViews: firstPost?.videoViewCount,
            thumbnail: apifyData.profilePicUrlHD || apifyData.profilePicUrl,
            personName: apifyData.fullName || apifyData.username,
            title: apifyData.fullName || `@${apifyData.username}` || result.title,
            snippet: apifyData.biography?.substring(0, 300) || result.snippet,
          };
        }
        return result;
      });
      
      // Enrich TikTok results
      const enrichedTikTok = tiktokResults.map(result => {
        const apifyData = tiktokEnrichment.get(result.link);
        if (apifyData && apifyData.authorMeta) {
          const author = apifyData.authorMeta;
          return {
            ...result,
            channel: {
              name: author.nickName || author.name || result.tiktokUsername || 'Unknown',
              link: author.profileUrl || `https://www.tiktok.com/@${author.name}`,
              thumbnail: author.avatar,
              verified: author.verified,
              subscribers: author.fans ? formatNumber(author.fans) : undefined,
            },
            tiktokUsername: author.name || result.tiktokUsername,
            tiktokDisplayName: author.nickName,
            tiktokBio: author.signature,
            tiktokFollowers: author.fans,
            tiktokLikes: author.heart,
            tiktokVideosCount: author.video,
            tiktokIsVerified: author.verified,
            tiktokVideoPlays: apifyData.playCount,
            tiktokVideoLikes: apifyData.diggCount,
            tiktokVideoComments: apifyData.commentCount,
            tiktokVideoShares: apifyData.shareCount,
            thumbnail: apifyData.videoMeta?.coverUrl || author.avatar,
            date: apifyData.createTimeISO || result.date,
          };
        }
        return result;
      });
      
      // Enrich Web results with SimilarWeb data
      const enrichedWeb = webResults.map(result => {
        const swData = similarwebEnrichment.get(result.domain);
        if (swData) {
          return {
            ...result,
            similarwebMonthlyVisits: swData.monthlyVisits,
            similarwebGlobalRank: swData.globalRank,
            similarwebCountryRank: swData.countryRank,
            similarwebCountryCode: swData.countryCode,
            similarwebBounceRate: swData.bounceRate,
            similarwebPagesPerVisit: swData.pagesPerVisit,
            similarwebTimeOnSite: swData.timeOnSite,
            similarwebCategory: swData.category,
            similarwebTrafficSources: swData.trafficSources,
            similarwebTopCountries: swData.topCountries,
          };
        }
        return result;
      });
      
      // Apply filtering
      const filteredWeb = filterWebResults(enrichedWeb, {
        userBrand: userSettings?.userBrand || undefined,
        targetCountry: userSettings?.targetCountry || undefined,
        targetLanguage: userSettings?.targetLanguage || undefined,
      });
      
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
      
      // Combine results
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
      // January 30, 2026: Check if this is an onboarding job
      // If so, save results to discovered_affiliates and skip credit consumption
      // 
      // PERFORMANCE FIX: Use parallel inserts with concurrency limit
      // With 700+ results, sequential inserts would take 30+ seconds and timeout.
      // Parallel inserts (20 at a time) complete in ~5-10 seconds.
      // ==========================================================================
      const isOnboarding = (userSettings as any)?.isOnboarding === true;
      const onboardingTopics = (userSettings as any)?.topics as string[] | undefined;
      
      if (isOnboarding && onboardingTopics && onboardingTopics.length > 0) {
        console.log(`🎓 [Search/Status] Onboarding job detected, saving ${allResults.length} results to discovered_affiliates...`);
        
        const primaryTopic = onboardingTopics[0];
        let savedCount = 0;
        let errorCount = 0;
        
        // Helper to save a single result
        const saveResult = async (result: SearchResult) => {
          try {
            await sql`
              INSERT INTO crewcast.discovered_affiliates (
                user_id, search_keyword, title, link, domain, snippet, source,
                is_affiliate, summary, thumbnail, date, views, highlighted_words,
                discovery_method_type, discovery_method_value,
                channel_name, channel_link, channel_thumbnail, channel_verified, channel_subscribers,
                duration, email,
                instagram_username, instagram_full_name, instagram_bio, instagram_followers,
                instagram_following, instagram_posts_count, instagram_is_business, instagram_is_verified,
                tiktok_username, tiktok_display_name, tiktok_bio, tiktok_followers,
                tiktok_following, tiktok_likes, tiktok_videos_count, tiktok_is_verified,
                tiktok_video_plays, tiktok_video_likes, tiktok_video_comments, tiktok_video_shares,
                youtube_video_likes, youtube_video_comments
              )
              VALUES (
                ${userId}, ${primaryTopic}, ${result.title}, ${result.link}, ${result.domain},
                ${result.snippet || 'No description available'}, ${result.source},
                ${true}, ${'Found via onboarding search'}, ${result.thumbnail || null},
                ${result.date || null}, ${result.views || null}, ${result.highlightedWords || null},
                ${'topic'}, ${primaryTopic},
                ${result.channel?.name || null}, ${result.channel?.link || null},
                ${result.channel?.thumbnail || null}, ${result.channel?.verified || null},
                ${result.channel?.subscribers || null}, ${result.duration || null},
                ${result.email || null},
                ${result.instagramUsername || null}, ${result.instagramFullName || null},
                ${result.instagramBio || null}, ${result.instagramFollowers || null},
                ${result.instagramFollowing || null}, ${result.instagramPostsCount || null},
                ${result.instagramIsBusiness || null}, ${result.instagramIsVerified || null},
                ${result.tiktokUsername || null}, ${result.tiktokDisplayName || null},
                ${result.tiktokBio || null}, ${result.tiktokFollowers || null},
                ${result.tiktokFollowing || null}, ${result.tiktokLikes || null},
                ${result.tiktokVideosCount || null}, ${result.tiktokIsVerified || null},
                ${result.tiktokVideoPlays || null}, ${result.tiktokVideoLikes || null},
                ${result.tiktokVideoComments || null}, ${result.tiktokVideoShares || null},
                ${result.youtubeVideoLikes || null}, ${result.youtubeVideoComments || null}
              )
              ON CONFLICT (user_id, link) DO NOTHING
            `;
            return true;
          } catch (e) {
            return false;
          }
        };
        
        // Process in parallel batches with concurrency limit
        // 20 concurrent inserts balances speed vs DB connection limits
        const CONCURRENCY = 20;
        for (let i = 0; i < allResults.length; i += CONCURRENCY) {
          const chunk = allResults.slice(i, i + CONCURRENCY);
          const results = await Promise.all(chunk.map(saveResult));
          const chunkSaved = results.filter(Boolean).length;
          savedCount += chunkSaved;
          errorCount += results.length - chunkSaved;
          
          // Log progress every 100 results
          if ((i + CONCURRENCY) % 100 < CONCURRENCY) {
            console.log(`🎓 [Search/Status] Progress: ${savedCount}/${allResults.length} saved`);
          }
        }
        
        console.log(`🎓 [Search/Status] Saved ${savedCount} results (${errorCount} duplicates/errors) to discovered_affiliates`);
      } else {
        // Not onboarding - consume credit
        if (allResults.length > 0) {
          await consumeCredits(userId, 'topic_search', 1);
          console.log(`💳 [Search/Status] Credit consumed for user ${userId}`);
        }
      }
      
      // Update job status to done
      await sql`
        UPDATE crewcast.search_jobs 
        SET 
          status = 'done',
          enrichment_status = 'succeeded',
          completed_at = NOW(),
          results_count = ${allResults.length}
        WHERE id = ${jobIdNum}
      `;
      
      // Track API call
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
      
      return NextResponse.json({
        status: 'done',
        results: allResults,
        resultsCount: allResults.length,
        breakdown,
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
    // HANDLE SUCCEEDED STATUS - START NON-BLOCKING ENRICHMENT
    // January 30, 2026: Changed from blocking to non-blocking enrichment
    // 
    // When Google Scraper completes, we:
    // 1. Fetch raw results
    // 2. Save to raw_results column
    // 3. Start enrichment actors (non-blocking via .start())
    // 4. Return { status: 'enriching' }
    // 
    // The actual enrichment processing happens on the NEXT poll when
    // enrichment_status='running' (see code above).
    // ==========================================================================
    
    // ==========================================================================
    // SAFETY GUARD: Prevent actor-spawning loop (January 30, 2026)
    // 
    // If we already have raw_results or enrichment_run_ids, we've already
    // processed this SUCCEEDED state. This can happen if:
    // - Previous UPDATE failed (e.g., constraint violation)
    // - Race condition with multiple concurrent polls
    // 
    // Without this guard, each poll would start NEW enrichment actors!
    // ==========================================================================
    if (rawResults || enrichmentRunIds) {
      console.warn(`⚠️ [Search/Status] GUARD: Already processed SUCCEEDED state, skipping actor start`);
      console.warn(`⚠️ [Search/Status] rawResults: ${rawResults ? 'exists' : 'null'}, enrichmentRunIds: ${enrichmentRunIds ? JSON.stringify(enrichmentRunIds) : 'null'}`);
      
      // Try to recover by returning enriching status
      return NextResponse.json({
        status: 'enriching',
        message: 'Enriching results with social media data...',
      });
    }
    
    console.log(`🔍 [Search/Status] Google Scraper succeeded, starting non-blocking enrichment...`);
    
    // Update job to processing
    await sql`
      UPDATE crewcast.search_jobs SET status = 'processing' WHERE id = ${jobIdNum}
    `;
    
    // Fetch raw results from Apify
    let fetchedRawResults: SearchResult[];
    try {
      fetchedRawResults = await fetchAndProcessResults(apifyRunId, {
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
    
    console.log(`🔍 [Search/Status] Raw results: ${fetchedRawResults.length}`);
    
    // ==========================================================================
    // CATEGORIZE BY PLATFORM
    // January 30, 2026
    // ==========================================================================
    const youtubeResults = fetchedRawResults.filter(r => r.source === 'YouTube');
    const instagramResults = fetchedRawResults.filter(r => r.source === 'Instagram');
    const tiktokResults = fetchedRawResults.filter(r => r.source === 'TikTok');
    const webResults = fetchedRawResults.filter(r => r.source === 'Web');
    
    console.log(`🔍 [Search/Status] Breakdown: YouTube=${youtubeResults.length}, Instagram=${instagramResults.length}, TikTok=${tiktokResults.length}, Web=${webResults.length}`);
    
    // ==========================================================================
    // START NON-BLOCKING ENRICHMENT
    // January 30, 2026
    // 
    // Start all enrichment actors in parallel using .start() (not .call()).
    // This returns immediately with run IDs that we poll on subsequent requests.
    // ==========================================================================
    const enrichmentUrls = {
      youtube: youtubeResults.map(r => r.link).filter(Boolean),
      instagram: instagramResults.map(r => r.link).filter(Boolean),
      tiktok: tiktokResults.map(r => r.link).filter(Boolean),
      similarweb: webResults.map(r => r.domain).filter(Boolean),
    };
    
    // Check if there are any results to enrich (social or web)
    const hasResultsToEnrich = 
      enrichmentUrls.youtube.length > 0 || 
      enrichmentUrls.instagram.length > 0 || 
      enrichmentUrls.tiktok.length > 0 ||
      enrichmentUrls.similarweb.length > 0;
    
    if (!hasResultsToEnrich) {
      // No results to enrich - return done immediately
      console.log(`🔍 [Search/Status] No results to enrich, returning immediately`);
      
      // Apply web filtering
      const filteredWeb = filterWebResults(webResults, {
        userBrand: userSettings?.userBrand || undefined,
        targetCountry: userSettings?.targetCountry || undefined,
        targetLanguage: userSettings?.targetLanguage || undefined,
      });
      
      const allResults = filteredWeb;
      const breakdown = {
        YouTube: 0,
        Instagram: 0,
        TikTok: 0,
        Web: filteredWeb.length,
      };
      
      // ==========================================================================
      // January 30, 2026: Check if this is an onboarding job (SAME AS ENRICHMENT PATH)
      // If so, save results to discovered_affiliates and skip credit consumption
      // ==========================================================================
      const isOnboarding = (userSettings as any)?.isOnboarding === true;
      const onboardingTopics = (userSettings as any)?.topics as string[] | undefined;
      
      if (isOnboarding && onboardingTopics && onboardingTopics.length > 0) {
        console.log(`🎓 [Search/Status] Onboarding job (no social), saving ${allResults.length} web results...`);
        
        const primaryTopic = onboardingTopics[0];
        let savedCount = 0;
        
        // Helper to save a single result
        const saveResult = async (result: SearchResult) => {
          try {
            await sql`
              INSERT INTO crewcast.discovered_affiliates (
                user_id, search_keyword, title, link, domain, snippet, source,
                is_affiliate, summary, thumbnail, date, views, highlighted_words,
                discovery_method_type, discovery_method_value,
                channel_name, channel_link, channel_thumbnail, channel_verified, channel_subscribers,
                duration, email
              )
              VALUES (
                ${userId}, ${primaryTopic}, ${result.title}, ${result.link}, ${result.domain},
                ${result.snippet || 'No description available'}, ${result.source},
                ${true}, ${'Found via onboarding search'}, ${result.thumbnail || null},
                ${result.date || null}, ${result.views || null}, ${result.highlightedWords || null},
                ${'topic'}, ${primaryTopic},
                ${result.channel?.name || null}, ${result.channel?.link || null},
                ${result.channel?.thumbnail || null}, ${result.channel?.verified || null},
                ${result.channel?.subscribers || null}, ${result.duration || null},
                ${result.email || null}
              )
              ON CONFLICT (user_id, link) DO NOTHING
            `;
            return true;
          } catch (e) {
            return false;
          }
        };
        
        // Parallel inserts with concurrency limit
        const CONCURRENCY = 20;
        for (let i = 0; i < allResults.length; i += CONCURRENCY) {
          const chunk = allResults.slice(i, i + CONCURRENCY);
          const results = await Promise.all(chunk.map(saveResult));
          savedCount += results.filter(Boolean).length;
        }
        
        console.log(`🎓 [Search/Status] Saved ${savedCount} web results to discovered_affiliates`);
      } else {
        // Not onboarding - consume credit
        if (allResults.length > 0) {
          await consumeCredits(userId, 'topic_search', 1);
          console.log(`💳 [Search/Status] Credit consumed for user ${userId}`);
        }
      }
      
      // Update job status
      await sql`
        UPDATE crewcast.search_jobs 
        SET 
          status = 'done',
          completed_at = NOW(),
          results_count = ${allResults.length}
        WHERE id = ${jobIdNum}
      `;
      
      return NextResponse.json({
        status: 'done',
        results: allResults,
        resultsCount: allResults.length,
        breakdown,
      });
    }
    
    // Start enrichment actors (non-blocking)
    console.log(`🚀 [Search/Status] Starting non-blocking enrichment actors...`);
    const newEnrichmentRunIds = await startAllEnrichment(enrichmentUrls);
    
    // Save raw_results and enrichment_run_ids to database
    await sql`
      UPDATE crewcast.search_jobs 
      SET 
        status = 'enriching',
        enrichment_status = 'running',
        enrichment_run_ids = ${JSON.stringify(newEnrichmentRunIds)}::jsonb,
        raw_results = ${JSON.stringify(fetchedRawResults)}::jsonb
      WHERE id = ${jobIdNum}
    `;
    
    console.log(`🔍 [Search/Status] Enrichment actors started, returning 'enriching' status`);
    
    // Return enriching status - client will poll again
    return NextResponse.json({
      status: 'enriching',
      message: 'Enriching results with social media data...',
    });
    
  } catch (error: any) {
    console.error('[Search/Status] Error:', error);
    
    return NextResponse.json(
      { error: error.message || 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
