import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyWeeklyScanWorkerFailure,
  normalizeWeeklyScanRunError,
  readWeeklyScanSettingsSnapshot,
  resolveWeeklyScanBatch,
  WeeklyScanDeferredError,
  WeeklyScanExecutionError,
} from '../../src/lib/weekly-scan/weekly-scan';

test('weekly batch waits until every location is terminal', () => {
  assert.equal(resolveWeeklyScanBatch(['succeeded', 'pending'], true), null);
  assert.equal(resolveWeeklyScanBatch(['claimed'], false), null);
});

test('weekly batch maps terminal location outcomes deterministically', () => {
  assert.deepEqual(resolveWeeklyScanBatch(['succeeded', 'skipped'], true), {
    status: 'completed',
    creditStatus: 'consumed',
  });
  assert.deepEqual(resolveWeeklyScanBatch(['succeeded', 'failed'], true), {
    status: 'partial',
    creditStatus: 'consumed',
  });
  assert.deepEqual(resolveWeeklyScanBatch(['failed', 'skipped'], false), {
    status: 'failed',
    creditStatus: 'released',
  });
  assert.deepEqual(resolveWeeklyScanBatch(['succeeded', 'uncertain'], true), {
    status: 'uncertain',
    creditStatus: 'consumed',
  });
});

test('weekly batch refuses an impossible empty occurrence', () => {
  assert.throws(
    () => resolveWeeklyScanBatch([], false),
    /at least one location/,
  );
});

test('weekly settings snapshots are strict immutable provider inputs', () => {
  const snapshot = {
    brandName: 'Selecdoo',
    normalizedDomain: 'selecdoo.com',
    countryCode: 'de',
    languageCode: 'de',
    topics: ['Affiliate Marketing'],
    competitors: ['example.com'],
  };
  assert.deepEqual(readWeeklyScanSettingsSnapshot(snapshot), snapshot);
  assert.throws(
    () => readWeeklyScanSettingsSnapshot({ ...snapshot, countryCode: 'Germany' }),
    /countryCode/,
  );
  assert.throws(
    () => readWeeklyScanSettingsSnapshot({ ...snapshot, topics: ['', 'ok'] }),
    /topics/,
  );
});

test('weekly worker failures never replay or refund ambiguous provider work', () => {
  assert.deepEqual(
    classifyWeeklyScanWorkerFailure(
      new WeeklyScanExecutionError(
        'failed',
        'provider_terminal_failure',
        'Provider proved the run failed.',
      ),
      true,
    ),
    {
      outcome: 'failed',
      code: 'provider_terminal_failure',
      message: 'Provider proved the run failed.',
    },
  );
  assert.deepEqual(
    classifyWeeklyScanWorkerFailure(new Error('Database response was lost.'), true),
    {
      outcome: 'uncertain',
      code: 'worker_finalization_uncertain',
      message: 'Database response was lost.',
    },
  );
  assert.deepEqual(
    classifyWeeklyScanWorkerFailure(new Error('Lease setup failed.'), false),
    {
      outcome: 'failed',
      code: 'worker_failed_before_provider',
      message: 'Lease setup failed.',
    },
  );
});

test('weekly continuation survives the auto-scan error boundary', () => {
  const deferred = new WeeklyScanDeferredError('Provider work is still running.');
  assert.equal(normalizeWeeklyScanRunError(deferred, true, 'known-run'), deferred);

  const ambiguous = normalizeWeeklyScanRunError(
    new Error('Connection ended after provider dispatch.'),
    true,
    'known-run',
  );
  assert.ok(ambiguous instanceof WeeklyScanExecutionError);
  assert.equal(ambiguous.outcome, 'uncertain');
  assert.equal(ambiguous.code, 'provider_processing_uncertain');
});
