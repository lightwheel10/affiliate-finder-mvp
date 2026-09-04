import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildLocationExportSlug,
  buildLocationScopeExportSlug,
} from '../../src/lib/brand-locations/export';
import {
  resolveBrandLocationPresentation,
} from '../../src/lib/brand-locations/presentation';
import type {
  ManagedBrand,
  ManagedLocation,
  ManagedPortfolioSelection,
} from '../../src/lib/brand-locations/portfolio';

function location(
  id: string,
  brandId: string,
  countryCode: string,
  languageCode: string,
): ManagedLocation {
  return {
    id,
    brandId,
    countryCode,
    languageCode,
    topics: [],
    competitors: [],
    isDefault: id === '10',
    autoScanEnabled: true,
    lastAutoScanAt: null,
    nextAutoScanAt: null,
    archivedAt: null,
    createdAt: '2026-09-04T00:00:00.000Z',
    updatedAt: '2026-09-04T00:00:00.000Z',
  };
}

const germany = location('10', '1', 'de', 'de');
const unitedKingdom = location('11', '1', 'gb', 'en');
const brand: ManagedBrand = {
  id: '1',
  name: 'Selecdoo',
  normalizedDomain: 'selecdoo.com',
  bio: null,
  affiliateTypes: [],
  isDefault: true,
  archivedAt: null,
  createdAt: '2026-09-04T00:00:00.000Z',
  updatedAt: '2026-09-04T00:00:00.000Z',
  locations: [germany, unitedKingdom],
};
const selections: ManagedPortfolioSelection[] = [
  { brand, location: germany },
  { brand, location: unitedKingdom },
];

test('affiliate location presentation resolves the stored ID without guessing', () => {
  assert.deepEqual(
    resolveBrandLocationPresentation(selections, '11', 'en'),
    {
      brandId: '1',
      brandName: 'Selecdoo',
      locationId: '11',
      countryCode: 'GB',
      languageCode: 'EN',
      countryName: 'United Kingdom',
      languageName: 'English',
      codeLabel: 'GB · EN',
      fullLabel: 'United Kingdom · English',
      flagUrl: 'https://flagcdn.com/w40/gb.png',
    },
  );
  assert.equal(resolveBrandLocationPresentation(selections, '999', 'en'), null);
  assert.equal(resolveBrandLocationPresentation(selections, undefined, 'en'), null);
});

test('affiliate location presentation follows the dashboard language', () => {
  const presentation = resolveBrandLocationPresentation(selections, '10', 'de');
  assert.equal(presentation?.fullLabel, 'Deutschland · Deutsch');
  assert.equal(presentation?.codeLabel, 'DE · DE');
});

test('location export names distinguish one, partial, and all-location scopes', () => {
  assert.equal(buildLocationExportSlug('Revenue Works!', 'us'), 'revenue-works-us');
  assert.equal(
    buildLocationScopeExportSlug('Selecdoo', [germany], 2),
    'selecdoo-de',
  );
  assert.equal(
    buildLocationScopeExportSlug('Selecdoo', [germany, unitedKingdom], 2),
    'selecdoo-all-locations',
  );
  assert.equal(
    buildLocationScopeExportSlug('Selecdoo', [germany, unitedKingdom], 5),
    'selecdoo-2-locations',
  );
});
