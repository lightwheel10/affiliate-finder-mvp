/**
 * Search Service
 * 
 * Handles multi-platform search for affiliate discovery:
 * - Web: Uses Serper.dev (Google search)
 * - YouTube/Instagram/TikTok: Uses Serper + Apify enrichment (hybrid approach)
 * 
 * Changelog:
 * 
 * January 16, 2026: Added affiliate-focused filtering
 * - E-commerce domain blocklist to exclude shops (Amazon, eBay, etc.)
 * - Shop URL pattern detection to exclude product pages
 * - User's own domain exclusion
 * - Improved search query to target content creators (reviewers, bloggers)
 * - Location-based filtering (gl, hl params for Serper)
 * 
 * January 26, 2026: Enhanced language filtering
 * - Added `lr` (language restrict) parameter to Serper API calls
 * - Added franc-based post-filtering for ~95%+ language accuracy
 * - Blocked github.com, github.io, selecdoo.com domains
 * - Fixed Invalid Date display issue
 * 
 * January 26, 2026: Added Serper-based social media search
 * - Functions: searchYouTubeSerper, searchInstagramSerper, searchTikTokSerper
 * - Uses site: filters with language params for better localization
 * - Enriched with Apify metadata (followers, bio, etc.)
 * 
 * January 29, 2026: DEAD CODE CLEANUP
 * - Removed searchMultiPlatform() - was never called (routing is in route.ts)
 * - Removed imports for dead Apify search functions (searchYouTubeApify, etc.)
 * - These were replaced by searchYouTubeSerper/etc. + Apify enrichment
 * - See apify.ts for details on what was removed
 * 
 * Architecture:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  searchWeb(keyword, options)                                            │
 * │  ├── 1. Build localized search query (keyword + language terms)        │
 * │  ├── 2. Serper API call (gl, hl, lr params)                            │
 * │  ├── 3. Domain filtering (block e-commerce, shops)                     │
 * │  └── 4. Language filtering (franc detection)                            │
 * └─────────────────────────────────────────────────────────────────────────┘
 * 
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  searchYouTubeSerper / searchInstagramSerper / searchTikTokSerper       │
 * │  ├── 1. Serper API call (site:youtube.com, etc.)                       │
 * │  ├── 2. Language filtering                                              │
 * │  └── 3. Apify enrichment (enrichYouTubeByUrls, etc.)                   │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

import { 
  enrichTikTokByUrls, 
  enrichYouTubeByUrls,
  enrichInstagramByUrls
} from './apify';
import { 
  getLocationConfig, 
  filterResultsByLanguage, 
  filterResultsByTLD,           // January 28, 2026: TLD-based country filtering
  getLanguageName,
  type LanguageFilterConfig,
  type TLDFilterConfig          // January 28, 2026: TLD filter configuration type
} from './location';

const SERPER_API_KEY = process.env.SERPER_API_KEY;

// =============================================================================
// January 29, 2026: REMOVED USE_SERPER_FOR_SOCIAL feature flag
// 
// The feature flag has been permanently enabled and the conditional code removed.
// All social media searches now use Serper for discovery + Apify enrichment.
// 
// Benefits of current approach:
// - Better language accuracy (~90% vs ~30% with Apify-only)
// - Faster searches (~5-10s vs ~30-168s)
// - Still get rich metadata (followers, bio) via Apify enrichment
// 
// The old Apify-only search functions were dead code and have been removed.
// =============================================================================

// Helper to format numbers (e.g., 5700 -> "5.7K")
// Used for formatting follower counts in channel object
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
// E-COMMERCE DOMAIN BLOCKLIST - January 16, 2026
// 
// These are known e-commerce/marketplace domains that should be excluded from
// affiliate search results. These sites sell products directly - they are NOT
// affiliates who promote products for commission.
// 
// This list covers:
// - Major marketplaces (Amazon, eBay, Walmart, etc.)
// - E-commerce platforms (Shopify stores are detected by URL patterns)
// - Big-box retailers
// - Fashion/department stores
// =============================================================================
// Exported for use in apify-google-scraper.ts
export const ECOMMERCE_DOMAINS = [
  // Amazon (all regions)
  'amazon.com', 'amazon.de', 'amazon.co.uk', 'amazon.fr', 'amazon.es', 
  'amazon.it', 'amazon.ca', 'amazon.com.au', 'amazon.co.jp', 'amazon.in',
  'amazon.com.mx', 'amazon.com.br', 'amazon.nl', 'amazon.se', 'amazon.pl',
  'amazon.sg', 'amazon.ae', 'amazon.sa', 'amazon.eg',
  
  // Major marketplaces
  'ebay.com', 'ebay.de', 'ebay.co.uk', 'ebay.fr', 'ebay.it', 'ebay.es', 'ebay.ca', 'ebay.com.au',
  'etsy.com',
  'aliexpress.com', 'alibaba.com',
  'wish.com', 'temu.com', 'shein.com',
  'mercadolibre.com', 'mercadolivre.com.br',
  'rakuten.com', 'rakuten.co.jp',
  
  // Big-box retailers
  'walmart.com', 'target.com', 'costco.com', 'samsclub.com',
  'bestbuy.com', 'bestbuy.ca',
  'homedepot.com', 'lowes.com',
  'wayfair.com', 'overstock.com',
  'newegg.com',
  'ikea.com',
  
  // Fashion/department stores
  'macys.com', 'nordstrom.com', 'kohls.com', 'jcpenney.com',
  'zappos.com', 'asos.com', 'hm.com', 'zara.com', 'uniqlo.com',
  'gap.com', 'oldnavy.com', 'nike.com', 'adidas.com',
  'footlocker.com', 'finishline.com',
  
  // Grocery/drugstore
  'walgreens.com', 'cvs.com', 'riteaid.com',
  'kroger.com', 'safeway.com', 'albertsons.com',
  'instacart.com', 'doordash.com', 'ubereats.com',
  
  // Electronics
  'apple.com', 'samsung.com', 'dell.com', 'hp.com', 'lenovo.com',
  'microsoft.com', 'store.google.com',
  
  // E-commerce platforms (the platforms themselves)
  'shopify.com', 'bigcommerce.com', 'woocommerce.com', 'magento.com',
  'squarespace.com', 'wix.com',
  
  // ==========================================================================
  // MAJOR PUBLICATIONS - January 16, 2026
  // 
  // These are large media companies that WON'T respond to affiliate partnership
  // requests. They have their own affiliate programs or don't do partnerships.
  // Finding "TechRadar" or "Wirecutter" is useless for client outreach.
  // 
  // We want to find INDIVIDUAL content creators, not corporate publications.
  // ==========================================================================
  
  // Tech publications (unreachable for partnerships)
  'techradar.com', 'tomsguide.com', 'tomshardware.com',
  'cnet.com', 'zdnet.com',
  'theverge.com', 'engadget.com', 'gizmodo.com',
  'wired.com', 'arstechnica.com',
  'pcmag.com', 'pcworld.com', 'macworld.com',
  'techcrunch.com', 'mashable.com',
  'digitaltrends.com', 'androidcentral.com', 'imore.com',
  'howtogeek.com', 'lifehacker.com', 'makeuseof.com',
  
  // Major news/media (won't respond to partnership requests)
  'nytimes.com', 'wirecutter.com',  // Wirecutter is NYT-owned
  'wsj.com', 'washingtonpost.com',
  'forbes.com', 'businessinsider.com', 'insider.com',
  'bloomberg.com', 'reuters.com',
  'cnn.com', 'bbc.com', 'bbc.co.uk',
  'theguardian.com', 'independent.co.uk',
  'usatoday.com', 'huffpost.com',
  'msn.com',  // January 30, 2026: Microsoft News aggregator
  
  // Yahoo properties (shopping, news)
  'yahoo.com', 'shopping.yahoo.com',
  
  // Review aggregators (corporate, not individual creators)
  'consumerreports.org', 'rtings.com',
  'trustpilot.com', 'sitejabber.com', 'g2.com',
  'capterra.com', 'softwareadvice.com',
  
  // Content farms / low-quality sites
  'buzzfeed.com', 'boredpanda.com',
  'ranker.com', 'list25.com',
  
  // Social/community platforms (find creators ON these, not the platforms)
  'reddit.com', 'quora.com',
  'pinterest.com', 'tumblr.com',
  'medium.com',  // Medium authors can be contacted, but medium.com itself is not useful
  'linkedin.com', 'facebook.com', 'twitter.com', 'x.com',
  
  // ==========================================================================
  // SOCIAL MEDIA PLATFORMS - January 21, 2026 (REV-104 Fix)
  // 
  // CRITICAL FIX: Block TikTok, Instagram, YouTube from Web search results
  // 
  // PROBLEM:
  // When Serper returns social media URLs (e.g., tiktok.com/@username), they
  // get saved as "Web" results with domain="tiktok.com". When users click
  // "Find Email", the enrichment API tries to lookup "tiktok.com" via Lusha/Apollo,
  // which FAILS because these services need BUSINESS DOMAINS, not social platforms.
  // 
  // SOLUTION:
  // Block these domains from Web search results entirely. Users will still find
  // creators on these platforms via the dedicated Apify scrapers (YouTube scraper,
  // Instagram scraper, TikTok scraper), which return proper profile data with
  // bio emails extracted.
  // 
  // WHY THIS WORKS:
  // - Prevents "domain=tiktok.com" from being saved to database
  // - Apify scrapers find creators WITH their bio emails already extracted
  // - Email enrichment only runs on actual business domains
  // - No more "Invalid domain" errors for social media URLs
  // 
  // AFFECTED ISSUE: REV-104 "Error by Mail finding" (TikTok email lookup errors)
  // ==========================================================================
  'tiktok.com',
  'instagram.com',
  'youtube.com',
  'youtu.be',  // YouTube short links
  
  // Wikipedia / reference
  'wikipedia.org', 'wikihow.com',
  
  // Developer platforms (not useful for affiliate outreach)
  'github.com', 'github.io',
  
  // Client domains (don't need to find themselves)
  'selecdoo.com',
];

// =============================================================================
// SHOP URL PATTERNS - January 16, 2026
// 
// URL path patterns that indicate a page is a product/shop page rather than
// content. If a URL contains any of these patterns, it's likely a shop.
// 
// Examples:
// - https://example.com/product/blue-widget → EXCLUDED (shop)
// - https://example.com/review/best-widgets → INCLUDED (content)
// =============================================================================
const SHOP_URL_PATTERNS = [
  '/product/',
  '/products/',
  '/shop/',
  '/store/',
  '/cart/',
  '/checkout/',
  '/buy/',
  '/add-to-cart',
  '/add_to_cart',
  '/collections/',
  '/p/',        // Common short product URL
  '/dp/',       // Amazon product pattern
  '/gp/',       // Amazon gift/product pattern
  '/item/',     // eBay pattern
  '/itm/',      // eBay pattern
  '/listing/',
  '/offer/',
  '/deal/',
  '/buy-now',
  '/purchase/',
  '/order/',
  '/basket/',
  '/wishlist/',
];

// =============================================================================
// AFFILIATE/CREATOR CONTENT SIGNALS - January 16, 2026
// 
// Positive signals that indicate a page belongs to an INDIVIDUAL content creator
// who might be open to affiliate partnerships.
// 
// PRIORITY 1 - Partnership signals (creators actively seeking partnerships):
// - "work with me" → Creator has a partnership page
// - "contact me" → Creator is reachable
// - "sponsored" → Already does sponsored content
// - "affiliate" → Already does affiliate marketing
// - "collaborate" → Open to collaborations
// 
// PRIORITY 2 - Creator identity signals:
// - "blogger" → Individual blogger
// - "influencer" → Social media influencer
// - "creator" → Content creator
// - "my blog" → Personal blog
// 
// PRIORITY 3 - Review content (but from individuals, not publications):
// - "honest review" → Personal review
// - "I tried" → Personal experience
// - "my experience" → Personal experience
// =============================================================================
const AFFILIATE_CONTENT_SIGNALS = [
  // Partnership signals (HIGH PRIORITY - these creators want partnerships)
  'work with me',
  'work with us',
  'contact me',
  'contact us',
  'sponsored post',
  'sponsored content',
  'affiliate disclosure',
  'affiliate links',
  'collaborate with me',
  'collaboration',
  'brand partnership',
  'pr friendly',
  'media kit',
  
  // Creator identity signals
  'blogger',
  'influencer',
  'content creator',
  'my blog',
  'my channel',
  'my review',
  'i reviewed',
  'i tried',
  'i tested',
  'my experience',
  'my honest',
  
  // Review content signals
  'review',
  'reviews',
  'honest review',
  'unbiased review',
  'tested',
  'hands-on',
  'pros and cons',
  'worth it',
  'should you buy',
  
  // Comparison signals
  'vs',
  'versus',
  'comparison',
  'alternatives',
  'alternative to',
];

// =============================================================================
// SHOP CONTENT SIGNALS - January 16, 2026
// 
// Negative signals that indicate a page is a shop/product page.
// Pages with these patterns are likely shops, not affiliates.
// =============================================================================
const SHOP_CONTENT_SIGNALS = [
  'add to cart',
  'buy now',
  'in stock',
  'out of stock',
  'free shipping',
  'ships from',
  'sold by',
  'price:',
  '$ off',
  '% off',
  'checkout',
  'shopping cart',
  'add to bag',
  'add to basket',
];

// Serper.dev endpoints (only used for Web searches)
const SERPER_ENDPOINTS = {
  search: 'https://google.serper.dev/search',
  videos: 'https://google.serper.dev/videos',
  images: 'https://google.serper.dev/images',
  news: 'https://google.serper.dev/news',
};

// =============================================================================
// AFFILIATE SEARCH QUERY BUILDER - January 16, 2026
// 
// Tested with Firecrawl & Serper APIs. Results:
// 
// OPTION 1 - Brand reviews ("bedrop review" OR "bedrop erfahrung"):
//   ✅ 55% useful - Found joyce-huebner.com (blogger), TikTok creators
//   Best for: Finding people ALREADY promoting a specific brand
// 
// OPTION 2 - Niche bloggers ("propolis blogger" OR "manuka influencer"):
//   ✅ 50% on Serper - Found Instagram creators, beauty blogs, niche content
//   Best for: Finding NEW affiliates who could promote the brand
// 
// OPTION 3 - Competitor/niche terms ("gelee royal test" OR "propolis blog"):
//   ✅ 50% useful - Found competitor blogs (bienenherz.de, beegut.de)
//   Best for: Finding creators in the same product category
// 
// STRATEGY: Detect if keyword is a brand (contains domain) or niche term,
// then use the optimal query pattern for each.
// =============================================================================

/**
 * Detect if a keyword looks like a brand/domain name
 * 
 * Examples:
 * - "bedrop.de" → true (has TLD)
 * - "selecdoo.com" → true (has TLD)
 * - "propolis" → false (generic term)
 * - "fitness tracker" → false (product category)
 */
