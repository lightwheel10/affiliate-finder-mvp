'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Check, ChevronDown, Globe2, MapPin, Minus } from 'lucide-react';
import { useBrandLocation } from '@/contexts/BrandLocationContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getCountryFlagUrl } from '@/lib/markets/catalog';
import type { ManagedLocation } from '@/lib/brand-locations/portfolio';

function LocationFlag({ location }: { location: ManagedLocation }) {
  const flagUrl = getCountryFlagUrl(location.countryCode);
  if (!flagUrl) return <Globe2 size={14} className="shrink-0 text-[#8898aa]" />;
  return (
    // These tiny external assets are already size-specific; routing them
    // through Next's image optimizer would add more work than it saves.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={flagUrl}
      alt=""
      width={20}
      height={15}
      className="h-[15px] w-5 shrink-0 rounded-[2px] object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
    />
  );
}

function locationCode(location: ManagedLocation): string {
  return `${location.countryCode?.toUpperCase() ?? '--'} · ${location.languageCode?.toUpperCase() ?? '--'}`;
}

type LocationCheckboxState = 'checked' | 'mixed' | 'unchecked';

function LocationCheckbox({ state }: { state: LocationCheckboxState }) {
  const isActive = state !== 'unchecked';

  return (
    <span
      aria-hidden="true"
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-[background-color,border-color,color] duration-150 ${
        isActive
          ? 'border-[#ffbf23] bg-[#ffbf23] text-[#0f172a]'
          : 'border-[#8898aa] bg-white text-transparent dark:border-gray-600 dark:bg-gray-900'
      }`}
    >
      {state === 'checked' && <Check size={11} strokeWidth={3} />}
      {state === 'mixed' && <Minus size={11} strokeWidth={3} />}
    </span>
  );
}

export function BrandLocationSwitcher() {
  const { t } = useLanguage();
  const copy = t.dashboard.brandLocations;
  const {
    featureEnabled,
    portfolio,
    activeBrand,
    activeLocation,
    selectedLocations,
    isLoading,
    error,
    selectBrand,
    selectLocation,
    toggleLocation,
    selectAllBrandLocations,
  } = useBrandLocation();
  const [openMenu, setOpenMenu] = useState<'brand' | 'location' | null>(null);
  const switcherRef = useRef<HTMLDivElement>(null);

  const activeBrands = useMemo(
    () => portfolio?.brands.filter(
      (brand) => brand.archivedAt === null
        && brand.locations.some((location) => location.archivedAt === null),
    ) ?? [],
    [portfolio],
  );
  const brandLocations = useMemo(
    () => activeBrand?.locations.filter((location) => location.archivedAt === null) ?? [],
    [activeBrand],
  );
  const selectedLocationIds = useMemo(
    () => new Set(selectedLocations.map((location) => location.id)),
    [selectedLocations],
  );
  const allLocationsSelected = brandLocations.length > 0
    && selectedLocations.length === brandLocations.length;
  const allLocationsCheckboxState: LocationCheckboxState = allLocationsSelected
    ? 'checked'
    : selectedLocations.length > 0
      ? 'mixed'
      : 'unchecked';

  useEffect(() => {
    if (!openMenu) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!switcherRef.current?.contains(event.target as Node)) setOpenMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenu(null);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [openMenu]);

  if (!featureEnabled) return null;
  if (isLoading) {
    return (
      <div className="px-4 pt-3" aria-label={copy.loadingPortfolio}>
        <div className="h-[116px] animate-pulse rounded-xl border border-[#e6ebf1] bg-[#f6f9fc] dark:border-gray-800 dark:bg-gray-900" />
      </div>
    );
  }
  if (error || !activeBrand || !activeLocation) {
    return (
      <div className="px-4 pt-3">
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {copy.portfolioUnavailable}
        </div>
      </div>
    );
  }

  const locationSummary = allLocationsSelected && brandLocations.length > 1
    ? `${copy.allLocations} (${brandLocations.length})`
    : selectedLocations.length > 1
      ? copy.locationsSelected.replace('{count}', String(selectedLocations.length))
      : locationCode(selectedLocations[0] ?? activeLocation);

  return (
    <div ref={switcherRef} className="px-4 pt-3">
      <div className="space-y-2.5 rounded-xl border border-[#e6ebf1] bg-[#f6f9fc] p-2.5 dark:border-gray-800 dark:bg-[#111]">
        <div className="relative">
          <label htmlFor="dashboard-brand-switcher" className="mb-1 flex items-center gap-1.5 px-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#8898aa] dark:text-gray-500">
            <Building2 size={12} strokeWidth={2} />
            {copy.activeBrand}
          </label>
          <button
            id="dashboard-brand-switcher"
            type="button"
            aria-haspopup="menu"
            aria-expanded={openMenu === 'brand'}
            onClick={() => setOpenMenu((current) => current === 'brand' ? null : 'brand')}
            className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-[#d8e0e8] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#0f172a] shadow-soft-sm outline-none transition-[border-color,box-shadow] duration-150 focus:border-[#ffbf23] focus:ring-2 focus:ring-[#ffbf23]/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          >
            <span className="truncate" title={activeBrand.name}>{activeBrand.name}</span>
            <ChevronDown size={14} className={`shrink-0 text-[#8898aa] transition-transform duration-150 ${openMenu === 'brand' ? 'rotate-180' : ''}`} />
          </button>
          {openMenu === 'brand' && (
            <div role="menu" aria-label={copy.switchBrand} className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-[#d8e0e8] bg-white p-1.5 shadow-soft-lg dark:border-gray-700 dark:bg-gray-900">
              {activeBrands.map((brand) => {
                const isSelected = brand.id === activeBrand.id;
                return (
                  <button
                    key={brand.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={isSelected}
                    onClick={() => { selectBrand(brand.id); setOpenMenu(null); }}
                    className={`flex min-h-9 w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-semibold transition-colors duration-150 ${isSelected ? 'bg-[#fff4d1] text-[#0f172a] dark:bg-[#ffbf23]/10 dark:text-[#ffbf23]' : 'text-[#425466] hover:bg-[#f6f9fc] dark:text-gray-300 dark:hover:bg-gray-800'}`}
                  >
                    <Building2 size={14} className="shrink-0 text-[#8898aa]" />
                    <span className="min-w-0 flex-1 truncate" title={brand.name}>{brand.name}</span>
                    {isSelected && <Check size={13} className="shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="relative">
          <label htmlFor="dashboard-location-switcher" className="mb-1 flex items-center gap-1.5 px-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#8898aa] dark:text-gray-500">
            <MapPin size={12} strokeWidth={2} />
            {copy.activeLocations}
          </label>
          <button
            id="dashboard-location-switcher"
            type="button"
            aria-haspopup="menu"
            aria-expanded={openMenu === 'location'}
            onClick={() => setOpenMenu((current) => current === 'location' ? null : 'location')}
            className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-[#d8e0e8] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#0f172a] shadow-soft-sm outline-none transition-[border-color,box-shadow] duration-150 focus:border-[#ffbf23] focus:ring-2 focus:ring-[#ffbf23]/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          >
            <span className="flex min-w-0 items-center gap-2">
              {selectedLocations.length === 1 ? <LocationFlag location={selectedLocations[0]} /> : <Globe2 size={14} className="shrink-0 text-[#8898aa]" />}
              <span className="truncate">{locationSummary}</span>
            </span>
            <ChevronDown size={14} className={`shrink-0 text-[#8898aa] transition-transform duration-150 ${openMenu === 'location' ? 'rotate-180' : ''}`} />
          </button>
          {openMenu === 'location' && (
            <div role="menu" aria-label={copy.switchLocations} className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-[#d8e0e8] bg-white p-1.5 shadow-soft-lg dark:border-gray-700 dark:bg-gray-900">
              {brandLocations.length > 1 && (
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={allLocationsCheckboxState === 'mixed' ? 'mixed' : allLocationsSelected}
                  onClick={() => {
                    if (allLocationsSelected) {
                      selectLocation(activeLocation.id);
                      return;
                    }
                    selectAllBrandLocations();
                  }}
                  className={`flex min-h-9 w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-semibold transition-colors duration-150 ${allLocationsSelected ? 'bg-[#fff4d1] text-[#0f172a] dark:bg-[#ffbf23]/10 dark:text-[#ffbf23]' : 'text-[#425466] hover:bg-[#f6f9fc] dark:text-gray-300 dark:hover:bg-gray-800'}`}
                >
                  <LocationCheckbox state={allLocationsCheckboxState} />
                  <Globe2 size={14} className="shrink-0 text-[#8898aa]" />
                  <span className="flex-1">{copy.allLocations}</span>
                </button>
              )}
              {brandLocations.map((location) => {
                const isSelected = selectedLocationIds.has(location.id);
                return (
                  <button
                    key={location.id}
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={isSelected}
                    onClick={() => toggleLocation(location.id)}
                    className={`flex min-h-9 w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-semibold transition-colors duration-150 ${isSelected ? 'bg-[#fff4d1] text-[#0f172a] dark:bg-[#ffbf23]/10 dark:text-[#ffbf23]' : 'text-[#425466] hover:bg-[#f6f9fc] dark:text-gray-300 dark:hover:bg-gray-800'}`}
                  >
                    <LocationCheckbox state={isSelected ? 'checked' : 'unchecked'} />
                    <LocationFlag location={location} />
                    <span className="flex-1">{locationCode(location)}</span>
                  </button>
                );
              })}
              <div className="mt-1 flex items-center justify-between gap-2 border-t border-[#e6ebf1] px-1 pt-1.5 dark:border-gray-800">
                <span className="pl-1 text-[10px] font-medium text-[#8898aa] dark:text-gray-500">
                  {selectedLocations.length} {t.common.selected}
                </span>
                <button type="button" onClick={() => setOpenMenu(null)} className="min-h-8 rounded-lg bg-[#ffbf23] px-3 text-xs font-semibold text-[#0f172a] transition-[background-color,scale] duration-150 hover:bg-[#e5ac20] active:scale-[0.96]">
                  {copy.done}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
