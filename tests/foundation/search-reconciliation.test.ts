import assert from 'node:assert/strict';
import test from 'node:test';
import { isSameOriginMutation } from '../../src/lib/auth/request-origin';
import { APIFY_ACTOR_IDS } from '../../src/lib/search/apify-actors';
import {
  buildEnrichmentProviderInput,
  buildGoogleProviderInput,
  enrichmentProviderCorrelationId,
  scopedSearchProviderCorrelationId,
  searchProviderCorrelationId,
} from '../../src/lib/search/provider-input';
import {
  assertActionAllowed,
  jsonFingerprint,
  ReconciliationConflictError,
  ReconciliationInputError,
  ReconciliationProviderError,
  resolveReconciliationSchema,
  type SearchReconciliationCase,
} from '../../src/lib/search/reconciliation';
import { validateProviderRunForCase } from '../../src/lib/search/reconciliation-provider-validation';

const launchTime = '2026-09-02T08:00:00.000Z';

function enrichmentCase(
  overrides: Partial<SearchReconciliationCase> = {},
): SearchReconciliationCase {
  return {
    id: '31',
    caseType: 'enrichment_dispatch',
    status: 'open',
    version: 1,
    accountId: 7,
    accountEmail: 'customer@example.com',
    brandId: '11',
    brandLocationId: '12',
    searchJobId: 19,
    dispatchId: '23',
    platform: 'youtube',
    requestId: null,
    sourceStatus: 'uncertain',
    sourceErrorMessage: 'Provider did not return a durable response.',
    sourceLaunchAttemptedAt: launchTime,
    inputUrls: ['https://www.youtube.com/watch?v=abc123'],
    inputFingerprint: 'a'.repeat(64),
    canAttachProviderRun: true,
    canCancelAndRefund: true,
    settingsSnapshot: null,
    detectedAt: '2026-09-02T08:03:00.000Z',
    resolvedAt: null,
    resolution: null,
    resolutionNote: null,
    providerRunId: null,
    resolvedByEmail: null,
    ...overrides,
  };
}

function onboardingCase(
  overrides: Partial<SearchReconciliationCase> = {},
): SearchReconciliationCase {
  return enrichmentCase({
    caseType: 'onboarding_search',
    searchJobId: null,
    dispatchId: null,
    platform: null,
    requestId: '18ceee4d-9a14-4bb9-98ac-3ec6ee735778',
    inputUrls: null,
    inputFingerprint: null,
    settingsSnapshot: {
      version: 1,
      brand: { id: '11', name: 'Selekdoo', normalizedDomain: 'selekdoo.com' },
      location: {
        id: '12',
        countryCode: 'DE',
        countryName: 'Germany',
        languageCode: 'de',
        languageName: 'German',
      },
      search: {
        keywords: ['affiliate marketing'],
        competitors: ['competitor.example'],
        sources: ['Web', 'YouTube', 'Instagram', 'TikTok'],
        requestId: '18ceee4d-9a14-4bb9-98ac-3ec6ee735778',
        isOnboarding: true,
      },
    },
    ...overrides,
  });
}

function paidSearchCase(
  overrides: Partial<SearchReconciliationCase> = {},
): SearchReconciliationCase {
  const onboarding = onboardingCase();
  const requestId = onboarding.requestId!;
  return onboardingCase({
    caseType: 'paid_search',
    canCancelAndRefund: false,
    settingsSnapshot: {
      ...onboarding.settingsSnapshot!,
      search: {
        ...onboarding.settingsSnapshot!.search,
        providerCorrelationId: scopedSearchProviderCorrelationId({
          accountId: onboarding.accountId,
          brandId: onboarding.brandId,
          brandLocationId: onboarding.brandLocationId,
          requestId,
        }),
        isOnboarding: undefined,
      },
    },
    ...overrides,
  });
}

test('resolution input is strict and binds provider IDs to attach actions', () => {
  assert.equal(resolveReconciliationSchema.safeParse({
    action: 'attach_provider_run',
    expectedVersion: 1,
    note: 'Verified in the provider console.',
    confirmation: 'ATTACH VERIFIED RUN',
  }).success, false);
  assert.equal(resolveReconciliationSchema.safeParse({
    action: 'confirm_no_run',
    expectedVersion: 1,
    note: 'No matching run exists in the provider console.',
    providerRunId: 'should-not-be-accepted',
    confirmation: 'CONFIRM NO RUN',
  }).success, false);
  assert.equal(resolveReconciliationSchema.safeParse({
    action: 'confirm_no_run',
    expectedVersion: 1,
    note: 'No matching run exists in the provider console.',
    confirmation: 'CONFIRM NO RUN',
    unexpected: true,
  }).success, false);
});

