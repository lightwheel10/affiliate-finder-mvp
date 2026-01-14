/**
 * Search Service
 * - Web: Uses Serper.dev (Google search)
 * - YouTube/Instagram/TikTok: Uses Apify scrapers for rich data
 */

import { searchYouTubeApify, searchInstagramApify, searchTikTokApify } from './apify';

const SERPER_API_KEY = process.env.SERPER_API_KEY;

// Serper.dev endpoints (only used for Web searches)
const SERPER_ENDPOINTS = {
  search: 'https://google.serper.dev/search',
  videos: 'https://google.serper.dev/videos',
  images: 'https://google.serper.dev/images',
  news: 'https://google.serper.dev/news',
};

if (!SERPER_API_KEY) {
  console.warn("⚠️ Missing SERPER_API_KEY in environment variables");
}

// Updated Platform type - removed Reddit, added TikTok
export type Platform = 'Web' | 'YouTube' | 'Instagram' | 'TikTok';

/**
 * YouTube Channel Info
 */
export interface YouTubeChannelInfo {
  name: string;
  link: string;
  thumbnail?: string;
  verified?: boolean;
  subscribers?: string;
}

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  source: Platform;
  domain: string;
  thumbnail?: string;
  views?: string;
  date?: string;
  highlightedWords?: string[];
  position?: number;
  searchQuery?: string;
  channel?: YouTubeChannelInfo;
  duration?: string;
  personName?: string;
  
  // ==========================================================================
  // Email extracted from bio/profile (Added January 14, 2026)
  // 
  // This field stores email addresses extracted from social media bios using
  // regex pattern matching.
  // 
  // IMPLEMENTED FOR:
  // - TikTok: author.signature field (January 14, 2026)
  // - Instagram: biography field (January 14, 2026)
  // 
  // WHY: Many creators include their business email in their bio for collabs.
  // This provides FREE email discovery without needing paid enrichment (Lusha).
  // 
  // The email is extracted during search using extractEmailFromText() in apify.ts
  // and flows through to the database via the existing email column.
  // ==========================================================================
  email?: string;
  
  // ==========================================================================
  // YouTube-specific fields (added to fix data pipeline)
  // These fields are populated by searchYouTubeApify() in apify.ts
  // ==========================================================================
  youtubeVideoLikes?: number;
  youtubeVideoComments?: number;
  
  // ==========================================================================
  // Instagram-specific fields (added to fix data pipeline)
  // These fields are populated by searchInstagramApify() in apify.ts
  // and flow through to the database via useAffiliates.ts
  // ==========================================================================
  instagramUsername?: string;
  instagramFullName?: string;
  instagramBio?: string;
  instagramFollowers?: number;
  instagramFollowing?: number;
  instagramPostsCount?: number;
  instagramIsBusiness?: boolean;
  instagramIsVerified?: boolean;
  // Instagram post-level stats (from most recent post in latestPosts array)
  instagramPostLikes?: number;
  instagramPostComments?: number;
  instagramPostViews?: number;
  
  // ==========================================================================
  // TikTok-specific fields (added to fix data pipeline)
  // These fields are populated by searchTikTokApify() in apify.ts
  // and flow through to the database via useAffiliates.ts
  // ==========================================================================
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

/**
 * Makes a request to Serper.dev API
 */
