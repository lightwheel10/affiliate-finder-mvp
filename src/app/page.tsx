'use client';

/**
 * =============================================================================
 * LANDING PAGE / AUTH ROUTER
 * =============================================================================
 * 
 * Created: January 3rd, 2026
 * Updated: January 19th, 2026 - Migrated from Stack Auth to Supabase Auth
 * 
 * This page handles the root URL (/) and serves two purposes:
 * 
 * 1. LANDING PAGE - For unauthenticated visitors
 *    Shows the marketing landing page with sign-up/login CTAs
 * 
 * 2. AUTH ROUTER - For authenticated users
 *    Redirects to /find (the "Find New Affiliates" dashboard page)
 * 
 * WHY THIS ARCHITECTURE:
 * ----------------------
 * Previously, this file contained both the landing page AND the full
 * Dashboard component (~1600 lines). This caused issues:
 * 
 *   1. The Sidebar was duplicated here AND in other dashboard pages
 *   2. When navigating to/from "/" to other dashboard pages, the Sidebar
 *      would remount, causing skeleton flashes
 *   3. The auth state machine was complex and hard to maintain
 * 
 * The new architecture (January 3rd, 2026):
 *   - This file: Landing page + redirect logic only
 *   - /find: Dashboard "Find New Affiliates" page (in (dashboard) route group)
 *   - All dashboard pages share a layout with persistent Sidebar
 * 
 * AUTH STATE MACHINE (Updated January 19th, 2026 for Supabase):
 * -------------------------------------------------------------
 * 1. isLoading === true → Loading (Supabase Auth checking session)
 * 2. supabaseUser === null → Not authenticated → Show Landing Page
 * 3. supabaseUser exists + isLoading → Loading (fetching/creating DB user)
 * 4. supabaseUser exists + dbUser exists + !isOnboarded → Show Onboarding
 * 5. supabaseUser exists + dbUser exists + isOnboarded → Redirect to /find
 * 
 * =============================================================================
 */

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { LandingPage } from './components/landing/LandingPage';
import { OnboardingScreen } from './components/OnboardingScreen';
// LoadingOnboardingScreen removed - January 3rd, 2026
// Previously showed "Setting up your workspace!" for 2 seconds after onboarding.
// This caused a double loading screen issue. Now we go directly to dashboard.
import { AuthLoadingScreen } from './components/AuthLoadingScreen';

// =============================================================================
// SUPABASE AUTH HOOK (January 19th, 2026)
// Replaces: import { useUser } from '@stackframe/stack';
// Replaces: import { useNeonUser } from './hooks/useNeonUser';
// 
// useSupabaseUser combines both Stack Auth state AND database user fetching
// into a single hook, simplifying the auth state machine.
// =============================================================================
import { useSupabaseUser } from './hooks/useSupabaseUser';

