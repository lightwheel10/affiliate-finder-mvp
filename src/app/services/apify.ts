/**
 * Apify Scraper Service
 * Provides rich data from YouTube, Instagram, TikTok, and SimilarWeb
 * 
 * Actor IDs:
 * - YouTube: h7sDV53CddomktSi5 (streamers/youtube-scraper)
 * - Instagram: DrF9mzPPEuVizVF4l (apify/instagram-search-scraper)
 * - TikTok: GdWCkxBtKWOsKjdch (clockworks/tiktok-scraper)
 * - SimilarWeb: yOYYzj2J5K88boIVO (curious_coder/similarweb-scraper)
 */

import { ApifyClient } from 'apify-client';
import { trackApiCall, API_COSTS } from './tracking';
import { SearchResult, YouTubeChannelInfo, Platform } from './search';
import { getLocationConfig } from './location';

// =============================================================================
// APIFY CLIENT INITIALIZATION - Updated 29th December 2025
// 
// The ApifyClient SDK has built-in retry and timeout handling. We configure it
// here with sensible defaults to handle rate limits and transient failures
// gracefully without needing custom exponential backoff logic.
// =============================================================================
const APIFY_TOKEN = process.env.APIFY_API_TOKEN;

if (!APIFY_TOKEN) {
  console.warn('⚠️ Missing APIFY_API_TOKEN in environment variables');
}

// 29th Dec 2025: Added retry configuration for rate limit handling (REV-61)
// - maxRetries: Retry up to 3 times on transient failures
// - timeoutSecs: 180 seconds max for long-running actor calls (SimilarWeb batch can take time)
// These are sensible defaults - not extreme. The SDK handles exponential backoff internally.
const client = APIFY_TOKEN 
  ? new ApifyClient({ 
      token: APIFY_TOKEN,
      maxRetries: 3,        // Retry failed requests up to 3 times
      timeoutSecs: 180,     // 3-minute timeout for actor runs
    }) 
  : null;

// =============================================================================
// APIFY ACTOR IDs
// 
// Each platform has one or more actors for different use cases:
// - youtube: Video/channel scraper (keyword search OR URL enrichment)
// - instagram: Search scraper (keyword search only, NOT for URL enrichment)
// - instagramProfile: Profile scraper (URL enrichment) - Added January 28, 2026
// - tiktok: Video/profile scraper (keyword search OR URL enrichment)
// - similarweb: Website traffic data
// =============================================================================
const ACTORS = {
  youtube: 'h7sDV53CddomktSi5',
  instagram: 'DrF9mzPPEuVizVF4l',           // Search actor (keyword-based only)
  instagramProfile: 'shu8hvrXbJbY3Eb9W',    // Profile actor (URL-based) - January 28, 2026
  tiktok: 'GdWCkxBtKWOsKjdch',
  similarweb: 'yOYYzj2J5K88boIVO',
} as const;

// =============================================================================
// KEYWORD SANITIZATION FOR SOCIAL MEDIA - January 16, 2026
// 
// Instagram and TikTok search APIs reject keywords with special characters.
// Instagram pattern: ^[^!?.,:;\-+=*&%$#@/\~^|<>()[\]{}"'`]+
// 
// For domain-like keywords (bedrop.de), we:
// 1. Remove the TLD (.de, .com, etc.)
// 2. Keep only alphanumeric characters and spaces
// =============================================================================
function sanitizeKeywordForSocialMedia(keyword: string): string {
  // Remove protocol and www
  let cleaned = keyword
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '');
  
  // Remove TLD (everything after the last dot if it looks like a domain)
  if (/\.(com|de|co\.uk|net|org|io|shop|store|eu|at|ch|fr|es|it|nl|be|pl|se|no|dk|fi)$/i.test(cleaned)) {
    cleaned = cleaned.replace(/\.[a-z]{2,}$/i, '');
  }
  
  // Remove all special characters, keep only alphanumeric and spaces
  cleaned = cleaned.replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
  
  // Collapse multiple spaces
  cleaned = cleaned.replace(/\s+/g, ' ');
  
  console.log(`🧹 Sanitized keyword for social media: "${keyword}" → "${cleaned}"`);
  return cleaned;
}

// Helper to format numbers (e.g., 5700 -> "5.7K")
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
// EMAIL EXTRACTION FROM BIO TEXT - Added January 14, 2026
// =============================================================================
// 
// PURPOSE:
// Many social media creators include their business email in their bio for
// collaboration inquiries. This function extracts those emails using regex
// pattern matching, providing immediate contact info without paid enrichment.
// 
// HOW IT WORKS:
// Uses a standard email regex pattern that matches text@domain.extension format.
// The pattern works regardless of:
//   - Bio length or format
//   - Position of email in text
//   - Surrounding emojis, text, or special characters
//   - Language of the bio
// 
// EXAMPLES FROM REAL TIKTOK BIOS:
//   "💌ashisatthegym.biz@gmail.com" → ashisatthegym.biz@gmail.com
//   "📧: kayymrose@gmail.com"       → kayymrose@gmail.com  
//   "Business: Jordan@company.com" → Jordan@company.com
// 
// RETURNS:
//   - First email found (string) if one exists
//   - undefined if no email found
// 
// NOTE: Only returns the FIRST email if multiple are present. This is
// intentional as the first email is typically the primary contact.
// =============================================================================

/**
 * Extract the first email address from a text string (e.g., bio, description)
 * 
 * @param text - The text to search for an email (bio, signature, description)
 * @returns The first email found, or undefined if none found
 * 
 * @example
 * extractEmailFromText("Contact: hello@example.com") // → "hello@example.com"
 * extractEmailFromText("No email here 🌴")           // → undefined
 */
function extractEmailFromText(text: string | undefined | null): string | undefined {
  if (!text) return undefined;
  
  // Standard email regex pattern
  // Matches: local-part@domain.tld
  // Examples: user@example.com, my.name+tag@sub.domain.co.uk
  const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  
  const matches = text.match(EMAIL_REGEX);
  
  // Return first match or undefined
  return matches && matches.length > 0 ? matches[0] : undefined;
}

// ============================================================================
// YOUTUBE SCRAPER
// ============================================================================

interface ApifyYouTubeResult {
  title: string;
  url: string;
  thumbnailUrl?: string;
  viewCount?: number;
  likes?: number;
  commentsCount?: number;
  duration?: string;
  date?: string;
  uploadDate?: string;
  channelName?: string;
  channelUrl?: string;
  channelUsername?: string;
  numberOfSubscribers?: number;
  isVerified?: boolean;
  text?: string;
}

/**
 * Search YouTube videos using Apify scraper
 * Returns rich data including subscriber counts and engagement metrics
 * 
 * @param targetCountry - Optional country from onboarding for localized results
 *                        Added January 16, 2026
 */
