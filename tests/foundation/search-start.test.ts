import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BrandLocationContextError,
  type BrandLocationContext,
} from '../../src/lib/brand-locations/context';
import {
  SearchStartError,
  SearchProviderStartError,
  startAttributedSearch,
  type PersistSearchJobInput,
  type ReserveOnboardingSearchInput,
  type ReserveSearchCreditInput,
  type SearchProviderInput,
  type SearchSettingsSnapshot,
  type SearchStartDependencies,
  type SearchStartRequest,
} from '../../src/lib/search/start';

function context(
  overrides: Partial<BrandLocationContext> = {},
): BrandLocationContext {
  return {
    accountId: 7,
    source: 'account_default',
    brand: {
      id: '11',
      name: 'Selecdoo',
      normalizedDomain: 'selecdoo.com',
      bio: null,
      affiliateTypes: [],
      isDefault: true,
    },
    location: {
      id: '21',
      countryCode: 'gb',
      languageCode: 'en',
      topics: [],
      competitors: [],
      isDefault: true,
      autoScanEnabled: false,
    },
    ...overrides,
  };
}

const request: SearchStartRequest = {
  accountId: 7,
  requestId: 'a4e38e3d-9d28-4e45-a5b5-409a488585d3',
  keywords: ['affiliate software', 'creator tools'],
  competitors: ['example.com'],
  sources: ['Web', 'YouTube'],
};

function requestIdFor(index: number): string {
  return `00000000-0000-4000-8000-${index.toString().padStart(12, '0')}`;
}

function dependencies(overrides: Partial<SearchStartDependencies> = {}): {
  deps: SearchStartDependencies;
  providerInputs: SearchProviderInput[];
  persistedInputs: PersistSearchJobInput[];
  reservationInputs: ReserveSearchCreditInput[];
  onboardingReservationInputs: ReserveOnboardingSearchInput[];
  releasedRequests: string[];
  paidLaunchAttempts: string[];
  uncertainPaidRequests: string[];
  releasedOnboardingRequests: string[];
  onboardingLaunchAttempts: string[];
  uncertainOnboardingRequests: string[];
  abortedRuns: string[];
} {
  const providerInputs: SearchProviderInput[] = [];
  const persistedInputs: PersistSearchJobInput[] = [];
  const reservationInputs: ReserveSearchCreditInput[] = [];
  const onboardingReservationInputs: ReserveOnboardingSearchInput[] = [];
  const releasedRequests: string[] = [];
  const paidLaunchAttempts: string[] = [];
  const uncertainPaidRequests: string[] = [];
  const releasedOnboardingRequests: string[] = [];
  const onboardingLaunchAttempts: string[] = [];
  const uncertainOnboardingRequests: string[] = [];
  const abortedRuns: string[] = [];

  return {
    providerInputs,
    persistedInputs,
    reservationInputs,
    onboardingReservationInputs,
    releasedRequests,
    paidLaunchAttempts,
    uncertainPaidRequests,
    releasedOnboardingRequests,
    onboardingLaunchAttempts,
    uncertainOnboardingRequests,
    abortedRuns,
    deps: {
      resolveContext: async () => context(),
      reserveCredit: async (input) => {
        reservationInputs.push(input);
        return { outcome: 'reserved' };
      },
      markSearchLaunchAttempted: async (_accountId, requestId) => {
        paidLaunchAttempts.push(requestId);
      },
      releaseCredit: async (_accountId, requestId) => {
        releasedRequests.push(requestId);
      },
      markSearchUncertain: async (_accountId, requestId) => {
        uncertainPaidRequests.push(requestId);
      },
      reserveOnboardingSearch: async (input) => {
        onboardingReservationInputs.push(input);
        return { outcome: 'reserved' };
      },
      markOnboardingLaunchAttempted: async (_accountId, requestId) => {
        onboardingLaunchAttempts.push(requestId);
      },
      releaseOnboardingSearch: async (_accountId, requestId) => {
        releasedOnboardingRequests.push(requestId);
      },
      markOnboardingSearchUncertain: async (_accountId, requestId) => {
        uncertainOnboardingRequests.push(requestId);
      },
      startProvider: async (input) => {
        providerInputs.push(input);
        return { runId: 'run-1' };
      },
      abortProvider: async (runId) => {
        abortedRuns.push(runId);
      },
      findJobByRequestId: async () => null,
      findJobById: async () => null,
      persistJobIfActive: async (input) => {
        persistedInputs.push(input);
        return {
          id: 101,
          runId: input.runId,
          brandId: input.brandId,
          brandLocationId: input.brandLocationId,
          settingsSnapshot: input.settingsSnapshot,
          created: true,
        };
      },
      ...overrides,
    },
  };
}