function isBrandKeyword(keyword: string): boolean {
  // Check for common TLDs
  const domainPattern = /\.(com|de|co\.uk|net|org|io|shop|store|eu|at|ch|fr|es|it|nl|be|pl|se|no|dk|fi)/i;
  return domainPattern.test(keyword);
}

/**
 * Clean a keyword for search queries
 * Removes protocol and www prefix from domain-like keywords
 */
function cleanKeywordForSearch(keyword: string): string {
  return keyword
    .replace(/^https?:\/\//, '')  // Remove protocol
    .replace(/^www\./, '')         // Remove www
    .replace(/\/$/, '')            // Remove trailing slash
    .trim();
}

// =============================================================================
// LOCALIZED SEARCH TERMS - January 23, 2026
//
// Maps target languages to their localized search terms.
// Only includes European languages for now (most common non-English markets).
// =============================================================================
const LOCALIZED_TERMS: Record<string, { review: string; discount: string }> = {
  'German': { review: 'erfahrung', discount: 'rabatt' },
  'Spanish': { review: 'reseña', discount: 'descuento' },
  'French': { review: 'avis', discount: 'réduction' },
  'Portuguese': { review: 'avaliação', discount: 'desconto' },
  'Italian': { review: 'recensione', discount: 'sconto' },
  'Dutch': { review: 'ervaring', discount: 'korting' },
};

/**
 * Build an optimized search query based on keyword type
 * 
 * NOTE: This is for WEB/BLOG searches only!
 * YouTube, Instagram, TikTok are searched via dedicated Apify scrapers.
 * No need to include social platform terms here.
 * 
 * BRAND SEARCHES (keyword contains TLD like .de, .com):
 *   → Find BLOGS already promoting this brand
 *   → Query: "brand review" + localized terms based on user's target language
 *   → Expected: Bloggers with discount codes, review sites, coupon sites
 * 
 * NICHE SEARCHES (product category, ingredient, etc.):
 *   → Find BLOGS in this niche who could become affiliates
 *   → Query: "niche blog" OR "niche blogger" OR "niche review"
 *   → Expected: Personal blogs, niche review sites
 * 
 * Updated: January 23, 2026 - Language-aware queries
 * Only includes localized terms when user's target language is non-English.
 * 
 * @param keyword - The search keyword
 * @param targetLanguage - User's target language from onboarding (optional)
 */
function buildAffiliateSearchQuery(keyword: string, targetLanguage?: string | null): string {
  const cleanKeyword = cleanKeywordForSearch(keyword);
  const localizedTerms = targetLanguage ? LOCALIZED_TERMS[targetLanguage] : null;
  
  if (isBrandKeyword(keyword)) {
    // ==========================================================================
    // BRAND SEARCH QUERY - January 16, 2026
    // Updated: January 23, 2026 - Language-aware queries
    // 
    // For brand/domain keywords, find BLOGS that already mention this brand:
    // 1. Review blogs that tested/reviewed this brand
    // 2. Coupon/deal blogs with discount codes (if language matches)
    // 3. Affiliate sites promoting this brand
    // ==========================================================================
    const brandName = cleanKeyword.split('.')[0]; // "bedrop.de" → "bedrop"
    
    // Base queries (universal)
    const queries = [
      `"${brandName} review"`,
      `"${brandName} test"`,
    ];
    
    // Add localized terms only if user's target language has them
    if (localizedTerms) {
      queries.push(`"${brandName} ${localizedTerms.review}"`);
      queries.push(`"${brandName} ${localizedTerms.discount}"`);
    }
    
    return `${queries.join(' OR ')} -site:amazon.com -site:ebay.com`;
  } else {
    // ==========================================================================
    // NICHE SEARCH QUERY - January 16, 2026
    // Updated: January 23, 2026 - Language-aware queries
    // 
    // For niche/product keywords, find PERSONAL BLOGS (not social media):
    // 1. Personal blogs with first-person review content
    // 2. Individual reviewers sharing their experience
    // 3. Small niche blogs (not major publications)
    // ==========================================================================
    const queries = [
      `"${cleanKeyword} review"`,
      `"${cleanKeyword} blog"`,
      `"${cleanKeyword} blogger"`,
    ];
    
    // Add localized review term only if user's target language has it
    if (localizedTerms) {
      queries.push(`"${cleanKeyword} ${localizedTerms.review}"`);
    }
    
    return `${queries.join(' OR ')} -site:amazon.com -site:ebay.com`;
  }
}

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
          num: 10, // Serper rejects num=25 for complex queries with OR clauses
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

// =============================================================================
// WEB SEARCH OPTIONS - January 16, 2026
// 
// Options for filtering web search results to find affiliates, not shops.
// =============================================================================
export interface WebSearchOptions {
  /** User's own domain to exclude (e.g., "selecdoo.com") */
  userBrand?: string;
  /** User's competitor domains (for reference, not excluded) */
  competitors?: string[];
  /** Additional domains to exclude */
  excludeDomains?: string[];
  /** Enable strict filtering (default: true) */
  strictFiltering?: boolean;
  // ==========================================================================
  // LOCATION FILTERING - January 16, 2026
  // 
  // Uses target_country and target_language from user's onboarding settings
  // to filter search results by geographic region.
  // - Serper: Uses gl/hl params for geo-targeted results
  // ==========================================================================
  /** Target country from onboarding (e.g., "Germany", "United Kingdom") */
  targetCountry?: string | null;
  /** Target language from onboarding (e.g., "German", "English") */
  targetLanguage?: string | null;
  // ==========================================================================
  // RAW QUERY MODE - January 23, 2026
  // 
  // When true, the keyword is used DIRECTLY as the search query without
  // any transformation via buildAffiliateSearchQuery().
  // 
  // USE CASE: Brand/competitor searches already have pre-built queries
  // like '"guffles review"' that should go directly to Serper.
  // Without this flag, we get double-quoting bugs like '""guffles review" review"'.
  // ==========================================================================
  /** If true, use keyword as raw query without transformation */
  rawQuery?: boolean;
}

/**
 * Check if a domain is an e-commerce/shop domain
 * Exported for use in apify-google-scraper.ts
 */
export function isEcommerceDomain(domain: string): boolean {
  const normalizedDomain = domain.toLowerCase().replace(/^www\./, '');
  
  return ECOMMERCE_DOMAINS.some(blocked => {
    // Check exact match or subdomain match
    return normalizedDomain === blocked || 
           normalizedDomain.endsWith('.' + blocked);
  });
}

/**
 * Check if a URL has shop-like patterns
 */
function hasShopUrlPattern(url: string): boolean {
  const lowerUrl = url.toLowerCase();
  return SHOP_URL_PATTERNS.some(pattern => lowerUrl.includes(pattern));
}

/**
 * Check if content (title + snippet) has shop signals
 */
function hasShopContentSignals(title: string, snippet: string): boolean {
  const content = `${title} ${snippet}`.toLowerCase();
  
  // Count shop signals
  const shopSignalCount = SHOP_CONTENT_SIGNALS.filter(signal => 
    content.includes(signal.toLowerCase())
  ).length;
  
  // If multiple shop signals, it's likely a shop
  return shopSignalCount >= 2;
}

/**
 * Check if content has affiliate/review signals
 */
function hasAffiliateContentSignals(title: string, snippet: string): boolean {
  const content = `${title} ${snippet}`.toLowerCase();
  
  return AFFILIATE_CONTENT_SIGNALS.some(signal => 
    content.includes(signal.toLowerCase())
  );
}

/**
 * Extract clean domain from URL (removes www. and trailing paths)
 */
function extractDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Filter search results to exclude shops and prioritize affiliates
 * 
 * Filtering logic:
 * 1. EXCLUDE: E-commerce domains (Amazon, eBay, etc.)
 * 2. EXCLUDE: User's own domain (they don't need to find themselves)
 * 3. EXCLUDE: URLs with shop patterns (/product/, /cart/, etc.)
 * 4. EXCLUDE: Content with strong shop signals (multiple "buy now", "add to cart")
 * 5. PRIORITIZE: Content with affiliate signals (review, best, guide, etc.)
 */
