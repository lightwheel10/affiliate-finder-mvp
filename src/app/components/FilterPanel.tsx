'use client';

/**
 * =============================================================================
 * FILTER PANEL COMPONENT - Updated January 6th, 2026
 * i18n Migration: January 10th, 2026 - Priority 5: Shared Components
 * =============================================================================
 * 
 * DESIGN UPDATE: Neo-brutalist style from DashboardDemo.tsx
 * - Uses brand yellow (#ffbf23) instead of lime green (#D4E815)
 * - Bold borders (border-2) instead of subtle borders
 * - Industrial typography and styling
 * - Dark mode support
 * 
 * All UI strings have been migrated to use the translation dictionary.
 * Translation hook usage: const { t } = useLanguage();
 * =============================================================================
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  SlidersHorizontal, 
  ChevronDown, 
  X,
  Users,
  Tag,
  Calendar,
  Hash
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  ResultItem, 
  FilterState, 
  DEFAULT_FILTER_STATE, 
  countActiveFilters,
  parseSubscriberCount
} from '../types';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dictionary } from '@/dictionaries';

interface FilterPanelProps {
  affiliates: ResultItem[];
  activeFilters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
  /** User's onboarding competitors - always shown in filter dropdown (January 13th, 2026) */
  userCompetitors?: string[];
  /** User's onboarding topics - always shown in filter dropdown (January 13th, 2026) */
  userTopics?: string[];
}

// -----------------------------------------------------------------------------
// Helper to extract unique values from affiliates
// Updated January 13th, 2026: Now merges onboarding data with search results
// -----------------------------------------------------------------------------
function extractFilterOptions(
  affiliates: ResultItem[],
  userCompetitors?: string[],
  userTopics?: string[]
): {
  competitors: string[];
  topics: string[];
} {
  const competitors = new Set<string>();
  const topics = new Set<string>();

  // Add onboarding data first (always available in filter)
  if (userCompetitors) {
    userCompetitors.forEach(c => competitors.add(c));
  }
  if (userTopics) {
    userTopics.forEach(t => topics.add(t));
  }

  // Add data from search results
  affiliates.forEach(item => {
    if (item.discoveryMethod) {
      if (item.discoveryMethod.type === 'competitor') {
        competitors.add(item.discoveryMethod.value);
      } else if (item.discoveryMethod.type === 'topic' || item.discoveryMethod.type === 'keyword') {
        topics.add(item.discoveryMethod.value);
      }
    }
    // ==========================================================================
    // BUG FIX - January 25, 2026
    // 
    // Previously, item.keyword was added to topics regardless of discovery type.
    // This caused competitor-discovered affiliates (e.g., discovered via apollo.io
    // with keyword "bedrop") to appear in topic filter results for "bedrop".
    // 
    // FIX: Only add keyword to topics if the affiliate was NOT discovered via
    // competitor or brand search. This ensures the Topics filter only shows
    // affiliates discovered via topic/keyword searches.
    // ==========================================================================
    if (item.keyword && 
        item.discoveryMethod?.type !== 'competitor' && 
        item.discoveryMethod?.type !== 'brand') {
      topics.add(item.keyword);
    }
  });

  return {
    competitors: Array.from(competitors).sort(),
    topics: Array.from(topics).sort(),
  };
}

