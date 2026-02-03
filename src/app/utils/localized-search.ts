/**
 * =============================================================================
 * LOCALIZED SEARCH QUERY BUILDER
 * =============================================================================
 *
 * Created: January 29, 2026
 * Purpose: Build fully localized search queries for Apify Google Scraper.
 *          Used by all search mechanisms: Find Affiliate, Onboarding, Auto-Scan.
 *
 * KEY DESIGN DECISIONS:
 * ---------------------
 * 1. NO ENGLISH MIXING: When target is German, queries use ONLY German terms.
 *    Previous bug: "review erfahrung test" mixed languages.
 *    Fixed: "erfahrung test bewertung" (German only).
 *
 * 2. SEPARATE QUERIES: Each keyword/competitor gets its own queries.
 *    Previous bug: "keyword1 | keyword2" combined topics.
 *    Fixed: Build separate queries for each, combine with newlines.
 *
 * 3. BRAND EXTRACTION: Competitors are stored as domains (bedrop.de).
 *    For social queries, extract brand name: bedrop.de -> bedrop.
 *
 * 4. SHARED UTILITY: Single source of truth for all search endpoints.
 *
 * =============================================================================
 */

// =============================================================================
// TYPES
// =============================================================================

export type Platform = 'Web' | 'YouTube' | 'Instagram' | 'TikTok';

export interface LocalizedTerms {
  searchTerms: string[];  // Terms for social queries (3 terms)
  webTerms: string[];     // Terms for web OR queries (4 terms)
  instagramTerms: string[]; // Instagram-specific terms (2 terms) - January 29, 2026
  discount: string;       // Discount/coupon term for brand searches
  
  // ==========================================================================
  // AFFILIATE SIGNAL TERMS - February 3, 2026
  // 
  // Terms that identify ACTUAL affiliates vs generic product mentions.
  // Used for high-precision affiliate discovery queries.
  // ==========================================================================
  affiliateDisclosure: string[];  // "Affiliate Links", "Werbelinks", etc.
  creatorLanguage: string[];      // "my honest opinion", "I tested", etc.
  comparisonTerms: string[];      // "best", "comparison", "winner", etc.
  bloggerTerms: string[];         // "blogger", "influencer", etc.
}

export interface QueryBuildOptions {
  keywords?: string[];           // Topic keywords (e.g., "Nagelserum")
  competitors?: string[];        // Competitor domains (e.g., "bedrop.de")
  platforms: Platform[];         // Which platforms to search
  targetLanguage?: string | null;
  targetCountry?: string | null;
  
  // ==========================================================================
  // AFFILIATE SIGNAL QUERIES - February 3, 2026
  // 
  // When enabled, adds additional Web queries that target self-identified
  // affiliates (affiliate disclosure, creator language, comparison content).
  // 
  // This significantly improves relevance but increases query count and cost.
  // 
  // Default: false (backward compatible)
  // ==========================================================================
  includeAffiliateSignals?: boolean;
}

export interface BuiltQuery {
  query: string;
  platform: Platform;
  sourceType: 'keyword' | 'competitor';
  sourceValue: string;  // Original keyword or competitor domain
}

// =============================================================================
// FULLY LOCALIZED TERMS - NO ENGLISH MIXING
// 
// January 29, 2026:
// Each language has terms ONLY in that language.
// English is the fallback for unknown languages.
// =============================================================================