export async function searchYouTubeApify(
  keyword: string,
  userId?: number,
  maxResults: number = 10,
  targetCountry?: string | null
): Promise<SearchResult[]> {
  if (!client) {
    console.error('❌ Apify client not initialized');
    return [];
  }

  const startTime = Date.now();
  
  // ==========================================================================
  // LOCATION-BASED QUERY - January 16, 2026
  // 
  // Appends country shortName to search query for localized results.
  // Example: "propolis" + Germany → "propolis Germany"
  // Example: "organic skincare" + UK → "organic skincare UK"
  // ==========================================================================
  const locationConfig = getLocationConfig(targetCountry, null);
  const searchQuery = locationConfig 
    ? `${keyword} ${locationConfig.shortName}`
    : keyword;

  console.log(`🎬 Apify YouTube search: "${searchQuery}" (location: ${locationConfig?.shortName || 'global'})`);

  try {
    const run = await client.actor(ACTORS.youtube).call({
      searchQueries: [searchQuery],
      maxResults,
      maxResultsShorts: 0,
      maxResultStreams: 0,
    });

    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    const results = items as unknown as ApifyYouTubeResult[];

    console.log(`✅ Apify YouTube: ${results.length} videos found`);

    // Track API call
    if (userId) {
      await trackApiCall({
        userId,
        service: 'apify_youtube',
        endpoint: ACTORS.youtube,
        keyword,
        status: 'success',
        resultsCount: results.length,
        estimatedCost: results.length * API_COSTS.apify_youtube,
        apifyRunId: run.id,
        durationMs: Date.now() - startTime,
      });
    }

    return results.map((item, index): SearchResult => {
      const channel: YouTubeChannelInfo | undefined = item.channelName ? {
        name: item.channelName,
        link: item.channelUrl || `https://www.youtube.com/@${item.channelUsername || item.channelName}`,
        verified: item.isVerified,
        subscribers: item.numberOfSubscribers ? formatNumber(item.numberOfSubscribers) : undefined,
      } : undefined;

      return {
        title: item.title || '',
        link: item.url || '',
        snippet: item.text?.substring(0, 300) || '',
        source: 'YouTube' as Platform,
        domain: 'youtube.com',
        thumbnail: item.thumbnailUrl,
        views: item.viewCount ? formatNumber(item.viewCount) : undefined,
        date: item.date || item.uploadDate,
        duration: item.duration,
        channel,
        position: index + 1,
        searchQuery: keyword,
        // YouTube-specific video stats (Added Dec 2025)
        youtubeVideoLikes: item.likes,
        youtubeVideoComments: item.commentsCount,
      };
    });

  } catch (error: any) {
    console.error('❌ Apify YouTube error:', error.message);

    if (userId) {
      await trackApiCall({
        userId,
        service: 'apify_youtube',
        endpoint: ACTORS.youtube,
        keyword,
        status: 'error',
        errorMessage: error.message,
        durationMs: Date.now() - startTime,
      });
    }

    return [];
  }
}

// ============================================================================
// YOUTUBE URL ENRICHMENT - January 27, 2026
// 
// PURPOSE:
// Enriches YouTube video URLs with full channel/video metadata from Apify.
// Used in hybrid search flow: Serper (language filtering) → Apify (enrichment).
// 
// WHY THIS EXISTS:
// - Serper returns YouTube results with good language accuracy (~90%)
// - But Serper only provides: title, link, snippet, date
// - Apify can enrich with: subscribers, views, likes, comments, duration, thumbnail
// - This function bridges the gap: take Serper URLs, get Apify metadata
// 
// INPUT:
// - Array of YouTube video URLs (from Serper results)
// - e.g., ["https://www.youtube.com/watch?v=VIDEO_ID", ...]
// 
// OUTPUT:
// - Map<string, ApifyYouTubeResult> keyed by video URL
// - Allows O(1) lookup to merge with Serper results
// 
// ERROR HANDLING:
// - Returns empty Map on complete failure (graceful degradation)
// - Individual video failures are logged but don't block other results
// ============================================================================

/**
 * Enrich YouTube video URLs with full metadata from Apify.
 * 
 * This function takes video URLs (typically from Serper search results)
 * and fetches complete channel and video metadata from YouTube via Apify.
 * 
 * @param videoUrls - Array of YouTube video URLs to enrich
 * @param userId - Optional user ID for API cost tracking
 * @returns Map of video URL to enriched YouTube data
 * 
 * @example
 * const urls = ['https://www.youtube.com/watch?v=VIDEO_ID'];
 * const enriched = await enrichYouTubeByUrls(urls, userId);
 * const data = enriched.get(urls[0]); // Full YouTube data
 */
export async function enrichYouTubeByUrls(
  videoUrls: string[],
  userId?: number
): Promise<Map<string, ApifyYouTubeResult>> {
  const results = new Map<string, ApifyYouTubeResult>();

  // Guard: Check if Apify client is initialized
  if (!client) {
    console.error('❌ [YouTube Enrichment] Apify client not initialized');
    return results;
  }

  // Guard: No URLs to process
  if (!videoUrls || videoUrls.length === 0) {
    console.log('⚠️ [YouTube Enrichment] No URLs to enrich');
    return results;
  }

  // Filter to valid YouTube video URLs only
  // Accepts both youtube.com/watch?v=ID and m.youtube.com/watch?v=ID
  const validUrls = videoUrls.filter(url => 
    url && (url.includes('youtube.com/watch') || url.includes('youtu.be/'))
  );

  if (validUrls.length === 0) {
    console.log('⚠️ [YouTube Enrichment] No valid YouTube video URLs found');
    return results;
  }

  const startTime = Date.now();
  console.log(`🎬 [YouTube Enrichment] Enriching ${validUrls.length} video URLs via Apify...`);

  try {
    // Call the YouTube scraper with startUrls input
    // This is the same actor used for keyword search, but with different input
    const run = await client.actor(ACTORS.youtube).call({
      startUrls: validUrls.map(url => ({ url })),
      maxResults: 1,  // We only want data for the specific videos
      maxResultsShorts: 0,
      maxResultStreams: 0,
    });

    // Fetch results from dataset
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    const apifyResults = items as unknown as ApifyYouTubeResult[];

    console.log(`✅ [YouTube Enrichment] Received ${apifyResults.length}/${validUrls.length} results`);

    // Build Map keyed by video URL for O(1) lookup
    for (const item of apifyResults) {
      // Use the URL from the result if available
      const videoUrl = item.url;
      if (videoUrl) {
        results.set(videoUrl, item);
      }
    }

    // Also map by submitted URL (in case URL format differs slightly)
    // This handles edge cases where URL format differs between Serper and Apify
    // e.g., youtube.com vs www.youtube.com vs m.youtube.com
    for (const inputUrl of validUrls) {
      if (!results.has(inputUrl)) {
        // Try to find a match by video ID
        const videoIdMatch = inputUrl.match(/[?&]v=([^&]+)/) || inputUrl.match(/youtu\.be\/([^?]+)/);
        if (videoIdMatch) {
          const videoId = videoIdMatch[1];
          for (const item of apifyResults) {
            // Check if the video ID matches
            if (item.url?.includes(videoId) || item.url?.includes(`v=${videoId}`)) {
              results.set(inputUrl, item);
              break;
            }
          }
        }
      }
    }

    const durationMs = Date.now() - startTime;
    console.log(`✅ [YouTube Enrichment] Complete: ${results.size}/${validUrls.length} URLs enriched in ${durationMs}ms`);

    // Track API call for cost monitoring
    if (userId) {
      await trackApiCall({
        userId,
        service: 'apify_youtube',
        endpoint: ACTORS.youtube,
        status: 'success',
        resultsCount: results.size,
        estimatedCost: validUrls.length * API_COSTS.apify_youtube,
        apifyRunId: run.id,
        durationMs,
      });
    }

    return results;

  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    console.error('❌ [YouTube Enrichment] Apify error:', error.message);

    // Track failed API call
    if (userId) {
      await trackApiCall({
        userId,
        service: 'apify_youtube',
        endpoint: ACTORS.youtube,
        status: 'error',
        errorMessage: error.message,
        durationMs,
      });
    }

    // Return empty Map on error - caller should handle gracefully
    return results;
  }
}

