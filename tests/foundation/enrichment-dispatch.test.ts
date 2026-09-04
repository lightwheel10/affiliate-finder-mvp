import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildEnrichmentDispatchInputs,
  dispatchEnrichmentActors,
  EnrichmentProviderStartError,
  type EnrichmentDispatchContext,
  type EnrichmentDispatchDependencies,
  type EnrichmentDispatchInput,
  type EnrichmentDispatchSetupResult,
  type EnrichmentPlatform,
} from '../../src/lib/search/enrichment-dispatch';

const context: EnrichmentDispatchContext = {
  accountId: 7,
  jobId: 101,
  brandId: '11',
  brandLocationId: '21',
};

type FakeStatus = 'pending' | 'claimed' | 'dispatching' | 'running' | 'failed' | 'uncertain';

interface FakeRow extends EnrichmentDispatchInput {
  id: string;
  claimToken: string;
  status: FakeStatus;
  runId?: string;
}

function fakeDependencies(
  inputs: readonly EnrichmentDispatchInput[],
  overrides: Partial<EnrichmentDispatchDependencies> = {},
): {
  dependencies: EnrichmentDispatchDependencies;
  rows: Map<EnrichmentPlatform, FakeRow>;
  providerCalls: EnrichmentPlatform[];
  abortedRuns: string[];
} {
  const rows = new Map<EnrichmentPlatform, FakeRow>(inputs.map((input, index) => [
    input.platform,
    {
      ...input,
      id: String(index + 1),
      claimToken: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      status: 'pending',
    },
  ]));
  const providerCalls: EnrichmentPlatform[] = [];
  const abortedRuns: string[] = [];

  const defaults: EnrichmentDispatchDependencies = {
    claimDispatch: async (_ownedContext, platform) => {
      const row = rows.get(platform);
      if (!row || row.status !== 'pending') return { outcome: 'unavailable' };
      row.status = 'claimed';
      return { outcome: 'claimed', dispatch: row };
    },
    markLaunchAttempted: async (dispatch) => {
      const row = rows.get(dispatch.platform);
      assert.equal(row?.status, 'claimed');
      if (row) row.status = 'dispatching';
    },
    startProvider: async (dispatch) => {
      providerCalls.push(dispatch.platform);
      return `run-${dispatch.platform}`;
    },
    recordRun: async (dispatch, runId) => {
      const row = rows.get(dispatch.platform);
      assert.equal(row?.status, 'dispatching');
      if (row) {
        row.status = 'running';
        row.runId = runId;
      }
    },
    markFailed: async (dispatch, _message, runId) => {
      const row = rows.get(dispatch.platform);
      assert.equal(row?.status, 'dispatching');
      if (row) {
        row.status = 'failed';
        row.runId = runId;
      }
    },
    markUncertain: async (dispatch, _message, runId) => {
      const row = rows.get(dispatch.platform);
      assert.equal(row?.status, 'dispatching');
      if (row) {
        row.status = 'uncertain';
        row.runId = runId;
      }
    },
    abortProvider: async (runId) => {
      abortedRuns.push(runId);
    },
    finalizeSetup: async (): Promise<EnrichmentDispatchSetupResult> => {
      const values = [...rows.values()];
      if (values.some((row) => row.status === 'uncertain')) return { outcome: 'blocked' };
      if (values.some((row) =>
        row.status === 'pending' || row.status === 'claimed' || row.status === 'dispatching')) {
        return { outcome: 'in_progress' };
      }
      return {
        outcome: 'ready',
        runIds: Object.fromEntries(
          values
            .filter((row) => row.status === 'running' && row.runId)
            .map((row) => [row.platform, row.runId]),
        ),
      };
    },
  };

  return {
    dependencies: { ...defaults, ...overrides },
    rows,
    providerCalls,
    abortedRuns,
  };
}

function inputs(): EnrichmentDispatchInput[] {
  return buildEnrichmentDispatchInputs({
    youtube: ['https://www.youtube.com/watch?v=abc'],
    instagram: ['https://www.instagram.com/creator/'],
    tiktok: ['https://www.tiktok.com/@creator/video/123'],
    similarweb: ['example.com'],
  });
}

test('dispatch inputs use canonical hosts, stable ordering, and reject host spoofing', () => {
  const first = buildEnrichmentDispatchInputs({
    youtube: [
      'https://evil.example/?next=youtube.com/watch?v=stolen',
      'https://youtu.be/short#fragment',
      'https://www.youtube.com/watch?v=abc#fragment',
      'https://www.youtube.com/watch?v=abc',
    ],
    instagram: [
      'https://evil.example/instagram.com/profile',
      'https://www.instagram.com/creator/',
    ],
    tiktok: [
      'https://www.tiktok.com/@creator/video/123',
      'https://evil.example/tiktok.com/@creator/video/123',
    ],
    similarweb: [
      'https://WWW.Example.com/path',
      '127.0.0.1',
      'evil..example.com',
    ],
  });
  const second = buildEnrichmentDispatchInputs({
    youtube: [...first.find((input) => input.platform === 'youtube')!.urls].reverse(),
    instagram: ['https://www.instagram.com/creator/'],
    tiktok: ['https://www.tiktok.com/@creator/video/123'],
    similarweb: ['example.com'],
  });

  assert.deepEqual(first.map((input) => [input.platform, input.urls]), [
    ['youtube', ['https://www.youtube.com/watch?v=abc', 'https://youtu.be/short']],
    ['instagram', ['https://www.instagram.com/creator/']],
    ['tiktok', ['https://www.tiktok.com/@creator/video/123']],
    ['similarweb', ['example.com']],
  ]);
  assert.deepEqual(
    first.map((input) => input.inputFingerprint),
    second.map((input) => input.inputFingerprint),
  );
});

