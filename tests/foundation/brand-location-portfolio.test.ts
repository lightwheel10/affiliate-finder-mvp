import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildActiveLocationStorageKey,
  buildBrandLocationScopeStorageKey,
  buildBrandPortfolioCacheKey,
  canonicalizeBrandLocationScopePreference,
  findActiveBrandMarketLocation,
  groupActivePortfolioLocations,
  listActivePortfolioLocations,
  parseBrandLocationScopePreference,
  resolveManagedPortfolioScope,
  resolveManagedPortfolioSelection,
  type ManagedBrand,
  type ManagedLocation,
  type ManagedPortfolio,
} from '../../src/lib/brand-locations/portfolio';

test('portfolio browser state is partitioned by the exact auth identity', () => {
  assert.deepEqual(
    buildBrandPortfolioCacheKey('auth-user-a', false),
    ['/api/brands', 'auth-user-a'],
  );
  assert.deepEqual(
    buildBrandPortfolioCacheKey('auth-user-b', true),
    ['/api/brands?includeArchived=true', 'auth-user-b'],
  );
  assert.equal(buildBrandPortfolioCacheKey(null, false), null);
  assert.notEqual(
    buildActiveLocationStorageKey('auth-user-a'),
    buildActiveLocationStorageKey('auth-user-b'),
  );
  assert.notEqual(
    buildBrandLocationScopeStorageKey('auth-user-a'),
    buildBrandLocationScopeStorageKey('auth-user-b'),
  );
});

