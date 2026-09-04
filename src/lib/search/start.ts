import type {
  BrandLocationContext,
  RequestedBrandLocationId,
} from '@/lib/brand-locations/context';
import {
  getMarketCountryByIsoCode,
  getMarketLanguageByIsoCode,
} from '@/lib/markets/catalog';
import type { StartSearchInput } from '@/lib/search/input';
import { scopedSearchProviderCorrelationId } from '@/lib/search/provider-input';

export interface SearchStartRequest {
  accountId: number;
  requestedBrandLocationId?: RequestedBrandLocationId;
  requestId: string;
  isOnboarding?: boolean;
  keywords: string[];
  competitors: string[];
  sources: StartSearchInput['sources'];
}

export interface SearchProviderInput {
  keywords: string[];
  competitors?: string[];
  sources: StartSearchInput['sources'];
  targetCountry: string;
  targetLanguage: string;
  correlationId: string;
}

export interface SearchProviderRun {
  runId: string;
}

export interface SearchSettingsSnapshot {
  version: 1;
  brand: {
    id: string;
    name: string;
    normalizedDomain: string | null;
  };
  location: {
    id: string;
    countryCode: string;
    countryName: string;
    languageCode: string;
    languageName: string;
  };
  search: {
    keywords: string[];
    competitors: string[];
    sources: StartSearchInput['sources'];
    requestId: string | null;
    providerCorrelationId?: string;
    isOnboarding?: true;
  };
}

export interface LegacySearchUserSettings {
  targetCountry: string;
  targetLanguage: string;
  userBrand: string;
  topics: string[];
  competitors: string[];
  isOnboarding?: true;
}

export interface PersistSearchJobInput {
  accountId: number;
  brandId: string;
  brandLocationId: string;
  combinedKeyword: string;
  sources: StartSearchInput['sources'];
  runId: string;
  requestId: string;
  reservationKind: 'credit' | 'onboarding_entitlement';
  userSettings: LegacySearchUserSettings;
  settingsSnapshot: SearchSettingsSnapshot;
}

export interface PersistedSearchJob {
  id: number;
  runId: string;
  brandId: string;
  brandLocationId: string;
  settingsSnapshot: SearchSettingsSnapshot;
  created: boolean;
}

export type SearchCreditReservationStatus =
  | 'reserved'
  | 'uncertain'
  | 'consumed'
  | 'released';

export interface ReserveSearchCreditInput {
  accountId: number;
  requestId: string;
  brandId: string;
  brandLocationId: string;
  settingsSnapshot: SearchSettingsSnapshot;
}

export type ReserveSearchCreditResult =
  | { outcome: 'reserved' }
  | {
    outcome: 'existing';
    status: SearchCreditReservationStatus;
    searchJobId: number | null;
    settingsSnapshot: SearchSettingsSnapshot;
  }
  | { outcome: 'insufficient'; message: string };

export type OnboardingSearchEntitlementStatus =
  | 'available'
  | 'reserved'
  | 'dispatching'
  | 'consumed'
  | 'uncertain';

export interface ReserveOnboardingSearchInput {
  accountId: number;
  requestId: string;
  brandId: string;
  brandLocationId: string;
  settingsSnapshot: SearchSettingsSnapshot;
}

export type ReserveOnboardingSearchResult =
  | { outcome: 'reserved' }
  | {
    outcome: 'existing';
    status: OnboardingSearchEntitlementStatus;
    requestId: string | null;
    searchJobId: number | null;
    settingsSnapshot: SearchSettingsSnapshot | null;
  }
  | {
    outcome: 'unavailable';
    code:
      | 'SUBSCRIPTION_REQUIRED'
      | 'ACCOUNT_ONBOARDING_REQUIRED'
      | 'ONBOARDING_SEARCH_UNAVAILABLE';
    status: number;
    message: string;
  };

