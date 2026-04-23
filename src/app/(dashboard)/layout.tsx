'use client';

/**
 * =============================================================================
 * DASHBOARD LAYOUT - January 3rd, 2026 (Updated January 6th, 2026)
 * =============================================================================
 * 
 * DESIGN UPDATE (January 6th, 2026):
 * Neo-brutalist design from DashboardDemo.tsx
 * - Changed sidebar width from w-52 (208px) to w-64 (256px)
 * - Changed background from soft white to gray-100/black
 * - Added dark mode support
 * 
 * This layout wraps all authenticated dashboard pages (discovered, saved,
 * outreach, settings) and provides:
 * 
 * 1. AuthGuard - Ensures user is authenticated and onboarded
 * 2. Sidebar - Persists across page navigation (no remounting!)
 * 3. Common layout structure with main content area
 * 
 * =============================================================================
 */

import { Sidebar } from '../components/Sidebar';
import { AuthGuard } from '../components/AuthGuard';
import ErrorBoundary from '../components/ErrorBoundary';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <ErrorBoundary>
        {/* 
          Dashboard Container - NEW DESIGN (January 6th, 2026)
          Neo-brutalist style matching DashboardDemo.tsx:
          - bg-gray-100 dark:bg-black
          - font-sans (Inter font from layout.tsx + globals.css)
          - text-gray-900 dark:text-gray-100
        */}
        <div className="flex min-h-screen bg-gray-100 dark:bg-black font-sans text-gray-900 dark:text-gray-100">
          {/* 
            Sidebar - Updated January 6th, 2026
            Width changed from w-52 to w-64 for neo-brutalist design
          */}
          <Sidebar />
          
          {/* 
            Main Content Area - NEW DESIGN
            - ml-64 matches the new Sidebar width (w-64 = 256px)
            - White background with dark mode support
            
            OVERFLOW FIX - January 23, 2026
            Added overflow-x-hidden to prevent horizontal scrolling when table
            content (like long URLs or titles) causes the grid to expand.
            Without this, the filter bar gets pushed off-screen when results load.

            STICKY-HEADER FIX - April 23, 2026
            Changed `min-h-screen` → `h-screen`. DO NOT revert to min-h-screen.

            Why: Phase 2d made every dashboard page <header> `sticky top-0`.
            position:sticky pins to the nearest ancestor *scroll container*.
            Setting `overflow-x: hidden` forces `overflow-y` to compute to
            `auto` (per CSS spec), so <main> is already a scroll container.
            With `min-h-screen`, <main> grew with its content and never
            actually needed to scroll — the <body> scrolled instead, so
            <main> (and its sticky header) scrolled out of view with it.

            Locking <main> to exactly 100vh (`h-screen`) means:
              - <main> is the true scroll container for dashboard content
              - <body> never scrolls
              - Sticky header pins to the viewport top where it belongs
              - Each page's inner `flex-1 overflow-y-auto` div scrolls
                internally (which was always the original intent)

            Verified safe for: find, discovered, saved, outreach (inner
            overflow-y-auto divs), settings (h-[calc(100vh-8rem)] fits
            inside the 100vh-64px-padding envelope), and loading.tsx.
          */}
          <main className="flex-1 flex flex-col h-screen ml-64 bg-white dark:bg-[#050505] overflow-x-hidden">
            {children}
          </main>
        </div>
        
        {/* OLD_DESIGN_START - Dashboard Container (pre-January 6th, 2026)
        <div className="flex min-h-screen bg-[#FDFDFD] font-sans text-slate-900 selection:bg-[#D4E815]/30 selection:text-[#1A1D21]">
          <Sidebar />
          <main className="flex-1 flex flex-col min-h-screen ml-52">
            {children}
          </main>
        </div>
        OLD_DESIGN_END */}
      </ErrorBoundary>
    </AuthGuard>
  );
}

