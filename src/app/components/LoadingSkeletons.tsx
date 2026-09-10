'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { usePathname } from 'next/navigation';
import { AffiliateRowSkeleton } from './AffiliateRowSkeleton';
import { SettingsPageChrome } from './SettingsPageChrome';

// Presentation only: these components never fetch data or decide access.
function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={cn('rounded-md bg-[#f6f9fc] dark:bg-gray-800 motion-safe:animate-pulse', className)} />;
}

export function AffiliateRowsSkeleton({
  variant = 'affiliate',
  label,
}: {
  variant?: 'affiliate' | 'outreach';
  label: string;
}) {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => variant === 'outreach' ? (
          <div key={index} className="grid grid-cols-12 gap-4 items-center px-4 py-4 min-h-[72px] border-b border-[#e6ebf1] dark:border-gray-800 last:border-b-0">
            <div className="col-span-1 flex justify-center"><Skeleton className="h-4 w-4" /></div>
            <div className="col-span-2 flex items-center gap-2 min-w-0">
              <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
              <Skeleton className="h-3 w-20 max-w-full" />
            </div>
            <div className="col-span-2"><Skeleton className="h-3 w-24 max-w-full" /></div>
            <div className="col-span-3"><Skeleton className="h-6 w-32 max-w-full rounded-full" /></div>
            <div className="col-span-2"><Skeleton className="h-3 w-28 max-w-full" /></div>
            <div className="col-span-2 flex justify-end"><Skeleton className="h-8 w-28 max-w-full rounded-full" /></div>
          </div>
        ) : <AffiliateRowSkeleton key={index} />)}
      </div>
    </div>
  );
}

export function SettingsPanelSkeleton({ variant = 'profile' }: { variant?: 'profile' | 'plan' }) {
  const { t } = useLanguage();
  if (variant === 'plan') {
    return (
      <div role="status" aria-busy="true" className="space-y-8">
        <span className="sr-only">{t.common.loading}</span>
        <div className="space-y-4 rounded-2xl border border-[#e6ebf1] p-5 shadow-soft-sm dark:border-gray-800">
          <div className="flex justify-between gap-4">
            <div className="space-y-2"><Skeleton className="h-5 w-32" /><Skeleton className="h-3 w-40" /></div>
            <Skeleton className="h-9 w-28 rounded-full" />
          </div>
          <Skeleton className="h-3 w-48 max-w-full" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    );
  }
  return (
    <div role="status" aria-busy="true" className="space-y-6">
      <span className="sr-only">{t.common.loading}</span>
      <div className="grid grid-cols-1 gap-6">
        {[0, 1].map((index) => (
          <div key={index} className="space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-11 w-full rounded-lg" />
          </div>
        ))}
      </div>
      <Skeleton className="h-10 w-32 rounded-full" />
    </div>
  );
}

