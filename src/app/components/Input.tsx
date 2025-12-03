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
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#1A1D21] transition-colors">
        <Search className="h-4 w-4" />
      </div>
      <input
        className={cn(
          "w-full pl-10 pr-24 py-2.5 bg-white border-0 ring-1 ring-slate-200 rounded-xl text-sm font-medium text-slate-900 shadow-[0_1px_2px_rgb(0,0,0,0.05)] transition-all duration-200",
          "placeholder:text-slate-400 placeholder:font-normal",
          "focus:outline-none focus:ring-2 focus:ring-[#D4E815]/20 focus:shadow-[0_4px_12px_rgb(212,232,21,0.05)]",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onKeyDown={(e) => e.key === 'Enter' && onSearch()}
        disabled={isLoading}
      />
      <div className="absolute inset-y-0 right-1.5 flex items-center gap-1.5">
        <div className="hidden sm:flex items-center px-1.5 py-0.5 bg-slate-50 rounded border border-slate-100 text-[9px] font-bold text-slate-400 uppercase tracking-widest mr-1">
          <Command size={8} className="mr-1" /> K
        </div>
        <button 
          className={cn(
            "h-7 px-3 rounded-lg font-semibold text-xs transition-all duration-200",
            "bg-[#D4E815] text-[#1A1D21] hover:bg-[#c5d913] hover:shadow-md hover:shadow-[#D4E815]/20",
            "disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:bg-[#D4E815] flex items-center gap-1.5"
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
      <span className="text-[10px] font-bold text-slate-400 mr-1.5 uppercase tracking-wider">Sources:</span>
      {sources.map(source => {
        const isSelected = selected.includes(source);
        return (
          <button 
            key={source}
            className={cn(
              "px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all duration-200 border select-none",
              isSelected 
                ? "bg-[#1A1D21] text-white border-[#1A1D21] shadow-sm" 
                : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
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
