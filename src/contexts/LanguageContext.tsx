/**
 * =============================================================================
 * LANGUAGE CONTEXT - i18n Provider
 * =============================================================================
 *
 * Created: January 9th, 2026
 *
 * This context provides internationalization (i18n) functionality across the
 * CrewCast Studio application. It handles language state, persistence, and
 * provides access to translated strings.
 *
 * ARCHITECTURE DECISION:
 * ----------------------
 * We use a client-side only approach with React Context + localStorage:
 *   - Language is detected from browser on first visit
 *   - User preference is saved to localStorage
 *   - Same URL for all languages (no /en/ or /de/ prefixes)
 *
 * This was chosen over Next.js sub-path routing because:
 *   1. Most pages are behind login (no SEO benefit from locale URLs)
 *   2. Simpler implementation without route restructuring
 *   3. Works well with the existing SPA-like architecture
 *
 * HOW TO USE:
 * -----------
 * 1. Import the hook:
 *    import { useLanguage } from '@/contexts/LanguageContext';
 *
 * 2. Access translations and language state:
 *    const { t, language, setLanguage, isLoading } = useLanguage();
 *
 * 3. Use translations in JSX:
 *    <h1>{t.landing.hero.title}</h1>
 *    <button>{t.common.save}</button>
 *
 * 4. Switch language:
 *    <button onClick={() => setLanguage('de')}>Deutsch</button>
 *
 * SUPPORTED LANGUAGES:
 * --------------------
 * - English (en) - Default
 * - German (de) - Formal "Sie" form
 *
 * =============================================================================
 */

'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import {
  Language,
  Dictionary,
  DEFAULT_LANGUAGE,
  AVAILABLE_LANGUAGES,
} from '@/dictionaries';
import { en } from '@/dictionaries/en';
import { de } from '@/dictionaries/de';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * localStorage key for persisting language preference
 */
const LANGUAGE_STORAGE_KEY = 'crewcast_language';

/**
 * Map of language codes to their dictionaries
 */
const DICTIONARIES: Record<Language, Dictionary> = {
  en,
  de,
};

// =============================================================================
// TYPES
// =============================================================================

interface LanguageContextType {
  /**
   * Current active language code ('en' | 'de')
   */
  language: Language;

  /**
   * Function to change the current language
   * Persists the choice to localStorage
   */
  setLanguage: (lang: Language) => void;

  /**
   * The current language's translation dictionary
   * Access translations like: t.common.save, t.landing.hero.title
   */
  t: Dictionary;

  /**
   * Whether the language is still being initialized
   * True during SSR and initial client-side hydration
   */
  isLoading: boolean;

  /**
   * List of available languages with display names
   */
  availableLanguages: typeof AVAILABLE_LANGUAGES;
}

// =============================================================================
// CONTEXT
// =============================================================================

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// =============================================================================
// PROVIDER
// =============================================================================

interface LanguageProviderProps {
  children: ReactNode;
}

/**
 * LanguageProvider - Wrap your app with this to enable i18n
 *
 * @example
 * // In layout.tsx:
 * import { LanguageProvider } from '@/contexts/LanguageContext';
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <LanguageProvider>
 *           {children}
 *         </LanguageProvider>
 *       </body>
 *     </html>
 *   );
 * }
 */
export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  // =========================================================================
  // STATE
  // =========================================================================

  /**
   * Current language - starts with default, then updates from storage/browser
   */
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);

  /**
   * Loading state - true until we've checked localStorage/browser language
   */
  const [isLoading, setIsLoading] = useState(true);

  // =========================================================================
  // INITIALIZATION
  // =========================================================================

  /**
   * On mount: Check localStorage first, then browser language
   *
   * Priority:
   * 1. localStorage (user explicitly chose a language before)
   * 2. Browser language (navigator.language)
   * 3. Default language (English)
   */
  useEffect(() => {
    // Skip if running on server
    if (typeof window === 'undefined') {
      setIsLoading(false);
      return;
    }

    try {
      // Check localStorage first
      const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language | null;

      if (savedLanguage && AVAILABLE_LANGUAGES.some((l) => l.code === savedLanguage)) {
        // User has a saved preference
        setLanguageState(savedLanguage);
      } else {
        // Detect from browser
        const browserLang = navigator.language.toLowerCase();

        // Check if browser language starts with a supported language code
        const detectedLang = AVAILABLE_LANGUAGES.find((l) =>
          browserLang.startsWith(l.code)
        );

        if (detectedLang) {
          setLanguageState(detectedLang.code);
          // Save detected language so we don't re-detect next time
          localStorage.setItem(LANGUAGE_STORAGE_KEY, detectedLang.code);
        } else {
          // Use default and save it
          setLanguageState(DEFAULT_LANGUAGE);
          localStorage.setItem(LANGUAGE_STORAGE_KEY, DEFAULT_LANGUAGE);
        }
      }
    } catch (error) {
      // localStorage might be blocked (incognito mode, etc.)
      console.warn('[LanguageContext] Could not access localStorage:', error);
      setLanguageState(DEFAULT_LANGUAGE);
    }

    setIsLoading(false);
  }, []);

  // =========================================================================
  // HANDLERS
  // =========================================================================

  /**
   * Set the current language and persist to localStorage
   */
  const setLanguage = useCallback((lang: Language) => {
    // Validate the language code
    if (!AVAILABLE_LANGUAGES.some((l) => l.code === lang)) {
      console.warn(`[LanguageContext] Invalid language code: ${lang}`);
      return;
    }

    setLanguageState(lang);

    // Persist to localStorage
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch (error) {
      console.warn('[LanguageContext] Could not save to localStorage:', error);
    }

    // Update the HTML lang attribute for accessibility
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
  }, []);

  // =========================================================================
  // UPDATE HTML LANG ATTRIBUTE
  // =========================================================================

  /**
   * Keep the <html lang="..."> attribute in sync with current language
   * This is important for accessibility and screen readers
   */
  useEffect(() => {
    if (typeof document !== 'undefined' && !isLoading) {
      document.documentElement.lang = language;
    }
  }, [language, isLoading]);

  // =========================================================================
  // CONTEXT VALUE
  // =========================================================================

  const value: LanguageContextType = {
    language,
    setLanguage,
    t: DICTIONARIES[language],
    isLoading,
    availableLanguages: AVAILABLE_LANGUAGES,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

// =============================================================================
// HOOK
// =============================================================================

/**
 * useLanguage - Hook to access the language context
 *
 * @throws Error if used outside of LanguageProvider
 *
 * @example
 * function MyComponent() {
 *   const { t, language, setLanguage } = useLanguage();
 *
 *   return (
 *     <div>
 *       <h1>{t.landing.hero.title}</h1>
 *       <p>Current: {language}</p>
 *       <button onClick={() => setLanguage('de')}>
 *         Switch to German
 *       </button>
 *     </div>
 *   );
 * }
 */
export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);

  if (context === undefined) {
    throw new Error(
      'useLanguage must be used within a LanguageProvider. ' +
      'Make sure your app is wrapped with <LanguageProvider>.'
    );
  }

  return context;
};

// =============================================================================
// EXPORTS
// =============================================================================

export { AVAILABLE_LANGUAGES };
export type { Language, Dictionary };