async function expectSearchError(
  action: () => Promise<unknown>,
  code: SearchStartError['code'],
  status: number,
): Promise<SearchStartError> {
  try {
    await action();
  } catch (error) {
    assert.ok(error instanceof SearchStartError);
    assert.equal(error.code, code);
    assert.equal(error.status, status);
    return error;
  }
  assert.fail(`Expected ${code}`);
}

test('default search uses canonical market names and stores an immutable-value snapshot', async () => {
  const originalRequest = structuredClone(request);
  const state = dependencies();
  const result = await startAttributedSearch(request, state.deps);

  assert.equal(result.jobId, 101);
  assert.equal(result.brandId, '11');
  assert.equal(result.brandLocationId, '21');
  assert.deepEqual(state.providerInputs, [{
    keywords: ['affiliate software', 'creator tools'],
    competitors: ['example.com'],
    sources: ['Web', 'YouTube'],
    targetCountry: 'United Kingdom',
    targetLanguage: 'English',
    correlationId: 'search-request:7:11:21:a4e38e3d-9d28-4e45-a5b5-409a488585d3',
  }]);
  assert.deepEqual(state.persistedInputs[0].settingsSnapshot, {
    version: 1,
    brand: {
      id: '11',
      name: 'Selecdoo',
      normalizedDomain: 'selecdoo.com',
    },
    location: {
      id: '21',
      countryCode: 'gb',
      countryName: 'United Kingdom',
      languageCode: 'en',
      languageName: 'English',
    },
    search: {
      keywords: ['affiliate software', 'creator tools'],
      competitors: ['example.com'],
      sources: ['Web', 'YouTube'],
      requestId: request.requestId,
      providerCorrelationId: 'search-request:7:11:21:a4e38e3d-9d28-4e45-a5b5-409a488585d3',
    },
  });
  assert.deepEqual(state.persistedInputs[0].userSettings, {
    targetCountry: 'United Kingdom',
    targetLanguage: 'English',
    userBrand: 'selecdoo.com',
    topics: ['affiliate software', 'creator tools'],
    competitors: ['example.com'],
  });
  assert.equal(state.persistedInputs[0].reservationKind, 'credit');
  assert.deepEqual(request, originalRequest);
});

test('explicit location ID is forwarded to the ownership resolver', async () => {
  let resolvedInput: unknown;
  const state = dependencies({
    resolveContext: async (input) => {
      resolvedInput = input;
      return context({ source: 'requested' });
    },
  });

  await startAttributedSearch(
    { ...request, requestedBrandLocationId: '9223372036854775807' },
    state.deps,
  );
  assert.deepEqual(resolvedInput, {
    accountId: 7,
    requestedBrandLocationId: '9223372036854775807',
  });
});

test('cross-account or missing locations fail before credit and provider calls', async () => {
  let reservations = 0;
  let providerCalls = 0;
  const state = dependencies({
    resolveContext: async () => {
      throw new BrandLocationContextError(
        'BRAND_LOCATION_NOT_FOUND',
        404,
        'Brand location was not found.',
      );
    },
    reserveCredit: async () => {
      reservations += 1;
      return { outcome: 'reserved' };
    },
    startProvider: async () => {
      providerCalls += 1;
      return { runId: 'unexpected' };
    },
  });

  await assert.rejects(
    startAttributedSearch(request, state.deps),
    (error: unknown) => error instanceof BrandLocationContextError
      && error.code === 'BRAND_LOCATION_NOT_FOUND',
  );
  assert.equal(reservations, 0);
  assert.equal(providerCalls, 0);
});

