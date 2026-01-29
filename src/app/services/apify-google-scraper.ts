/**
 * Apify Google Search Scraper Service
 * 
 * =============================================================================
 * Created: January 29, 2026
 * 
 * PURPOSE:
 * Replaces Serper-based discovery with Apify's google-search-scraper actor.
 * Uses polling architecture to handle long-running searches (40-95 seconds)
 * that exceed Vercel's timeout limits.
 * 
 * WHY THIS CHANGE:
 * - Apify google-search-scraper: 80-100% German language accuracy
 * - Serper (current): ~30% German language accuracy
 * - Polling allows searches to run beyond Vercel's 30s timeout
 * 
 * ARCHITECTURE:
 * 1. startGoogleSearchRun() - Starts non-blocking Apify run, returns immediately
 * 2. getRunStatus() - Polls run status until complete
 * 3. fetchAndProcessResults() - Fetches dataset, categorizes by platform, filters
 * 
 * ACTOR DETAILS:
 * - Actor ID: nFJndFXA5zjCTuudP (apify/google-search-scraper)
 * - Pricing: ~$0.02 per 10 results
 * - Speed: ~40-95 seconds for 50 results per query
 * 
 * BUG FIX (January 29, 2026):
 * - Social queries now include localized terms (erfahrung, test, etc.)
 * - Previous implementation only used "review" for social platforms
 * =============================================================================
 */

import { ApifyClient } from 'apify-client';
import { Platform, SearchResult } from './search';
import { getLocationConfig, LocationConfig } from './location';
import { 
  buildAllLocalizedQueries, 
  buildSingleKeywordQueries,
  queriesToApifyInput,
  BuiltQuery,
  Platform as LocalizedPlatform 
} from '../utils/localized-search';

// =============================================================================
// APIFY CLIENT INITIALIZATION
// January 29, 2026
// =============================================================================
const APIFY_TOKEN = process.env.APIFY_API_TOKEN;

if (!APIFY_TOKEN) {
  console.warn('⚠️ [GoogleScraper] Missing APIFY_API_TOKEN in environment variables');
}

const client = APIFY_TOKEN
  ? new ApifyClient({
      token: APIFY_TOKEN,
      maxRetries: 3,
      timeoutSecs: 300, // 5 minutes - google scraper can take 60-90 seconds
    })
  : null;

// =============================================================================
// ACTOR CONFIGURATION
// January 29, 2026
// =============================================================================
const GOOGLE_SCRAPER_ACTOR_ID = 'nFJndFXA5zjCTuudP';

// Results per page (Google standard is 10)
const RESULTS_PER_PAGE = 10;

// Pages per query (5 pages × 10 results = 50 results per query)
const MAX_PAGES_PER_QUERY = 5;

// =============================================================================
// NOTE: Localized terms and query building logic moved to:
// src/app/utils/localized-search.ts
// 
// This file now uses the shared utility for consistent query building
// across all search endpoints (Find Affiliate, Onboarding, Auto-Scan).
// =============================================================================

// =============================================================================
// TYPES
// January 29, 2026
// =============================================================================

export interface GoogleScraperRunOptions {
  // Single keyword mode (Find Affiliate - backward compatible)
  keyword?: string;
  // Multi-keyword mode (Onboarding, Auto-Scan)
  keywords?: string[];
  // Competitor domains (e.g., "bedrop.de") - brand name is extracted automatically
  competitors?: string[];
  sources: Platform[];
  targetCountry?: string | null;
  targetLanguage?: string | null;
}

export interface GoogleScraperRunResult {
  runId: string;
  status: 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'ABORTED';
  datasetId?: string;
}

export interface GoogleScraperStatus {
  status: 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'ABORTED' | 'TIMED-OUT';
  progress?: {
    percent: number;
  };
  startedAt?: string;
  finishedAt?: string;
  datasetId?: string;
  defaultDatasetId?: string;
  stats?: {
    inputRecords?: number;
    outputRecords?: number;
  };
}

export interface ProcessResultsOptions {
  targetCountry?: string | null;
  targetLanguage?: string | null;
  userBrand?: string | null;
}

// Apify dataset item structure
interface ApifyOrganicResult {
  title: string;
  url: string;
  displayedUrl?: string;
  description?: string;
  position: number;
  date?: string;
}

interface ApifyDatasetItem {
  searchQuery: {
    term: string;
    page: number;
    domain: string;
    countryCode?: string;
    languageCode?: string;
  };
  organicResults: ApifyOrganicResult[];
}

// =============================================================================
// LEGACY QUERY BUILDING (Deprecated - kept for reference only)
// 
// NOTE: Query building is now handled by src/app/utils/localized-search.ts
// The buildBatchedQueries export below is maintained for any existing imports.
// =============================================================================

/**
 * @deprecated Use buildAllLocalizedQueries from localized-search.ts instead
 * 
 * Build all queries for a search run.
 * This is a compatibility wrapper around the new shared utility.
 */