// ============================================================================
// INSTAGRAM URL ENRICHMENT - January 28, 2026
// 
// PURPOSE:
// Enriches Instagram URLs (posts, reels, profiles) with full profile metadata
// from Apify. Used in hybrid search flow: Serper (language filtering) → 
// Apify (enrichment).
// 
// WHY THIS EXISTS:
// - Serper returns Instagram results with good language accuracy (~90%)
// - But Serper only provides: title, link, snippet, date
// - Serper returns mostly post/reel URLs (~92%), not profile URLs
// - Apify can enrich ANY URL type and return the author's full profile:
//   - Username, full name, bio
//   - Followers, following, posts count
//   - Business account status, verified badge
//   - Latest posts with engagement data
// 
// INPUT:
// - Array of Instagram URLs (from Serper results)
// - e.g., ["https://www.instagram.com/p/ABC123/", "https://www.instagram.com/user/reel/XYZ/"]
// 
// OUTPUT:
// - Map<string, ApifyInstagramProfileResult> keyed by input URL
// - Allows O(1) lookup to merge with Serper results
// 
// ERROR HANDLING:
// - Returns empty Map on complete failure (graceful degradation)
// - Individual URL failures are logged but don't block other results
// - Private accounts may return limited data
// 
// ACTOR USED:
// - shu8hvrXbJbY3Eb9W (instagram-scraper, NOT instagram-search-scraper)
// - Accepts: directUrls input
// - Returns: Full profile data for the content author
// ============================================================================

/**
 * Enrich Instagram URLs with full profile metadata from Apify.
 * 
 * This function takes Instagram URLs (posts, reels, or profiles) from Serper
 * search results and fetches complete profile metadata from the content author.
 * 
 * @param instagramUrls - Array of Instagram URLs to enrich
 * @param userId - Optional user ID for API cost tracking
 * @returns Map of input URL to enriched profile data
 * 
 * @example
 * const urls = ['https://www.instagram.com/p/ABC123/'];
 * const enriched = await enrichInstagramByUrls(urls, userId);
 * const data = enriched.get(urls[0]); // Full profile data of the post author
 */
export async function enrichInstagramByUrls(
  instagramUrls: string[],
  userId?: number
): Promise<Map<string, ApifyInstagramProfileResult>> {
  const results = new Map<string, ApifyInstagramProfileResult>();

  // Guard: Check if Apify client is initialized
  if (!client) {
    console.error('❌ [Instagram Enrichment] Apify client not initialized');
    return results;
  }

  // Guard: No URLs to process
  if (!instagramUrls || instagramUrls.length === 0) {
    console.log('⚠️ [Instagram Enrichment] No URLs to enrich');
    return results;
  }

  // Filter to valid Instagram URLs only
  // Accepts: posts (/p/), reels (/reel/), and profile URLs
  const filteredUrls = instagramUrls.filter(url => 
    url && url.includes('instagram.com')
  );

  // IMPORTANT: Deduplicate URLs - Apify rejects duplicate items
  // Serper can return the same URL multiple times across pages
  const validUrls = [...new Set(filteredUrls)];

  if (validUrls.length === 0) {
    console.log('⚠️ [Instagram Enrichment] No valid Instagram URLs found');
    return results;
  }

  const startTime = Date.now();
  const dedupeCount = filteredUrls.length - validUrls.length;
  console.log(`📸 [Instagram Enrichment] Enriching ${validUrls.length} URLs via Apify...${dedupeCount > 0 ? ` (${dedupeCount} duplicates removed)` : ''}`);

  try {
    // Call the Instagram profile scraper with directUrls input
    // IMPORTANT: Using instagramProfile actor (shu8hvrXbJbY3Eb9W), NOT instagram actor
    const run = await client.actor(ACTORS.instagramProfile).call({
      directUrls: validUrls,
      resultsType: 'details',  // Get full profile details
      resultsLimit: 1,         // We only need profile data, not posts
      addParentData: false,    // We don't need parent data for enrichment
    });

    // Fetch results from dataset
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    const apifyResults = items as unknown as ApifyInstagramProfileResult[];

    console.log(`✅ [Instagram Enrichment] Received ${apifyResults.length}/${validUrls.length} results`);

    // Build Map keyed by input URL for O(1) lookup
    // The actor returns inputUrl field which matches what we submitted
    for (const item of apifyResults) {
      if (item.inputUrl) {
        results.set(item.inputUrl, item);
      }
      // Also map by the profile URL if different from inputUrl
      if (item.url && item.url !== item.inputUrl) {
        results.set(item.url, item);
      }
    }

    // Also try to map by username for flexible matching
    // This handles edge cases where URL format differs between Serper and Apify
    for (const inputUrl of validUrls) {
      if (!results.has(inputUrl)) {
        // Try to find a match by username extracted from URL
        const usernameMatch = inputUrl.match(/instagram\.com\/([^\/\?]+)/);
        if (usernameMatch && usernameMatch[1]) {
          const urlUsername = usernameMatch[1].toLowerCase();
          // Skip special paths
          if (!['p', 'reel', 'reels', 'stories', 'explore', 'tv'].includes(urlUsername)) {
            for (const item of apifyResults) {
              if (item.username?.toLowerCase() === urlUsername) {
                results.set(inputUrl, item);
                break;
              }
            }
          }
        }
      }
    }

    const durationMs = Date.now() - startTime;
    console.log(`✅ [Instagram Enrichment] Complete: ${results.size}/${validUrls.length} URLs enriched in ${durationMs}ms`);

    // Track API call for cost monitoring
    // Note: Using 'apify_instagram' service type for consistency with existing tracking
    if (userId) {
      await trackApiCall({
        userId,
        service: 'apify_instagram',
        endpoint: ACTORS.instagramProfile,
        status: 'success',
        resultsCount: results.size,
        estimatedCost: validUrls.length * API_COSTS.apify_instagram,
        apifyRunId: run.id,
        durationMs,
      });
    }

    return results;

  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    console.error('❌ [Instagram Enrichment] Apify error:', error.message);

    // Track failed API call
    if (userId) {
      await trackApiCall({
        userId,
        service: 'apify_instagram',
        endpoint: ACTORS.instagramProfile,
        status: 'error',
        errorMessage: error.message,
        durationMs,
      });
    }

    // Return empty Map on error - caller should handle gracefully
    return results;
  }
}

