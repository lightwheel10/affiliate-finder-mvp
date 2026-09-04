import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MARKET_COUNTRIES,
  MARKET_LANGUAGES,
  getCountryFlagUrl,
  getMarketCountry,
  getMarketCountryByIsoCode,
  getMarketLanguage,
  getMarketLanguageByIsoCode,
} from '../../src/lib/markets/catalog';
import { getApifyGoogleLocationInput } from '../../src/lib/markets/apify-google';
import {
  getAllowedTLDs,
  getLocationConfig,
} from '../../src/app/services/location';

test('market country names and ISO codes are unique', () => {
  assert.equal(new Set(MARKET_COUNTRIES.map(({ name }) => name)).size, MARKET_COUNTRIES.length);
  assert.equal(new Set(MARKET_COUNTRIES.map(({ isoCode }) => isoCode)).size, MARKET_COUNTRIES.length);
});

test('United Kingdom uses the provider-supported gb code', () => {
  assert.equal(getMarketCountry('United Kingdom')?.isoCode, 'gb');
  assert.equal(getMarketCountryByIsoCode('gb')?.name, 'United Kingdom');
  assert.equal(
    MARKET_COUNTRIES.some(({ isoCode }) => String(isoCode) === 'uk'),
    false,
  );
});

test('country flag URLs are derived safely from canonical country codes', () => {
  assert.equal(getCountryFlagUrl('de'), 'https://flagcdn.com/w40/de.png');
  assert.equal(getCountryFlagUrl(' GB '), 'https://flagcdn.com/w40/gb.png');
  assert.equal(getCountryFlagUrl(null), null);
  assert.equal(getCountryFlagUrl('gbr'), null);
});

test('Apify receives only its supported canonical location fields', () => {
  const input = getApifyGoogleLocationInput('United Kingdom', 'English');

  assert.deepEqual(input, {
    countryCode: 'gb',
    languageCode: 'en',
    searchLanguage: 'en',
  });
  assert.equal('googleDomain' in input, false);
  assert.deepEqual(getApifyGoogleLocationInput('gb', 'en'), input);
});

test('market language names and ISO codes are unique', () => {
  assert.equal(new Set(MARKET_LANGUAGES.map(({ name }) => name)).size, MARKET_LANGUAGES.length);
  assert.equal(new Set(MARKET_LANGUAGES.map(({ isoCode }) => isoCode)).size, MARKET_LANGUAGES.length);
  assert.equal(getMarketLanguage('English')?.isoCode, 'en');
  assert.equal(getMarketLanguage('en')?.name, 'English');
  assert.equal(getMarketLanguageByIsoCode('en')?.name, 'English');
});

test('canonical location codes drive provider and post-filter location settings', () => {
  assert.equal(getMarketCountry('gb')?.name, 'United Kingdom');
  assert.deepEqual(getLocationConfig('gb', 'en'), {
    countryCode: 'gb',
    languageCode: 'en',
    shortName: 'UK',
  });
  assert.deepEqual(getAllowedTLDs('gb'), getAllowedTLDs('United Kingdom'));
});

test('all market TLDs are normalized', () => {
  for (const country of MARKET_COUNTRIES) {
    assert.ok(country.allowedTlds.length > 0, `${country.name} has no TLD policy`);
    for (const tld of country.allowedTlds) {
      assert.match(tld, /^\.[a-z0-9.]+$/);
      assert.equal(tld, tld.toLowerCase());
    }
  }
});
