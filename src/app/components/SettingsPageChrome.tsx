'use client';

import type { ReactNode } from 'react';

type SettingsPageChromeProps = {
  children: ReactNode;
  title: string;
};

/**
 * Stable outer frame shared by the real Settings page and its loading state.
 *
 * DashboardShell is exactly one viewport tall. Keeping the header outside the
 * scroll region, and preventing it from shrinking, means long Settings tabs
 * cannot squash or move the header. Sharing this frame with the loading state
 * also prevents a visible layout jump when Next.js swaps the fallback for the
 * finished page.
 */
export function SettingsPageChrome({ children, title }: SettingsPageChromeProps) {
  return (
    <>
      <header
        data-settings-page-header
        className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-[#e6ebf1] bg-white px-6 dark:border-gray-800 dark:bg-[#0a0a0a] lg:px-8"
      >
        <h1 className="font-display text-xl font-bold tracking-tight text-[#0f172a] dark:text-white">
          {title}
        </h1>
      </header>
      <div
        data-settings-scroll-region
        className="mx-auto min-h-0 w-full max-w-[1600px] flex-1 overflow-x-hidden overflow-y-auto px-4 py-5 sm:px-6 lg:px-8 lg:py-6"
      >
        {children}
      </div>
    </>
  );
}
