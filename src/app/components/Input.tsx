/**
 * =============================================================================
 * Input Components — DEAD CODE (kept in repo, not currently rendered)
 * =============================================================================
 *
 * STATUS (verified April 25, 2026): nothing in the app imports or renders
 * <SearchInput /> or <SourceToggle />. Both exports are unreferenced.
 *
 * HISTORY:
 *   - Used in v1 of the app (initial commit + a few early enhancement
 *     commits — see `git log --all -S "<SearchInput"`).
 *   - Replaced when:
 *       (a) the dashboard pages got their own INLINE search bars (the
 *           Find / Discovered / Saved page.tsx files render the search
 *           UI inline rather than importing this component), and
 *       (b) source filtering moved into the FilterPanel slide-out.
 *   - These files were never deleted after the refactor.
 *   - Last code change: 2026-01-08 (the brutalist redesign commit). Has
 *     not been touched in 3+ months as of this audit.
 *
 * AUDIT (April 25, 2026 — smoover design migration sweep):
 *   Five independent checks, all zero hits outside this file:
 *     1. Whole-repo grep for `SearchInput` / `SourceToggle` (excluding
 *        node_modules, .next, .git): only this file's declarations match.
 *     2. JSX-usage grep `<SearchInput` / `<SourceToggle`: zero real
 *        matches (only TS generic syntax `<SearchInputProps>` etc. inside
 *        this file).
 *     3. Import grep across all variations (`from './Input'`, `from
 *        '@/...Input'`, `require()`, dynamic `import()`, `import * as`):
 *        zero matches. The only `Input`-related import in the codebase
 *        is `StripeCardInput`, which is a different file entirely.
 *     4. No barrel `index.ts` re-exports `Input.tsx` (only enrichment +
 *        dictionaries have barrel files, neither touches `components/`).
 *     5. `git log --all -S "<SearchInput"` shows the JSX appears only in
 *        the initial commit and one early commit, then was removed and
 *        has not appeared on main since. Same result for `<SourceToggle`.
 *
 * WHY NOT MIGRATED TO SMOOVER:
 *   The app-wide neo-brutalist → smoover refresh (April 2026) deliberately
 *   skipped these components because migrating dead code is wasted effort
 *   and adds maintenance burden with zero user-visible benefit. The
 *   brutalist styles below are intentionally left as-is.
 *
 * WHAT TO DO IF YOU LAND HERE:
 *   - Preferred: delete this file (`git rm src/app/components/Input.tsx`)
 *     and remove the audit entry from MEMORY/notes. Re-run the five
 *     checks above first to confirm nothing has started using it since
 *     April 25, 2026.
 *   - Or: if you actually want to USE <SearchInput /> on a page, you MUST
 *     migrate the brutalist classNames below to smoover first (see
 *     AffiliateRow.tsx, FilterPanel.tsx slide-out, or the Settings page
 *     for the pattern). Do NOT ship the brutalist version into a smoover
 *     surface — it will look badly out of place.
 *
 * Original (now-stale) brutalist design notes — preserved for archaeology:
 *   - Sharp edges (no rounded corners)
 *   - Bold borders (border-2 with black)
 *   - Yellow accent color (#ffbf23)
 *   - Bold typography (font-black uppercase)
 *   - Dark mode support
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
