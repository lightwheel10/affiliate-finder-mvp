/**
 * =============================================================================
 * ONBOARDING SCOUT API - January 29th, 2026
 * =============================================================================
 * 
 * ⚠️ DEPRECATED: January 30, 2026
 * 
 * This endpoint is kept for rollback purposes. The new implementation uses:
 * - POST /api/scout/onboarding/start → returns jobId immediately
 * - GET /api/search/status?jobId=X → polls until complete
 * 
 * The old synchronous approach caused Vercel 504 timeouts because enrichment
 * actors (YouTube, Instagram, TikTok) blocked for 20-30 seconds each.
 * 
 * TO ROLLBACK: Update OnboardingScreen.tsx to call this endpoint instead of
 * /api/scout/onboarding/start + polling.
 * 
 * =============================================================================
 * 
 * MAJOR REFACTOR: January 29th, 2026 - Apify Polling Architecture
 * 
 * PREVIOUS IMPLEMENTATION (Serper - ~30 seconds):
 * - 20 parallel Serper calls (5 topics × 4 platforms)
 * - Fast but ~30% German language accuracy
 * 
 * CURRENT IMPLEMENTATION (Apify Polling - ~70-150 seconds):
 * - Single batched Apify google-search-scraper run
 * - Poll until complete (40-95s typical)
 * - Enrich social results with Apify enrichment actors
 * - Filter results (Web: full pipeline, Social: minimal)
 * - 80-100% German language accuracy
 * - Still under Vercel 300s limit
 * 
 * PURPOSE:
 * This endpoint runs affiliate searches during onboarding AFTER payment succeeds.
 * It pre-populates the user's discovered affiliates so they see results immediately
 * when they land on the dashboard.
 * 
 * KEY DIFFERENCES FROM /api/scout:
 * 1. NO CREDIT CHECK - This is a free, in-house feature for new users
 * 2. SYNCHRONOUS - Returns only when complete (not streaming)
 * 3. DIRECT DB SAVE - Saves results directly to discovered_affiliates table
 * 
 * CRITICAL:
 * - This is a PAID CLIENT PROJECT - January 29th, 2026
 * - This endpoint MUST complete successfully for onboarding to work
 * - Frontend waits for this to complete before redirecting user
 * 
 * =============================================================================
 */

import { 
  SearchResult,
  Platform,
  filterWebResults,
  filterSocialResults,
} from '../../../services/search';
import { 
  enrichDomainsBatch,
  enrichYouTubeByUrls,
  enrichInstagramByUrls,
  enrichTikTokByUrls,
  SimilarWebData
} from '../../../services/apify';
import {
  startGoogleSearchRun,
  getRunStatus,
  fetchAndProcessResults,
} from '../../../services/apify-google-scraper';
import { sql } from '@/lib/db';

// =============================================================================
// VERCEL FUNCTION CONFIGURATION - January 29th, 2026
// 
// With Apify polling, searches take 70-150 seconds typically.
// We keep 300 seconds for safety margin (includes enrichment + SimilarWeb).
// =============================================================================
export const maxDuration = 300;

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
// TYPE DEFINITIONS - January 29th, 2026
// =============================================================================

interface OnboardingScoutRequest {
  userId: number;
  topics: string[];
  competitors?: string[];
}

interface OnboardingScoutResponse {
  success: boolean;
  totalResults: number;
  topicsSearched: number;
  platformResults: {
    web: number;
    youtube: number;
    instagram: number;
    tiktok: number;
  };
  durationMs: number;
  error?: string;
}