// ============================================================================
// INSTAGRAM SCRAPER
// ============================================================================

interface ApifyInstagramResult {
  username?: string;
  fullName?: string;
  url?: string;
  biography?: string;
  followersCount?: number;
  followsCount?: number;
  postsCount?: number;
  verified?: boolean;
  isVerified?: boolean;
  isBusinessAccount?: boolean;
  businessCategoryName?: string;
  profilePicUrl?: string;
  profilePicUrlHD?: string;
  latestPosts?: Array<{
    id: string;
    type: string;
    url: string;
    likesCount?: number;
    commentsCount?: number;
    videoViewCount?: number;
    timestamp?: string;
    displayUrl?: string;
    caption?: string;
  }>;
}

// ============================================================================
// INSTAGRAM PROFILE ACTOR RESPONSE - January 28, 2026
// 
// This interface defines the response from the Instagram Profile actor
// (shu8hvrXbJbY3Eb9W) which accepts URLs via directUrls input.
// 
// IMPORTANT: This actor is different from the search actor (DrF9mzPPEuVizVF4l).
// - Search actor: Takes keywords, returns profile search results
// - Profile actor: Takes URLs (posts, reels, profiles), returns full profile data
// 
// The profile actor can accept:
// - Post URLs: instagram.com/p/ABC123/
// - Reel URLs: instagram.com/reel/ABC123/
// - Profile URLs: instagram.com/username/
// 
// All URL types return the AUTHOR's full profile data.
// ============================================================================
interface ApifyInstagramProfileResult {
  // Input URL that was processed
  inputUrl: string;
  
  // Profile identification
  id?: string;
  username: string;
  url?: string;
  
  // Profile details
  fullName?: string;
  biography?: string;
  externalUrl?: string;
  externalUrls?: string[];
  
  // Follower/following stats
  followersCount?: number;
  followsCount?: number;
  postsCount?: number;
  
  // Account type and status
  isBusinessAccount?: boolean;
  businessCategoryName?: string;
  private?: boolean;
  verified?: boolean;
  joinedRecently?: boolean;
  
  // Profile images
  profilePicUrl?: string;
  profilePicUrlHD?: string;
  
  // Additional data
  hasChannel?: boolean;
  highlightReelCount?: number;
  igtvVideoCount?: number;
  
  // Related profiles (for discovery)
  relatedProfiles?: Array<{
    username: string;
    fullName?: string;
    profilePicUrl?: string;
  }>;
  
  // Latest posts with engagement data
  latestPosts?: Array<{
    id: string;
    type: string;
    shortCode: string;
    caption?: string;
    url: string;
    likesCount?: number;
    commentsCount?: number;
    videoViewCount?: number;
    timestamp?: string;
    displayUrl?: string;
    ownerUsername?: string;
    ownerId?: string;
  }>;
  
  // Facebook integration
  fbid?: string;
}

/**
 * Search Instagram users/profiles using Apify scraper
 * Returns rich profile data including followers and recent posts
 * 
 * @param targetCountry - Optional country from onboarding for localized results
 *                        Added January 16, 2026
 */
export async function searchInstagramApify(
  keyword: string,
  userId?: number,
  searchLimit: number = 10,
  targetCountry?: string | null
): Promise<SearchResult[]> {
  if (!client) {
    console.error('❌ Apify client not initialized');
    return [];
  }

  const startTime = Date.now();
  
  // Sanitize keyword - Instagram rejects special characters like . in domains
  const sanitizedKeyword = sanitizeKeywordForSocialMedia(keyword);
  
  // ==========================================================================
  // LOCATION-BASED QUERY - January 16, 2026
  // 
  // Appends country shortName to search query for localized results.
  // Instagram searches for USER PROFILES (searchType: 'user'), so adding
  // country helps find local influencers/businesses.
  // Example: "propolis" + Germany → "propolis Germany"
  // ==========================================================================
  const locationConfig = getLocationConfig(targetCountry, null);
  const searchQuery = locationConfig 
    ? `${sanitizedKeyword} ${locationConfig.shortName}`
    : sanitizedKeyword;

  console.log(`📸 Apify Instagram search: "${searchQuery}" (location: ${locationConfig?.shortName || 'global'})`);

  try {
    const run = await client.actor(ACTORS.instagram).call({
      search: searchQuery,
      searchType: 'user',
      searchLimit,
    });

    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    const results = items as ApifyInstagramResult[];

    console.log(`✅ Apify Instagram: ${results.length} profiles found`);

    // Track API call
    if (userId) {
      await trackApiCall({
        userId,
        service: 'apify_instagram',
        endpoint: ACTORS.instagram,
        keyword,
        status: 'success',
        resultsCount: results.length,
        estimatedCost: results.length * API_COSTS.apify_instagram,
        apifyRunId: run.id,
        durationMs: Date.now() - startTime,
      });
    }

    // ==========================================================================
    // FIX: Now returning all Instagram-specific fields from Apify response
    // Previously, this data was lost because SearchResult didn't have these fields
    // The data now flows: Apify → SearchResult → ResultItem → Database
    // 
    // UPDATED January 26, 2026: Filter out invalid results with no username
    // Apify sometimes returns incomplete profiles - these would show "@undefined"
    // in the UI which is confusing. We now skip these entirely.
    // ==========================================================================
    
    // Filter out results with no username - these are invalid/incomplete profiles
    const validResults = results.filter(item => {
      if (!item.username) {
        console.log(`⚠️ Skipping Instagram result with no username:`, item.fullName || 'unknown');
        return false;
      }
      return true;
    });
    
    console.log(`📸 Instagram: ${validResults.length}/${results.length} valid profiles (${results.length - validResults.length} skipped)`);
    
    return validResults.map((item, index): SearchResult => {
      // Build snippet from bio and stats
      // FIX: January 15th, 2026 - Ensure snippet is never empty to avoid NOT NULL violation
      // The database column 'snippet' has a NOT NULL constraint, and empty strings
      // were being converted to null in the INSERT statement (using || null).
      const stats = [];
      if (item.followersCount) stats.push(`${formatNumber(item.followersCount)} followers`);
      if (item.postsCount) stats.push(`${formatNumber(item.postsCount)} posts`);
      const snippetParts = [
        item.biography?.substring(0, 200),
        stats.length > 0 ? `📊 ${stats.join(' • ')}` : null,
      ].filter(Boolean);
      // Provide fallback if no bio or stats available
      // Note: username is guaranteed to exist due to filter above
      const snippet = snippetParts.length > 0 
        ? snippetParts.join('\n') 
        : `Instagram profile: @${item.username}`;

      // Extract first (most recent) post stats from latestPosts array
      const firstPost = item.latestPosts?.[0];

      // ========================================================================
      // INSTAGRAM BIO EMAIL - Updated January 24, 2026
      // 
      // IMPORTANT: We NO LONGER extract bio email here and store it in the
      // `email` field. This was causing users to see "email found" for free
      // without clicking "Find Email" or paying credits.
      // 
      // The bio is stored in `instagramBio` field. When user clicks "Find Email",
      // the email is extracted from the bio at that point and credits are charged.
      // 
      // This ensures consistent monetization: all email discoveries cost credits.
      // ========================================================================
      // const bioEmail = extractEmailFromText(item.biography); // REMOVED - now done on-demand

      // Build title safely - username is guaranteed to exist due to filter above
      const title = item.fullName || `@${item.username}`;

      return {
        title,
        link: item.url || `https://www.instagram.com/${item.username}`,
        snippet,
        source: 'Instagram' as Platform,
        domain: 'instagram.com',
        thumbnail: item.profilePicUrlHD || item.profilePicUrl,
        views: item.followersCount ? formatNumber(item.followersCount) : undefined,
        position: index + 1,
        searchQuery: keyword,
        personName: item.fullName || item.username,
        
        // January 24, 2026: REMOVED bio email from this field
        // Email is now extracted on-demand when user clicks "Find Email" (charges 1 credit)
        // email: undefined,
        
        // Instagram-specific fields - these are now properly passed through the pipeline
        // and will be saved to the database columns: instagram_username, instagram_followers, etc.
        instagramUsername: item.username,
        instagramFullName: item.fullName,
        instagramBio: item.biography,
        instagramFollowers: item.followersCount,
        instagramFollowing: item.followsCount,
        instagramPostsCount: item.postsCount,
        instagramIsBusiness: item.isBusinessAccount,
        instagramIsVerified: item.verified ?? item.isVerified,
        // Instagram post-level stats (from most recent post - Added Dec 2025)
        instagramPostLikes: firstPost?.likesCount,
        instagramPostComments: firstPost?.commentsCount,
        instagramPostViews: firstPost?.videoViewCount,
      };
    });

  } catch (error: any) {
    console.error('❌ Apify Instagram error:', error.message);

    if (userId) {
      await trackApiCall({
        userId,
        service: 'apify_instagram',
        endpoint: ACTORS.instagram,
        keyword,
        status: 'error',
        errorMessage: error.message,
        durationMs: Date.now() - startTime,
      });
    }

    return [];
  }
}

