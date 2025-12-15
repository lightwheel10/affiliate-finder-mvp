'use client';

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

interface FilterPanelProps {
  affiliates: ResultItem[];
  activeFilters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
}

// Helper to extract unique values from affiliates
function extractFilterOptions(affiliates: ResultItem[]): {
  competitors: string[];
  topics: string[];
} {
  const competitors = new Set<string>();
  const topics = new Set<string>();

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
      <button
        ref={buttonRef}
        onClick={onToggleDropdown}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all whitespace-nowrap",
          isActive || isDropdownOpen
            ? "bg-[#D4E815]/20 text-[#1A1D21] border-[#D4E815]"
            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
        )}
      >
        {icon}
        <span>{label}</span>
        {activeCount !== undefined && activeCount > 0 && (
          <span className="px-1.5 py-0.5 rounded bg-[#D4E815] text-[#1A1D21] text-[9px] font-semibold">
            {activeCount}
          </span>
        )}
        <ChevronDown size={12} />
      </button>

      {/* Dropdown rendered via Portal */}
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
          className="bg-white rounded-lg shadow-lg border border-slate-200 z-[9999]"
        >
          <div className="p-2">
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
// ============================================================================
interface MultiSelectProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  emptyMessage?: string;
}

const MultiSelect: React.FC<MultiSelectProps> = ({
  options,
  selected,
  onChange,
  emptyMessage = "No options available",
}) => {
  const [showAll, setShowAll] = useState(false);
  const maxVisible = 8;
  const visibleOptions = showAll ? options : options.slice(0, maxVisible);

  if (options.length === 0) {
    return <p className="text-xs text-slate-400 italic">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-2">
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
              "px-2 py-1 rounded text-xs font-medium transition-all",
              selected.includes(option)
                ? "bg-[#D4E815] text-[#1A1D21]"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            {option}
          </button>
        ))}
      </div>
      {options.length > maxVisible && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          {showAll ? 'Show less' : `+${options.length - maxVisible} more`}
        </button>
      )}
      {selected.length > 0 && (
        <button
          onClick={() => onChange([])}
          className="text-xs text-slate-500 hover:text-slate-700"
        >
          Clear
        </button>
      )}
    </div>
  );
};

// ============================================================================
// RANGE PRESETS (for Subscribers, Content Count)
// ============================================================================
interface RangePresetsProps {
  value: { min?: number; max?: number } | null;
  onChange: (range: { min?: number; max?: number } | null) => void;
  presets: { label: string; min: number; max?: number }[];
}

const RangePresets: React.FC<RangePresetsProps> = ({
  value,
  onChange,
  presets,
}) => {
  return (
    <div className="space-y-2">
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
              "px-2 py-1 rounded text-xs font-medium transition-all",
              value?.min === preset.min && value?.max === preset.max
                ? "bg-[#D4E815] text-[#1A1D21]"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>
      {value !== null && (
        <button
          onClick={() => onChange(null)}
          className="text-xs text-slate-500 hover:text-slate-700"
        >
          Clear
        </button>
      )}
    </div>
  );
};

// ============================================================================
// DATE PRESETS (for Date Published, Last Posted)
// ============================================================================
interface DatePresetsProps {
  value: { start?: string; end?: string } | null;
  onChange: (range: { start?: string; end?: string } | null) => void;
}

const DatePresets: React.FC<DatePresetsProps> = ({
  value,
  onChange,
}) => {
  const presets = [
    { label: '7 days', days: 7 },
    { label: '30 days', days: 30 },
    { label: '90 days', days: 90 },
    { label: '1 year', days: 365 },
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
      <div className="flex flex-wrap gap-1.5">
        {presets.map(preset => (
          <button
            key={preset.label}
            onClick={() => handlePreset(preset.days)}
            className={cn(
              "px-2 py-1 rounded text-xs font-medium transition-all",
              isPresetActive(preset.days)
                ? "bg-[#D4E815] text-[#1A1D21]"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>
      {value !== null && (
        <button
          onClick={() => onChange(null)}
          className="text-xs text-slate-500 hover:text-slate-700"
        >
          Clear
        </button>
      )}
    </div>
  );
};

// ============================================================================
// MAIN FILTER PANEL COMPONENT
// Horizontal layout with expandable filter pills
// ============================================================================
export const FilterPanel: React.FC<FilterPanelProps> = ({
  affiliates,
  activeFilters,
  onFilterChange,
  isOpen,
  onClose,
  onOpen,
}) => {
  // Track which dropdown is currently open
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  
  // Extract filter options from data
  const filterOptions = useMemo(() => extractFilterOptions(affiliates), [affiliates]);
  
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
      {isOpen && (
        <div className="flex items-center gap-2">
          {/* Competitors Filter */}
          <FilterPill
            label="Competitors"
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
              emptyMessage="No competitors found"
            />
          </FilterPill>

          {/* Topics Filter */}
          <FilterPill
            label="Topics"
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
              emptyMessage="No topics found"
            />
          </FilterPill>

          {/* Subscribers Filter */}
          <FilterPill
            label="Followers"
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
            />
          </FilterPill>

          {/* Date Published Filter */}
          <FilterPill
            label="Date"
            icon={<Calendar size={12} />}
            isActive={activeFilters.datePublished !== null}
            isDropdownOpen={openDropdown === 'datePublished'}
            onToggleDropdown={() => toggleDropdown('datePublished')}
            onCloseDropdown={closeDropdown}
          >
            <DatePresets
              value={activeFilters.datePublished}
              onChange={datePublished => onFilterChange({ ...activeFilters, datePublished })}
            />
          </FilterPill>

          {/* Content Count Filter */}
          <FilterPill
            label="Posts"
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
            />
          </FilterPill>

          {/* Clear All Button - Only show if filters are active */}
          {activeFilterCount > 0 && (
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1 px-2 py-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
            >
              <X size={12} />
              <span>Clear</span>
            </button>
          )}

          {/* Divider */}
          <div className="h-6 w-px bg-slate-200" />
        </div>
      )}

      {/* Main Filter Toggle Button */}
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
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all whitespace-nowrap",
          isOpen || activeFilterCount > 0
            ? "bg-[#D4E815] text-[#1A1D21] border-[#D4E815] shadow-sm shadow-[#D4E815]/20"
            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
        )}
      >
        <SlidersHorizontal size={14} />
        {activeFilterCount > 0 && (
          <span className="px-1.5 py-0.5 rounded bg-[#1A1D21]/20 text-[#1A1D21] text-[9px]">
            {activeFilterCount}
          </span>
        )}
      </button>
    </div>
  );
};

export default FilterPanel;