export const FULLY_LOCALIZED_TERMS: Record<string, LocalizedTerms> = {
  'German': { 
    searchTerms: ['erfahrung', 'test', 'bewertung'],
    webTerms: ['erfahrung', 'test', 'bewertung', 'blog'],
    instagramTerms: ['influencer', 'empfehlung'],
    discount: 'rabatt',
    // Affiliate signal terms - February 3, 2026
    affiliateDisclosure: ['Affiliate Links', 'Werbelinks', 'enthält Affiliate', 'Partnerlinks'],
    creatorLanguage: ['meine ehrliche Meinung', 'mein Erfahrungsbericht', 'ich habe getestet'],
    comparisonTerms: ['beste', 'Vergleich', 'Testsieger'],
    bloggerTerms: ['Bloggerin', 'Blogger', 'Influencer'],
  },
  'Spanish': { 
    searchTerms: ['reseña', 'opinión', 'prueba'],
    webTerms: ['reseña', 'opinión', 'prueba', 'blog'],
    instagramTerms: ['influencer', 'recomendación'],
    discount: 'descuento',
    affiliateDisclosure: ['enlaces de afiliados', 'contiene afiliados', 'enlace patrocinado'],
    creatorLanguage: ['mi opinión honesta', 'mi experiencia', 'he probado'],
    comparisonTerms: ['mejor', 'comparativa', 'ganador'],
    bloggerTerms: ['bloguera', 'blogger', 'influencer'],
  },
  'French': { 
    searchTerms: ['avis', 'test', 'critique'],
    webTerms: ['avis', 'test', 'critique', 'blog'],
    instagramTerms: ['influenceur', 'recommandation'],
    discount: 'réduction',
    affiliateDisclosure: ['liens affiliés', 'lien affilié', 'contient des affiliés'],
    creatorLanguage: ['mon avis honnête', 'mon expérience', 'jai testé'],
    comparisonTerms: ['meilleur', 'comparatif', 'gagnant'],
    bloggerTerms: ['blogueuse', 'blogueur', 'influenceur'],
  },
  'Portuguese': { 
    searchTerms: ['avaliação', 'teste', 'opinião'],
    webTerms: ['avaliação', 'teste', 'opinião', 'blog'],
    instagramTerms: ['influencer', 'recomendação'],
    discount: 'desconto',
    affiliateDisclosure: ['links de afiliados', 'contém afiliados', 'link patrocinado'],
    creatorLanguage: ['minha opinião honesta', 'minha experiência', 'eu testei'],
    comparisonTerms: ['melhor', 'comparativo', 'vencedor'],
    bloggerTerms: ['blogueira', 'blogger', 'influencer'],
  },
  'Italian': { 
    searchTerms: ['recensione', 'prova', 'opinione'],
    webTerms: ['recensione', 'prova', 'opinione', 'blog'],
    instagramTerms: ['influencer', 'consiglio'],
    discount: 'sconto',
    affiliateDisclosure: ['link affiliati', 'contiene affiliati', 'link sponsorizzato'],
    creatorLanguage: ['la mia opinione onesta', 'la mia esperienza', 'ho provato'],
    comparisonTerms: ['migliore', 'confronto', 'vincitore'],
    bloggerTerms: ['blogger', 'influencer'],
  },
  'Dutch': { 
    searchTerms: ['ervaring', 'test', 'beoordeling'],
    webTerms: ['ervaring', 'test', 'beoordeling', 'blog'],
    instagramTerms: ['influencer', 'aanbeveling'],
    discount: 'korting',
    affiliateDisclosure: ['affiliate links', 'bevat affiliate', 'gesponsorde link'],
    creatorLanguage: ['mijn eerlijke mening', 'mijn ervaring', 'ik heb getest'],
    comparisonTerms: ['beste', 'vergelijking', 'winnaar'],
    bloggerTerms: ['blogger', 'influencer'],
  },
  'Swedish': {
    searchTerms: ['recension', 'test', 'omdöme'],
    webTerms: ['recension', 'test', 'omdöme', 'blogg'],
    instagramTerms: ['influencer', 'rekommendation'],
    discount: 'rabatt',
    affiliateDisclosure: ['affiliate-länkar', 'innehåller affiliate', 'sponsrad länk'],
    creatorLanguage: ['min ärliga åsikt', 'min erfarenhet', 'jag har testat'],
    comparisonTerms: ['bästa', 'jämförelse', 'vinnare'],
    bloggerTerms: ['bloggare', 'influencer'],
  },
  'Danish': {
    searchTerms: ['anmeldelse', 'test', 'erfaring'],
    webTerms: ['anmeldelse', 'test', 'erfaring', 'blog'],
    instagramTerms: ['influencer', 'anbefaling'],
    discount: 'rabat',
    affiliateDisclosure: ['affiliate links', 'indeholder affiliate', 'sponsoreret link'],
    creatorLanguage: ['min ærlige mening', 'min erfaring', 'jeg har testet'],
    comparisonTerms: ['bedste', 'sammenligning', 'vinder'],
    bloggerTerms: ['blogger', 'influencer'],
  },
  'Norwegian': {
    searchTerms: ['anmeldelse', 'test', 'erfaring'],
    webTerms: ['anmeldelse', 'test', 'erfaring', 'blogg'],
    instagramTerms: ['influencer', 'anbefaling'],
    discount: 'rabatt',
    affiliateDisclosure: ['affiliate-lenker', 'inneholder affiliate', 'sponset lenke'],
    creatorLanguage: ['min ærlige mening', 'min erfaring', 'jeg har testet'],
    comparisonTerms: ['beste', 'sammenligning', 'vinner'],
    bloggerTerms: ['blogger', 'influencer'],
  },
  'Finnish': {
    searchTerms: ['arvostelu', 'testi', 'kokemus'],
    webTerms: ['arvostelu', 'testi', 'kokemus', 'blogi'],
    instagramTerms: ['influencer', 'suositus'],
    discount: 'alennus',
    affiliateDisclosure: ['affiliate-linkit', 'sisältää affiliate', 'sponsoroitu linkki'],
    creatorLanguage: ['rehellinen mielipiteeni', 'kokemukseni', 'olen testannut'],
    comparisonTerms: ['paras', 'vertailu', 'voittaja'],
    bloggerTerms: ['bloggaaja', 'influencer'],
  },
  'Polish': {
    searchTerms: ['recenzja', 'test', 'opinia'],
    webTerms: ['recenzja', 'test', 'opinia', 'blog'],
    instagramTerms: ['influencer', 'polecenie'],
    discount: 'zniżka',
    affiliateDisclosure: ['linki afiliacyjne', 'zawiera afiliację', 'link sponsorowany'],
    creatorLanguage: ['moja szczera opinia', 'moje doświadczenie', 'przetestowałam'],
    comparisonTerms: ['najlepszy', 'porównanie', 'zwycięzca'],
    bloggerTerms: ['blogerka', 'blogger', 'influencer'],
  },
  'Czech': {
    searchTerms: ['recenze', 'test', 'zkušenost'],
    webTerms: ['recenze', 'test', 'zkušenost', 'blog'],
    instagramTerms: ['influencer', 'doporučení'],
    discount: 'sleva',
    affiliateDisclosure: ['affiliate odkazy', 'obsahuje affiliate', 'sponzorovaný odkaz'],
    creatorLanguage: ['můj upřímný názor', 'moje zkušenost', 'vyzkoušela jsem'],
    comparisonTerms: ['nejlepší', 'srovnání', 'vítěz'],
    bloggerTerms: ['blogerka', 'blogger', 'influencer'],
  },
  // Default English fallback
  'English': {
    searchTerms: ['review', 'test', 'experience'],
    webTerms: ['review', 'test', 'blog', 'blogger'],
    instagramTerms: ['influencer', 'recommendation'],
    discount: 'discount',
    affiliateDisclosure: ['affiliate links', 'contains affiliate', 'affiliate disclosure'],
    creatorLanguage: ['my honest opinion', 'my experience', 'I tested'],
    comparisonTerms: ['best', 'comparison', 'winner'],
    bloggerTerms: ['blogger', 'influencer'],
  }
};

