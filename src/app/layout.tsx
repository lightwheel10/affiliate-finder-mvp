import type { Metadata } from "next";
import { StackProvider, StackTheme } from "@stackframe/stack";
import { stackClientApp } from "../stack/client";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CrewCast Studio | backed by selecdoo AI",
  description: "Find the best affiliates for your campaign - backed by selecdoo AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <StackProvider app={stackClientApp}>
          <StackTheme>
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