export interface SearchStartDependencies {
  resolveContext(input: {
    accountId: number;
    requestedBrandLocationId?: RequestedBrandLocationId;
  }): Promise<BrandLocationContext>;
  reserveCredit(input: ReserveSearchCreditInput): Promise<ReserveSearchCreditResult>;
  markSearchLaunchAttempted(
    accountId: number,
    requestId: string,
  ): Promise<void>;
  releaseCredit(accountId: number, requestId: string): Promise<void>;
  markSearchUncertain(
    accountId: number,
    requestId: string,
    message: string,
  ): Promise<void>;
  reserveOnboardingSearch(
    input: ReserveOnboardingSearchInput,
  ): Promise<ReserveOnboardingSearchResult>;
  markOnboardingLaunchAttempted(
    accountId: number,
    requestId: string,
  ): Promise<void>;
  releaseOnboardingSearch(
    accountId: number,
    requestId: string,
  ): Promise<void>;
  markOnboardingSearchUncertain(
    accountId: number,
    requestId: string,
    message: string,
  ): Promise<void>;
  startProvider(input: SearchProviderInput): Promise<SearchProviderRun>;
  abortProvider(runId: string): Promise<void>;
  findJobByRequestId(
    accountId: number,
    requestId: string,
  ): Promise<PersistedSearchJob | null>;
  findJobById(
    accountId: number,
    jobId: number,
  ): Promise<PersistedSearchJob | null>;
  persistJobIfActive(
    input: PersistSearchJobInput,
  ): Promise<PersistedSearchJob | null>;
}

export type SearchStartErrorCode =
  | 'INSUFFICIENT_CREDITS'
  | 'BRAND_LOCATION_MARKET_REQUIRED'
  | 'BRAND_LOCATION_MARKET_UNSUPPORTED'
  | 'BRAND_LOCATION_CHANGED'
  | 'INVALID_PROVIDER_RUN'
  | 'SEARCH_JOB_INTEGRITY_ERROR'
  | 'SEARCH_REQUEST_CONFLICT'
  | 'SEARCH_START_IN_PROGRESS'
  | 'SUBSCRIPTION_REQUIRED'
  | 'ACCOUNT_ONBOARDING_REQUIRED'
  | 'ONBOARDING_SEARCH_UNAVAILABLE'
  | 'ONBOARDING_SEARCH_REQUIRES_REVIEW'
  | 'SEARCH_REQUIRES_REVIEW'
  | 'SEARCH_START_CLEANUP_FAILED';

export class SearchStartError extends Error {
  constructor(
    public readonly code: SearchStartErrorCode,
    public readonly status: number,
    message: string,
    public readonly originalError?: unknown,
    public readonly cleanupError?: unknown,
  ) {
    super(message);
    this.name = 'SearchStartError';
  }
}

export class SearchProviderStartError extends Error {
  constructor(
    message: string,
    public readonly externalStartMayHaveSucceeded: boolean,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'SearchProviderStartError';
  }
}

export interface StartedSearch {
  jobId: number;
  runId: string;
  accountId: number;
  brandId: string;
  brandLocationId: string;
  combinedKeyword: string;
  settingsSnapshot: SearchSettingsSnapshot;
  reused: boolean;
}

function validateRunId(value: unknown): string {
  if (
    typeof value !== 'string'
    || value.trim() === ''
    || value.length > 255
    || /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new SearchStartError(
      'INVALID_PROVIDER_RUN',
      502,
      'The search provider returned an invalid run identifier.',
    );
  }

  return value;
}

