import { getMarketCountry, getMarketLanguage } from './catalog';

export interface ApifyGoogleLocationInput {
  countryCode: string;
  languageCode: string;
  searchLanguage: string;
}

/**
 * Build only the location fields accepted by Apify's Google Search Scraper.
 * The empty searchLanguage fallback preserves the current global-search
 * behaviour when no supported country is configured.
 */
export function getApifyGoogleLocationInput(
  targetCountry: string | null | undefined,
  targetLanguage: string | null | undefined,
): ApifyGoogleLocationInput {
  const country = getMarketCountry(targetCountry);
  if (!country) {
    return {
      countryCode: 'us',
      languageCode: 'en',
      searchLanguage: '',
    };
  }

  const languageCode = getMarketLanguage(targetLanguage)?.isoCode ?? 'en';
  return {
    countryCode: country.isoCode,
    languageCode,
    searchLanguage: languageCode,
  };
}
