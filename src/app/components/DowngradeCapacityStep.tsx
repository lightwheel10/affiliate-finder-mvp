'use client';

import { Archive, ArrowLeft, Building2, Check, Globe2, MapPin } from 'lucide-react';
import type { ManagedPortfolio } from '@/lib/brand-locations/portfolio';
import type { DowngradeRetentionSelection } from '@/lib/plans/downgrade-capacity';
import type { PurchasablePlanId } from '@/lib/plans/catalog';
import {
  getCountryFlagUrl,
  getMarketCountryByIsoCode,
  getMarketLanguageByIsoCode,
} from '@/lib/markets/catalog';

interface Copy {
  downgradeChoiceTitle: string;
  downgradeChoiceMessage: string;
  brandsKept: string;
  locationsKept: string;
  keepBrand: string;
  keepLocation: string;
  noActiveLocations: string;
  downgradeArchiveNote: string;
  backToPlans: string;
  confirmDowngrade: string;
  confirmingDowngrade: string;
}

interface Props {
  portfolio: ManagedPortfolio;
  targetPlan: PurchasablePlanId;
  maxBrands: number;
  maxLocations: number;
  selection: DowngradeRetentionSelection;
  copy: Copy;
  isSubmitting: boolean;
  onChange: (selection: DowngradeRetentionSelection) => void;
  onBack: () => void;
  onConfirm: () => void;
}