function filterAndPrioritizeResults(
  results: SearchResult[],
  options: WebSearchOptions
): SearchResult[] {
  const { userBrand, excludeDomains = [], strictFiltering = true } = options;
  
  // Normalize user's brand domain
  const userBrandDomain = userBrand ? extractDomain(
    userBrand.includes('://') ? userBrand : `https://${userBrand}`
  ) : null;
  
  // Build exclusion set
  const customExclusions = new Set(
    excludeDomains.map(d => d.toLowerCase().replace(/^www\./, ''))
  );
  
  // Filter results
  const filtered = results.filter(result => {
    const domain = result.domain.toLowerCase().replace(/^www\./, '');
    const url = result.link;
    const title = result.title || '';
    const snippet = result.snippet || '';
    
    // 1. Exclude e-commerce domains
    if (isEcommerceDomain(domain)) {
      console.log(`🚫 Excluded (e-commerce): ${domain}`);
      return false;
    }
    
    // 2. Exclude user's own domain
    if (userBrandDomain && domain.includes(userBrandDomain)) {
      console.log(`🚫 Excluded (user's brand): ${domain}`);
      return false;
    }
    
    // 3. Exclude custom domains
    if (customExclusions.has(domain)) {
      console.log(`🚫 Excluded (custom): ${domain}`);
      return false;
    }
    
    // 4. Exclude shop URL patterns (if strict filtering enabled)
    if (strictFiltering && hasShopUrlPattern(url)) {
      console.log(`🚫 Excluded (shop URL pattern): ${url}`);
      return false;
    }
    
    // 5. Exclude pages with strong shop content signals (if strict filtering)
    if (strictFiltering && hasShopContentSignals(title, snippet)) {
      // But allow if it also has affiliate signals (might be a review with pricing)
      if (!hasAffiliateContentSignals(title, snippet)) {
        console.log(`🚫 Excluded (shop content): ${title}`);
        return false;
      }
    }
    
    return true;
  });
  
  // Sort: Prioritize results with affiliate content signals
  filtered.sort((a, b) => {
    const aHasSignals = hasAffiliateContentSignals(a.title || '', a.snippet || '');
    const bHasSignals = hasAffiliateContentSignals(b.title || '', b.snippet || '');
    
    if (aHasSignals && !bHasSignals) return -1;
    if (!aHasSignals && bHasSignals) return 1;
    return 0;
  });
  
  return filtered;
}

/**
 * Search Google for web results using Serper.dev
 * 
 * Updated December 16, 2025: Exported this function so it can be called
 * directly from the scout route for per-platform streaming.
 * 
 * Updated January 16, 2026: Added affiliate-focused filtering
 * - Improved search query to target review/blog content
 * - Excludes e-commerce domains (Amazon, eBay, etc.)
 * - Excludes user's own domain
 * - Excludes shop URL patterns (/product/, /cart/, etc.)
 * - Prioritizes results with affiliate content signals
 */
