import type { Platform } from '@/app/services/search';
import {
  buildAllLocalizedQueries,
  buildSingleKeywordQueries,
  queriesToApifyInput,
  type BuiltQuery,
  type Platform as LocalizedPlatform,
} from '@/app/utils/localized-search';
import { getApifyGoogleLocationInput } from '@/lib/markets/apify-google';
import type { EnrichmentPlatform } from '@/lib/search/enrichment-dispatch';

export interface GoogleProviderInputOptions {
  keyword?: string;
  keywords?: string[];
  competitors?: string[];
  sources: Platform[];
  targetCountry?: string | null;
  targetLanguage?: string | null;
  correlationId?: string;
}

const SEARCH_CORRELATION_PREFIX = 'search-request:';
const ENRICHMENT_CORRELATION_PREFIX = 'enrichment-dispatch:';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Produces an opaque, non-personal marker that makes otherwise identical
 * provider runs distinguishable during a manual repair.
 */
export function searchProviderCorrelationId(requestId: string): string {
  if (!UUID_PATTERN.test(requestId)) {
    throw new Error('Search provider correlation requires a canonical request UUID.');
  }
  return `${SEARCH_CORRELATION_PREFIX}${requestId.toLowerCase()}`;
}

/**
 * Binds a primary-search run to server-owned account, brand and location IDs.
 * The request UUID alone is client-controlled and therefore is not a safe
 * cross-account reconciliation identity.
 */
export function scopedSearchProviderCorrelationId(input: {
  accountId: number;
  brandId: string;
  brandLocationId: string;
  requestId: string;
}): string {
  if (!Number.isSafeInteger(input.accountId) || input.accountId <= 0) {
    throw new Error('Search provider correlation requires a positive account ID.');
  }
  if (!/^[1-9][0-9]{0,18}$/.test(input.brandId)) {
    throw new Error('Search provider correlation requires a positive brand ID.');
  }
  if (!/^[1-9][0-9]{0,18}$/.test(input.brandLocationId)) {
    throw new Error('Search provider correlation requires a positive location ID.');
  }
  const legacy = searchProviderCorrelationId(input.requestId);
  return `${SEARCH_CORRELATION_PREFIX}${input.accountId}:${input.brandId}:${input.brandLocationId}:${legacy.slice(SEARCH_CORRELATION_PREFIX.length)}`;
}

/** The dispatch primary key is durable and unique before enrichment launches. */
export function enrichmentProviderCorrelationId(dispatchId: string): string {
  if (!/^[1-9][0-9]{0,18}$/.test(dispatchId)) {
    throw new Error('Enrichment provider correlation requires a positive dispatch ID.');
  }
  return `${ENRICHMENT_CORRELATION_PREFIX}${dispatchId}`;
}

/**
 * Builds the exact payload sent to the Google-search Actor. Reconciliation uses
 * this same pure builder so a real, but unrelated, provider run is rejected.
 */
export function buildGoogleProviderInput(options: GoogleProviderInputOptions) {
  const {
    keyword,
    keywords,
    competitors,
    sources,
    targetCountry,
    targetLanguage,
    correlationId,
  } = options;
  let builtQueries: BuiltQuery[];

  if (keywords && keywords.length > 0) {
    builtQueries = buildAllLocalizedQueries({
      keywords,
      competitors: competitors || [],
      platforms: sources as LocalizedPlatform[],
      targetLanguage,
      targetCountry,
    });
  } else if (keyword) {
    builtQueries = buildSingleKeywordQueries(
      keyword,
      sources as LocalizedPlatform[],
      targetLanguage,
    );
  } else {
    throw new Error('Either keyword or keywords[] must be provided');
  }

  const locationInput = getApifyGoogleLocationInput(
    targetCountry,
    targetLanguage,
  );
  return {
    queries: queriesToApifyInput(builtQueries),
    resultsPerPage: 10,
    maxPagesPerQuery: 1,
    languageCode: locationInput.languageCode,
    countryCode: locationInput.countryCode,
    searchLanguage: locationInput.searchLanguage,
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
    ...(correlationId ? { affiliateFinderCorrelationId: correlationId } : {}),
  };
}

/** Exact payloads used by the non-blocking enrichment launch path. */
export function buildEnrichmentProviderInput(
  platform: EnrichmentPlatform,
  urls: readonly string[],
  correlationId: string,
) {
  const correlation = { affiliateFinderCorrelationId: correlationId };
  switch (platform) {
    case 'youtube':
      return {
        startUrls: urls.map((url) => ({ url })),
        maxResults: 1,
        maxResultsShorts: 0,
        maxResultStreams: 0,
        ...correlation,
      };
    case 'instagram':
      return {
        directUrls: [...urls],
        resultsType: 'details',
        resultsLimit: 1,
        addParentData: false,
        ...correlation,
      };
    case 'tiktok':
      return { postURLs: [...urls], resultsPerPage: 1, ...correlation };
    case 'similarweb':
      return { domains: [...urls], ...correlation };
  }
}