test('unconfigured and unsupported markets fail closed before paid work', async () => {
  const missing = dependencies({
    resolveContext: async () => context({
      location: { ...context().location, countryCode: null, languageCode: null },
    }),
  });
  await expectSearchError(
    () => startAttributedSearch(request, missing.deps),
    'BRAND_LOCATION_MARKET_REQUIRED',
    409,
  );
  assert.equal(missing.providerInputs.length, 0);

  const unsupported = dependencies({
    resolveContext: async () => context({
      location: { ...context().location, countryCode: 'zz', languageCode: 'en' },
    }),
  });
  await expectSearchError(
    () => startAttributedSearch(request, unsupported.deps),
    'BRAND_LOCATION_MARKET_UNSUPPORTED',
    500,
  );
  assert.equal(unsupported.providerInputs.length, 0);
});

test('insufficient credit stops before the provider and does not create a job', async () => {
  const state = dependencies({
    reserveCredit: async () => ({
      outcome: 'insufficient',
      message: 'No searches left.',
    }),
  });

  const error = await expectSearchError(
    () => startAttributedSearch(request, state.deps),
    'INSUFFICIENT_CREDITS',
    402,
  );
  assert.equal(error.message, 'No searches left.');
  assert.equal(state.providerInputs.length, 0);
  assert.equal(state.persistedInputs.length, 0);
  assert.equal(state.abortedRuns.length, 0);
});

test('onboarding search requires the one-time entitlement and snapshots its location', async () => {
  let reservations = 0;
  const state = dependencies({
    reserveCredit: async () => {
      reservations += 1;
      return { outcome: 'insufficient', message: 'No searches left.' };
    },
  });

  const result = await startAttributedSearch({
    ...request,
    isOnboarding: true,
    requestId: 'c8f5118a-dca1-4a7d-99b5-57f725c5b6c1',
  }, state.deps);

  assert.equal(result.jobId, 101);
  assert.equal(reservations, 0);
  assert.equal(state.onboardingReservationInputs.length, 1);
  assert.deepEqual(state.onboardingLaunchAttempts, [
    'c8f5118a-dca1-4a7d-99b5-57f725c5b6c1',
  ]);
  assert.equal(state.providerInputs.length, 1);
  assert.equal(state.persistedInputs[0].userSettings.isOnboarding, true);
  assert.equal(state.persistedInputs[0].settingsSnapshot.search.isOnboarding, true);
  assert.equal(state.persistedInputs[0].brandLocationId, '21');
  assert.equal(
    state.persistedInputs[0].reservationKind,
    'onboarding_entitlement',
  );
});

