'use client';

/**
 * =============================================================================
 * LoadingOnboardingScreen — SMOOVER REFRESH
 * =============================================================================
 *
 * Updated: April 24th, 2026
 * i18n Migration: January 10th, 2026 - Remaining Components
 *
 * CURRENT DESIGN LANGUAGE ("smoover"):
 * - Soft rounded card shell (rounded-2xl + shadow-soft-xl + hairline
 *   #e6ebf1 border) matching the onboarding wizard shell.
 * - Yellow loader tile gets rounded-xl + shadow-yellow-glow-sm (no more
 *   brutalist offset shadow).
 * - Archivo display title (font-display); softened #8898aa body copy.
 * - Dark-mode support preserved.
 *
 * This screen displays briefly (2 seconds) after onboarding completion
 * while the user data is being refetched.
 *
 * All UI strings have been migrated to use the translation dictionary.
 * Translation hook usage: const { t } = useLanguage();
 *
 * =============================================================================
 */

import React from 'react';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export const LoadingOnboardingScreen = () => {
  // i18n translation hook (January 10th, 2026)
  const { t } = useLanguage();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#fdfdfd] dark:bg-[#0a0a0a] font-sans p-4">
      <div className="w-full max-w-[420px] bg-white dark:bg-[#0f0f0f] border border-[#e6ebf1] dark:border-gray-800 rounded-2xl shadow-soft-xl p-8 text-center">

        {/* Animated Loader — smoover refresh (April 24th, 2026). Concentric yellow squares soften to rounded tiles; inner loader picks up shadow-yellow-glow-sm. */}
        <div className="relative w-24 h-24 mx-auto mb-6 flex items-center justify-center">
          {/* Outer Square Glow */}
          <div className="absolute inset-0 bg-[#ffbf23]/20 rounded-2xl animate-pulse" />

          {/* Middle Square */}
          <div className="absolute inset-3 bg-[#ffbf23]/30 border border-[#ffbf23]/50 rounded-xl" />

          {/* Inner Square with Spinner */}
          <div className="relative w-14 h-14 bg-[#ffbf23] rounded-xl flex items-center justify-center shadow-yellow-glow-sm">
             <Loader2 className="w-7 h-7 text-[#1A1D21] animate-spin" />
          </div>
        </div>

        {/* Main Heading — smoover refresh (April 24th, 2026). Archivo display title. */}
        <h1 className="text-xl font-display text-[#0f172a] dark:text-white font-bold tracking-tight mb-3">
          {t.loadingOnboarding.title}
        </h1>

        {/* Description Text — smoover palette */}
        <div className="space-y-2 max-w-sm mx-auto">
          <p className="text-[#425466] dark:text-gray-400 text-sm leading-relaxed font-medium">
            {t.loadingOnboarding.subtitle}
          </p>
          <p className="text-[#8898aa] dark:text-gray-500 text-xs leading-relaxed">
            {t.loadingOnboarding.description}
          </p>
        </div>

      </div>
    </div>
  );
};
