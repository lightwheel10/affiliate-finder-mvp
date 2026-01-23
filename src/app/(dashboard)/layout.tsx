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
          */}
          <main className="flex-1 flex flex-col min-h-screen ml-64 bg-white dark:bg-[#050505] overflow-x-hidden">
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

