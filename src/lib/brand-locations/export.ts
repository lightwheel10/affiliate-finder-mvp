import type { ManagedLocation } from '@/lib/brand-locations/portfolio';

function slugifyBrandName(brandName: string): string {
  return brandName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'brand';
}

/**
 * Build a short, filesystem-safe label for location-scoped downloads.
 * The result is presentation only; immutable database IDs remain the real
 * authorization and ownership boundary.
 */
export function buildLocationExportSlug(
  brandName: string,
  countryCode: string | null,
): string {
  const brandSlug = slugifyBrandName(brandName);
  const countrySlug = /^[a-z]{2}$/.test(countryCode ?? '')
    ? countryCode
    : 'market';

  return `${brandSlug}-${countrySlug}`;
}

/**
 * Name a multi-location download honestly. A complete brand scope says
 * "all-locations"; a partial scope says exactly how many locations it holds.
 */
export function buildLocationScopeExportSlug(
  brandName: string,
  selectedLocations: readonly ManagedLocation[],
  activeLocationCount: number,
): string {
  if (selectedLocations.length <= 1) {
    return buildLocationExportSlug(
      brandName,
      selectedLocations[0]?.countryCode ?? null,
    );
  }

  const scopeSlug = selectedLocations.length === activeLocationCount
    ? 'all-locations'
    : `${selectedLocations.length}-locations`;
  return `${slugifyBrandName(brandName)}-${scopeSlug}`;
}
