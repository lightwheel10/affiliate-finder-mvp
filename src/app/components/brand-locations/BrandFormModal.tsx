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
import type { ManagedBrand } from '@/lib/brand-locations/portfolio';

export interface BrandFormPayload {
  name: string;
  domain: string;
  bio: string | null;
  affiliateTypes: string[];
}

interface BrandFormModalProps {
  isOpen: boolean;
  brand?: ManagedBrand | null;
  onClose: () => void;
  onSubmit: (payload: BrandFormPayload) => Promise<void>;
  errorMessage: (error: unknown) => string;
}

const inputClassName = 'w-full rounded-lg border border-[#d8e0e8] bg-white px-3 py-2.5 text-sm text-[#0f172a] outline-none focus:border-[#ffbf23] focus:ring-2 focus:ring-[#ffbf23]/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white';

export function BrandFormModal({
  isOpen,
  brand,
  onClose,
  onSubmit,
  errorMessage,
}: BrandFormModalProps) {
  const { t } = useLanguage();
  const copy = t.dashboard.brandLocations;
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [bio, setBio] = useState('');
  const [affiliateTypes, setAffiliateTypes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setName(brand?.name ?? '');
    setDomain(brand?.normalizedDomain ?? '');
    setBio(brand?.bio ?? '');
    setAffiliateTypes(formatLineValues(brand?.affiliateTypes ?? []));
    setError(null);
    setIsSaving(false);
  }, [brand, isOpen]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    const parsedAffiliateTypes = parseUniqueLineValues(affiliateTypes);
    if (parsedAffiliateTypes.length > BRAND_LOCATION_MANAGEMENT_LIMITS.affiliateTypes) {
      setError(copy.errors.tooManyValues.replace(
        '{limit}',
        String(BRAND_LOCATION_MANAGEMENT_LIMITS.affiliateTypes),
      ));
      setIsSaving(false);
      return;
    }

    try {
      await onSubmit({
        name: name.trim(),
        domain: domain.trim(),
        bio: bio.trim() || null,
        affiliateTypes: parsedAffiliateTypes,
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
      title={brand ? copy.editBrand : copy.createBrandTitle}
      width="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-xs font-semibold uppercase tracking-wider text-[#8898aa]">
            {copy.brandName}
            <input
              required
              maxLength={255}
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={isSaving}
              className={inputClassName}
            />
          </label>
          <label className="space-y-1.5 text-xs font-semibold uppercase tracking-wider text-[#8898aa]">
            {copy.brandDomain}
            <input
              required
              type="text"
              maxLength={2048}
              value={domain}
              onChange={(event) => setDomain(event.target.value)}
              disabled={isSaving}
              placeholder="example.com"
              className={inputClassName}
            />
          </label>
        </div>
        <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-wider text-[#8898aa]">
          {copy.brandBio}
          <textarea
            rows={3}
            maxLength={5000}
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            disabled={isSaving}
            className={inputClassName}
          />
        </label>
        <label className="block space-y-1.5 text-xs font-semibold uppercase tracking-wider text-[#8898aa]">
          <span className="flex items-center justify-between gap-2">
            <span>{copy.affiliateTypes}</span>
            <span className="normal-case tracking-normal text-[#8898aa]">{copy.affiliateTypesHint}</span>
          </span>
          <textarea
            rows={3}
            value={affiliateTypes}
            onChange={(event) => setAffiliateTypes(event.target.value)}
            disabled={isSaving}
            className={inputClassName}
          />
        </label>
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
            disabled={isSaving}
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