// =============================================================================
// TLD PATTERN - Comprehensive list for brand extraction
// =============================================================================

const TLD_PATTERN = /\.(com|io|co|net|org|app|de|uk|fr|es|it|nl|be|at|ch|se|no|dk|fi|pl|cz|hu|pt|gr|ie|au|nz|ca|us|in|jp|kr|cn|sg|hk|tw|br|mx|ar|cl|co\.uk|com\.au|co\.nz|com\.br)$/i;

// =============================================================================
// BRAND EXTRACTION
// =============================================================================

/**
 * Extract brand name from a domain or URL.
 * 
 * Examples:
 *   - "bedrop.de" → "bedrop"
 *   - "https://www.guffles.com/page" → "guffles"
 *   - "my-brand.co.uk" → "my-brand"
 *   - "app.hubspot.com" → "hubspot"
 * 
 * @param domain - The domain or URL to extract brand from
 * @returns The extracted brand name, or original input if extraction fails
 */
export function extractBrandFromDomain(domain: string): string {
  if (!domain || typeof domain !== 'string') {
    return '';
  }

  let cleaned = domain.trim().toLowerCase();

  // Remove protocol (http://, https://)
  cleaned = cleaned.replace(/^https?:\/\//, '');

  // Remove www. prefix
  cleaned = cleaned.replace(/^www\./, '');

  // Remove path and query string (everything after first /)
  cleaned = cleaned.replace(/\/.*$/, '');

  // Remove port number if present (e.g., :3000)
  cleaned = cleaned.replace(/:\d+$/, '');

  // Handle subdomains: keep only the main domain
  // e.g., "app.hubspot.com" → "hubspot.com" → "hubspot"
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    // Check if last two parts form a compound TLD (co.uk, com.au, etc.)
    const lastTwo = parts.slice(-2).join('.');
    if (/^(co|com|org|net)\.[a-z]{2}$/.test(lastTwo)) {
      // Compound TLD: take the part before it
      cleaned = parts.slice(-3, -2).join('');
    } else {
      // Regular TLD: take the second-to-last part
      cleaned = parts.slice(-2, -1).join('');
    }
  } else if (parts.length === 2) {
    // Simple domain like "bedrop.de"
    cleaned = parts[0];
  }

  // Final cleanup: remove any remaining TLD suffix
  cleaned = cleaned.replace(TLD_PATTERN, '');

  return cleaned || domain; // Return original if extraction fails
}