test('100 fresh onboarding UUIDs can launch only one provider run', async () => {
  let entitlementStatus: 'available' | 'reserved' | 'dispatching' | 'consumed' = 'available';
  let entitlementRequestId: string | null = null;
  let entitlementSnapshot: SearchSettingsSnapshot | null = null;
  let persistedJob: Awaited<ReturnType<SearchStartDependencies['findJobById']>> = null;
  let providerCalls = 0;
  let jobWrites = 0;
  const state = dependencies({
    reserveOnboardingSearch: async (input) => {
      if (entitlementStatus === 'available') {
        entitlementStatus = 'reserved';
        entitlementRequestId = input.requestId;
        entitlementSnapshot = input.settingsSnapshot;
        return { outcome: 'reserved' };
      }
      return {
        outcome: 'existing',
        status: entitlementStatus,
        requestId: entitlementRequestId,
        searchJobId: persistedJob?.id ?? null,
        settingsSnapshot: entitlementSnapshot,
      };
    },
    markOnboardingLaunchAttempted: async (_accountId, requestId) => {
      assert.equal(entitlementStatus, 'reserved');
      assert.equal(entitlementRequestId, requestId);
      entitlementStatus = 'dispatching';
    },
    startProvider: async () => ({ runId: `onboarding-run-${++providerCalls}` }),
    persistJobIfActive: async (input) => {
      assert.equal(entitlementStatus, 'dispatching');
      jobWrites += 1;
      entitlementStatus = 'consumed';
      persistedJob = {
        id: 501,
        runId: input.runId,
        brandId: input.brandId,
        brandLocationId: input.brandLocationId,
        settingsSnapshot: input.settingsSnapshot,
        created: true,
      };
      return persistedJob;
    },
    findJobById: async () => persistedJob,
  });

  const outcomes = await Promise.allSettled(
    Array.from({ length: 100 }, (_, index) => startAttributedSearch({
      ...request,
      isOnboarding: true,
      requestId: requestIdFor(index),
      keywords: [`onboarding-keyword-${index}`],
    }, state.deps)),
  );

  assert.equal(providerCalls, 1);
  assert.equal(jobWrites, 1);
  assert.equal(entitlementStatus, 'consumed');
  assert.ok(outcomes.some((outcome) => outcome.status === 'fulfilled'));
  assert.ok(outcomes.every((outcome) => {
    if (outcome.status === 'fulfilled') return outcome.value.jobId === 501;
    return outcome.reason instanceof SearchStartError
      && outcome.reason.code === 'SEARCH_START_IN_PROGRESS';
  }));
});

test('a fresh UUID after onboarding launch reuses the original job without paid work', async () => {
  const originalSnapshot: SearchSettingsSnapshot = {
    version: 1,
    brand: { id: '11', name: 'Selecdoo', normalizedDomain: 'selecdoo.com' },
    location: {
      id: '21',
      countryCode: 'gb',
      countryName: 'United Kingdom',
      languageCode: 'en',
      languageName: 'English',
    },
    search: {
      keywords: ['original onboarding topic'],
      competitors: [],
      sources: ['Web', 'YouTube'],
      requestId: '10000000-0000-4000-8000-000000000001',
      isOnboarding: true,
    },
  };
  let providerCalls = 0;
  const state = dependencies({
    reserveOnboardingSearch: async () => ({
      outcome: 'existing',
      status: 'consumed',
      requestId: originalSnapshot.search.requestId,
      searchJobId: 777,
      settingsSnapshot: originalSnapshot,
    }),
    findJobById: async () => ({
      id: 777,
      runId: 'original-onboarding-run',
      brandId: '11',
      brandLocationId: '21',
      settingsSnapshot: originalSnapshot,
      created: false,
    }),
    startProvider: async () => {
      providerCalls += 1;
      return { runId: 'unexpected' };
    },
  });

  const result = await startAttributedSearch({
    ...request,
    isOnboarding: true,
    requestId: '20000000-0000-4000-8000-000000000002',
    keywords: ['different retry payload'],
  }, state.deps);

  assert.equal(result.jobId, 777);
  assert.equal(result.runId, 'original-onboarding-run');
  assert.equal(result.reused, true);
  assert.equal(providerCalls, 0);
});

test('normal and onboarding starts sharing one UUID compensate the losing run exactly once', async () => {
  let nextRun = 0;
  let durableJob: Awaited<ReturnType<SearchStartDependencies['findJobById']>> = null;
  const state = dependencies({
    startProvider: async () => ({ runId: `cross-mode-run-${++nextRun}` }),
    persistJobIfActive: async (input) => {
      if (!durableJob) {
        durableJob = {
          id: 778,
          runId: input.runId,
          brandId: input.brandId,
          brandLocationId: input.brandLocationId,
          settingsSnapshot: input.settingsSnapshot,
          created: true,
        };
        return durableJob;
      }
      return { ...durableJob, created: false };
    },
  });

  const outcomes = await Promise.allSettled([
    startAttributedSearch(request, state.deps),
    startAttributedSearch({ ...request, isOnboarding: true }, state.deps),
  ]);

  assert.equal(nextRun, 2);
  assert.equal(outcomes.filter(({ status }) => status === 'fulfilled').length, 1);
  assert.equal(outcomes.filter(({ status }) => status === 'rejected').length, 1);
  const rejected = outcomes.find(({ status }) => status === 'rejected');
  assert.ok(rejected?.status === 'rejected');
  assert.ok(rejected.reason instanceof SearchStartError);
  assert.equal(rejected.reason.code, 'SEARCH_REQUEST_CONFLICT');
  assert.equal(state.abortedRuns.length, 1);
  assert.equal(new Set(state.abortedRuns).size, 1);
  assert.equal(state.uncertainOnboardingRequests.length, 0);
});

