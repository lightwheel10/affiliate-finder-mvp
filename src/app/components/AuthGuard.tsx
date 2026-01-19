/**
 * =============================================================================
 * AuthGuard Component - SUPABASE AUTH
 * =============================================================================
 * 
 * Created: January 8th, 2026 (Original Stack Auth version)
 * Updated: January 19th, 2026 - Migrated to Supabase Auth
 * 
 * WHAT CHANGED:
 * -------------
 * - Replaced useUser() from @stackframe/stack with useSupabaseUser()
 * - Same logic and flow preserved
 * - Neo-brutalist design unchanged
 * 
 * WHAT THIS COMPONENT DOES:
 * -------------------------
 * AuthGuard wraps authenticated pages and ensures:
 * 1. User is signed in (redirects to sign-in if not)
 * 2. User has completed onboarding (shows OnboardingScreen if not)
 * 3. Only shows the actual page content when fully authenticated and onboarded
 * 
 * WHY THIS PATTERN:
 * -----------------
 * - Centralizes auth logic (don't repeat in every page)
 * - Handles loading states consistently
 * - Prevents flash of unauthenticated content
 * - Protects dashboard from unonboarded users
 * 
 * FLOW:
 * -----
 * 1. User navigates to protected page (e.g., /find)
 * 2. AuthGuard checks if user is authenticated
 *    - No → Redirect to /sign-in
 * 3. AuthGuard checks if user is onboarded
 *    - No → Show OnboardingScreen
 * 4. User is authenticated AND onboarded → Show page content
 * 
 * SECURITY NOTE:
 * --------------
 * AuthGuard is a client-side check. For true security, API routes
 * should also verify authentication using getAuthenticatedUser().
 * AuthGuard is for UX (preventing accidental access), not security.
 * 
 * =============================================================================
 */

'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// ============================================================================
// SUPABASE AUTH HOOK (January 19th, 2026)
// Replaces: import { useUser } from '@stackframe/stack';
// ============================================================================
import { useSupabaseUser } from '../hooks/useSupabaseUser';

import { OnboardingScreen } from './OnboardingScreen';
import { AuthLoadingScreen } from './AuthLoadingScreen';

interface AuthGuardProps {
  children: React.ReactNode;
}

/**
 * PageSkeleton - NEO-BRUTALIST
 * 
 * Shows while waiting for auth state to resolve.
 * Matches the neo-brutalist layout with sidebar.
 * Width updated from w-52 to w-64 to match actual Sidebar.
 */
const PageSkeleton = () => (
  <div className="flex min-h-screen bg-gray-100 dark:bg-black font-sans">
    {/* Sidebar Skeleton - NEO-BRUTALIST (Width w-64 = 256px) */}
    <aside className="min-h-screen w-64 bg-white dark:bg-[#0a0a0a] border-r-4 border-black dark:border-gray-700 flex flex-col fixed left-0 top-0 bottom-0 z-40">
      {/* Brand / Logo Area */}
      <div className="h-16 flex items-center px-6 border-b-4 border-black dark:border-gray-700">
        <div className="flex items-center gap-2.5 text-gray-900 dark:text-white">
          <img 
            src="/logo.jpg" 
            alt="CrewCast Studio" 
            className="w-8 h-8 border-2 border-black dark:border-gray-600 shrink-0 object-cover"
          />
          <div className="flex flex-col">
            <span className="font-black text-sm tracking-tight leading-none uppercase">CrewCast <span className="text-black dark:text-white">Studio</span></span>
            <span className="text-[9px] font-bold text-gray-400 tracking-widest mt-0.5 uppercase">backed by selecdoo AI</span>
          </div>
        </div>
      </div>

      {/* Navigation Skeleton - NEO-BRUTALIST */}
      <nav className="flex-1 space-y-6 overflow-y-auto py-4 px-3 animate-pulse">
        <div>
          <div className="h-2.5 w-16 bg-gray-200 dark:bg-gray-700 mb-3 ml-2"></div>
          <div className="space-y-1">
            <div className="h-10 bg-gray-100 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700"></div>
            <div className="h-10 bg-gray-100 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700"></div>
          </div>
        </div>
        <div>
          <div className="h-2.5 w-20 bg-gray-200 dark:bg-gray-700 mb-3 ml-2"></div>
          <div className="space-y-1">
            <div className="h-10 bg-gray-100 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700"></div>
            <div className="h-10 bg-gray-100 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700"></div>
          </div>
        </div>
      </nav>

      {/* Bottom Section Skeleton - NEO-BRUTALIST */}
      <div className="p-3 space-y-3 bg-gray-50 dark:bg-gray-900 animate-pulse border-t-4 border-black dark:border-gray-700">
        <div className="bg-gray-100 dark:bg-gray-800 p-3.5 border-2 border-gray-200 dark:border-gray-700">
          <div className="space-y-2">
            <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700"></div>
            <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700"></div>
            <div className="h-3 w-full bg-gray-200 dark:bg-gray-700"></div>
            <div className="h-8 w-full bg-[#ffbf23]/30 border-2 border-gray-200 dark:border-gray-700 mt-2"></div>
          </div>
        </div>
        <div className="border-t-2 border-gray-200 dark:border-gray-700"></div>
        <div className="flex items-center gap-2.5 p-2">
          <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600"></div>
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700"></div>
            <div className="h-2.5 w-32 bg-gray-200 dark:bg-gray-700"></div>
          </div>
          <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700"></div>
        </div>
      </div>
    </aside>

    {/* Main Content Skeleton - NEO-BRUTALIST */}
    <main className="flex-1 flex flex-col min-h-screen ml-64">
      {/* Header Skeleton - NEO-BRUTALIST (h-16 with border-b-4) */}
      <header className="h-16 px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30 bg-white dark:bg-[#0a0a0a] border-b-4 border-black dark:border-gray-700">
        <div className="animate-pulse">
          <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700"></div>
        </div>
      </header>

      {/* Content Skeleton - NEO-BRUTALIST */}
      <div className="flex-1 px-6 lg:px-8 py-6 max-w-[1600px] mx-auto w-full animate-pulse">
        <div className="space-y-6">
          {/* Content blocks */}
          <div className="bg-white dark:bg-[#0f0f0f] border-4 border-black dark:border-gray-600 p-6 space-y-4">
            <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700"></div>
            <div className="h-4 w-64 bg-gray-100 dark:bg-gray-800"></div>
            <div className="space-y-3 pt-4">
              <div className="h-12 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700"></div>
              <div className="h-12 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700"></div>
              <div className="h-12 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700"></div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
);