function buildPreparedSettings(
  context: BrandLocationContext,
  request: SearchStartRequest,
): {
  providerInput: SearchProviderInput;
  userSettings: LegacySearchUserSettings;
  snapshot: SearchSettingsSnapshot;
} {
  if (!context.location.countryCode || !context.location.languageCode) {
    throw new SearchStartError(
      'BRAND_LOCATION_MARKET_REQUIRED',
      409,
      'Configure a country and language for this brand location before searching.',
    );
  }

  const country = getMarketCountryByIsoCode(context.location.countryCode);
  const language = getMarketLanguageByIsoCode(context.location.languageCode);

  if (!country || !language) {
    throw new SearchStartError(
      'BRAND_LOCATION_MARKET_UNSUPPORTED',
      500,
      'The brand location contains an unsupported market configuration.',
    );
  }

  const keywords = [...request.keywords];
  const competitors = [...request.competitors];
  const sources = [...request.sources];
  const userBrand = context.brand.normalizedDomain ?? context.brand.name;
  const providerCorrelationId = scopedSearchProviderCorrelationId({
    accountId: request.accountId,
    brandId: context.brand.id,
    brandLocationId: context.location.id,
    requestId: request.requestId,
  });

  return {
    providerInput: {
      keywords,
      competitors: competitors.length > 0 ? competitors : undefined,
      sources,
      targetCountry: country.name,
      targetLanguage: language.name,
      correlationId: providerCorrelationId,
    },
    userSettings: {
      targetCountry: country.name,
      targetLanguage: language.name,
      userBrand,
      topics: [...keywords],
      competitors: [...competitors],
      ...(request.isOnboarding ? { isOnboarding: true as const } : {}),
    },
    snapshot: {
      version: 1,
      brand: {
        id: context.brand.id,
        name: context.brand.name,
        normalizedDomain: context.brand.normalizedDomain,
      },
      location: {
        id: context.location.id,
        countryCode: country.isoCode,
        countryName: country.name,
        languageCode: language.isoCode,
        languageName: language.name,
      },
      search: {
        keywords: [...keywords],
        competitors: [...competitors],
        sources: [...sources],
        requestId: request.requestId,
        providerCorrelationId,
        ...(request.isOnboarding ? { isOnboarding: true as const } : {}),
      },
    },
  };
}

async function abortAfterPersistenceFailure(
  runId: string,
  originalError: unknown,
  request: SearchStartRequest,
  dependencies: SearchStartDependencies,
): Promise<never> {
  try {
    await dependencies.abortProvider(runId);
  } catch (cleanupError) {
    if (request.isOnboarding) {
      try {
        await dependencies.markOnboardingSearchUncertain(
          request.accountId,
          request.requestId,
          boundedError(
            new Error(
              `Provider run persistence failed and abort was not confirmed: ${boundedError(cleanupError)}`,
            ),
          ),
        );
      } catch {
        // The committed launch-attempt marker remains fail-closed even if the
        // database cannot record the more specific uncertain state.
      }
    } else {
      try {
        await dependencies.markSearchUncertain(
          request.accountId,
          request.requestId,
          boundedError(
            new Error(
              `Provider run persistence failed and abort was not confirmed: ${boundedError(cleanupError)}`,
            ),
          ),
        );
      } catch {
        // The committed launch-attempt marker keeps the credit held even if
        // the database cannot record the more specific uncertain state.
      }
    }
    throw new SearchStartError(
      'SEARCH_START_CLEANUP_FAILED',
      500,
      'The search could not be recorded and its provider run could not be cancelled.',
      originalError,
      cleanupError,
    );
  }

  if (request.isOnboarding) {
    try {
      await dependencies.releaseOnboardingSearch(
        request.accountId,
        request.requestId,
      );
    } catch (cleanupError) {
      throw new SearchStartError(
        'SEARCH_START_CLEANUP_FAILED',
        500,
        'The provider run was cancelled, but the onboarding-search entitlement could not be released.',
        originalError,
        cleanupError,
      );
    }
  } else {
    try {
      await dependencies.releaseCredit(request.accountId, request.requestId);
    } catch (cleanupError) {
      throw new SearchStartError(
        'SEARCH_START_CLEANUP_FAILED',
        500,
        'The provider run was cancelled, but its search-credit reservation could not be released.',
        originalError,
        cleanupError,
      );
    }
  }

  throw originalError;
}

async function releaseAfterProviderFailure(
  originalError: unknown,
  request: SearchStartRequest,
  dependencies: SearchStartDependencies,
): Promise<never> {
  if (request.isOnboarding) {
    try {
      await dependencies.releaseOnboardingSearch(
        request.accountId,
        request.requestId,
      );
    } catch (cleanupError) {
      throw new SearchStartError(
        'SEARCH_START_CLEANUP_FAILED',
        500,
        'The provider did not start, but the onboarding-search entitlement could not be released.',
        originalError,
        cleanupError,
      );
    }
  } else {
    try {
      await dependencies.releaseCredit(request.accountId, request.requestId);
    } catch (cleanupError) {
      throw new SearchStartError(
        'SEARCH_START_CLEANUP_FAILED',
        500,
        'The search provider did not start, but its credit reservation could not be released.',
        originalError,
        cleanupError,
      );
    }
  }
  throw originalError;
}

