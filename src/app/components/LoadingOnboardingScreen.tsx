'use client';

/**
 * =============================================================================
 * LoadingOnboardingScreen - NEO-BRUTALIST
 * =============================================================================
 * 
 * Updated: January 8th, 2026
 * i18n Migration: January 10th, 2026 - Remaining Components
 * 
 * NEO-BRUTALIST DESIGN UPDATE:
 * - Sharp edges (no rounded corners)
 * - Bold borders (border-4 with black)
 * - Offset shadows
 * - Yellow accent color (#ffbf23)
 * - Square loader with bold styling
 * - Dark mode support
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
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-100 dark:bg-black font-sans p-4">
      <div className="w-full max-w-[420px] bg-white dark:bg-[#0f0f0f] border-4 border-black dark:border-gray-600 shadow-[8px_8px_0px_0px_#000000] dark:shadow-[8px_8px_0px_0px_#333333] p-8 text-center">
        
        {/* Animated Loader Icon - NEO-BRUTALIST */}
        <div className="relative w-24 h-24 mx-auto mb-6 flex items-center justify-center">
          {/* Outer Square Glow */}
          <div className="absolute inset-0 bg-[#ffbf23]/20 animate-pulse" />
          
          {/* Middle Square */}
          <div className="absolute inset-3 bg-[#ffbf23]/30 border-2 border-[#ffbf23]/50" />
          
          {/* Inner Square with Spinner - NEO-BRUTALIST */}
          <div className="relative w-14 h-14 bg-[#ffbf23] border-2 border-black flex items-center justify-center shadow-[3px_3px_0px_0px_#000000]">
             <Loader2 className="w-7 h-7 text-black animate-spin" />
          </div>
        </div>

        {/* Main Heading - NEO-BRUTALIST */}
        <h1 className="text-xl text-gray-900 dark:text-white font-black uppercase tracking-wide mb-3">
          {t.loadingOnboarding.title}
        </h1>

        {/* Description Text */}
        <div className="space-y-2 max-w-sm mx-auto">
          <p className="text-gray-500 text-sm leading-relaxed font-medium">
            {t.loadingOnboarding.subtitle}
          </p>
          <p className="text-gray-400 text-xs leading-relaxed">
            {t.loadingOnboarding.description}
          </p>
        </div>

      </div>
    </div>
  );
};
