import { getJson } from "serpapi";

const SERPAPI_KEY = process.env.SERPAPI_KEY;

if (!SERPAPI_KEY) {
  console.warn("Missing SERPAPI_KEY in environment variables");
}

export type Platform = 'Web' | 'Reddit' | 'LinkedIn' | 'Twitter' | 'Instagram' | 'YouTube';

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
}

/**
 * Maps internal Platform identifiers to Google Search Operators
 */
const PLATFORM_QUERIES: Record<Platform, string> = {
  'Web': '', // No special operator
  'Reddit': 'site:reddit.com',
  'LinkedIn': 'site:linkedin.com/in/',
  'Twitter': 'site:twitter.com',
  'Instagram': 'site:instagram.com',
  'YouTube': 'site:youtube.com'
};

/**
 * Performs a Google Search using SerpApi
 */
async function searchPlatform(keyword: string, platform: Platform): Promise<SearchResult[]> {
  if (!SERPAPI_KEY) return [];

  const operator = PLATFORM_QUERIES[platform];
  // If platform is Web, just search keyword + "review" or "affiliate"
  // If social, use site: operator + keyword
  const q = platform === 'Web' 
    ? `${keyword} review affiliate`
    : `${keyword} ${operator}`;

  return new Promise((resolve, reject) => {
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
          snippet: r.snippet,
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