// =============================================================================
// HELPER: Enrich YouTube results with Apify metadata
// January 29th, 2026
// =============================================================================
async function enrichYouTubeResults(results: SearchResult[]): Promise<SearchResult[]> {
  if (results.length === 0) return results;
  
  try {
    const urls = results.map(r => r.link).filter(Boolean);
    console.log(`🎬 [Onboarding] Enriching ${urls.length} YouTube URLs...`);
    
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
    console.warn(`⚠️ [Onboarding] YouTube enrichment failed:`, error.message);
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
    console.log(`📸 [Onboarding] Enriching ${urls.length} Instagram URLs...`);
    
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
          thumbnail: apifyData.profilePicUrlHD || apifyData.profilePicUrl,
          personName: apifyData.fullName || apifyData.username,
          title: apifyData.fullName || `@${apifyData.username}` || result.title,
          snippet: apifyData.biography?.substring(0, 300) || result.snippet,
        };
      }
      return result;
    });
  } catch (error: any) {
    console.warn(`⚠️ [Onboarding] Instagram enrichment failed:`, error.message);
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
    console.log(`🎵 [Onboarding] Enriching ${urls.length} TikTok URLs...`);
    
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
    console.warn(`⚠️ [Onboarding] TikTok enrichment failed:`, error.message);
    return results;
  }
}

// =============================================================================
// HELPER: Save a single result to the database
// 
// Extracted to avoid code duplication and ensure consistent error handling.
// Returns true if saved successfully, false otherwise.
// 
// January 29th, 2026: Updated for Apify polling architecture
// =============================================================================
async function saveResultToDb(
  userId: number,
  topic: string,
  result: SearchResult
): Promise<boolean> {
  try {
    // Check for existing entry (prevent duplicates)
    const existing = await sql`
      SELECT id FROM crewcast.discovered_affiliates 
      WHERE user_id = ${userId} AND link = ${result.link}
    `;

    if (existing.length > 0) {
      return false; // Already exists
    }

    // Insert new discovered affiliate with ALL fields
    await sql`
      INSERT INTO crewcast.discovered_affiliates (
        user_id,
        search_keyword,
        title,
        link,
        domain,
        snippet,
        source,
        is_affiliate,
        summary,
        thumbnail,
        date,
        views,
        highlighted_words,
        discovery_method_type,
        discovery_method_value,
        channel_name,
        channel_link,
        channel_thumbnail,
        channel_verified,
        channel_subscribers,
        duration,
        email,
        instagram_username,
        instagram_full_name,
        instagram_bio,
        instagram_followers,
        instagram_following,
        instagram_posts_count,
        instagram_is_business,
        instagram_is_verified,
        instagram_post_likes,
        instagram_post_comments,
        instagram_post_views,
        tiktok_username,
        tiktok_display_name,
        tiktok_bio,
        tiktok_followers,
        tiktok_following,
        tiktok_likes,
        tiktok_videos_count,
        tiktok_is_verified,
        tiktok_video_plays,
        tiktok_video_likes,
        tiktok_video_comments,
        tiktok_video_shares,
        youtube_video_likes,
        youtube_video_comments
      )
      VALUES (
        ${userId},
        ${topic},
        ${result.title},
        ${result.link},
        ${result.domain},
        ${result.snippet || 'No description available'},
        ${result.source},
        ${true},
        ${'Found via onboarding search'},
        ${result.thumbnail || null},
        ${result.date || null},
        ${result.views || null},
        ${result.highlightedWords || null},
        ${'topic'},
        ${topic},
        ${result.channel?.name || null},
        ${result.channel?.link || null},
        ${result.channel?.thumbnail || null},
        ${result.channel?.verified || null},
        ${result.channel?.subscribers || null},
        ${result.duration || null},
        ${result.email || null},
        ${result.instagramUsername || null},
        ${result.instagramFullName || null},
        ${result.instagramBio || null},
        ${result.instagramFollowers || null},
        ${result.instagramFollowing || null},
        ${result.instagramPostsCount || null},
        ${result.instagramIsBusiness || null},
        ${result.instagramIsVerified || null},
        ${result.instagramPostLikes || null},
        ${result.instagramPostComments || null},
        ${result.instagramPostViews || null},
        ${result.tiktokUsername || null},
        ${result.tiktokDisplayName || null},
        ${result.tiktokBio || null},
        ${result.tiktokFollowers || null},
        ${result.tiktokFollowing || null},
        ${result.tiktokLikes || null},
        ${result.tiktokVideosCount || null},
        ${result.tiktokIsVerified || null},
        ${result.tiktokVideoPlays || null},
        ${result.tiktokVideoLikes || null},
        ${result.tiktokVideoComments || null},
        ${result.tiktokVideoShares || null},
        ${result.youtubeVideoLikes || null},
        ${result.youtubeVideoComments || null}
      )
    `;

    return true;
  } catch (error: any) {
    console.error(`[Onboarding Scout] Failed to save ${result.source} result:`, error.message);
    return false;
  }
}

