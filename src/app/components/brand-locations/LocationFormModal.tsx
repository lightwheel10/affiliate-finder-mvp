'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Building2, Loader2 } from 'lucide-react';
import { Modal } from '@/app/components/Modal';
import {
  SearchMarketPicker,
  type SearchMarketPickerOption,
} from '@/app/components/SearchMarketPicker';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  formatLineValues,
  parseUniqueLineValues,
} from '@/lib/brand-locations/form-values';
import { BRAND_LOCATION_MANAGEMENT_LIMITS } from '@/lib/brand-locations/limits';
import {
  getCountryFlagUrl,
  MARKET_COUNTRIES,
  MARKET_LANGUAGES,
} from '@/lib/markets/catalog';
import type { ManagedLocation } from '@/lib/brand-locations/portfolio';

export interface LocationFormPayload {
  countryCode: string;
  languageCode: string;
  topics: string[];
  competitors: string[];
}

interface LocationFormModalProps {
  isOpen: boolean;
  brandName: string;
  location?: ManagedLocation | null;
  onClose: () => void;
  onSubmit: (payload: LocationFormPayload) => Promise<void>;
  errorMessage: (error: unknown) => string;
}

const fieldClassName = 'w-full rounded-xl border border-[#d8e0e8] bg-white px-3 py-2.5 text-sm text-[#0f172a] shadow-soft-sm outline-none transition-[border-color,box-shadow] duration-150 focus:border-[#ffbf23] focus:ring-2 focus:ring-[#ffbf23]/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white';

export function LocationFormModal({
  isOpen,
  brandName,
  location,
  onClose,
  onSubmit,
  errorMessage,
}: LocationFormModalProps) {
  const { language, t } = useLanguage();
  const copy = t.dashboard.brandLocations;
  const [countryCode, setCountryCode] = useState('');
  const [languageCode, setLanguageCode] = useState('');
  const [topics, setTopics] = useState('');
  const [competitors, setCompetitors] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const countryOptions = useMemo<readonly SearchMarketPickerOption[]>(
    () => MARKET_COUNTRIES.map((country) => ({
      value: country.isoCode,
      label: language === 'de' ? country.nameDE : country.name,
      code: country.isoCode.toUpperCase(),
      flagUrl: getCountryFlagUrl(country.isoCode),
    })),
    [language],
  );
  const languageOptions = useMemo<readonly SearchMarketPickerOption[]>(
    () => MARKET_LANGUAGES.map((marketLanguage) => ({
      value: marketLanguage.isoCode,
      label: language === 'de' ? marketLanguage.nameDE : marketLanguage.name,
      code: marketLanguage.isoCode.toUpperCase(),
      flagUrl: getCountryFlagUrl(marketLanguage.flagCountryCode),
    })),
    [language],
  );

  useEffect(() => {
    if (!isOpen) return;
    setCountryCode(location?.countryCode ?? '');
    setLanguageCode(location?.languageCode ?? '');
    setTopics(formatLineValues(location?.topics ?? []));
    setCompetitors(formatLineValues(location?.competitors ?? []));
    setError(null);
    setIsSaving(false);
  }, [isOpen, location]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    const parsedTopics = parseUniqueLineValues(topics);
    const parsedCompetitors = parseUniqueLineValues(competitors);
    const exceedsLimit =
      parsedTopics.length > BRAND_LOCATION_MANAGEMENT_LIMITS.topics
      || parsedCompetitors.length > BRAND_LOCATION_MANAGEMENT_LIMITS.competitors;
    if (exceedsLimit) {
      setError(copy.errors.tooManyValues.replace(
        '{limit}',
        String(BRAND_LOCATION_MANAGEMENT_LIMITS.topics),
      ));
      setIsSaving(false);
      return;
    }

    try {
      await onSubmit({
        countryCode,
        languageCode,
        topics: parsedTopics,
        competitors: parsedCompetitors,
      });
    } catch (submitError) {
      setError(errorMessage(submitError));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSaving ? () => undefined : onClose}
      title={location ? copy.editLocation : copy.createLocationTitle}
      width="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex items-center gap-3 rounded-xl border border-[#e6ebf1] bg-[#f6f9fc] px-3 py-2.5 dark:border-gray-800 dark:bg-gray-900/70">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white text-[#d39600] shadow-soft-sm dark:bg-gray-800 dark:text-[#ffbf23]">
            <Building2 size={16} strokeWidth={2} />
          </span>
          <span className="min-w-0">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#8898aa] dark:text-gray-500">
              {copy.brandName}
            </span>
            <span className="block truncate text-sm font-semibold text-[#0f172a] dark:text-white">
              {brandName}
            </span>
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <SearchMarketPicker
            id="settings-location-country"
            label={copy.country}
            value={countryCode}
            options={countryOptions}
            onChange={setCountryCode}
            searchPlaceholder={t.onboarding.common.search}
            noResultsText={t.onboarding.common.noResults}
            disabled={isSaving}
            variant="country"
          />
          <SearchMarketPicker
            id="settings-location-language"
            label={copy.language}
            value={languageCode}
            options={languageOptions}
            onChange={setLanguageCode}
            searchPlaceholder={t.onboarding.common.search}
            noResultsText={t.onboarding.common.noResults}
            disabled={isSaving}
            variant="language"
            align="end"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-xs font-semibold uppercase tracking-wider text-[#8898aa]">
            <span className="flex items-center justify-between gap-2">
              <span>{copy.topics}</span>
              <span className="normal-case tracking-normal">{copy.onePerLine}</span>
            </span>
            <textarea
              rows={5}
              value={topics}
              onChange={(event) => setTopics(event.target.value)}
              disabled={isSaving}
              className={fieldClassName}
            />
          </label>
          <label className="space-y-1.5 text-xs font-semibold uppercase tracking-wider text-[#8898aa]">
            <span className="flex items-center justify-between gap-2">
              <span>{copy.competitors}</span>
              <span className="normal-case tracking-normal">{copy.onePerLine}</span>
            </span>
            <textarea
              rows={5}
              value={competitors}
              onChange={(event) => setCompetitors(event.target.value)}
              disabled={isSaving}
              className={fieldClassName}
            />
          </label>
        </div>
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3 border-t border-[#e6ebf1] pt-4 dark:border-gray-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="min-h-10 rounded-full border border-[#d8e0e8] bg-white px-5 py-2 text-sm font-medium text-[#425466] transition-colors duration-150 hover:bg-[#f6f9fc] disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            {t.common.cancel}
          </button>
          <button
            type="submit"
            disabled={isSaving || !countryCode || !languageCode}
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#ffbf23] px-5 py-2 text-sm font-semibold text-[#0f172a] shadow-yellow-glow-sm transition-[background-color,scale] duration-150 hover:bg-[#e5ac20] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving && <Loader2 size={15} className="animate-spin" />}
            {isSaving ? copy.saving : t.common.save}
          </button>
        </div>
      </form>
    </Modal>
  );
}