export async function searchWeb(
  keyword: string, 
  options: WebSearchOptions = {}
): Promise<SearchResult[]> {
  // ==========================================================================
  // SMART AFFILIATE SEARCH QUERY - January 16, 2026
  // Updated: January 23, 2026 - Added rawQuery support for brand/competitor searches
  // 
  // Uses buildAffiliateSearchQuery() to create optimized queries based on
  // keyword type (brand vs niche).
  // 
  // BRAND KEYWORDS (bedrop.de, selecdoo.com):
  //   → "brand review" OR "brand erfahrung" OR "brand test"
  //   → Finds: Existing affiliates, bloggers with discount codes
  //   → Tested: 55% useful results
  // 
  // NICHE KEYWORDS (propolis, fitness tracker):
  //   → "niche blogger" OR "niche influencer" OR "niche review blog"
  //   → Finds: Potential new affiliates in the space
  //   → Tested: 50% useful results
  // 
  // RAW QUERY MODE (January 23, 2026):
  //   When options.rawQuery is true, the keyword is used DIRECTLY without
  //   transformation. This is needed for brand/competitor searches that
  //   already have pre-built queries like '"guffles review"'.
  // 
  // Post-search filtering via filterAndPrioritizeResults() handles:
  //   - E-commerce domain exclusion (Amazon, eBay, etc.)
  //   - Major publication exclusion (TechRadar, Wirecutter, etc.)
  //   - User's own domain exclusion
  //   - Shop URL pattern detection
  // ==========================================================================
  
  // January 23, 2026: Support raw queries for brand/competitor searches
  // When rawQuery is true, use keyword directly without transformation
  // Also pass targetLanguage for localized search terms (e.g., "erfahrung" only for German)
  const query = options.rawQuery ? keyword : buildAffiliateSearchQuery(keyword, options.targetLanguage);
  const isBrand = options.rawQuery ? false : isBrandKeyword(keyword);
  const modeLabel = options.rawQuery ? 'RAW' : (isBrand ? 'BRAND' : 'NICHE');

  console.log(`🔍 Web search (${modeLabel} mode, lang: ${options.targetLanguage || 'en'}): "${query}"`);

  // ==========================================================================
  // LOCATION-BASED FILTERING - January 16, 2026
  // Updated January 26, 2026: Added `lr` (language restrict) parameter
  // 
  // Uses gl (geolocation), hl (interface language), and lr (language restrict)
  // to get localized results in the target language.
  // 
  // Parameters explained:
  // - gl: Geolocation - results from this country are prioritized
  // - hl: Host Language - UI language (doesn't filter results by language)
  // - lr: Language Restrict - ACTUALLY filters results to this language only
  // 
  // Example: Germany + German → gl: 'de', hl: 'de', lr: 'lang_de'
  // Example: UK + English → gl: 'uk', hl: 'en', lr: 'lang_en'
  // 
  // This is based on the user's target_country and target_language from
  // onboarding settings. The location utility maps country/language names
  // to Serper API codes.
  // 
  // TEST RESULTS (January 26, 2026):
  // Without lr: 3/10 German content detected
  // With lr:    6/10 German content detected (2x improvement!)
  // ==========================================================================
  const locationConfig = getLocationConfig(options.targetCountry, options.targetLanguage);
  const serperLocationOptions = locationConfig 
    ? { 
        gl: locationConfig.countryCode, 
        hl: locationConfig.languageCode,
        lr: `lang_${locationConfig.languageCode}`,  // Language restrict - filters by language
      }
    : {};

  if (locationConfig) {
    console.log(`🌍 Location filter: ${options.targetCountry} (gl=${locationConfig.countryCode}, hl=${locationConfig.languageCode}, lr=lang_${locationConfig.languageCode})`);
  }

  // ==========================================================================
  // PAGINATION - January 16, 2026
  // 
  // Fetch page 1 and page 2 in parallel to get 20 results instead of 10.
  // Each page costs 1 Serper credit (total: 2 credits for 20 results).
  // ==========================================================================
  const [page1, page2] = await Promise.all([
    serperFetch(SERPER_ENDPOINTS.search, query, serperLocationOptions),
    serperFetch(SERPER_ENDPOINTS.search, query, { page: 2, ...serperLocationOptions }),
  ]);

  if (page1.error && page2.error) {
    console.error('❌ Both Serper requests failed');
    return [];
  }

  // Combine results from both pages
  const organic1 = page1.organic || [];
  const organic2 = page2.organic || [];
  const organic = [...organic1, ...organic2];
  
  console.log(`🌐 Web results (raw): ${organic.length} (page1: ${organic1.length}, page2: ${organic2.length})`);

  // Transform to SearchResult format
  const results: SearchResult[] = organic.map((r: any, index: number) => {
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

  // ==========================================================================
  // APPLY DOMAIN FILTERING - January 16, 2026
  // 
  // Filter out shops and prioritize affiliate content.
  // This is a second layer of filtering after the search query.
  // Some shops may still slip through the search query, so we filter them here.
  // ==========================================================================
  const domainFiltered = filterAndPrioritizeResults(results, options);
  
  console.log(`🏪 Domain filter: ${domainFiltered.length}/${results.length} passed (excluded ${results.length - domainFiltered.length} shops)`);

  // ==========================================================================
  // APPLY LANGUAGE FILTERING - January 26, 2026
  // 
  // Post-filter results using franc library to ensure content matches the
  // user's target language. This addresses the ~30% of non-target language
  // results that slip through Serper's `lr` parameter.
  // 
  // How it works:
  // 1. Combines title + snippet for each result
  // 2. Detects language using trigram frequency analysis (franc)
  // 3. Filters out results where detected language ≠ target language
  // 4. Skips filtering for short/ambiguous texts to avoid false positives
  // 
  // Expected improvement:
  // - Before: ~70% target language (Serper lr param only)
  // - After:  ~95%+ target language (franc post-filter)
  // 
  // Performance impact: ~20ms for 20 results (negligible)
  // ==========================================================================
  const languageFilterConfig: LanguageFilterConfig = {
    enabled: !!locationConfig?.languageCode,
    targetLanguageCode: locationConfig?.languageCode || 'en',
    verbose: process.env.NODE_ENV === 'development', // Log filtering decisions in dev
  };

  let finalResults: SearchResult[];
  
  if (languageFilterConfig.enabled) {
    const targetLanguageName = getLanguageName(languageFilterConfig.targetLanguageCode);
    console.log(`🌐 Language filter: Filtering for ${targetLanguageName} content...`);
    
    const { results: languageFiltered, stats } = filterResultsByLanguage(
      domainFiltered,
      languageFilterConfig
    );
    
    // Log comprehensive statistics for debugging and monitoring
    console.log(`🌐 Language filter results:`);
    console.log(`   ├── Total input: ${stats.totalBefore}`);
    console.log(`   ├── Passed (${targetLanguageName}): ${stats.passed}`);
    console.log(`   ├── Filtered (wrong language): ${stats.filtered}`);
    console.log(`   ├── Skipped (short/ambiguous): ${stats.skipped}`);
    console.log(`   └── Breakdown: ${JSON.stringify(stats.languageBreakdown)}`);
    
    finalResults = languageFiltered;
  } else {
    console.log(`🌐 Language filter: Disabled (no target language set)`);
    finalResults = domainFiltered;
  }

  // ==========================================================================
  // TLD-BASED COUNTRY FILTERING - January 28, 2026
  // 
  // Purpose:
  // Filter results by domain TLD (Top-Level Domain) to ensure results are from
  // the user's target country or related regions. This is the final filtering
  // step after language detection.
  // 
  // Why this is needed:
  // Even with Serper's gl/hl/lr parameters and franc language detection, some
  // results from unrelated countries may slip through. For example, a German
  // user might see .fr (France) or .es (Spain) domains with German content.
  // 
  // How it works:
  // - Each country has a list of allowed TLDs (defined in location.ts)
  // - Germany allows: .de, .at, .ch (DACH region) + .com, .net, .org, .io
  // - Results from other country TLDs (.fr, .es, .it, .co.uk, etc.) are blocked
  // 
  // Configuration:
  // - Only runs when targetCountry is set in user's onboarding
  // - Logs only when results are actually filtered (not verbose)
  // ==========================================================================
  if (options.targetCountry) {
    const tldFilterConfig: TLDFilterConfig = {
      enabled: true,
      targetCountry: options.targetCountry,
    };

    const { results: tldFiltered, stats: tldStats } = filterResultsByTLD(
      finalResults,
      tldFilterConfig
    );

    // Only log if we actually filtered something (keep logs clean)
    if (tldStats.filtered > 0) {
      console.log(`🌍 TLD filter: ${tldStats.passed}/${tldStats.totalBefore} passed (blocked: ${tldStats.blockedTLDs.join(', ')})`);
    }

    finalResults = tldFiltered;
  }
  
  console.log(`✅ Web results (final): ${finalResults.length}/${results.length}`);

  return finalResults;
}

// =============================================================================
// SERPER-BASED SOCIAL MEDIA SEARCH FUNCTIONS
// Added: January 26, 2026
// 
// PURPOSE:
// Alternative to Apify actors for YouTube, Instagram, TikTok searches.
// Uses Google search with site: filters and language params (gl, hl, lr).
// 
// WHEN TO USE:
// Only when USE_SERPER_FOR_SOCIAL feature flag is enabled.
// Provides better language accuracy (~90% vs ~30%) at the cost of losing
// rich metadata (followers, subscribers, views, bio, email).
// 
// ARCHITECTURE:
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ searchYouTubeSerper(keyword, options)                                   │
// │ ├── 1. Build query: "keyword site:youtube.com"                         │
// │ ├── 2. Add language params: gl, hl, lr                                 │
// │ ├── 3. Fetch multiple pages from Serper                                │
// │ ├── 4. Parse results into SearchResult format                          │
// │ └── 5. Apply franc language post-filter                                │
// └─────────────────────────────────────────────────────────────────────────┘
// 
// DATA MAPPING (Serper → SearchResult):
// ┌──────────────────┬───────────────────────────────────────────────────────┐
// │ SearchResult     │ Serper Source                                         │
// ├──────────────────┼───────────────────────────────────────────────────────┤
// │ title            │ result.title                                          │
// │ link             │ result.link                                           │
// │ snippet          │ result.snippet                                        │
// │ date             │ result.date (e.g., "vor 1 Tag")                       │
// │ source           │ 'YouTube' | 'Instagram' | 'TikTok'                    │
// │ domain           │ Extracted from link                                   │
// │ tiktokUsername   │ Parsed from URL (TikTok only)                         │
// │ ALL OTHER FIELDS │ null (not available from Serper)                      │
// └──────────────────┴───────────────────────────────────────────────────────┘
// 
// IMPORTANT NOTES:
// - These functions do NOT replace Apify. They are an alternative.
// - The Apify functions in apify.ts remain completely unchanged.
// - Switching between approaches is controlled by USE_SERPER_FOR_SOCIAL flag.
// - If this experiment fails, simply disable the flag to revert.
// =============================================================================

/**
 * Number of Serper pages to fetch for social media searches.
 * Each page returns ~10 results. 3 pages = ~30 results per platform.
 * 
 * Added: January 26, 2026
 */
const SERPER_SOCIAL_PAGES = 5;

/**
 * Helper: Fetch a single page from Serper for social media search.
 * 
 * Added: January 26, 2026
 * 
 * @param query - Search query (e.g., "propolis site:youtube.com")
 * @param page - Page number (1-based)
 * @param locationParams - Serper location params (gl, hl, lr)
 * @returns Serper API response
 */
async function serperFetchSocialPage(
  query: string,
  page: number,
  locationParams: Record<string, string>
): Promise<any> {
  if (!SERPER_API_KEY) {
    console.error('❌ SERPER_API_KEY is not configured');
    return { error: 'API key not configured' };
  }

  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query,
        num: 10,
        page,
        ...locationParams,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Serper HTTP ${response.status}: ${errorText}`);
      return { error: `HTTP ${response.status}` };
    }

    return await response.json();
  } catch (error: any) {
    console.error(`❌ Serper fetch error:`, error.message);
    return { error: error.message };
  }
}

/**
 * Helper: Fetch multiple pages from Serper and combine results.
 * 
 * Added: January 26, 2026
 * 
 * @param query - Search query (e.g., "propolis site:youtube.com")
 * @param numPages - Number of pages to fetch
 * @param locationParams - Serper location params (gl, hl, lr)
 * @returns Array of organic results from all pages
 */
async function serperFetchMultipleSocialPages(
  query: string,
  numPages: number,
  locationParams: Record<string, string>
): Promise<any[]> {
  const pagePromises = [];
  for (let page = 1; page <= numPages; page++) {
    pagePromises.push(serperFetchSocialPage(query, page, locationParams));
  }

  const results = await Promise.all(pagePromises);
  const allOrganic: any[] = [];

  for (const result of results) {
    if (result.organic && Array.isArray(result.organic)) {
      allOrganic.push(...result.organic);
    }
  }

  return allOrganic;
}

/**
 * Helper: Parse TikTok username from URL.
 * 
 * Added: January 26, 2026
 * 
 * Example: "https://www.tiktok.com/@janine.griesser/video/123" → "janine.griesser"
 * 
 * @param url - TikTok URL
 * @returns Username without @ symbol, or null if not found
 */
function parseTikTokUsernameFromUrl(url: string): string | null {
  try {
    // Match pattern: tiktok.com/@username/...
    const match = url.match(/tiktok\.com\/@([^\/\?]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Search YouTube using Serper with site: filter.
 * 
 * Added: January 26, 2026
 * 
 * WHEN TO USE:
 * Only when USE_SERPER_FOR_SOCIAL is true. Otherwise, use searchYouTubeApify.
 * 
 * WHAT YOU GET:
 * - Title, link, snippet, date
 * - Better language accuracy (~90%)
 * 
 * WHAT YOU DON'T GET (compared to Apify):
 * - Channel name, subscribers, thumbnail
 * - Video views, likes, comments
 * - Video duration
 * 
 * @param keyword - Search keyword
 * @param userId - User ID for tracking (optional)
 * @param maxResults - Maximum results (not used, controlled by SERPER_SOCIAL_PAGES)
 * @param targetCountry - Target country for localization
 * @param targetLanguage - Target language for localization
 * @returns Array of SearchResult objects
 */
export async function searchYouTubeSerper(
  keyword: string,
  userId?: number,
  maxResults: number = 15,
  targetCountry?: string | null,
  targetLanguage?: string | null
): Promise<SearchResult[]> {
  console.log(`🎬 [Serper] YouTube search: "${keyword}" (country: ${targetCountry || 'global'}, lang: ${targetLanguage || 'any'})`);

  // Get location config for Serper params
  const locationConfig = getLocationConfig(targetCountry, targetLanguage);
  const locationParams: Record<string, string> = locationConfig
    ? {
        gl: locationConfig.countryCode,
        hl: locationConfig.languageCode,
        lr: `lang_${locationConfig.languageCode}`,
      }
    : {};

  // ==========================================================================
  // QUERY OPTIMIZATION - January 27, 2026
  // 
  // Adding "review" to the query improves results (same as TikTok):
  // - Targets content creators who review products
  // - Filters out official brand channels
  // - Better chance of finding affiliates open to partnerships
  // ==========================================================================
  const query = `${keyword} review site:youtube.com`;

  // Fetch multiple pages
  const rawResults = await serperFetchMultipleSocialPages(query, SERPER_SOCIAL_PAGES, locationParams);

  console.log(`🎬 [Serper] YouTube raw results: ${rawResults.length}`);

  // Transform to SearchResult format
  let results: SearchResult[] = rawResults.map((r: any, index: number): SearchResult => ({
    title: r.title || '',
    link: r.link || '',
    snippet: r.snippet || '',
    source: 'YouTube' as Platform,
    domain: 'youtube.com',
    date: r.date || null,
    position: index + 1,
    searchQuery: keyword,
    // YouTube-specific fields - will be populated by Apify enrichment below
    channel: undefined,
    duration: undefined,
    views: undefined,
    thumbnail: undefined,
    youtubeVideoLikes: undefined,
    youtubeVideoComments: undefined,
  }));

  // ==========================================================================
  // APIFY ENRICHMENT - January 27, 2026
  // 
  // Enrich Serper results with full YouTube metadata from Apify.
  // This gives us the best of both worlds:
  // - Serper: Good language filtering (~90% accuracy)
  // - Apify: Rich metadata (subscribers, views, likes, comments, duration)
  // 
  // The enrichment is done BEFORE language filtering so that we have
  // complete data for all results that pass the language filter.
  // ==========================================================================
  if (results.length > 0) {
    const videoUrls = results
      .map(r => r.link)
      .filter((url): url is string => !!url && url.includes('youtube.com/watch'));

    if (videoUrls.length > 0) {
      console.log(`🎬 [Serper] Enriching ${videoUrls.length} YouTube URLs via Apify...`);
      
      try {
        const enrichedData = await enrichYouTubeByUrls(videoUrls, userId);
        
        if (enrichedData.size > 0) {
          console.log(`🎬 [Serper] Enrichment complete: ${enrichedData.size}/${videoUrls.length} URLs enriched`);
          
          // Merge enriched data into results
          results = results.map(result => {
            const apifyData = enrichedData.get(result.link);
            
            if (apifyData) {
              // Merge Apify data with Serper result
              return {
                ...result,
                // CRITICAL: Populate channel field for UI compatibility
                // The row displays channel?.name, so without this the UI shows "youtube.com"
                channel: {
                  name: apifyData.channelName || 'Unknown Channel',
                  link: apifyData.channelUrl || `https://www.youtube.com/@${apifyData.channelUsername || 'unknown'}`,
                  verified: apifyData.isVerified,
                  subscribers: apifyData.numberOfSubscribers ? formatNumber(apifyData.numberOfSubscribers) : undefined,
                },
                // Video metadata
                views: apifyData.viewCount ? formatNumber(apifyData.viewCount) : undefined,
                youtubeVideoLikes: apifyData.likes,
                youtubeVideoComments: apifyData.commentsCount,
                duration: apifyData.duration,
                thumbnail: apifyData.thumbnailUrl,
                // Use Apify's title and description if available (more complete)
                title: apifyData.title || result.title,
                snippet: apifyData.text?.substring(0, 300) || result.snippet,
                // Use Apify's proper ISO date if available
                date: apifyData.date || apifyData.uploadDate || result.date,
              };
            }
            
            // Return original result if no enrichment data
            return result;
          });
        }
      } catch (enrichError: any) {
        // Log error but continue with Serper-only results
        console.warn(`⚠️ [Serper] YouTube enrichment failed (continuing with basic data):`, enrichError.message);
      }
    }
  }

  // ==========================================================================
  // FILTER: Only keep enriched results
  // 
  // Skip YouTube results that don't have enrichment data.
  // This ensures we only show results with proper metadata (subscribers, etc.)
  // ==========================================================================
  const beforeFilterCount = results.length;
  results = results.filter(r => r.channel && r.channel.name !== 'Unknown Channel');
  console.log(`🎬 [Serper] YouTube after enrichment filter: ${results.length}/${beforeFilterCount} (removed ${beforeFilterCount - results.length} non-enriched)`);

  // Apply language filtering if target language is set
  if (locationConfig?.languageCode) {
    const languageFilterConfig: LanguageFilterConfig = {
      enabled: true,
      targetLanguageCode: locationConfig.languageCode,
      verbose: process.env.NODE_ENV === 'development',
    };

    const { results: filteredResults, stats } = filterResultsByLanguage(results, languageFilterConfig);
    console.log(`🎬 [Serper] YouTube after language filter: ${filteredResults.length}/${results.length}`);
    results = filteredResults;
  }

  // ==========================================================================
  // TLD-BASED COUNTRY FILTERING - January 28, 2026
  // 
  // Filter YouTube results by domain TLD to ensure results are from the user's
  // target country. While YouTube URLs are always youtube.com, the linked
  // channel pages and external links may have country-specific TLDs.
  // 
  // Note: For YouTube, this primarily catches edge cases where non-youtube.com
  // URLs appear in results (rare but possible).
  // ==========================================================================
  if (targetCountry) {
    const { results: tldFiltered, stats: tldStats } = filterResultsByTLD(
      results,
      { enabled: true, targetCountry }
    );

    if (tldStats.filtered > 0) {
      console.log(`🎬 [Serper] YouTube TLD filter: ${tldStats.passed}/${tldStats.totalBefore} (blocked: ${tldStats.blockedTLDs.join(', ')})`);
    }

    results = tldFiltered;
  }

  return results;
}