function boundedError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .trim()
    .slice(0, 2_000) || 'Unknown search launch failure';
}

async function failAmbiguousPaidLaunch(
  originalError: unknown,
  request: SearchStartRequest,
  dependencies: SearchStartDependencies,
): Promise<never> {
  try {
    await dependencies.markSearchUncertain(
      request.accountId,
      request.requestId,
      boundedError(originalError),
    );
  } catch (cleanupError) {
    throw new SearchStartError(
      'SEARCH_START_CLEANUP_FAILED',
      500,
      'The search may have started, and its durable state could not be reconciled.',
      originalError,
      cleanupError,
    );
  }

  throw new SearchStartError(
    'SEARCH_REQUIRES_REVIEW',
    503,
    'The search may already have started. It will not be launched again automatically.',
    originalError,
  );
}

async function failAmbiguousOnboardingLaunch(
  originalError: unknown,
  request: SearchStartRequest,
  dependencies: SearchStartDependencies,
): Promise<never> {
  try {
    await dependencies.markOnboardingSearchUncertain(
      request.accountId,
      request.requestId,
      boundedError(originalError),
    );
  } catch (cleanupError) {
    throw new SearchStartError(
      'SEARCH_START_CLEANUP_FAILED',
      500,
      'The onboarding search may have started, and its durable state could not be reconciled.',
      originalError,
      cleanupError,
    );
  }

  throw new SearchStartError(
    'ONBOARDING_SEARCH_REQUIRES_REVIEW',
    503,
    'The onboarding search may already have started. It will not be launched again automatically.',
    originalError,
  );
}

function canonicalizeJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalizeJson).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalizeJson(nested)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function validatePersistedJob(
  job: PersistedSearchJob,
  expectedSnapshot: SearchSettingsSnapshot,
): void {
  if (!Number.isSafeInteger(job.id) || job.id <= 0) {
    throw new SearchStartError(
      'SEARCH_JOB_INTEGRITY_ERROR',
      500,
      'The search job has an invalid identifier.',
    );
  }
  validateRunId(job.runId);
  if (
    job.brandId !== expectedSnapshot.brand.id
    || job.brandLocationId !== expectedSnapshot.location.id
    || !snapshotsMatchWithLegacyCorrelation(job.settingsSnapshot, expectedSnapshot)
  ) {
    throw new SearchStartError(
      'SEARCH_REQUEST_CONFLICT',
      409,
      'This search request identifier is already attached to different settings.',
    );
  }
}

function snapshotsMatchWithLegacyCorrelation(
  actual: SearchSettingsSnapshot,
  expected: SearchSettingsSnapshot,
): boolean {
  if (actual.search.providerCorrelationId !== undefined) {
    return canonicalizeJson(actual) === canonicalizeJson(expected);
  }
  const expectedLegacySearch = { ...expected.search };
  delete expectedLegacySearch.providerCorrelationId;
  return canonicalizeJson(actual) === canonicalizeJson({
    ...expected,
    search: expectedLegacySearch,
  });
}

function validateReservationSnapshot(
  actual: SearchSettingsSnapshot,
  expected: SearchSettingsSnapshot,
): void {
  if (!snapshotsMatchWithLegacyCorrelation(actual, expected)) {
    throw new SearchStartError(
      'SEARCH_REQUEST_CONFLICT',
      409,
      'This search request identifier is already attached to different settings.',
    );
  }
}

function startedFromPersisted(
  job: PersistedSearchJob,
  request: SearchStartRequest,
  snapshot: SearchSettingsSnapshot,
  combinedKeyword: string,
  reused: boolean,
): StartedSearch {
  validatePersistedJob(job, snapshot);
  return {
    jobId: job.id,
    runId: job.runId,
    accountId: request.accountId,
    brandId: job.brandId,
    brandLocationId: job.brandLocationId,
    combinedKeyword,
    settingsSnapshot: snapshot,
    reused,
  };
}