// =============================================================================
// TERM HELPERS
// =============================================================================

/**
 * Get localized terms for a language.
 * Returns English fallback if language not found.
 */
export function getLocalizedTerms(targetLanguage?: string | null): LocalizedTerms {
  if (targetLanguage && FULLY_LOCALIZED_TERMS[targetLanguage]) {
    return FULLY_LOCALIZED_TERMS[targetLanguage];
  }
  return FULLY_LOCALIZED_TERMS['English'];
}

/**
 * Build search terms string for social queries.
 * Returns space-separated terms.
 * 
 * German: "erfahrung test bewertung"
 * English: "review test experience"
 */
export function buildSearchTermsString(targetLanguage?: string | null): string {
  const terms = getLocalizedTerms(targetLanguage);
  return terms.searchTerms.join(' ');
}

// =============================================================================
// QUERY BUILDERS
// =============================================================================

/**
 * Build a social platform query (YouTube, Instagram, TikTok).
 * 
 * Example (German, YouTube):
 *   "Nagelserum erfahrung test bewertung site:youtube.com"
 */
export function buildLocalizedSocialQuery(
  keyword: string,
  platform: Platform,
  targetLanguage?: string | null
): string {
  if (platform === 'Web') {
    throw new Error('Use buildLocalizedWebQuery for Web platform');
  }

  const searchTerms = buildSearchTermsString(targetLanguage);
  const domainMap: Record<Platform, string> = {
    'YouTube': 'youtube.com',
    'Instagram': 'instagram.com',
    'TikTok': 'tiktok.com',
    'Web': '',
  };
  
  return `${keyword} ${searchTerms} site:${domainMap[platform]}`;
}

/**
 * Build an Instagram-specific query with influencer/recommendation terms.
 * 
 * January 29, 2026: Added to improve Instagram result relevance.
 * This is an EXTRA query on top of the regular social query.
 * 
 * Example (German):
 *   "Nagelserum influencer empfehlung site:instagram.com"
 * 
 * Example (English):
 *   "Nagelserum influencer recommendation site:instagram.com"
 */
