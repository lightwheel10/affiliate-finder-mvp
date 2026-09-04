import type { ManagedPortfolioSelection } from '@/lib/brand-locations/portfolio';
import {
  getCountryFlagUrl,
  getMarketCountryByIsoCode,
  getMarketLanguageByIsoCode,
} from '@/lib/markets/catalog';

export type PresentationLanguage = 'en' | 'de';

export interface BrandLocationPresentation {
  brandId: string;
  brandName: string;
  locationId: string;
  countryCode: string;
  languageCode: string;
  countryName: string;
  languageName: string;
  codeLabel: string;
  fullLabel: string;
  flagUrl: string | null;
}

function displayCode(value: string | null): string {
  return value?.toUpperCase() || '--';
}

/**
 * Convert the immutable location ID stored on an affiliate into safe display
 * data from the authenticated portfolio. Unknown IDs intentionally return
 * null instead of displaying guessed market information.
 */
export function resolveBrandLocationPresentation(
  locations: readonly ManagedPortfolioSelection[],
  brandLocationId: string | null | undefined,
  language: PresentationLanguage = 'en',
): BrandLocationPresentation | null {
  if (!brandLocationId) return null;

  const selection = locations.find(
    ({ location }) => location.id === brandLocationId,
  );
  if (!selection) return null;

  const country = getMarketCountryByIsoCode(selection.location.countryCode);
  const marketLanguage = getMarketLanguageByIsoCode(selection.location.languageCode);
  const countryCode = displayCode(selection.location.countryCode);
  const languageCode = displayCode(selection.location.languageCode);
  const countryName = language === 'de'
    ? country?.nameDE ?? countryCode
    : country?.name ?? countryCode;
  const languageName = language === 'de'
    ? marketLanguage?.nameDE ?? languageCode
    : marketLanguage?.name ?? languageCode;

  return {
    brandId: selection.brand.id,
    brandName: selection.brand.name,
    locationId: selection.location.id,
    countryCode,
    languageCode,
    countryName,
    languageName,
    codeLabel: `${countryCode} · ${languageCode}`,
    fullLabel: `${countryName} · ${languageName}`,
    flagUrl: getCountryFlagUrl(selection.location.countryCode),
  };
}