export function buildBatchedQueries(
  keyword: string,
  sources: Platform[],
  targetLanguage?: string | null
): string[] {
  const builtQueries = buildSingleKeywordQueries(keyword, sources as LocalizedPlatform[], targetLanguage);
  return builtQueries.map(q => q.query);
}

// =============================================================================
// MAIN FUNCTIONS
// January 29, 2026
// =============================================================================

/**
 * Start a non-blocking Google Search Scraper run.
 * 
 * This function returns immediately with a runId. The actual search
 * runs in the background on Apify's servers for 40-95 seconds.
 * 
 * Supports two modes:
 * 1. Single keyword mode (keyword): For Find Affiliate
 * 2. Multi-keyword mode (keywords + competitors): For Onboarding, Auto-Scan
 * 
 * @param options - Search options (keyword/keywords, competitors, sources, location)
 * @returns Run ID for polling
 * @throws Error if Apify client not configured or start fails
 */
export async function startGoogleSearchRun(
  options: GoogleScraperRunOptions
): Promise<GoogleScraperRunResult> {
  const { keyword, keywords, competitors, sources, targetCountry, targetLanguage } = options;
  
  if (!client) {
    throw new Error('Apify client not configured - missing APIFY_API_TOKEN');
  }
  
  // Determine mode and build queries using shared utility
  let builtQueries: BuiltQuery[];
  
  if (keywords && keywords.length > 0) {
    // Multi-keyword mode (Onboarding, Auto-Scan)
    console.log(`🔍 [GoogleScraper] Starting multi-keyword run: ${keywords.length} keywords, ${competitors?.length || 0} competitors`);
    builtQueries = buildAllLocalizedQueries({
      keywords,
      competitors: competitors || [],
      platforms: sources as LocalizedPlatform[],
      targetLanguage,
      targetCountry,
    });
  } else if (keyword) {
    // Single keyword mode (Find Affiliate - backward compatible)
    console.log(`🔍 [GoogleScraper] Starting single-keyword run for "${keyword}"`);
    builtQueries = buildSingleKeywordQueries(keyword, sources as LocalizedPlatform[], targetLanguage);
  } else {
    throw new Error('Either keyword or keywords[] must be provided');
  }
  
  console.log(`🔍 [GoogleScraper] Built ${builtQueries.length} queries (sources: ${sources.join(', ')})`);
  console.log(`🔍 [GoogleScraper] Queries:\n${builtQueries.map(q => `  - [${q.sourceType}:${q.platform}] ${q.query.substring(0, 80)}...`).join('\n')}`);
  
  // Get location config
  const locationConfig = getLocationConfig(targetCountry, targetLanguage);
  
  // Convert to Apify input format (newline-separated)
  const queriesString = queriesToApifyInput(builtQueries);
  
  // Build actor input
  const input = {
    // Queries - newline separated for batching
    queries: queriesString,
    
    // Pagination
    resultsPerPage: RESULTS_PER_PAGE,
    maxPagesPerQuery: MAX_PAGES_PER_QUERY,
    
    // Language & Location (critical for German accuracy)
    languageCode: locationConfig?.languageCode || 'en',
    countryCode: locationConfig?.countryCode || 'us',
    googleDomain: locationConfig ? `google.${locationConfig.countryCode}` : 'google.com',
    // CRITICAL: searchLanguage is the lr parameter that RESTRICTS results by language!
    // Without this, we only set interface language (hl) but don't filter results.
    // January 30, 2026: Added to fix Chinese/Russian/Arabic results appearing for German users
    searchLanguage: locationConfig?.languageCode || '',
    
    // Disable features we don't need (saves cost/time)
    mobileResults: false,
    includeUnfilteredResults: false,
    saveHtml: false,
    saveHtmlToKeyValueStore: false,
    includeIcons: false,
    aiMode: 'aiModeOff',
    perplexitySearch: {
      enablePerplexity: false,
      returnImages: false,
      returnRelatedQuestions: false,
    },
    maximumLeadsEnrichmentRecords: 0,
    focusOnPaidAds: false,
    forceExactMatch: false,
  };
  
  // Start the actor (non-blocking)
  // Note: We use start() not call() - start() returns immediately
  const run = await client.actor(GOOGLE_SCRAPER_ACTOR_ID).start(input);
  
  console.log(`🔍 [GoogleScraper] Run started: ${run.id} (status: ${run.status})`);
  
  return {
    runId: run.id,
    status: run.status as GoogleScraperRunResult['status'],
    datasetId: run.defaultDatasetId,
  };
}

/**
 * Get the status of a running search.
 * 
 * Use this to poll until status is SUCCEEDED or FAILED.
 * 
 * @param runId - The run ID from startGoogleSearchRun
 * @returns Current status and stats
 * @throws Error if Apify client not configured or run not found
 */