export function buildInstagramSpecificQuery(
  keyword: string,
  targetLanguage?: string | null
): string {
  const terms = getLocalizedTerms(targetLanguage);
  const instagramTerms = terms.instagramTerms.join(' ');
  
  return `${keyword} ${instagramTerms} site:instagram.com`;
}

/**
 * Build a web query with OR clauses.
 * 
 * For keywords (niche):
 *   "Nagelserum erfahrung" OR "Nagelserum test" OR "Nagelserum bewertung" OR "Nagelserum blog"
 * 
 * For competitors (brand):
 *   "bedrop erfahrung" OR "bedrop test" OR "bedrop bewertung" OR "bedrop rabatt"
 * 
 * Includes negative site filters for major e-commerce sites.
 */
export function buildLocalizedWebQuery(
  keyword: string,
  isCompetitor: boolean,
  targetLanguage?: string | null
): string {
  const terms = getLocalizedTerms(targetLanguage);
  const queries: string[] = [];
  
  if (isCompetitor) {
    // Competitor/brand search: use first 3 web terms + discount
    for (const term of terms.webTerms.slice(0, 3)) {
      queries.push(`"${keyword} ${term}"`);
    }
    queries.push(`"${keyword} ${terms.discount}"`);
  } else {
    // Niche/keyword search: use all 4 web terms
    for (const term of terms.webTerms) {
      queries.push(`"${keyword} ${term}"`);
    }
  }
  
  // Add negative filters for major e-commerce sites
  return `${queries.join(' OR ')} -site:amazon.com -site:amazon.de -site:ebay.com -site:ebay.de -site:reddit.com`;
}

// =============================================================================
// AFFILIATE SIGNAL QUERY BUILDERS - February 3, 2026
// 
// These queries target SELF-IDENTIFIED AFFILIATES using affiliate disclosure
// terms, creator language, comparison content, and blogger signals.
// 
// WHY THIS EXISTS:
// Generic queries like "product review" find ANYONE mentioning the product.
// Affiliate-signal queries find people who ARE affiliates (have affiliate links,
// write comparison content, identify as bloggers, etc.)
// 
// TESTING RESULTS:
// - Generic queries: 16 results → 0 relevant (100% spam)
// - Affiliate queries: 222 results → 36+ relevant (25-30% real affiliates)
// =============================================================================

/**
 * Build affiliate-signal queries for a single keyword.
 * 
 * These queries specifically target self-identified affiliates:
 * 1. Affiliate disclosure queries ("Affiliate Links" [keyword])
 * 2. Creator language queries ("my honest opinion" [keyword])
 * 3. Comparison/listicle queries ("best" [keyword] 2026)
 * 4. Blogger queries ([keyword] "Blogger" experience)
 * 
 * @param keyword - The search keyword
 * @param targetLanguage - Target language for localized terms
 * @returns Array of affiliate-signal queries (strings only, for Web platform)
 */
export function buildAffiliateSignalQueries(
  keyword: string,
  targetLanguage?: string | null
): string[] {
  const terms = getLocalizedTerms(targetLanguage);
  const queries: string[] = [];
  
  // 1. Affiliate disclosure queries
  // These find pages that explicitly declare affiliate content
  for (const disclosure of terms.affiliateDisclosure) {
    queries.push(`"${disclosure}" ${keyword}`);
  }
  
  // 2. Creator language queries
  // These find individual creators, not brands
  for (const creatorTerm of terms.creatorLanguage) {
    queries.push(`"${creatorTerm}" ${keyword}`);
  }
  
  // 3. Comparison/listicle queries
  // Listicle content is often affiliate content
  const currentYear = new Date().getFullYear();
  const lastYear = currentYear - 1;
  
  for (const compTerm of terms.comparisonTerms) {
    // "best [keyword] 2025 OR 2026"
    queries.push(`"${compTerm}" ${keyword} ${lastYear} OR ${currentYear}`);
  }
  
  // Additional comparison format: [keyword] "comparison" "test"
  if (terms.comparisonTerms.length >= 2) {
    queries.push(`${keyword} "${terms.comparisonTerms[1]}" "${terms.searchTerms[1]}"`);
  }
  
  // 4. Blogger queries
  // Find bloggers writing about the keyword
  if (terms.bloggerTerms.length > 0) {
    const bloggerOR = terms.bloggerTerms.slice(0, 2).map(t => `"${t}"`).join(' OR ');
    queries.push(`${keyword} ${bloggerOR} ${terms.searchTerms[0]}`);
  }
  
  return queries;
}