// ============================================================================
// FilterPill — DEAD CODE (kept in file, not currently rendered)
// ----------------------------------------------------------------------------
// STATUS (verified April 25, 2026): nothing in the app uses <FilterPill />.
// The component is `const`, NOT exported, and has no internal call sites
// inside this file either — the live `FilterPanel` component below renders
// <MultiSelect />, <RangePresets />, <DatePresets /> directly.
//
// HISTORY:
//   - Was the original "horizontal filter pill row" UI before
//     January 23, 2026.
//   - Replaced by the slide-out OVERLAY APPROACH (see the comment near
//     the bottom of this file labelled "OVERLAY APPROACH - January 23,
//     2026"). The new slide-out panel doesn't need per-filter pill
//     buttons — every filter is visible inside the panel at once.
//   - This component was never deleted after the refactor.
//
// AUDIT (April 25, 2026 — smoover design migration sweep):
//   - Whole-repo grep for `FilterPill` returns only the declaration here
//     (and a Claude worktree backup copy, which is throwaway).
//   - `<FilterPill` JSX usage: zero matches anywhere.
//   - `git log --all -S "<FilterPill"`: appears only in two old commits
//     (initial filter-panel commit + one early enhancement). Then
//     removed. Has not appeared on main since.
//
// WHY NOT MIGRATED TO SMOOVER:
//   The app-wide neo-brutalist → smoover refresh (April 2026) deliberately
//   skipped this component because migrating dead code is wasted effort
//   with zero user-visible benefit. The brutalist `border-2 border-black`
//   button + `shadow-[2px_2px_0px_0px_#000000]` press effect + `font-black
//   uppercase tracking-wide` typography below are intentionally left as-is.
//
// WHAT TO DO IF YOU LAND HERE:
//   - Preferred: delete this component block (~120 lines: from
//     `interface FilterPillProps` through the closing `};` of FilterPill).
//     Re-run the audit greps above first to confirm nothing has started
//     using it since April 25, 2026.
//   - Or: if you actually want to USE <FilterPill /> somewhere, you MUST
//     migrate the brutalist classNames to smoover first (see the live
//     `FilterPanel` component lower in this file for the smoover patterns
//     — rounded-full pills, hairline #e6ebf1 borders, shadow-yellow-glow-sm,
//     font-semibold mixed-case). Do NOT ship the brutalist version into
//     a smoover surface — it will look badly out of place.
// ============================================================================
interface FilterPillProps {
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  activeCount?: number;
  isDropdownOpen: boolean;
  onToggleDropdown: () => void;
  onCloseDropdown: () => void;
  children: React.ReactNode;
}

const DROPDOWN_WIDTH = 180; // Fixed dropdown width

const FilterPill: React.FC<FilterPillProps> = ({
  label,
  icon,
  isActive,
  activeCount,
  isDropdownOpen,
  onToggleDropdown,
  onCloseDropdown,
  children,
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, right: 'auto' as number | 'auto' });
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Calculate dropdown position - ensure it doesn't go off screen
  useEffect(() => {
    if (isDropdownOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      
      // Check if dropdown would overflow right edge
      const wouldOverflowRight = rect.left + DROPDOWN_WIDTH > viewportWidth - 16; // 16px margin
      
      if (wouldOverflowRight) {
        // Align to right edge of button
        setDropdownPosition({
          top: rect.bottom + 4,
          left: 'auto' as unknown as number,
          right: viewportWidth - rect.right,
        });
      } else {
        // Align to left edge of button
        setDropdownPosition({
          top: rect.bottom + 4,
          left: rect.left,
          right: 'auto',
        });
      }
    }
  }, [isDropdownOpen]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isDropdownOpen &&
        dropdownRef.current &&
        buttonRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        onCloseDropdown();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen, onCloseDropdown]);

  return (
    <>
      {/* Neo-brutalist Filter Pill Button - Matches DashboardDemo aesthetic */}
      <button
        ref={buttonRef}
        onClick={onToggleDropdown}
        className={cn(
          "flex items-center gap-2 px-3 py-2 text-xs font-black uppercase tracking-wide transition-all whitespace-nowrap border-2",
          isActive || isDropdownOpen
            ? "bg-[#ffbf23] text-black border-black shadow-[2px_2px_0px_0px_#000000]"
            : "bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-gray-300 border-black dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900"
        )}
      >
        {icon}
        <span>{label}</span>
        {activeCount !== undefined && activeCount > 0 && (
          <span className="px-1.5 py-0.5 bg-black text-white dark:bg-white dark:text-black text-[9px] font-black">
            {activeCount}
          </span>
        )}
        <ChevronDown size={12} className={cn(isDropdownOpen && "rotate-180 transition-transform")} />
      </button>

      {/* Dropdown rendered via Portal - Neo-brutalist style */}
      {isDropdownOpen && isMounted && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: dropdownPosition.top,
            left: dropdownPosition.right === 'auto' ? dropdownPosition.left : 'auto',
            right: dropdownPosition.right !== 'auto' ? dropdownPosition.right : 'auto',
            width: DROPDOWN_WIDTH,
          }}
          className="bg-white dark:bg-[#0a0a0a] shadow-[4px_4px_0px_0px_#000000] dark:shadow-[4px_4px_0px_0px_#ffbf23] border-2 border-black dark:border-[#ffbf23] z-[9999]"
        >
          <div className="p-3">
            {children}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

