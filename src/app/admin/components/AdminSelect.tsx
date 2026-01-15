// =============================================================================
// AdminSelect - Standardized Admin Dropdown (Neo-brutalist)
// Added January 15th, 2026
//
// WHY:
// Admin pages used native <select>, which rendered inconsistently with the
// neo-brutalist design. This component mirrors the main app dropdown pattern
// (button + menu + chevron) for consistent styling across admin pages.
// =============================================================================

'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminSelectOption {
  value: string;
  label: string;
}

interface AdminSelectProps {
  value: string;
  options: AdminSelectOption[];
  onChange: (value: string) => void;
  ariaLabel?: string;
  className?: string;
  buttonClassName?: string;
}

export function AdminSelect({
  value,
  options,
  onChange,
  ariaLabel,
  className,
  buttonClassName,
}: AdminSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} className={cn('relative', className)}>
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full px-3 py-2.5 bg-white border-2 border-black text-sm font-bold uppercase text-black text-left flex items-center justify-between focus:outline-none',
          buttonClassName
        )}
      >
        <span className={selected ? 'text-black' : 'text-black/60'}>
          {selected?.label || 'Select'}
        </span>
        <ChevronDown
          size={14}
          className={cn('text-black transition-transform', isOpen && 'rotate-180')}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-black shadow-[3px_3px_0px_0px_#111827] z-50 max-h-56 overflow-y-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={cn(
                'w-full px-3 py-2 text-sm text-left font-bold uppercase hover:bg-black/5',
                option.value === value && 'bg-[#D4E815]/40'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
