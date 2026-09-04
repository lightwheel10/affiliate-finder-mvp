import type { Platform, SearchResult } from '@/app/services/search';

export type DiscoveryMethod = {
  type: 'competitor' | 'keyword' | 'topic' | 'tagged' | 'brand';
  value: string;
};

export type SearchResultSnapshot = SearchResult & {
  discoveryMethod?: DiscoveryMethod;
};

export interface SearchStatusJobRow {
  id: unknown;
  user_id: unknown;
  keyword: unknown;
  sources: unknown;
  apify_run_id: unknown;
  status: unknown;
  created_at: unknown;
  user_settings: unknown;
  results_count: unknown;
  enrichment_status: unknown;
  enrichment_run_ids: unknown;
  raw_results: unknown;
  brand_id: unknown;
  brand_location_id: unknown;
  settings_snapshot: unknown;
  brand_archived_at: unknown;
  location_archived_at: unknown;
}

export interface SearchJobRuntimeContext {
  id: number;
  accountId: number;
  keyword: string;
  sources: Platform[];
  apifyRunId: string;
  status: string;
  createdAt: string;
  resultsCount: number | null;
  enrichmentStatus: string | null;
  enrichmentRunIds: Record<string, unknown> | null;
  rawResults: SearchResultSnapshot[] | null;
  brandId: string;
  brandLocationId: string;
  isActive: boolean;
  settings: {
    targetCountry: string | null;
    targetLanguage: string | null;
    userBrand: string | null;
    isOnboarding: boolean;
    topics: string[];
    competitors: string[];
  };
}

export class SearchStatusIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SearchStatusIntegrityError';
  }
}

function asObject(value: unknown, field: string): Record<string, unknown> {
  let parsed: unknown = value;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed) as unknown;
    } catch {
      throw new SearchStatusIntegrityError(`${field} is not valid JSON.`);
    }
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new SearchStatusIntegrityError(`${field} must be a JSON object.`);
  }
  return parsed as Record<string, unknown>;
}

function optionalObject(value: unknown, field: string): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  return asObject(value, field);
}

function readPositiveInteger(value: unknown, field: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new SearchStatusIntegrityError(`${field} is not a positive safe integer.`);
  }
  return parsed;
}

function readBigint(value: unknown, field: string): string {
  const normalized = typeof value === 'number' ? String(value) : value;
  if (typeof normalized !== 'string' || !/^[1-9][0-9]*$/.test(normalized)) {
    throw new SearchStatusIntegrityError(`${field} is not a positive PostgreSQL bigint.`);
  }
  return normalized;
}

function readString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new SearchStatusIntegrityError(`${field} is missing.`);
  }
  return value;
}

function readOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function readStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new SearchStatusIntegrityError(`${field} must be a string array.`);
  }
  return [...value] as string[];
}

function readSources(value: unknown): Platform[] {
  const sources = readStringArray(value, 'search_jobs.sources');
  const allowed = new Set<Platform>(['Web', 'YouTube', 'Instagram', 'TikTok']);
  if (sources.some((source) => !allowed.has(source as Platform))) {
    throw new SearchStatusIntegrityError('search_jobs.sources contains an unsupported platform.');
  }
  return sources as Platform[];
}

function readNullableCount(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new SearchStatusIntegrityError('search_jobs.results_count is invalid.');
  }
  return parsed;
}

function readRawResults(value: unknown): SearchResultSnapshot[] | null {
  if (value === null || value === undefined) return null;
  let parsed: unknown = value;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed) as unknown;
    } catch {
      throw new SearchStatusIntegrityError('search_jobs.raw_results is not valid JSON.');
    }
  }
  if (!Array.isArray(parsed)) {
    throw new SearchStatusIntegrityError('search_jobs.raw_results must be an array.');
  }
  return parsed.map((result) => {
    if (result === null || typeof result !== 'object' || Array.isArray(result)) {
      throw new SearchStatusIntegrityError('search_jobs.raw_results contains a non-object result.');
    }
    return result as SearchResultSnapshot;
  });
}

