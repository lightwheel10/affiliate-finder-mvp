import assert from 'node:assert/strict';
import test from 'node:test';
import {
  executeWeeklyProvider,
  sumExactWeeklyProviderCosts,
  weeklyProviderCorrelationId,
  weeklyProviderInputFingerprint,
  type WeeklyProviderExecutionDependencies,
  type WeeklyProviderLaunchInput,
  type WeeklyProviderSettlement,
} from '../../src/lib/weekly-scan/provider-runs';

const launchInput: WeeklyProviderLaunchInput = {
  provider: 'youtube',
  inputFingerprint: 'a'.repeat(64),
  correlationId: 'weekly-provider:test',
};

function dependencies<TData>(overrides: Partial<WeeklyProviderExecutionDependencies<TData>> = {}) {
  const settlements: WeeklyProviderSettlement[] = [];
  const calls: string[] = [];
  const defaults: WeeklyProviderExecutionDependencies<TData> = {
    loadExisting: async () => null,
    prepare: async () => { calls.push('prepare'); },
    start: async () => { calls.push('start'); return 'run-1'; },
    recordRun: async () => { calls.push('record'); },
    inspect: async () => ({ status: 'SUCCEEDED' }),
    fetchExactCost: async () => 0.1234564,
    settle: async (_input, settlement) => { calls.push(`settle:${settlement.outcome}`); settlements.push(settlement); },
    fetchResults: async () => ({ ok: true }) as TData,
    abort: async () => { calls.push('abort'); },
    sleep: async () => {},
    pollIntervalMs: 1,
    maxPollDurationMs: 100,
    maxProviderAgeMs: 1_000,
    costStabilizationDelayMs: 10,
  };
  return { value: { ...defaults, ...overrides }, calls, settlements };
}

test('weekly provider identity is deterministic and rejects invalid ownership input', () => {
  const correlation = weeklyProviderCorrelationId({
    batchId: '11111111-1111-4111-8111-111111111111',
    brandLocationId: '42',
    provider: 'instagram',
  });
  assert.equal(correlation, 'weekly-provider:11111111-1111-4111-8111-111111111111:42:instagram');
  assert.throws(
    () => weeklyProviderCorrelationId({ batchId: 'wrong', brandLocationId: '42', provider: 'google' }),
    /canonical batch UUID/,
  );
});

test('weekly provider fingerprints bind the provider and exact canonical input', () => {
  const first = weeklyProviderInputFingerprint('google', { queries: ['one'], countryCode: 'de' });
  const retry = weeklyProviderInputFingerprint('google', { queries: ['one'], countryCode: 'de' });
  const otherMarket = weeklyProviderInputFingerprint('google', { queries: ['one'], countryCode: 'gb' });
  assert.match(first, /^[0-9a-f]{64}$/);
  assert.equal(first, retry);
  assert.notEqual(first, otherMarket);
});

test('exact provider totals never disguise a missing or invalid run cost', () => {
  assert.equal(sumExactWeeklyProviderCosts([
    { launched: true, exactCostUsd: 0.101 },
    { launched: true, exactCostUsd: 0.177 },
    { launched: false, exactCostUsd: null },
  ]), 0.278);
  assert.equal(sumExactWeeklyProviderCosts([
    { launched: true, exactCostUsd: 0.101 },
    { launched: true, exactCostUsd: null },
  ]), null);
  assert.equal(sumExactWeeklyProviderCosts([]), null);
  assert.throws(
    () => sumExactWeeklyProviderCosts([{ launched: true, exactCostUsd: -1 }]),
    /invalid/,
  );
});

test('successful provider work persists preparation, run identity, terminal cost, then results', async () => {
  const fake = dependencies<{ ok: boolean }>();
  const result = await executeWeeklyProvider(launchInput, fake.value);
  assert.deepEqual(result, {
    outcome: 'succeeded',
    launched: true,
    providerRunId: 'run-1',
    exactCostUsd: 0.123456,
    data: { ok: true },
  });
  assert.deepEqual(fake.calls, ['prepare', 'start', 'record', 'settle:succeeded']);
  assert.deepEqual(fake.settlements, [{
    outcome: 'succeeded',
    providerRunId: 'run-1',
    exactCostUsd: 0.123456,
  }]);
});

