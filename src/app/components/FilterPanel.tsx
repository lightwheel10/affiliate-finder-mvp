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
    if (item.keyword) {
      topics.add(item.keyword);
    }
  });

  return {
    competitors: Array.from(competitors).sort(),
    topics: Array.from(topics).sort(),
  };
}

// ============================================================================
// FILTER PILL WITH DROPDOWN
// Individual filter category that shows a dropdown when clicked
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
    return <p className="text-[10px] text-gray-400 dark:text-gray-500 font-mono uppercase">{emptyMessage || t.noOptionsAvailable}</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
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
              "px-2 py-1 text-[10px] font-black uppercase tracking-wide transition-all border-2",
              selected.includes(option)
                ? "bg-[#ffbf23] text-black border-black shadow-[1px_1px_0px_0px_#000000]"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700 hover:border-black dark:hover:border-gray-500"
            )}
          >
            {option}
          </button>
        ))}
      </div>
      {options.length > maxVisible && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-[10px] text-black dark:text-[#ffbf23] hover:underline font-black uppercase"
        >
          {showAll ? t.showLess : `+ ${options.length - maxVisible} ${t.more}`}
        </button>
      )}
      {selected.length > 0 && (
        <button
          onClick={() => onChange([])}
          className="text-[10px] text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white font-bold uppercase"
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
      <div className="flex flex-wrap gap-1">
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
              "px-2 py-1 text-[10px] font-black uppercase tracking-wide transition-all border-2",
              value?.min === preset.min && value?.max === preset.max
                ? "bg-[#ffbf23] text-black border-black shadow-[1px_1px_0px_0px_#000000]"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700 hover:border-black dark:hover:border-gray-500"
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>
      {value !== null && (
        <button
          onClick={() => onChange(null)}
          className="text-[10px] text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white font-bold uppercase"
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
      <div className="flex flex-wrap gap-1">
        {presets.map(preset => (
          <button
            key={preset.label}
            onClick={() => handlePreset(preset.days)}
            className={cn(
              "px-2 py-1 text-[10px] font-black uppercase tracking-wide transition-all border-2",
              isPresetActive(preset.days)
                ? "bg-[#ffbf23] text-black border-black shadow-[1px_1px_0px_0px_#000000]"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700 hover:border-black dark:hover:border-gray-500"
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>
      {value !== null && (
        <button
          onClick={() => onChange(null)}
          className="text-[10px] text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white font-bold uppercase"
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

  return (
    <div className="flex items-center gap-2">
      {/* Expanded Filter Pills - Only show when isOpen */}
      {/* Updated January 10th, 2026 - i18n migration */}
      {isOpen && (
        <div className="flex items-center gap-2">
          {/* Competitors Filter */}
          <FilterPill
            label={t.filterPanel.competitors}
            icon={<Users size={12} />}
            isActive={activeFilters.competitors.length > 0}
            activeCount={activeFilters.competitors.length}
            isDropdownOpen={openDropdown === 'competitors'}
            onToggleDropdown={() => toggleDropdown('competitors')}
            onCloseDropdown={closeDropdown}
          >
            <MultiSelect
              options={filterOptions.competitors}
              selected={activeFilters.competitors}
              onChange={competitors => onFilterChange({ ...activeFilters, competitors })}
              emptyMessage={t.filterPanel.noCompetitorsFound}
              t={t.filterPanel}
            />
          </FilterPill>

          {/* Topics Filter */}
          <FilterPill
            label={t.filterPanel.topics}
            icon={<Tag size={12} />}
            isActive={activeFilters.topics.length > 0}
            activeCount={activeFilters.topics.length}
            isDropdownOpen={openDropdown === 'topics'}
            onToggleDropdown={() => toggleDropdown('topics')}
            onCloseDropdown={closeDropdown}
          >
            <MultiSelect
              options={filterOptions.topics}
              selected={activeFilters.topics}
              onChange={topics => onFilterChange({ ...activeFilters, topics })}
              emptyMessage={t.filterPanel.noTopicsFound}
              t={t.filterPanel}
            />
          </FilterPill>

          {/* Subscribers Filter */}
          <FilterPill
            label={t.filterPanel.followers}
            icon={<Users size={12} />}
            isActive={activeFilters.subscribers !== null}
            isDropdownOpen={openDropdown === 'subscribers'}
            onToggleDropdown={() => toggleDropdown('subscribers')}
            onCloseDropdown={closeDropdown}
          >
            <RangePresets
              value={activeFilters.subscribers}
              onChange={subscribers => onFilterChange({ ...activeFilters, subscribers })}
              presets={subscriberPresets}
              clearLabel={t.filterPanel.clear}
            />
          </FilterPill>

          {/* Date Published Filter */}
          <FilterPill
            label={t.filterPanel.date}
            icon={<Calendar size={12} />}
            isActive={activeFilters.datePublished !== null}
            isDropdownOpen={openDropdown === 'datePublished'}
            onToggleDropdown={() => toggleDropdown('datePublished')}
            onCloseDropdown={closeDropdown}
          >
            <DatePresets
              value={activeFilters.datePublished}
              onChange={datePublished => onFilterChange({ ...activeFilters, datePublished })}
              t={t.filterPanel}
            />
          </FilterPill>

          {/* Content Count Filter */}
          <FilterPill
            label={t.filterPanel.posts}
            icon={<Hash size={12} />}
            isActive={activeFilters.contentCount !== null}
            isDropdownOpen={openDropdown === 'contentCount'}
            onToggleDropdown={() => toggleDropdown('contentCount')}
            onCloseDropdown={closeDropdown}
          >
            <RangePresets
              value={activeFilters.contentCount}
              onChange={contentCount => onFilterChange({ ...activeFilters, contentCount })}
              presets={contentPresets}
              clearLabel={t.filterPanel.clear}
            />
          </FilterPill>

          {/* Clear All Button - Only show if filters are active */}
          {activeFilterCount > 0 && (
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1 px-2 py-2 text-[10px] text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors font-black uppercase tracking-wide"
            >
              <X size={10} strokeWidth={3} />
              <span>{t.filterPanel.clearAll}</span>
            </button>
          )}

          {/* Divider - Industrial style */}
          <div className="h-8 w-0.5 bg-black dark:bg-gray-600" />
        </div>
      )}

      {/* Main Filter Toggle Button - Neo-brutalist style */}
      <button
        onClick={() => {
          if (isOpen) {
            onClose();
            setOpenDropdown(null);
          } else {
            onOpen();
          }
        }}
        className={cn(
          "flex items-center justify-center w-10 h-10 border-2 transition-all",
          isOpen || activeFilterCount > 0
            ? "bg-[#ffbf23] text-black border-black shadow-[2px_2px_0px_0px_#000000]"
            : "bg-white dark:bg-[#0a0a0a] text-gray-600 dark:text-gray-400 border-black dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900"
        )}
      >
        <SlidersHorizontal size={16} strokeWidth={2.5} />
      </button>
    </div>
  );
};

export default FilterPanel;