test('resolution requires the current version and exact confirmation phrase', () => {
  const valid = resolveReconciliationSchema.parse({
    action: 'confirm_no_run',
    expectedVersion: 1,
    note: 'No matching run exists in the provider console.',
    confirmation: 'CONFIRM NO RUN',
  });
  assert.doesNotThrow(() => assertActionAllowed(enrichmentCase(), valid));
  assert.throws(
    () => assertActionAllowed(enrichmentCase({ version: 2 }), valid),
    ReconciliationConflictError,
  );
  assert.throws(
    () => assertActionAllowed(enrichmentCase({ status: 'resolved' }), valid),
    ReconciliationConflictError,
  );
  assert.throws(
    () => assertActionAllowed(enrichmentCase(), { ...valid, confirmation: 'yes' }),
    ReconciliationInputError,
  );
});

test('onboarding cases cannot use the normal-search refund action', () => {
  const input = resolveReconciliationSchema.parse({
    action: 'cancel_and_refund',
    expectedVersion: 1,
    note: 'Customer requested that this search be cancelled.',
    confirmation: 'CANCEL AND REFUND',
  });
  assert.throws(
    () => assertActionAllowed(onboardingCase(), input),
    /no topic-search credit to refund/,
  );
});

test('ambiguous paid starts require confirm-no-run instead of an unchecked refund', () => {
  const input = resolveReconciliationSchema.parse({
    action: 'cancel_and_refund',
    expectedVersion: 1,
    note: 'Customer requested that this search be cancelled.',
    confirmation: 'CANCEL AND REFUND',
  });
  assert.throws(
    () => assertActionAllowed(paidSearchCase(), input),
    /confirm-no-run/,
  );
});

test('normal searches cannot claim a refund without a reserved credit', () => {
  const input = resolveReconciliationSchema.parse({
    action: 'cancel_and_refund',
    expectedVersion: 1,
    note: 'The operator verified the accounting state.',
    confirmation: 'CANCEL AND REFUND',
  });
  assert.throws(
    () => assertActionAllowed(enrichmentCase({ canCancelAndRefund: false }), input),
    /no reserved topic-search credit/,
  );
});

test('operator mutations reject missing, malformed, and cross-origin origins', () => {
  assert.equal(isSameOriginMutation(null, 'https://staging.example.com'), false);
  assert.equal(isSameOriginMutation('not-a-url', 'https://staging.example.com'), false);
  assert.equal(
    isSameOriginMutation('https://evil.example', 'https://staging.example.com'),
    false,
  );
  assert.equal(
    isSameOriginMutation('https://staging.example.com', 'https://staging.example.com/path'),
    true,
  );
});

test('JSON fingerprints are stable across object key order but not value changes', () => {
  assert.equal(jsonFingerprint({ a: 1, b: [2, 3] }), jsonFingerprint({ b: [2, 3], a: 1 }));
  assert.notEqual(jsonFingerprint({ a: 1 }), jsonFingerprint({ a: 2 }));
});

test('enrichment attachment requires exact actor, input, and launch window', () => {
  const reconciliationCase = enrichmentCase();
  const inspected = {
    id: 'provider-run-1',
    actorId: APIFY_ACTOR_IDS.youtubeEnrichment,
    status: 'RUNNING',
    startedAt: '2026-09-02T08:00:20.000Z',
    input: buildEnrichmentProviderInput(
      'youtube',
      reconciliationCase.inputUrls!,
      enrichmentProviderCorrelationId(reconciliationCase.dispatchId!),
    ),
  };
  assert.equal(validateProviderRunForCase(reconciliationCase, inspected).id, inspected.id);
  assert.throws(
    () => validateProviderRunForCase(reconciliationCase, {
      ...inspected,
      actorId: APIFY_ACTOR_IDS.tiktokEnrichment,
    }),
    ReconciliationProviderError,
  );
  assert.throws(
    () => validateProviderRunForCase(reconciliationCase, {
      ...inspected,
      input: buildEnrichmentProviderInput(
        'youtube',
        ['https://youtu.be/different'],
        enrichmentProviderCorrelationId(reconciliationCase.dispatchId!),
      ),
    }),
    /does not match this account/,
  );
  assert.throws(
    () => validateProviderRunForCase(reconciliationCase, {
      ...inspected,
      input: buildEnrichmentProviderInput(
        'youtube',
        reconciliationCase.inputUrls!,
        enrichmentProviderCorrelationId('24'),
      ),
    }),
    /does not match this account/,
  );
  assert.throws(
    () => validateProviderRunForCase(reconciliationCase, {
      ...inspected,
      startedAt: '2026-09-02T09:00:00.000Z',
    }),
    /outside this launch attempt/,
  );
});

