/**
 * Search Service - Types and Filtering
 * 
 * This module provides:
 * - Type definitions (Platform, SearchResult)
 * - Filtering functions for web and social results
 * - E-commerce domain blocklists
 * 
 * January 29, 2026: Search discovery migrated to Apify Google Scraper
 * - See apify-google-scraper.ts for search implementation
 * - This file now only contains types and filter functions
 * 
 * February 3, 2026: Dead Serper code cleanup
 * - Removed all Serper API functions (searchWeb, searchYouTubeSerper, etc.)
 * - Kept filter functions and types that are still used
 */

import { 
  getLocationConfig, 
  filterResultsByLanguage, 
  filterResultsByTLD,
  type LanguageFilterConfig,
  type TLDFilterConfig
} from './location';

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
  
  // ==========================================================================
  // SPAM BLOG PLATFORMS - February 3, 2026
  // 
  // Free WordPress.com hosted blogs used for keyword-stuffed spam content.
  // These are NOT real content creators - they're SEO spam.
  // ==========================================================================
  'home.blog',      // WordPress free blogs (e.g., healthn26s6.home.blog)
  'design.blog',    // WordPress design blogs
  'art.blog',       // WordPress art blogs
  'wordpress.com',  // WordPress.com hosted (not self-hosted WordPress sites)
  
  // ==========================================================================
  // SPAM/SCRAPER SITES - February 3, 2026
  // 
  // Sites that scrape and republish content, or are completely irrelevant.
  // Found in actual search results analysis.
  // ==========================================================================
  'jeuxvideo.com',      // French gaming forum - not affiliate content
  'intimomuolo.com',    // Scraper/spam site
  'szortelenits.hu',    // Scraper/spam site
  'estudio.name',       // Spam site
  'burnoutbikes.ch',    // Random e-commerce
  'rsiasitihawa.co.id', // Indonesian hospital - completely irrelevant
  
  // ==========================================================================
  // E-COMMERCE (Additional) - February 3, 2026
  // ==========================================================================
  'koala.ch',           // Swiss e-commerce
  'weareeves.com',      // E-commerce/retail
  'otto.de',            // Major German e-commerce
  'douglas.at',         // Austrian beauty e-commerce
  'douglas.de',         // German beauty e-commerce
  'galaxus.ch',         // Swiss electronics e-commerce
  'greenist.de',        // German health e-commerce
  'stylevana.com',      // K-beauty e-commerce
  'yesstyle.com',       // Asian fashion e-commerce
  'caretobeauty.com',   // Beauty e-commerce
  'boutiqueglamor.com', // Fashion e-commerce
  'esta-trading.ch',    // Swiss trading
  'stylight.de',        // Fashion aggregator
  'newpharma.de',       // Pharmacy e-commerce
  'medpex.de',          // Pharmacy e-commerce
  'shop-apotheke.at',   // Austrian pharmacy
  'redcare-apotheke.ch', // Swiss pharmacy
  
  // ==========================================================================
  // GERMAN PUBLICATIONS - February 3, 2026
  // 
  // Major German media that won't respond to partnership requests.
  // ==========================================================================
  'stern.de',           // News magazine
  'welt.de',            // News
  'zeit.de',            // News
  'faz.net',            // Frankfurter Allgemeine
  'spiegel.de',         // News magazine
  'chip.de',            // Tech publication
  'cosmopolitan.de',    // Women's magazine
  'elle.de',            // Fashion magazine
  'harpersbazaar.de',   // Fashion magazine
  'grazia-magazin.de',  // Fashion magazine
  'freundin.de',        // Women's magazine
  'fuersie.de',         // Women's magazine
  'wunderweib.de',      // Women's lifestyle
  'esquire.de',         // Men's magazine
  'desired.de',         // Women's lifestyle
  'familie.de',         // Family magazine
  'rtl.de',             // TV/Entertainment
  'merkur.de',          // Regional news
  'infranken.de',       // Regional news
  'dzonline.de',        // Regional news
  'aerztezeitung.de',   // Medical news
  'oekotest.de',        // Test magazine
  'test.de',            // Stiftung Warentest
  'konsument.at',       // Austrian consumer magazine
  'ok-magazin.de',      // Celebrity magazine
  
  // ==========================================================================
  // REVIEW AGGREGATORS - February 3, 2026
  // ==========================================================================
  'testbericht.de',     // Review aggregator
  'testberichte.de',    // Review aggregator
  'erfahrungenscout.de', // Review aggregator
  'vergleich.org',      // Comparison site (corporate, not individual)
  
  // ==========================================================================
  // FORUMS & COMMUNITIES - February 3, 2026
  // ==========================================================================
  'alopezie.de',        // Hair loss forum
  'beautyjunkies.de',   // Beauty forum
  'dogforum.de',        // Dog forum
  'pferd.de',           // Horse forum
  
  // ==========================================================================
  // IRRELEVANT BUSINESS TYPES - February 3, 2026
  // 
  // Business categories that aren't useful for affiliate discovery.
  // Pattern blocking handles most, but some specific domains added here.
  // ==========================================================================
  'bibifans.com',       // Fan site
  'mein-adventskalender.de', // Seasonal site
  'de.hand-picked-hotels.com', // Hotel booking
  
  // ==========================================================================
  // BRAND OFFICIAL SITES - February 3, 2026
  // 
  // These are brand's own websites, not affiliates promoting brands.
  // ==========================================================================
  'gehwol.de',          // Foot care brand
  'physiogel.de',       // Skincare brand
  'little-bee-fresh.de', // Bee product brand
  'junglueck.de',       // Cosmetics brand
  'puraliv.com',        // Health brand
  'nextmune.com',       // Pet health brand
  'omegadx.com',        // Health brand
  'youneeq.de',         // Cosmetics brand
  
  // ==========================================================================
  // ACADEMIC & MEDICAL INSTITUTIONS - February 3, 2026
  // ==========================================================================
  'link.springer.com',  // Academic publisher
  'meduniwien.ac.at',   // Medical university
  'd-nb.info',          // German National Library
  
  // ==========================================================================
  // MISCELLANEOUS SPAM/IRRELEVANT - February 3, 2026
  // ==========================================================================
  'albarakahmfb.com',   // Spam
  'anywheremoversutah.com', // Spam
  'toukimontreal.com',  // Spam
  'kvap.fi',            // Finnish unrelated
  'edcasesoresfiscales.com', // Spam
  'nanomax.md',         // Spam
  'missionescienza.it', // Italian unrelated
  'wallentin.cc',       // Unrelated
  'k-kare.com',         // Unrelated
  'bee-care.gr',        // Greek bee shop
  
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
  // When search returns social media URLs (e.g., tiktok.com/@username), they
  // get saved as "Web" results with domain="tiktok.com". When users click
  // "Find Email", the enrichment API tries to lookup "tiktok.com" via Lusha/Apollo,
  // which FAILS because these services need BUSINESS DOMAINS, not social platforms.
  // 
  // SOLUTION:
  // Block these domains from Web search results entirely. Users will still find
  // creators on these platforms via the dedicated Apify scrapers (YouTube scraper,
  // Instagram scraper, TikTok scraper), which return proper profile data with
  // bio emails extracted.
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
// BLOCKED DOMAIN PATTERNS - February 3, 2026
// 
// Regex patterns to block domains by category. These catch small local businesses
// and category-specific sites that aren't in the main blocklist.
// 
// WHY THIS EXISTS:
// The ECOMMERCE_DOMAINS list can only catch KNOWN sites. Small German pharmacies,
// local hotels, bee farms, etc. slip through because we can't pre-list every one.
// Pattern matching catches them by category.
// =============================================================================
const BLOCKED_DOMAIN_PATTERNS: RegExp[] = [
  // Pharmacies (German: Apotheke)
  /apotheke/i,
  /pharmacy/i,
  /pharma(?!ceutical)/i,  // pharma but not pharmaceutical (could be info site)
  
  // Hotels & Accommodation
  /hotel/i,
  /hostel/i,
  /pension\./i,           // German B&B (pension.de, etc.)
  
  // Medical practices & clinics
  /zahnarzt/i,            // Dentist
  /arztpraxis/i,          // Doctor's practice
  /klinik/i,              // Clinic
  /praxis(?!test)/i,      // Practice (but not "praxistest" which is product testing)
  
  // Associations & Organizations
  /verein\./i,            // Association (e.g., bienenzuchtverein-edelsfeld.de)
  /verband\./i,           // Federation
  
  // Local businesses that aren't affiliates
  /imkerei/i,             // Bee farms
  /bauernhof/i,           // Farms
  /metzgerei/i,           // Butcher
  /bäckerei/i,            // Bakery
  /baeckerei/i,           // Bakery (ASCII)
];

