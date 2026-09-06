'use client';

import { Search, TrendingUp, X } from 'lucide-react';

interface SearchCriteriaEditorProps {
  id: string;
  label: string;
  values: readonly string[];
  inputValue: string;
  onInputChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (value: string) => void;
  onClear: () => void;
  maxItems: number;
  placeholder: string;
  addLabel: string;
  emptyLabel: string;
  clearLabel: string;
  disabled?: boolean;
  variant: 'keyword' | 'competitor';
}

export function SearchCriteriaEditor({
  id,
  label,
  values,
  inputValue,
  onInputChange,
  onAdd,
  onRemove,
  onClear,
  maxItems,
  placeholder,
  addLabel,
  emptyLabel,
  clearLabel,
  disabled = false,
  variant,
}: SearchCriteriaEditorProps) {
  const atLimit = values.length >= maxItems;

  return (
    <div className="flex min-w-0 flex-col">
      <label htmlFor={id} className="flex h-7 items-center gap-2 text-sm font-semibold text-[#0f172a] dark:text-gray-200">
        {variant === 'keyword' ? (
          <Search size={14} className="text-[#425466] dark:text-gray-400" strokeWidth={2} />
        ) : (
          <TrendingUp size={14} className="text-[#425466] dark:text-gray-400" strokeWidth={2} />
        )}
        {label}
        <span className="ml-auto text-xs font-semibold tabular-nums text-[#8898aa]">
          {values.length}/{maxItems}
        </span>
      </label>

      <div className="relative mt-2">
        <input
          id={id}
          type="text"
          value={inputValue}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onAdd();
            }
          }}
          placeholder={placeholder}
          disabled={disabled || atLimit}
          className="h-10 w-full rounded-lg border border-[#e6ebf1] bg-white px-3 pr-[72px] text-sm text-[#0f172a] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[#8898aa] focus:border-[#ffbf23]/60 focus:ring-2 focus:ring-[#ffbf23]/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        />
        <button
          type="button"
          onClick={onAdd}
          disabled={disabled || !inputValue.trim() || atLimit}
          className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md bg-[#ffbf23] px-3 py-1.5 text-xs font-semibold text-[#0f172a] transition-[background-color,transform] duration-150 hover:bg-[#e5ac20] active:scale-[0.96] disabled:cursor-not-allowed disabled:bg-[#f6f9fc] disabled:text-[#8898aa] disabled:shadow-none dark:disabled:bg-gray-800"
        >
          {addLabel}
        </button>
      </div>

      <div className="mt-2 min-h-[128px] max-h-[128px] flex-1 space-y-1.5 overflow-y-auto rounded-xl border border-[#e6ebf1] bg-[#f6f9fc] p-2 no-scrollbar dark:border-gray-800 dark:bg-gray-900">
        {values.length > 0 ? values.map((value, index) => (
          <div
            key={value}
            className="group flex items-center gap-2 rounded-lg border border-[#e6ebf1] bg-white px-2.5 py-1.5 text-sm transition-[border-color,background-color] duration-150 hover:border-[#cdd5df] dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600"
          >
            {variant === 'keyword' ? (
              <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[#ffbf23] text-[10px] font-semibold text-[#0f172a] shadow-yellow-glow-sm">
                {index + 1}
              </span>
            ) : (
              // Favicons are tiny third-party assets; Next image optimization adds overhead here.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`https://www.google.com/s2/favicons?domain=${value}&sz=16`}
                alt=""
                className="size-3.5 shrink-0"
                onError={(event) => { event.currentTarget.style.display = 'none'; }}
              />
            )}
            <span
              className={`min-w-0 flex-1 truncate font-medium text-[#0f172a] dark:text-gray-200 ${variant === 'keyword' ? 'text-sm' : 'text-xs'}`}
              title={value}
            >
              {value}
            </span>
            <button
              type="button"
              onClick={() => onRemove(value)}
              disabled={disabled}
              aria-label={`Remove ${label.toLocaleLowerCase()} ${value}`}
              className="flex size-5 shrink-0 items-center justify-center rounded-full text-[#8898aa] transition-[background-color,color,transform] duration-150 hover:bg-red-50 hover:text-red-500 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-red-900/20"
            >
              <X size={12} strokeWidth={2.5} />
            </button>
          </div>
        )) : (
          <div className="flex h-full items-center justify-center text-xs italic text-[#8898aa]">
            {emptyLabel}
          </div>
        )}
      </div>

      <div className="mt-1.5 h-5">
        {values.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            className="text-xs font-semibold text-[#8898aa] transition-colors duration-150 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {clearLabel}
          </button>
        )}
      </div>
    </div>
  );
}