// ============================================================================
// TIKTOK SCRAPER
// ============================================================================

interface ApifyTikTokResult {
  id: string;
  text?: string;
  webVideoUrl?: string;
  playCount?: number;
  diggCount?: number;
  commentCount?: number;
  shareCount?: number;
  collectCount?: number;
  createTimeISO?: string;
  authorMeta?: {
    name?: string;
    nickName?: string;
    profileUrl?: string;
    fans?: number;
    heart?: number;
    video?: number;
    verified?: boolean;
    signature?: string;
    avatar?: string;
  };
  videoMeta?: {
    coverUrl?: string;
    duration?: number;
  };
}

/**
 * Search TikTok videos using Apify scraper
 * Returns rich data including creator stats and video metrics
 * 
 * @param targetCountry - Optional country from onboarding for localized results
 *                        Added January 16, 2026
 */
export async function searchTikTokApify(
  keyword: string,
  userId?: number,
  resultsPerPage: number = 10,
  targetCountry?: string | null
): Promise<SearchResult[]> {
  if (!client) {
    console.error('❌ Apify client not initialized');
    return [];
  }

  const startTime = Date.now();
  
  // Sanitize keyword - TikTok may also reject special characters
  const sanitizedKeyword = sanitizeKeywordForSocialMedia(keyword);
  
  // ==========================================================================
  // LOCATION-BASED QUERY - January 16, 2026
  // 
  // Appends country shortName to search query for localized results.
  // Example: "propolis" + Germany → "propolis Germany"
  // Example: "fitness" + UK → "fitness UK"
  // ==========================================================================
  const locationConfig = getLocationConfig(targetCountry, null);
  const searchQuery = locationConfig 
    ? `${sanitizedKeyword} ${locationConfig.shortName}`
    : sanitizedKeyword;

  console.log(`🎵 Apify TikTok search: "${searchQuery}" (location: ${locationConfig?.shortName || 'global'})`);

  try {
    const run = await client.actor(ACTORS.tiktok).call({
      searchQueries: [searchQuery],
      resultsPerPage,
      maxProfilesPerQuery: resultsPerPage,
    });

    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    const results = items as unknown as ApifyTikTokResult[];

    console.log(`✅ Apify TikTok: ${results.length} videos found`);

    // Track API call
    if (userId) {
      await trackApiCall({
        userId,
        service: 'apify_tiktok',
        endpoint: ACTORS.tiktok,
        keyword,
        status: 'success',
        resultsCount: results.length,
        estimatedCost: results.length * API_COSTS.apify_tiktok,
        apifyRunId: run.id,
        durationMs: Date.now() - startTime,
      });
    }

    // ==========================================================================
    // FIX: Now returning all TikTok-specific fields from Apify response
    // Previously, this data was lost because SearchResult didn't have these fields
    // The data now flows: Apify → SearchResult → ResultItem → Database
    // 
    // UPDATED January 26, 2026: Filter out invalid results with no author info
    // Apify sometimes returns incomplete videos - these would show "@undefined"
    // in the UI which is confusing. We now skip these entirely.
    // ==========================================================================
    
    // Filter out results with no author username - these are invalid/incomplete
    const validResults = results.filter(item => {
      if (!item.authorMeta?.name) {
        console.log(`⚠️ Skipping TikTok result with no author:`, item.text?.substring(0, 30) || 'unknown video');
        return false;
      }
      return true;
    });
    
    console.log(`🎵 TikTok: ${validResults.length}/${results.length} valid videos (${results.length - validResults.length} skipped)`);
    
    return validResults.map((item, index): SearchResult => {
      // Note: author is guaranteed to exist with name due to filter above
      const author = item.authorMeta!;
      
      // ========================================================================
      // BIO EMAIL EXTRACTION - Updated January 24, 2026
      // 
      // IMPORTANT: We NO LONGER extract bio email here and store it in the
      // `email` field. This was causing users to see "email found" for free
      // without clicking "Find Email" or paying credits.
      // 
      // The bio is stored in `tiktokBio` field. When user clicks "Find Email",
      // the email is extracted from the bio at that point and credits are charged.
      // 
      // This ensures consistent monetization: all email discoveries cost credits.
      // ========================================================================
      // const bioEmail = extractEmailFromText(author?.signature); // REMOVED - now done on-demand
      
      // Build snippet from video text and author stats
      // FIX: January 15th, 2026 - Ensure snippet is never empty to avoid NOT NULL violation
      const stats = [];
      if (item.playCount) stats.push(`${formatNumber(item.playCount)} views`);
      if (item.diggCount) stats.push(`${formatNumber(item.diggCount)} likes`);
      if (author.fans) stats.push(`${formatNumber(author.fans)} followers`);
      
      const snippetParts = [
        item.text?.substring(0, 200),
        stats.length > 0 ? `📊 ${stats.join(' • ')}` : null,
      ].filter(Boolean);
      // Provide fallback if no text or stats available
      // Note: author.name is guaranteed to exist due to filter above
      const snippet = snippetParts.length > 0 
        ? snippetParts.join('\n') 
        : `TikTok video by @${author.name}`;

      // Create a channel-like object for TikTok creator (kept for backward compatibility)
      // Note: author is guaranteed to exist with name due to filter above
      const channel: YouTubeChannelInfo = {
        name: author.nickName || author.name!, // name is guaranteed by filter
        link: author.profileUrl || `https://www.tiktok.com/@${author.name}`,
        thumbnail: author.avatar,
        verified: author.verified,
        subscribers: author.fans ? formatNumber(author.fans) : undefined,
      };

      return {
        title: item.text?.substring(0, 100) || 'TikTok Video',
        link: item.webVideoUrl || '',
        snippet,
        source: 'TikTok' as Platform,
        domain: 'tiktok.com',
        thumbnail: item.videoMeta?.coverUrl || author.avatar,
        views: item.playCount ? formatNumber(item.playCount) : undefined,
        date: item.createTimeISO,
        duration: item.videoMeta?.duration ? `${Math.floor(item.videoMeta.duration / 60)}:${(item.videoMeta.duration % 60).toString().padStart(2, '0')}` : undefined,
        channel,
        position: index + 1,
        searchQuery: keyword,
        personName: author.nickName || author.name,
        
        // ======================================================================
        // January 24, 2026: REMOVED bio email from this field
        // 
        // Previously: email: bioEmail (extracted from bio and stored for free)
        // Now: email is undefined here - extracted on-demand when user pays
        // 
        // The bio is stored in tiktokBio field and email is extracted when
        // user clicks "Find Email" button (charges 1 credit).
        // ======================================================================
        // email: undefined, // Bio email extracted on-demand, not stored here
        
        // TikTok-specific fields - these are now properly passed through the pipeline
        // and will be saved to the database columns: tiktok_username, tiktok_followers, etc.
        tiktokUsername: author?.name,
        tiktokDisplayName: author?.nickName,
        tiktokBio: author?.signature,
        tiktokFollowers: author?.fans,
        tiktokLikes: author?.heart,
        tiktokVideosCount: author?.video,
        tiktokIsVerified: author?.verified,
        // Video-specific metrics for the discovered video
        tiktokVideoPlays: item.playCount,
        tiktokVideoLikes: item.diggCount,
        tiktokVideoComments: item.commentCount,
        tiktokVideoShares: item.shareCount,
      };
    });

  } catch (error: any) {
    console.error('❌ Apify TikTok error:', error.message);

    if (userId) {
      await trackApiCall({
        userId,
        service: 'apify_tiktok',
        endpoint: ACTORS.tiktok,
        keyword,
        status: 'error',
        errorMessage: error.message,
        durationMs: Date.now() - startTime,
      });
    }

    return [];
  }
}