test('100 concurrent dispatch attempts launch each paid platform at most once', async () => {
  const fake = fakeDependencies(inputs());
  const outcomes = await Promise.all(
    Array.from({ length: 100 }, () =>
      dispatchEnrichmentActors(context, fake.dependencies)),
  );

  assert.equal(fake.providerCalls.length, 4);
  assert.deepEqual([...new Set(fake.providerCalls)].sort(), [
    'instagram',
    'similarweb',
    'tiktok',
    'youtube',
  ]);
  assert.ok(outcomes.some((outcome) => outcome.outcome === 'ready'));
  assert.ok([...fake.rows.values()].every((row) => row.status === 'running'));
});

test('known pre-launch provider failure is terminal without blocking successful platforms', async () => {
  const allInputs = inputs();
  const fake = fakeDependencies(allInputs);
  const originalStart = fake.dependencies.startProvider;
  fake.dependencies.startProvider = async (dispatch) => {
    if (dispatch.platform === 'instagram') {
      throw new EnrichmentProviderStartError('Provider is not configured.', false);
    }
    return originalStart(dispatch);
  };

  const result = await dispatchEnrichmentActors(context, fake.dependencies);

  assert.equal(result.outcome, 'ready');
  assert.equal(fake.rows.get('instagram')?.status, 'failed');
  assert.equal(fake.rows.get('youtube')?.status, 'running');
  assert.equal(fake.rows.get('tiktok')?.status, 'running');
  assert.equal(fake.rows.get('similarweb')?.status, 'running');
});

test('ambiguous provider response fails closed and cannot relaunch on later polls', async () => {
  const oneInput = buildEnrichmentDispatchInputs({
    youtube: ['https://www.youtube.com/watch?v=abc'],
    instagram: [],
    tiktok: [],
    similarweb: [],
  });
  const fake = fakeDependencies(oneInput);
  fake.dependencies.startProvider = async (dispatch) => {
    fake.providerCalls.push(dispatch.platform);
    throw new EnrichmentProviderStartError('Start response was lost.', true);
  };

  const first = await dispatchEnrichmentActors(context, fake.dependencies);
  const later = await Promise.all(
    Array.from({ length: 100 }, () =>
      dispatchEnrichmentActors(context, fake.dependencies)),
  );

  assert.equal(first.outcome, 'blocked');
  assert.ok(later.every((outcome) => outcome.outcome === 'blocked'));
  assert.equal(fake.providerCalls.length, 1);
  assert.equal(fake.rows.get('youtube')?.status, 'uncertain');
});

test('persistence failure aborts the paid run; an unconfirmed abort remains blocked', async () => {
  const oneInput = buildEnrichmentDispatchInputs({
    youtube: ['https://www.youtube.com/watch?v=abc'],
    instagram: [],
    tiktok: [],
    similarweb: [],
  });
  const aborted = fakeDependencies(oneInput, {
    recordRun: async () => {
      throw new Error('database unavailable');
    },
  });
  const abortedResult = await dispatchEnrichmentActors(context, aborted.dependencies);
  assert.equal(abortedResult.outcome, 'ready');
  assert.deepEqual(aborted.abortedRuns, ['run-youtube']);
  assert.equal(aborted.rows.get('youtube')?.status, 'failed');

  const uncertain = fakeDependencies(oneInput, {
    recordRun: async () => {
      throw new Error('database unavailable');
    },
    abortProvider: async () => {
      throw new Error('abort response unavailable');
    },
  });
  const uncertainResult = await dispatchEnrichmentActors(context, uncertain.dependencies);
  assert.equal(uncertainResult.outcome, 'blocked');
  assert.equal(uncertain.rows.get('youtube')?.status, 'uncertain');
});

test('failure to persist launch intent prevents every external provider call', async () => {
  const fake = fakeDependencies(inputs(), {
    markLaunchAttempted: async () => {
      throw new Error('database unavailable');
    },
  });

  const result = await dispatchEnrichmentActors(context, fake.dependencies);

  assert.equal(result.outcome, 'in_progress');
  assert.equal(fake.providerCalls.length, 0);
  assert.ok([...fake.rows.values()].every((row) => row.status === 'claimed'));
});