export async function startAttributedSearch(
  request: SearchStartRequest,
  dependencies: SearchStartDependencies,
): Promise<StartedSearch> {
  const context = await dependencies.resolveContext({
    accountId: request.accountId,
    requestedBrandLocationId: request.requestedBrandLocationId,
  });
  const prepared = buildPreparedSettings(context, request);
  const combinedKeyword = request.keywords.join(' | ');

  const existing = await dependencies.findJobByRequestId(
    request.accountId,
    request.requestId,
  );
  if (existing) {
    return startedFromPersisted(
      existing,
      request,
      prepared.snapshot,
      combinedKeyword,
      true,
    );
  }

  if (request.isOnboarding) {
    const entitlement = await dependencies.reserveOnboardingSearch({
      accountId: request.accountId,
      requestId: request.requestId,
      brandId: context.brand.id,
      brandLocationId: context.location.id,
      settingsSnapshot: prepared.snapshot,
    });
    if (entitlement.outcome === 'unavailable') {
      throw new SearchStartError(
        entitlement.code,
        entitlement.status,
        entitlement.message,
      );
    }
    if (entitlement.outcome === 'existing') {
      if (entitlement.searchJobId !== null) {
        const originalJob = await dependencies.findJobById(
          request.accountId,
          entitlement.searchJobId,
        );
        if (!originalJob) {
          throw new SearchStartError(
            'SEARCH_JOB_INTEGRITY_ERROR',
            500,
            'The onboarding-search entitlement references a missing search job.',
          );
        }
        return startedFromPersisted(
          originalJob,
          request,
          originalJob.settingsSnapshot,
          originalJob.settingsSnapshot.search.keywords.join(' | '),
          true,
        );
      }
      if (
        entitlement.requestId === request.requestId
        && entitlement.settingsSnapshot
      ) {
        validateReservationSnapshot(
          entitlement.settingsSnapshot,
          prepared.snapshot,
        );
      }
      if (entitlement.status === 'uncertain') {
        throw new SearchStartError(
          'ONBOARDING_SEARCH_REQUIRES_REVIEW',
          503,
          'The onboarding search may already have started. It will not be launched again automatically.',
        );
      }
      if (
        entitlement.status === 'reserved'
        || entitlement.status === 'dispatching'
      ) {
        throw new SearchStartError(
          'SEARCH_START_IN_PROGRESS',
          409,
          'The onboarding search is already being started. Please retry shortly.',
        );
      }
      throw new SearchStartError(
        'ONBOARDING_SEARCH_UNAVAILABLE',
        409,
        'The free onboarding search has already been used.',
      );
    }
  } else {
    const reservation = await dependencies.reserveCredit({
      accountId: request.accountId,
      requestId: request.requestId,
      brandId: context.brand.id,
      brandLocationId: context.location.id,
      settingsSnapshot: prepared.snapshot,
    });
    if (reservation.outcome === 'insufficient') {
      throw new SearchStartError(
        'INSUFFICIENT_CREDITS',
        402,
        reservation.message,
      );
    }
    if (reservation.outcome === 'existing') {
      validateReservationSnapshot(reservation.settingsSnapshot, prepared.snapshot);
      if (reservation.searchJobId !== null) {
        const racedJob = await dependencies.findJobByRequestId(
          request.accountId,
          request.requestId,
        );
        if (racedJob) {
          return startedFromPersisted(
            racedJob,
            request,
            prepared.snapshot,
            combinedKeyword,
            true,
          );
        }
        throw new SearchStartError(
          'SEARCH_JOB_INTEGRITY_ERROR',
          500,
          'A search-credit reservation references a missing search job.',
        );
      }
      if (reservation.status === 'reserved') {
        throw new SearchStartError(
          'SEARCH_START_IN_PROGRESS',
          409,
          'This search request is already being started. Please retry shortly.',
        );
      }
      if (reservation.status === 'uncertain') {
        throw new SearchStartError(
          'SEARCH_REQUIRES_REVIEW',
          503,
          'The search may already have started. It will not be launched again automatically.',
        );
      }
      throw new SearchStartError(
        'SEARCH_REQUEST_CONFLICT',
        409,
        'This search request identifier has already reached a terminal state.',
      );
    }
  }

  if (request.isOnboarding) {
    try {
      await dependencies.markOnboardingLaunchAttempted(
        request.accountId,
        request.requestId,
      );
    } catch (error) {
      return releaseAfterProviderFailure(error, request, dependencies);
    }
  } else {
    try {
      await dependencies.markSearchLaunchAttempted(
        request.accountId,
        request.requestId,
      );
    } catch (error) {
      return releaseAfterProviderFailure(error, request, dependencies);
    }
  }

  let run: SearchProviderRun;
  try {
    run = await dependencies.startProvider(prepared.providerInput);
  } catch (error) {
    const definitelyDidNotStart = error instanceof SearchProviderStartError
      && !error.externalStartMayHaveSucceeded;
    if (!definitelyDidNotStart) {
      return request.isOnboarding
        ? failAmbiguousOnboardingLaunch(error, request, dependencies)
        : failAmbiguousPaidLaunch(error, request, dependencies);
    }
    return releaseAfterProviderFailure(error, request, dependencies);
  }
  let runId: string;
  try {
    runId = validateRunId(run.runId);
  } catch (error) {
    if (typeof run.runId === 'string' && run.runId.trim() !== '') {
      return abortAfterPersistenceFailure(run.runId, error, request, dependencies);
    }
    return request.isOnboarding
      ? failAmbiguousOnboardingLaunch(error, request, dependencies)
      : failAmbiguousPaidLaunch(error, request, dependencies);
  }

  let persisted: PersistedSearchJob | null;
  let duplicateCompensationAttempted = false;
  try {
    persisted = await dependencies.persistJobIfActive({
      accountId: request.accountId,
      brandId: context.brand.id,
      brandLocationId: context.location.id,
      combinedKeyword,
      sources: [...request.sources],
      runId,
      requestId: request.requestId,
      reservationKind: request.isOnboarding
        ? 'onboarding_entitlement'
        : 'credit',
      userSettings: prepared.userSettings,
      settingsSnapshot: prepared.snapshot,
    });

    if (!persisted) {
      throw new SearchStartError(
        'BRAND_LOCATION_CHANGED',
        409,
        'The selected brand location changed before the search could start. Please try again.',
      );
    }

    if (!persisted.created) {
      const reusedSearch = startedFromPersisted(
        persisted,
        request,
        prepared.snapshot,
        combinedKeyword,
        true,
      );
      duplicateCompensationAttempted = true;
      try {
        await dependencies.abortProvider(runId);
      } catch (cleanupError) {
        try {
          if (request.isOnboarding) {
            await dependencies.markOnboardingSearchUncertain(
              request.accountId,
              request.requestId,
              boundedError(cleanupError),
            );
          } else {
            await dependencies.markSearchUncertain(
              request.accountId,
              request.requestId,
              boundedError(cleanupError),
            );
          }
        } catch {
          // The durable launch marker still prevents an automatic retry.
        }
        throw new SearchStartError(
          'SEARCH_START_CLEANUP_FAILED',
          500,
          'A duplicate search was detected but its extra provider run could not be cancelled.',
          new SearchStartError(
            'SEARCH_REQUEST_CONFLICT',
            409,
            'A concurrent request already created this search.',
          ),
          cleanupError,
        );
      }
      if (request.isOnboarding) {
        await dependencies.releaseOnboardingSearch(
          request.accountId,
          request.requestId,
        );
      } else {
        await dependencies.releaseCredit(
          request.accountId,
          request.requestId,
        );
      }
      return reusedSearch;
    }

    validatePersistedJob(persisted, prepared.snapshot);
    if (persisted.runId !== runId) {
      throw new SearchStartError(
        'SEARCH_JOB_INTEGRITY_ERROR',
        500,
        'The new search job does not match the provider run.',
      );
    }
  } catch (error) {
    if (duplicateCompensationAttempted) throw error;
    return abortAfterPersistenceFailure(runId, error, request, dependencies);
  }

  return {
    jobId: persisted.id,
    runId,
    accountId: request.accountId,
    brandId: context.brand.id,
    brandLocationId: context.location.id,
    combinedKeyword,
    settingsSnapshot: prepared.snapshot,
    reused: false,
  };
}