// ============================================================================
// TIKTOK URL ENRICHMENT - January 27, 2026
// 
// PURPOSE:
// Enriches TikTok video URLs with full author/video metadata from Apify.
// Used in hybrid search flow: Serper (language filtering) → Apify (enrichment).
// 
// WHY THIS EXISTS:
// - Serper returns TikTok results with good language accuracy (~90%)
// - But Serper only provides: title, link, snippet, date
// - Apify can enrich with: followers, bio, email, video stats, verified status
// - This function bridges the gap: take Serper URLs, get Apify metadata
// 
// INPUT:
// - Array of TikTok video URLs (from Serper results)
// - e.g., ["https://www.tiktok.com/@username/video/7123456789", ...]
// 
// OUTPUT:
// - Map<string, ApifyTikTokResult> keyed by video URL
// - Allows O(1) lookup to merge with Serper results
// 
// ERROR HANDLING:
// - Returns empty Map on complete failure (graceful degradation)
// - Individual video failures are logged but don't block other results
// - Private/deleted videos return error field but are still in Map
// ============================================================================

/**
 * Enrich TikTok video URLs with full metadata from Apify.
 * 
 * This function takes video URLs (typically from Serper search results)
 * and fetches complete author and video metadata from TikTok via Apify.
 * 
 * @param videoUrls - Array of TikTok video URLs to enrich
 * @param userId - Optional user ID for API cost tracking
 * @returns Map of video URL to enriched TikTok data
 * 
 * @example
 * const urls = ['https://www.tiktok.com/@user/video/123'];
 * const enriched = await enrichTikTokByUrls(urls, userId);
 * const data = enriched.get(urls[0]); // Full TikTok data
 */
export async function enrichTikTokByUrls(
  videoUrls: string[],
  userId?: number
): Promise<Map<string, ApifyTikTokResult>> {
  const results = new Map<string, ApifyTikTokResult>();

  // Guard: Check if Apify client is initialized
  if (!client) {
    console.error('❌ [TikTok Enrichment] Apify client not initialized');
    return results;
  }

  // Guard: No URLs to process
  if (!videoUrls || videoUrls.length === 0) {
    console.log('⚠️ [TikTok Enrichment] No URLs to enrich');
    return results;
  }

  // Filter to valid TikTok video URLs only
  const validUrls = videoUrls.filter(url => 
    url && url.includes('tiktok.com') && url.includes('/video/')
  );

  if (validUrls.length === 0) {
    console.log('⚠️ [TikTok Enrichment] No valid TikTok video URLs found');
    return results;
  }

  const startTime = Date.now();
  console.log(`🎵 [TikTok Enrichment] Enriching ${validUrls.length} video URLs via Apify...`);

  try {
    // Call the TikTok scraper with postURLs input
    // This is the same actor used for keyword search, but with different input
    const run = await client.actor(ACTORS.tiktok).call({
      postURLs: validUrls,
      resultsPerPage: 1,  // We only need the video data, not more from each author
    });

    // Fetch results from dataset
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    const apifyResults = items as unknown as ApifyTikTokResult[];

    console.log(`✅ [TikTok Enrichment] Received ${apifyResults.length}/${validUrls.length} results`);

    // Build Map keyed by video URL for O(1) lookup
    for (const item of apifyResults) {
      // Use webVideoUrl if available, otherwise try to find matching input URL
      const videoUrl = item.webVideoUrl;
      if (videoUrl) {
        results.set(videoUrl, item);
      }
    }

    // Also map by submitted URL (in case webVideoUrl differs slightly)
    // This handles edge cases where URL format differs between Serper and Apify
    for (const inputUrl of validUrls) {
      if (!results.has(inputUrl)) {
        // Try to find a match by video ID
        const videoIdMatch = inputUrl.match(/\/video\/(\d+)/);
        if (videoIdMatch) {
          const videoId = videoIdMatch[1];
          for (const item of apifyResults) {
            if (item.id === videoId || item.webVideoUrl?.includes(videoId)) {
              results.set(inputUrl, item);
              break;
            }
          }
        }
      }
    }

    const durationMs = Date.now() - startTime;
    console.log(`✅ [TikTok Enrichment] Complete: ${results.size}/${validUrls.length} URLs enriched in ${durationMs}ms`);

    // Track API call for cost monitoring
    // Note: Using 'apify_tiktok' service type since it's the same actor
    if (userId) {
      await trackApiCall({
        userId,
        service: 'apify_tiktok',
        endpoint: ACTORS.tiktok,
        status: 'success',
        resultsCount: results.size,
        estimatedCost: validUrls.length * API_COSTS.apify_tiktok,
        apifyRunId: run.id,
        durationMs,
      });
    }

    return results;

  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    console.error('❌ [TikTok Enrichment] Apify error:', error.message);

    // Track failed API call
    if (userId) {
      await trackApiCall({
        userId,
        service: 'apify_tiktok',
        endpoint: ACTORS.tiktok,
        status: 'error',
        errorMessage: error.message,
        durationMs,
      });
    }

    // Return empty Map on error - caller should handle gracefully
    return results;
  }
}

