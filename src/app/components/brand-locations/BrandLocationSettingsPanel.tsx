'use client';

import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Archive,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Globe2,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
} from 'lucide-react';
import { Modal } from '@/app/components/Modal';
import {
  BrandFormModal,
  type BrandFormPayload,
} from '@/app/components/brand-locations/BrandFormModal';
import {
  LocationFormModal,
  type LocationFormPayload,
} from '@/app/components/brand-locations/LocationFormModal';
import {
  BrandLocationApiError,
  requestBrandLocationApi,
  useBrandPortfolio,
} from '@/app/hooks/useBrandPortfolio';
import { useSupabaseUser } from '@/app/hooks/useSupabaseUser';
import { useBrandLocation } from '@/contexts/BrandLocationContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  getMarketCountryByIsoCode,
  getMarketLanguageByIsoCode,
} from '@/lib/markets/catalog';
import type {
  ManagedBrand,
  ManagedLocation,
} from '@/lib/brand-locations/portfolio';

type ArchiveTarget = {
  kind: 'brand' | 'location';
  id: string;
  name: string;
};

type PendingAction = {
  kind: 'archive' | 'restore';
  id: string;
} | null;

function hasCapacity(current: number, maximum: number): boolean {
  return maximum < 0 || current < maximum;
}

