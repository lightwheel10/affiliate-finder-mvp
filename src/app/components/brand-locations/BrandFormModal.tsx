'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Check, Loader2, Sparkles } from 'lucide-react';
import { Modal } from '@/app/components/Modal';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  readBrandAffiliateTypeIds,
  writeBrandAffiliateTypes,
  type BrandAffiliateTypeId,
} from '@/lib/brand-locations/affiliate-types';
import type { ManagedBrand } from '@/lib/brand-locations/portfolio';
import { isValidBrandDomainInput } from '@/lib/brands/domain';
import { cn } from '@/lib/utils';

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

const inputClassName = 'w-full rounded-xl border border-[#d8e0e8] bg-white px-3 py-2.5 text-sm text-[#0f172a] shadow-soft-sm outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[#a2afbd] focus:border-[#ffbf23] focus:ring-2 focus:ring-[#ffbf23]/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-600';

export function BrandFormModal({
  isOpen,
  brand,
  onClose,
  onSubmit,
  errorMessage,
}: BrandFormModalProps) {
  const { t, language } = useLanguage();
  const copy = t.dashboard.brandLocations;
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [bio, setBio] = useState('');
  const [affiliateTypeIds, setAffiliateTypeIds] = useState<BrandAffiliateTypeId[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const descriptionRequest = useRef<AbortController | null>(null);

  const affiliateTypeOptions: ReadonlyArray<{
    id: BrandAffiliateTypeId;
    label: string;
  }> = [
    { id: 'web', label: t.onboarding.step6.types.publishersBloggers },
    { id: 'instagram', label: t.onboarding.step6.types.instagram },
    { id: 'tiktok', label: t.onboarding.step6.types.tiktok },
    { id: 'youtube', label: t.onboarding.step6.types.youtube },
  ];

  useEffect(() => {
    if (!isOpen) return;
    setName(brand?.name ?? '');
    setDomain(brand?.normalizedDomain ?? '');
    setBio(brand?.bio ?? '');
    setAffiliateTypeIds(readBrandAffiliateTypeIds(brand?.affiliateTypes ?? []));
    setError(null);
    setDescriptionError(null);
    setIsSaving(false);
    setIsGeneratingDescription(false);
    return () => {
      descriptionRequest.current?.abort();
      descriptionRequest.current = null;
    };
  }, [brand, isOpen]);

  const toggleAffiliateType = (id: BrandAffiliateTypeId) => {
    setAffiliateTypeIds((current) => current.includes(id)
      ? current.filter((value) => value !== id)
      : [...current, id]);
  };

  const handleGenerateDescription = async () => {
    if (!isValidBrandDomainInput(domain)) {
      setDescriptionError(copy.errors.descriptionDomainRequired);
      return;
    }

    descriptionRequest.current?.abort();
    const controller = new AbortController();
    descriptionRequest.current = controller;
    setDescriptionError(null);
    setIsGeneratingDescription(true);
    try {
      const response = await fetch('/api/brands/generate-description', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandName: name.trim(), domain: domain.trim(), language }),
      });
      const result = await response.json() as { description?: unknown };
      if (!response.ok || typeof result.description !== 'string') {
        throw new Error('Brand description generation failed.');
      }
      setBio(result.description);
    } catch (generationError) {
      if (generationError instanceof Error && generationError.name === 'AbortError') return;
      setDescriptionError(copy.errors.descriptionGenerationFailed);
    } finally {
      if (descriptionRequest.current === controller) {
        descriptionRequest.current = null;
        setIsGeneratingDescription(false);
      }
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving || isGeneratingDescription) return;
    setIsSaving(true);
    setError(null);

    try {
      await onSubmit({
        name: name.trim(),
        domain: domain.trim(),
        bio: bio.trim() || null,
        affiliateTypes: writeBrandAffiliateTypes(affiliateTypeIds),
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
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#8898aa]">
            {copy.brandName}
            <input
              required
              maxLength={255}
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={isSaving || isGeneratingDescription}
              className={inputClassName}
            />
          </label>
          <label className="space-y-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#8898aa]">
            {copy.brandDomain}
            <input
              required
              type="text"
              maxLength={2048}
              value={domain}
              onChange={(event) => setDomain(event.target.value)}
              disabled={isSaving || isGeneratingDescription}
              placeholder="example.com"
              className={inputClassName}
            />
          </label>
        </div>
        <label className="block space-y-1.5">
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8898aa]">
              {copy.brandBio}
            </span>
            <button
              type="button"
              onClick={() => void handleGenerateDescription()}
              disabled={isSaving || isGeneratingDescription || !isValidBrandDomainInput(domain)}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[#ffbf23]/40 bg-[#ffbf23]/10 px-3 py-1.5 text-xs font-semibold text-[#9a6a00] transition-[background-color,border-color,scale] duration-150 hover:border-[#ffbf23] hover:bg-[#ffbf23]/20 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 dark:text-[#ffcf57]"
            >
              {isGeneratingDescription
                ? <Loader2 size={13} className="animate-spin" />
                : <Sparkles size={13} strokeWidth={2} />}
              {isGeneratingDescription
                ? copy.generatingDescription
                : bio.trim() ? copy.regenerateDescription : copy.generateDescription}
            </button>
          </span>
          <textarea
            rows={3}
            maxLength={5000}
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            disabled={isSaving || isGeneratingDescription}
            placeholder={copy.brandBioPlaceholder}
            className={cn(inputClassName, 'resize-y leading-relaxed')}
          />
          <span className="block text-[11px] font-medium leading-4 text-[#8898aa] dark:text-gray-500">
            {copy.brandBioHint}
          </span>
        </label>
        {descriptionError && (
          <p role="alert" className="-mt-2 text-xs font-medium text-red-600 dark:text-red-400">
            {descriptionError}
          </p>
        )}

        <fieldset className="space-y-2">
          <legend className="text-[11px] font-semibold uppercase tracking-wider text-[#8898aa]">
            {copy.affiliateTypes}
          </legend>
          <p className="text-xs leading-4 text-[#8898aa] dark:text-gray-500">
            {copy.affiliateTypesHint}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {affiliateTypeOptions.map((option) => {
              const isSelected = affiliateTypeIds.includes(option.id);
              return (
                <label
                  key={option.id}
                  className={cn(
                    'flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm font-semibold outline-none transition-[background-color,border-color,color,box-shadow,scale] duration-150 focus-within:ring-2 focus-within:ring-[#ffbf23]/25 active:scale-[0.96]',
                    isSelected
                      ? 'border-[#ffbf23] bg-[#ffbf23]/10 text-[#0f172a] dark:text-white'
                      : 'border-[#e6ebf1] bg-white text-[#425466] hover:border-[#ffbf23] hover:bg-[#ffbf23]/5 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300',
                    (isSaving || isGeneratingDescription) && 'cursor-not-allowed opacity-60',
                  )}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={isSelected}
                    onChange={() => toggleAffiliateType(option.id)}
                    disabled={isSaving || isGeneratingDescription}
                  />
                  <span
                    aria-hidden="true"
                    className={cn(
                      'flex size-4 shrink-0 items-center justify-center rounded border transition-[background-color,border-color] duration-150',
                      isSelected
                        ? 'border-[#ffbf23] bg-[#ffbf23] text-[#0f172a]'
                        : 'border-[#c7d1dc] bg-white dark:border-gray-600 dark:bg-gray-900',
                    )}
                  >
                    {isSelected && <Check size={10} strokeWidth={3} />}
                  </span>
                  <span className="truncate">{option.label}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
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
            disabled={isSaving || isGeneratingDescription}
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
