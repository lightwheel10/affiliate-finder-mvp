'use client';

import { useMemo } from 'react';
import { Globe2, MapPin } from 'lucide-react';
import { useBrandLocation } from '@/contexts/BrandLocationContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { resolveBrandLocationPresentation } from '@/lib/brand-locations/presentation';

interface AffiliateLocationBadgeProps {
  brandLocationId?: string | null;
  variant?: 'badge' | 'detail';
  className?: string;
}

/**
 * Shows the exact market that produced an affiliate. The visible data is
 * resolved only from the authenticated portfolio already loaded by the
 * dashboard; a stale or foreign location ID is never rendered as trusted UI.
 */
export function AffiliateLocationBadge({
  brandLocationId,
  variant = 'badge',
  className = '',
}: AffiliateLocationBadgeProps) {
  const { activeLocations } = useBrandLocation();
  const { language, t } = useLanguage();
  const presentation = useMemo(
    () => resolveBrandLocationPresentation(activeLocations, brandLocationId, language),
    [activeLocations, brandLocationId, language],
  );

  if (!presentation) return null;

  const accessibleLabel = `${t.affiliateRow.searchLocation}: ${presentation.fullLabel}, ${presentation.brandName}`;
  const flag = presentation.flagUrl ? (
    // These small flag assets are already served at their display density.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={presentation.flagUrl}
      alt=""
      width={20}
      height={15}
      className="h-[15px] w-5 shrink-0 rounded-[2px] object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
    />
  ) : (
    <Globe2 size={13} strokeWidth={2} className="shrink-0 text-[#8898aa]" />
  );

  if (variant === 'detail') {
    return (
      <div
        className={`mb-4 flex items-center gap-3 rounded-xl border border-[#e6ebf1] bg-[#f6f9fc] px-3 py-2.5 dark:border-gray-800 dark:bg-gray-900 ${className}`}
        aria-label={accessibleLabel}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#e6ebf1] bg-white text-[#8898aa] shadow-soft-sm dark:border-gray-700 dark:bg-gray-800">
          <MapPin size={15} strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8898aa] dark:text-gray-500">
            {t.affiliateRow.searchLocation}
          </p>
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            {flag}
            <span className="truncate text-xs font-semibold text-[#0f172a] dark:text-white">
              {presentation.fullLabel}
            </span>
            <span className="text-[10px] font-semibold text-[#8898aa] dark:text-gray-400">
              {presentation.codeLabel}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[10px] text-[#8898aa] dark:text-gray-500">
            {presentation.brandName}
          </p>
        </div>
      </div>
    );
  }

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#e6ebf1] bg-[#f6f9fc] px-2 py-0.5 text-[10px] font-semibold text-[#425466] shadow-soft-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 ${className}`}
      title={accessibleLabel}
      aria-label={accessibleLabel}
    >
      {flag}
      <span className="whitespace-nowrap">{presentation.codeLabel}</span>
    </span>
  );
}