// =============================================================================
// SHOP URL PATTERNS - January 16, 2026
// 
// URL path patterns that indicate a page is a product/shop page rather than
// content. If a URL contains any of these patterns, it's likely a shop.
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

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

// Platform type for search results
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
  
  // Email extracted from bio/profile
  email?: string;
  
  // YouTube-specific fields
  youtubeVideoLikes?: number;
  youtubeVideoComments?: number;
  
  // Instagram-specific fields
  instagramUsername?: string;
  instagramFullName?: string;
  instagramBio?: string;
  instagramFollowers?: number;
  instagramFollowing?: number;
  instagramPostsCount?: number;
  instagramIsBusiness?: boolean;
  instagramIsVerified?: boolean;
  instagramPostLikes?: number;
  instagramPostComments?: number;
  instagramPostViews?: number;
  
  // TikTok-specific fields
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

// =============================================================================
// WEB SEARCH OPTIONS (used by filterAndPrioritizeResults)
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
  /** Target country from onboarding (e.g., "Germany", "United Kingdom") */
  targetCountry?: string | null;
  /** Target language from onboarding (e.g., "German", "English") */
  targetLanguage?: string | null;
  /** If true, use keyword as raw query without transformation */
  rawQuery?: boolean;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

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
 * Check if a domain matches any blocked pattern (pharmacies, hotels, clinics, etc.)
 * 
 * February 3, 2026: Added to catch small local businesses by category
 * that aren't in the main ECOMMERCE_DOMAINS blocklist.
 */
