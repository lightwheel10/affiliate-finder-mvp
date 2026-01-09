'use client';

/**
 * =============================================================================
 * SIGN UP PAGE - NEO-BRUTALIST (Updated January 9th, 2026)
 * 
 * Design changes applied:
 * - Sharp edges on loading spinner (removed rounded-full)
 * - Updated background color for dark mode support
 * - Neo-brutalist back button styling
 * - Brand yellow (#ffbf23) accent color
 * 
 * Note: The SignUp component itself is styled via StackTheme in layout.tsx
 * with primary color #ffbf23 and radius: '0' for sharp edges
 * =============================================================================
 */

import { SignUp, useUser } from "@stackframe/stack";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function SignUpPage() {
  const user = useUser();
  const router = useRouter();

  // Auto-redirect to home if already signed in
  useEffect(() => {
    if (user) {
      router.replace('/');
    }
  }, [user, router]);

  // Show loading while checking auth or redirecting - NEO-BRUTALIST (January 9th, 2026)
  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0a0a0a]">
        <div className="w-8 h-8 border-2 border-[#ffbf23] border-t-transparent animate-spin"></div>
      </div>
    );
  }

  // Show sign-up form for unauthenticated users - NEO-BRUTALIST (January 9th, 2026)
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-[#0a0a0a]">
      {/* Header with logo - NEO-BRUTALIST (January 9th, 2026) */}
      <div className="w-full max-w-md px-4 mb-6">
        <div className="flex items-center justify-between">
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 text-sm font-bold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors border-2 border-transparent hover:border-gray-300 dark:hover:border-gray-700 px-3 py-1.5"
          >
            <ArrowLeft size={16} />
            Back to Home
          </Link>
          
          {/* Logo - NEO-BRUTALIST (January 9th, 2026) */}
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 bg-[#1A1D21] flex items-center justify-center text-[#ffbf23] border border-black dark:border-gray-600">
              <Sparkles size={10} fill="currentColor" className="opacity-90" />
            </div>
            <span className="font-black text-sm tracking-tight text-gray-900 dark:text-white">
              CrewCast<span className="text-[#1A1D21] dark:text-[#ffbf23]">Studio</span>
            </span>
          </div>
        </div>
      </div>
      
      <SignUp automaticRedirect={true} />
    </div>
  );
}
