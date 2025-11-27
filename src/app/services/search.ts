import { getJson } from "serpapi";

const SERPAPI_KEY = process.env.SERPAPI_KEY;

if (!SERPAPI_KEY) {
  console.warn("Missing SERPAPI_KEY in environment variables");
}

export type Platform = 'Web' | 'Reddit' | 'LinkedIn' | 'Twitter' | 'Instagram' | 'YouTube';

/**
 * YouTube Channel Info - returned from SerpAPI YouTube engine
 */
export interface YouTubeChannelInfo {
  name: string;
  link: string;
  thumbnail?: string;
  verified?: boolean;
  subscribers?: string;  // e.g., "1.9K subscribers"
}

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  source: Platform;
  domain: string;
  thumbnail?: string;
  views?: string;        // e.g., "5.7K views" or number
  date?: string;         // e.g., "8 months ago" or "8/15/2025"
  highlightedWords?: string[];
  position?: number;
  searchQuery?: string;
  
  // YouTube-specific fields (from engine=youtube)
  channel?: YouTubeChannelInfo;
  duration?: string;     // e.g., "12:34"
  
  /**
   * TODO: Future enhancements - these require additional API calls or calculations:
   * - engagementRate: Calculate from (likes + comments) / views - needs YouTube Data API
   * - uploadFrequency: Calculate from channel's recent videos - needs multiple API calls
   * - viewToSubRatio: Calculate from avgViews / subscribers - can be done client-side
   */
}

/**
 * Maps internal Platform identifiers to Google Search Operators
 * Used for platforms that don't have dedicated SerpAPI engines
 */
const PLATFORM_QUERIES: Record<Platform, string> = {
  'Web': '', // No special operator
  'Reddit': 'site:reddit.com',
  'LinkedIn': 'site:linkedin.com/in/',
  'Twitter': 'site:twitter.com',
  'Instagram': 'site:instagram.com',
  'YouTube': 'site:youtube.com' // Fallback only - we use engine=youtube instead
};

/**
 * Dedicated YouTube Search using SerpAPI's native YouTube engine
 * Returns rich data: views, subscribers, channel info, publish dates
 */
async function searchYouTube(keyword: string): Promise<SearchResult[]> {
  if (!SERPAPI_KEY) return [];

  return new Promise((resolve) => {
    getJson({
      engine: "youtube",           // Native YouTube engine!
      api_key: SERPAPI_KEY,
      search_query: keyword,       // YouTube uses search_query, not q
      gl: "us",
      hl: "en"
    }, (json: any) => {
      if (json.error) {
        console.error(`SerpApi YouTube Error:`, json.error);
        resolve([]);
        return;
      }
      
      const video_results = json.video_results || [];
      
      // Debug: Log first result to see available data structure
      if (video_results.length > 0) {
        console.log('🎬 YouTube API Response Sample:', JSON.stringify(video_results[0], null, 2));
      }
      
      const mapped = video_results.slice(0, 10).map((r: any, index: number) => {
        // Parse views - can be "5.7K views" or number or "37.9K views" string
        let views = r.views;
        if (typeof views === 'number') {
          views = formatNumber(views) + ' views';
        }
        // If views is already a string with "views", keep it as is
        // If it's just a number string, add "views"
        if (views && typeof views === 'string' && !views.includes('view')) {
          views = views + ' views';
        }

        // Extract channel info with subscriber count
        // Note: SerpAPI video_results may not include subscriber count - that's in channel_results
        const channel: YouTubeChannelInfo | undefined = r.channel ? {
          name: r.channel.name,
          link: r.channel.link,
          thumbnail: r.channel.thumbnail,
          verified: r.channel.verified || false,
          subscribers: r.channel.subscribers || undefined // May not be available in video results
        } : undefined;

        return {
          title: r.title,
          link: r.link,
          snippet: r.description || '',
          source: 'YouTube' as Platform,
          domain: 'youtube.com',
          thumbnail: r.thumbnail?.static || r.thumbnail,
          views,
          date: r.published_date,
          duration: r.length,
          channel,
          position: index + 1,
          searchQuery: keyword
        };
      });

      resolve(mapped);
    });
  });
}

/**
 * Helper to format large numbers (e.g., 5700 -> "5.7K")
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

/**
 * Performs a Google Search using SerpApi
 * Used for Web, Reddit, Instagram, and other platforms
 */
async function searchPlatform(keyword: string, platform: Platform): Promise<SearchResult[]> {
  if (!SERPAPI_KEY) return [];

  // Use dedicated YouTube search for YouTube platform
  if (platform === 'YouTube') {
    return searchYouTube(keyword);
  }

  const operator = PLATFORM_QUERIES[platform];
  // If platform is Web, just search keyword + "review" or "affiliate"
  // If social, use site: operator + keyword
  const q = platform === 'Web' 
    ? `${keyword} review affiliate`
    : `${keyword} ${operator}`;

  return new Promise((resolve) => {
    getJson({
      engine: "google",
      api_key: SERPAPI_KEY,
      q: q,
      num: 10, // Fetch top 10 results per platform for more coverage
      gl: "us",
      hl: "en"
    }, (json: any) => {
      if (json.error) {
        console.error(`SerpApi Error [${platform}]:`, json.error);
        resolve([]);
        return;
      }
      
      const organic_results = json.organic_results || [];
      
      const mapped = organic_results.map((r: any, index: number) => {
        // Attempt to extract stats from rich_snippet
        let views, date;
        if (r.rich_snippet?.top?.extensions) {
           const exts = r.rich_snippet.top.extensions;
           views = exts.find((e: string) => e.includes('views'));
           date = exts.find((e: string) => e.includes('ago') || /\d{4}/.test(e));
        }

        return {
          title: r.title,
          link: r.link,
          snippet: r.snippet || '',
          source: platform,
          domain: new URL(r.link).hostname,
          thumbnail: r.thumbnail,
          views,
          date,
          highlightedWords: r.snippet_highlighted_words,
          position: index + 1,
          searchQuery: keyword
        };
      });

      resolve(mapped);
    });
  });
}

export async function searchMultiPlatform(keyword: string, sources: Platform[]): Promise<SearchResult[]> {
  const promises = sources.map(source => searchPlatform(keyword, source));
  const results = await Promise.all(promises);
  return results.flat();
}