export default function Home() {
  // ===========================================================================
  // SUPABASE AUTH STATE (January 19th, 2026)
  // 
  // Previously we had two separate hooks:
  //   const stackUser = useUser();           // Stack Auth state
  //   const { ... } = useNeonUser();         // Database user state
  // 
  // Now useSupabaseUser provides everything in one hook:
  //   - supabaseUser: The Supabase auth user (replaces stackUser)
  //   - isLoading: Combined loading state for auth + database
  //   - All the same database user fields (userId, isOnboarded, etc.)
  // ===========================================================================
  const { 
    supabaseUser,  // Replaces stackUser from @stackframe/stack
    userId, 
    isOnboarded, 
    onboardingStep,
    isLoading,     // Combined loading state (replaces neonLoading)
    userName, 
    user,
    refetch 
  } = useSupabaseUser();
  const router = useRouter();
  // showLoadingScreen state removed - January 3rd, 2026
  // We no longer show LoadingOnboardingScreen after onboarding completion.
  const [hasRedirected, setHasRedirected] = useState(false);

  // ==========================================================================
  // SKIP AUTO-REDIRECT FLAG - January 15th, 2026
  // 
  // This ref prevents a race condition during onboarding completion:
  // 
  // PROBLEM: After onboarding, we want to send the user to /discovered.
  // But the useEffect below also watches for onboarded users and redirects
  // them to /find. Both fire at the same time, causing the user to briefly
  // see /discovered then get bounced to /find.
  // 
  // SOLUTION: Set this ref to true in onComplete() BEFORE refetch/navigation.
  // The useEffect checks this flag and skips the auto-redirect if set.
  // 
  // WHY A REF: Refs update instantly (synchronously), unlike state which
  // batches updates. This ensures the flag is set before the useEffect runs.
  // ==========================================================================
  const skipAutoRedirect = useRef(false);

  // ============================================================================
  // REDIRECT EFFECT - January 3rd, 2026
  // Updated: January 15th, 2026 - Added skipAutoRedirect check
  // Updated: January 19th, 2026 - Changed stackUser to supabaseUser
  // 
  // When an authenticated and onboarded user lands on "/", redirect them to
  // "/find" where the actual dashboard is. This keeps the landing page clean
  // and allows the (dashboard) route group to handle all authenticated pages.
  // 
  // IMPORTANT: We check skipAutoRedirect.current to avoid redirecting users
  // who just completed onboarding - they should go to /discovered instead.
  // ============================================================================
  useEffect(() => {
    if (supabaseUser && !isLoading && isOnboarded && userId && !hasRedirected && !skipAutoRedirect.current) {
      setHasRedirected(true);
      router.replace('/find');
    }
  }, [supabaseUser, isLoading, isOnboarded, userId, hasRedirected, router]);

  // ============================================
  // CASE 1: Auth is still loading
  // Updated: January 19th, 2026 - Supabase Auth
  // 
  // Shows a neutral AuthLoadingScreen that works for all users.
  // ============================================
  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  // ============================================
  // CASE 2: Not authenticated → Landing Page
  // Updated: January 19th, 2026 - Changed stackUser to supabaseUser
  // ============================================
  if (!supabaseUser) {
    return (
      <LandingPage 
        onLoginClick={() => router.push('/sign-in')}
        onSignupClick={() => router.push('/sign-up')}
      />
    );
  }

  // ============================================
  // CASE 3: Not onboarded → Show Onboarding
  // Resume from saved step with pre-filled data
  // 
  // January 3rd, 2026: Removed the old LoadingOnboardingScreen ("Setting up
  // your workspace!") that used to show for 2 seconds after onboarding.
  // Now we go directly to the dashboard after refetch.
  // 
  // Updated: January 19th, 2026 - Changed stackUser?.primaryEmail to supabaseUser?.email
  // ============================================
  if (!isOnboarded && userId) {
    const userEmail = supabaseUser?.email || '';
    
    return (
      <OnboardingScreen 
        userId={userId}
        userName={userName}
        userEmail={userEmail}
        initialStep={onboardingStep || 1}
        userData={user ? {
          name: user.name,
          role: user.role || undefined,
          brand: user.brand || undefined,
          targetCountry: user.target_country || undefined,
          targetLanguage: user.target_language || undefined,
          competitors: user.competitors || undefined,
          topics: user.topics || undefined,
          affiliateTypes: user.affiliate_types || undefined,
        } : undefined}
        onComplete={async () => {
          // ==========================================================================
          // ONBOARDING COMPLETION CALLBACK - January 15th, 2026
          // 
          // After payment and affiliate pre-fetch complete:
          // 1. Set skipAutoRedirect flag to prevent useEffect from redirecting to /find
          // 2. Refetch user data to update cache with is_onboarded: true
          // 3. Navigate to /discovered (not /find!)
          // 
          // WHY /discovered INSTEAD OF /find:
          // During onboarding, we pre-fetch affiliate results and save them to
          // discovered_affiliates table. The user should land on the /discovered
          // page where they can see their results immediately.
          // 
          // If we sent them to /find, they'd see an empty search form and think
          // "ok, we found nothing" - which is confusing since we just searched.
          // 
          // Updated: January 15th, 2026 - Changed from /find to /discovered
          // Updated: January 15th, 2026 - Added skipAutoRedirect to fix race condition
          // ==========================================================================
          skipAutoRedirect.current = true; // Block the auto-redirect useEffect
          await refetch();
          router.replace('/discovered');
        }}
      />
    );
  }

  // ============================================
  // CASE 5: Guard against race condition
  // 
  // If userId is null (API error, race condition, or state update delay),
  // show loading instead of falling through.
  // ============================================
  if (!userId) {
    return <AuthLoadingScreen />;
  }

  // ============================================
  // CASE 6: Authenticated + Onboarded → Redirect to /find
  // 
  // January 3rd, 2026: Instead of showing Dashboard here, we redirect
  // to /find which is part of the (dashboard) route group and shares
  // the persistent Sidebar layout.
  // 
  // The useEffect above handles the redirect, but we need to show
  // something while the redirect is happening.
  // ============================================
  return <AuthLoadingScreen />;
}
