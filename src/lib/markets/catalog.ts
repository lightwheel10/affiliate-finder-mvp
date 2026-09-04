export interface MarketCountry {
  name: string;
  nameDE: string;
  isoCode: string;
  queryLabel: string;
  allowedTlds: readonly string[];
}

export interface MarketLanguage {
  name: string;
  nameDE: string;
  isoCode: string;
  flagCountryCode: string;
}

export const MARKET_COUNTRIES = [
  { name: 'United States', nameDE: 'Vereinigte Staaten', isoCode: 'us', queryLabel: 'USA', allowedTlds: ['.com', '.net', '.org', '.io', '.us', '.ca', '.co.uk', '.au', '.nz'] },
  { name: 'Canada', nameDE: 'Kanada', isoCode: 'ca', queryLabel: 'Canada', allowedTlds: ['.com', '.net', '.org', '.io', '.ca', '.us', '.co.uk'] },
  { name: 'United Kingdom', nameDE: 'Vereinigtes Königreich', isoCode: 'gb', queryLabel: 'UK', allowedTlds: ['.com', '.net', '.org', '.io', '.co.uk', '.uk', '.ie'] },
  { name: 'Germany', nameDE: 'Deutschland', isoCode: 'de', queryLabel: 'Germany', allowedTlds: ['.com', '.net', '.org', '.io', '.de', '.at', '.ch'] },
  { name: 'France', nameDE: 'Frankreich', isoCode: 'fr', queryLabel: 'France', allowedTlds: ['.com', '.net', '.org', '.io', '.fr', '.be', '.ch'] },
  { name: 'Netherlands', nameDE: 'Niederlande', isoCode: 'nl', queryLabel: 'Netherlands', allowedTlds: ['.com', '.net', '.org', '.io', '.nl', '.be'] },
  { name: 'Belgium', nameDE: 'Belgien', isoCode: 'be', queryLabel: 'Belgium', allowedTlds: ['.com', '.net', '.org', '.io', '.be', '.fr', '.nl'] },
  { name: 'Switzerland', nameDE: 'Schweiz', isoCode: 'ch', queryLabel: 'Switzerland', allowedTlds: ['.com', '.net', '.org', '.io', '.ch', '.de', '.at'] },
  { name: 'Austria', nameDE: 'Österreich', isoCode: 'at', queryLabel: 'Austria', allowedTlds: ['.com', '.net', '.org', '.io', '.at', '.de', '.ch'] },
  { name: 'Ireland', nameDE: 'Irland', isoCode: 'ie', queryLabel: 'Ireland', allowedTlds: ['.com', '.net', '.org', '.io', '.ie', '.co.uk', '.uk'] },
  { name: 'Denmark', nameDE: 'Dänemark', isoCode: 'dk', queryLabel: 'Denmark', allowedTlds: ['.com', '.net', '.org', '.io', '.dk', '.se', '.no'] },
  { name: 'Sweden', nameDE: 'Schweden', isoCode: 'se', queryLabel: 'Sweden', allowedTlds: ['.com', '.net', '.org', '.io', '.se', '.dk', '.no', '.fi'] },
  { name: 'Norway', nameDE: 'Norwegen', isoCode: 'no', queryLabel: 'Norway', allowedTlds: ['.com', '.net', '.org', '.io', '.no', '.se', '.dk'] },
  { name: 'Finland', nameDE: 'Finnland', isoCode: 'fi', queryLabel: 'Finland', allowedTlds: ['.com', '.net', '.org', '.io', '.fi', '.se'] },
  { name: 'Spain', nameDE: 'Spanien', isoCode: 'es', queryLabel: 'Spain', allowedTlds: ['.com', '.net', '.org', '.io', '.es', '.mx', '.ar'] },
  { name: 'Italy', nameDE: 'Italien', isoCode: 'it', queryLabel: 'Italy', allowedTlds: ['.com', '.net', '.org', '.io', '.it', '.ch'] },
  { name: 'Portugal', nameDE: 'Portugal', isoCode: 'pt', queryLabel: 'Portugal', allowedTlds: ['.com', '.net', '.org', '.io', '.pt', '.br'] },
  { name: 'Poland', nameDE: 'Polen', isoCode: 'pl', queryLabel: 'Poland', allowedTlds: ['.com', '.net', '.org', '.io', '.pl'] },
  { name: 'Czech Republic', nameDE: 'Tschechien', isoCode: 'cz', queryLabel: 'Czech', allowedTlds: ['.com', '.net', '.org', '.io', '.cz', '.sk'] },
  { name: 'Australia', nameDE: 'Australien', isoCode: 'au', queryLabel: 'Australia', allowedTlds: ['.com', '.net', '.org', '.io', '.au', '.nz', '.co.uk'] },
  { name: 'New Zealand', nameDE: 'Neuseeland', isoCode: 'nz', queryLabel: 'New Zealand', allowedTlds: ['.com', '.net', '.org', '.io', '.nz', '.au'] },
  { name: 'Japan', nameDE: 'Japan', isoCode: 'jp', queryLabel: 'Japan', allowedTlds: ['.com', '.net', '.org', '.io', '.jp'] },
  { name: 'South Korea', nameDE: 'Südkorea', isoCode: 'kr', queryLabel: 'Korea', allowedTlds: ['.com', '.net', '.org', '.io', '.kr'] },
  { name: 'Singapore', nameDE: 'Singapur', isoCode: 'sg', queryLabel: 'Singapore', allowedTlds: ['.com', '.net', '.org', '.io', '.sg'] },
  { name: 'United Arab Emirates', nameDE: 'Vereinigte Arabische Emirate', isoCode: 'ae', queryLabel: 'UAE', allowedTlds: ['.com', '.net', '.org', '.io', '.ae'] },
  { name: 'Israel', nameDE: 'Israel', isoCode: 'il', queryLabel: 'Israel', allowedTlds: ['.com', '.net', '.org', '.io', '.il'] },
  { name: 'Saudi Arabia', nameDE: 'Saudi-Arabien', isoCode: 'sa', queryLabel: 'Saudi Arabia', allowedTlds: ['.com', '.net', '.org', '.io', '.sa', '.ae'] },
] as const satisfies readonly MarketCountry[];