/**
 * Search Instagram using Serper with site: filter + Apify enrichment.
 * 
 * Added: January 26, 2026
 * Updated: January 28, 2026 - Added Apify enrichment for full profile data
 * 
 * HYBRID APPROACH:
 * 1. Serper: Find Instagram content with language filtering (~90% accuracy)
 * 2. Apify: Enrich URLs with full profile data (followers, bio, posts, etc.)
 * 
 * WHEN TO USE:
 * Only when USE_SERPER_FOR_SOCIAL is true. Otherwise, use searchInstagramApify.
 * 
 * WHAT YOU GET (after enrichment):
 * - Username, full name, bio
 * - Followers, following, posts count
 * - Is verified, is business
 * - Latest post likes, comments, views
 * - Profile picture
 * - Better language accuracy (~90%)
 * 
 * @param keyword - Search keyword
 * @param userId - User ID for tracking (optional)
 * @param maxResults - Maximum results (not used, controlled by SERPER_SOCIAL_PAGES)
 * @param targetCountry - Target country for localization
 * @param targetLanguage - Target language for localization
 * @returns Array of SearchResult objects with full Instagram profile data
 */
export async function searchInstagramSerper(
  keyword: string,
  userId?: number,
  maxResults: number = 15,
  targetCountry?: string | null,
  targetLanguage?: string | null
): Promise<SearchResult[]> {
  console.log(`📸 [Serper] Instagram search: "${keyword}" (country: ${targetCountry || 'global'}, lang: ${targetLanguage || 'any'})`);

  // Get location config for Serper params
  const locationConfig = getLocationConfig(targetCountry, targetLanguage);
  const locationParams: Record<string, string> = locationConfig
    ? {
        gl: locationConfig.countryCode,
        hl: locationConfig.languageCode,
        lr: `lang_${locationConfig.languageCode}`,
      }
    : {};

  // ==========================================================================
  // QUERY OPTIMIZATION - January 28, 2026
  // 
  // Adding "review" to the query improves results (same as YouTube/TikTok):
  // - Targets content creators who review products
  // - Filters out official brand accounts
  // - Better chance of finding affiliates open to partnerships
  // ==========================================================================
  const query = `${keyword} review site:instagram.com`;

  // Fetch multiple pages
  const rawResults = await serperFetchMultipleSocialPages(query, SERPER_SOCIAL_PAGES, locationParams);

  console.log(`📸 [Serper] Instagram raw results: ${rawResults.length}`);

  // Transform to SearchResult format
  let results: SearchResult[] = rawResults.map((r: any, index: number): SearchResult => ({
    title: r.title || '',
    link: r.link || '',
    snippet: r.snippet || '',
    source: 'Instagram' as Platform,
    domain: 'instagram.com',
    date: r.date || null,
    position: index + 1,
    searchQuery: keyword,
    // Instagram-specific fields - will be populated by Apify enrichment below
    channel: undefined,
    instagramUsername: undefined,
    instagramFullName: undefined,
    instagramBio: undefined,
    instagramFollowers: undefined,
    instagramFollowing: undefined,
    instagramPostsCount: undefined,
    instagramIsBusiness: undefined,
    instagramIsVerified: undefined,
    instagramPostLikes: undefined,
    instagramPostComments: undefined,
    instagramPostViews: undefined,
    email: undefined,
    thumbnail: undefined,
  }));

  // ==========================================================================
  // APIFY ENRICHMENT - January 28, 2026
  // 
  // Enrich Serper results with full Instagram profile metadata from Apify.
  // This gives us the best of both worlds:
  // - Serper: Good language filtering (~90% accuracy)
  // - Apify: Rich metadata (username, followers, bio, posts, engagement)
  // 
  // The enrichment is done BEFORE language filtering so that we have
  // complete data for all results that pass the language filter.
  // 
  // NOTE: Serper returns mostly post/reel URLs (~92%), not profile URLs.
  // The Apify actor can take ANY URL type and return the author's profile.
  // ==========================================================================
  if (results.length > 0) {
    const instagramUrls = results
      .map(r => r.link)
      .filter((url): url is string => !!url && url.includes('instagram.com'));

    if (instagramUrls.length > 0) {
      console.log(`📸 [Serper] Enriching ${instagramUrls.length} Instagram URLs via Apify...`);
      
      try {
        const enrichedData = await enrichInstagramByUrls(instagramUrls, userId);
        
        if (enrichedData.size > 0) {
          console.log(`📸 [Serper] Enrichment complete: ${enrichedData.size}/${instagramUrls.length} URLs enriched`);
          
          // Merge enriched data into results
          results = results.map(result => {
            const apifyData = enrichedData.get(result.link);
            
            if (apifyData && (apifyData.username || (apifyData as any).ownerUsername)) {
              // January 30, 2026: Fixed to handle both POST URLs and PROFILE URLs
              // POST URLs: displayUrl, caption, likesCount at root level
              // PROFILE URLs: profilePicUrl at root, post data in latestPosts[0]
              const isPostUrl = !!(apifyData as any).displayUrl && !apifyData.latestPosts;
              const firstPost = apifyData.latestPosts?.[0];
              
              // Post data for RELEVANT CONTENT column
              const postThumbnail = isPostUrl ? (apifyData as any).displayUrl : firstPost?.displayUrl;
              const postCaption = isPostUrl ? (apifyData as any).caption : firstPost?.caption;
              const postLikes = isPostUrl ? (apifyData as any).likesCount : firstPost?.likesCount;
              const postComments = isPostUrl ? (apifyData as any).commentsCount : firstPost?.commentsCount;
              const postViews = isPostUrl ? (apifyData as any).videoViewCount : firstPost?.videoViewCount;
              
              // Profile pic for AFFILIATE column
              const profilePic = apifyData.profilePicUrlHD || apifyData.profilePicUrl;
              
              // Merge Apify data with Serper result
              return {
                ...result,
                // AFFILIATE column: profile pic + username + followers
                channel: {
                  name: (apifyData as any).ownerFullName || apifyData.fullName || (apifyData as any).ownerUsername || apifyData.username,
                  link: apifyData.url || `https://www.instagram.com/${(apifyData as any).ownerUsername || apifyData.username}/`,
                  thumbnail: profilePic,
                  verified: apifyData.verified,
                  subscribers: apifyData.followersCount ? formatNumber(apifyData.followersCount) : undefined,
                },
                // Profile metadata
                instagramUsername: (apifyData as any).ownerUsername || apifyData.username,
                instagramFullName: (apifyData as any).ownerFullName || apifyData.fullName,
                instagramBio: apifyData.biography,
                instagramFollowers: apifyData.followersCount,
                instagramFollowing: apifyData.followsCount,
                instagramPostsCount: apifyData.postsCount,
                instagramIsBusiness: apifyData.isBusinessAccount,
                instagramIsVerified: apifyData.verified,
                // Post engagement stats
                instagramPostLikes: postLikes,
                instagramPostComments: postComments,
                instagramPostViews: postViews,
                // RELEVANT CONTENT: post thumbnail + caption
                thumbnail: postThumbnail || profilePic,
                personName: (apifyData as any).ownerFullName || apifyData.fullName || (apifyData as any).ownerUsername || apifyData.username,
                title: postCaption?.substring(0, 100) || result.title,
                snippet: postCaption?.substring(0, 300) || apifyData.biography?.substring(0, 300) || result.snippet,
              };
            }
            
            // Return original result if no enrichment data
            return result;
          });
        }
      } catch (enrichError: any) {
        // Log error but continue with Serper-only results
        console.warn(`⚠️ [Serper] Instagram enrichment failed (continuing with basic data):`, enrichError.message);
      }
    }
  }

  // ==========================================================================
  // FILTER: Only keep enriched results - January 28, 2026
  // 
  // Skip Instagram results that don't have enrichment data.
  // This ensures we only show results with proper metadata (followers, etc.)
  // Users expect to see creator info, not just links to random posts.
  // ==========================================================================
  const beforeFilterCount = results.length;
  results = results.filter(r => r.channel && r.instagramUsername);
  console.log(`📸 [Serper] Instagram after enrichment filter: ${results.length}/${beforeFilterCount} (removed ${beforeFilterCount - results.length} non-enriched)`);

  // Apply language filtering if target language is set
  if (locationConfig?.languageCode) {
    const languageFilterConfig: LanguageFilterConfig = {
      enabled: true,
      targetLanguageCode: locationConfig.languageCode,
      verbose: process.env.NODE_ENV === 'development',
    };

    const { results: filteredResults, stats } = filterResultsByLanguage(results, languageFilterConfig);
    console.log(`📸 [Serper] Instagram after language filter: ${filteredResults.length}/${results.length}`);
    results = filteredResults;
  }

  // ==========================================================================
  // TLD-BASED COUNTRY FILTERING - January 28, 2026
  // 
  // Filter Instagram results by domain TLD to ensure results are from the
  // user's target country. While Instagram URLs are always instagram.com,
  // this filter catches edge cases and maintains consistency across platforms.
  // ==========================================================================
  if (targetCountry) {
    const { results: tldFiltered, stats: tldStats } = filterResultsByTLD(
      results,
      { enabled: true, targetCountry }
    );

    if (tldStats.filtered > 0) {
      console.log(`📸 [Serper] Instagram TLD filter: ${tldStats.passed}/${tldStats.totalBefore} (blocked: ${tldStats.blockedTLDs.join(', ')})`);
    }

    results = tldFiltered;
  }

  return results;
}