function location(
  id: string,
  brandId: string,
  overrides: Partial<ManagedLocation> = {},
): ManagedLocation {
  return {
    id,
    brandId,
    countryCode: 'de',
    languageCode: 'de',
    topics: [],
    competitors: [],
    isDefault: false,
    autoScanEnabled: true,
    lastAutoScanAt: null,
    nextAutoScanAt: null,
    archivedAt: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

function brand(
  id: string,
  locations: ManagedLocation[],
  overrides: Partial<ManagedBrand> = {},
): ManagedBrand {
  return {
    id,
    name: `Brand ${id}`,
    normalizedDomain: `brand-${id}.test`,
    bio: null,
    affiliateTypes: [],
    isDefault: false,
    archivedAt: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    locations,
    ...overrides,
  };
}

function portfolio(brands: ManagedBrand[]): ManagedPortfolio {
  return { brands, capacity: null };
}

test('portfolio lists only active locations under active brands', () => {
  const active = location('11', '1');
  const archivedLocation = location('12', '1', { archivedAt: '2026-09-02T00:00:00.000Z' });
  const hiddenByArchivedBrand = location('21', '2');
  const selections = listActivePortfolioLocations(portfolio([
    brand('1', [active, archivedLocation]),
    brand('2', [hiddenByArchivedBrand], { archivedAt: '2026-09-02T00:00:00.000Z' }),
  ]));

  assert.deepEqual(selections.map(({ location: item }) => item.id), ['11']);
});

test('switcher groups every active location under its brand without changing order', () => {
  const brandOne = brand('1', []);
  const brandTwo = brand('2', []);
  const groups = groupActivePortfolioLocations([
    { brand: brandOne, location: location('11', '1') },
    { brand: brandOne, location: location('12', '1', { countryCode: 'gb', languageCode: 'en' }) },
    { brand: brandTwo, location: location('21', '2', { countryCode: 'us', languageCode: 'en' }) },
  ]);

  assert.deepEqual(
    groups.map(({ brand: groupedBrand, locations }) => ({
      brandId: groupedBrand.id,
      locationIds: locations.map(({ id }) => id),
    })),
    [
      { brandId: '1', locationIds: ['11', '12'] },
      { brandId: '2', locationIds: ['21'] },
    ],
  );
});

test('search market reuse stays inside one brand and ignores archived locations', () => {
  const targetBrand = brand('1', [
    location('11', '1'),
    location('12', '1', { countryCode: 'gb', languageCode: 'en' }),
    location('13', '1', {
      countryCode: 'us',
      languageCode: 'en',
      archivedAt: '2026-09-02T00:00:00.000Z',
    }),
  ]);

  assert.equal(findActiveBrandMarketLocation(targetBrand, 'gb', 'en')?.id, '12');
  assert.equal(findActiveBrandMarketLocation(targetBrand, 'us', 'en'), undefined);
  assert.equal(findActiveBrandMarketLocation(targetBrand, 'de', 'en'), undefined);
});

test('portfolio accepts a saved location only when it remains active', () => {
  const defaultLocation = location('11', '1', { isDefault: true });
  const preferredLocation = location('21', '2', { countryCode: 'us', languageCode: 'en' });
  const data = portfolio([
    brand('1', [defaultLocation], { isDefault: true }),
    brand('2', [preferredLocation]),
  ]);

  assert.equal(resolveManagedPortfolioSelection(data, '21')?.location.id, '21');
  assert.equal(resolveManagedPortfolioSelection(data, '999')?.location.id, '11');
});

test('portfolio falls back deterministically and returns null without active locations', () => {
  const firstLocation = location('11', '1');
  const perBrandDefault = location('21', '2', { isDefault: true });
  const data = portfolio([
    brand('1', [firstLocation]),
    brand('2', [perBrandDefault], { isDefault: true }),
  ]);

  assert.equal(resolveManagedPortfolioSelection(data, null)?.location.id, '21');
  assert.equal(resolveManagedPortfolioSelection(portfolio([]), null), null);
  assert.equal(resolveManagedPortfolioSelection(undefined, null), null);
});

test('multi-location scope keeps one brand and only active locations from that brand', () => {
  const data = portfolio([
    brand('1', [
      location('11', '1', { isDefault: true }),
      location('12', '1', { countryCode: 'gb', languageCode: 'en' }),
      location('13', '1', { archivedAt: '2026-09-02T00:00:00.000Z' }),
    ], { isDefault: true }),
    brand('2', [location('21', '2')]),
  ]);
  const scope = resolveManagedPortfolioScope(data, {
    activeBrandId: '1',
    locationIdsByBrand: { '1': ['12', '13'], '2': ['21'] },
  });

  assert.equal(scope?.brand.id, '1');
  assert.deepEqual(scope?.locations.map(({ id }) => id), ['12']);
  assert.equal(scope?.defaultActionLocation.id, '12');
});

test('multi-location actions use the default selected location and preserve brand preferences', () => {
  const data = portfolio([
    brand('1', [
      location('11', '1', { isDefault: true }),
      location('12', '1', { countryCode: 'gb', languageCode: 'en' }),
    ], { isDefault: true }),
    brand('2', [location('21', '2')]),
  ]);
  const current = {
    activeBrandId: '1',
    locationIdsByBrand: { '1': ['11', '12'], '2': ['21'] },
  };
  const scope = resolveManagedPortfolioScope(data, current);

  assert.deepEqual(scope?.locations.map(({ id }) => id), ['11', '12']);
  assert.equal(scope?.defaultActionLocation.id, '11');
  assert.deepEqual(
    scope && canonicalizeBrandLocationScopePreference(scope, current),
    current,
  );
});

test('scope preference parser rejects malformed or oversized untrusted browser data', () => {
  assert.deepEqual(
    parseBrandLocationScopePreference(JSON.stringify({
      activeBrandId: '1',
      locationIdsByBrand: { '1': ['11', '11', '12'] },
    })),
    { activeBrandId: '1', locationIdsByBrand: { '1': ['11', '12'] } },
  );
  assert.equal(parseBrandLocationScopePreference('{bad json'), null);
  assert.equal(parseBrandLocationScopePreference(JSON.stringify({
    activeBrandId: '1',
    locationIdsByBrand: { '1': ['not-an-id'] },
  })), null);
  assert.equal(parseBrandLocationScopePreference(JSON.stringify({
    activeBrandId: '1',
    locationIdsByBrand: Object.fromEntries(
      Array.from({ length: 101 }, (_, index) => [String(index + 1), ['1']]),
    ),
  })), null);
});
