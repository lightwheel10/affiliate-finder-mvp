import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertCapacityAvailable,
  assertRetainedHistoryCapacityAvailable,
  BrandLocationManagementError,
  MANAGEMENT_RESOURCE_LIMITS,
  normalizeManagementId,
  prepareBrandPatch,
  prepareBrandWrite,
  prepareLocationPatch,
  prepareLocationWrite,
  resolveCapacityEntitlements,
} from '../../src/lib/brand-locations/management';
import {
  createBrandSchema,
  createLocationSchema,
  updateLocationSchema,
} from '../../src/lib/brand-locations/management-input';

function expectManagementError(
  action: () => unknown,
  code: BrandLocationManagementError['code'],
  status: number,
) {
  assert.throws(action, (error: unknown) => {
    assert.ok(error instanceof BrandLocationManagementError);
    assert.equal(error.code, code);
    assert.equal(error.status, status);
    return true;
  });
}

test('capacity comes only from a real active or trialing subscription row', () => {
  assert.deepEqual(
    resolveCapacityEntitlements({
      plan: 'pro',
      status: 'trialing',
      stripeSubscriptionId: 'sub_pro',
    }),
    { plan: 'pro', maxBrands: 1, maxLocationsPerAccount: 2 },
  );
  assert.deepEqual(
    resolveCapacityEntitlements({
      plan: 'business',
      status: 'active',
      stripeSubscriptionId: 'sub_business',
    }),
    { plan: 'business', maxBrands: 5, maxLocationsPerAccount: 5 },
  );

  for (const subscription of [
    null,
    { plan: 'pro', status: 'canceled', stripeSubscriptionId: 'sub_old' },
    { plan: 'pro', status: 'past_due', stripeSubscriptionId: 'sub_due' },
    { plan: 'pro', status: 'active', stripeSubscriptionId: '' },
  ]) {
    expectManagementError(
      () => resolveCapacityEntitlements(subscription),
      'SUBSCRIPTION_REQUIRED',
      402,
    );
  }
  expectManagementError(
    () => resolveCapacityEntitlements({
      plan: 'attacker-plan',
      status: 'active',
      stripeSubscriptionId: 'sub_injected',
    }),
    'MANAGEMENT_INTEGRITY_ERROR',
    500,
  );
});

test('account-wide brand and location limits fail closed at the exact boundary', () => {
  assert.doesNotThrow(() => assertCapacityAvailable(1, 2, 'locations'));
  expectManagementError(
    () => assertCapacityAvailable(2, 2, 'locations'),
    'PLAN_LIMIT_REACHED',
    403,
  );
  expectManagementError(
    () => assertCapacityAvailable(1, 1, 'brands'),
    'PLAN_LIMIT_REACHED',
    403,
  );
  assert.doesNotThrow(() => assertCapacityAvailable(10_000, -1, 'locations'));
});

test('retained archive safety limits are separate from active plan capacity', () => {
  assert.deepEqual(MANAGEMENT_RESOURCE_LIMITS, {
    maxRetainedBrandsPerAccount: 100,
    maxRetainedLocationsPerAccount: 500,
  });
  assert.doesNotThrow(() => assertRetainedHistoryCapacityAvailable(99, 100, 'brands'));
  assert.doesNotThrow(() => assertRetainedHistoryCapacityAvailable(499, 500, 'locations'));
  expectManagementError(
    () => assertRetainedHistoryCapacityAvailable(100, 100, 'brands'),
    'RETAINED_HISTORY_LIMIT_REACHED',
    409,
  );
  expectManagementError(
    () => assertRetainedHistoryCapacityAvailable(500, 500, 'locations'),
    'RETAINED_HISTORY_LIMIT_REACHED',
    409,
  );
  for (const [count, limit] of [[-1, 100], [0, 0], [1.5, 100]]) {
    expectManagementError(
      () => assertRetainedHistoryCapacityAvailable(count, limit, 'locations'),
      'MANAGEMENT_INTEGRITY_ERROR',
      500,
    );
  }
});

test('management identifiers accept the full PostgreSQL bigint range without JS precision loss', () => {
  assert.equal(normalizeManagementId('00021', 'Location ID'), '21');
  assert.equal(
    normalizeManagementId('9223372036854775807', 'Location ID'),
    '9223372036854775807',
  );
  for (const invalid of ['', '0', '-1', '1.5', 'abc', '9223372036854775808']) {
    expectManagementError(
      () => normalizeManagementId(invalid, 'Location ID'),
      'INVALID_IDENTIFIER',
      400,
    );
  }
});

test('brand inputs share canonical domain validation and bounded arrays', () => {
  const parsed = createBrandSchema.parse({
    name: ' Selecdoo ',
    domain: 'https://www.Selecdoo.com/path',
    bio: '',
    affiliateTypes: ['Content', 'SaaS'],
  });
  assert.deepEqual(prepareBrandWrite(parsed), {
    name: 'Selecdoo',
    normalizedDomain: 'selecdoo.com',
    bio: null,
    affiliateTypes: ['Content', 'SaaS'],
  });
  assert.deepEqual(
    prepareBrandPatch({ domain: 'https://revenue.works/home', bio: null }),
    { normalizedDomain: 'revenue.works', bio: null },
  );
  assert.equal(createBrandSchema.safeParse({
    name: 'Duplicate inputs',
    domain: 'example.com',
    affiliateTypes: ['Content', 'content'],
  }).success, false);
});

test('location inputs require supported canonical markets and paired market updates', () => {
  const parsed = createLocationSchema.parse({
    countryCode: ' GB ',
    languageCode: 'EN',
    topics: ['affiliate software'],
    competitors: ['competitor.test'],
  });
  assert.deepEqual(prepareLocationWrite(parsed), {
    countryCode: 'gb',
    languageCode: 'en',
    topics: ['affiliate software'],
    competitors: ['competitor.test'],
  });
  assert.deepEqual(
    prepareLocationPatch(updateLocationSchema.parse({ topics: ['new topic'] })),
    { topics: ['new topic'] },
  );
  assert.equal(updateLocationSchema.safeParse({ countryCode: 'de' }).success, false);
  expectManagementError(
    () => prepareLocationWrite({
      countryCode: 'zz',
      languageCode: 'en',
      topics: [],
      competitors: [],
    }),
    'UNSUPPORTED_MARKET',
    400,
  );
});
