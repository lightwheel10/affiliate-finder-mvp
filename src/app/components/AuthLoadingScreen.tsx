'use client';

import { Loader2 } from 'lucide-react';

/**
 * AuthLoadingScreen (January 3rd, 2026)
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
 * Uses Lucide's Loader2 icon with Tailwind's animate-spin for a smooth,
 * battle-tested spinning animation that works reliably across all browsers.
 * 
 * =============================================================================
 * BRANDING FIX (January 3rd, 2026)
 * 
 * Previously showed "affiliatefinder" branding which was incorrect.
 * Updated to match the official app branding used throughout the app:
 * - "CrewCast Studio" as the main brand name
 * - "backed by selecdoo AI" as the tagline
 * - Logo image from /logo.jpg
 * 
 * This ensures brand consistency during loading states, matching:
 * - Sidebar.tsx logo area
 * - DashboardSkeleton in page.tsx
 * - All other branded components
 * =============================================================================
 */

export const AuthLoadingScreen = () => {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-[#F8F9FA] via-[#F0F2F5] to-[#E8EAED]">
      <div className="flex flex-col items-center gap-8">
        
        {/* =================================================================
            LOGO AREA (January 3rd, 2026)
            
            Matches the branding used in Sidebar.tsx and DashboardSkeleton.
            Uses the official logo.jpg and "CrewCast Studio" brand name.
            ================================================================= */}
        <div className="flex items-center gap-2.5">
          <img 
            src="/logo.jpg" 
            alt="CrewCast Studio" 
            className="w-9 h-9 rounded-lg shadow-md shadow-[#1A1D21]/10 object-cover"
          />
          <div className="flex flex-col">
            <span className="font-bold text-lg tracking-tight leading-none text-slate-900">
              CrewCast <span className="text-[#1A1D21]">Studio</span>
            </span>
            <span className="text-[10px] font-medium text-slate-400 tracking-wide mt-0.5">
              backed by selecdoo AI
            </span>
          </div>
        </div>
        
        {/* Spinner using Lucide's Loader2 - proven smooth animation */}
        <div className="relative">
          {/* Subtle glow effect */}
          <div className="absolute inset-0 bg-[#D4E815]/20 rounded-full blur-xl scale-150" />
          
          {/* Lucide Loader2 - designed for smooth rotation */}
          <Loader2 
            className="w-10 h-10 text-[#D4E815] animate-spin relative" 
            strokeWidth={2.5}
          />
        </div>
        
        {/* Loading text */}
        <p className="text-sm text-slate-500">Loading...</p>
        
      </div>
    </div>
  );
};