test('failure to persist onboarding launch intent makes zero provider calls and releases the claim', async () => {
  const state = dependencies({
    markOnboardingLaunchAttempted: async () => {
      throw new Error('database unavailable before launch');
    },
  });

  await assert.rejects(
    startAttributedSearch({ ...request, isOnboarding: true }, state.deps),
    /database unavailable before launch/,
  );
  assert.equal(state.providerInputs.length, 0);
  assert.deepEqual(state.releasedOnboardingRequests, [request.requestId]);
});

test('known pre-launch onboarding provider failure releases the entitlement', async () => {
  const state = dependencies({
    startProvider: async () => {
      throw new SearchProviderStartError('Provider is not configured.', false);
    },
  });

  await assert.rejects(
    startAttributedSearch({ ...request, isOnboarding: true }, state.deps),
    /Provider is not configured/,
  );
  assert.deepEqual(state.releasedOnboardingRequests, [request.requestId]);
  assert.equal(state.uncertainOnboardingRequests.length, 0);
});

test('ambiguous onboarding provider failure becomes uncertain and cannot relaunch', async () => {
  let status: 'available' | 'reserved' | 'dispatching' | 'uncertain' = 'available';
  let claimedRequestId: string | null = null;
  let claimedSnapshot: SearchSettingsSnapshot | null = null;
  let providerCalls = 0;
  const state = dependencies({
    reserveOnboardingSearch: async (input) => {
      if (status === 'available') {
        status = 'reserved';
        claimedRequestId = input.requestId;
        claimedSnapshot = input.settingsSnapshot;
        return { outcome: 'reserved' };
      }
      return {
        outcome: 'existing',
        status,
        requestId: claimedRequestId,
        searchJobId: null,
        settingsSnapshot: claimedSnapshot,
      };
    },
    markOnboardingLaunchAttempted: async () => {
      status = 'dispatching';
    },
    startProvider: async () => {
      providerCalls += 1;
      throw new SearchProviderStartError('Start response was lost.', true);
    },
    markOnboardingSearchUncertain: async () => {
      status = 'uncertain';
    },
  });

  await expectSearchError(
    () => startAttributedSearch({ ...request, isOnboarding: true }, state.deps),
    'ONBOARDING_SEARCH_REQUIRES_REVIEW',
    503,
  );
  await expectSearchError(
    () => startAttributedSearch({
      ...request,
      isOnboarding: true,
      requestId: '30000000-0000-4000-8000-000000000003',
    }, state.deps),
    'ONBOARDING_SEARCH_REQUIRES_REVIEW',
    503,
  );
  assert.equal(providerCalls, 1);
  assert.equal(status, 'uncertain');
});

test('onboarding persistence failure aborts the run and releases only after confirmed abort', async () => {
  const state = dependencies({
    persistJobIfActive: async () => {
      throw new Error('database unavailable after launch');
    },
  });

  await assert.rejects(
    startAttributedSearch({ ...request, isOnboarding: true }, state.deps),
    /database unavailable after launch/,
  );
  assert.deepEqual(state.abortedRuns, ['run-1']);
  assert.deepEqual(state.releasedOnboardingRequests, [request.requestId]);
});

