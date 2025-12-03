'use client';

import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useConvexUser } from '../hooks/useConvexUser';
import { OnboardingScreen } from './OnboardingScreen';
import { LoadingOnboardingScreen } from './LoadingOnboardingScreen';
import { useState, useEffect } from 'react';

interface AuthGuardProps {
  children: React.ReactNode;
}

/**
 * AuthGuard wraps authenticated pages and ensures:
 * 1. User is signed in (redirects to sign-in if not)
 * 2. User has completed onboarding (shows onboarding if not)
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const { isSignedIn, isLoaded } = useUser();
  const { userId, isOnboarded, isLoading: convexLoading, userName } = useConvexUser();
  const router = useRouter();
  const [showLoadingScreen, setShowLoadingScreen] = useState(false);

  // Debug logging
  useEffect(() => {
    console.log('AuthGuard State:', { 
      isSignedIn, 
      isLoaded, 
      convexLoading, 
      userId: userId?.toString(), 
      isOnboarded,
      userName 
    });
  }, [isSignedIn, isLoaded, convexLoading, userId, isOnboarded, userName]);

  // Redirect to sign-in if not authenticated
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/sign-in');
    }
  }, [isLoaded, isSignedIn, router]);

  // Show loading state while Clerk or Convex is loading
  if (!isLoaded || convexLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-[#D4E815] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Not signed in - will redirect
  if (!isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-[#D4E815] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
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