// =============================================================================
// HELPER: Update web results with SimilarWeb data
// 
// January 29th, 2026: Updated for Apify polling architecture
// =============================================================================
async function updateWithSimilarWebData(
  userId: number,
  domain: string,
  swData: SimilarWebData
): Promise<boolean> {
  try {
    await sql`
      UPDATE crewcast.discovered_affiliates
      SET 
        similarweb_monthly_visits = ${swData.monthlyVisits ?? null},
        similarweb_global_rank = ${swData.globalRank ?? null},
        similarweb_country_rank = ${swData.countryRank ?? null},
        similarweb_country_code = ${swData.countryCode ?? null},
        similarweb_bounce_rate = ${swData.bounceRate ?? null},
        similarweb_pages_per_visit = ${swData.pagesPerVisit ?? null},
        similarweb_time_on_site = ${swData.timeOnSite ?? null},
        similarweb_category = ${swData.category ?? null},
        similarweb_traffic_sources = ${swData.trafficSources ? JSON.stringify(swData.trafficSources) : null},
        similarweb_top_countries = ${swData.topCountries ? JSON.stringify(swData.topCountries) : null},
        similarweb_site_title = ${swData.siteTitle ?? null},
        similarweb_site_description = ${swData.siteDescription ?? null},
        similarweb_screenshot = ${swData.screenshot ?? null},
        similarweb_category_rank = ${swData.categoryRank ?? null},
        similarweb_monthly_visits_history = ${swData.monthlyVisitsHistory ? JSON.stringify(swData.monthlyVisitsHistory) : null},
        similarweb_top_keywords = ${swData.topKeywords ? JSON.stringify(swData.topKeywords) : null},
        similarweb_snapshot_date = ${swData.snapshotDate ?? null}
      WHERE user_id = ${userId} AND domain = ${domain} AND source = 'Web'
    `;
    return true;
  } catch (error: any) {
    console.error(`[Onboarding Scout] Failed to update SimilarWeb for ${domain}:`, error.message);
    return false;
  }
}

// =============================================================================
// MAIN HANDLER - January 29th, 2026 (Apify Polling Architecture)
// =============================================================================

