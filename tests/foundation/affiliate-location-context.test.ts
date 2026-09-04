import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AffiliateRequestContextError,
  normalizeLegacyAffiliateAccountId,
  normalizeRequestedAffiliateLocationIds,
} from '../../src/lib/affiliates/context';

test('legacy account assertion is optional and normalizes exact integers', () => {
  assert.equal(normalizeLegacyAffiliateAccountId(undefined), undefined);
  assert.equal(normalizeLegacyAffiliateAccountId(null), undefined);
  assert.equal(normalizeLegacyAffiliateAccountId(42), 42);
  assert.equal(normalizeLegacyAffiliateAccountId('42'), 42);
  assert.equal(normalizeLegacyAffiliateAccountId(' 42 '), 42);
  assert.equal(normalizeLegacyAffiliateAccountId('2147483647'), 2_147_483_647);
});

test('multi-location scope accepts exact bigint IDs and removes duplicates', () => {
  assert.deepEqual(
    normalizeRequestedAffiliateLocationIds(['2', ' 1 ', '2']),
    ['2', '1'],
  );
  assert.equal(normalizeRequestedAffiliateLocationIds([]), undefined);
});

test('multi-location scope rejects malformed, overflowing, and excessive IDs', () => {
  for (const values of [
    ['0'],
    ['1abc'],
    ['9223372036854775808'],
    Array.from({ length: 51 }, (_, index) => String(index + 1)),
  ]) {
    assert.throws(
      () => normalizeRequestedAffiliateLocationIds(values),
      (error: unknown) => {
        assert.ok(error instanceof AffiliateRequestContextError);
        assert.equal(error.code, 'INVALID_BRAND_LOCATION_ID');
        assert.equal(error.status, 400);
        return true;
      },
    );
  }
});

test('legacy account assertion rejects partial, unsafe, and PostgreSQL-incompatible IDs', () => {
  const invalidValues = [
    '',
    '0',
    '01',
    '12abc',
    '-1',
    '1.5',
    0,
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    2_147_483_648,
    Number.MAX_SAFE_INTEGER + 1,
  ];

  for (const value of invalidValues) {
    assert.throws(
      () => normalizeLegacyAffiliateAccountId(value),
      (error: unknown) => {
        assert.ok(error instanceof AffiliateRequestContextError);
        assert.equal(error.code, 'INVALID_ACCOUNT_ID');
        assert.equal(error.status, 400);
        return true;
      },
      `expected ${String(value)} to be rejected`,
    );
  }
});