test('unconfirmed onboarding abort remains fail-closed as uncertain', async () => {
  const state = dependencies({
    persistJobIfActive: async () => {
      throw new Error('database unavailable after launch');
    },
    abortProvider: async () => {
      throw new Error('abort response unavailable');
    },
  });

  await expectSearchError(
    () => startAttributedSearch({ ...request, isOnboarding: true }, state.deps),
    'SEARCH_START_CLEANUP_FAILED',
    500,
  );
  assert.deepEqual(state.uncertainOnboardingRequests, [request.requestId]);
  assert.equal(state.releasedOnboardingRequests.length, 0);
});

test('archival during provider launch aborts the run and leaves no job', async () => {
  const state = dependencies({ persistJobIfActive: async () => null });

  await expectSearchError(
    () => startAttributedSearch(request, state.deps),
    'BRAND_LOCATION_CHANGED',
    409,
  );
  assert.deepEqual(state.abortedRuns, ['run-1']);
  assert.deepEqual(state.releasedRequests, [request.requestId]);
});

test('changing the default selection does not reassign an in-flight explicit snapshot', async () => {
  const state = dependencies({
    resolveContext: async () => context({ source: 'requested' }),
  });

  const result = await startAttributedSearch(
    { ...request, requestedBrandLocationId: '21' },
    state.deps,
  );
  assert.equal(result.brandLocationId, '21');
  assert.equal(state.persistedInputs[0].brandLocationId, '21');
  assert.equal(state.persistedInputs[0].settingsSnapshot.location.id, '21');
});

test('definite pre-launch provider failure releases the reservation and a new request can succeed', async () => {
  let attempt = 0;
  const state = dependencies({
    startProvider: async () => {
      attempt += 1;
      if (attempt === 1) {
        throw new SearchProviderStartError('provider unavailable', false);
      }
      return { runId: 'run-retry' };
    },
  });

  await assert.rejects(
    startAttributedSearch(request, state.deps),
    /provider unavailable/,
  );
  assert.equal(state.persistedInputs.length, 0);
  assert.equal(state.abortedRuns.length, 0);
  assert.deepEqual(state.releasedRequests, [request.requestId]);

  const result = await startAttributedSearch({
    ...request,
    requestId: 'b4e38e3d-9d28-4e45-a5b5-409a488585d3',
  }, state.deps);
  assert.equal(result.runId, 'run-retry');
  assert.equal(state.persistedInputs.length, 1);
});

test('ambiguous paid provider failure is held for review and never refunded', async () => {
  const state = dependencies({
    startProvider: async () => {
      throw new SearchProviderStartError('start response was lost', true);
    },
  });

  await expectSearchError(
    () => startAttributedSearch(request, state.deps),
    'SEARCH_REQUIRES_REVIEW',
    503,
  );
  assert.deepEqual(state.paidLaunchAttempts, [request.requestId]);
  assert.deepEqual(state.uncertainPaidRequests, [request.requestId]);
  assert.deepEqual(state.releasedRequests, []);
  assert.equal(state.persistedInputs.length, 0);
});

test('unknown paid launch error fails closed because provider start cannot be disproven', async () => {
  const state = dependencies({
    startProvider: async () => {
      throw new Error('network connection ended without a response');
    },
  });

  await expectSearchError(
    () => startAttributedSearch(request, state.deps),
    'SEARCH_REQUIRES_REVIEW',
    503,
  );
  assert.deepEqual(state.uncertainPaidRequests, [request.requestId]);
  assert.deepEqual(state.releasedRequests, []);
});

test('paid provider is never called when durable launch intent cannot be recorded', async () => {
  let providerCalls = 0;
  const state = dependencies({
    markSearchLaunchAttempted: async () => {
      throw new Error('database unavailable before launch');
    },
    startProvider: async () => {
      providerCalls += 1;
      return { runId: 'unexpected' };
    },
  });

  await assert.rejects(
    startAttributedSearch(request, state.deps),
    /database unavailable before launch/,
  );
  assert.equal(providerCalls, 0);
  assert.deepEqual(state.releasedRequests, [request.requestId]);
});

