import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveRestoredLocationSchedule } from '../../src/lib/brand-locations/restored-location-schedule';

const NOW = new Date('2026-09-03T10:00:00.000Z');

test('an account-level opt-out keeps restored locations disabled', () => {
  assert.deepEqual(resolveRestoredLocationSchedule(false, {
    status: 'active',
    firstPaymentAt: '2026-08-01T00:00:00.000Z',
    nextAutoScanAt: '2026-09-05T00:00:00.000Z',
  }, NOW), {
    autoScanEnabled: false,
    nextAutoScanAt: null,
  });
});

test('an unpaid or trialing account never receives a premature scan date', () => {
  assert.deepEqual(resolveRestoredLocationSchedule(true, {
    status: 'trialing',
    firstPaymentAt: null,
    nextAutoScanAt: null,
  }, NOW), {
    autoScanEnabled: true,
    nextAutoScanAt: null,
  });
});

test('a paid account reuses its account scan date', () => {
  assert.deepEqual(resolveRestoredLocationSchedule(true, {
    status: 'active',
    firstPaymentAt: '2026-08-01T00:00:00.000Z',
    nextAutoScanAt: '2026-09-05T00:00:00.000Z',
  }, NOW), {
    autoScanEnabled: true,
    nextAutoScanAt: '2026-09-05T00:00:00.000Z',
  });
});

test('a paid account without a scan date gets a deterministic seven-day fallback', () => {
  assert.deepEqual(resolveRestoredLocationSchedule(true, {
    status: 'active',
    firstPaymentAt: '2026-08-01T00:00:00.000Z',
    nextAutoScanAt: null,
  }, NOW), {
    autoScanEnabled: true,
    nextAutoScanAt: '2026-09-10T10:00:00.000Z',
  });
});
