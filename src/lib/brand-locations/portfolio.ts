import type { PlanId } from '@/lib/plans/catalog';

/**
 * Client-safe portfolio contracts shared by the management API and dashboard.
 * Keep database adapters out of this module so importing these types never
 * pulls server-only code into a browser bundle.
 */
export interface ManagedLocation {
  id: string;
  brandId: string;
  countryCode: string | null;
  languageCode: string | null;
  topics: string[];
  competitors: string[];
  isDefault: boolean;
  autoScanEnabled: boolean;
  lastAutoScanAt: string | null;
  nextAutoScanAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ManagedBrand {
  id: string;
  name: string;
  normalizedDomain: string | null;
  bio: string | null;
  affiliateTypes: string[];
  isDefault: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  locations: ManagedLocation[];
}

export interface ManagedCapacity {
  plan: PlanId;
  maxBrands: number;
  maxLocationsPerAccount: number;
  activeBrands: number;
  activeLocations: number;
}

export interface ManagedPortfolio {
  brands: ManagedBrand[];
  capacity: ManagedCapacity | null;
}

export interface ManagedPortfolioSelection {
  brand: ManagedBrand;
  location: ManagedLocation;
}

export interface ManagedPortfolioLocationGroup {
  brand: ManagedBrand;
  locations: ManagedLocation[];
}

export interface BrandLocationScopePreference {
  activeBrandId: string | null;
  locationIdsByBrand: Record<string, string[]>;
}

export interface ManagedPortfolioScope {
  brand: ManagedBrand;
  locations: ManagedLocation[];
  /**
   * A deterministic single location for workflows (such as a new search) that
   * cannot operate on an aggregate dashboard scope.
   */
  defaultActionLocation: ManagedLocation;
}

export type BrandPortfolioCacheKey = readonly [
  endpoint: string,
  authUserId: string,
];

/**
 * Keep browser data caches separated by the immutable Supabase Auth identity.
 * The API still derives account ownership from the session; the UUID is only a
 * cache partition and never an authorization input.
 */
export function buildBrandPortfolioCacheKey(
  authUserId: string | null,
  includeArchived: boolean,
): BrandPortfolioCacheKey | null {
  if (!authUserId) return null;
  return [
    `/api/brands${includeArchived ? '?includeArchived=true' : ''}`,
    authUserId,
  ] as const;
}

export function buildActiveLocationStorageKey(authUserId: string): string {
  return `afforce_active_brand_location:${authUserId}`;
}

export function buildBrandLocationScopeStorageKey(authUserId: string): string {
  return `afforce_brand_location_scope:v1:${authUserId}`;
}

const MAX_STORED_BRANDS = 100;
const MAX_STORED_LOCATIONS_PER_BRAND = 100;

function isStorageId(value: unknown): value is string {
  return typeof value === 'string' && /^[1-9][0-9]{0,18}$/.test(value);
}

/**
 * Treat localStorage as untrusted input. Invalid or unexpectedly large saved
 * preferences are ignored before they can influence dashboard state.
 */
export function parseBrandLocationScopePreference(
  rawValue: string | null,
): BrandLocationScopePreference | null {
  if (!rawValue) return null;
  try {
    const parsed = JSON.parse(rawValue) as {
      activeBrandId?: unknown;
      locationIdsByBrand?: unknown;
    };
    if (
      parsed === null
      || typeof parsed !== 'object'
      || (parsed.activeBrandId !== null && !isStorageId(parsed.activeBrandId))
      || parsed.locationIdsByBrand === null
      || typeof parsed.locationIdsByBrand !== 'object'
      || Array.isArray(parsed.locationIdsByBrand)
    ) {
      return null;
    }

    const entries = Object.entries(parsed.locationIdsByBrand as Record<string, unknown>);
    if (entries.length > MAX_STORED_BRANDS) return null;
    const locationIdsByBrand: Record<string, string[]> = {};
    for (const [brandId, value] of entries) {
      if (
        !isStorageId(brandId)
        || !Array.isArray(value)
        || value.length > MAX_STORED_LOCATIONS_PER_BRAND
        || !value.every(isStorageId)
      ) {
        return null;
      }
      locationIdsByBrand[brandId] = Array.from(new Set(value));
    }
    return {
      activeBrandId: parsed.activeBrandId ?? null,
      locationIdsByBrand,
    };
  } catch {
    return null;
  }
}

export function listActivePortfolioLocations(
  portfolio: ManagedPortfolio | undefined,
): ManagedPortfolioSelection[] {
  if (!portfolio) return [];
  return portfolio.brands.flatMap((brand) => {
    if (brand.archivedAt !== null) return [];
    return brand.locations
      .filter((location) => location.archivedAt === null)
      .map((location) => ({ brand, location }));
  });
}

/** Preserve portfolio order while grouping every selectable location by brand. */
export function groupActivePortfolioLocations(
  selections: ManagedPortfolioSelection[],
): ManagedPortfolioLocationGroup[] {
  const groups = new Map<string, ManagedPortfolioLocationGroup>();
  for (const { brand, location } of selections) {
    const existing = groups.get(brand.id);
    if (existing) {
      existing.locations.push(location);
    } else {
      groups.set(brand.id, { brand, locations: [location] });
    }
  }
  return Array.from(groups.values());
}

/** Resolve an exact active market without ever crossing the selected brand. */
export function findActiveBrandMarketLocation(
  brand: ManagedBrand | null | undefined,
  countryCode: string,
  languageCode: string,
): ManagedLocation | undefined {
  return brand?.locations.find(
    (location) => location.archivedAt === null
      && location.countryCode === countryCode
      && location.languageCode === languageCode,
  );
}

/**
 * Resolve a browser preference only after matching it against the authenticated
 * portfolio response. The preference chooses UI state; it never grants access.
 */
export function resolveManagedPortfolioSelection(
  portfolio: ManagedPortfolio | undefined,
  preferredLocationId: string | null,
): ManagedPortfolioSelection | null {
  const activeLocations = listActivePortfolioLocations(portfolio);
  if (activeLocations.length === 0) return null;

  if (preferredLocationId) {
    const preferred = activeLocations.find(
      ({ location }) => location.id === preferredLocationId,
    );
    if (preferred) return preferred;
  }

  return activeLocations.find(
    ({ brand, location }) => brand.isDefault && location.isDefault,
  )
    ?? activeLocations.find(({ brand }) => brand.isDefault)
    ?? activeLocations.find(({ location }) => location.isDefault)
     ?? activeLocations[0];
}

function listSelectableBrands(portfolio: ManagedPortfolio | undefined): ManagedBrand[] {
  if (!portfolio) return [];
  return portfolio.brands.filter(
    (brand) => brand.archivedAt === null
      && brand.locations.some((location) => location.archivedAt === null),
  );
}

/**
 * Resolve the user's saved brand and multi-location view against the latest
 * authenticated portfolio. A stale/forged browser preference can only select
 * IDs that the server already returned for this account and active brand.
 */
export function resolveManagedPortfolioScope(
  portfolio: ManagedPortfolio | undefined,
  preference: BrandLocationScopePreference | null,
  legacyLocationId: string | null = null,
): ManagedPortfolioScope | null {
  const brands = listSelectableBrands(portfolio);
  if (brands.length === 0) return null;

  const legacySelection = legacyLocationId
    ? listActivePortfolioLocations(portfolio).find(
      ({ location }) => location.id === legacyLocationId,
    )
    : undefined;
  const brand = brands.find((candidate) => candidate.id === preference?.activeBrandId)
    ?? legacySelection?.brand
    ?? brands.find((candidate) => candidate.isDefault)
    ?? brands[0];
  const activeBrandLocations = brand.locations.filter(
    (location) => location.archivedAt === null,
  );
  const preferredIds = new Set(preference?.locationIdsByBrand[brand.id] ?? []);
  let locations = activeBrandLocations.filter((location) => preferredIds.has(location.id));

  if (locations.length === 0 && legacySelection?.brand.id === brand.id) {
    locations = [legacySelection.location];
  }
  if (locations.length === 0) {
    locations = [
      activeBrandLocations.find((location) => location.isDefault)
        ?? activeBrandLocations[0],
    ];
  }

  const defaultActionLocation = locations.length === 1
    ? locations[0]
    : locations.find((location) => location.isDefault)
      ?? activeBrandLocations.find((location) => location.isDefault)
      ?? locations[0];

  return { brand, locations, defaultActionLocation };
}

export function canonicalizeBrandLocationScopePreference(
  scope: ManagedPortfolioScope,
  current: BrandLocationScopePreference | null,
): BrandLocationScopePreference {
  return {
    activeBrandId: scope.brand.id,
    locationIdsByBrand: {
      ...(current?.locationIdsByBrand ?? {}),
      [scope.brand.id]: scope.locations.map((location) => location.id),
    },
  };
}
