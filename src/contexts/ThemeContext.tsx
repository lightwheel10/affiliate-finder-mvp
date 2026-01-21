/**
 * =============================================================================
 * THEME CONTEXT - Dark Mode Provider
 * =============================================================================
 *
 * Created: January 22nd, 2026
 *
 * This context provides dark/light mode functionality across the
 * CrewCast Studio application. It handles theme state, persistence,
 * and applies the 'dark' class to the HTML element.
 *
 * ARCHITECTURE:
 * -------------
 * - Client-side only with React Context + localStorage
 * - Theme preference saved to localStorage
 * - Respects system preference on first visit
 * - Applies 'dark' class to <html> element for Tailwind dark mode
 *
 * HOW TO USE:
 * -----------
 * 1. Import the hook:
 *    import { useTheme } from '@/contexts/ThemeContext';
 *
 * 2. Access theme state:
 *    const { theme, setTheme, toggleTheme, isDark } = useTheme();
 *
 * 3. Toggle theme:
 *    <button onClick={toggleTheme}>Toggle Dark Mode</button>
 *
 * SUPPORTED THEMES:
 * -----------------
 * - 'light' - Light mode (default)
 * - 'dark' - Dark mode
 * - 'system' - Follow system preference
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

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * localStorage key for persisting theme preference
 */
const THEME_STORAGE_KEY = 'crewcast_theme';

/**
 * Available theme options
 */
export type Theme = 'light' | 'dark' | 'system';

/**
 * Available themes with display info
 */
export const AVAILABLE_THEMES = [
  { code: 'light' as Theme, name: 'Light', nameDE: 'Hell' },
  { code: 'dark' as Theme, name: 'Dark', nameDE: 'Dunkel' },
  { code: 'system' as Theme, name: 'System', nameDE: 'System' },
] as const;

// =============================================================================
// TYPES
// =============================================================================

interface ThemeContextType {
  /**
   * Current theme setting ('light' | 'dark' | 'system')
   */
  theme: Theme;

  /**
   * Function to change the theme
   */
  setTheme: (theme: Theme) => void;

  /**
   * Toggle between light and dark (ignores system)
   */
  toggleTheme: () => void;

  /**
   * Whether dark mode is currently active (resolved from theme + system)
   */
  isDark: boolean;

  /**
   * Whether the theme is still being initialized
   */
  isLoading: boolean;

  /**
   * Available theme options
   */
  availableThemes: typeof AVAILABLE_THEMES;
}

// =============================================================================
// CONTEXT
// =============================================================================

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get the system's preferred color scheme
 */
function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Resolve the actual theme (light/dark) from the setting
 */
function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return getSystemTheme();
  }
  return theme;
}

/**
 * Apply the theme class to the document
 */
function applyThemeToDocument(isDark: boolean) {
  if (typeof document === 'undefined') return;
  
  const root = document.documentElement;
  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

// =============================================================================
// PROVIDER
// =============================================================================

interface ThemeProviderProps {
  children: ReactNode;
}

/**
 * ThemeProvider - Wrap your app with this to enable dark mode
 *
 * @example
 * // In layout.tsx:
 * import { ThemeProvider } from '@/contexts/ThemeContext';
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <ThemeProvider>
 *           {children}
 *         </ThemeProvider>
 *       </body>
 *     </html>
 *   );
 * }
 */
export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  // =========================================================================
  // STATE
  // =========================================================================

  /**
   * Current theme setting - starts with 'system', then updates from storage
   */
  const [theme, setThemeState] = useState<Theme>('system');

  /**
   * Loading state - true until we've checked localStorage
   */
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Whether dark mode is currently active
   */
  const [isDark, setIsDark] = useState(false);

  // =========================================================================
  // INITIALIZATION
  // =========================================================================

  /**
   * On mount: Check localStorage, then apply theme
   */
  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsLoading(false);
      return;
    }

    try {
      // Check localStorage first
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;

      if (savedTheme && AVAILABLE_THEMES.some((t) => t.code === savedTheme)) {
        setThemeState(savedTheme);
        const resolved = resolveTheme(savedTheme);
        setIsDark(resolved === 'dark');
        applyThemeToDocument(resolved === 'dark');
      } else {
        // Default to system preference
        const systemIsDark = getSystemTheme() === 'dark';
        setThemeState('system');
        setIsDark(systemIsDark);
        applyThemeToDocument(systemIsDark);
      }
    } catch (error) {
      console.warn('[ThemeContext] Could not access localStorage:', error);
      setThemeState('light');
      setIsDark(false);
      applyThemeToDocument(false);
    }

    setIsLoading(false);
  }, []);

  // =========================================================================
  // SYSTEM THEME LISTENER
  // =========================================================================

  /**
   * Listen for system theme changes when theme is set to 'system'
   */
  useEffect(() => {
    if (typeof window === 'undefined' || theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      setIsDark(e.matches);
      applyThemeToDocument(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  // =========================================================================
  // HANDLERS
  // =========================================================================

  /**
   * Set the theme and persist to localStorage
   */
  const setTheme = useCallback((newTheme: Theme) => {
    if (!AVAILABLE_THEMES.some((t) => t.code === newTheme)) {
      console.warn(`[ThemeContext] Invalid theme: ${newTheme}`);
      return;
    }

    setThemeState(newTheme);

    // Resolve and apply the actual theme
    const resolved = resolveTheme(newTheme);
    setIsDark(resolved === 'dark');
    applyThemeToDocument(resolved === 'dark');

    // Persist to localStorage
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch (error) {
      console.warn('[ThemeContext] Could not save to localStorage:', error);
    }
  }, []);

  /**
   * Toggle between light and dark
   */
  const toggleTheme = useCallback(() => {
    const newTheme: Theme = isDark ? 'light' : 'dark';
    setTheme(newTheme);
  }, [isDark, setTheme]);

  // =========================================================================
  // CONTEXT VALUE
  // =========================================================================

  const value: ThemeContextType = {
    theme,
    setTheme,
    toggleTheme,
    isDark,
    isLoading,
    availableThemes: AVAILABLE_THEMES,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

// =============================================================================
// HOOK
// =============================================================================

/**
 * useTheme - Hook to access the theme context
 *
 * @throws Error if used outside of ThemeProvider
 *
 * @example
 * function MyComponent() {
 *   const { theme, isDark, toggleTheme } = useTheme();
 *
 *   return (
 *     <button onClick={toggleTheme}>
 *       {isDark ? '☀️ Light Mode' : '🌙 Dark Mode'}
 *     </button>
 *   );
 * }
 */
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);

  if (context === undefined) {
    throw new Error(
      'useTheme must be used within a ThemeProvider. ' +
      'Make sure your app is wrapped with <ThemeProvider>.'
    );
  }

  return context;
};

// =============================================================================
// EXPORTS
// =============================================================================

export { AVAILABLE_THEMES as themes };
