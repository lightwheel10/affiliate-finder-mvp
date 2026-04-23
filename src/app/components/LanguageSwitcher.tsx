/**
 * =============================================================================
 * LANGUAGE SWITCHER COMPONENT
 * =============================================================================
 *
 * Created: January 9th, 2026
 *
 * A toggle button component for switching between English and German.
 * Uses the neo-brutalist design system to match the rest of the app.
 *
 * USAGE:
 * ------
 * <LanguageSwitcher />                    // Default: shows in sidebar style
 * <LanguageSwitcher variant="navbar" />   // For landing page navbar
 * <LanguageSwitcher variant="minimal" />  // Just flags, minimal space
 *
 * BEHAVIOR:
 * ---------
 * - Clicking toggles between EN and DE
 * - Change is immediately saved to localStorage
 * - All translated strings update instantly (no page refresh)
 *
 * =============================================================================
 */

'use client';

import React from 'react';
import { useLanguage, Language } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { Globe } from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface LanguageSwitcherProps {
  /**
   * Visual variant of the switcher
   * - 'sidebar': Used in the dashboard sidebar (default)
   * - 'navbar': Used in the landing page navbar
   * - 'minimal': Compact version with just flags
   */
  variant?: 'sidebar' | 'navbar' | 'minimal';

  /**
   * Additional CSS classes
   */
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  variant = 'sidebar',
  className,
}) => {
  const { language, setLanguage, isLoading } = useLanguage();

  /**
   * Toggle between English and German
   */
  const handleToggle = () => {
    const nextLanguage: Language = language === 'en' ? 'de' : 'en';
    setLanguage(nextLanguage);
  };

  /**
   * Set a specific language
   */
  const handleSetLanguage = (lang: Language) => {
    if (lang !== language) {
      setLanguage(lang);
    }
  };

  // Don't render during SSR/loading to prevent hydration mismatch
  if (isLoading) {
    return null;
  }

  // =========================================================================
  // SIDEBAR VARIANT - Neo-brutalist toggle in sidebar
  // =========================================================================
  if (variant === 'sidebar') {
    return (
      <div className={cn(
        "flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700",
        className
      )}>
        <div className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400">
          <Globe size={12} />
          <span>Language</span>
        </div>
        <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 p-0.5 border border-gray-200 dark:border-gray-700">
          <button
            onClick={() => handleSetLanguage('en')}
            className={cn(
              "px-2 py-1 text-[10px] font-black uppercase transition-all",
              language === 'en'
                ? "bg-[#ffbf23] text-black border border-black"
                : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            )}
            aria-label="Switch to English"
            title="English"
          >
            EN
          </button>
          <button
            onClick={() => handleSetLanguage('de')}
            className={cn(
              "px-2 py-1 text-[10px] font-black uppercase transition-all",
              language === 'de'
                ? "bg-[#ffbf23] text-black border border-black"
                : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            )}
            aria-label="Switch to German"
            title="Deutsch"
          >
            DE
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // NAVBAR VARIANT — "SMOOVER" refresh (April 23rd, 2026)
  // Was: border-2 gray box with sharp corners, font-bold.
  // Now: rounded-full pill container with hairline #e6ebf1 border; active
  // segment is a rounded-full yellow pill with a soft yellow glow — matches
  // the rest of the refreshed landing navbar.
  // =========================================================================
  if (variant === 'navbar') {
    return (
      <div className={cn(
        "flex items-center gap-0.5 bg-white/70 dark:bg-gray-900/70 backdrop-blur-md px-1 py-1 rounded-full border border-[#e6ebf1] dark:border-gray-800 shadow-[0_1px_2px_0_rgba(16,24,40,0.04)]",
        className
      )}>
        <button
          onClick={() => handleSetLanguage('en')}
          className={cn(
            "px-2.5 py-1 text-xs font-semibold rounded-full transition-all",
            language === 'en'
              ? "bg-[#ffbf23] text-[#0f172a] shadow-[0_2px_6px_-1px_rgba(255,191,35,0.4)]"
              : "text-[#425466] dark:text-gray-300 hover:text-[#0f172a] dark:hover:text-white hover:bg-[#ffbf23]/15"
          )}
          aria-label="Switch to English"
        >
          EN
        </button>
        <button
          onClick={() => handleSetLanguage('de')}
          className={cn(
            "px-2.5 py-1 text-xs font-semibold rounded-full transition-all",
            language === 'de'
              ? "bg-[#ffbf23] text-[#0f172a] shadow-[0_2px_6px_-1px_rgba(255,191,35,0.4)]"
              : "text-[#425466] dark:text-gray-300 hover:text-[#0f172a] dark:hover:text-white hover:bg-[#ffbf23]/15"
          )}
          aria-label="Switch to German"
        >
          DE
        </button>
      </div>
    );
  }

  // =========================================================================
  // MINIMAL VARIANT - Just a toggle button
  // =========================================================================
  return (
    <button
      onClick={handleToggle}
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 text-xs font-bold text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white border-2 border-gray-200 dark:border-gray-700 hover:border-[#ffbf23] transition-all",
        className
      )}
      aria-label={`Current language: ${language === 'en' ? 'English' : 'German'}. Click to switch.`}
    >
      <Globe size={12} />
      <span className="uppercase">{language}</span>
    </button>
  );
};

export default LanguageSwitcher;