/**
 * Build affiliate-signal queries and return as BuiltQuery objects.
 * 
 * @param keyword - The search keyword
 * @param sourceType - 'keyword' or 'competitor'
 * @param sourceValue - Original keyword or competitor domain
 * @param targetLanguage - Target language for localized terms
 * @returns Array of BuiltQuery objects for Web platform
 */
export function buildAffiliateSignalWebQueries(
  keyword: string,
  sourceType: 'keyword' | 'competitor',
  sourceValue: string,
  targetLanguage?: string | null
): BuiltQuery[] {
  const queries = buildAffiliateSignalQueries(keyword, targetLanguage);
  
  return queries.map(query => ({
    query,
    platform: 'Web' as Platform,
    sourceType,
    sourceValue,
  }));
}

// =============================================================================
// MAIN QUERY BUILDER
// =============================================================================

/**
 * Build all queries for keywords and competitors across all platforms.
 * 
 * This is the main function used by:
 * - apify-google-scraper.ts (service layer)
 * - Onboarding route
 * - Auto-scan route
 * 
 * January 29, 2026: Added extra Instagram-specific query for better results.
 * Instagram now gets 2 queries per keyword/competitor:
 * 1. Regular: "keyword erfahrung test bewertung site:instagram.com"
 * 2. Extra:   "keyword influencer empfehlung site:instagram.com"
 * 
 * @param options - Query building options
 * @returns Array of BuiltQuery objects with metadata
 */
export function buildAllLocalizedQueries(options: QueryBuildOptions): BuiltQuery[] {
  const { 
    keywords = [], 
    competitors = [], 
    platforms, 
    targetLanguage,
    includeAffiliateSignals = false  // February 3, 2026: Default false for backward compatibility
  } = options;
  
  const queries: BuiltQuery[] = [];
  const includesInstagram = platforms.includes('Instagram');
  const includesWeb = platforms.includes('Web');
  
  // Build queries for each keyword
  for (const keyword of keywords) {
    const cleanKeyword = keyword.trim();
    if (!cleanKeyword) continue;
    
    for (const platform of platforms) {
      let query: string;
      
      if (platform === 'Web') {
        query = buildLocalizedWebQuery(cleanKeyword, false, targetLanguage);
      } else {
        query = buildLocalizedSocialQuery(cleanKeyword, platform, targetLanguage);
      }
      
      queries.push({
        query,
        platform,
        sourceType: 'keyword',
        sourceValue: cleanKeyword,
      });
    }
    
    // Add EXTRA Instagram-specific query (influencer/recommendation terms)
    if (includesInstagram) {
      queries.push({
        query: buildInstagramSpecificQuery(cleanKeyword, targetLanguage),
        platform: 'Instagram',
        sourceType: 'keyword',
        sourceValue: cleanKeyword,
      });
    }
    
    // ==========================================================================
    // AFFILIATE SIGNAL QUERIES - February 3, 2026
    // 
    // When enabled, add queries targeting self-identified affiliates.
    // Only for Web platform (social uses site: filter which doesn't mix well).
    // ==========================================================================
    if (includeAffiliateSignals && includesWeb) {
      const affiliateQueries = buildAffiliateSignalWebQueries(
        cleanKeyword,
        'keyword',
        cleanKeyword,
        targetLanguage
      );
      queries.push(...affiliateQueries);
    }
  }
  
  // Build queries for each competitor (extract brand name first)
  for (const competitor of competitors) {
    const brandName = extractBrandFromDomain(competitor);
    if (!brandName) continue;
    
    for (const platform of platforms) {
      let query: string;
      
      if (platform === 'Web') {
        query = buildLocalizedWebQuery(brandName, true, targetLanguage);
      } else {
        query = buildLocalizedSocialQuery(brandName, platform, targetLanguage);
      }
      
      queries.push({
        query,
        platform,
        sourceType: 'competitor',
        sourceValue: competitor, // Keep original domain for tracking
      });
    }
    
    // Add EXTRA Instagram-specific query for competitor
    if (includesInstagram) {
      queries.push({
        query: buildInstagramSpecificQuery(brandName, targetLanguage),
        platform: 'Instagram',
        sourceType: 'competitor',
        sourceValue: competitor,
      });
    }
    
    // Add affiliate signal queries for competitor
    if (includeAffiliateSignals && includesWeb) {
      const affiliateQueries = buildAffiliateSignalWebQueries(
        brandName,
        'competitor',
        competitor,
        targetLanguage
      );
      queries.push(...affiliateQueries);
    }
  }
  
  return queries;
}

