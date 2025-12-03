/**
 * Serper.dev Search Service
 * Fast, affordable Google search API
 * Docs: https://serper.dev
 */

const SERPER_API_KEY = process.env.SERPER_API_KEY;

// Serper.dev endpoints
const SERPER_ENDPOINTS = {
  search: 'https://google.serper.dev/search',
  videos: 'https://google.serper.dev/videos',
  images: 'https://google.serper.dev/images',
  news: 'https://google.serper.dev/news',
};

if (!SERPER_API_KEY) {
  console.warn("⚠️ Missing SERPER_API_KEY in environment variables");
}

export type Platform = 'Web' | 'Reddit' | 'LinkedIn' | 'Twitter' | 'Instagram' | 'YouTube';

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
 * Search YouTube videos using Serper's videos endpoint
 */
async function searchYouTube(keyword: string): Promise<SearchResult[]> {
  // Use the videos endpoint for YouTube-specific results
  // Search exactly what the user typed - no modifications
  const json = await serperFetch(SERPER_ENDPOINTS.videos, keyword);

  if (json.error) {
    return [];
  }

  const videos = json.videos || [];
  console.log('🎬 YouTube/Video results:', videos.length);

  return videos.slice(0, 25).map((v: any, index: number) => {
    // Parse channel info
    const channel: YouTubeChannelInfo | undefined = v.channel ? {
      name: v.channel,
      link: v.channelLink || `https://www.youtube.com/results?search_query=${encodeURIComponent(v.channel)}`,
      verified: false,
    } : undefined;

    // Extract domain from link
    let domain = 'youtube.com';
    try {
      domain = new URL(v.link).hostname;
    } catch {}

    return {
      title: v.title,
      link: v.link,
      snippet: v.snippet || v.description || '',
      source: 'YouTube' as Platform,
      domain,
      thumbnail: v.imageUrl || v.thumbnail,
      views: v.views,
      date: v.date || v.publishedDate,
      duration: v.duration,
      channel,
      position: index + 1,
      searchQuery: keyword,
    };
  });
}

/**
 * Search Google for web results, with optional site: operator for platforms
 */
async function searchWeb(keyword: string, siteOperator?: string): Promise<SearchResult[]> {
  // Search exactly what the user typed - no modifications
  const query = siteOperator 
    ? `${keyword} ${siteOperator}`
    : `${keyword} affiliate`;

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
 * Search a specific platform using site: operator
 * Falls back to platform name search if site: operator is blocked
 */
async function searchPlatform(keyword: string, platform: Platform): Promise<SearchResult[]> {
  // YouTube gets special treatment with videos endpoint
  if (platform === 'YouTube') {
    return searchYouTube(keyword);
  }

  // Map platforms to site operators
  const siteOperators: Record<Platform, string> = {
    'Web': '',
    'Reddit': 'site:reddit.com',
    'LinkedIn': 'site:linkedin.com/in/',
    'Twitter': 'site:twitter.com OR site:x.com',
    'Instagram': 'site:instagram.com',
    'YouTube': 'site:youtube.com',
  };

  // Fallback queries (without site: operator) - used when Serper blocks the query
  const fallbackQueries: Record<Platform, string> = {
    'Web': keyword,
    'Reddit': `${keyword} reddit.com`,
    'LinkedIn': `${keyword} linkedin`,
    'Twitter': `${keyword} twitter`,
    'Instagram': `${keyword} instagram`,
    'YouTube': keyword,
  };

  const siteOp = siteOperators[platform];
  const query = siteOp ? `${keyword} ${siteOp}` : keyword;

  let json = await serperFetch(SERPER_ENDPOINTS.search, query);

  // If blocked (400 error with "Query not allowed"), try fallback query
  if (json.error && json.error.includes('400')) {
    console.log(`⚠️ site: operator blocked for ${platform}, trying fallback...`);
    const fallbackQuery = fallbackQueries[platform];
    json = await serperFetch(SERPER_ENDPOINTS.search, fallbackQuery);
  }

  if (json.error) {
    return [];
  }

  const organic = json.organic || [];
  console.log(`🌐 ${platform} results:`, organic.length);

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
      source: platform,
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
 * Search across multiple platforms in parallel
 */
export async function searchMultiPlatform(keyword: string, sources: Platform[]): Promise<SearchResult[]> {
  console.log(`\n🚀 Starting multi-platform search for "${keyword}"`);
  console.log(`📡 Platforms: ${sources.join(', ')}\n`);

  // Run all searches in parallel
  const promises = sources.map(source =>
    searchPlatform(keyword, source).catch(err => {
      console.error(`❌ ${source} search failed:`, err);
      return [] as SearchResult[];
    })
  );

  const results = await Promise.all(promises);
  const flatResults = results.flat();

  console.log(`\n✅ Total results: ${flatResults.length}\n`);
  return flatResults;
}
