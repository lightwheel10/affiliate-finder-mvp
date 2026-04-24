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
