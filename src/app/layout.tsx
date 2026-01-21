/**
 * =============================================================================
 * ROOT LAYOUT - SUPABASE AUTH
 * =============================================================================
 * 
 * Created: Original
 * Updated: January 19th, 2026 - Removed Stack Auth, migrated to Supabase
 * 
 * WHAT CHANGED:
 * -------------
 * - Removed StackProvider and StackTheme from @stackframe/stack
 * - Removed stackClientApp import
 * - Supabase auth is handled via cookies (no provider needed)
 * - All other functionality preserved (i18n, fonts, toasts)
 * 
 * WHY NO SUPABASE PROVIDER:
 * -------------------------
 * Unlike Stack Auth which required wrapping the app in StackProvider,
 * Supabase auth works via:
 * 1. HTTP-only cookies (set by /auth/callback)
 * 2. Browser client (getSupabaseBrowserClient singleton)
 * 3. useSupabaseUser hook (manages auth state)
 * 
 * This is simpler and more secure (HTTP-only cookies prevent XSS attacks).
 * 
 * =============================================================================
 */

import type { Metadata } from "next";
import { Inter, Fira_Code } from "next/font/google";
import "./globals.css";

// =============================================================================
// INTERNATIONALIZATION (i18n) - January 9th, 2026
// 
// LanguageProvider enables multi-language support across the entire app.
// Currently supports English (en) and German (de) with formal "Sie" form.
// 
// The provider:
//   - Auto-detects browser language on first visit
//   - Persists user preference to localStorage
//   - Provides translations via useLanguage() hook
// 
// Usage in components:
//   import { useLanguage } from '@/contexts/LanguageContext';
//   const { t } = useLanguage();
//   <h1>{t.landing.hero.title}</h1>
// 
// See LANGUAGE_MIGRATION.md for full documentation.
// =============================================================================
import { LanguageProvider } from "@/contexts/LanguageContext";

// =============================================================================
// FONT CONFIGURATION - Updated January 6th, 2026
// 
// Changed from Geist to Inter/Fira Code for neo-brutalist design
// matching DashboardDemo.tsx styling:
// - Inter: Primary sans-serif (weights: 400, 700, 900)
// - Fira Code: Monospace for code/timers (weights: 400, 700)
// =============================================================================

// =============================================================================
// GLOBAL TOAST NOTIFICATIONS (January 5th, 2026)
// 
// Sonner provides a global toast notification system across the entire app.
// The Toaster component is rendered once here in the root layout, and toasts
// can be triggered from any component, hook, or utility using:
// 
//   import { toast } from 'sonner';
//   toast.success('Message');  // Green success toast
//   toast.error('Message');    // Red error toast  
//   toast.warning('Message');  // Yellow warning toast
//   toast.info('Message');     // Blue info toast
//   toast('Message');          // Default neutral toast
// 
// This replaces the old per-page custom notification implementations and
// eliminates the need for alert() popups.
// =============================================================================
import { Toaster } from 'sonner';

// Neo-brutalist design fonts (January 6th, 2026)
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});

const firaCode = Fira_Code({
  variable: "--font-fira-code",
  subsets: ["latin"],
  weight: ["400", "700"],
});

// January 21st, 2026: Removed "backed by selecdoo AI" per client request
export const metadata: Metadata = {
  title: "CrewCast Studio",
  description: "Find the best affiliates for your campaign",
};

// =============================================================================
// STACK AUTH REMOVED - January 19th, 2026
// 
// Previously this file included:
// - import { StackProvider, StackTheme } from "@stackframe/stack";
// - import { stackClientApp } from "../stack/client";
// - const stackAuthTheme = { ... }
// - <StackProvider app={stackClientApp}> wrapper
// - <StackTheme theme={stackAuthTheme}> wrapper
// 
// These have been removed as we migrated to Supabase Auth.
// Supabase Auth doesn't require a provider - it uses cookies and
// the useSupabaseUser hook for state management.
// =============================================================================

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Note: html lang attribute is dynamically updated by LanguageProvider
    // based on user preference (detected from browser or saved in localStorage)
    <html lang="en">
      {/* Updated January 6th, 2026: Inter + Fira Code for neo-brutalist design */}
      <body className={`${inter.variable} ${firaCode.variable} font-sans antialiased`}>
        {/* =================================================================
            LANGUAGE PROVIDER (January 9th, 2026)
            
            Wraps the entire app to provide i18n support.
            Must be inside <body> for client-side rendering.
            
            The LanguageProvider:
            - Detects browser language on first visit
            - Saves user preference to localStorage
            - Updates document.documentElement.lang for accessibility
            - Provides translations via useLanguage() hook
            ================================================================= */}
        <LanguageProvider>
          {/* =============================================================
              SUPABASE AUTH (January 19th, 2026)
              
              No provider needed! Supabase auth works via:
              1. HTTP-only cookies (set by /auth/callback)
              2. Browser client singleton (getSupabaseBrowserClient)
              3. useSupabaseUser hook (manages auth state)
              
              Children are rendered directly - auth state is managed
              by individual components using useSupabaseUser().
              ============================================================= */}
          {children}
        
          {/* =====================================================================
              GLOBAL TOAST CONTAINER (January 5th, 2026)
              Updated: January 16, 2026 - Added visibleToasts={1} to show only one at a time
              
              Configuration:
              - position: bottom-right (consistent with previous Outreach page toasts)
              - richColors: true (styled success=green, error=red, warning=yellow, info=blue)
              - closeButton: removed (toasts auto-dismiss, no need for manual close)
              - duration: 4000ms (auto-dismiss after 4 seconds)
              - visibleToasts: 1 (only show one toast at a time, new ones replace old)
              - toastOptions.className: ensures proper z-index above modals
              
              To trigger toasts from anywhere in the app:
                import { toast } from 'sonner';
                toast.success('Success message');
                toast.error('Error message');
                toast.warning('Warning message');
                toast.info('Info message');
              ===================================================================== */}
          {/* =====================================================================
              TOASTER - NEO-BRUTALIST DESIGN (Updated January 17, 2026)
              
              Customized to match the app's neo-brutalist aesthetic:
              - Sharp corners (no rounded borders)
              - Bold 2px black borders
              - Brand yellow (#ffbf23) for success
              - Font-weight 700 for bold text
              - Neo-brutalist shadow effect
              ===================================================================== */}
          <Toaster 
            position="bottom-right"
            duration={4000}
            visibleToasts={1}
            toastOptions={{
              className: 'z-[100]',
              style: {
                borderRadius: '0',
                border: '2px solid black',
                boxShadow: '4px 4px 0px 0px #000',
                fontWeight: 700,
                fontFamily: 'Inter, sans-serif',
              },
              classNames: {
                success: 'bg-[#ffbf23] text-black border-black',
                error: 'bg-red-500 text-white border-black',
                warning: 'bg-amber-400 text-black border-black',
                info: 'bg-blue-500 text-white border-black',
              },
            }}
          />
        </LanguageProvider>
      </body>
    </html>
  );
}
