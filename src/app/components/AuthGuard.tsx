'use client';

/**
 * =============================================================================
 * AuthGuard Component - NEO-BRUTALIST
 * =============================================================================
 * 
 * Updated: January 8th, 2026
 * 
 * NEO-BRUTALIST DESIGN UPDATE:
 * - Sharp edges (no rounded corners)
 * - Bold borders (border-2 to border-4 with black)
 * - Yellow accent color (#ffbf23)
 * - Square elements throughout
 * - Dark mode support
 * 
 * AuthGuard wraps authenticated pages and ensures:
 * 1. User is signed in (redirects to sign-in if not)
 * 2. User has completed onboarding (shows onboarding if not)
 * 
 * =============================================================================
 */

import { useUser } from '@stackframe/stack';
import { useRouter } from 'next/navigation';
import { useNeonUser } from '../hooks/useNeonUser';
import { OnboardingScreen } from './OnboardingScreen';
import { AuthLoadingScreen } from './AuthLoadingScreen';
import { useEffect } from 'react';

interface AuthGuardProps {
  children: React.ReactNode;
}

/**
 * PageSkeleton - NEO-BRUTALIST (Updated January 8th, 2026)
 * 
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
 * AuthGuard - Updated January 8th, 2026
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const stackUser = useUser();
  const { userId, isOnboarded, isLoading: neonLoading, userName, refetch } = useNeonUser();
  const router = useRouter();

  // Redirect to sign-in if not authenticated
  useEffect(() => {
    if (stackUser === null) {
      router.push('/sign-in');
    }
  }, [stackUser, router]);

  // Show loading state while Stack Auth or Neon is loading
  if (stackUser === undefined || neonLoading) {
    return <AuthLoadingScreen />;
  }

  // Not signed in - will redirect
  if (!stackUser) {
    return <AuthLoadingScreen />;
  }

  // Show onboarding for users who haven't completed it
  if (!isOnboarded && userId) {
    const userEmail = stackUser?.primaryEmail || '';
    
    return (
      <OnboardingScreen 
        userId={userId}
        userName={userName}
        userEmail={userEmail}
        onComplete={async () => {
          await refetch();
        }}
      />
    );
  }

  // Guard against race condition
  if (!userId) {
    return <AuthLoadingScreen />;
  }

  // User is authenticated and onboarded - show the page
  return <>{children}</>;
}
