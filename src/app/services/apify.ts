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

// Initialize Apify client
const APIFY_TOKEN = process.env.APIFY_API_TOKEN;

if (!APIFY_TOKEN) {
  console.warn('⚠️ Missing APIFY_API_TOKEN in environment variables');
}

const client = APIFY_TOKEN ? new ApifyClient({ token: APIFY_TOKEN }) : null;

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