export async function getRunStatus(runId: string): Promise<GoogleScraperStatus> {
  if (!client) {
    throw new Error('Apify client not configured - missing APIFY_API_TOKEN');
  }
  
  const run = await client.run(runId).get();
  
  if (!run) {
    throw new Error(`Run not found: ${runId}`);
  }
  
  return {
    status: run.status as GoogleScraperStatus['status'],
    startedAt: run.startedAt?.toISOString(),
    finishedAt: run.finishedAt?.toISOString(),
    datasetId: run.defaultDatasetId,
    defaultDatasetId: run.defaultDatasetId,
    stats: {
      // Cast stats to any to access properties that may not be in type definition
      inputRecords: (run.stats as any)?.inputRecords,
      outputRecords: (run.stats as any)?.outputRecords,
    },
  };
}

/**
 * Fetch and process results from a completed run.
 * 
 * This function:
 * 1. Fetches the dataset from Apify
 * 2. Extracts organicResults from all dataset items
 * 3. Categorizes results by platform (based on URL)
 * 4. Returns SearchResult[] ready for filtering/enrichment
 * 
 * Note: Filtering (language, TLD, e-commerce) is NOT done here.
 * That happens in the /api/search/status endpoint after enrichment.
 * 
 * @param runId - The run ID from startGoogleSearchRun
 * @param options - Processing options
 * @returns Array of SearchResult objects categorized by platform
 * @throws Error if Apify client not configured or dataset fetch fails
 */
export async function fetchAndProcessResults(
  runId: string,
  options: ProcessResultsOptions = {}
): Promise<SearchResult[]> {
  if (!client) {
    throw new Error('Apify client not configured - missing APIFY_API_TOKEN');
  }
  
  // Get the run to find the dataset ID
  const run = await client.run(runId).get();
  
  if (!run || !run.defaultDatasetId) {
    throw new Error(`Run not found or no dataset: ${runId}`);
  }
  
  console.log(`📥 [GoogleScraper] Fetching dataset: ${run.defaultDatasetId}`);
  
  // Fetch all items from the dataset
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  
  console.log(`📥 [GoogleScraper] Dataset items: ${items.length}`);
  
  // Extract and flatten all organic results
  const results: SearchResult[] = [];
  
  for (const item of items as unknown as ApifyDatasetItem[]) {
    if (!item.organicResults || !Array.isArray(item.organicResults)) {
      continue;
    }
    
    // Determine the query type from the search term
    const queryTerm = item.searchQuery?.term || '';
    
    for (const organic of item.organicResults) {
      if (!organic.url) continue;
      
      // Categorize by URL domain
      const platform = categorizePlatform(organic.url);
      const domain = extractDomain(organic.url);
      
      const result: SearchResult = {
        title: organic.title || '',
        link: organic.url,
        snippet: organic.description || '',
        source: platform,
        domain: domain,
        date: organic.date || undefined,
        position: organic.position,
        searchQuery: queryTerm,
      };
      
      results.push(result);
    }
  }
  
  console.log(`📥 [GoogleScraper] Processed ${results.length} results`);
  
  // Log breakdown by platform
  const breakdown = results.reduce((acc, r) => {
    acc[r.source] = (acc[r.source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log(`📥 [GoogleScraper] Breakdown: ${JSON.stringify(breakdown)}`);
  
  return results;
}

/**
 * Categorize a URL into a platform.
 * 
 * @param url - The URL to categorize
 * @returns Platform type
 */
function categorizePlatform(url: string): Platform {
  const lowerUrl = url.toLowerCase();
  
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
    return 'YouTube';
  }
  if (lowerUrl.includes('instagram.com')) {
    return 'Instagram';
  }
  if (lowerUrl.includes('tiktok.com')) {
    return 'TikTok';
  }
  
  return 'Web';
}

/**
 * Extract domain from a URL.
 * 
 * @param url - The URL to extract domain from
 * @returns Domain string (e.g., "youtube.com")
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    // Fallback for invalid URLs
    const match = url.match(/(?:https?:\/\/)?(?:www\.)?([^\/]+)/);
    return match ? match[1] : url;
  }
}

// =============================================================================
// UTILITY: Wait for run completion (for testing)
// January 29, 2026
// =============================================================================

/**
 * Wait for a run to complete (blocking).
 * 
 * This is mainly for testing/debugging. In production, use polling
 * via the /api/search/status endpoint.
 * 
 * @param runId - The run ID to wait for
 * @param timeoutMs - Maximum time to wait (default: 120 seconds)
 * @returns Final status
 */
export async function waitForRunCompletion(
  runId: string,
  timeoutMs: number = 120000
): Promise<GoogleScraperStatus> {
  if (!client) {
    throw new Error('Apify client not configured - missing APIFY_API_TOKEN');
  }
  
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    const status = await getRunStatus(runId);
    
    if (status.status === 'SUCCEEDED' || status.status === 'FAILED' || status.status === 'ABORTED') {
      return status;
    }
    
    // Wait 3 seconds before polling again
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  return {
    status: 'TIMED-OUT',
    startedAt: undefined,
    finishedAt: undefined,
  };
}