/**
 * AuthGuard Component
 * 
 * Updated: January 19th, 2026 - Migrated from Stack Auth to Supabase Auth
 * 
 * Changes:
 * - Replaced useUser() from @stackframe/stack with useSupabaseUser()
 * - supabaseUser replaces stackUser for auth state
 * - Same onboarding and redirect logic preserved
 */
export function AuthGuard({ children }: AuthGuardProps) {
  // ===========================================================================
  // SUPABASE AUTH STATE (January 19th, 2026)
  // 
  // useSupabaseUser() provides:
  // - supabaseUser: The Supabase auth user (null if not logged in)
  // - userId: Database user ID
  // - isOnboarded: Whether user completed onboarding
  // - isLoading: True while checking auth state
  // - userName: Display name
  // - refetch: Function to refresh user data
  // ===========================================================================
  const { 
    supabaseUser, 
    userId, 
    isOnboarded, 
    isLoading, 
    userName,
    user,
    refetch 
  } = useSupabaseUser();
  
  const router = useRouter();

  // ===========================================================================
  // REDIRECT TO SIGN-IN IF NOT AUTHENTICATED
  // ===========================================================================
  useEffect(() => {
    // Wait for auth state to resolve
    if (isLoading) return;
    
    // Not authenticated → redirect to sign-in
    if (!supabaseUser) {
      router.push('/sign-in');
    }
  }, [supabaseUser, isLoading, router]);

  // ===========================================================================
  // LOADING STATE
  // Show loading screen while checking auth or fetching user data
  // ===========================================================================
  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  // ===========================================================================
  // NOT AUTHENTICATED
  // Will redirect to sign-in (handled by useEffect above)
  // Show loading screen while redirecting
  // ===========================================================================
  if (!supabaseUser) {
    return <AuthLoadingScreen />;
  }

  // ===========================================================================
  // ONBOARDING CHECK
  // User is authenticated but hasn't completed onboarding
  // Show the onboarding flow instead of the page content
  // ===========================================================================
  if (!isOnboarded && userId) {
    const userEmail = supabaseUser?.email || '';
    
    return (
      <OnboardingScreen 
        userId={userId}
        userName={userName}
        userEmail={userEmail}
        onComplete={async () => {
          // Refetch user data after onboarding completes
          // This updates isOnboarded and allows access to dashboard
          await refetch();
        }}
      />
    );
  }

  // ===========================================================================
  // GUARD AGAINST RACE CONDITION
  // User is authenticated but database user not yet created
  // ===========================================================================
  if (!userId) {
    return <AuthLoadingScreen />;
  }

  // ===========================================================================
  // AUTHENTICATED AND ONBOARDED
  // User passed all checks - render the protected page content
  // ===========================================================================
  return <>{children}</>;
}