test('a definitely rejected provider start is recorded failed without an invented run', async () => {
  const error = Object.assign(new Error('configuration rejected'), {
    externalStartMayHaveSucceeded: false,
  });
  const fake = dependencies({ start: async () => { throw error; } });
  const result = await executeWeeklyProvider(launchInput, fake.value);
  assert.equal(result.outcome, 'failed');
  assert.equal(result.launched, false);
  assert.deepEqual(fake.calls, ['prepare', 'settle:failed']);
});

test('an ambiguous start is fail-closed and cannot look like a free retry', async () => {
  const fake = dependencies({ start: async () => { throw new Error('connection disappeared'); } });
  const result = await executeWeeklyProvider(launchInput, fake.value);
  assert.equal(result.outcome, 'uncertain');
  assert.equal(result.launched, false);
  assert.deepEqual(fake.calls, ['prepare', 'settle:uncertain']);
});

test('receipt persistence failure aborts the known provider run before marking failure', async () => {
  const fake = dependencies({ recordRun: async () => { throw new Error('database unavailable'); } });
  const result = await executeWeeklyProvider(launchInput, fake.value);
  assert.equal(result.outcome, 'failed');
  assert.equal(result.providerRunId, 'run-1');
  assert.deepEqual(fake.calls, ['prepare', 'start', 'abort', 'settle:failed']);
});

test('failed abort leaves a known provider run uncertain instead of permitting a replay', async () => {
  const fake = dependencies({
    recordRun: async () => { throw new Error('database unavailable'); },
    abort: async () => { fake.calls.push('abort'); throw new Error('provider unavailable'); },
  });
  const result = await executeWeeklyProvider(launchInput, fake.value);
  assert.equal(result.outcome, 'uncertain');
  assert.equal(result.providerRunId, 'run-1');
  assert.equal(result.exactCostUsd, null);
  assert.deepEqual(fake.calls, ['prepare', 'start', 'abort', 'settle:uncertain']);
  assert.match(fake.settlements[0].errorMessage ?? '', /abort failed: provider unavailable/);
});

test('settlement storage errors are not mislabeled as provider abort failures', async () => {
  const fake = dependencies({
    recordRun: async () => { throw new Error('receipt insert unavailable'); },
    settle: async () => { throw new Error('settlement database unavailable'); },
  });
  await assert.rejects(
    () => executeWeeklyProvider(launchInput, fake.value),
    /settlement database unavailable/,
  );
  assert.deepEqual(fake.calls, ['prepare', 'start', 'abort']);
});

test('a terminal provider failure keeps the known run and exact provider cost', async () => {
  const fake = dependencies({ inspect: async () => ({ status: 'FAILED' }) });
  const result = await executeWeeklyProvider(launchInput, fake.value);
  assert.deepEqual(result, {
    outcome: 'failed',
    launched: true,
    providerRunId: 'run-1',
    exactCostUsd: 0.123456,
    data: null,
  });
  assert.deepEqual(fake.calls, ['prepare', 'start', 'record', 'settle:failed']);
});

test('result download failures surface after the successful provider receipt is saved', async () => {
  const fake = dependencies({
    fetchResults: async () => { throw new Error('dataset unavailable'); },
  });
  await assert.rejects(
    () => executeWeeklyProvider(launchInput, fake.value),
    /dataset unavailable/,
  );
  assert.deepEqual(fake.calls, ['prepare', 'start', 'record', 'settle:succeeded']);
  assert.equal(fake.settlements[0].outcome, 'succeeded');
});

test('READY is polled instead of being mistaken for a terminal provider result', async () => {
  const statuses = ['READY', 'RUNNING', 'SUCCEEDED'] as const;
  let index = 0;
  const fake = dependencies({
    inspect: async () => ({ status: statuses[index++] }),
  });
  const result = await executeWeeklyProvider(launchInput, fake.value);
  assert.equal(result.outcome, 'succeeded');
  assert.equal(index, 3);
});

test('Apify aborting and timing-out transition states are polled to a terminal result', async () => {
  const statuses = ['ABORTING', 'TIMING-OUT', 'TIMED-OUT'] as const;
  let index = 0;
  const fake = dependencies({
    inspect: async () => ({ status: statuses[index++] }),
  });
  const result = await executeWeeklyProvider(launchInput, fake.value);
  assert.equal(result.outcome, 'failed');
  assert.equal(result.providerRunId, 'run-1');
  assert.equal(index, 3);
  assert.deepEqual(fake.calls, ['prepare', 'start', 'record', 'settle:failed']);
});

