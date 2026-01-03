'use client';

/**
 * =============================================================================
 * DASHBOARD LAYOUT - January 3rd, 2026
 * =============================================================================
 * 
 * This layout wraps all authenticated dashboard pages (discovered, saved,
 * outreach, settings) and provides:
 * 
 * 1. AuthGuard - Ensures user is authenticated and onboarded
 * 2. Sidebar - Persists across page navigation (no remounting!)
 * 3. Common layout structure with main content area
 * 
 * WHY THIS ARCHITECTURE:
 * ----------------------
 * Previously, each page had its own <Sidebar /> component. When navigating
 * between pages, the Sidebar would unmount and remount, causing:
 *   - useSubscription to refetch (500ms+ API call)
 *   - SidebarSkeleton to flash during loading
 *   - Poor user experience
 * 
 * By placing the Sidebar in a shared layout:
 *   - Sidebar stays mounted during navigation within the route group
 *   - No refetching, no skeleton flash
 *   - Better performance and user experience
 * 
 * ROUTE GROUP:
 * ------------
 * The (dashboard) folder name with parentheses is a "route group" in Next.js.
 * It doesn't affect the URL path but allows shared layouts.
 *   - /discovered → src/app/(dashboard)/discovered/page.tsx
 *   - /saved → src/app/(dashboard)/saved/page.tsx
 *   - etc.
 * 
 * PAGES IN THIS LAYOUT:
 * ---------------------
 * - /discovered - All discovered affiliates
 * - /saved - Saved affiliates (pipeline)
 * - /outreach - AI email generation
 * - /settings - Account settings
 * 
 * NOT IN THIS LAYOUT:
 * -------------------
 * - / (home) - Has its own auth handling (landing + dashboard)
 * - /sign-in, /sign-up - Auth pages
 * - /admin/* - Admin dashboard
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
          Dashboard Container
          - Sidebar is rendered ONCE here and persists across all pages in this layout
          - Children are the individual page contents
        */}
        <div className="flex min-h-screen bg-[#FDFDFD] font-sans text-slate-900 selection:bg-[#D4E815]/30 selection:text-[#1A1D21]">
          {/* 
            Sidebar - January 3rd, 2026
            Now in the layout so it doesn't remount on page navigation.
            This eliminates the skeleton flash caused by useSubscription refetching.
          */}
          <Sidebar />
          
          {/* 
            Main Content Area
            - ml-52 matches the Sidebar width (w-52 = 208px)
            - Each page provides its own header and content
          */}
          <main className="flex-1 flex flex-col min-h-screen ml-52">
            {children}
          </main>
        </div>
      </ErrorBoundary>
    </AuthGuard>
  );
}