function Checkbox({ checked, disabled }: { checked: boolean; disabled?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border transition-[background-color,border-color,color] duration-150 ${
        checked
          ? 'border-[#ffbf23] bg-[#ffbf23] text-[#0f172a]'
          : disabled
            ? 'border-[#d8e0e8] bg-[#f6f9fc] text-transparent opacity-60 dark:border-gray-700 dark:bg-gray-900'
            : 'border-[#8898aa] bg-white text-transparent dark:border-gray-600 dark:bg-gray-900'
      }`}
    >
      {checked && <Check size={13} strokeWidth={3} />}
    </span>
  );
}

function LocationFlag({ countryCode }: { countryCode: string | null }) {
  const flagUrl = getCountryFlagUrl(countryCode);
  if (!flagUrl) return <Globe2 size={16} className="shrink-0 text-[#8898aa]" />;
  return (
    // The fixed-size flag asset is smaller than a Next image optimization request.
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

export function DowngradeCapacityStep({
  portfolio,
  targetPlan,
  maxBrands,
  maxLocations,
  selection,
  copy,
  isSubmitting,
  onChange,
  onBack,
  onConfirm,
}: Props) {
  const activeBrands = portfolio.brands
    .filter((brand) => brand.archivedAt === null)
    .map((brand) => ({
      ...brand,
      locations: brand.locations.filter((location) => location.archivedAt === null),
    }));
  const selectedBrands = new Set(selection.brandIds);
  const selectedLocations = new Set(selection.locationIds);
  const canConfirm = selection.brandIds.length > 0
    && selection.brandIds.length <= maxBrands
    && selection.locationIds.length > 0
    && selection.locationIds.length <= maxLocations;

  const toggleBrand = (brandId: string) => {
    const brand = activeBrands.find((candidate) => candidate.id === brandId);
    if (!brand || brand.locations.length === 0) return;
    if (selectedBrands.has(brandId)) {
      onChange({
        brandIds: selection.brandIds.filter((id) => id !== brandId),
        locationIds: selection.locationIds.filter(
          (id) => !brand.locations.some((location) => location.id === id),
        ),
      });
      return;
    }
    if (selection.brandIds.length >= maxBrands || selection.locationIds.length >= maxLocations) {
      return;
    }
    const firstLocation = brand.locations.find((location) => location.isDefault)
      ?? brand.locations[0];
    onChange({
      brandIds: [...selection.brandIds, brandId],
      locationIds: [...selection.locationIds, firstLocation.id],
    });
  };

  const toggleLocation = (brandId: string, locationId: string) => {
    if (selectedLocations.has(locationId)) {
      const remainingLocations = selection.locationIds.filter((id) => id !== locationId);
      const brand = activeBrands.find((candidate) => candidate.id === brandId);
      const brandStillHasLocation = brand?.locations.some(
        (location) => remainingLocations.includes(location.id),
      ) ?? false;
      onChange({
        brandIds: brandStillHasLocation
          ? selection.brandIds
          : selection.brandIds.filter((id) => id !== brandId),
        locationIds: remainingLocations,
      });
      return;
    }
    if (selection.locationIds.length >= maxLocations) return;
    if (!selectedBrands.has(brandId) && selection.brandIds.length >= maxBrands) return;
    onChange({
      brandIds: selectedBrands.has(brandId)
        ? selection.brandIds
        : [...selection.brandIds, brandId],
      locationIds: [...selection.locationIds, locationId],
    });
  };

  return (
    <div className="mx-auto max-w-3xl px-2 py-3">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#ffbf23]/15 text-[#b77900] dark:text-[#ffbf23]">
          <Archive size={21} strokeWidth={2} />
        </div>
        <h2 className="font-display text-2xl font-bold tracking-tight text-[#0f172a] dark:text-white">
          {copy.downgradeChoiceTitle}
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#596579] dark:text-gray-400">
          {copy.downgradeChoiceMessage.replace('{plan}', targetPlan === 'pro' ? 'Pro' : 'Business')}
        </p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3" aria-live="polite">
        <div className="rounded-xl border border-[#e6ebf1] bg-[#f6f9fc] px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
          <div className="text-xs font-medium text-[#8898aa]">{copy.brandsKept}</div>
          <div className="mt-1 text-lg font-semibold tabular-nums text-[#0f172a] dark:text-white">
            {selection.brandIds.length} / {maxBrands}
          </div>
        </div>
        <div className="rounded-xl border border-[#e6ebf1] bg-[#f6f9fc] px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
          <div className="text-xs font-medium text-[#8898aa]">{copy.locationsKept}</div>
          <div className="mt-1 text-lg font-semibold tabular-nums text-[#0f172a] dark:text-white">
            {selection.locationIds.length} / {maxLocations}
          </div>
        </div>
      </div>

      <div className="max-h-[46vh] space-y-3 overflow-y-auto pr-1">
        {activeBrands.map((brand) => {
          const brandSelected = selectedBrands.has(brand.id);
          const brandDisabled = !brandSelected
            && (selection.brandIds.length >= maxBrands
              || selection.locationIds.length >= maxLocations
              || brand.locations.length === 0);
          return (
            <section
              key={brand.id}
              className={`rounded-2xl border bg-white p-3 shadow-soft-sm dark:bg-[#0f0f0f] ${
                brandSelected
                  ? 'border-[#ffbf23]'
                  : 'border-[#e6ebf1] dark:border-gray-800'
              }`}
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={brandSelected}
                disabled={brandDisabled || isSubmitting}
                onClick={() => toggleBrand(brand.id)}
                className="flex min-h-11 w-full items-center gap-3 rounded-xl px-2 text-left outline-none transition-colors duration-150 hover:bg-[#f6f9fc] focus-visible:ring-2 focus-visible:ring-[#ffbf23]/60 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-gray-900"
              >
                <Checkbox checked={brandSelected} disabled={brandDisabled} />
                <Building2 size={17} className="shrink-0 text-[#8898aa]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[#0f172a] dark:text-white">
                    {brand.name}
                  </span>
                  <span className="block truncate text-xs text-[#8898aa]">
                    {brand.normalizedDomain ?? copy.keepBrand}
                  </span>
                </span>
              </button>

              {brand.locations.length === 0 ? (
                <p className="px-10 pb-2 text-xs text-[#8898aa]">{copy.noActiveLocations}</p>
              ) : (
                <div className="mt-1 space-y-1 border-t border-[#eef2f6] pt-2 dark:border-gray-800">
                  {brand.locations.map((location) => {
                    const checked = selectedLocations.has(location.id);
                    const disabled = !checked && (
                      selection.locationIds.length >= maxLocations
                      || (!brandSelected && selection.brandIds.length >= maxBrands)
                    );
                    const country = getMarketCountryByIsoCode(location.countryCode);
                    const language = getMarketLanguageByIsoCode(location.languageCode);
                    const name = `${country?.name ?? location.countryCode?.toUpperCase() ?? '--'} · ${language?.name ?? location.languageCode?.toUpperCase() ?? '--'}`;
                    return (
                      <button
                        key={location.id}
                        type="button"
                        role="checkbox"
                        aria-checked={checked}
                        aria-label={`${copy.keepLocation}: ${brand.name}, ${name}`}
                        disabled={disabled || isSubmitting}
                        onClick={() => toggleLocation(brand.id, location.id)}
                        className="flex min-h-10 w-full items-center gap-3 rounded-lg px-2 pl-10 text-left outline-none transition-colors duration-150 hover:bg-[#f6f9fc] focus-visible:ring-2 focus-visible:ring-[#ffbf23]/60 disabled:cursor-not-allowed disabled:opacity-55 dark:hover:bg-gray-900"
                      >
                        <Checkbox checked={checked} disabled={disabled} />
                        <LocationFlag countryCode={location.countryCode} />
                        <MapPin size={15} className="shrink-0 text-[#8898aa]" />
                        <span className="truncate text-sm font-medium text-[#425466] dark:text-gray-300">
                          {name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
        <Archive size={15} className="mt-0.5 shrink-0" />
        <span>{copy.downgradeArchiveNote}</span>
      </div>

      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <button
          type="button"
          disabled={isSubmitting}
          onClick={onBack}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-[#596579] transition-[background-color,scale] duration-150 hover:bg-[#f6f9fc] active:scale-[0.96] disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-900"
        >
          <ArrowLeft size={16} />
          {copy.backToPlans}
        </button>
        <button
          type="button"
          disabled={!canConfirm || isSubmitting}
          onClick={onConfirm}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#ffbf23] px-6 text-sm font-semibold text-[#0f172a] shadow-yellow-glow-sm transition-[background-color,scale] duration-150 hover:bg-[#e5ac20] active:scale-[0.96] disabled:cursor-not-allowed disabled:bg-[#d8e0e8] disabled:text-[#8898aa] disabled:shadow-none"
        >
          {isSubmitting ? copy.confirmingDowngrade : copy.confirmDowngrade}
        </button>
      </div>
    </div>
  );
}
