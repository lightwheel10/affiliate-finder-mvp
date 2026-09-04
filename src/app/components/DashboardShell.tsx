'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { Sidebar } from '@/app/components/Sidebar';
import { useBrandLocation } from '@/contexts/BrandLocationContext';
import { useLanguage } from '@/contexts/LanguageContext';

export function DashboardShell({ children }: { children: ReactNode }) {
  const {
    featureEnabled,
    activeLocation,
    isLoading,
    isReady,
    error,
    refreshPortfolio,
  } = useBrandLocation();
  const { t } = useLanguage();

  return (
    <div className="flex min-h-screen bg-gray-100 font-sans text-gray-900 dark:bg-black dark:text-gray-100">
      <Sidebar />
      <main
        key={featureEnabled ? activeLocation?.id ?? 'portfolio-pending' : 'legacy-default'}
        className="ml-64 flex h-screen flex-1 flex-col overflow-x-hidden bg-white dark:bg-[#050505]"
      >
        {featureEnabled && isLoading ? (
          <div className="flex h-full items-center justify-center" role="status">
            <div className="flex items-center gap-3 text-sm font-medium text-[#425466] dark:text-gray-300">
              <Loader2 size={18} className="animate-spin text-[#ffbf23]" />
              {t.dashboard.brandLocations.loadingPortfolio}
            </div>
          </div>
        ) : featureEnabled && (!isReady || error) ? (
          <div className="flex h-full items-center justify-center px-6">
            <div className="max-w-md rounded-2xl border border-red-100 bg-red-50 p-6 text-center dark:border-red-900/40 dark:bg-red-950/20">
              <AlertTriangle size={28} className="mx-auto mb-3 text-red-500" />
              <h1 className="font-display text-lg font-bold text-[#0f172a] dark:text-white">
                {t.dashboard.brandLocations.portfolioUnavailable}
              </h1>
              <p className="mt-2 text-sm text-[#425466] dark:text-gray-400">
                {t.dashboard.brandLocations.portfolioUnavailableDescription}
              </p>
              <button
                type="button"
                onClick={() => void refreshPortfolio()}
                className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-full bg-[#ffbf23] px-5 py-2 text-sm font-semibold text-[#0f172a] shadow-yellow-glow-sm transition-[background-color,scale] duration-150 hover:bg-[#e5ac20] active:scale-[0.96]"
              >
                <RefreshCw size={15} />
                {t.common.retry}
              </button>
            </div>
          </div>
        ) : children}
      </main>
    </div>
  );
}
