'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { Modal } from '@/app/components/Modal';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  formatLineValues,
  parseUniqueLineValues,
} from '@/lib/brand-locations/form-values';
import { BRAND_LOCATION_MANAGEMENT_LIMITS } from '@/lib/brand-locations/limits';
import { MARKET_COUNTRIES, MARKET_LANGUAGES } from '@/lib/markets/catalog';
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

const fieldClassName = 'w-full rounded-lg border border-[#d8e0e8] bg-white px-3 py-2.5 text-sm text-[#0f172a] outline-none focus:border-[#ffbf23] focus:ring-2 focus:ring-[#ffbf23]/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white';

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
        <p className="text-sm font-medium text-[#425466] dark:text-gray-300">{brandName}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-xs font-semibold uppercase tracking-wider text-[#8898aa]">
            {copy.country}
            <select
              required
              value={countryCode}
              onChange={(event) => setCountryCode(event.target.value)}
              disabled={isSaving}
              className={fieldClassName}
            >
              <option value="" disabled>—</option>
              {MARKET_COUNTRIES.map((country) => (
                <option key={country.isoCode} value={country.isoCode}>
                  {language === 'de' ? country.nameDE : country.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5 text-xs font-semibold uppercase tracking-wider text-[#8898aa]">
            {copy.language}
            <select
              required
              value={languageCode}
              onChange={(event) => setLanguageCode(event.target.value)}
              disabled={isSaving}
              className={fieldClassName}
            >
              <option value="" disabled>—</option>
              {MARKET_LANGUAGES.map((marketLanguage) => (
                <option key={marketLanguage.isoCode} value={marketLanguage.isoCode}>
                  {language === 'de' ? marketLanguage.nameDE : marketLanguage.name}
                </option>
              ))}
            </select>
          </label>
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