export function BrandSettingsSkeleton() {
  const { t } = useLanguage();
  return (
    <div role="status" aria-busy="true" className="space-y-6">
      <span className="sr-only">{t.dashboard.brandLocations.loadingPortfolio}</span>
      <div className="flex justify-end">
        <Skeleton className="h-10 w-28 shrink-0 rounded-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1].map((index) => (
          <div key={index} className="space-y-3 rounded-2xl border border-[#e6ebf1] p-4 dark:border-gray-800">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-16" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-[#e6ebf1] dark:border-gray-800">
        <div className="flex flex-col gap-4 border-b border-[#e6ebf1] px-5 py-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-2"><Skeleton className="h-5 w-36" /><Skeleton className="h-3 w-48 max-w-full" /></div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-9 w-24 rounded-full" />
            <Skeleton className="h-9 w-28 rounded-full" />
            <Skeleton className="h-9 w-20 rounded-full" />
          </div>
        </div>
        <div className="p-5">
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function SidebarPlanSkeleton() {
  const { t } = useLanguage();
  return (
    <div role="status" aria-busy="true" className="rounded-2xl border border-gray-800 bg-gradient-to-br from-[#0f172a] to-[#1a1a1a] p-4 shadow-soft-lg">
      <span className="sr-only">{t.common.loading}</span>
      <div className="flex gap-3 mb-3">
        <Skeleton className="h-7 w-7 shrink-0 bg-gray-700" />
        <div className="flex-1 space-y-2"><Skeleton className="h-3 w-24 bg-gray-700" /><Skeleton className="h-3 w-28 bg-gray-700" /></div>
      </div>
      <Skeleton className="h-8 w-full rounded-full bg-gray-700" />
    </div>
  );
}

export type DashboardLoadingPage = 'find' | 'discovered' | 'saved' | 'outreach' | 'settings';

const DASHBOARD_LOADING_PAGES: Record<string, DashboardLoadingPage | undefined> = {
  '/find': 'find',
  '/discovered': 'discovered',
  '/saved': 'saved',
  '/outreach': 'outreach',
  '/settings': 'settings',
  '/brands': 'settings',
};

// The layout can load before a child route's fallback is available. Resolve
// that case from the current URL instead of briefly showing another page.
export function DashboardRouteSkeleton() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const page = pathname ? DASHBOARD_LOADING_PAGES[pathname] : undefined;
  if (page) return <DashboardPageSkeleton page={page} />;
  return (
    <div role="status" aria-busy="true" className="flex h-full items-center justify-center text-sm text-[#425466] dark:text-gray-300">
      {t.common.loading}
    </div>
  );
}

// Route-specific fallbacks share their row placeholders with the data-loading
// states. Settings keeps its own navigation/panel geometry instead of a table.
export function DashboardPageSkeleton({ page }: { page: DashboardLoadingPage }) {
  const { t } = useLanguage();
  const isSettings = page === 'settings';
  const isOutreach = page === 'outreach';
  const title = t.dashboard[page].pageTitle;
  const columns = isOutreach
    ? ['col-span-1', 'col-span-2', 'col-span-2', 'col-span-3', 'col-span-2', 'col-span-2']
    : ['col-span-1', 'col-span-3', 'col-span-3', 'col-span-2', 'col-span-1', 'col-span-2'];

  if (isSettings) {
    return (
      <SettingsPageChrome title={title}>
        <div className="flex flex-col items-start gap-6 md:flex-row lg:gap-8">
          <div aria-hidden="true" className="w-full shrink-0 space-y-3 md:sticky md:top-5 md:w-64 lg:top-6">
            <Skeleton className="mb-4 h-3 w-20" />
            {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-10 w-full rounded-lg" />)}
          </div>
          <div className="min-w-0 flex-1 rounded-2xl border border-[#e6ebf1] bg-white p-5 shadow-soft-sm dark:border-gray-800 dark:bg-[#0f0f0f] sm:p-6 lg:p-8">
            <div className="max-w-2xl"><SettingsPanelSkeleton /></div>
          </div>
        </div>
      </SettingsPageChrome>
    );
  }

  return (
    <>
      <header className="h-16 shrink-0 px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30 bg-white dark:bg-[#0a0a0a] border-b border-[#e6ebf1] dark:border-gray-800">
        <h1 className="font-display text-xl font-bold tracking-tight text-[#0f172a] dark:text-white">{title}</h1>
        <div aria-hidden="true" className="flex items-center gap-4">
          <Skeleton className="hidden md:block h-8 w-56 rounded-full" />
          <div className="hidden lg:flex gap-3">
            {[95, 100, 75].map((width) => <div key={width} style={{ width }}><Skeleton className="h-8 rounded-full" /></div>)}
          </div>
          <Skeleton className="h-9 w-36 rounded-full" />
        </div>
      </header>
      <div className="flex-1 p-8 overflow-y-auto overflow-x-hidden">
        <div aria-hidden="true" className="flex justify-between items-center gap-4 mb-8">
          <div className="flex items-center gap-4 min-w-0">
            <Skeleton className="h-10 w-64 max-w-full rounded-full" />
            <Skeleton className="hidden md:block h-10 w-80 rounded-full" />
          </div>
          <Skeleton className="h-10 w-24 shrink-0 rounded-full" />
        </div>
        <div className={`bg-white dark:bg-[#0f0f0f] border border-[#e6ebf1] dark:border-gray-800 shadow-soft-sm min-h-[500px] overflow-hidden ${isOutreach ? 'rounded-2xl' : 'rounded-xl'}`}>
          <div aria-hidden="true" className={`grid grid-cols-12 gap-4 border-b border-[#e6ebf1] dark:border-gray-800 ${isOutreach ? 'p-4' : 'px-4 py-3 bg-[#f6f9fc] dark:bg-gray-800/50'}`}>
            {columns.map((column, index) => <div key={index} className={column}><Skeleton className="h-4 w-3/4" /></div>)}
          </div>
          <AffiliateRowsSkeleton variant={isOutreach ? 'outreach' : 'affiliate'} label={t.common.loading} />
        </div>
      </div>
    </>
  );
}