/**
 * Search TikTok using Serper with site: filter.
 * 
 * Added: January 26, 2026
 * 
 * WHEN TO USE:
 * Only when USE_SERPER_FOR_SOCIAL is true. Otherwise, use searchTikTokApify.
 * 
 * WHAT YOU GET:
 * - Title (video caption excerpt), link, snippet, date
 * - Username (parsed from URL - e.g., tiktok.com/@username/...)
 * - Better language accuracy (~90%)
 * 
 * WHAT YOU DON'T GET (compared to Apify):
 * - Display name, bio
 * - Followers, following, total likes
 * - Is verified
 * - Video plays, likes, comments, shares
 * - Profile picture
 * - Email from bio
 * 
 * @param keyword - Search keyword
 * @param userId - User ID for tracking (optional)
 * @param maxResults - Maximum results (not used, controlled by SERPER_SOCIAL_PAGES)
 * @param targetCountry - Target country for localization
 * @param targetLanguage - Target language for localization
 * @returns Array of SearchResult objects
 */
export async function searchTikTokSerper(
  keyword: string,
  userId?: number,
  maxResults: number = 15,
  targetCountry?: string | null,
  targetLanguage?: string | null
): Promise<SearchResult[]> {
  console.log(`🎵 [Serper] TikTok search: "${keyword}" (country: ${targetCountry || 'global'}, lang: ${targetLanguage || 'any'})`);

  // Get location config for Serper params
  const locationConfig = getLocationConfig(targetCountry, targetLanguage);
  const locationParams: Record<string, string> = locationConfig
    ? {
        gl: locationConfig.countryCode,
        hl: locationConfig.languageCode,
        lr: `lang_${locationConfig.languageCode}`,
      }
    : {};

  // Build search query with site: filter
  // ==========================================================================
  // QUERY OPTIMIZATION - January 27, 2026
  // 
  // Adding "review" to the query significantly improves results:
  // - Without "review": 78% corporate accounts (ALDI, Lidl, etc.)
  // - With "review": 70% individual creators (actual affiliates)
  // - Also finds 4x more emails in bios
  // 
  // This targets content creators who review products rather than brands
  // promoting their own products. These creators are more likely to:
  // 1. Be actual affiliates open to partnerships
  // 2. Have contact emails in their bio
  // 3. Respond to outreach
  // ==========================================================================
  const query = `${keyword} review site:tiktok.com`;

  // Fetch multiple pages
  const rawResults = await serperFetchMultipleSocialPages(query, SERPER_SOCIAL_PAGES, locationParams);

  console.log(`🎵 [Serper] TikTok raw results: ${rawResults.length}`);

  // Transform to SearchResult format
  // NOTE: We can parse username from TikTok URLs (unlike YouTube/Instagram)
  let results: SearchResult[] = rawResults.map((r: any, index: number): SearchResult => {
    const username = parseTikTokUsernameFromUrl(r.link || '');

    return {
      title: r.title || '',
      link: r.link || '',
      snippet: r.snippet || '',
      source: 'TikTok' as Platform,
      domain: 'tiktok.com',
      date: r.date || null,
      position: index + 1,
      searchQuery: keyword,
      // TikTok username - CAN be parsed from URL!
      tiktokUsername: username || undefined,
      // TikTok-specific fields - will be populated by Apify enrichment below
      tiktokDisplayName: undefined,
      tiktokBio: undefined,
      tiktokFollowers: undefined,
      tiktokFollowing: undefined,
      tiktokLikes: undefined,
      tiktokVideosCount: undefined,
      tiktokIsVerified: undefined,
      tiktokVideoPlays: undefined,
      tiktokVideoLikes: undefined,
      tiktokVideoComments: undefined,
      tiktokVideoShares: undefined,
      email: undefined,
      thumbnail: undefined,
    };
  });

  // ==========================================================================
  // APIFY ENRICHMENT - January 27, 2026
  // 
  // Enrich Serper results with full TikTok metadata from Apify.
  // This gives us the best of both worlds:
  // - Serper: Good language filtering (~90% accuracy)
  // - Apify: Rich metadata (followers, bio, email, video stats)
  // 
  // The enrichment is done BEFORE language filtering so that we have
  // complete data for all results that pass the language filter.
  // ==========================================================================
  if (results.length > 0) {
    const videoUrls = results
      .map(r => r.link)
      .filter((url): url is string => !!url && url.includes('/video/'));

    if (videoUrls.length > 0) {
      console.log(`🎵 [Serper] Enriching ${videoUrls.length} TikTok URLs via Apify...`);
      
      try {
        const enrichedData = await enrichTikTokByUrls(videoUrls, userId);
        
        if (enrichedData.size > 0) {
          console.log(`🎵 [Serper] Enrichment complete: ${enrichedData.size}/${videoUrls.length} URLs enriched`);
          
          // Merge enriched data into results
          results = results.map(result => {
            const apifyData = enrichedData.get(result.link);
            
            if (apifyData && apifyData.authorMeta) {
              const author = apifyData.authorMeta;
              
              // Merge Apify author data with Serper result
              return {
                ...result,
                // CRITICAL: Populate channel field for UI compatibility
                // The row displays channel?.name, so without this the UI shows "tiktok.com"
                channel: {
                  name: author.nickName || author.name || result.tiktokUsername || 'Unknown',
                  link: author.profileUrl || `https://www.tiktok.com/@${author.name}`,
                  thumbnail: author.avatar,
                  verified: author.verified,
                  subscribers: author.fans ? formatNumber(author.fans) : undefined,
                },
                // Author data
                tiktokUsername: author.name || result.tiktokUsername,
                tiktokDisplayName: author.nickName,
                tiktokBio: author.signature,
                tiktokFollowers: author.fans,
                tiktokLikes: author.heart,
                tiktokVideosCount: author.video,
                tiktokIsVerified: author.verified,
                // Video data
                tiktokVideoPlays: apifyData.playCount,
                tiktokVideoLikes: apifyData.diggCount,
                tiktokVideoComments: apifyData.commentCount,
                tiktokVideoShares: apifyData.shareCount,
                // Use Apify's proper ISO date if available
                date: apifyData.createTimeISO || result.date,
                // Thumbnail from video cover
                thumbnail: apifyData.videoMeta?.coverUrl || author.avatar,
              };
            }
            
            // Return original result if no enrichment data
            return result;
          });
        }
      } catch (enrichError: any) {
        // Log error but continue with Serper-only results
        console.warn(`⚠️ [Serper] TikTok enrichment failed (continuing with basic data):`, enrichError.message);
      }
    }
  }

  // ==========================================================================
  // FILTER: Only keep enriched results
  // 
  // Skip TikTok results that don't have enrichment data.
  // This ensures we only show results with proper metadata (followers, etc.)
  // ==========================================================================
  const beforeFilterCount = results.length;
  results = results.filter(r => r.channel && r.tiktokFollowers !== undefined);
  console.log(`🎵 [Serper] TikTok after enrichment filter: ${results.length}/${beforeFilterCount} (removed ${beforeFilterCount - results.length} non-enriched)`);

  // Apply language filtering if target language is set
  if (locationConfig?.languageCode) {
    const languageFilterConfig: LanguageFilterConfig = {
      enabled: true,
      targetLanguageCode: locationConfig.languageCode,
      verbose: process.env.NODE_ENV === 'development',
    };

    const { results: filteredResults, stats } = filterResultsByLanguage(results, languageFilterConfig);
    console.log(`🎵 [Serper] TikTok after language filter: ${filteredResults.length}/${results.length}`);
    results = filteredResults;
  }

  // ==========================================================================
  // TLD-BASED COUNTRY FILTERING - January 28, 2026
  // 
  // Filter TikTok results by domain TLD to ensure results are from the user's
  // target country. While TikTok URLs are always tiktok.com, this filter
  // catches edge cases and maintains consistency across all platforms.
  // ==========================================================================
  if (targetCountry) {
    const { results: tldFiltered, stats: tldStats } = filterResultsByTLD(
      results,
      { enabled: true, targetCountry }
    );

    if (tldStats.filtered > 0) {
      console.log(`🎵 [Serper] TikTok TLD filter: ${tldStats.passed}/${tldStats.totalBefore} (blocked: ${tldStats.blockedTLDs.join(', ')})`);
    }

    results = tldFiltered;
  }

  return results;
}

