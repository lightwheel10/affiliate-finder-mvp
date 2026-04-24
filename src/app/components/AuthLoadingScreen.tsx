'use client';

import { Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * =============================================================================
 * AuthLoadingScreen — SMOOVER REFRESH
 * =============================================================================
 *
 * Updated: April 24th, 2026
 * i18n Migration: January 10th, 2026 - Priority 5: Shared Components
 *
 * CURRENT DESIGN LANGUAGE ("smoover"):
 * - Page bg #fdfdfd matching sign-in / onboarding.
 * - Logo uses rounded-md + hairline #e6ebf1 border; wordmark adopts
 *   font-display + text-gradient-brand on "One" (consistent with sign-in
 *   + onboarding wizard logo row).
 * - Yellow spinner tile: rounded-xl + shadow-yellow-glow-sm (no more
 *   brutalist offset shadow).
 * - Loading text: muted #8898aa eyebrow style.
 * - Dark-mode support preserved.
 *
 * A polished loading screen shown during authentication and page transitions.
 * This replaces the DashboardSkeleton for initial auth loading to avoid
 * showing a "flash" of the dashboard to new users during sign-up.
 *
 * Used when:
 * - Next.js page transitions (loading.tsx)
 * - Stack Auth is checking the session (stackUser === undefined)
 * - Neon user is being fetched/created (neonLoading === true)
 * - Race condition guards (userId is null)
 *
 * All UI strings have been migrated to use the translation dictionary.
 * Translation hook usage: const { t } = useLanguage();
 *
 * =============================================================================
 */

export const AuthLoadingScreen = () => {
  // i18n translation hook (January 10th, 2026)
  const { t } = useLanguage();
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#fdfdfd] dark:bg-[#0a0a0a]">
      <div className="flex flex-col items-center gap-8">

        {/* =================================================================
            LOGO AREA — smoover refresh (April 24th, 2026)

            Matches the branding used in Sidebar.tsx / sign-in page with the
            smoover design language (rounded logo tile, Archivo wordmark,
            gradient "One").
            ================================================================= */}
        <div className="flex items-center gap-3">
          <img
            src="/logo.svg"
            alt="Afforce One"
            className="w-10 h-10 rounded-md border border-[#e6ebf1] dark:border-gray-700"
          />
          <div className="flex flex-col">
            <span className="font-display font-bold text-lg tracking-tight leading-none text-[#0f172a] dark:text-white">
              Afforce <span className="text-gradient-brand">One</span>
            </span>
            {/* January 21st, 2026: Removed selecdoo AI tagline per client request */}
          </div>
        </div>

        {/* Spinner — smoover refresh (April 24th, 2026). Yellow square tile with rounded-xl + shadow-yellow-glow-sm. */}
        <div className="relative">
          {/* Outer square glow effect */}
          <div className="absolute inset-0 bg-[#ffbf23]/20 rounded-2xl scale-150" />

          {/* Square container with spinner */}
          <div className="relative w-14 h-14 bg-[#ffbf23] rounded-xl flex items-center justify-center shadow-yellow-glow-sm">
            <Loader2
              className="w-7 h-7 text-[#1A1D21] animate-spin"
              strokeWidth={2.5}
            />
          </div>
        </div>

        {/* Loading text — smoover muted eyebrow */}
        <p className="text-sm text-[#8898aa] font-semibold uppercase tracking-widest">{t.common.loading}</p>

      </div>
    </div>
  );
};
