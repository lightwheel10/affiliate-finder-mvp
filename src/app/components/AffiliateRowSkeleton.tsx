import React from 'react';

export const AffiliateRowSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-[48px_280px_1fr_160px_128px_144px] gap-0 items-start p-4 bg-white border-b border-slate-50 animate-pulse">
      {/* Checkbox */}
      <div className="pt-1 flex justify-center">
        <div className="w-4 h-4 rounded bg-slate-200"></div>
      </div>

      {/* Affiliate Info */}
      <div className="pr-6">
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-200 shrink-0"></div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 bg-slate-200 rounded w-32"></div>
              <div className="h-3 bg-slate-100 rounded w-24"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Relevant Content */}
      <div className="pr-8 min-w-0 space-y-2">
        <div className="h-4 bg-slate-200 rounded w-3/4"></div>
        <div className="h-3 bg-slate-100 rounded w-full"></div>
        <div className="h-3 bg-slate-100 rounded w-5/6"></div>
        <div className="flex items-center gap-2 mt-2">
          <div className="h-3 bg-slate-200 rounded w-16"></div>
          <div className="h-3 bg-slate-100 rounded w-20"></div>
        </div>
      </div>

      {/* Discovery Method */}
      <div className="pt-1 space-y-2">
        <div className="h-3 bg-slate-100 rounded w-20"></div>
        <div className="h-6 bg-slate-200 rounded w-28"></div>
      </div>

      {/* Discovery Date */}
      <div className="pt-1">
        <div className="h-3 bg-slate-100 rounded w-20"></div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-1 pt-1 shrink-0">
        <div className="w-8 h-8 bg-slate-100 rounded-lg"></div>
        <div className="w-8 h-8 bg-slate-100 rounded-lg"></div>
        <div className="w-8 h-8 bg-slate-100 rounded-lg"></div>
      </div>
    </div>
  );
};

