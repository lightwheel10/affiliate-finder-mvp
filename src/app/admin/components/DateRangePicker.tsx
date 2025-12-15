'use client';

import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DateRange {
  startDate: string;
  endDate: string;
  label?: string;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  showCompare?: boolean;
  compareValue?: DateRange | null;
  onCompareChange?: (range: DateRange | null) => void;
}

const PRESETS: { label: string; getValue: () => DateRange }[] = [
  {
    label: 'Today',
    getValue: () => {
      const today = new Date().toISOString().split('T')[0];
      return { startDate: today, endDate: today, label: 'Today' };
    },
  },
  {
    label: 'Yesterday',
    getValue: () => {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      return { startDate: yesterday, endDate: yesterday, label: 'Yesterday' };
    },
  },
  {
    label: 'Last 7 days',
    getValue: () => {
      const end = new Date().toISOString().split('T')[0];
      const start = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
      return { startDate: start, endDate: end, label: 'Last 7 days' };
    },
  },
  {
    label: 'Last 30 days',
    getValue: () => {
      const end = new Date().toISOString().split('T')[0];
      const start = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
      return { startDate: start, endDate: end, label: 'Last 30 days' };
    },
  },
  {
    label: 'This month',
    getValue: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const end = now.toISOString().split('T')[0];
      return { startDate: start, endDate: end, label: 'This month' };
    },
  },
  {
    label: 'Last month',
    getValue: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      const end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      return { startDate: start, endDate: end, label: 'Last month' };
    },
  },
  {
    label: 'Last 90 days',
    getValue: () => {
      const end = new Date().toISOString().split('T')[0];
      const start = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];
      return { startDate: start, endDate: end, label: 'Last 90 days' };
    },
  },
];

export function DateRangePicker({ 
  value, 
  onChange, 
  showCompare = false,
  compareValue,
  onCompareChange 
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customStart, setCustomStart] = useState(value.startDate);
  const [customEnd, setCustomEnd] = useState(value.endDate);
  const [isComparing, setIsComparing] = useState(!!compareValue);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePresetClick = (preset: typeof PRESETS[0]) => {
    const range = preset.getValue();
    onChange(range);
    setCustomStart(range.startDate);
    setCustomEnd(range.endDate);
    setIsOpen(false);
  };

  const handleCustomApply = () => {
    if (customStart && customEnd && customStart <= customEnd) {
      onChange({ startDate: customStart, endDate: customEnd, label: 'Custom' });
      setIsOpen(false);
    }
  };

  const handleCompareToggle = () => {
    const newIsComparing = !isComparing;
    setIsComparing(newIsComparing);
    
    if (newIsComparing && onCompareChange) {
      // Calculate previous period of same length
      const startMs = new Date(value.startDate).getTime();
      const endMs = new Date(value.endDate).getTime();
      const durationMs = endMs - startMs;
      
      const prevEnd = new Date(startMs - 86400000).toISOString().split('T')[0];
      const prevStart = new Date(startMs - 86400000 - durationMs).toISOString().split('T')[0];
      
      onCompareChange({ startDate: prevStart, endDate: prevEnd, label: 'Previous period' });
    } else if (onCompareChange) {
      onCompareChange(null);
    }
  };

  const formatDisplay = () => {
    if (value.label && value.label !== 'Custom') {
      return value.label;
    }
    const start = new Date(value.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const end = new Date(value.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${start} - ${end}`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-[#23272B] border border-[#2E3338] rounded-lg text-sm text-white hover:bg-[#2E3338] transition-colors"
      >
        <Calendar className="w-4 h-4 text-slate-400" />
        <span>{formatDisplay()}</span>
        <ChevronDown className={cn('w-4 h-4 text-slate-400 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-[#23272B] border border-[#2E3338] rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Presets */}
          <div className="p-2 border-b border-[#2E3338]">
            <p className="text-xs font-medium text-slate-500 uppercase px-2 mb-2">Quick Select</p>
            <div className="grid grid-cols-2 gap-1">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => handlePresetClick(preset)}
                  className={cn(
                    'px-3 py-2 text-sm rounded-lg text-left transition-colors',
                    value.label === preset.label
                      ? 'bg-[#D4E815]/10 text-[#D4E815]'
                      : 'text-slate-400 hover:bg-[#2E3338] hover:text-white'
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Range */}
          <div className="p-3 border-b border-[#2E3338]">
            <p className="text-xs font-medium text-slate-500 uppercase mb-2">Custom Range</p>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="flex-1 px-3 py-2 bg-[#1A1D21] border border-[#2E3338] rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#D4E815]/50"
              />
              <span className="text-slate-500">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="flex-1 px-3 py-2 bg-[#1A1D21] border border-[#2E3338] rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#D4E815]/50"
              />
            </div>
            <button
              onClick={handleCustomApply}
              disabled={!customStart || !customEnd || customStart > customEnd}
              className="w-full mt-2 py-2 bg-[#D4E815] text-[#1A1D21] text-sm font-medium rounded-lg hover:bg-[#c5d913] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Apply
            </button>
          </div>

          {/* Compare Toggle */}
          {showCompare && (
            <div className="p-3">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-slate-400">Compare to previous period</span>
                <div
                  onClick={handleCompareToggle}
                  className={cn(
                    'w-10 h-5 rounded-full transition-colors relative',
                    isComparing ? 'bg-[#D4E815]' : 'bg-[#2E3338]'
                  )}
                >
                  <div
                    className={cn(
                      'w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform',
                      isComparing ? 'translate-x-5' : 'translate-x-0.5'
                    )}
                  />
                </div>
              </label>
              {isComparing && compareValue && (
                <p className="text-xs text-slate-500 mt-2">
                  Comparing to: {compareValue.startDate} - {compareValue.endDate}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