test('an empty paid provider run ID is ambiguous and is not refunded', async () => {
  const state = dependencies({
    startProvider: async () => ({ runId: '' }),
  });

  await expectSearchError(
    () => startAttributedSearch(request, state.deps),
    'SEARCH_REQUIRES_REVIEW',
    503,
  );
  assert.deepEqual(state.uncertainPaidRequests, [request.requestId]);
  assert.deepEqual(state.releasedRequests, []);
});

test('an invalid non-empty provider run ID is aborted before persistence', async () => {
  const state = dependencies({
    startProvider: async () => ({ runId: 'invalid\nrun' }),
  });

  await expectSearchError(
    () => startAttributedSearch(request, state.deps),
    'INVALID_PROVIDER_RUN',
    502,
  );
  assert.deepEqual(state.abortedRuns, ['invalid\nrun']);
  assert.deepEqual(state.releasedRequests, [request.requestId]);
  assert.equal(state.persistedInputs.length, 0);
});

test('an existing matching request ID returns the original job without paid work', async () => {
  const requestWithId = {
    ...request,
    requestId: 'a4e38e3d-9d28-4e45-a5b5-409a488585d3',
  };
  const expectedSnapshot: SearchSettingsSnapshot = {
    version: 1,
    brand: {
      id: '11',
      name: 'Selecdoo',
      normalizedDomain: 'selecdoo.com',
    },
    location: {
      id: '21',
      countryCode: 'gb',
      countryName: 'United Kingdom',
      languageCode: 'en',
      languageName: 'English',
    },
    search: {
      keywords: ['affiliate software', 'creator tools'],
      competitors: ['example.com'],
      sources: ['Web', 'YouTube'],
      requestId: requestWithId.requestId,
    },
  };
  let reservations = 0;
  const state = dependencies({
    findJobByRequestId: async () => ({
      id: 88,
      runId: 'original-run',
      brandId: '11',
      brandLocationId: '21',
      settingsSnapshot: expectedSnapshot,
      created: false,
    }),
    reserveCredit: async () => {
      reservations += 1;
      return { outcome: 'reserved' };
    },
  });

  const result = await startAttributedSearch(requestWithId, state.deps);
  assert.equal(result.jobId, 88);
  assert.equal(result.runId, 'original-run');
  assert.equal(result.reused, true);
  assert.equal(reservations, 0);
  assert.equal(state.providerInputs.length, 0);
  assert.equal(state.persistedInputs.length, 0);
});

test('an in-progress duplicate is rejected before any extra provider run', async () => {
  const requestWithId = {
    ...request,
    requestId: 'a4e38e3d-9d28-4e45-a5b5-409a488585d3',
  };
  const state = dependencies({
    reserveCredit: async () => ({
      outcome: 'existing',
      status: 'reserved',
      searchJobId: null,
      settingsSnapshot: {
        version: 1,
        brand: { id: '11', name: 'Selecdoo', normalizedDomain: 'selecdoo.com' },
        location: {
          id: '21',
          countryCode: 'gb',
          countryName: 'United Kingdom',
          languageCode: 'en',
          languageName: 'English',
        },
        search: {
          keywords: ['affiliate software', 'creator tools'],
          competitors: ['example.com'],
          sources: ['Web', 'YouTube'],
          requestId: requestWithId.requestId,
        },
      },
    }),
  });

  await expectSearchError(
    () => startAttributedSearch(requestWithId, state.deps),
    'SEARCH_START_IN_PROGRESS',
    409,
  );
  assert.equal(state.providerInputs.length, 0);
  assert.equal(state.persistedInputs.length, 0);
});

test('reusing a request ID with different settings fails closed', async () => {
  const state = dependencies({
    findJobByRequestId: async () => ({
      id: 88,
      runId: 'original-run',
      brandId: '11',
      brandLocationId: '21',
      settingsSnapshot: {
        version: 1,
        brand: { id: '11', name: 'Selecdoo', normalizedDomain: 'selecdoo.com' },
        location: {
          id: '21',
          countryCode: 'gb',
          countryName: 'United Kingdom',
          languageCode: 'en',
          languageName: 'English',
        },
        search: {
          keywords: ['different'],
          competitors: [],
          sources: ['Web'],
          requestId: 'a4e38e3d-9d28-4e45-a5b5-409a488585d3',
        },
      },
      created: false,
    }),
  });

  await expectSearchError(
    () => startAttributedSearch({
      ...request,
      requestId: 'a4e38e3d-9d28-4e45-a5b5-409a488585d3',
    }, state.deps),
    'SEARCH_REQUEST_CONFLICT',
    409,
  );
  assert.equal(state.providerInputs.length, 0);
});