// =============================================================================
// REMOVED: January 29, 2026
// 
// searchPlatform() and searchMultiPlatform() functions were removed.
// They were NEVER CALLED - the routing logic lives directly in the route files:
// - src/app/api/scout/route.ts
// - src/app/api/scout/onboarding/route.ts
// - src/app/api/cron/auto-scan/route.ts
// 
// These functions also imported the now-removed Apify search functions
// (searchYouTubeApify, etc.) which caused TypeScript errors.
// 
// The current production flow is:
// 1. Route files call searchYouTubeSerper/searchInstagramSerper/searchTikTokSerper
// 2. Those functions use Serper for discovery (with language filtering)
// 3. Then call Apify enrichment functions for metadata
// =============================================================================

// =============================================================================
// FILTERING FUNCTIONS FOR POLLING ARCHITECTURE
// January 29, 2026
// 
// These functions are used by /api/search/status to filter results from the
// Apify google-search-scraper. They encapsulate the filtering logic that was
// previously inline in the Serper-based search functions.
// 
// IMPORTANT: Web and Social have DIFFERENT filtering requirements!
// - Web: Full filtering (e-commerce, shop patterns, language, TLD)
// - Social: Minimal filtering (enrichment required, language only)
// =============================================================================

/**
 * Options for web result filtering
 */
