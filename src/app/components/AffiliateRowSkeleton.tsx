import React from 'react';

/**
 * AffiliateRow loading skeleton.
 *
 * HISTORY:
 *   April 23rd, 2026 (Phase 2e) — Realigned grid to match AffiliateRow.tsx
 *   exactly so the skeleton doesn't cause a column jump when real rows hydrate.
 *
 *   Before this change the skeleton used a fixed-width column grid
 *   `grid-cols-[48px_280px_1fr_160px_128px_144px]` (6 columns) while the real
 *   row uses `grid-cols-12 gap-4` with col-span-{1,3,3,2,1,2}. On wider screens
 *   that meant pills and thumbnails visibly shifted sideways as data loaded.
 *
 *   Also softened to match the "smoover" row styling:
 *     - Rounded-full placeholder shapes instead of hard rounded rectangles.
 *     - Hairline bottom divider (#e6ebf1) so stacked skeletons read as a table.
 *     - Added dark-mode placeholders so the page doesn't flash white in dark mode.
 *     - Matched `items-center` + `p-4` + `min-h-[72px]` envelope of the real row.
 */
export const AffiliateRowSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-12 gap-4 items-center p-4 min-h-[72px] bg-white dark:bg-[#0f0f0f] border-b border-[#e6ebf1] dark:border-gray-800 last:border-b-0 animate-pulse">
      {/* Checkbox — col-span-1 */}
      <div className="col-span-1 flex justify-center">
        <div className="w-4 h-4 rounded bg-[#f6f9fc] dark:bg-gray-800"></div>
      </div>

      {/* Affiliate Info — col-span-3 (avatar + name + metrics pill) */}
      <div className="col-span-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#f6f9fc] dark:bg-gray-800 shrink-0"></div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3.5 rounded-full bg-[#f6f9fc] dark:bg-gray-800 w-32"></div>
            <div className="h-4 rounded-full bg-[#f6f9fc] dark:bg-gray-800/70 w-24"></div>
          </div>
        </div>
      </div>

      {/* Relevant Content — col-span-3 (thumbnail slot + text lines + stat pills) */}
      <div className="col-span-3 min-w-0">
        <div className="flex items-start gap-3">
          <div className="w-16 h-12 rounded-lg bg-[#f6f9fc] dark:bg-gray-800 shrink-0"></div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 rounded-full bg-[#f6f9fc] dark:bg-gray-800 w-3/4"></div>
            <div className="h-3 rounded-full bg-[#f6f9fc] dark:bg-gray-800/70 w-5/6"></div>
            <div className="flex items-center gap-2 pt-1">
              <div className="h-4 rounded-full bg-[#f6f9fc] dark:bg-gray-800 w-16"></div>
              <div className="h-4 rounded-full bg-[#f6f9fc] dark:bg-gray-800/70 w-20"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Discovery Method — col-span-2 (single pill) */}
      <div className="col-span-2">
        <div className="h-6 rounded-full bg-[#f6f9fc] dark:bg-gray-800 w-28"></div>
      </div>

      {/* Date — col-span-1 (single pill) */}
      <div className="col-span-1">
        <div className="h-6 rounded-full bg-[#f6f9fc] dark:bg-gray-800 w-16"></div>
      </div>

      {/* Actions — col-span-2 (three circular buttons, right-aligned) */}
      <div className="col-span-2 flex items-center justify-end gap-2">
        <div className="w-8 h-8 rounded-full bg-[#f6f9fc] dark:bg-gray-800"></div>
        <div className="w-8 h-8 rounded-full bg-[#f6f9fc] dark:bg-gray-800"></div>
        <div className="w-8 h-8 rounded-full bg-[#f6f9fc] dark:bg-gray-800"></div>
      </div>
    </div>
  );
};