export function matchesBlockedDomainPattern(domain: string): boolean {
  const normalizedDomain = domain.toLowerCase().replace(/^www\./, '');
  
  return BLOCKED_DOMAIN_PATTERNS.some(pattern => pattern.test(normalizedDomain));
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
  const combined = `${title} ${snippet}`.toLowerCase();
  
  // Count how many shop signals are present
  let signalCount = 0;
  for (const signal of SHOP_CONTENT_SIGNALS) {
    if (combined.includes(signal.toLowerCase())) {
      signalCount++;
    }
  }
  
  // More than 2 shop signals = likely a shop page
  return signalCount >= 2;
}

/**
 * Check if content has affiliate/creator signals
 */
function hasAffiliateContentSignals(title: string, snippet: string): boolean {
  const combined = `${title} ${snippet}`.toLowerCase();
  return AFFILIATE_CONTENT_SIGNALS.some(signal => 
    combined.includes(signal.toLowerCase())
  );
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    // If URL parsing fails, try to extract domain manually
    const match = url.match(/(?:https?:\/\/)?(?:www\.)?([^\/]+)/i);
    return match ? match[1].toLowerCase() : '';
  }
}

/**
 * Filter and prioritize web search results
 * 
 * Filtering pipeline:
 * 1. EXCLUDE: E-commerce domains (Amazon, eBay, etc.)
 * 2. EXCLUDE: User's own domain
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
    
    // 1b. Exclude domains matching blocked patterns (pharmacies, hotels, clinics, etc.)
    // February 3, 2026: Pattern-based blocking for category-specific filtering
    if (matchesBlockedDomainPattern(domain)) {
      console.log(`🚫 Excluded (pattern match): ${domain}`);
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

// =============================================================================
// FILTER OPTIONS INTERFACES
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

// =============================================================================
// EXPORTED FILTER FUNCTIONS
// =============================================================================

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

// =============================================================================
// HELPER FUNCTIONS FOR FILTER
// =============================================================================

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