export const MARKET_LANGUAGES = [
  { name: 'English', nameDE: 'Englisch', isoCode: 'en', flagCountryCode: 'gb' },
  { name: 'Spanish', nameDE: 'Spanisch', isoCode: 'es', flagCountryCode: 'es' },
  { name: 'German', nameDE: 'Deutsch', isoCode: 'de', flagCountryCode: 'de' },
  { name: 'French', nameDE: 'Französisch', isoCode: 'fr', flagCountryCode: 'fr' },
  { name: 'Portuguese', nameDE: 'Portugiesisch', isoCode: 'pt', flagCountryCode: 'pt' },
  { name: 'Italian', nameDE: 'Italienisch', isoCode: 'it', flagCountryCode: 'it' },
  { name: 'Dutch', nameDE: 'Niederländisch', isoCode: 'nl', flagCountryCode: 'nl' },
  { name: 'Swedish', nameDE: 'Schwedisch', isoCode: 'sv', flagCountryCode: 'se' },
  { name: 'Danish', nameDE: 'Dänisch', isoCode: 'da', flagCountryCode: 'dk' },
  { name: 'Norwegian', nameDE: 'Norwegisch', isoCode: 'no', flagCountryCode: 'no' },
  { name: 'Finnish', nameDE: 'Finnisch', isoCode: 'fi', flagCountryCode: 'fi' },
  { name: 'Polish', nameDE: 'Polnisch', isoCode: 'pl', flagCountryCode: 'pl' },
  { name: 'Czech', nameDE: 'Tschechisch', isoCode: 'cs', flagCountryCode: 'cz' },
  { name: 'Japanese', nameDE: 'Japanisch', isoCode: 'ja', flagCountryCode: 'jp' },
  { name: 'Korean', nameDE: 'Koreanisch', isoCode: 'ko', flagCountryCode: 'kr' },
  { name: 'Arabic', nameDE: 'Arabisch', isoCode: 'ar', flagCountryCode: 'sa' },
  { name: 'Hebrew', nameDE: 'Hebräisch', isoCode: 'he', flagCountryCode: 'il' },
] as const satisfies readonly MarketLanguage[];

export type MarketCountryName = (typeof MARKET_COUNTRIES)[number]['name'];
export type MarketLanguageName = (typeof MARKET_LANGUAGES)[number]['name'];

const countriesByName = new Map<string, (typeof MARKET_COUNTRIES)[number]>(
  MARKET_COUNTRIES.map((country) => [country.name, country]),
);
const countriesByIsoCode = new Map<string, (typeof MARKET_COUNTRIES)[number]>(
  MARKET_COUNTRIES.map((country) => [country.isoCode, country]),
);
const languagesByName = new Map<string, (typeof MARKET_LANGUAGES)[number]>(
  MARKET_LANGUAGES.map((language) => [language.name, language]),
);
const languagesByIsoCode = new Map<string, (typeof MARKET_LANGUAGES)[number]>(
  MARKET_LANGUAGES.map((language) => [language.isoCode, language]),
);

/** Resolve both legacy display names and the canonical ISO value stored now. */
export function getMarketCountry(value: string | null | undefined) {
  return value
    ? countriesByName.get(value) ?? countriesByIsoCode.get(value)
    : undefined;
}

/** Resolve both legacy display names and the canonical ISO value stored now. */
export function getMarketLanguage(value: string | null | undefined) {
  return value
    ? languagesByName.get(value) ?? languagesByIsoCode.get(value)
    : undefined;
}

export function getMarketCountryByIsoCode(code: string | null | undefined) {
  return code ? countriesByIsoCode.get(code) : undefined;
}

export function getMarketLanguageByIsoCode(code: string | null | undefined) {
  return code ? languagesByIsoCode.get(code) : undefined;
}

/** Return the shared flag asset URL only for a valid two-letter country code. */
export function getCountryFlagUrl(code: string | null | undefined): string | null {
  const normalizedCode = code?.trim().toLowerCase() ?? '';
  return /^[a-z]{2}$/.test(normalizedCode)
    ? `https://flagcdn.com/w40/${normalizedCode}.png`
    : null;
}

export function isMarketCountryName(value: string): value is MarketCountryName {
  return countriesByName.has(value);
}

export function isMarketLanguageName(value: string): value is MarketLanguageName {
  return languagesByName.has(value);
}
