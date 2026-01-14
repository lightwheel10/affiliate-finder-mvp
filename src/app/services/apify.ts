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

// Apify Actor IDs
const ACTORS = {
  youtube: 'h7sDV53CddomktSi5',
  instagram: 'DrF9mzPPEuVizVF4l',
  tiktok: 'GdWCkxBtKWOsKjdch',
  similarweb: 'yOYYzj2J5K88boIVO',
} as const;

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
 */
export async function searchYouTubeApify(
  keyword: string,
  userId?: number,
  maxResults: number = 10
): Promise<SearchResult[]> {
  if (!client) {
    console.error('❌ Apify client not initialized');
    return [];
  }

  const startTime = Date.now();
  console.log(`🎬 Apify YouTube search: "${keyword}"`);

  try {
    const run = await client.actor(ACTORS.youtube).call({
      searchQueries: [keyword],
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

/**
 * Search Instagram users/profiles using Apify scraper
 * Returns rich profile data including followers and recent posts
 */
export async function searchInstagramApify(
  keyword: string,
  userId?: number,
  searchLimit: number = 10
): Promise<SearchResult[]> {
  if (!client) {
    console.error('❌ Apify client not initialized');
    return [];
  }

  const startTime = Date.now();
  console.log(`📸 Apify Instagram search: "${keyword}"`);

  try {
    const run = await client.actor(ACTORS.instagram).call({
      search: keyword,
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
    // ==========================================================================
    return results.map((item, index): SearchResult => {
      // Build snippet from bio and stats
      const stats = [];
      if (item.followersCount) stats.push(`${formatNumber(item.followersCount)} followers`);
      if (item.postsCount) stats.push(`${formatNumber(item.postsCount)} posts`);
      const snippet = [
        item.biography?.substring(0, 200),
        stats.length > 0 ? `📊 ${stats.join(' • ')}` : null,
      ].filter(Boolean).join('\n');

      // Extract first (most recent) post stats from latestPosts array
      const firstPost = item.latestPosts?.[0];

      // ========================================================================
      // INSTAGRAM BIO EMAIL EXTRACTION - January 14, 2026
      // 
      // Extract email addresses from Instagram biography field using regex.
      // Many creators include their business email in their bio for collabs.
      // 
      // Examples of emails found in real Instagram bios:
      //   "photographer ——— inquiries: robertjunilkim@gmail.com"
      //   "NYC Photographer: Inquiries JuanPatinoPhoto@gmail.com"
      // 
      // This provides FREE email discovery without needing paid enrichment
      // services like Lusha or Apollo.
      // 
      // The extracted email flows through:
      //   Apify → SearchResult.email → ResultItem.email → Database
      // ========================================================================
      const bioEmail = extractEmailFromText(item.biography);

      return {
        title: item.fullName || `@${item.username}` || '',
        link: item.url || `https://www.instagram.com/${item.username}`,
        snippet,
        source: 'Instagram' as Platform,
        domain: 'instagram.com',
        thumbnail: item.profilePicUrlHD || item.profilePicUrl,
        views: item.followersCount ? formatNumber(item.followersCount) : undefined,
        position: index + 1,
        searchQuery: keyword,
        personName: item.fullName || item.username,
        
        // January 14, 2026: Email extracted from Instagram bio
        email: bioEmail,
        
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
 */
export async function searchTikTokApify(
  keyword: string,
  userId?: number,
  resultsPerPage: number = 10
): Promise<SearchResult[]> {
  if (!client) {
    console.error('❌ Apify client not initialized');
    return [];
  }

  const startTime = Date.now();
  console.log(`🎵 Apify TikTok search: "${keyword}"`);

  try {
    const run = await client.actor(ACTORS.tiktok).call({
      searchQueries: [keyword],
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
    // ==========================================================================
    return results.map((item, index): SearchResult => {
      const author = item.authorMeta;
      
      // ========================================================================
      // EMAIL EXTRACTION FROM BIO - Added January 14, 2026
      // 
      // Many TikTok creators include their business email in their bio (signature)
      // for collaboration inquiries. We extract it here using regex so it's
      // available immediately in search results without needing paid enrichment.
      // 
      // Examples of emails found in real TikTok bios:
      //   "💌ashisatthegym.biz@gmail.com"
      //   "📧: kayymrose@gmail.com"
      //   "Business inquiries: Jordan@company.com"
      // 
      // The extracted email is stored in the `email` field which flows through
      // to the database and is displayed in the UI.
      // ========================================================================
      const bioEmail = extractEmailFromText(author?.signature);
      
      // Build snippet from video text and author stats
      const stats = [];
      if (item.playCount) stats.push(`${formatNumber(item.playCount)} views`);
      if (item.diggCount) stats.push(`${formatNumber(item.diggCount)} likes`);
      if (author?.fans) stats.push(`${formatNumber(author.fans)} followers`);
      
      const snippet = [
        item.text?.substring(0, 200),
        stats.length > 0 ? `📊 ${stats.join(' • ')}` : null,
      ].filter(Boolean).join('\n');

      // Create a channel-like object for TikTok creator (kept for backward compatibility)
      const channel: YouTubeChannelInfo | undefined = author ? {
        name: author.nickName || author.name || '',
        link: author.profileUrl || `https://www.tiktok.com/@${author.name}`,
        thumbnail: author.avatar,
        verified: author.verified,
        subscribers: author.fans ? formatNumber(author.fans) : undefined,
      } : undefined;

      return {
        title: item.text?.substring(0, 100) || 'TikTok Video',
        link: item.webVideoUrl || '',
        snippet,
        source: 'TikTok' as Platform,
        domain: 'tiktok.com',
        thumbnail: item.videoMeta?.coverUrl || author?.avatar,
        views: item.playCount ? formatNumber(item.playCount) : undefined,
        date: item.createTimeISO,
        duration: item.videoMeta?.duration ? `${Math.floor(item.videoMeta.duration / 60)}:${(item.videoMeta.duration % 60).toString().padStart(2, '0')}` : undefined,
        channel,
        position: index + 1,
        searchQuery: keyword,
        personName: author?.nickName || author?.name,
        
        // ======================================================================
        // Email extracted from TikTok bio - Added January 14, 2026
        // This provides immediate contact info without paid enrichment services
        // ======================================================================
        email: bioEmail,
        
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