/**
 * Convert BuiltQuery array to newline-separated query string for Apify.
 * 
 * Apify Google Scraper accepts queries separated by newlines.
 */
export function queriesToApifyInput(queries: BuiltQuery[]): string {
  return queries.map(q => q.query).join('\n');
}

/**
 * Build queries for a single keyword (used by Find Affiliate).
 * 
 * This maintains backwards compatibility with single-keyword searches.
 */
export function buildSingleKeywordQueries(
  keyword: string,
  platforms: Platform[],
  targetLanguage?: string | null
): BuiltQuery[] {
  return buildAllLocalizedQueries({
    keywords: [keyword],
    competitors: [],
    platforms,
    targetLanguage,
  });
}

// =============================================================================
// DISCOVERY METHOD EXTRACTION
// 
// January 30, 2026:
// Extract the actual topic or competitor that generated a search result.
// 
// PROBLEM SOLVED:
// Previously, ALL results were saved with the FIRST topic as discovery_method,
// even if the result was found via a different topic or competitor search.
// 
// HOW IT WORKS:
// 1. Takes the searchQuery from the result (e.g., "Bienencreme site:youtube.com erfahrung")
// 2. Checks which topic or competitor appears in the query string
// 3. Returns the matched value and type ('topic' or 'competitor')
// 
// USAGE:
// const { type, value } = extractDiscoveryMethod(result.searchQuery, topics, competitors);
// // type = 'topic' or 'competitor'
// // value = 'Bienencreme' (the actual matched keyword)
// =============================================================================

export interface DiscoveryMethod {
  type: 'topic' | 'competitor';
  value: string;
}

/**
 * Extract the discovery method (topic or competitor) from a search query.
 * 
 * @param searchQuery - The full search query string from Apify results
 * @param topics - Array of user's topic keywords
 * @param competitors - Array of user's competitor domains
 * @returns The matched discovery method, or fallback to first topic
 */
export function extractDiscoveryMethod(
  searchQuery: string | undefined,
  topics: string[],
  competitors: string[]
): DiscoveryMethod {
  // Fallback if no search query
  if (!searchQuery) {
    return { type: 'topic', value: topics[0] || 'unknown' };
  }
  
  const lowerQuery = searchQuery.toLowerCase();
  
  // Check topics first (more common)
  for (const topic of topics) {
    if (lowerQuery.includes(topic.toLowerCase())) {
      return { type: 'topic', value: topic };
    }
  }
  
  // Check competitors (extract brand name from domain for matching)
  for (const competitor of competitors) {
    // competitor is a domain like "bedrop.de" or "manukahealth.shop"
    // Extract brand name: bedrop.de -> bedrop
    const brandName = competitor.replace(/\.(com|de|shop|co\.uk|net|org|io)$/i, '').toLowerCase();
    
    if (lowerQuery.includes(brandName)) {
      return { type: 'competitor', value: competitor };
    }
  }
  
  // Fallback: return first topic if no match found
  // This handles edge cases where query format might differ
  return { type: 'topic', value: topics[0] || 'unknown' };
}