test('temporary status uncertainty defers the known run and never fetches results', async () => {
  let fetched = false;
  const fake = dependencies({
    inspect: async () => { throw new Error('temporary provider status failure'); },
    fetchResults: async () => { fetched = true; return {}; },
  });
  const result = await executeWeeklyProvider(launchInput, fake.value);
  assert.equal(result.outcome, 'deferred');
  assert.equal(fetched, false);
  assert.deepEqual(fake.calls, ['prepare', 'start', 'record']);
});

test('a slow known run is deferred without settlement or a second launch', async () => {
  let time = 0;
  let costFetched = false;
  const fake = dependencies({
    inspect: async () => ({ status: 'RUNNING' }),
    fetchExactCost: async () => { costFetched = true; return 0.5; },
    sleep: async (milliseconds) => { time += milliseconds; },
    now: () => time,
    maxPollDurationMs: 2,
    maxProviderAgeMs: 100,
  });
  const result = await executeWeeklyProvider(launchInput, fake.value);
  assert.equal(result.outcome, 'deferred');
  assert.equal(result.providerRunId, 'run-1');
  assert.equal(costFetched, false);
  assert.deepEqual(fake.calls, ['prepare', 'start', 'record']);
  assert.deepEqual(fake.settlements, []);
});

test('a later invocation resumes the exact known run and waits before reading final cost', async () => {
  let slept = 0;
  const fake = dependencies<{ ok: boolean }>({
    loadExisting: async () => ({
      status: 'running',
      providerRunId: 'run-existing',
      exactCostUsd: null,
      dispatchedAt: new Date(0).toISOString(),
    }),
    now: () => 5,
    sleep: async (milliseconds) => { slept += milliseconds; },
  });
  const result = await executeWeeklyProvider(launchInput, fake.value);
  assert.equal(result.outcome, 'succeeded');
  assert.equal(result.providerRunId, 'run-existing');
  assert.equal(slept, 10);
  assert.deepEqual(fake.calls, ['settle:succeeded']);
});

test('a provider beyond its total continuation age becomes uncertain without a partial cost', async () => {
  let costFetched = false;
  const fake = dependencies({
    loadExisting: async () => ({
      status: 'running',
      providerRunId: 'run-old',
      exactCostUsd: null,
      dispatchedAt: new Date(0).toISOString(),
    }),
    inspect: async () => ({ status: 'RUNNING' }),
    fetchExactCost: async () => { costFetched = true; return 0.5; },
    now: () => 2_000,
    maxPollDurationMs: 100,
    maxProviderAgeMs: 1_000,
  });
  const result = await executeWeeklyProvider(launchInput, fake.value);
  assert.equal(result.outcome, 'uncertain');
  assert.equal(result.exactCostUsd, null);
  assert.equal(costFetched, false);
  assert.deepEqual(fake.calls, ['settle:uncertain']);
});

test('an already successful receipt is reused without starting or charging again', async () => {
  const fake = dependencies<{ ok: boolean }>({
    loadExisting: async () => ({
      status: 'succeeded',
      providerRunId: 'run-complete',
      exactCostUsd: 0.25,
      dispatchedAt: new Date(0).toISOString(),
    }),
  });
  const result = await executeWeeklyProvider(launchInput, fake.value);
  assert.deepEqual(result, {
    outcome: 'succeeded',
    launched: true,
    providerRunId: 'run-complete',
    exactCostUsd: 0.25,
    data: { ok: true },
  });
  assert.deepEqual(fake.calls, []);
});

test('a terminal failure before launch is reused without inventing provider spend', async () => {
  const fake = dependencies({
    loadExisting: async () => ({
      status: 'failed',
      providerRunId: null,
      exactCostUsd: null,
      dispatchedAt: null,
    }),
  });
  const result = await executeWeeklyProvider(launchInput, fake.value);
  assert.deepEqual(result, {
    outcome: 'failed',
    launched: false,
    providerRunId: null,
    exactCostUsd: null,
    data: null,
  });
  assert.deepEqual(fake.calls, []);
  assert.deepEqual(fake.settlements, []);
});
