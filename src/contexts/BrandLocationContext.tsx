'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useBrandPortfolio } from '@/app/hooks/useBrandPortfolio';
import {
  buildActiveLocationStorageKey,
  buildBrandLocationScopeStorageKey,
  canonicalizeBrandLocationScopePreference,
  listActivePortfolioLocations,
  parseBrandLocationScopePreference,
  resolveManagedPortfolioScope,
  type BrandLocationScopePreference,
  type ManagedBrand,
  type ManagedLocation,
  type ManagedPortfolio,
  type ManagedPortfolioSelection,
} from '@/lib/brand-locations/portfolio';
import { useSupabaseUser } from '@/app/hooks/useSupabaseUser';

interface BrandLocationContextValue {
  featureEnabled: boolean;
  portfolio: ManagedPortfolio | undefined;
  activeBrand: ManagedBrand | null;
  activeLocation: ManagedLocation | null;
  selectedLocations: ManagedLocation[];
  locationScopeId: string | undefined;
  locationScopeIds: string[] | undefined;
  activeLocations: ManagedPortfolioSelection[];
  isLoading: boolean;
  isReady: boolean;
  error: Error | null;
  selectBrand: (brandId: string) => void;
  selectLocation: (locationId: string) => void;
  setSelectedLocations: (locationIds: string[]) => void;
  toggleLocation: (locationId: string) => void;
  selectAllBrandLocations: () => void;
  refreshPortfolio: () => Promise<void>;
}

const BrandLocationContext = createContext<BrandLocationContextValue | null>(null);

