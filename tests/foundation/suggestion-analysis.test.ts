import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
  fingerprintSuggestionAnalysis,
  runOnboardingSuggestionAnalysis,
  SuggestionAnalysisError,
  type SuggestionAnalysisClaimInput,
  type SuggestionAnalysisDependencies,
  type SuggestionAnalysisInput,
} from '../../src/lib/suggestions/analysis';
import type { SuggestionAnalysisResult } from '../../src/lib/suggestions/result';

const input: SuggestionAnalysisInput = {
  normalizedDomain: 'selecdoo.com',
  targetCountry: 'Germany',
  targetLanguage: 'German',
};

const result: SuggestionAnalysisResult = {
  competitors: [{ name: 'Competitor', domain: 'competitor.example' }],
  topics: [{ keyword: 'Affiliate Software' }],
  industry: 'Affiliate marketing',
  targetAudience: 'Affiliate managers',
};

interface StoredAnalysis {
  accountId: number;
  authUserId: string;
  requestId: string;
  inputHash: string;
  status: 'reserved' | 'running' | 'completed' | 'failed';
  result: SuggestionAnalysisResult | null;
}

function createDependencies(options: {
  eligible?: boolean;
  providerOutcome?: Awaited<ReturnType<SuggestionAnalysisDependencies['runProviders']>>;
  providerGate?: Promise<void>;
  completionError?: Error;
} = {}) {
  let stored: StoredAnalysis | null = null;
  let providerCalls = 0;

  const dependencies: SuggestionAnalysisDependencies = {
    async claim(claim: SuggestionAnalysisClaimInput) {
      if (options.eligible === false) {
        return { outcome: 'blocked', reason: 'account_not_eligible' };
      }
      if (!stored) {
        stored = {
          accountId: claim.accountId,
          authUserId: claim.authUserId,
          requestId: claim.requestId,
          inputHash: claim.inputHash,
          status: 'reserved',
          result: null,
        };
        return { outcome: 'claimed' };
      }
      if (stored.authUserId === claim.authUserId && stored.accountId !== claim.accountId) {
        return { outcome: 'blocked', reason: 'already_used' };
      }
      if (stored.authUserId !== claim.authUserId || stored.accountId !== claim.accountId) {
        return { outcome: 'blocked', reason: 'account_not_eligible' };
      }
      if (stored.inputHash !== claim.inputHash) {
        return { outcome: 'blocked', reason: 'already_used' };
      }
      if (stored.status === 'completed' && stored.result) {
        return { outcome: 'cached', result: stored.result };
      }
      return {
        outcome: 'blocked',
        reason: stored.status === 'reserved' || stored.status === 'running'
          ? 'in_progress'
          : 'already_used',
      };
    },
    async markProvidersStarted(_accountId, requestId, inputHash) {
      assert.ok(stored);
      assert.equal(stored.requestId, requestId);
      assert.equal(stored.inputHash, inputHash);
      assert.equal(stored.status, 'reserved');
      stored = { ...stored, status: 'running' };
    },
    async runProviders() {
      providerCalls += 1;
      if (options.providerGate) await options.providerGate;
      return options.providerOutcome ?? { success: true, result };
    },
    async complete(_accountId, requestId, inputHash, completedResult) {
      if (options.completionError) throw options.completionError;
      assert.ok(stored);
      assert.equal(stored.requestId, requestId);
      assert.equal(stored.inputHash, inputHash);
      assert.equal(stored.status, 'running');
      stored = { ...stored, status: 'completed', result: completedResult };
    },
    async fail(_accountId, requestId, inputHash) {
      assert.ok(stored);
      assert.equal(stored.requestId, requestId);
      assert.equal(stored.inputHash, inputHash);
      assert.equal(stored.status, 'running');
      stored = { ...stored, status: 'failed' };
    },
  };

  return {
    dependencies,
    getProviderCalls: () => providerCalls,
    getStored: () => stored as StoredAnalysis | null,
  };
}

function request(requestInput: SuggestionAnalysisInput = input) {
  return {
    accountId: 42,
    authUserId: '5e034257-96f6-4b70-8394-c7be3f6616d5',
    requestId: randomUUID(),
    input: requestInput,
  };
}

function expectAnalysisError(
  error: unknown,
  code: SuggestionAnalysisError['code'],
): boolean {
  assert.ok(error instanceof SuggestionAnalysisError);
  assert.equal(error.code, code);
  return true;
}