// ============================================================================
// SIMILARWEB SCRAPER
// ============================================================================

export interface SimilarWebData {
  domain: string;
  monthlyVisits: number;
  monthlyVisitsFormatted: string;
  globalRank: number | null;
  countryRank: number | null;
  countryCode: string | null;
  bounceRate: number;
  pagesPerVisit: number;
  timeOnSite: number;
  trafficSources: {
    direct: number;
    search: number;
    social: number;
    referrals: number;
    mail: number;
    paid: number;
  };
  topCountries: Array<{
    countryCode: string;
    share: number;
  }>;
  category: string | null;
  // NEW FIELDS - Dec 2025
  siteTitle: string | null;
  siteDescription: string | null;
  screenshot: string | null;
  categoryRank: number | null;
  monthlyVisitsHistory: { [date: string]: number } | null;
  topKeywords: Array<{
    name: string;
    estimatedValue: number;
    cpc: number | null;
  }> | null;
  snapshotDate: string | null;
}

interface ApifySimilarWebResult {
  domain: string;
  visits?: string;
  globalRank?: number;
  countryRank?: {
    Country?: number;
    CountryCode?: string;
    Rank?: number;
  };
  bounceRate?: string;
  pagesPerVisit?: string;
  timeOnSite?: string;
  trafficSources?: {
    Direct?: number;
    Search?: number;
    Social?: number;
    Referrals?: number;
    Mail?: number;
    'Paid Referrals'?: number;
  };
  topCountryShares?: Array<{
    CountryCode: string;
    Value: number;
  }>;
  category?: string;
  estimatedMonthlyVisits?: Record<string, number>;
  // NEW FIELDS from API
  title?: string;
  description?: string;
  screenshot?: string;
  categoryRank?: string;
  snapshotDate?: string;
  topKeywords?: Array<{
    name: string;
    esitmatedValue: number;  // Note: typo in API response
    cpc: number | null;
  }>;
}

/**
 * Get SimilarWeb traffic data for a domain
 * Returns comprehensive traffic analytics
 */
export async function enrichDomainWithSimilarWeb(
  domain: string,
  userId?: number
): Promise<SimilarWebData | null> {
  if (!client) {
    console.error('❌ Apify client not initialized');
    return null;
  }

  const startTime = Date.now();
  console.log(`📊 Apify SimilarWeb: "${domain}"`);

  try {
    const run = await client.actor(ACTORS.similarweb).call({
      domains: [domain],
    });

    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    
    if (items.length === 0) {
      console.log(`⚠️ SimilarWeb: No data for ${domain}`);
      return null;
    }

    const item = items[0] as unknown as ApifySimilarWebResult;

    // Track API call
    if (userId) {
      await trackApiCall({
        userId,
        service: 'apify_similarweb',
        endpoint: ACTORS.similarweb,
        domain,
        status: 'success',
        resultsCount: 1,
        estimatedCost: API_COSTS.apify_similarweb,
        apifyRunId: run.id,
        durationMs: Date.now() - startTime,
      });
    }

    const monthlyVisits = parseInt(item.visits || '0', 10);

    // Process top keywords (note: API has typo "esitmatedValue" instead of "estimatedValue")
    const topKeywords = item.topKeywords && item.topKeywords.length > 0
      ? item.topKeywords.slice(0, 10).map(kw => ({
          name: kw.name,
          estimatedValue: kw.esitmatedValue || 0,
          cpc: kw.cpc,
        }))
      : null;

    return {
      domain: item.domain,
      monthlyVisits,
      monthlyVisitsFormatted: formatNumber(monthlyVisits),
      globalRank: item.globalRank || null,
      countryRank: item.countryRank?.Rank || null,
      countryCode: item.countryRank?.CountryCode || null,
      bounceRate: parseFloat(item.bounceRate || '0'),
      pagesPerVisit: parseFloat(item.pagesPerVisit || '0'),
      timeOnSite: Math.round(parseFloat(item.timeOnSite || '0')),  // Round to integer for DB compatibility
      trafficSources: {
        direct: item.trafficSources?.Direct || 0,
        search: item.trafficSources?.Search || 0,
        social: item.trafficSources?.Social || 0,
        referrals: item.trafficSources?.Referrals || 0,
        mail: item.trafficSources?.Mail || 0,
        paid: item.trafficSources?.['Paid Referrals'] || 0,
      },
      topCountries: (item.topCountryShares || []).slice(0, 5).map(c => ({
        countryCode: c.CountryCode,
        share: c.Value,
      })),
      category: item.category || null,
      // NEW FIELDS - Dec 2025
      siteTitle: item.title || null,
      siteDescription: item.description || null,
      screenshot: item.screenshot || null,
      categoryRank: item.categoryRank ? parseInt(item.categoryRank, 10) : null,
      monthlyVisitsHistory: item.estimatedMonthlyVisits || null,
      topKeywords,
      snapshotDate: item.snapshotDate || null,
    };

  } catch (error: any) {
    console.error('❌ Apify SimilarWeb error:', error.message);

    if (userId) {
      await trackApiCall({
        userId,
        service: 'apify_similarweb',
        endpoint: ACTORS.similarweb,
        domain,
        status: 'error',
        errorMessage: error.message,
        durationMs: Date.now() - startTime,
      });
    }

    return null;
  }
}

/**
 * Enrich multiple domains with SimilarWeb data
 * Processes domains sequentially to avoid rate limits
 */
export async function enrichDomainsWithSimilarWeb(
  domains: string[],
  userId?: number,
  onProgress?: (domain: string, data: SimilarWebData | null) => void
): Promise<Map<string, SimilarWebData>> {
  const results = new Map<string, SimilarWebData>();
  
  // Deduplicate domains
  const uniqueDomains = [...new Set(domains)];
  
  console.log(`📊 Enriching ${uniqueDomains.length} domains with SimilarWeb...`);

  for (const domain of uniqueDomains) {
    const data = await enrichDomainWithSimilarWeb(domain, userId);
    
    if (data) {
      results.set(domain, data);
    }
    
    if (onProgress) {
      onProgress(domain, data);
    }
  }

  console.log(`✅ SimilarWeb enrichment complete: ${results.size}/${uniqueDomains.length} domains`);
  return results;
}

