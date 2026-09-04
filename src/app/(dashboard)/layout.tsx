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

import { AuthGuard } from '../components/AuthGuard';
import ErrorBoundary from '../components/ErrorBoundary';
import { DashboardShell } from '../components/DashboardShell';
import { BrandLocationProvider } from '@/contexts/BrandLocationContext';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <ErrorBoundary>
        <BrandLocationProvider>
          <DashboardShell>{children}</DashboardShell>
        </BrandLocationProvider>
      </ErrorBoundary>
    </AuthGuard>
  );
}