async function serperFetch(endpoint: string, query: string, options: Record<string, any> = {}): Promise<any> {
  if (!SERPER_API_KEY) {
    console.error('❌ SERPER_API_KEY is not configured');
    return { error: 'API key not configured' };
  }

  const MAX_RETRIES = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`🔍 Serper request (attempt ${attempt}/${MAX_RETRIES}): ${endpoint.split('/').pop()} - "${query}"`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'X-API-KEY': SERPER_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: query,
          num: 25, // Get 25 results per request
          ...options,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Serper HTTP ${response.status}: ${errorText}`);

        // Retry on server errors or rate limits
        if (response.status >= 500 || response.status === 429) {
          lastError = new Error(`HTTP ${response.status}`);
          await new Promise(resolve => setTimeout(resolve, attempt * 2000));
          continue;
        }

        return { error: `HTTP ${response.status}: ${errorText}` };
      }

      const data = await response.json();
      const resultCount = data.organic?.length || data.videos?.length || 0;
      console.log(`✅ Serper success: ${endpoint.split('/').pop()} (${resultCount} results returned)`);
      return data;

    } catch (error: any) {
      lastError = error;

      if (error.name === 'AbortError') {
        console.warn(`⏱️ Serper timeout (attempt ${attempt}/${MAX_RETRIES})`);
      } else {
        console.error(`❌ Serper fetch error (attempt ${attempt}/${MAX_RETRIES}):`, error.message);
      }

      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, attempt * 2000));
      }
    }
  }

  console.error(`❌ Serper failed after ${MAX_RETRIES} attempts:`, lastError?.message);
  return { error: lastError?.message || 'Request failed after retries' };
}

/**
 * Search Google for web results using Serper.dev
 * 
 * Updated December 16, 2025: Exported this function so it can be called
 * directly from the scout route for per-platform streaming. Previously
 * this was only accessible via searchMultiPlatform which waited for all
 * platforms to complete before returning.
 */
export async function searchWeb(keyword: string): Promise<SearchResult[]> {
  // Add "affiliate" to the search query for better results
  const query = `${keyword} affiliate`;

  const json = await serperFetch(SERPER_ENDPOINTS.search, query);

  if (json.error) {
    return [];
  }

  const organic = json.organic || [];
  console.log(`🌐 Web results:`, organic.length);

  return organic.map((r: any, index: number) => {
    let domain = '';
    try {
      domain = new URL(r.link).hostname;
    } catch {
      domain = r.displayedLink || 'unknown';
    }

    return {
      title: r.title,
      link: r.link,
      snippet: r.snippet || '',
      source: 'Web' as Platform,
      domain,
      thumbnail: r.thumbnail,
      date: r.date,
      highlightedWords: r.snippetHighlightedWords,
      position: index + 1,
      searchQuery: keyword,
    };
  });
}

/**
 * Search Web using Serper.dev
 * Note: YouTube, Instagram, TikTok are now handled by Apify in searchMultiPlatform
 */
async function searchPlatform(keyword: string, platform: Platform): Promise<SearchResult[]> {
  // Only Web searches use Serper now
  // YouTube/Instagram/TikTok are routed to Apify in searchMultiPlatform
  if (platform !== 'Web') {
    console.warn(`⚠️ Platform ${platform} should be handled by Apify, not Serper`);
    return [];
  }

  return searchWeb(keyword);
}

/**
 * Search across multiple platforms in parallel
 * - Web: Uses Serper.dev
 * - YouTube/Instagram/TikTok: Uses Apify scrapers
 */
export async function searchMultiPlatform(
  keyword: string, 
  sources: Platform[],
  userId?: number
): Promise<SearchResult[]> {
  console.log(`\n🚀 Starting multi-platform search for "${keyword}"`);
  console.log(`📡 Platforms: ${sources.join(', ')}\n`);

  // Run all searches in parallel
  const promises = sources.map(source => {
    // Route to appropriate service based on platform
    switch (source) {
      case 'YouTube':
        return searchYouTubeApify(keyword, userId, 15).catch(err => {
          console.error(`❌ YouTube (Apify) search failed:`, err);
          return [] as SearchResult[];
        });
      case 'Instagram':
        return searchInstagramApify(keyword, userId, 15).catch(err => {
          console.error(`❌ Instagram (Apify) search failed:`, err);
          return [] as SearchResult[];
        });
      case 'TikTok':
        return searchTikTokApify(keyword, userId, 15).catch(err => {
          console.error(`❌ TikTok (Apify) search failed:`, err);
          return [] as SearchResult[];
        });
      case 'Web':
      default:
        return searchPlatform(keyword, source).catch(err => {
          console.error(`❌ ${source} search failed:`, err);
          return [] as SearchResult[];
        });
    }
  });

  const results = await Promise.all(promises);
  const flatResults = results.flat();

  console.log(`\n✅ Total results: ${flatResults.length}\n`);
  return flatResults;
}
