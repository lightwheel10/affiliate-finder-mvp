/**
 * Search Service
 * 
 * Handles multi-platform search for affiliate discovery:
 * - Web: Uses Serper.dev (Google search)
 * - YouTube/Instagram/TikTok: Uses Apify scrapers for rich data
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
 * Architecture:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  searchWeb(keyword, options)                                            │
 * │  ├── 1. Build localized search query (keyword + language terms)        │
 * │  ├── 2. Serper API call (gl, hl, lr params)                            │
 * │  ├── 3. Domain filtering (block e-commerce, shops)                     │
 * │  └── 4. Language filtering (franc detection) ← NEW January 26          │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

import { searchYouTubeApify, searchInstagramApify, searchTikTokApify } from './apify';
import { 
  getLocationConfig, 
  filterResultsByLanguage, 
  getLanguageName,
  type LanguageFilterConfig 
} from './location';

const SERPER_API_KEY = process.env.SERPER_API_KEY;

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
const ECOMMERCE_DOMAINS = [
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
 */
function isEcommerceDomain(domain: string): boolean {
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
  
  console.log(`✅ Web results (final): ${finalResults.length}/${results.length}`);

  return finalResults;
}

/**
 * Search Web using Serper.dev
 * Note: YouTube, Instagram, TikTok are now handled by Apify in searchMultiPlatform
 * 
 * Updated January 16, 2026: Added options parameter for affiliate filtering
 */
async function searchPlatform(
  keyword: string, 
  platform: Platform,
  options: WebSearchOptions = {}
): Promise<SearchResult[]> {
  // Only Web searches use Serper now
  // YouTube/Instagram/TikTok are routed to Apify in searchMultiPlatform
  if (platform !== 'Web') {
    console.warn(`⚠️ Platform ${platform} should be handled by Apify, not Serper`);
    return [];
  }

  return searchWeb(keyword, options);
}

/**
 * Search across multiple platforms in parallel
 * - Web: Uses Serper.dev
 * - YouTube/Instagram/TikTok: Uses Apify scrapers
 * 
 * Updated January 16, 2026: Added webSearchOptions for affiliate filtering
 */
export async function searchMultiPlatform(
  keyword: string, 
  sources: Platform[],
  userId?: number,
  webSearchOptions: WebSearchOptions = {}
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
        return searchPlatform(keyword, source, webSearchOptions).catch(err => {
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