export async function POST(req: Request): Promise<Response> {
  const startTime = Date.now();
  
  try {
    // =========================================================================
    // PARSE REQUEST
    // =========================================================================
    const body = await req.json() as OnboardingScoutRequest;
    const { userId, topics, competitors } = body;

    // Validate required fields
    if (!userId) {
      console.error('[Onboarding Scout] Missing userId');
      return Response.json({ 
        success: false, 
        error: 'Missing userId' 
      } as OnboardingScoutResponse, { status: 400 });
    }

    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      console.error('[Onboarding Scout] Missing or empty topics array');
      return Response.json({ 
        success: false, 
        error: 'No topics provided for search' 
      } as OnboardingScoutResponse, { status: 400 });
    }

    console.log(`\n${'='.repeat(70)}`);
    console.log(`[Onboarding Scout] APIFY POLLING ARCHITECTURE - January 29th, 2026`);
    console.log(`[Onboarding Scout] User: ${userId}`);
    console.log(`[Onboarding Scout] Topics: ${topics.length}`);
    console.log(`[Onboarding Scout] Starting batched Apify search...`);
    console.log(`${'='.repeat(70)}\n`);

    // =========================================================================
    // VERIFY USER EXISTS AND GET TARGET SETTINGS
    // =========================================================================
    const userCheck = await sql`
      SELECT id, target_country, target_language, brand FROM crewcast.users WHERE id = ${userId}
    `;

    if (userCheck.length === 0) {
      console.error(`[Onboarding Scout] User ${userId} not found in database`);
      return Response.json({ 
        success: false, 
        error: 'User not found' 
      } as OnboardingScoutResponse, { status: 404 });
    }

    const targetCountry = userCheck[0].target_country as string | null;
    const targetLanguage = userCheck[0].target_language as string | null;
    const userBrand = userCheck[0].brand as string | null;

    // =========================================================================
    // APIFY POLLING ARCHITECTURE - January 29th, 2026
    // 
    // Single batched Apify run with all topics and platforms:
    // 1. Start non-blocking Apify run
    // 2. Poll until complete (40-95s typical)
    // 3. Fetch results
    // 4. Enrich social results
    // 5. Filter (Web: full pipeline, Social: minimal)
    // 6. Save to DB
    // 7. SimilarWeb enrichment for Web
    // =========================================================================
    
    const platformResults = {
      web: 0,
      youtube: 0,
      instagram: 0,
      tiktok: 0,
    };
    
    // Tracking variables
    const allWebDomains: string[] = [];

    // =========================================================================
    // STEP 1: START APIFY RUN (NON-BLOCKING)
    // 
    // January 29, 2026 FIX:
    // - Pass keywords[] and competitors[] separately (not combined)
    // - Each keyword/competitor gets separate queries for each platform
    // - Queries are fully localized (no English mixing for non-English targets)
    // =========================================================================
    const sources: Platform[] = ['Web', 'YouTube', 'Instagram', 'TikTok'];
    
    console.log(`[Onboarding Scout] Starting Apify run:`);
    console.log(`[Onboarding Scout]   Keywords (${topics.length}): ${topics.join(', ')}`);
    console.log(`[Onboarding Scout]   Competitors (${competitors?.length || 0}): ${competitors?.join(', ') || 'none'}`);
    console.log(`[Onboarding Scout]   Target: ${targetCountry || 'default'} / ${targetLanguage || 'default'}`);
    
    let runId: string;
    try {
      const runResult = await startGoogleSearchRun({
        keywords: topics,
        competitors: competitors || [],
        sources,
        targetCountry,
        targetLanguage,
      });
      runId = runResult.runId;
      console.log(`[Onboarding Scout] Apify run started: ${runId}`);
    } catch (startError: any) {
      console.error(`[Onboarding Scout] Failed to start Apify run:`, startError.message);
      return Response.json({ 
        success: false, 
        error: 'Failed to start search' 
      } as OnboardingScoutResponse, { status: 500 });
    }

    // =========================================================================
    // STEP 2: POLL UNTIL COMPLETE
    // 
    // Poll every 5 seconds until SUCCEEDED, FAILED, or ABORTED.
    // Max wait: ~150 seconds (still under Vercel 300s limit).
    // =========================================================================
    const POLL_INTERVAL_MS = 5000;
    const MAX_POLL_TIME_MS = 200000; // 200 seconds max
    const pollStartTime = Date.now();
    
    console.log(`[Onboarding Scout] Polling for completion (interval: ${POLL_INTERVAL_MS/1000}s)...`);
    
    let status = await getRunStatus(runId);
    let pollCount = 0;
    
    while (status.status === 'RUNNING') {
      const elapsed = Date.now() - pollStartTime;
      
      if (elapsed > MAX_POLL_TIME_MS) {
        console.error(`[Onboarding Scout] Apify run timed out after ${elapsed/1000}s`);
        return Response.json({ 
          success: false, 
          error: 'Search timed out' 
        } as OnboardingScoutResponse, { status: 504 });
      }
      
      await sleep(POLL_INTERVAL_MS);
      pollCount++;
      status = await getRunStatus(runId);
      
      console.log(`[Onboarding Scout] Poll #${pollCount}: ${status.status} (${Math.round(elapsed/1000)}s elapsed)`);
    }
    
    // Check for failure
    if (status.status === 'FAILED' || status.status === 'ABORTED') {
      console.error(`[Onboarding Scout] Apify run ${status.status}`);
      return Response.json({ 
        success: false, 
        error: `Search ${status.status.toLowerCase()}` 
      } as OnboardingScoutResponse, { status: 500 });
    }
    
    console.log(`[Onboarding Scout] Apify run SUCCEEDED after ${pollCount} polls`);

    // =========================================================================
    // STEP 3: FETCH RAW RESULTS
    // =========================================================================
    console.log(`[Onboarding Scout] Fetching results from Apify...`);
    
    let rawResults: SearchResult[];
    try {
      rawResults = await fetchAndProcessResults(runId, {
        targetCountry,
        targetLanguage,
      });
    } catch (fetchError: any) {
      console.error(`[Onboarding Scout] Failed to fetch results:`, fetchError.message);
      return Response.json({ 
        success: false, 
        error: 'Failed to fetch results' 
      } as OnboardingScoutResponse, { status: 500 });
    }
    
    console.log(`[Onboarding Scout] Fetched ${rawResults.length} raw results`);

    // =========================================================================
    // STEP 4: CATEGORIZE BY PLATFORM
    // =========================================================================
    let youtubeResults = rawResults.filter(r => r.source === 'YouTube');
    let instagramResults = rawResults.filter(r => r.source === 'Instagram');
    let tiktokResults = rawResults.filter(r => r.source === 'TikTok');
    let webResults = rawResults.filter(r => r.source === 'Web');
    
    console.log(`[Onboarding Scout] Raw breakdown: YouTube=${youtubeResults.length}, Instagram=${instagramResults.length}, TikTok=${tiktokResults.length}, Web=${webResults.length}`);

    // =========================================================================
    // STEP 5: ENRICH SOCIAL RESULTS
    // 
    // Run enrichment in parallel for all social platforms.
    // =========================================================================
    console.log(`[Onboarding Scout] Enriching social results...`);
    
    const [enrichedYouTube, enrichedInstagram, enrichedTikTok] = await Promise.all([
      enrichYouTubeResults(youtubeResults),
      enrichInstagramResults(instagramResults),
      enrichTikTokResults(tiktokResults),
    ]);
    
    console.log(`[Onboarding Scout] Enrichment complete`);

    // =========================================================================
    // STEP 6: APPLY FILTERING
    // 
    // Web: Full filtering (e-commerce block, language, TLD, etc.)
    // Social: Minimal filtering (enrichment required + language)
    // =========================================================================
    console.log(`[Onboarding Scout] Applying filters...`);
    
    // Filter Web results
    const filteredWeb = filterWebResults(webResults, {
      targetCountry: targetCountry || undefined,
      targetLanguage: targetLanguage || undefined,
    });
    
    // Filter Social results
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
    
    console.log(`[Onboarding Scout] Filtered: YouTube=${filteredYouTube.length}, Instagram=${filteredInstagram.length}, TikTok=${filteredTikTok.length}, Web=${filteredWeb.length}`);

    // =========================================================================
    // STEP 7: SAVE RESULTS TO DATABASE
    // 
    // Save all filtered results, collecting web domains for SimilarWeb.
    // =========================================================================
    console.log(`[Onboarding Scout] Saving results to database...`);
    
    // Use first topic as the primary search keyword for DB
    const primaryTopic = topics[0] || 'onboarding-search';
    
    // Save Web results
    for (const result of filteredWeb) {
      if (result.domain && !allWebDomains.includes(result.domain)) {
        allWebDomains.push(result.domain);
      }
      const saved = await saveResultToDb(userId, primaryTopic, result);
      if (saved) platformResults.web++;
    }
    
    // Save YouTube results
    for (const result of filteredYouTube) {
      const saved = await saveResultToDb(userId, primaryTopic, result);
      if (saved) platformResults.youtube++;
    }
    
    // Save Instagram results
    for (const result of filteredInstagram) {
      const saved = await saveResultToDb(userId, primaryTopic, result);
      if (saved) platformResults.instagram++;
    }
    
    // Save TikTok results
    for (const result of filteredTikTok) {
      const saved = await saveResultToDb(userId, primaryTopic, result);
      if (saved) platformResults.tiktok++;
    }

    const searchDuration = Date.now() - startTime;
    console.log(`\n[Onboarding Scout] ✅ All results saved in ${searchDuration}ms`);
    console.log(`[Onboarding Scout] Collected ${allWebDomains.length} unique web domains`);
    console.log(`[Onboarding Scout] Results by platform:`);
    console.log(`  - Web: ${platformResults.web}`);
    console.log(`  - YouTube: ${platformResults.youtube}`);
    console.log(`  - Instagram: ${platformResults.instagram}`);
    console.log(`  - TikTok: ${platformResults.tiktok}`);

    // =========================================================================
    // STEP 8: SIMILARWEB ENRICHMENT - January 29th, 2026
    // 
    // Now that all results are saved, enrich web domains with SimilarWeb.
    // This adds traffic stats, rankings, etc. to web affiliates.
    // =========================================================================
    if (allWebDomains.length > 0) {
      try {
        console.log(`\n[Onboarding Scout] Starting SimilarWeb enrichment for ${allWebDomains.length} domains...`);
        const similarWebData = await enrichDomainsBatch(allWebDomains, userId);
        console.log(`[Onboarding Scout] SimilarWeb returned data for ${similarWebData.size} domains`);

        // Update web results with SimilarWeb data
        let enrichedCount = 0;
        for (const [domain, swData] of similarWebData) {
          const updated = await updateWithSimilarWebData(userId, domain, swData);
          if (updated) enrichedCount++;
        }
        console.log(`[Onboarding Scout] Updated ${enrichedCount} domains with SimilarWeb data`);
        
      } catch (swError: any) {
        console.error('[Onboarding Scout] SimilarWeb enrichment failed:', swError.message);
        // Continue anyway - main results are saved
      }
    }

    // =========================================================================
    // RETURN SUCCESS
    // =========================================================================
    const totalDuration = Date.now() - startTime;
    const totalResults = platformResults.web + platformResults.youtube + 
                         platformResults.instagram + platformResults.tiktok;
    
    console.log(`\n${'='.repeat(70)}`);
    console.log(`[Onboarding Scout] COMPLETE - APIFY POLLING ARCHITECTURE`);
    console.log(`[Onboarding Scout] User: ${userId}`);
    console.log(`[Onboarding Scout] Topics: ${topics.length}`);
    console.log(`[Onboarding Scout] Total results saved: ${totalResults}`);
    console.log(`[Onboarding Scout] By platform:`);
    console.log(`  - Web: ${platformResults.web}`);
    console.log(`  - YouTube: ${platformResults.youtube}`);
    console.log(`  - Instagram: ${platformResults.instagram}`);
    console.log(`  - TikTok: ${platformResults.tiktok}`);
    console.log(`[Onboarding Scout] Duration: ${totalDuration}ms (${(totalDuration/1000).toFixed(1)}s)`);
    console.log(`[Onboarding Scout] Architecture: Apify batched run + polling`);
    console.log(`${'='.repeat(70)}\n`);

    return Response.json({
      success: true,
      totalResults,
      topicsSearched: topics.length,
      platformResults,
      durationMs: totalDuration,
    } as OnboardingScoutResponse);

  } catch (error: any) {
    const totalDuration = Date.now() - startTime;
    console.error('[Onboarding Scout] Fatal error:', error.message);
    console.error('[Onboarding Scout] Stack:', error.stack);

    return Response.json({
      success: false,
      totalResults: 0,
      topicsSearched: 0,
      platformResults: { web: 0, youtube: 0, instagram: 0, tiktok: 0 },
      durationMs: totalDuration,
      error: error.message || 'Unknown error occurred',
    } as OnboardingScoutResponse, { status: 500 });
  }
}