test('analysis fingerprints are stable for exact normalized inputs and separate market changes', () => {
  assert.equal(fingerprintSuggestionAnalysis(input), fingerprintSuggestionAnalysis({ ...input }));
  assert.notEqual(
    fingerprintSuggestionAnalysis(input),
    fingerprintSuggestionAnalysis({ ...input, targetCountry: 'United Kingdom' }),
  );
  assert.notEqual(
    fingerprintSuggestionAnalysis(input),
    fingerprintSuggestionAnalysis({ ...input, normalizedDomain: 'revenue.works' }),
  );
});

test('an exact completed retry returns the stored result without another provider call', async () => {
  const harness = createDependencies();
  const first = await runOnboardingSuggestionAnalysis(request(), harness.dependencies);
  const second = await runOnboardingSuggestionAnalysis(request(), harness.dependencies);

  assert.deepEqual(first, { success: true, result, cached: false });
  assert.deepEqual(second, { success: true, result, cached: true });
  assert.equal(harness.getProviderCalls(), 1);
});

test('100 concurrent requests can start only one paid provider chain', async () => {
  let releaseProvider!: () => void;
  const providerGate = new Promise<void>((resolve) => {
    releaseProvider = resolve;
  });
  const harness = createDependencies({ providerGate });
  const attempts = Array.from({ length: 100 }, () =>
    runOnboardingSuggestionAnalysis(request(), harness.dependencies).then(
      (value) => ({ status: 'fulfilled' as const, value }),
      (reason: unknown) => ({ status: 'rejected' as const, reason }),
    ));

  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(harness.getProviderCalls(), 1);
  releaseProvider();

  const settled = await Promise.all(attempts);
  assert.equal(settled.filter((entry) => entry.status === 'fulfilled').length, 1);
  const rejected = settled.filter((entry) => entry.status === 'rejected');
  assert.equal(rejected.length, 99);
  for (const entry of rejected) {
    expectAnalysisError(entry.reason, 'ANALYSIS_IN_PROGRESS');
  }
  assert.equal(harness.getProviderCalls(), 1);
});

test('a different website or market cannot spend a second onboarding analysis', async () => {
  const harness = createDependencies();
  await runOnboardingSuggestionAnalysis(request(), harness.dependencies);

  await assert.rejects(
    runOnboardingSuggestionAnalysis(
      request({ ...input, targetLanguage: 'English' }),
      harness.dependencies,
    ),
    (error) => expectAnalysisError(error, 'ANALYSIS_ALREADY_USED'),
  );
  assert.equal(harness.getProviderCalls(), 1);
});

test('the same immutable auth identity cannot spend again through a new application account', async () => {
  const harness = createDependencies();
  const first = request();
  await runOnboardingSuggestionAnalysis(first, harness.dependencies);

  await assert.rejects(
    runOnboardingSuggestionAnalysis(
      { ...request(), accountId: 43, authUserId: first.authUserId },
      harness.dependencies,
    ),
    (error) => expectAnalysisError(error, 'ANALYSIS_ALREADY_USED'),
  );
  assert.equal(harness.getProviderCalls(), 1);
});

test('an ineligible application account never reaches a paid provider', async () => {
  const harness = createDependencies({ eligible: false });
  await assert.rejects(
    runOnboardingSuggestionAnalysis(request(), harness.dependencies),
    (error) => expectAnalysisError(error, 'ACCOUNT_NOT_ELIGIBLE'),
  );
  assert.equal(harness.getProviderCalls(), 0);
});

test('provider failure is terminal and exact retry cannot spend again', async () => {
  const providerOutcome = {
    success: false as const,
    error: 'Failed to scrape website',
    userMessage: 'Enter details manually.',
  };
  const harness = createDependencies({ providerOutcome });
  const first = await runOnboardingSuggestionAnalysis(request(), harness.dependencies);
  assert.deepEqual(first, providerOutcome);
  assert.equal(harness.getStored()?.status, 'failed');

  await assert.rejects(
    runOnboardingSuggestionAnalysis(request(), harness.dependencies),
    (error) => expectAnalysisError(error, 'ANALYSIS_ALREADY_USED'),
  );
  assert.equal(harness.getProviderCalls(), 1);
});

test('ambiguous completion persistence never causes an automatic provider replay', async () => {
  const harness = createDependencies({
    completionError: new Error('database acknowledgement lost'),
  });
  await assert.rejects(
    runOnboardingSuggestionAnalysis(request(), harness.dependencies),
    (error) => expectAnalysisError(error, 'ANALYSIS_STATE_UPDATE_FAILED'),
  );
  assert.equal(harness.getStored()?.status, 'running');

  await assert.rejects(
    runOnboardingSuggestionAnalysis(request(), harness.dependencies),
    (error) => expectAnalysisError(error, 'ANALYSIS_IN_PROGRESS'),
  );
  assert.equal(harness.getProviderCalls(), 1);
});