function readSettings(
  snapshotValue: unknown,
  userSettingsValue: unknown,
  brandId: string,
  brandLocationId: string,
): SearchJobRuntimeContext['settings'] {
  const snapshot = asObject(snapshotValue, 'search_jobs.settings_snapshot');
  const userSettings = optionalObject(userSettingsValue, 'search_jobs.user_settings');

  if (snapshot.version === 1) {
    const brand = asObject(snapshot.brand, 'settings_snapshot.brand');
    const location = asObject(snapshot.location, 'settings_snapshot.location');
    const search = asObject(snapshot.search, 'settings_snapshot.search');
    if (readBigint(brand.id, 'settings_snapshot.brand.id') !== brandId) {
      throw new SearchStatusIntegrityError('The settings snapshot brand does not match the job.');
    }
    if (readBigint(location.id, 'settings_snapshot.location.id') !== brandLocationId) {
      throw new SearchStatusIntegrityError('The settings snapshot location does not match the job.');
    }

    return {
      targetCountry: readString(location.countryName, 'settings_snapshot.location.countryName'),
      targetLanguage: readString(location.languageName, 'settings_snapshot.location.languageName'),
      userBrand: readOptionalString(brand.normalizedDomain) ?? readString(brand.name, 'settings_snapshot.brand.name'),
      isOnboarding: search.isOnboarding === true || userSettings?.isOnboarding === true,
      topics: readStringArray(search.keywords, 'settings_snapshot.search.keywords'),
      competitors: readStringArray(search.competitors, 'settings_snapshot.search.competitors'),
    };
  }

  // Historical jobs were backfilled with their own immutable legacy
  // user_settings object. This is still job-local provenance; no mutable user
  // profile is read here.
  return {
    targetCountry: readOptionalString(snapshot.targetCountry),
    targetLanguage: readOptionalString(snapshot.targetLanguage),
    userBrand: readOptionalString(snapshot.userBrand),
    isOnboarding: snapshot.isOnboarding === true,
    topics: Array.isArray(snapshot.topics)
      ? readStringArray(snapshot.topics, 'settings_snapshot.topics')
      : [],
    competitors: Array.isArray(snapshot.competitors)
      ? readStringArray(snapshot.competitors, 'settings_snapshot.competitors')
      : [],
  };
}

export function parseSearchJobRuntimeContext(
  row: SearchStatusJobRow,
): SearchJobRuntimeContext {
  const brandId = readBigint(row.brand_id, 'search_jobs.brand_id');
  const brandLocationId = readBigint(
    row.brand_location_id,
    'search_jobs.brand_location_id',
  );

  return {
    id: readPositiveInteger(row.id, 'search_jobs.id'),
    accountId: readPositiveInteger(row.user_id, 'search_jobs.user_id'),
    keyword: readString(row.keyword, 'search_jobs.keyword'),
    sources: readSources(row.sources),
    apifyRunId: readString(row.apify_run_id, 'search_jobs.apify_run_id'),
    status: readString(row.status, 'search_jobs.status'),
    createdAt: String(row.created_at),
    resultsCount: readNullableCount(row.results_count),
    enrichmentStatus: readOptionalString(row.enrichment_status),
    enrichmentRunIds: optionalObject(
      row.enrichment_run_ids,
      'search_jobs.enrichment_run_ids',
    ),
    rawResults: readRawResults(row.raw_results),
    brandId,
    brandLocationId,
    isActive: row.brand_archived_at === null && row.location_archived_at === null,
    settings: readSettings(
      row.settings_snapshot,
      row.user_settings,
      brandId,
      brandLocationId,
    ),
  };
}

export function dedupeSearchResults(
  results: readonly SearchResultSnapshot[],
): SearchResultSnapshot[] {
  const byLink = new Map<string, SearchResultSnapshot>();
  for (const result of results) {
    if (typeof result.link !== 'string' || result.link.trim() === '') {
      throw new SearchStatusIntegrityError('A search result has no link.');
    }
    const link = result.link.trim();
    if (!byLink.has(link)) byLink.set(link, { ...result, link });
  }
  return [...byLink.values()];
}

export function normalizeResultSnapshot(
  result: SearchResultSnapshot,
): SearchResultSnapshot {
  const serialized = JSON.stringify(result);
  const parsed = JSON.parse(serialized) as unknown;
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new SearchStatusIntegrityError('A search result could not be serialized.');
  }
  return parsed as SearchResultSnapshot;
}

export function countResultSources(
  results: readonly SearchResultSnapshot[],
): Record<string, number> {
  return results.reduce<Record<string, number>>((counts, result) => {
    counts[result.source] = (counts[result.source] ?? 0) + 1;
    return counts;
  }, { Web: 0, YouTube: 0, Instagram: 0, TikTok: 0 });
}