// ============================================================================
// MULTI-SELECT COMPONENT (for Competitors, Topics)
// Updated January 10th, 2026 - i18n migration
// ============================================================================
interface MultiSelectProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  emptyMessage?: string;
  t: Dictionary['filterPanel']; // i18n translations
}

const MultiSelect: React.FC<MultiSelectProps> = ({
  options,
  selected,
  onChange,
  emptyMessage,
  t,
}) => {
  const [showAll, setShowAll] = useState(false);
  const maxVisible = 8;
  const visibleOptions = showAll ? options : options.slice(0, maxVisible);

  if (options.length === 0) {
    // Empty-state line — smoover (Apr 24, 2026): was font-mono uppercase; now
    // plain italic muted to match other "no results" / placeholder copy.
    return <p className="text-[11px] italic text-[#8898aa] dark:text-gray-500">{emptyMessage || t.noOptionsAvailable}</p>;
  }

  return (
    <div className="space-y-2">
      {/* ===================================================================
          PRESET PILLS — smoover refresh (Apr 24, 2026)
          -----------------------------------------------------------------
          Shared pill pattern used by MultiSelect, RangePresets, DatePresets.
          Before: border-2 square pills, font-black uppercase, offset black
                  shadow for the selected state.
          After:  rounded-full hairline pills, font-semibold mixed-case.
                  Selected → yellow fill + shadow-yellow-glow-sm (matches
                  the count badges and landing hero CTA). Hover on idle
                  pills: subtle #f6f9fc wash + border deepens to #cdd5df.
          Sizing kept identical (px-2 py-1 text-[10px]) so the 8-chip
          cap + "Show more" logic still fits in the same two rows.
          =================================================================== */}
      <div className="flex flex-wrap gap-1.5">
        {visibleOptions.map(option => (
          <button
            key={option}
            onClick={() => {
              if (selected.includes(option)) {
                onChange(selected.filter(s => s !== option));
              } else {
                onChange([...selected, option]);
              }
            }}
            className={cn(
              "px-2.5 py-1 text-[10px] font-semibold rounded-full transition-all border",
              selected.includes(option)
                ? "bg-[#ffbf23] text-[#0f172a] border-transparent shadow-yellow-glow-sm"
                : "bg-white dark:bg-gray-900 text-[#425466] dark:text-gray-400 border-[#e6ebf1] dark:border-gray-800 hover:bg-[#f6f9fc] dark:hover:bg-gray-800 hover:border-[#cdd5df] dark:hover:border-gray-700"
            )}
          >
            {option}
          </button>
        ))}
      </div>
      {/* Inline "+N more" / "Show less" — muted link treatment */}
      {options.length > maxVisible && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-[10px] font-semibold text-[#8898aa] hover:text-[#0f172a] dark:hover:text-white hover:underline underline-offset-2 transition-colors"
        >
          {showAll ? t.showLess : `+ ${options.length - maxVisible} ${t.more}`}
        </button>
      )}
      {selected.length > 0 && (
        <button
          onClick={() => onChange([])}
          className="text-[10px] font-semibold text-[#8898aa] hover:text-[#0f172a] dark:hover:text-white transition-colors ml-2"
        >
          {t.clearAll}
        </button>
      )}
    </div>
  );
};