export interface WebFilterOptions {
  userBrand?: string;
  excludeDomains?: string[];
  targetCountry?: string;
  targetLanguage?: string;
  strictFiltering?: boolean;
}

/**
 * Options for social result filtering
 */
export interface SocialFilterOptions {
  requireEnrichment?: boolean;
  targetLanguage?: string;
  /** User's own brand domain to exclude their own social accounts */
  userBrand?: string;
  /** Competitor domains to exclude their own social accounts (when searching competitors) */
  excludeBrands?: string[];
}

/**
 * Filter web results through the full filtering pipeline.
 * 
 * January 29, 2026: Exported for use by /api/search/status
 * 
 * Filtering steps:
 * 1. Block ECOMMERCE_DOMAINS
 * 2. Exclude user's own brand domain
 * 3. Block SHOP_URL_PATTERNS
 * 4. Block shop content signals (unless has affiliate signals)
 * 5. Apply language filter (franc)
 * 6. Apply TLD filter (country)
 * 7. Prioritize results with affiliate signals
 * 
 * @param results - Raw web results
 * @param options - Filter options
 * @returns Filtered and prioritized results
 */
export function filterWebResults(
  results: SearchResult[],
  options: WebFilterOptions = {}
): SearchResult[] {
  const { 
    userBrand, 
    excludeDomains = [], 
    targetCountry, 
    targetLanguage,
    strictFiltering = true 
  } = options;
  
  console.log(`🌐 [FilterWeb] Input: ${results.length} results`);
  
  // Step 1-4: Domain and shop filtering via filterAndPrioritizeResults
  const domainFiltered = filterAndPrioritizeResults(results, {
    userBrand,
    excludeDomains,
    strictFiltering,
  });
  
  console.log(`🌐 [FilterWeb] After domain filter: ${domainFiltered.length}`);
  
  // Step 5: Language filtering
  let languageFiltered = domainFiltered;
  if (targetLanguage) {
    const locationConfig = getLocationConfig(targetCountry, targetLanguage);
    if (locationConfig?.languageCode) {
      const languageFilterConfig: LanguageFilterConfig = {
        enabled: true,
        targetLanguageCode: locationConfig.languageCode,
        verbose: process.env.NODE_ENV === 'development',
      };
      
      const { results: filtered } = filterResultsByLanguage(
        domainFiltered,
        languageFilterConfig
      );
      languageFiltered = filtered;
      console.log(`🌐 [FilterWeb] After language filter: ${languageFiltered.length}`);
    }
  }
  
  // Step 6: TLD filtering
  let tldFiltered = languageFiltered;
  if (targetCountry) {
    const tldFilterConfig: TLDFilterConfig = {
      enabled: true,
      targetCountry,
    };
    
    const { results: filtered, stats } = filterResultsByTLD(
      languageFiltered,
      tldFilterConfig
    );
    
    if (stats.filtered > 0) {
      console.log(`🌐 [FilterWeb] TLD filter: blocked ${stats.filtered} results (${stats.blockedTLDs.join(', ')})`);
    }
    
    tldFiltered = filtered;
  }
  
  console.log(`🌐 [FilterWeb] Final: ${tldFiltered.length} results`);
  
  return tldFiltered;
}

/**
 * Filter social results (YouTube, Instagram, TikTok).
 * 
 * January 29, 2026: Exported for use by /api/search/status
 * 
 * Social results have minimal filtering because:
 * - The site: filter already constrains to the platform
 * - No need for e-commerce/shop filtering
 * - TLD filtering is useless (URLs are always platform.com)
 * 
 * Filtering steps:
 * 1. Require enrichment data (skip results without metadata)
 * 2. Apply language filter (franc)
 * 
 * @param results - Social platform results (already enriched)
 * @param options - Filter options
 * @returns Filtered results
 */
export function filterSocialResults(
  results: SearchResult[],
  options: SocialFilterOptions = {}
): SearchResult[] {
  const { requireEnrichment = true, targetLanguage, userBrand, excludeBrands } = options;
  
  console.log(`📱 [FilterSocial] Input: ${results.length} results`);
  
  let filtered = results;
  
  // Step 1: Filter out results without enrichment
  if (requireEnrichment) {
    filtered = results.filter(r => {
      // Check for enrichment markers based on platform
      if (r.source === 'YouTube') {
        return r.channel && r.channel.name !== 'Unknown Channel';
      }
      if (r.source === 'Instagram') {
        return r.channel && r.instagramUsername;
      }
      if (r.source === 'TikTok') {
        return r.channel && r.tiktokFollowers !== undefined;
      }
      return true;
    });
    
    console.log(`📱 [FilterSocial] After enrichment filter: ${filtered.length}`);
  }
  
  // Step 2: Brand exclusion - filter out brand's own social accounts
  // January 29, 2026: Added to exclude competitor's own accounts when searching competitors
  if (userBrand || (excludeBrands && excludeBrands.length > 0)) {
    const brandsToExclude: string[] = [];
    
    // Add user's own brand
    if (userBrand) {
      const userBrandName = extractBrandNameForFilter(userBrand);
      if (userBrandName) {
        brandsToExclude.push(userBrandName);
      }
    }
    
    // Add competitor brands
    if (excludeBrands) {
      for (const brand of excludeBrands) {
        const brandName = extractBrandNameForFilter(brand);
        if (brandName) {
          brandsToExclude.push(brandName);
        }
      }
    }
    
    if (brandsToExclude.length > 0) {
      const beforeCount = filtered.length;
      filtered = filtered.filter(r => {
        // Get channel/username to check
        const channelName = (r.channel?.name || '').toLowerCase();
        const username = (r.tiktokUsername || r.instagramUsername || '').toLowerCase();
        
        // Also check the title for brand mention (catches branded content)
        const title = (r.title || '').toLowerCase();
        
        // Keep result if it doesn't match any excluded brand
        const shouldExclude = brandsToExclude.some(brand => {
          // Check if channel name or username contains the brand
          // Use word boundary matching to avoid false positives
          // e.g., "bedrop" should match "bedrop_official" but not "bedrops_store"
          const brandLower = brand.toLowerCase();
          
          return channelName.includes(brandLower) || 
                 username.includes(brandLower) ||
                 // Check if title starts with brand (official account pattern)
                 title.startsWith(brandLower);
        });
        
        return !shouldExclude;
      });
      
      if (filtered.length < beforeCount) {
        console.log(`📱 [FilterSocial] Brand exclusion: removed ${beforeCount - filtered.length} results (brands: ${brandsToExclude.join(', ')})`);
      }
    }
  }
  
  // Step 3: Language filtering
  if (targetLanguage && filtered.length > 0) {
    // Get language code from LANGUAGE_TO_CODE
    const languageCode = LANGUAGE_TO_CODE[targetLanguage];
    
    if (languageCode) {
      const languageFilterConfig: LanguageFilterConfig = {
        enabled: true,
        targetLanguageCode: languageCode,
        verbose: process.env.NODE_ENV === 'development',
      };
      
      const { results: langFiltered } = filterResultsByLanguage(
        filtered,
        languageFilterConfig
      );
      filtered = langFiltered;
      console.log(`📱 [FilterSocial] After language filter: ${filtered.length}`);
    }
  }
  
  return filtered;
}

/**
 * Extract brand name from domain for filtering.
 * Simplified version that strips common TLDs.
 */
function extractBrandNameForFilter(domain: string): string {
  if (!domain || typeof domain !== 'string') return '';
  
  let cleaned = domain.trim().toLowerCase();
  
  // Remove protocol
  cleaned = cleaned.replace(/^https?:\/\//, '');
  
  // Remove www
  cleaned = cleaned.replace(/^www\./, '');
  
  // Remove path
  cleaned = cleaned.replace(/\/.*$/, '');
  
  // Remove TLD
  cleaned = cleaned.replace(/\.(com|de|co\.uk|net|org|io|app|shop|store|eu|at|ch|fr|es|it|nl|be|pl|se|no|dk|fi)$/i, '');
  
  // Handle compound domains like .co.uk
  const parts = cleaned.split('.');
  if (parts.length > 1) {
    // Take the main part (before subdomain or remaining TLD parts)
    cleaned = parts[parts.length - 1] || parts[0];
  }
  
  return cleaned;
}

// =============================================================================
// LANGUAGE_TO_CODE MAPPING (for filterSocialResults)
// January 29, 2026
// 
// Maps language names to ISO 639-1 codes.
// Needed because filterResultsByLanguage uses ISO codes, not language names.
// =============================================================================
const LANGUAGE_TO_CODE: Record<string, string> = {
  'English': 'en',
  'Spanish': 'es',
  'German': 'de',
  'French': 'fr',
  'Portuguese': 'pt',
  'Italian': 'it',
  'Dutch': 'nl',
  'Swedish': 'sv',
  'Danish': 'da',
  'Norwegian': 'no',
  'Finnish': 'fi',
  'Polish': 'pl',
  'Czech': 'cs',
  'Japanese': 'ja',
  'Korean': 'ko',
  'Arabic': 'ar',
  'Hebrew': 'he',
};