test('onboarding attachment requires the exact frozen search input', () => {
  const reconciliationCase = onboardingCase();
  const snapshot = reconciliationCase.settingsSnapshot!;
  const inspected = {
    id: 'provider-run-2',
    actorId: APIFY_ACTOR_IDS.googleSearch,
    status: 'SUCCEEDED',
    startedAt: '2026-09-02T08:01:00.000Z',
    input: buildGoogleProviderInput({
      keywords: snapshot.search.keywords,
      competitors: snapshot.search.competitors,
      sources: snapshot.search.sources,
      targetCountry: snapshot.location.countryName,
      targetLanguage: snapshot.location.languageName,
      correlationId: searchProviderCorrelationId(snapshot.search.requestId!),
    }),
  };
  assert.equal(validateProviderRunForCase(reconciliationCase, inspected).id, inspected.id);
  assert.throws(
    () => validateProviderRunForCase(reconciliationCase, {
      ...inspected,
      input: { ...inspected.input, countryCode: 'us' },
    }),
    /does not match this account/,
  );
});

test('paid-search attachment requires the exact frozen search input', () => {
  const reconciliationCase = paidSearchCase();
  const snapshot = reconciliationCase.settingsSnapshot!;
  const inspected = {
    id: 'provider-run-paid',
    actorId: APIFY_ACTOR_IDS.googleSearch,
    status: 'RUNNING',
    startedAt: '2026-09-02T08:01:00.000Z',
    input: buildGoogleProviderInput({
      keywords: snapshot.search.keywords,
      competitors: snapshot.search.competitors,
      sources: snapshot.search.sources,
      targetCountry: snapshot.location.countryName,
      targetLanguage: snapshot.location.languageName,
      correlationId: snapshot.search.providerCorrelationId!,
    }),
  };
  assert.equal(validateProviderRunForCase(reconciliationCase, inspected).id, inspected.id);
  assert.throws(
    () => validateProviderRunForCase(reconciliationCase, {
      ...inspected,
      input: { ...inspected.input, languageCode: 'fr' },
    }),
    /does not match this account/,
  );
  assert.throws(
    () => validateProviderRunForCase(reconciliationCase, {
      ...inspected,
      input: {
        ...inspected.input,
        affiliateFinderCorrelationId: scopedSearchProviderCorrelationId({
          accountId: 8,
          brandId: snapshot.brand.id,
          brandLocationId: snapshot.location.id,
          requestId: snapshot.search.requestId!,
        }),
      },
    }),
    /does not match this account/,
  );
  assert.throws(
    () => validateProviderRunForCase(
      paidSearchCase({
        canAttachProviderRun: false,
        settingsSnapshot: {
          ...snapshot,
          search: { ...snapshot.search, providerCorrelationId: undefined },
        },
      }),
      inspected,
    ),
    /cannot be attached safely/,
  );
  assert.throws(
    () => validateProviderRunForCase(
      paidSearchCase({
        settingsSnapshot: {
          ...snapshot,
          search: { ...snapshot.search, isOnboarding: true },
        },
      }),
      inspected,
    ),
    /not a paid search/,
  );
});

test('onboarding snapshots require keywords and sources but allow no competitors', () => {
  const base = onboardingCase().settingsSnapshot!;
  assert.equal(resolveReconciliationSchema.safeParse({
    action: 'confirm_no_run',
    expectedVersion: 1,
    note: 'No provider run exists for this search.',
    confirmation: 'CONFIRM NO RUN',
  }).success, true);
  assert.throws(
    () => validateProviderRunForCase(
      onboardingCase({
        settingsSnapshot: {
          ...base,
          search: { ...base.search, keywords: [] },
        },
      }),
      {
        id: 'provider-run-empty-keywords',
        actorId: APIFY_ACTOR_IDS.googleSearch,
        status: 'RUNNING',
        startedAt: launchTime,
        input: {},
      },
    ),
    /keywords must be a non-empty string array/,
  );
});