// ============================================================================
// RANGE PRESETS (for Subscribers, Content Count)
// Updated January 10th, 2026 - i18n migration
// ============================================================================
interface RangePresetsProps {
  value: { min?: number; max?: number } | null;
  onChange: (range: { min?: number; max?: number } | null) => void;
  presets: { label: string; min: number; max?: number }[];
  clearLabel: string; // i18n
}

const RangePresets: React.FC<RangePresetsProps> = ({
  value,
  onChange,
  presets,
  clearLabel,
}) => {
  return (
    <div className="space-y-2">
      {/* Preset pills — same smoover treatment as MultiSelect (Apr 24, 2026) */}
      <div className="flex flex-wrap gap-1.5">
        {presets.map(preset => (
          <button
            key={preset.label}
            onClick={() => {
              if (value?.min === preset.min && value?.max === preset.max) {
                onChange(null);
              } else {
                onChange({ min: preset.min, max: preset.max });
              }
            }}
            className={cn(
              "px-2.5 py-1 text-[10px] font-semibold rounded-full transition-all border",
              value?.min === preset.min && value?.max === preset.max
                ? "bg-[#ffbf23] text-[#0f172a] border-transparent shadow-yellow-glow-sm"
                : "bg-white dark:bg-gray-900 text-[#425466] dark:text-gray-400 border-[#e6ebf1] dark:border-gray-800 hover:bg-[#f6f9fc] dark:hover:bg-gray-800 hover:border-[#cdd5df] dark:hover:border-gray-700"
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>
      {value !== null && (
        <button
          onClick={() => onChange(null)}
          className="text-[10px] font-semibold text-[#8898aa] hover:text-[#0f172a] dark:hover:text-white transition-colors"
        >
          {clearLabel}
        </button>
      )}
    </div>
  );
};

// ============================================================================
// DATE PRESETS (for Date Published, Last Posted)
// Updated January 10th, 2026 - i18n migration
// ============================================================================
interface DatePresetsProps {
  value: { start?: string; end?: string } | null;
  onChange: (range: { start?: string; end?: string } | null) => void;
  t: Dictionary['filterPanel']; // i18n translations
}

const DatePresets: React.FC<DatePresetsProps> = ({
  value,
  onChange,
  t,
}) => {
  // i18n: Use translated labels for date presets
  const presets = [
    { label: t.days7, days: 7 },
    { label: t.days30, days: 30 },
    { label: t.days90, days: 90 },
    { label: t.year1, days: 365 },
  ];

  const handlePreset = (days: number) => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const newStart = startDate.toISOString().split('T')[0];
    const newEnd = endDate.toISOString().split('T')[0];
    
    // Toggle off if same preset is clicked
    if (value?.start === newStart && value?.end === newEnd) {
      onChange(null);
    } else {
      onChange({ start: newStart, end: newEnd });
    }
  };

  const isPresetActive = (days: number) => {
    if (!value?.start || !value?.end) return false;
    const startDate = new Date(value.start);
    const endDate = new Date(value.end);
    const diffDays = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    return Math.abs(diffDays - days) <= 1; // Allow 1 day tolerance
  };

  return (
    <div className="space-y-2">
      {/* Preset pills — same smoover treatment as MultiSelect (Apr 24, 2026) */}
      <div className="flex flex-wrap gap-1.5">
        {presets.map(preset => (
          <button
            key={preset.label}
            onClick={() => handlePreset(preset.days)}
            className={cn(
              "px-2.5 py-1 text-[10px] font-semibold rounded-full transition-all border",
              isPresetActive(preset.days)
                ? "bg-[#ffbf23] text-[#0f172a] border-transparent shadow-yellow-glow-sm"
                : "bg-white dark:bg-gray-900 text-[#425466] dark:text-gray-400 border-[#e6ebf1] dark:border-gray-800 hover:bg-[#f6f9fc] dark:hover:bg-gray-800 hover:border-[#cdd5df] dark:hover:border-gray-700"
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>
      {value !== null && (
        <button
          onClick={() => onChange(null)}
          className="text-[10px] font-semibold text-[#8898aa] hover:text-[#0f172a] dark:hover:text-white transition-colors"
        >
          {t.clear}
        </button>
      )}
    </div>
  );
};

// ============================================================================
// MAIN FILTER PANEL COMPONENT
// Horizontal layout with expandable filter pills
// Updated January 10th, 2026 - i18n migration
// ============================================================================
export const FilterPanel: React.FC<FilterPanelProps> = ({
  affiliates,
  activeFilters,
  onFilterChange,
  isOpen,
  onClose,
  onOpen,
  userCompetitors,
  userTopics,
}) => {
  // i18n translation hook (January 10th, 2026)
  const { t } = useLanguage();
  
  // Track which dropdown is currently open
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  
  // Extract filter options from data + onboarding (January 13th, 2026)
  const filterOptions = useMemo(
    () => extractFilterOptions(affiliates, userCompetitors, userTopics),
    [affiliates, userCompetitors, userTopics]
  );
  
  // Count active filters
  const activeFilterCount = countActiveFilters(activeFilters);

  // Subscriber presets
  const subscriberPresets = [
    { label: '1K+', min: 1000 },
    { label: '10K+', min: 10000 },
    { label: '100K+', min: 100000 },
    { label: '1M+', min: 1000000 },
  ];

  // Content count presets
  const contentPresets = [
    { label: '10+', min: 10 },
    { label: '50+', min: 50 },
    { label: '100+', min: 100 },
    { label: '500+', min: 500 },
  ];

  // Clear all filters
  const handleClearAll = () => {
    onFilterChange(DEFAULT_FILTER_STATE);
    setOpenDropdown(null);
  };

  // Toggle dropdown
  const toggleDropdown = (id: string) => {
    setOpenDropdown(prev => prev === id ? null : id);
  };

  // Close any open dropdown
  const closeDropdown = () => {
    setOpenDropdown(null);
  };

  // ==========================================================================
  // OVERLAY APPROACH - January 23, 2026
  // 
  // Filter panel renders as a slide-out overlay from the right side.
  // Uses a semi-transparent backdrop. Clean and professional.
  // ==========================================================================
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Prevent body scroll when overlay is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleClose = () => {
    onClose();
    setOpenDropdown(null);
  };

  return (
    <>
      {/* =========================================================================
          MAIN FILTER TOGGLE BUTTON
          Smoover refresh (April 23rd, 2026) — Phase 2e
          ---------------------------------------------------------------------------
          Shared across /find, /discovered, /saved, /outreach — single change flips
          the filter icon everywhere. Previously neo-brutalist (40x40 square,
          hard-black border, offset black shadow). Now a pill/circle:
            - `rounded-full` (circle to match the new smoover voice)
            - hairline border `border-[#e6ebf1]` on idle state
            - `shadow-soft-sm` at rest, subtle `hover:-translate-y-0.5` lift
            - Active state (panel open OR any filter applied) retains brand yellow
              but swaps the offset black drop for `shadow-yellow-glow-sm` so it
              matches the landing-page hero CTA.
          Dark-mode tweaks match the sidebar refresh.
          Icon stroke dropped from 2.5 → 2 for the lighter smoover weight.
          ========================================================================= */}
      <button
        onClick={() => {
          if (isOpen) {
            handleClose();
          } else {
            onOpen();
          }
        }}
        className={cn(
          "flex items-center justify-center w-10 h-10 rounded-full transition-all",
          isOpen || activeFilterCount > 0
            ? "bg-[#ffbf23] text-[#0f172a] shadow-yellow-glow-sm hover:-translate-y-0.5"
            : "bg-white dark:bg-[#0a0a0a] text-[#425466] dark:text-gray-400 border border-[#e6ebf1] dark:border-gray-800 shadow-soft-sm hover:bg-[#f6f9fc] dark:hover:bg-gray-900 hover:-translate-y-0.5"
        )}
        aria-label="Toggle filters"
      >
        <SlidersHorizontal size={16} strokeWidth={2} />
      </button>

      {/* =========================================================================
          FILTER SLIDE-OUT PANEL (overlay)
          Smoover refresh (April 24th, 2026) — Phase 2f
          ---------------------------------------------------------------------------
          The panel body previously kept the neo-brutalist voice even after the
          trigger button was updated (Phase 2e, Apr 23, 2026). This round flips
          everything inside the slide-out to match the smoover design system used
          across the landing page, sidebar, auth pages, and dashboard chrome:
            - Hairline borders (#e6ebf1) instead of border-l-4 / border-b-2 black
            - `shadow-soft-xl` on the slide-out edge instead of the hard
              `shadow-[-4px_0_20px_rgba(0,0,0,0.3)]` drop
            - Header title: Archivo display font, `font-semibold`, normal case
            - Close (X): rounded-full 32x32 soft outline (matches the Find-affiliate
              modal close button pattern used elsewhere)
            - Footer bar: hairline border-t, rounded-full Apply CTA matching the
              landing hero button (shadow-yellow-glow-sm + hover lift)
            - Clear-all link: font-semibold, muted colour, no uppercase
          Logic / i18n keys / portal wiring / handlers all untouched.
          ========================================================================= */}
      {isOpen && isMounted && createPortal(
        <>
          {/* Backdrop — softer overlay tint to pair with the lighter panel */}
          <div 
            className="fixed top-16 left-64 right-0 bottom-0 bg-[#0f172a]/40 z-[9997] animate-in fade-in duration-200"
            onClick={handleClose}
          />
          
          {/* Slide-out Panel — hairline left border + shadow-soft-xl */}
          <div 
            className="fixed top-16 right-0 h-[calc(100vh-64px)] w-80 bg-white dark:bg-[#0a0a0a] border-l border-[#e6ebf1] dark:border-gray-800 shadow-soft-xl z-[9998] animate-in slide-in-from-right duration-300"
          >
            {/* Panel Header — hairline divider + Archivo title */}
            <div className="flex items-center justify-between p-4 border-b border-[#e6ebf1] dark:border-gray-800">
              <h3 className="font-display font-semibold text-sm tracking-tight flex items-center gap-2 text-[#0f172a] dark:text-white">
                <SlidersHorizontal size={16} strokeWidth={2} className="text-[#425466] dark:text-gray-400" />
                {t.filterPanel.title || 'Filters'}
              </h3>
              {/* Close — rounded-full soft outline, same pattern as other close buttons */}
              <button
                onClick={handleClose}
                className="w-8 h-8 flex items-center justify-center rounded-full border border-[#e6ebf1] dark:border-gray-800 text-[#8898aa] hover:text-[#0f172a] dark:hover:text-white hover:bg-[#f6f9fc] dark:hover:bg-gray-900 transition-all"
                aria-label="Close filters"
              >
                <X size={16} strokeWidth={2} />
              </button>
            </div>

            {/* Filter Options */}
            <div className="p-4 space-y-4 overflow-y-auto h-[calc(100%-120px)]">
              {/* =================================================================
                  FILTER SECTION LABELS — smoover refresh (Apr 24, 2026)
                  ---------------------------------------------------------------
                  All 5 section labels share the same pattern:
                    Before: text-xs font-black uppercase tracking-wide gray-500
                            + square yellow count badge (px-1.5 py-0.5).
                    After:  text-xs font-semibold (mixed case) #425466
                            + rounded-full pill badge with shadow-yellow-glow-sm
                            matching every other yellow accent in the app.
                  Icon stroke 2.5 → 2 for lighter smoover weight.
                  ================================================================= */}
              {/* Competitors Filter */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-[#425466] dark:text-gray-400">
                  <Users size={12} strokeWidth={2} />
                  {t.filterPanel.competitors}
                  {activeFilters.competitors.length > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 bg-[#ffbf23] text-[#0f172a] text-[10px] font-semibold rounded-full shadow-yellow-glow-sm">
                      {activeFilters.competitors.length}
                    </span>
                  )}
                </label>
                <MultiSelect
                  options={filterOptions.competitors}
                  selected={activeFilters.competitors}
                  onChange={competitors => onFilterChange({ ...activeFilters, competitors })}
                  emptyMessage={t.filterPanel.noCompetitorsFound}
                  t={t.filterPanel}
                />
              </div>

              {/* Topics Filter */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-[#425466] dark:text-gray-400">
                  <Tag size={12} strokeWidth={2} />
                  {t.filterPanel.topics}
                  {activeFilters.topics.length > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 bg-[#ffbf23] text-[#0f172a] text-[10px] font-semibold rounded-full shadow-yellow-glow-sm">
                      {activeFilters.topics.length}
                    </span>
                  )}
                </label>
                <MultiSelect
                  options={filterOptions.topics}
                  selected={activeFilters.topics}
                  onChange={topics => onFilterChange({ ...activeFilters, topics })}
                  emptyMessage={t.filterPanel.noTopicsFound}
                  t={t.filterPanel}
                />
              </div>

              {/* Subscribers Filter */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-[#425466] dark:text-gray-400">
                  <Users size={12} strokeWidth={2} />
                  {t.filterPanel.followers}
                  {activeFilters.subscribers && (
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 bg-[#ffbf23] text-[#0f172a] text-[10px] font-semibold rounded-full shadow-yellow-glow-sm">1</span>
                  )}
                </label>
                <RangePresets
                  value={activeFilters.subscribers}
                  onChange={subscribers => onFilterChange({ ...activeFilters, subscribers })}
                  presets={subscriberPresets}
                  clearLabel={t.filterPanel.clear}
                />
              </div>

              {/* Date Published Filter */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-[#425466] dark:text-gray-400">
                  <Calendar size={12} strokeWidth={2} />
                  {t.filterPanel.date}
                  {activeFilters.datePublished && (
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 bg-[#ffbf23] text-[#0f172a] text-[10px] font-semibold rounded-full shadow-yellow-glow-sm">1</span>
                  )}
                </label>
                <DatePresets
                  value={activeFilters.datePublished}
                  onChange={datePublished => onFilterChange({ ...activeFilters, datePublished })}
                  t={t.filterPanel}
                />
              </div>

              {/* Content Count Filter */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-[#425466] dark:text-gray-400">
                  <Hash size={12} strokeWidth={2} />
                  {t.filterPanel.posts}
                  {activeFilters.contentCount && (
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 bg-[#ffbf23] text-[#0f172a] text-[10px] font-semibold rounded-full shadow-yellow-glow-sm">1</span>
                  )}
                </label>
                <RangePresets
                  value={activeFilters.contentCount}
                  onChange={contentCount => onFilterChange({ ...activeFilters, contentCount })}
                  presets={contentPresets}
                  clearLabel={t.filterPanel.clear}
                />
              </div>
            </div>

            {/* =====================================================================
                PANEL FOOTER — smoover refresh (Apr 24, 2026)
                Hairline border-t, muted Clear-all link, rounded-full yellow Apply
                CTA matching the landing-page hero button voice.
                ===================================================================== */}
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-[#e6ebf1] dark:border-gray-800 bg-white dark:bg-[#0a0a0a]">
              <div className="flex items-center justify-between">
                {activeFilterCount > 0 ? (
                  <button
                    onClick={handleClearAll}
                    className="text-xs font-semibold text-[#8898aa] hover:text-[#0f172a] dark:hover:text-white transition-colors"
                  >
                    {t.filterPanel.clearAll} ({activeFilterCount})
                  </button>
                ) : (
                  <span className="text-xs text-[#8898aa]">{t.filterPanel.noFiltersActive || 'No filters active'}</span>
                )}
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-xs font-semibold bg-[#ffbf23] text-[#0f172a] rounded-full shadow-yellow-glow-sm hover:bg-[#e5ac20] hover:-translate-y-0.5 transition-all"
                >
                  {t.filterPanel.apply || 'Apply'}
                </button>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
};

export default FilterPanel;