export function BrandLocationProvider({ children }: { children: ReactNode }) {
  const { supabaseUser } = useSupabaseUser();
  const authUserId = supabaseUser?.id ?? null;
  const {
    featureEnabled,
    portfolio,
    error: portfolioError,
    isLoading: portfolioLoading,
    refresh,
  } = useBrandPortfolio(authUserId, false);
  const [preference, setPreference] = useState<BrandLocationScopePreference | null>(null);
  const [legacyLocationId, setLegacyLocationId] = useState<string | null>(null);
  const [preferenceLoaded, setPreferenceLoaded] = useState(!featureEnabled);

  useEffect(() => {
    if (!featureEnabled) return;
    const handlePortfolioUpdate = () => {
      void refresh().catch((error) => {
        console.error('[BrandLocationContext] Could not refresh the updated portfolio:', error);
      });
    };
    window.addEventListener('brand-portfolio-updated', handlePortfolioUpdate);
    return () => window.removeEventListener('brand-portfolio-updated', handlePortfolioUpdate);
  }, [featureEnabled, refresh]);

  useEffect(() => {
    // The preference is account-scoped. Clear the previous identity's value
    // before reading the next one so no location selection can bridge users.
    setPreference(null);
    setLegacyLocationId(null);
    if (!featureEnabled) {
      setPreferenceLoaded(true);
      return;
    }
    setPreferenceLoaded(false);
    if (!authUserId) return;
    try {
      setPreference(
        parseBrandLocationScopePreference(
          window.localStorage.getItem(buildBrandLocationScopeStorageKey(authUserId)),
        ),
      );
      setLegacyLocationId(
        window.localStorage.getItem(buildActiveLocationStorageKey(authUserId)),
      );
    } catch (error) {
      console.warn('[BrandLocationContext] Could not read the saved location:', error);
    } finally {
      setPreferenceLoaded(true);
    }
  }, [authUserId, featureEnabled]);

  const activeLocations = useMemo(
    () => listActivePortfolioLocations(portfolio),
    [portfolio],
  );
  const scope = useMemo(
    () => resolveManagedPortfolioScope(portfolio, preference, legacyLocationId),
    [portfolio, preference, legacyLocationId],
  );

  useEffect(() => {
    if (!featureEnabled || !authUserId || !preferenceLoaded || !scope) return;
    const canonicalPreference = canonicalizeBrandLocationScopePreference(scope, preference);
    if (JSON.stringify(canonicalPreference) !== JSON.stringify(preference)) {
      setPreference(canonicalPreference);
    }
    try {
      window.localStorage.setItem(
        buildBrandLocationScopeStorageKey(authUserId),
        JSON.stringify(canonicalPreference),
      );
    } catch (error) {
      console.warn('[BrandLocationContext] Could not save the selected workspace scope:', error);
    }
  }, [authUserId, featureEnabled, preferenceLoaded, preference, scope]);

  const selectBrand = useCallback((brandId: string) => {
    const brand = portfolio?.brands.find(
      (candidate) => candidate.id === brandId
        && candidate.archivedAt === null
        && candidate.locations.some((location) => location.archivedAt === null),
    );
    if (!brand) {
      console.warn('[BrandLocationContext] Ignored a brand outside the active portfolio.');
      return;
    }
    const activeBrandLocations = brand.locations.filter(
      (location) => location.archivedAt === null,
    );
    setPreference((current) => {
      const existingIds = new Set(current?.locationIdsByBrand[brand.id] ?? []);
      const validIds = activeBrandLocations
        .filter((location) => existingIds.has(location.id))
        .map((location) => location.id);
      const fallbackLocation = activeBrandLocations.find((location) => location.isDefault)
        ?? activeBrandLocations[0];
      return {
        activeBrandId: brand.id,
        locationIdsByBrand: {
          ...(current?.locationIdsByBrand ?? {}),
          [brand.id]: validIds.length > 0 ? validIds : [fallbackLocation.id],
        },
      };
    });
  }, [portfolio]);

  const selectLocation = useCallback((locationId: string) => {
    const selection = activeLocations.find(({ location }) => location.id === locationId);
    if (!selection) {
      // A location-creation response is authenticated and can arrive one render
      // before SWR exposes the refreshed portfolio. Queue that numeric ID under
      // the current brand; resolveManagedPortfolioScope still treats it as
      // untrusted and will discard it unless the refreshed server portfolio
      // confirms that it belongs to this account and brand.
      if (!scope || !/^[1-9][0-9]{0,18}$/.test(locationId)) {
        console.warn('[BrandLocationContext] Ignored a location outside the active portfolio.');
        return;
      }
      setPreference((current) => ({
        activeBrandId: scope.brand.id,
        locationIdsByBrand: {
          ...(current?.locationIdsByBrand ?? {}),
          [scope.brand.id]: [locationId],
        },
      }));
      return;
    }
    setPreference((current) => ({
      activeBrandId: selection.brand.id,
      locationIdsByBrand: {
        ...(current?.locationIdsByBrand ?? {}),
        [selection.brand.id]: [locationId],
      },
    }));
  }, [activeLocations, scope]);

  const setSelectedLocations = useCallback((locationIds: string[]) => {
    if (!scope) return;
    const requestedIds = new Set(locationIds);
    const validIds = scope.brand.locations
      .filter((location) => location.archivedAt === null && requestedIds.has(location.id))
      .map((location) => location.id);
    if (validIds.length === 0) {
      console.warn('[BrandLocationContext] A dashboard scope must include at least one location.');
      return;
    }
    setPreference((current) => ({
      activeBrandId: scope.brand.id,
      locationIdsByBrand: {
        ...(current?.locationIdsByBrand ?? {}),
        [scope.brand.id]: validIds,
      },
    }));
  }, [scope]);

  const toggleLocation = useCallback((locationId: string) => {
    if (!scope) return;
    const activeBrandLocationIds = new Set(
      scope.brand.locations
        .filter((location) => location.archivedAt === null)
        .map((location) => location.id),
    );
    if (!activeBrandLocationIds.has(locationId)) {
      console.warn('[BrandLocationContext] Ignored a location outside the active brand.');
      return;
    }
    const selectedIds = scope.locations.map((location) => location.id);
    // The dashboard always needs one concrete fallback location. A normal UI
    // click on the final selected location is therefore a harmless no-op.
    if (selectedIds.length === 1 && selectedIds[0] === locationId) {
      return;
    }
    const nextIds = selectedIds.includes(locationId)
      ? selectedIds.filter((id) => id !== locationId)
      : [...selectedIds, locationId];
    setSelectedLocations(nextIds);
  }, [scope, setSelectedLocations]);

  const selectAllBrandLocations = useCallback(() => {
    if (!scope) return;
    setSelectedLocations(
      scope.brand.locations
        .filter((location) => location.archivedAt === null)
        .map((location) => location.id),
    );
  }, [scope, setSelectedLocations]);

  const refreshPortfolio = useCallback(async () => {
    await refresh();
  }, [refresh]);

  const isLoading = featureEnabled && (portfolioLoading || !preferenceLoaded);
  const missingSelectionError = useMemo(() => {
    if (!featureEnabled || isLoading || portfolioError || scope) return null;
    return new Error('No active brand location is available for this account.');
  }, [featureEnabled, isLoading, portfolioError, scope]);
  const error = portfolioError ?? missingSelectionError;
  const isReady = !featureEnabled || (!isLoading && scope !== null && error === null);

  const selectedLocationIds = useMemo(
    () => scope?.locations.map((location) => location.id),
    [scope],
  );

  const value = useMemo<BrandLocationContextValue>(() => ({
    featureEnabled,
    portfolio,
    activeBrand: scope?.brand ?? null,
    activeLocation: scope?.defaultActionLocation ?? null,
    selectedLocations: scope?.locations ?? [],
    locationScopeId: featureEnabled && selectedLocationIds?.length === 1
      ? selectedLocationIds[0]
      : undefined,
    locationScopeIds: featureEnabled ? selectedLocationIds : undefined,
    activeLocations,
    isLoading,
    isReady,
    error,
    selectBrand,
    selectLocation,
    setSelectedLocations,
    toggleLocation,
    selectAllBrandLocations,
    refreshPortfolio,
  }), [
    featureEnabled,
    portfolio,
    scope,
    selectedLocationIds,
    activeLocations,
    isLoading,
    isReady,
    error,
    selectBrand,
    selectLocation,
    setSelectedLocations,
    toggleLocation,
    selectAllBrandLocations,
    refreshPortfolio,
  ]);

  return (
    <BrandLocationContext.Provider value={value}>
      {children}
    </BrandLocationContext.Provider>
  );
}

export function useBrandLocation(): BrandLocationContextValue {
  const context = useContext(BrandLocationContext);
  if (!context) {
    throw new Error('useBrandLocation must be used inside BrandLocationProvider.');
  }
  return context;
}