// ============================================================================
// SIMILARWEB BATCH PROCESSING (Added December 16, 2025)
// 
// PROBLEM: The original enrichDomainsWithSimilarWeb() made sequential API calls
// - one call per domain. For 20 domains, this meant 20 separate Apify actor runs,
// taking 60+ seconds total.
//
// SOLUTION: The SimilarWeb actor already accepts an array of domains in a single
// call (see line 549-551 where it passes `domains: [domain]`). We simply pass
// ALL domains in one call instead of calling one at a time.
//
// PERFORMANCE IMPROVEMENT:
// - Before: 20 domains × ~3 seconds each = 60+ seconds
// - After:  1 batch call with 20 domains = ~5-10 seconds
//
// This function is designed to be used in non-blocking mode - the caller can
// fire it and continue streaming results without waiting.
// ============================================================================

/**
 * Transform raw SimilarWeb API result to our SimilarWebData type
 * 
 * Added December 16, 2025 - Extracted from enrichDomainWithSimilarWeb to allow
 * reuse in batch processing without code duplication.
 * 
 * @param item - Raw API response from SimilarWeb Apify actor
 * @returns Transformed SimilarWebData object or null if invalid
 */
function transformSimilarWebApiResult(item: ApifySimilarWebResult): SimilarWebData | null {
  if (!item || !item.domain) {
    return null;
  }

  const monthlyVisits = parseInt(item.visits || '0', 10);

  // Process top keywords (note: API has typo "esitmatedValue" instead of "estimatedValue")
  const topKeywords = item.topKeywords && item.topKeywords.length > 0
    ? item.topKeywords.slice(0, 10).map(kw => ({
        name: kw.name,
        estimatedValue: kw.esitmatedValue || 0,
        cpc: kw.cpc,
      }))
    : null;

  return {
    domain: item.domain,
    monthlyVisits,
    monthlyVisitsFormatted: formatNumber(monthlyVisits),
    globalRank: item.globalRank || null,
    countryRank: item.countryRank?.Rank || null,
    countryCode: item.countryRank?.CountryCode || null,
    bounceRate: parseFloat(item.bounceRate || '0'),
    pagesPerVisit: parseFloat(item.pagesPerVisit || '0'),
    timeOnSite: Math.round(parseFloat(item.timeOnSite || '0')),
    trafficSources: {
      direct: item.trafficSources?.Direct || 0,
      search: item.trafficSources?.Search || 0,
      social: item.trafficSources?.Social || 0,
      referrals: item.trafficSources?.Referrals || 0,
      mail: item.trafficSources?.Mail || 0,
      paid: item.trafficSources?.['Paid Referrals'] || 0,
    },
    topCountries: (item.topCountryShares || []).slice(0, 5).map(c => ({
      countryCode: c.CountryCode,
      share: c.Value,
    })),
    category: item.category || null,
    siteTitle: item.title || null,
    siteDescription: item.description || null,
    screenshot: item.screenshot || null,
    categoryRank: item.categoryRank ? parseInt(item.categoryRank, 10) : null,
    monthlyVisitsHistory: item.estimatedMonthlyVisits || null,
    topKeywords,
    snapshotDate: item.snapshotDate || null,
  };
}

/**
 * Enrich multiple domains with SimilarWeb data in a SINGLE batch API call
 * 
 * Added December 16, 2025 - This is a major performance optimization.
 * 
 * WHY THIS EXISTS:
 * The original enrichDomainsWithSimilarWeb() made one API call per domain,
 * which was extremely slow (20 domains = 60+ seconds). This function sends
 * ALL domains in a single Apify actor call, reducing total time to ~5-10 seconds.
 * 
 * HOW IT WORKS:
 * 1. Deduplicates the input domain list
 * 2. Makes ONE call to the SimilarWeb actor with all domains
 * 3. Processes all results from the single response
 * 4. Returns a Map<domain, SimilarWebData> for easy lookup
 * 
 * USAGE:
 * This function is designed to be called WITHOUT awaiting in the scout route,
 * allowing results to be streamed immediately while SimilarWeb enrichment
 * happens in the background.
 * 
 * @param domains - Array of domain strings to enrich (e.g., ['example.com', 'test.org'])
 * @param userId - Optional user ID for API call tracking
 * @returns Promise<Map<string, SimilarWebData>> - Map of domain to enrichment data
 */
export async function enrichDomainsBatch(
  domains: string[],
  userId?: number
): Promise<Map<string, SimilarWebData>> {
  const results = new Map<string, SimilarWebData>();

  // Guard: Check if Apify client is initialized
  if (!client) {
    console.error('❌ Apify client not initialized');
    return results;
  }

  // Deduplicate domains to avoid wasting API calls
  const uniqueDomains = [...new Set(domains)];
  
  // Guard: No domains to process
  if (uniqueDomains.length === 0) {
    console.log('⚠️ SimilarWeb BATCH: No domains to process');
    return results;
  }

  const startTime = Date.now();
  console.log(`📊 Apify SimilarWeb BATCH: Processing ${uniqueDomains.length} domains in ONE call`);

  try {
    // ==========================================================================
    // SINGLE API CALL WITH ALL DOMAINS
    // The SimilarWeb actor accepts an array of domains and returns data for all
    // of them in a single response. This is the key optimization.
    // ==========================================================================
    const run = await client.actor(ACTORS.similarweb).call({
      domains: uniqueDomains,
    });

    // Fetch all results from the dataset
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    
    console.log(`📊 SimilarWeb BATCH: Received ${items.length} results`);

    // Process each result and add to our Map
    for (const rawItem of items) {
      const item = rawItem as unknown as ApifySimilarWebResult;
      const transformedData = transformSimilarWebApiResult(item);
      
      if (transformedData) {
        results.set(item.domain, transformedData);
      }
    }

    const durationMs = Date.now() - startTime;
    console.log(`✅ SimilarWeb BATCH complete: ${results.size}/${uniqueDomains.length} domains in ${durationMs}ms`);

    // Track the API call (single call for all domains)
    if (userId) {
      await trackApiCall({
        userId,
        service: 'apify_similarweb',
        endpoint: ACTORS.similarweb,
        status: 'success',
        resultsCount: results.size,
        // Cost is per domain, not per call
        estimatedCost: uniqueDomains.length * API_COSTS.apify_similarweb,
        apifyRunId: run.id,
        durationMs,
      });
    }

    return results;

  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    console.error('❌ Apify SimilarWeb BATCH error:', error.message);

    // Track the failed API call
    if (userId) {
      await trackApiCall({
        userId,
        service: 'apify_similarweb',
        endpoint: ACTORS.similarweb,
        status: 'error',
        errorMessage: error.message,
        durationMs,
      });
    }

    // Return empty Map on error - caller should handle gracefully
    return results;
  }
}

