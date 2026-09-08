import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCapacityTarget,
  needsCapacityRetention,
  readCapacityOverview,
  readCapacityQuote,
  readCapacitySuccess,
} from '../../src/lib/stripe/capacity-client';

const operationId = '11111111-1111-4111-8111-111111111111';

test('capacity editor changes exactly one billable quantity', () => {
  const current = { extraBrands: 2, extraLocations: 4 };
  assert.deepEqual(buildCapacityTarget(current, 'brand', 3), {
    extraBrands: 3,
    extraLocations: 4,
  });
  assert.deepEqual(buildCapacityTarget(current, 'location', 1), {
    extraBrands: 2,
    extraLocations: 1,
  });
  assert.throws(() => buildCapacityTarget(current, 'brand', -1), /target quantity/);
});

test('capacity reduction asks for a keep-list when either resource no longer fits', () => {
  assert.equal(
    needsCapacityRetention({ brands: 2, locations: 5 }, { brands: 2, locations: 4 }),
    true,
  );
  assert.equal(
    needsCapacityRetention({ brands: 2, locations: 4 }, { brands: 2, locations: 4 }),
    false,
  );
});

test('capacity overview accepts one safe account-owned recovery reference', () => {
  const overview = readCapacityOverview({
    enabled: true,
    canPurchase: true,
    basePlan: 'pro',
    paidCapacity: { extraBrands: 1, extraLocations: 2 },
    effectiveLimits: { maxBrands: 2, maxLocationsPerAccount: 4 },
    catalogue: {
      brand: { monthlyEur: 25, maxQuantity: 10 },
      location: { monthlyEur: 10, maxQuantity: 25 },
    },
    pendingPayment: true,
    pendingOperation: {
      operationId,
      target: { extraBrands: 2, extraLocations: 2 },
      expiresAt: '2035-01-01T00:00:00.000Z',
    },
  });

  assert.equal(overview.pendingOperation?.operationId, operationId);
  assert.deepEqual(overview.pendingOperation?.target, { extraBrands: 2, extraLocations: 2 });
});

test('capacity response parsers reject malformed billing state', () => {
  assert.throws(() => readCapacityOverview({
    enabled: true,
    canPurchase: true,
    basePlan: 'pro',
    paidCapacity: { extraBrands: -1, extraLocations: 0 },
    effectiveLimits: { maxBrands: 1, maxLocationsPerAccount: 2 },
    catalogue: {
      brand: { monthlyEur: 25, maxQuantity: 10 },
      location: { monthlyEur: 10, maxQuantity: 25 },
    },
    pendingPayment: false,
    pendingOperation: null,
  }), /extra brand quantity/);
});

test('capacity quote accepts a reduction credit but never a negative amount due', () => {
  const quote = readCapacityQuote({
    operationId,
    expiresAt: '2035-01-01T00:00:00.000Z',
    current: { extraBrands: 2, extraLocations: 3 },
    target: { extraBrands: 1, extraLocations: 3 },
    quote: {
      currency: 'eur',
      amountDueNowCents: 0,
      totalCents: -500,
      prorationCents: -500,
      monthlySubtotalCents: 5_500,
    },
  });
  assert.equal(quote.quote.prorationCents, -500);
  assert.throws(() => readCapacityQuote({
    operationId,
    expiresAt: '2035-01-01T00:00:00.000Z',
    current: { extraBrands: 0, extraLocations: 0 },
    target: { extraBrands: 1, extraLocations: 0 },
    quote: {
      currency: 'eur',
      amountDueNowCents: -1,
      prorationCents: 0,
      monthlySubtotalCents: 2_500,
    },
  }), /amount due/);
});

test('capacity success does not invent archive counts on an idempotent replay', () => {
  const success = readCapacitySuccess({
    success: true,
    status: 'applied',
    operationId,
    paidCapacity: { extraBrands: 1, extraLocations: 0 },
    alreadyCompleted: true,
  });
  assert.equal(success.archivedBrands, undefined);
  assert.equal(success.archivedLocations, undefined);
});
