/**
 * =============================================================================
 * Input Components - NEO-BRUTALIST
 * =============================================================================
 * 
 * Updated: January 8th, 2026
 *
 * NEO-BRUTALIST DESIGN UPDATE:
 * - Sharp edges (no rounded corners)
 * - Bold borders (border-2 with black)
 * - Yellow accent color (#ffbf23)
 * - Bold typography (font-black uppercase)
 * - Dark mode support
 *
 * =============================================================================
 */

import React from 'react';
import { Search, Loader2, Command } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchInputProps {
  value: string;
  onChange: (val: string) => void;
  onSearch: () => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
  buttonLabel?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({ 
  value, 
  onChange, 
  onSearch, 
  isLoading = false,
  placeholder = "Search...",
  className,
  buttonLabel = "Scout"
}) => {
  return (
    <div className={cn("relative w-full group", className)}>
      {/* Search Icon */}
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-black dark:group-focus-within:text-white transition-colors">
        <Search className="h-4 w-4" />
      </div>
      
      {/* Input - NEO-BRUTALIST */}
      <input
        className={cn(
          "w-full pl-10 pr-24 py-2.5 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-900 dark:text-white transition-all duration-200",
          "placeholder:text-gray-400 placeholder:font-normal",
          "focus:outline-none focus:border-black dark:focus:border-white",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onKeyDown={(e) => e.key === 'Enter' && onSearch()}
        disabled={isLoading}
      />
      
      {/* Right side elements */}
      <div className="absolute inset-y-0 right-1.5 flex items-center gap-1.5">
        {/* Keyboard shortcut badge - NEO-BRUTALIST */}
        <div className="hidden sm:flex items-center px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-[9px] font-black text-gray-500 uppercase tracking-widest mr-1">
          <Command size={8} className="mr-1" /> K
        </div>
        
        {/* Search Button - NEO-BRUTALIST */}
        <button 
          className={cn(
            "h-7 px-3 font-black text-xs transition-all duration-200 uppercase",
            "bg-[#ffbf23] text-black border-2 border-black",
            "hover:shadow-[2px_2px_0px_0px_#000000]",
            "disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-1.5"
          )}
          onClick={onSearch}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>{buttonLabel === 'Scout' ? 'Scouting' : 'Searching'}</span>
            </>
          ) : (
            buttonLabel
          )}
        </button>
      </div>
    </div>
  );
};

interface SourceToggleProps {
  sources: string[];
  selected: string[];
  onToggle: (source: string) => void;
}

export const SourceToggle: React.FC<SourceToggleProps> = ({ sources, selected, onToggle }) => {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] font-black text-gray-400 mr-1.5 uppercase tracking-wider">Sources:</span>
      {sources.map(source => {
        const isSelected = selected.includes(source);
        return (
          <button 
            key={source}
            className={cn(
              "px-2.5 py-1 text-[10px] font-bold transition-all duration-200 border-2 select-none uppercase",
              isSelected 
                ? "bg-black text-white border-black shadow-[2px_2px_0px_0px_#ffbf23]" 
                : "bg-white dark:bg-gray-900 text-gray-500 border-gray-300 dark:border-gray-600 hover:border-black dark:hover:border-white"
            )}
            onClick={() => onToggle(source)}
          >
            {source}
          </button>
        );
      })}
    </div>
  );
};
