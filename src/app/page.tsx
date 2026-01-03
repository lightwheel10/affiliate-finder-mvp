'use client';

/**
 * =============================================================================
 * LANDING PAGE / AUTH ROUTER - January 3rd, 2026
 * =============================================================================
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
 * AUTH STATE MACHINE:
 * -------------------
 * 1. stackUser === undefined → Loading (Stack Auth checking session)
 * 2. stackUser === null → Not authenticated → Show Landing Page
 * 3. stackUser exists + neonLoading → Loading (fetching/creating Neon user)
 * 4. stackUser exists + neonUser exists + !isOnboarded → Show Onboarding
 * 5. stackUser exists + neonUser exists + isOnboarded → Redirect to /find
 * 
 * =============================================================================
 */

import { useState, useEffect } from 'react';
import { useUser } from '@stackframe/stack';
import { useRouter } from 'next/navigation';
import { LandingPage } from './components/landing/LandingPage';
import { OnboardingScreen } from './components/OnboardingScreen';
// LoadingOnboardingScreen removed - January 3rd, 2026
// Previously showed "Setting up your workspace!" for 2 seconds after onboarding.
// This caused a double loading screen issue. Now we go directly to dashboard.
import { AuthLoadingScreen } from './components/AuthLoadingScreen';
import { useNeonUser } from './hooks/useNeonUser';

export default function Home() {
  const stackUser = useUser();
  const { 
    userId, 
    isOnboarded, 
    onboardingStep,
    isLoading: neonLoading, 
    userName, 
    user,
    refetch 
  } = useNeonUser();
  const router = useRouter();
  // showLoadingScreen state removed - January 3rd, 2026
  // We no longer show LoadingOnboardingScreen after onboarding completion.
  const [hasRedirected, setHasRedirected] = useState(false);

  // ============================================================================
  // REDIRECT EFFECT - January 3rd, 2026
  // 
  // When an authenticated and onboarded user lands on "/", redirect them to
  // "/find" where the actual dashboard is. This keeps the landing page clean
  // and allows the (dashboard) route group to handle all authenticated pages.
  // ============================================================================
  useEffect(() => {
    if (stackUser && !neonLoading && isOnboarded && userId && !hasRedirected) {
      setHasRedirected(true);
      router.replace('/find');
    }
  }, [stackUser, neonLoading, isOnboarded, userId, hasRedirected, router]);

  // ============================================
  // CASE 1: Stack Auth is still loading
  // 
  // Shows a neutral AuthLoadingScreen that works for all users.
  // ============================================
  if (stackUser === undefined) {
    return <AuthLoadingScreen />;
  }

  // ============================================
  // CASE 2: Not authenticated → Landing Page
  // ============================================
  if (!stackUser) {
    return (
      <LandingPage 
        onLoginClick={() => router.push('/sign-in')}
        onSignupClick={() => router.push('/sign-up')}
      />
    );
  }

  // ============================================
  // CASE 3: Authenticated but Neon user loading
  // 
  // Shows AuthLoadingScreen while fetching/creating user.
  // ============================================
  if (neonLoading) {
    return <AuthLoadingScreen />;
  }

  // ============================================
  // CASE 4: Not onboarded → Show Onboarding
  // Resume from saved step with pre-filled data
  // 
  // January 3rd, 2026: Removed the old LoadingOnboardingScreen ("Setting up
  // your workspace!") that used to show for 2 seconds after onboarding.
  // Now we go directly to the dashboard after refetch.
  // ============================================
  if (!isOnboarded && userId) {
    const userEmail = stackUser?.primaryEmail || '';
    
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
          // ONBOARDING COMPLETION CALLBACK - January 3rd, 2026
          // 
          // After card verification completes successfully, we:
          // 1. Refetch user data to update cache with is_onboarded: true
          // 2. Navigate directly to /find (dashboard)
          // 
          // BUG FIX: Previously we showed LoadingOnboardingScreen ("Setting up 
          // your workspace!") for 2 seconds before navigating. This was the
          // OLD loading screen that caused a confusing double-loading UX:
          //   LoadingOnboardingScreen → AuthLoadingScreen → Dashboard
          // 
          // THE FIX: Skip LoadingOnboardingScreen entirely. Just refetch and
          // navigate. The AuthLoadingScreen will show briefly during navigation
          // (via loading.tsx), giving users a single, clean loading experience:
          //   AuthLoadingScreen → Dashboard
          // ==========================================================================
          await refetch();
          router.replace('/find');
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
