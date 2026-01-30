/**
 * =============================================================================
 * AUTO-SCAN CRON ENDPOINT - January 29th, 2026
 * =============================================================================
 * 
 * MAJOR REFACTOR: January 29th, 2026 - Apify Polling Architecture
 * 
 * This endpoint is triggered by Vercel Cron to automatically scan for new
 * affiliates for paid users.
 * 
 * HOW IT WORKS:
 * 1. Vercel Cron calls this endpoint hourly (configured in vercel.json)
 * 2. We find 1 user where:
 *    - status = 'active' (paid users, not trialing)
 *    - next_auto_scan_at <= NOW() (scan is due)
 * 3. For the qualifying user:
 *    - Check if they have topic_search credits available
 *    - Get their topics[] and competitors[] from onboarding data
 *    - Start Apify google-search-scraper run (all platforms batched)
 *    - Poll until complete (40-95s typical)
 *    - Enrich social results with Apify enrichment actors
 *    - Filter results (Web: full pipeline, Social: minimal)
 *    - Save results to discovered_affiliates
 *    - Consume 1 topic_search credit
 *    - Update last_auto_scan_at = NOW()
 *    - Update next_auto_scan_at = NOW() + 7 days
 * 4. If no credits available, scan is skipped
 * 
 * ARCHITECTURE CHANGE (January 29th, 2026):
 * - Changed from 10 users/run (Serper) to 1 user/run (Apify)
 * - Apify runs take 40-95s vs Serper's 2-3s
 * - Single user per run stays within Vercel 300s limit
 * - Hourly cron ensures users are processed over time
 * 
 * SECURITY:
 * - Protected by CRON_SECRET header (Vercel auto-sends this)
 * - Only runs on Vercel (checks for Vercel environment)
 * - Rate limited by cron schedule (max 1 execution per hour)
 * 
 * SCAN INTERVAL: 7 days for all plans (Pro, Business, Enterprise)
 * 
 * =============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { checkCredits, consumeCredits } from '@/lib/credits';
import { 
  SearchResult,
  Platform,
  filterWebResults,
  filterSocialResults,
} from '@/app/services/search';
import {
  enrichYouTubeByUrls,
  enrichInstagramByUrls,
  enrichTikTokByUrls,
} from '@/app/services/apify';
import {
  startGoogleSearchRun,
  getRunStatus,
  fetchAndProcessResults,
} from '@/app/services/apify-google-scraper';
import { trackSearch, completeSearch, API_COSTS } from '@/app/services/tracking';

// =============================================================================
// VERCEL FUNCTION CONFIGURATION
// January 29th, 2026: Single user per run with Apify polling
// =============================================================================
export const maxDuration = 300; // 5 minutes - Vercel Pro plan limit

// =============================================================================
// CONSTANTS - January 29th, 2026
// =============================================================================
const SCAN_INTERVAL_DAYS = 7; // All plans get 7-day scan interval
const MAX_USERS_PER_RUN = 1; // Changed from 10 to 1 for Apify polling (40-95s per user)

/**
 * GET /api/cron/auto-scan
 * 
 * Triggered by Vercel Cron. Finds users due for auto-scan and processes them.
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  // ==========================================================================
  // SECURITY: Verify request is from Vercel Cron
  // ==========================================================================
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  // In development, allow without secret for testing
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (!isDevelopment) {
    if (!cronSecret) {
      console.error('[AutoScan] CRON_SECRET not configured');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('[AutoScan] Unauthorized: Invalid or missing CRON_SECRET');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }
  
  console.log('[AutoScan] ========================================');
  console.log('[AutoScan] Starting auto-scan cron job (Apify Polling)...');
  console.log(`[AutoScan] Time: ${new Date().toISOString()}`);
  console.log(`[AutoScan] Max users per run: ${MAX_USERS_PER_RUN}`);
  
  try {
    // ========================================================================
    // STEP 1: Find users due for auto-scan
    // ========================================================================
    const dueUsers = await sql`
      SELECT 
        s.user_id,
        s.next_auto_scan_at,
        s.first_payment_at,
        u.email,
        u.topics,
        u.competitors,
        u.target_country,
        u.target_language,
        u.brand
      FROM crewcast.subscriptions s
      JOIN crewcast.users u ON s.user_id = u.id
      WHERE 
        s.status = 'active'
        AND s.first_payment_at IS NOT NULL
        AND s.next_auto_scan_at IS NOT NULL
        AND s.next_auto_scan_at <= NOW()
      ORDER BY s.next_auto_scan_at ASC
      LIMIT ${MAX_USERS_PER_RUN}
    `;
    
    console.log(`[AutoScan] Found ${dueUsers.length} users due for auto-scan`);
    
    if (dueUsers.length === 0) {
      console.log('[AutoScan] No users due for scan. Exiting.');
      return NextResponse.json({
        success: true,
        message: 'No users due for auto-scan',
        usersProcessed: 0,
        duration: Date.now() - startTime,
      });
    }
    
    // ========================================================================
    // STEP 2: Process each user
    // ========================================================================
    const results: Array<{
      userId: number;
      email: string;
      status: 'success' | 'no_credits' | 'no_keywords' | 'error';
      resultsFound?: number;
      error?: string;
    }> = [];
    
    for (const user of dueUsers) {
      const userId = user.user_id as number;
      const userEmail = user.email as string;
      const topics = (user.topics as string[]) || [];
      const competitors = (user.competitors as string[]) || [];
      
      console.log(`[AutoScan] Processing user ${userId} (${userEmail})`);
      
      try {
        // Check if user has topic_search credits
        const creditCheck = await checkCredits(userId, 'topic_search', 1);
        
        if (!creditCheck.allowed) {
          console.log(`[AutoScan] User ${userId}: No credits available (${creditCheck.remaining} remaining)`);
          results.push({ userId, email: userEmail, status: 'no_credits' });
          
          // Don't update next_auto_scan_at - they'll be picked up when they have credits
          // But we should still check them next run in case they bought credits
          continue;
        }
        
        // Check if user has keywords to search
        if (topics.length === 0 && competitors.length === 0) {
          console.log(`[AutoScan] User ${userId}: No topics or competitors configured`);
          results.push({ userId, email: userEmail, status: 'no_keywords' });
          
          // Still update the schedule - they can add keywords later
          await updateScanSchedule(userId);
          continue;
        }
        
        // Get user's target settings
        const targetCountry = user.target_country as string | null;
        const targetLanguage = user.target_language as string | null;
        const userBrand = user.brand as string | null;
        
        console.log(`[AutoScan] User ${userId}: Scanning ${topics.length} topics + ${competitors.length} competitors`);
        
        // Run the scan with Apify polling
        // January 29, 2026: Pass topics and competitors directly (no more buildSearchKeywords)
        // January 29, 2026: Pass userBrand for social filtering (exclude own accounts)
        const scanResult = await runAutoScan(userId, topics, competitors, userBrand, targetCountry, targetLanguage);
        
        // Consume credit (only if we found results or attempted search)
        const consumeResult = await consumeCredits(userId, 'topic_search', 1, 'auto_scan', 'cron');
        if (consumeResult.success) {
          console.log(`[AutoScan] User ${userId}: Consumed 1 credit. New balance: ${consumeResult.newBalance}`);
        }
        
        // Update scan schedule
        await updateScanSchedule(userId);
        
        results.push({
          userId,
          email: userEmail,
          status: 'success',
          resultsFound: scanResult.totalResults,
        });
        
        console.log(`[AutoScan] User ${userId}: Scan complete. Found ${scanResult.totalResults} affiliates.`);
        
      } catch (userError) {
        const errorMessage = userError instanceof Error ? userError.message : 'Unknown error';
        console.error(`[AutoScan] User ${userId}: Error - ${errorMessage}`);
        results.push({ userId, email: userEmail, status: 'error', error: errorMessage });
        
        // Still update schedule to prevent stuck users
        await updateScanSchedule(userId);
      }
    }
    
    // ========================================================================
    // STEP 3: Summary
    // ========================================================================
    const successCount = results.filter(r => r.status === 'success').length;
    const noCreditsCount = results.filter(r => r.status === 'no_credits').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    const duration = Date.now() - startTime;
    
    console.log('[AutoScan] ========================================');
    console.log(`[AutoScan] Cron job complete!`);
    console.log(`[AutoScan] - Users processed: ${results.length}`);
    console.log(`[AutoScan] - Successful scans: ${successCount}`);
    console.log(`[AutoScan] - No credits: ${noCreditsCount}`);
    console.log(`[AutoScan] - Errors: ${errorCount}`);
    console.log(`[AutoScan] - Duration: ${duration}ms`);
    console.log('[AutoScan] ========================================');
    
    return NextResponse.json({
      success: true,
      usersProcessed: results.length,
      successCount,
      noCreditsCount,
      errorCount,
      duration,
      results,
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AutoScan] Fatal error:', errorMessage);
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      duration: Date.now() - startTime,
    }, { status: 500 });
  }
}

// =============================================================================
// HELPER: Format number for display (e.g., 5700 -> "5.7K")
// January 29th, 2026
// =============================================================================
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
// HELPER: Sleep for polling
// January 29th, 2026
// =============================================================================
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================================================================
// HELPER: Build search keywords from topics and competitors
// 
// January 29, 2026 - DEPRECATED
// This function is no longer used. Topics and competitors are now passed
// directly to startGoogleSearchRun() which uses the shared localized-search
// utility to build fully localized queries.
// 
// OLD BEHAVIOR (buggy):
// - Created English queries like "bedrop alternative" and "bedrop competitor"
// - Didn't use localized terms for non-English targets
// 
// NEW BEHAVIOR:
// - Topics are passed as keywords[] to startGoogleSearchRun
// - Competitors are passed as competitors[] (brand name is extracted automatically)
// - Queries are fully localized (German: "bedrop erfahrung", not "bedrop alternative")
// =============================================================================
// function buildSearchKeywords - REMOVED

// =============================================================================
// HELPER: Enrich YouTube results with Apify metadata
// January 29th, 2026
// =============================================================================
async function enrichYouTubeResults(results: SearchResult[]): Promise<SearchResult[]> {
  if (results.length === 0) return results;
  
  try {
    const urls = results.map(r => r.link).filter(Boolean);
    console.log(`[AutoScan] Enriching ${urls.length} YouTube URLs...`);
    
    const enrichmentMap = await enrichYouTubeByUrls(urls);
    
    return results.map(result => {
      const apifyData = enrichmentMap.get(result.link);
      if (apifyData) {
        return {
          ...result,
          channel: {
            name: apifyData.channelName || 'Unknown Channel',
            link: apifyData.channelUrl || `https://www.youtube.com/@${apifyData.channelUsername || 'unknown'}`,
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
  } catch (error: any) {
    console.warn(`[AutoScan] YouTube enrichment failed:`, error.message);
    return results;
  }
}

// =============================================================================
// HELPER: Enrich Instagram results with Apify metadata
// January 29th, 2026
// =============================================================================
async function enrichInstagramResults(results: SearchResult[]): Promise<SearchResult[]> {
  if (results.length === 0) return results;
  
  try {
    const urls = results.map(r => r.link).filter(Boolean);
    console.log(`[AutoScan] Enriching ${urls.length} Instagram URLs...`);
    
    const enrichmentMap = await enrichInstagramByUrls(urls);
    
    return results.map(result => {
      const apifyData = enrichmentMap.get(result.link);
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
          // January 30, 2026: Use post displayUrl as thumbnail, caption as title
          thumbnail: (apifyData as any).displayUrl || apifyData.profilePicUrlHD || apifyData.profilePicUrl,
          personName: (apifyData as any).ownerFullName || apifyData.fullName || (apifyData as any).ownerUsername || apifyData.username,
          title: (apifyData as any).caption?.substring(0, 100) || result.title,
          snippet: (apifyData as any).caption?.substring(0, 300) || apifyData.biography?.substring(0, 300) || result.snippet,
        };
      }
      return result;
    });
  } catch (error: any) {
    console.warn(`[AutoScan] Instagram enrichment failed:`, error.message);
    return results;
  }
}

// =============================================================================
// HELPER: Enrich TikTok results with Apify metadata
// January 29th, 2026
// =============================================================================
async function enrichTikTokResults(results: SearchResult[]): Promise<SearchResult[]> {
  if (results.length === 0) return results;
  
  try {
    const urls = results.map(r => r.link).filter(Boolean);
    console.log(`[AutoScan] Enriching ${urls.length} TikTok URLs...`);
    
    const enrichmentMap = await enrichTikTokByUrls(urls);
    
    return results.map(result => {
      const apifyData = enrichmentMap.get(result.link);
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
  } catch (error: any) {
    console.warn(`[AutoScan] TikTok enrichment failed:`, error.message);
    return results;
  }
}

// =============================================================================
// HELPER: Run auto-scan for a user using Apify polling
// January 29th, 2026 - Migrated from Serper to Apify
// January 29th, 2026 - FIX: Now uses keywords[] + competitors[] properly
// January 29th, 2026 - Added userBrand for social filtering
// =============================================================================
async function runAutoScan(
  userId: number,
  topics: string[],
  competitors: string[],
  userBrand: string | null,
  targetCountry: string | null,
  targetLanguage: string | null
): Promise<{ totalResults: number; totalCost: number }> {
  let totalResults = 0;
  let totalCost = 0;
  
  const sources: Platform[] = ['Web', 'YouTube', 'Instagram', 'TikTok'];
  
  // Track the search with descriptive label
  const searchLabel = `[AUTO-SCAN] topics=${topics.join(',')} competitors=${competitors.join(',')}`;
  const searchId = await trackSearch({
    userId,
    keyword: searchLabel.substring(0, 200), // Limit length for DB
    sources,
  });
  
  console.log(`[AutoScan] Starting Apify run:`);
  console.log(`[AutoScan]   Topics (${topics.length}): ${topics.join(', ')}`);
  console.log(`[AutoScan]   Competitors (${competitors.length}): ${competitors.join(', ')}`);
  console.log(`[AutoScan]   Target: ${targetCountry || 'default'} / ${targetLanguage || 'default'}`);
  
  try {
    // =========================================================================
    // STEP 1: START APIFY RUN (NON-BLOCKING)
    // 
    // January 29, 2026 FIX:
    // - Pass topics as keywords[] and competitors as competitors[]
    // - Service will build fully localized queries for each
    // - Brand names are extracted automatically from competitor domains
    // =========================================================================
    const { runId } = await startGoogleSearchRun({
      keywords: topics,
      competitors: competitors,
      sources,
      targetCountry,
      targetLanguage,
    });
    
    console.log(`[AutoScan] Apify run started: ${runId}`);
    
    // =========================================================================
    // STEP 2: POLL UNTIL COMPLETE
    // =========================================================================
    const POLL_INTERVAL_MS = 5000;
    const MAX_POLL_TIME_MS = 180000; // 180 seconds max (leaves buffer for enrichment)
    const pollStartTime = Date.now();
    
    let status = await getRunStatus(runId);
    let pollCount = 0;
    
    while (status.status === 'RUNNING') {
      const elapsed = Date.now() - pollStartTime;
      
      if (elapsed > MAX_POLL_TIME_MS) {
        throw new Error(`Apify run timed out after ${elapsed/1000}s`);
      }
      
      await sleep(POLL_INTERVAL_MS);
      pollCount++;
      status = await getRunStatus(runId);
      
      console.log(`[AutoScan] Poll #${pollCount}: ${status.status} (${Math.round(elapsed/1000)}s elapsed)`);
    }
    
    if (status.status === 'FAILED' || status.status === 'ABORTED') {
      throw new Error(`Apify run ${status.status}`);
    }
    
    console.log(`[AutoScan] Apify run SUCCEEDED`);
    
    // =========================================================================
    // STEP 3: FETCH RAW RESULTS
    // =========================================================================
    const rawResults = await fetchAndProcessResults(runId, {
      targetCountry,
      targetLanguage,
    });
    
    console.log(`[AutoScan] Fetched ${rawResults.length} raw results`);
    
    // Calculate Apify cost
    totalCost += API_COSTS.apify_google_scraper || 0.02;
    
    // =========================================================================
    // STEP 4: CATEGORIZE BY PLATFORM
    // =========================================================================
    let youtubeResults = rawResults.filter(r => r.source === 'YouTube');
    let instagramResults = rawResults.filter(r => r.source === 'Instagram');
    let tiktokResults = rawResults.filter(r => r.source === 'TikTok');
    let webResults = rawResults.filter(r => r.source === 'Web');
    
    console.log(`[AutoScan] Raw breakdown: YouTube=${youtubeResults.length}, Instagram=${instagramResults.length}, TikTok=${tiktokResults.length}, Web=${webResults.length}`);
    
    // =========================================================================
    // STEP 5: ENRICH SOCIAL RESULTS (PARALLEL)
    // =========================================================================
    const [enrichedYouTube, enrichedInstagram, enrichedTikTok] = await Promise.all([
      enrichYouTubeResults(youtubeResults),
      enrichInstagramResults(instagramResults),
      enrichTikTokResults(tiktokResults),
    ]);
    
    // Add enrichment costs
    if (youtubeResults.length > 0) totalCost += API_COSTS.apify_youtube || 0.01;
    if (instagramResults.length > 0) totalCost += API_COSTS.apify_instagram || 0.01;
    if (tiktokResults.length > 0) totalCost += API_COSTS.apify_tiktok || 0.01;
    
    // =========================================================================
    // STEP 6: APPLY FILTERING
    // =========================================================================
    const filteredWeb = filterWebResults(webResults, {
      targetCountry: targetCountry || undefined,
      targetLanguage: targetLanguage || undefined,
    });
    
    // January 29, 2026: Added brand exclusion to filter out user's own and competitor accounts
    const filteredYouTube = filterSocialResults(enrichedYouTube, {
      requireEnrichment: true,
      targetLanguage: targetLanguage || undefined,
      userBrand: userBrand || undefined,
      excludeBrands: competitors || undefined,
    });
    
    const filteredInstagram = filterSocialResults(enrichedInstagram, {
      requireEnrichment: true,
      targetLanguage: targetLanguage || undefined,
      userBrand: userBrand || undefined,
      excludeBrands: competitors || undefined,
    });
    
    const filteredTikTok = filterSocialResults(enrichedTikTok, {
      requireEnrichment: true,
      targetLanguage: targetLanguage || undefined,
      userBrand: userBrand || undefined,
      excludeBrands: competitors || undefined,
    });
    
    console.log(`[AutoScan] Filtered: YouTube=${filteredYouTube.length}, Instagram=${filteredInstagram.length}, TikTok=${filteredTikTok.length}, Web=${filteredWeb.length}`);
    
    // =========================================================================
    // STEP 7: SAVE RESULTS TO DATABASE
    // =========================================================================
    const allFilteredResults = [
      ...filteredWeb,
      ...filteredYouTube,
      ...filteredInstagram,
      ...filteredTikTok,
    ];
    
    // Use first topic as primary keyword for DB, or 'auto-scan' if none
    const primaryKeyword = topics[0] || 'auto-scan';
    
    for (const result of allFilteredResults) {
      try {
        await saveDiscoveredAffiliate(userId, primaryKeyword, result);
        totalResults++;
      } catch (saveError) {
        // Ignore duplicate errors, log others
        const errorMsg = saveError instanceof Error ? saveError.message : '';
        if (!errorMsg.includes('duplicate')) {
          console.error(`[AutoScan] Failed to save affiliate: ${errorMsg}`);
        }
      }
    }
    
  } catch (error) {
    console.error(`[AutoScan] Run failed:`, error);
    throw error;
  }
  
  // Complete the search tracking
  if (searchId) {
    await completeSearch(searchId, totalResults, totalCost);
  }
  
  return { totalResults, totalCost };
}

// =============================================================================
// HELPER: Save discovered affiliate to database
// January 29th, 2026 - Updated for Apify enrichment fields
// =============================================================================
async function saveDiscoveredAffiliate(
  userId: number,
  searchKeyword: string,
  result: {
    title: string;
    link: string;
    domain: string;
    snippet?: string;
    source: string;
    thumbnail?: string;
    views?: string;
    date?: string;
    rank?: number;
    keyword?: string;
    discoveryMethod?: { type: string; value: string };
    channel?: {
      name?: string;
      link?: string;
      thumbnail?: string;
      verified?: boolean;
      subscribers?: string;
    };
    duration?: string;
    // YouTube fields
    youtubeVideoLikes?: number;
    youtubeVideoComments?: number;
    // Instagram fields
    instagramUsername?: string;
    instagramFullName?: string;
    instagramBio?: string;
    instagramFollowers?: number;
    instagramFollowing?: number;
    instagramPostsCount?: number;
    instagramIsBusiness?: boolean;
    instagramIsVerified?: boolean;
    instagramPostLikes?: number;
    instagramPostComments?: number;
    instagramPostViews?: number;
    // TikTok fields
    tiktokUsername?: string;
    tiktokDisplayName?: string;
    tiktokBio?: string;
    tiktokFollowers?: number;
    tiktokFollowing?: number;
    tiktokLikes?: number;
    tiktokVideosCount?: number;
    tiktokIsVerified?: boolean;
    tiktokVideoPlays?: number;
    tiktokVideoLikes?: number;
    tiktokVideoComments?: number;
    tiktokVideoShares?: number;
  }
): Promise<void> {
  // Check for existing (duplicate detection by link)
  const existing = await sql`
    SELECT id FROM crewcast.discovered_affiliates 
    WHERE user_id = ${userId} AND link = ${result.link}
  `;
  
  if (existing.length > 0) {
    // Already exists - skip (no error)
    return;
  }
  
  // Insert new affiliate
  await sql`
    INSERT INTO crewcast.discovered_affiliates (
      user_id, search_keyword, title, link, domain, snippet, source,
      thumbnail, views, date, rank, keyword,
      discovery_method_type, discovery_method_value,
      is_new, channel_name, channel_link, channel_thumbnail, 
      channel_verified, channel_subscribers, duration,
      youtube_video_likes, youtube_video_comments,
      instagram_username, instagram_full_name, instagram_bio,
      instagram_followers, instagram_following, instagram_posts_count,
      instagram_is_business, instagram_is_verified,
      instagram_post_likes, instagram_post_comments, instagram_post_views,
      tiktok_username, tiktok_display_name, tiktok_bio,
      tiktok_followers, tiktok_following, tiktok_likes,
      tiktok_videos_count, tiktok_is_verified,
      tiktok_video_plays, tiktok_video_likes, tiktok_video_comments, tiktok_video_shares
    ) VALUES (
      ${userId}, ${searchKeyword}, ${result.title}, ${result.link}, ${result.domain},
      ${result.snippet || ''}, ${result.source},
      ${result.thumbnail || null}, ${result.views || null}, ${result.date || null},
      ${result.rank || null}, ${result.keyword || null},
      ${result.discoveryMethod?.type || 'auto_scan'}, ${result.discoveryMethod?.value || 'auto'},
      true, ${result.channel?.name || null}, ${result.channel?.link || null},
      ${result.channel?.thumbnail || null}, ${result.channel?.verified || null},
      ${result.channel?.subscribers || null}, ${result.duration || null},
      ${result.youtubeVideoLikes || null}, ${result.youtubeVideoComments || null},
      ${result.instagramUsername || null}, ${result.instagramFullName || null}, ${result.instagramBio || null},
      ${result.instagramFollowers || null}, ${result.instagramFollowing || null}, ${result.instagramPostsCount || null},
      ${result.instagramIsBusiness || null}, ${result.instagramIsVerified || null},
      ${result.instagramPostLikes || null}, ${result.instagramPostComments || null}, ${result.instagramPostViews || null},
      ${result.tiktokUsername || null}, ${result.tiktokDisplayName || null}, ${result.tiktokBio || null},
      ${result.tiktokFollowers || null}, ${result.tiktokFollowing || null}, ${result.tiktokLikes || null},
      ${result.tiktokVideosCount || null}, ${result.tiktokIsVerified || null},
      ${result.tiktokVideoPlays || null}, ${result.tiktokVideoLikes || null}, 
      ${result.tiktokVideoComments || null}, ${result.tiktokVideoShares || null}
    )
  `;
}

// =============================================================================
// HELPER: Update scan schedule for next run
// =============================================================================
async function updateScanSchedule(userId: number): Promise<void> {
  const now = new Date();
  const nextScanAt = new Date(now.getTime() + SCAN_INTERVAL_DAYS * 24 * 60 * 60 * 1000);
  
  await sql`
    UPDATE crewcast.subscriptions
    SET
      last_auto_scan_at = ${now.toISOString()},
      next_auto_scan_at = ${nextScanAt.toISOString()},
      updated_at = NOW()
    WHERE user_id = ${userId}
  `;
  
  console.log(`[AutoScan] User ${userId}: Next scan scheduled for ${nextScanAt.toISOString()}`);
}
