'use client';

import { Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * =============================================================================
 * AuthLoadingScreen - NEO-BRUTALIST
 * =============================================================================
 * 
 * Updated: January 8th, 2026
 * i18n Migration: January 10th, 2026 - Priority 5: Shared Components
 * 
 * NEO-BRUTALIST DESIGN UPDATE:
 * - Sharp edges (no rounded corners)
 * - Bold borders (border-2 to border-4 with black)
 * - Offset shadows
 * - Yellow accent color (#ffbf23)
 * - Square elements throughout
 * - Dark mode support
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
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-100 dark:bg-black">
      <div className="flex flex-col items-center gap-8">
        
        {/* =================================================================
            LOGO AREA - NEO-BRUTALIST (January 8th, 2026)
            
            Matches the branding used in Sidebar.tsx with neo-brutalist styling.
            Uses the official logo.jpg and "CrewCast Studio" brand name.
            ================================================================= */}
        <div className="flex items-center gap-3">
          <img 
            src="/logo.jpg" 
            alt="CrewCast Studio" 
            className="w-10 h-10 border-2 border-black dark:border-gray-600 object-cover"
          />
          <div className="flex flex-col">
            <span className="font-black text-lg tracking-tight leading-none text-gray-900 dark:text-white uppercase">
              CrewCast <span className="text-black dark:text-white">Studio</span>
            </span>
            {/* January 21st, 2026: Removed selecdoo AI tagline per client request */}
          </div>
        </div>
        
        {/* Spinner - NEO-BRUTALIST square loader */}
        <div className="relative">
          {/* Outer square glow effect */}
          <div className="absolute inset-0 bg-[#ffbf23]/20 scale-150" />
          
          {/* Square container with spinner */}
          <div className="relative w-14 h-14 bg-[#ffbf23] border-2 border-black flex items-center justify-center shadow-[4px_4px_0px_0px_#000000]">
            <Loader2 
              className="w-7 h-7 text-black animate-spin" 
              strokeWidth={2.5}
            />
          </div>
        </div>
        
        {/* Loading text - NEO-BRUTALIST */}
        <p className="text-sm text-gray-500 font-bold uppercase tracking-widest">{t.common.loading}</p>
        
      </div>
    </div>
  );
};