export function BrandLocationSettingsPanel() {
  const { language, t } = useLanguage();
  const copy = t.dashboard.brandLocations;
  const { supabaseUser } = useSupabaseUser();
  const {
    portfolio: activePortfolio,
    activeLocation,
    refreshPortfolio,
  } = useBrandLocation();
  const {
    featureEnabled,
    portfolio,
    error,
    isLoading,
    refresh,
  } = useBrandPortfolio(supabaseUser?.id ?? null, true, activePortfolio);
  const [showArchived, setShowArchived] = useState(false);
  const [brandEditor, setBrandEditor] = useState<{
    isOpen: boolean;
    brand: ManagedBrand | null;
  }>({ isOpen: false, brand: null });
  const [locationEditor, setLocationEditor] = useState<{
    isOpen: boolean;
    brand: ManagedBrand | null;
    location: ManagedLocation | null;
  }>({ isOpen: false, brand: null, location: null });
  const [archiveTarget, setArchiveTarget] = useState<ArchiveTarget | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const activeBrands = useMemo(
    () => portfolio?.brands.filter((brand) => brand.archivedAt === null) ?? [],
    [portfolio],
  );
  const archivedBrands = useMemo(
    () => portfolio?.brands.filter((brand) => brand.archivedAt !== null) ?? [],
    [portfolio],
  );
  const capacity = portfolio?.capacity ?? null;
  const canAddBrand = capacity !== null
    && hasCapacity(capacity.activeBrands, capacity.maxBrands);
  const canAddLocation = capacity !== null
    && hasCapacity(capacity.activeLocations, capacity.maxLocationsPerAccount);

  const formatError = useCallback((requestError: unknown): string => {
    if (!(requestError instanceof BrandLocationApiError)) return copy.errors.generic;
    switch (requestError.code) {
      case 'PLAN_LIMIT_REACHED':
        return copy.errors.planLimit;
      case 'SUBSCRIPTION_REQUIRED':
        return copy.errors.subscriptionRequired;
      case 'ACTIVE_SEARCH_CONFLICT':
        return copy.errors.activeSearch;
      case 'DEFAULT_CONTEXT_REQUIRED':
        return copy.errors.lastContext;
      case 'DUPLICATE_BRAND_DOMAIN':
        return copy.errors.duplicateBrand;
      case 'DUPLICATE_LOCATION_MARKET':
        return copy.errors.duplicateLocation;
      default:
        return copy.errors.generic;
    }
  }, [copy.errors]);

  const refreshBothPortfolios = useCallback(async (): Promise<boolean> => {
    const results = await Promise.allSettled([refresh(), refreshPortfolio()]);
    const refreshSucceeded = results.every((result) => result.status === 'fulfilled');
    if (!refreshSucceeded) {
      console.error('[BrandLocationSettingsPanel] A saved change could not be reloaded.', results);
    }
    return refreshSucceeded;
  }, [refresh, refreshPortfolio]);

  const notifyMutationResult = useCallback((refreshSucceeded: boolean) => {
    if (refreshSucceeded) {
      toast.success(t.common.success);
    } else {
      toast.warning(copy.errors.refreshFailed);
    }
  }, [copy.errors.refreshFailed, t.common.success]);

  const saveBrand = async (payload: BrandFormPayload) => {
    if (brandEditor.brand) {
      await requestBrandLocationApi(`/api/brands/${brandEditor.brand.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      const refreshSucceeded = await refreshBothPortfolios();
      setBrandEditor({ isOpen: false, brand: null });
      notifyMutationResult(refreshSucceeded);
      return;
    }

    const response = await requestBrandLocationApi<{ brand: ManagedBrand }>('/api/brands', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const refreshSucceeded = await refreshBothPortfolios();
    setBrandEditor({ isOpen: false, brand: null });
    notifyMutationResult(refreshSucceeded);
    if (canAddLocation) {
      setLocationEditor({ isOpen: true, brand: response.brand, location: null });
    }
  };

  const saveLocation = async (payload: LocationFormPayload) => {
    const brand = locationEditor.brand;
    if (!brand) throw new Error('Missing brand context.');
    if (locationEditor.location) {
      await requestBrandLocationApi(`/api/brand-locations/${locationEditor.location.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    } else {
      await requestBrandLocationApi(`/api/brands/${brand.id}/locations`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }
    const refreshSucceeded = await refreshBothPortfolios();
    setLocationEditor({ isOpen: false, brand: null, location: null });
    notifyMutationResult(refreshSucceeded);
  };

  const archiveItem = async () => {
    if (!archiveTarget) return;
    setPendingAction({ kind: 'archive', id: archiveTarget.id });
    try {
      const path = archiveTarget.kind === 'brand'
        ? `/api/brands/${archiveTarget.id}/archive`
        : `/api/brand-locations/${archiveTarget.id}/archive`;
      await requestBrandLocationApi(path, { method: 'POST' });
      const refreshSucceeded = await refreshBothPortfolios();
      setArchiveTarget(null);
      notifyMutationResult(refreshSucceeded);
    } catch (archiveError) {
      toast.error(formatError(archiveError));
    } finally {
      setPendingAction(null);
    }
  };

  const restoreItem = async (kind: 'brand' | 'location', id: string) => {
    setPendingAction({ kind: 'restore', id });
    try {
      const path = kind === 'brand'
        ? `/api/brands/${id}/restore`
        : `/api/brand-locations/${id}/restore`;
      await requestBrandLocationApi(path, { method: 'POST' });
      const refreshSucceeded = await refreshBothPortfolios();
      notifyMutationResult(refreshSucceeded);
    } catch (restoreError) {
      toast.error(formatError(restoreError));
    } finally {
      setPendingAction(null);
    }
  };

  if (!featureEnabled) return null;

  return (
    <>
      <section className="space-y-6">
        <header className="flex flex-col gap-4 border-b border-[#e6ebf1] pb-6 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-[#0f172a] dark:text-white">
            {copy.pageTitle}
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#8898aa]">{copy.pageSubtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => setBrandEditor({ isOpen: true, brand: null })}
          disabled={!canAddBrand}
          title={!canAddBrand ? copy.errors.planLimit : undefined}
          className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#ffbf23] px-4 py-2 text-sm font-semibold text-[#0f172a] shadow-yellow-glow-sm transition-[background-color,scale] duration-150 hover:bg-[#e5ac20] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={16} />
          {copy.addBrand}
        </button>
        </header>

          {capacity && (
            <section className="grid gap-3 sm:grid-cols-2" aria-label={copy.planCapacity}>
              <CapacityCard
                icon={<Building2 size={17} />}
                current={capacity.activeBrands}
                maximum={capacity.maxBrands}
                label={copy.brandsUsed}
                unlimitedLabel={copy.unlimited}
              />
              <CapacityCard
                icon={<Globe2 size={17} />}
                current={capacity.activeLocations}
                maximum={capacity.maxLocationsPerAccount}
                label={copy.locationsUsed}
                unlimitedLabel={copy.unlimited}
              />
            </section>
          )}

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/50 dark:bg-red-950/20">
              <p className="text-sm font-medium text-red-700 dark:text-red-300">{copy.errors.generic}</p>
              <button
                type="button"
                onClick={() => void refresh()}
                className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
              >
                <RefreshCw size={14} />
                {t.common.retry}
              </button>
            </div>
          ) : isLoading || !portfolio ? (
            <div className="flex min-h-64 items-center justify-center" role="status">
              <Loader2 size={20} className="animate-spin text-[#ffbf23]" />
              <span className="ml-3 text-sm font-medium text-[#425466] dark:text-gray-300">
                {copy.loadingPortfolio}
              </span>
            </div>
          ) : activeBrands.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#d8e0e8] bg-white p-10 text-center dark:border-gray-800 dark:bg-[#0f0f0f]">
              <Building2 size={28} className="mx-auto text-[#8898aa]" />
              <h2 className="mt-3 font-display text-lg font-bold text-[#0f172a] dark:text-white">{copy.noBrands}</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-[#8898aa]">{copy.noBrandsDescription}</p>
            </div>
          ) : (
            <section className="space-y-4" aria-label={copy.active}>
              {activeBrands.map((brand) => (
                <BrandCard
                  key={brand.id}
                  brand={brand}
                  activeLocationId={activeLocation?.id ?? null}
                  language={language}
                  showArchivedLocations={showArchived}
                  canAddLocation={canAddLocation}
                  pendingAction={pendingAction}
                  onEditBrand={() => setBrandEditor({ isOpen: true, brand })}
                  onAddLocation={() => setLocationEditor({ isOpen: true, brand, location: null })}
                  onEditLocation={(location) => setLocationEditor({ isOpen: true, brand, location })}
                  onArchiveBrand={() => setArchiveTarget({ kind: 'brand', id: brand.id, name: brand.name })}
                  onArchiveLocation={(location, name) => setArchiveTarget({ kind: 'location', id: location.id, name })}
                  onRestoreLocation={(location) => void restoreItem('location', location.id)}
                />
              ))}
            </section>
          )}

          {(archivedBrands.length > 0 || activeBrands.some((brand) => brand.locations.some((location) => location.archivedAt !== null))) && (
            <button
              type="button"
              onClick={() => setShowArchived((current) => !current)}
              className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#d8e0e8] bg-white px-4 py-2 text-sm font-medium text-[#425466] transition-colors duration-150 hover:bg-[#f6f9fc] dark:border-gray-700 dark:bg-[#0f0f0f] dark:text-gray-300 dark:hover:bg-gray-900"
            >
              {showArchived ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              {showArchived ? copy.hideArchived : copy.showArchived}
            </button>
          )}

          {showArchived && archivedBrands.length > 0 && (
            <section className="space-y-3" aria-label={copy.archived}>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-[#8898aa]">{copy.archived}</h2>
              {archivedBrands.map((brand) => (
                <div key={brand.id} className="flex items-center justify-between gap-4 rounded-2xl border border-[#e6ebf1] bg-white p-5 opacity-80 dark:border-gray-800 dark:bg-[#0f0f0f]">
                  <div className="min-w-0">
                    <p className="truncate font-display font-bold text-[#0f172a] dark:text-white">{brand.name}</p>
                    <p className="truncate text-xs text-[#8898aa]">{brand.normalizedDomain}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void restoreItem('brand', brand.id)}
                    disabled={pendingAction?.id === brand.id}
                    className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#d8e0e8] bg-white px-4 py-2 text-sm font-semibold text-[#425466] transition-colors duration-150 hover:bg-[#f6f9fc] disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                  >
                    {pendingAction?.id === brand.id ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                    {pendingAction?.id === brand.id ? copy.restoring : copy.restore}
                  </button>
                </div>
              ))}
            </section>
          )}
      </section>

      <BrandFormModal
        isOpen={brandEditor.isOpen}
        brand={brandEditor.brand}
        onClose={() => setBrandEditor({ isOpen: false, brand: null })}
        onSubmit={saveBrand}
        errorMessage={formatError}
      />
      <LocationFormModal
        isOpen={locationEditor.isOpen}
        brandName={locationEditor.brand?.name ?? ''}
        location={locationEditor.location}
        onClose={() => setLocationEditor({ isOpen: false, brand: null, location: null })}
        onSubmit={saveLocation}
        errorMessage={formatError}
      />
      <Modal
        isOpen={archiveTarget !== null}
        onClose={pendingAction ? () => undefined : () => setArchiveTarget(null)}
        title={archiveTarget?.kind === 'brand' ? copy.archiveBrandTitle : copy.archiveLocationTitle}
        width="max-w-md"
      >
        <div className="space-y-5">
          <div>
            <p className="font-semibold text-[#0f172a] dark:text-white">{archiveTarget?.name}</p>
            <p className="mt-2 text-sm leading-relaxed text-[#425466] dark:text-gray-400">
              {archiveTarget?.kind === 'brand' ? copy.archiveBrandMessage : copy.archiveLocationMessage}
            </p>
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
              {copy.archiveSafetyNote}
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setArchiveTarget(null)}
              disabled={pendingAction !== null}
              className="min-h-10 rounded-full border border-[#d8e0e8] bg-white px-5 py-2 text-sm font-medium text-[#425466] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
            >
              {t.common.cancel}
            </button>
            <button
              type="button"
              onClick={() => void archiveItem()}
              disabled={pendingAction !== null}
              className="inline-flex min-h-10 items-center gap-2 rounded-full bg-red-500 px-5 py-2 text-sm font-semibold text-white transition-[background-color,scale] duration-150 hover:bg-red-600 active:scale-[0.96] disabled:opacity-60"
            >
              {pendingAction ? <Loader2 size={15} className="animate-spin" /> : <Archive size={15} />}
              {pendingAction ? copy.archiving : copy.archive}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function CapacityCard({
  icon,
  current,
  maximum,
  label,
  unlimitedLabel,
}: {
  icon: React.ReactNode;
  current: number;
  maximum: number;
  label: string;
  unlimitedLabel: string;
}) {
  const maximumLabel = maximum < 0 ? unlimitedLabel : maximum.toString();
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#e6ebf1] bg-white px-4 py-3 shadow-soft-sm dark:border-gray-800 dark:bg-[#0f0f0f]">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#fff4d1] text-[#0f172a] dark:bg-[#ffbf23]/10 dark:text-[#ffbf23]">
        {icon}
      </span>
      <div>
        <p className="text-sm font-bold tabular-nums text-[#0f172a] dark:text-white">{current} / {maximumLabel}</p>
        <p className="text-xs text-[#8898aa]">{label}</p>
      </div>
    </div>
  );
}

function BrandCard({
  brand,
  activeLocationId,
  language,
  showArchivedLocations,
  canAddLocation,
  pendingAction,
  onEditBrand,
  onAddLocation,
  onEditLocation,
  onArchiveBrand,
  onArchiveLocation,
  onRestoreLocation,
}: {
  brand: ManagedBrand;
  activeLocationId: string | null;
  language: 'en' | 'de';
  showArchivedLocations: boolean;
  canAddLocation: boolean;
  pendingAction: PendingAction;
  onEditBrand: () => void;
  onAddLocation: () => void;
  onEditLocation: (location: ManagedLocation) => void;
  onArchiveBrand: () => void;
  onArchiveLocation: (location: ManagedLocation, name: string) => void;
  onRestoreLocation: (location: ManagedLocation) => void;
}) {
  const { t } = useLanguage();
  const copy = t.dashboard.brandLocations;
  const visibleLocations = brand.locations.filter(
    (location) => location.archivedAt === null || showArchivedLocations,
  );
  const activeLocationCount = brand.locations.filter((location) => location.archivedAt === null).length;

  return (
    <article className="overflow-hidden rounded-2xl border border-[#e6ebf1] bg-white shadow-soft-sm dark:border-gray-800 dark:bg-[#0f0f0f]">
      <div className="flex flex-col gap-4 border-b border-[#e6ebf1] px-5 py-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate font-display text-lg font-bold text-[#0f172a] dark:text-white">{brand.name}</h2>
            {brand.isDefault && (
              <span className="rounded-full bg-[#fff4d1] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#725600] dark:bg-[#ffbf23]/10 dark:text-[#ffbf23]">
                {copy.defaultBadge}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-[#8898aa]">{brand.normalizedDomain}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onEditBrand}
            className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#d8e0e8] bg-white px-3.5 py-2 text-xs font-semibold text-[#425466] transition-colors duration-150 hover:bg-[#f6f9fc] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <Pencil size={13} />
            {copy.editBrand}
          </button>
          <button
            type="button"
            onClick={onAddLocation}
            disabled={!canAddLocation}
            title={!canAddLocation ? copy.errors.planLimit : undefined}
            className="inline-flex min-h-9 items-center gap-2 rounded-full bg-[#ffbf23] px-3.5 py-2 text-xs font-semibold text-[#0f172a] transition-[background-color,scale] duration-150 hover:bg-[#e5ac20] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={13} />
            {copy.addLocation}
          </button>
          <button
            type="button"
            onClick={onArchiveBrand}
            className="inline-flex min-h-9 items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold text-red-600 transition-colors duration-150 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
          >
            <Archive size={13} />
            {copy.archive}
          </button>
        </div>
      </div>

      <div className="space-y-3 p-5">
        {activeLocationCount === 0 && !showArchivedLocations ? (
          <div className="rounded-xl border border-dashed border-[#d8e0e8] px-5 py-6 text-center dark:border-gray-800">
            <Globe2 size={22} className="mx-auto text-[#8898aa]" />
            <p className="mt-2 text-sm font-semibold text-[#0f172a] dark:text-white">{copy.noLocations}</p>
            <p className="mt-1 text-xs text-[#8898aa]">{copy.noLocationsDescription}</p>
          </div>
        ) : (
          visibleLocations.map((location) => {
            const country = getMarketCountryByIsoCode(location.countryCode);
            const marketLanguage = getMarketLanguageByIsoCode(location.languageCode);
            const countryName = country
              ? language === 'de' ? country.nameDE : country.name
              : location.countryCode?.toUpperCase() ?? copy.unknownMarket;
            const languageName = marketLanguage
              ? language === 'de' ? marketLanguage.nameDE : marketLanguage.name
              : location.languageCode?.toUpperCase() ?? copy.unknownMarket;
            const locationName = `${countryName} · ${languageName}`;
            const isArchived = location.archivedAt !== null;
            const isActiveSelection = location.id === activeLocationId;
            const isPending = pendingAction?.id === location.id;

            return (
              <div
                key={location.id}
                className={`rounded-xl border p-4 ${
                  isActiveSelection
                    ? 'border-[#ffbf23] bg-[#fffaf0] dark:bg-[#ffbf23]/5'
                    : 'border-[#e6ebf1] bg-[#f8fafc] dark:border-gray-800 dark:bg-gray-900/50'
                } ${isArchived ? 'opacity-65' : ''}`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Globe2 size={15} className="text-[#8898aa]" />
                      <p className="text-sm font-bold text-[#0f172a] dark:text-white">{locationName}</p>
                      {location.isDefault && (
                        <span className="rounded-full border border-[#e6ebf1] bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#8898aa] dark:border-gray-700 dark:bg-gray-900">
                          {copy.defaultBadge}
                        </span>
                      )}
                      {isActiveSelection && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                          <CheckCircle2 size={10} />
                          {copy.active}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#8898aa]">
                      <span className="inline-flex items-center gap-1"><Search size={12} />{location.topics.length} {copy.topicCount}</span>
                      <span>{location.competitors.length} {copy.competitorCount}</span>
                      <span>{location.autoScanEnabled ? copy.autoScanOn : copy.autoScanOff}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {isArchived ? (
                      <button
                        type="button"
                        onClick={() => onRestoreLocation(location)}
                        disabled={isPending}
                        className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#d8e0e8] bg-white px-3.5 py-2 text-xs font-semibold text-[#425466] disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                      >
                        {isPending ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                        {isPending ? copy.restoring : copy.restore}
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => onEditLocation(location)}
                          className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#d8e0e8] bg-white px-3.5 py-2 text-xs font-semibold text-[#425466] transition-colors duration-150 hover:bg-[#f6f9fc] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                        >
                          <Pencil size={13} />
                          {copy.editLocation}
                        </button>
                        <button
                          type="button"
                          onClick={() => onArchiveLocation(location, locationName)}
                          className="inline-flex min-h-9 items-center rounded-full px-3 py-2 text-xs font-semibold text-red-600 transition-colors duration-150 hover:bg-red-50 dark:text-red-400"
                          aria-label={`${copy.archive}: ${locationName}`}
                        >
                          <Archive size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </article>
  );
}
