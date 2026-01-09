import type { Metadata } from "next";
import { StackProvider, StackTheme } from "@stackframe/stack";
import { stackClientApp } from "../stack/client";
import { Inter, Fira_Code } from "next/font/google";
import "./globals.css";

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

/* OLD_DESIGN_START - Geist fonts (pre-January 6th, 2026)
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
OLD_DESIGN_END */

export const metadata: Metadata = {
  title: "CrewCast Studio | backed by selecdoo AI",
  description: "Find the best affiliates for your campaign - backed by selecdoo AI",
};

// =============================================================================
// STACK AUTH THEME CONFIGURATION - NEO-BRUTALIST (January 9th, 2026)
//
// Customizes the Stack Auth SignIn/SignUp components to match our design:
// - Primary color: Brand yellow (#ffbf23)
// - Radius: 0 for sharp neo-brutalist edges
// - Works for both light and dark modes
// =============================================================================
const stackAuthTheme = {
  light: {
    primary: '#ffbf23',
  },
  dark: {
    primary: '#ffbf23',
  },
  radius: '0',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* Updated January 6th, 2026: Inter + Fira Code for neo-brutalist design */}
      <body className={`${inter.variable} ${firaCode.variable} font-sans antialiased`}>
        <StackProvider app={stackClientApp}>
          {/* Updated January 9th, 2026: Added theme prop for neo-brutalist styling */}
          <StackTheme theme={stackAuthTheme}>
            {children}
          </StackTheme>
        </StackProvider>
        
        {/* =====================================================================
            GLOBAL TOAST CONTAINER (January 5th, 2026)
            
            Configuration:
            - position: bottom-right (consistent with previous Outreach page toasts)
            - richColors: true (styled success=green, error=red, warning=yellow, info=blue)
            - closeButton: removed (toasts auto-dismiss, no need for manual close)
            - duration: 4000ms (auto-dismiss after 4 seconds)
            - toastOptions.className: ensures proper z-index above modals
            
            To trigger toasts from anywhere in the app:
              import { toast } from 'sonner';
              toast.success('Success message');
              toast.error('Error message');
              toast.warning('Warning message');
              toast.info('Info message');
            ===================================================================== */}
        <Toaster 
          position="bottom-right"
          richColors
          duration={4000}
          toastOptions={{
            className: 'z-[100]',
          }}
        />
      </body>
    </html>
  );
}
