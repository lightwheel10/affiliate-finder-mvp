/**
 * =============================================================================
 * AUTO-SCAN CRON ENDPOINT - January 13th, 2026
 * =============================================================================
 * 
 * This endpoint is triggered by Vercel Cron to automatically scan for new
 * affiliates for paid users.
 * 
 * HOW IT WORKS:
 * 1. Vercel Cron calls this endpoint hourly (configured in vercel.json)
 * 2. We find all users where:
 *    - status = 'active' (paid users, not trialing)
 *    - next_auto_scan_at <= NOW() (scan is due)
 * 3. For each qualifying user:
 *    - Check if they have topic_search credits available
 *    - Get their topics[] and competitors[] from onboarding data
 *    - Run searches on all platforms (Web, YouTube, Instagram, TikTok)
 *    - Save results to discovered_affiliates (duplicates auto-blocked by link)
 *    - Consume 1 topic_search credit
 *    - Update last_auto_scan_at = NOW()
 *    - Update next_auto_scan_at = NOW() + 7 days
 * 4. If no credits available, scan is skipped (user will see "No credits" state)
 * 
 * SECURITY:
 * - Protected by CRON_SECRET header (Vercel auto-sends this)
 * - Only runs on Vercel (checks for Vercel environment)
 * - Rate limited by cron schedule (max 1 execution per hour)
 * 
 * SCAN INTERVAL: 7 days for all plans (Pro, Business, Enterprise)
 * 
 * COST CONSIDERATIONS:
 * - Each user scan consumes 1 topic_search credit
 * - API costs: Serper (Web) + Apify (YouTube, Instagram, TikTok)
 * - SimilarWeb enrichment is skipped for auto-scans (cost savings)
 * 
 * =============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { checkCredits, consumeCredits } from '@/lib/credits';
import { 
  searchWeb,
  // ==========================================================================
  // January 29, 2026: CLEANUP - Removed USE_SERPER_FOR_SOCIAL conditional
  // 
  // These Serper-based functions are now the ONLY search path.
  // They use Serper for discovery (good language filtering) and call
  // Apify enrichment functions internally for metadata (followers, etc.)
  // ==========================================================================
  searchYouTubeSerper,
  searchInstagramSerper,
  searchTikTokSerper,
} from '@/app/services/search';
// January 29, 2026: CLEANUP - Removed dead Apify search function imports
import { trackSearch, completeSearch, API_COSTS } from '@/app/services/tracking';

// =============================================================================
// VERCEL FUNCTION CONFIGURATION
// Auto-scans can take time if processing multiple users
// =============================================================================
export const maxDuration = 300; // 5 minutes - Vercel Pro plan limit

// =============================================================================
// CONSTANTS
// =============================================================================
const SCAN_INTERVAL_DAYS = 7; // All plans get 7-day scan interval
const MAX_USERS_PER_RUN = 10; // Limit users per cron run to avoid timeout
const RESULTS_PER_PLATFORM = 10; // Fewer results than manual search (cost savings)

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
  console.log('[AutoScan] Starting auto-scan cron job...');
  console.log(`[AutoScan] Time: ${new Date().toISOString()}`);
  
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
        u.target_language
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
        
        // Build search keywords from topics + competitors
        const searchKeywords = buildSearchKeywords(topics, competitors);
        console.log(`[AutoScan] User ${userId}: Searching ${searchKeywords.length} keywords`);
        
        // Run the scan
        const scanResult = await runAutoScan(userId, searchKeywords);
        
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
// HELPER: Build search keywords from topics and competitors
// =============================================================================
function buildSearchKeywords(topics: string[], competitors: string[]): string[] {
  const keywords: string[] = [];
  
  // Add topics directly as search keywords
  topics.forEach(topic => {
    if (topic.trim()) {
      keywords.push(topic.trim());
    }
  });
  
  // Add competitor-based keywords (e.g., "competitor.com alternatives")
  competitors.forEach(competitor => {
    if (competitor.trim()) {
      // Extract brand name from domain if possible
      const domain = competitor.trim().toLowerCase();
      const brandName = domain
        .replace(/^www\./, '')
        .replace(/\.(com|io|co|net|org|app).*$/, '');
      
      if (brandName) {
        keywords.push(`${brandName} alternative`);
        keywords.push(`${brandName} competitor`);
      }
    }
  });
  
  // Remove duplicates and limit to 5 keywords max
  return [...new Set(keywords)].slice(0, 5);
}

// =============================================================================
// HELPER: Run auto-scan for a user
// =============================================================================
async function runAutoScan(
  userId: number,
  keywords: string[]
): Promise<{ totalResults: number; totalCost: number }> {
  let totalResults = 0;
  let totalCost = 0;
  
  // Combine all keywords into one search string for tracking
  const combinedKeyword = keywords.join(' | ');
  
  // Track the search
  const searchId = await trackSearch({
    userId,
    keyword: `[AUTO-SCAN] ${combinedKeyword}`,
    sources: ['Web', 'YouTube', 'Instagram', 'TikTok'],
  });
  
  // Process each keyword
  for (const keyword of keywords) {
    try {
      // =========================================================================
      // January 29, 2026: CLEANUP - Simplified (removed dead code path)
      // 
      // All social media searches now use Serper for discovery (language-filtered)
      // plus Apify enrichment for metadata (followers, bio, etc.)
      // =========================================================================
      const [webResults, youtubeResults, instagramResults, tiktokResults] = await Promise.all([
        searchWeb(keyword).catch(() => []),
        searchYouTubeSerper(keyword, userId, RESULTS_PER_PLATFORM, null, null).catch(() => []),
        searchInstagramSerper(keyword, userId, RESULTS_PER_PLATFORM, null, null).catch(() => []),
        searchTikTokSerper(keyword, userId, RESULTS_PER_PLATFORM, null, null).catch(() => []),
      ]);
      
      // Calculate costs - Serper for all 4 searches
      totalCost += API_COSTS.serper * 4; // Web + YouTube + Instagram + TikTok
      
      // Combine all results
      const allResults = [
        ...webResults,
        ...youtubeResults,
        ...instagramResults,
        ...tiktokResults,
      ];
      
      // Save to discovered_affiliates (duplicates auto-blocked by link)
      for (const result of allResults) {
        try {
          await saveDiscoveredAffiliate(userId, combinedKeyword, result);
          totalResults++;
        } catch (saveError) {
          // Ignore duplicate errors, log others
          const errorMsg = saveError instanceof Error ? saveError.message : '';
          if (!errorMsg.includes('duplicate')) {
            console.error(`[AutoScan] Failed to save affiliate: ${errorMsg}`);
          }
        }
      }
      
    } catch (keywordError) {
      console.error(`[AutoScan] Keyword "${keyword}" failed:`, keywordError);
      // Continue with other keywords
    }
  }
  
  // Complete the search tracking
  if (searchId) {
    await completeSearch(searchId, totalResults, totalCost);
  }
  
  return { totalResults, totalCost };
}

// =============================================================================
// HELPER: Save discovered affiliate to database
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
    instagramUsername?: string;
    instagramFullName?: string;
    instagramBio?: string;
    instagramFollowers?: number;
    instagramFollowing?: number;
    instagramPostsCount?: number;
    instagramIsBusiness?: boolean;
    instagramIsVerified?: boolean;
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
      instagram_username, instagram_full_name, instagram_bio,
      instagram_followers, instagram_following, instagram_posts_count,
      instagram_is_business, instagram_is_verified,
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
      ${result.instagramUsername || null}, ${result.instagramFullName || null}, ${result.instagramBio || null},
      ${result.instagramFollowers || null}, ${result.instagramFollowing || null}, ${result.instagramPostsCount || null},
      ${result.instagramIsBusiness || null}, ${result.instagramIsVerified || null},
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