test('database failure aborts the paid run and preserves the original error', async () => {
  const databaseError = new Error('database unavailable');
  const state = dependencies({
    persistJobIfActive: async () => {
      throw databaseError;
    },
  });

  await assert.rejects(
    startAttributedSearch(request, state.deps),
    (error: unknown) => error === databaseError,
  );
  assert.deepEqual(state.abortedRuns, ['run-1']);
  assert.deepEqual(state.releasedRequests, [request.requestId]);
});

test('failed compensation reports both the persistence and cancellation failures', async () => {
  const databaseError = new Error('database unavailable');
  const cancellationError = new Error('provider abort unavailable');
  const state = dependencies({
    persistJobIfActive: async () => {
      throw databaseError;
    },
    abortProvider: async () => {
      throw cancellationError;
    },
  });

  const error = await expectSearchError(
    () => startAttributedSearch(request, state.deps),
    'SEARCH_START_CLEANUP_FAILED',
    500,
  );
  assert.equal(error.originalError, databaseError);
  assert.equal(error.cleanupError, cancellationError);
  assert.deepEqual(state.releasedRequests, []);
  assert.deepEqual(state.uncertainPaidRequests, [request.requestId]);
});

test('100 concurrent paid starts with one credit launch exactly one provider run', async () => {
  let reservationWon = false;
  let providerCalls = 0;
  const state = dependencies({
    reserveCredit: async () => {
      if (!reservationWon) {
        reservationWon = true;
        return { outcome: 'reserved' };
      }
      return { outcome: 'insufficient', message: 'No searches left.' };
    },
    startProvider: async () => ({ runId: `run-${++providerCalls}` }),
  });

  const outcomes = await Promise.allSettled(
    Array.from({ length: 100 }, (_, index) => startAttributedSearch(
      {
        ...request,
        requestId: requestIdFor(index),
        keywords: [`keyword-${index}`],
      },
      state.deps,
    )),
  );

  assert.equal(outcomes.filter(({ status }) => status === 'fulfilled').length, 1);
  assert.equal(outcomes.filter(({ status }) => status === 'rejected').length, 99);
  assert.equal(providerCalls, 1);
  assert.equal(state.persistedInputs.length, 1);
});

test('100 concurrent starts keep provider runs, jobs and snapshots isolated', async () => {
  let nextRun = 0;
  let nextJob = 0;
  const persisted = new Map<string, PersistSearchJobInput>();
  const state = dependencies({
    startProvider: async () => ({ runId: `run-${++nextRun}` }),
    persistJobIfActive: async (input) => {
      persisted.set(input.runId, input);
      return {
        id: ++nextJob,
        runId: input.runId,
        brandId: input.brandId,
        brandLocationId: input.brandLocationId,
        settingsSnapshot: input.settingsSnapshot,
        created: true,
      };
    },
  });

  const results = await Promise.all(
    Array.from({ length: 100 }, (_, index) => startAttributedSearch(
      {
        ...request,
        requestId: requestIdFor(index),
        keywords: [`keyword-${index}`],
      },
      state.deps,
    )),
  );

  assert.equal(new Set(results.map(({ runId }) => runId)).size, 100);
  assert.equal(new Set(results.map(({ jobId }) => jobId)).size, 100);
  assert.equal(persisted.size, 100);
  for (let index = 0; index < 100; index += 1) {
    const result = results[index];
    assert.deepEqual(
      persisted.get(result.runId)?.settingsSnapshot.search.keywords,
      [`keyword-${index}`],
    );
  }
});
