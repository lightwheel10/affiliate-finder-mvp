'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Globe2, Languages, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SearchMarketPickerOption {
  value: string;
  label: string;
  code: string;
  flagUrl?: string | null;
}

interface SearchMarketPickerProps {
  id: string;
  label: string;
  value: string;
  options: readonly SearchMarketPickerOption[];
  onChange: (value: string) => void;
  searchPlaceholder: string;
  noResultsText: string;
  disabled?: boolean;
  variant: 'country' | 'language';
  align?: 'start' | 'end';
}

function OptionIcon({
  option,
  variant,
}: {
  option: SearchMarketPickerOption;
  variant: SearchMarketPickerProps['variant'];
}) {
  if (variant === 'country' && option.flagUrl) {
    return (
      // These are tiny, size-specific flag assets; optimizing them adds overhead.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={option.flagUrl}
        alt=""
        width={24}
        height={18}
        className="h-[18px] w-6 shrink-0 rounded-[3px] object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
      />
    );
  }

  if (variant === 'language') {
    return (
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#fff4d1] text-[#9a6b00] dark:bg-[#ffbf23]/10 dark:text-[#ffbf23]">
        <Languages size={16} strokeWidth={2.25} />
      </span>
    );
  }

  return <Globe2 size={18} className="shrink-0 text-[#8898aa]" />;
}

export function SearchMarketPicker({
  id,
  label,
  value,
  options,
  onChange,
  searchPlaceholder,
  noResultsText,
  disabled = false,
  variant,
  align = 'start',
}: SearchMarketPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const selectedOption = options.find((option) => option.value === value);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredOptions = useMemo(
    () => options.filter((option) => (
      !normalizedQuery
      || option.label.toLocaleLowerCase().includes(normalizedQuery)
      || option.code.toLocaleLowerCase().includes(normalizedQuery)
    )),
    [normalizedQuery, options],
  );

  useEffect(() => {
    if (!isOpen) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setIsOpen(false);
      setQuery('');
      triggerRef.current?.focus();
    };

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    const focusFrame = window.requestAnimationFrame(() => searchRef.current?.focus());

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  const closeAndSelect = (nextValue: string) => {
    onChange(nextValue);
    setIsOpen(false);
    setQuery('');
    triggerRef.current?.focus();
  };

  const focusOption = (index: number) => {
    const optionButtons = rootRef.current?.querySelectorAll<HTMLButtonElement>('[data-market-option]');
    optionButtons?.[index]?.focus();
  };

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={`${id}-listbox`}
        disabled={disabled}
        onClick={() => {
          setIsOpen((current) => !current);
          setQuery('');
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setIsOpen(true);
            setQuery('');
          }
        }}
        className={cn(
          'flex h-14 w-full items-center gap-2.5 rounded-xl border bg-white px-3 text-left shadow-soft-sm outline-none',
          'transition-[border-color,background-color,box-shadow,transform] duration-150',
          'hover:border-[#b9c4d0] focus-visible:border-[#ffbf23] focus-visible:ring-2 focus-visible:ring-[#ffbf23]/20 active:scale-[0.99]',
          'disabled:cursor-not-allowed disabled:opacity-60 dark:bg-gray-900 dark:hover:border-gray-600',
          isOpen
            ? 'border-[#ffbf23] ring-2 ring-[#ffbf23]/20 dark:border-[#ffbf23]'
            : 'border-[#d8e0e8] dark:border-gray-700',
        )}
      >
        {selectedOption ? (
          <OptionIcon option={selectedOption} variant={variant} />
        ) : (
          <Globe2 size={18} className="shrink-0 text-[#8898aa]" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#8898aa] dark:text-gray-500">
            {label}
          </span>
          <span className="block truncate text-sm font-semibold text-[#0f172a] dark:text-white" title={selectedOption?.label}>
            {selectedOption?.label ?? '—'}
          </span>
        </span>
        <ChevronDown
          size={15}
          strokeWidth={2}
          className={cn(
            'shrink-0 text-[#8898aa] transition-transform duration-150',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {isOpen && (
        <div
          className={cn(
            'absolute top-[calc(100%+6px)] z-[70] w-72 max-w-[calc(100vw-3rem)] overflow-hidden rounded-xl border border-[#d8e0e8] bg-white shadow-soft-lg dark:border-gray-700 dark:bg-[#111827]',
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
          <div className="border-b border-[#e6ebf1] p-2 dark:border-gray-700">
            <div className="relative">
              <Search
                size={14}
                strokeWidth={2}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8898aa]"
              />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    focusOption(0);
                  }
                }}
                aria-label={`${searchPlaceholder} ${label}`}
                placeholder={searchPlaceholder}
                className="h-9 w-full rounded-lg border border-[#e6ebf1] bg-[#f6f9fc] pl-8 pr-3 text-sm text-[#0f172a] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[#8898aa] focus:border-[#ffbf23] focus:ring-2 focus:ring-[#ffbf23]/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div id={`${id}-listbox`} role="listbox" aria-label={label} className="max-h-52 overflow-y-auto p-1.5 custom-scrollbar">
            {filteredOptions.map((option, index) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  data-market-option
                  onClick={() => closeAndSelect(option.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowDown') {
                      event.preventDefault();
                      focusOption(Math.min(index + 1, filteredOptions.length - 1));
                    } else if (event.key === 'ArrowUp') {
                      event.preventDefault();
                      if (index === 0) searchRef.current?.focus();
                      else focusOption(index - 1);
                    } else if (event.key === 'Home') {
                      event.preventDefault();
                      focusOption(0);
                    } else if (event.key === 'End') {
                      event.preventDefault();
                      focusOption(filteredOptions.length - 1);
                    }
                  }}
                  className={cn(
                    'flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium outline-none',
                    'transition-[background-color,color] duration-150 focus-visible:ring-2 focus-visible:ring-[#ffbf23]/35',
                    isSelected
                      ? 'bg-[#fff4d1] text-[#0f172a] dark:bg-[#ffbf23]/10 dark:text-[#ffbf23]'
                      : 'text-[#425466] hover:bg-[#f6f9fc] dark:text-gray-300 dark:hover:bg-gray-800',
                  )}
                >
                  <OptionIcon option={option} variant={variant} />
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8898aa] dark:text-gray-500">
                    {option.code}
                  </span>
                  {isSelected && <Check size={14} className="shrink-0 text-[#d39600] dark:text-[#ffbf23]" strokeWidth={2.5} />}
                </button>
              );
            })}
            {filteredOptions.length === 0 && (
              <p className="px-3 py-4 text-center text-sm text-[#8898aa] dark:text-gray-500">
                {noResultsText}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
