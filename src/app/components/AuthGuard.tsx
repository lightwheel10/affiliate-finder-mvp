'use client';

import { useUser } from '@stackframe/stack';
import { useRouter } from 'next/navigation';
import { useNeonUser } from '../hooks/useNeonUser';
import { OnboardingScreen } from './OnboardingScreen';
import { LoadingOnboardingScreen } from './LoadingOnboardingScreen';
import { useState, useEffect } from 'react';

interface AuthGuardProps {
  children: React.ReactNode;
}

// Page skeleton that matches the general layout with sidebar
const PageSkeleton = () => (
  <div className="flex min-h-screen bg-[#FDFDFD] font-sans">
    {/* Sidebar Skeleton */}
    <aside className="min-h-screen w-60 bg-white/80 backdrop-blur-xl border-r border-slate-200/60 flex flex-col fixed left-0 top-0 bottom-0 z-40">
      {/* Brand / Logo Area */}
      <div className="h-14 flex items-center mt-1 mb-6 px-4">
        <div className="flex items-center gap-2.5 text-slate-900">
          <img 
            src="/logo.jpg" 
            alt="CrewCast Studio" 
            className="w-7 h-7 rounded-lg shadow-md shadow-[#1A1D21]/10 shrink-0 object-cover"
          />
          <div className="flex flex-col">
            <span className="font-bold text-sm tracking-tight leading-none">CrewCast <span className="text-[#1A1D21]">Studio</span></span>
            <span className="text-[9px] font-medium text-slate-400 tracking-wide mt-0.5">backed by selecdoo AI</span>
          </div>
        </div>
      </div>

      {/* Navigation Skeleton */}
      <nav className="flex-1 space-y-6 overflow-y-auto py-1 px-3 animate-pulse">
        <div>
          <div className="h-2.5 w-16 bg-slate-200 rounded mb-3 ml-2"></div>
          <div className="space-y-1">
            <div className="h-9 bg-slate-100 rounded-lg"></div>
            <div className="h-9 bg-slate-100 rounded-lg"></div>
          </div>
        </div>
        <div>
          <div className="h-2.5 w-20 bg-slate-200 rounded mb-3 ml-2"></div>
          <div className="space-y-1">
            <div className="h-9 bg-slate-100 rounded-lg"></div>
            <div className="h-9 bg-slate-100 rounded-lg"></div>
          </div>
        </div>
      </nav>

      {/* Bottom Section Skeleton */}
      <div className="p-3 space-y-3 bg-white/50 animate-pulse">
        <div className="bg-slate-100 rounded-xl p-3.5">
          <div className="space-y-2">
            <div className="h-3 w-20 bg-slate-200 rounded"></div>
            <div className="h-4 w-32 bg-slate-200 rounded"></div>
            <div className="h-3 w-full bg-slate-200 rounded"></div>
            <div className="h-8 w-full bg-slate-200 rounded-lg mt-2"></div>
          </div>
        </div>
        <div className="border-t border-slate-100"></div>
        <div className="flex items-center gap-2.5 p-2">
          <div className="w-7 h-7 bg-slate-200 rounded-full"></div>
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-20 bg-slate-200 rounded"></div>
            <div className="h-2.5 w-32 bg-slate-200 rounded"></div>
          </div>
          <div className="w-4 h-4 bg-slate-200 rounded"></div>
        </div>
      </div>
    </aside>

    {/* Main Content Skeleton */}
    <main className="flex-1 flex flex-col min-h-screen ml-52">
      {/* Header Skeleton */}
      <header className="h-14 px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-100">
        <div className="animate-pulse">
          <div className="h-5 w-32 bg-slate-200 rounded"></div>
        </div>
      </header>

      {/* Content Skeleton */}
      <div className="flex-1 px-6 lg:px-8 py-6 max-w-[1600px] mx-auto w-full animate-pulse">
        <div className="space-y-6">
          {/* Content blocks */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="h-6 w-48 bg-slate-200 rounded"></div>
            <div className="h-4 w-64 bg-slate-100 rounded"></div>
            <div className="space-y-3 pt-4">
              <div className="h-12 bg-slate-50 rounded-lg"></div>
              <div className="h-12 bg-slate-50 rounded-lg"></div>
              <div className="h-12 bg-slate-50 rounded-lg"></div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
);

/**
 * AuthGuard wraps authenticated pages and ensures:
 * 1. User is signed in (redirects to sign-in if not)
 * 2. User has completed onboarding (shows onboarding if not)
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const stackUser = useUser();
  const { userId, isOnboarded, isLoading: neonLoading, userName } = useNeonUser();
  const router = useRouter();
  const [showLoadingScreen, setShowLoadingScreen] = useState(false);

  // Debug logging
  useEffect(() => {
    console.log('AuthGuard State:', { 
      stackUser: !!stackUser, 
      neonLoading, 
      userId, 
      isOnboarded,
      userName 
    });
  }, [stackUser, neonLoading, userId, isOnboarded, userName]);

  // Redirect to sign-in if not authenticated
  useEffect(() => {
    // stackUser is undefined while loading, null if not signed in
    if (stackUser === null) {
      router.push('/sign-in');
    }
  }, [stackUser, router]);

  // Show loading state while Stack Auth or Neon is loading
  if (stackUser === undefined || neonLoading) {
    return <PageSkeleton />;
  }

  // Not signed in - will redirect
  if (!stackUser) {
    return <PageSkeleton />;
  }

  // Show loading screen after onboarding completion
  if (showLoadingScreen) {
    return <LoadingOnboardingScreen />;
  }

  // Show onboarding for users who haven't completed it
  if (!isOnboarded && userId) {
    return (
      <OnboardingScreen 
        userId={userId}
        userName={userName}
        onComplete={() => {
          setShowLoadingScreen(true);
          // Show loading screen for 2 seconds, then show dashboard
          setTimeout(() => {
            setShowLoadingScreen(false);
          }, 2000);
        }}
      />
    );
  }

  // User is authenticated and onboarded - show the page
  return <>{children}</>;
}
