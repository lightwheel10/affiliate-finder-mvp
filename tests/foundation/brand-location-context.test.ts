import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BrandLocationContextError,
  normalizeRequestedBrandLocationId,
  resolveBrandLocationContext,
  type BrandLocationContextLookup,
  type BrandLocationContextLookupRow,
} from '../../src/lib/brand-locations/context';

function row(
  overrides: Partial<BrandLocationContextLookupRow> = {},
): BrandLocationContextLookupRow {
  return {
    account_id: 7,
    brand_user_id: 7,
    location_user_id: 7,
    brand_id: '11',
    brand_location_id: '21',
    brand_name: 'Selecdoo',
    normalized_domain: 'selecdoo.com',
    bio: null,
    affiliate_types: ['content'],
    brand_is_default: true,
    brand_archived_at: null,
    country_code: 'de',
    language_code: 'de',
    topics: ['affiliate software'],
    competitors: ['competitor.test'],
    location_is_default: true,
    auto_scan_enabled: true,
    location_archived_at: null,
    ...overrides,
  };
}

async function expectContextError(
  action: () => Promise<unknown>,
  code: BrandLocationContextError['code'],
  status: number,
) {
  await assert.rejects(action, (error: unknown) => {
    assert.ok(error instanceof BrandLocationContextError);
    assert.equal(error.code, code);
    assert.equal(error.status, status);
    return true;
  });
}

test('requested location IDs are canonical positive PostgreSQL bigint strings', () => {
  assert.equal(normalizeRequestedBrandLocationId(undefined), null);
  assert.equal(normalizeRequestedBrandLocationId(null), null);
  assert.equal(normalizeRequestedBrandLocationId(21), '21');
  assert.equal(normalizeRequestedBrandLocationId('00021'), '21');
  assert.equal(
    normalizeRequestedBrandLocationId('9223372036854775807'),
    '9223372036854775807',
  );

  for (const invalid of [
    '',
    '0',
    '-1',
    '1.5',
    'abc',
    Number.MAX_SAFE_INTEGER + 1,
    '9223372036854775808',
  ]) {
    assert.throws(
      () => normalizeRequestedBrandLocationId(invalid),
      (error: unknown) =>
        error instanceof BrandLocationContextError
        && error.code === 'INVALID_BRAND_LOCATION_ID'
        && error.status === 400,
    );
  }
});

test('omitted location resolves only the account default context', async () => {
  let received: unknown;
  const lookup: BrandLocationContextLookup = async (input) => {
    received = input;
    return [row()];
  };

  const context = await resolveBrandLocationContext(
    { accountId: 7 },
    lookup,
  );

  assert.deepEqual(received, {
    accountId: 7,
    requestedBrandLocationId: null,
  });
  assert.equal(context.source, 'account_default');
  assert.equal(context.brand.id, '11');
  assert.equal(context.location.id, '21');
  assert.deepEqual(context.location.topics, ['affiliate software']);
});

test('explicit location accepts an active non-default context', async () => {
  const lookup: BrandLocationContextLookup = async (input) => {
    assert.equal(input.requestedBrandLocationId, '31');
    return [
      row({
        brand_id: '12',
        brand_location_id: '31',
        brand_name: 'Revenue Works',
        normalized_domain: 'revenue.works',
        brand_is_default: false,
        location_is_default: false,
        country_code: 'us',
        language_code: 'en',
      }),
    ];
  };

  const context = await resolveBrandLocationContext(
    { accountId: 7, requestedBrandLocationId: '00031' },
    lookup,
  );

  assert.equal(context.source, 'requested');
  assert.equal(context.brand.id, '12');
  assert.equal(context.location.id, '31');
  assert.equal(context.brand.isDefault, false);
});

test('missing explicit and default contexts have distinct fail-closed errors', async () => {
  const emptyLookup: BrandLocationContextLookup = async () => [];

  await expectContextError(
    () =>
      resolveBrandLocationContext(
        { accountId: 7, requestedBrandLocationId: '21' },
        emptyLookup,
      ),
    'BRAND_LOCATION_NOT_FOUND',
    404,
  );
  await expectContextError(
    () => resolveBrandLocationContext({ accountId: 7 }, emptyLookup),
    'DEFAULT_BRAND_LOCATION_NOT_FOUND',
    409,
  );
});

test('resolver rejects cross-account rows without exposing them as context', async () => {
  const lookup: BrandLocationContextLookup = async () => [
    row({ brand_user_id: 8 }),
  ];

  await expectContextError(
    () =>
      resolveBrandLocationContext(
        { accountId: 7, requestedBrandLocationId: '21' },
        lookup,
      ),
    'BRAND_LOCATION_INTEGRITY_ERROR',
    500,
  );
});

test('default resolution rejects a per-brand default under a non-default brand', async () => {
  const lookup: BrandLocationContextLookup = async () => [
    row({ brand_is_default: false, location_is_default: true }),
  ];

  await expectContextError(
    () => resolveBrandLocationContext({ accountId: 7 }, lookup),
    'BRAND_LOCATION_INTEGRITY_ERROR',
    500,
  );
});

test('resolver rejects archived, duplicate, and wrong requested rows', async () => {
  await expectContextError(
    () =>
      resolveBrandLocationContext(
        { accountId: 7, requestedBrandLocationId: '21' },
        async () => [row({ location_archived_at: '2026-09-01' })],
      ),
    'BRAND_LOCATION_INTEGRITY_ERROR',
    500,
  );
  await expectContextError(
    () => resolveBrandLocationContext({ accountId: 7 }, async () => [row(), row()]),
    'BRAND_LOCATION_INTEGRITY_ERROR',
    500,
  );
  await expectContextError(
    () =>
      resolveBrandLocationContext(
        { accountId: 7, requestedBrandLocationId: '31' },
        async () => [row({ brand_location_id: '21' })],
      ),
    'BRAND_LOCATION_INTEGRITY_ERROR',
    500,
  );
});

test('resolver rejects incomplete or malformed market pairs', async () => {
  await expectContextError(
    () =>
      resolveBrandLocationContext(
        { accountId: 7 },
        async () => [row({ language_code: null })],
      ),
    'BRAND_LOCATION_INTEGRITY_ERROR',
    500,
  );
  await expectContextError(
    () =>
      resolveBrandLocationContext(
        { accountId: 7 },
        async () => [row({ country_code: 'GB', language_code: 'en' })],
      ),
    'BRAND_LOCATION_INTEGRITY_ERROR',
    500,
  );
});

test('resolver rejects malformed account and row data', async () => {
  await expectContextError(
    () => resolveBrandLocationContext({ accountId: 0 }, async () => [row()]),
    'INVALID_ACCOUNT_ID',
    500,
  );
  await expectContextError(
    () =>
      resolveBrandLocationContext(
        { accountId: 7 },
        async () => [row({ affiliate_types: [null] })],
      ),
    'BRAND_LOCATION_INTEGRITY_ERROR',
    500,
  );
});
