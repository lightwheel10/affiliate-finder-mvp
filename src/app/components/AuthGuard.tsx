'use client';

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LoginScreen } from './LoginScreen';
import { LandingPage } from './landing/LandingPage';
import { OnboardingScreen } from './OnboardingScreen';
import { PricingScreen } from './PricingScreen';
import { Loader2 } from 'lucide-react';

type AuthScreen = 'landing' | 'signin' | 'signup';

export const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  const [authScreen, setAuthScreen] = useState<AuthScreen>('landing');

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#FDFDFD]">
        <Loader2 className="w-8 h-8 text-[#D4E815] animate-spin mb-4" />
        <p className="text-sm text-slate-500 font-medium">Loading workspace...</p>
      </div>
    );
  }

  if (!user) {
    if (authScreen === 'signin') {
      return (
        <LoginScreen 
          initialView="signin" 
          onBackToHome={() => setAuthScreen('landing')} 
        />
      );
    }
    if (authScreen === 'signup') {
      return (
        <LoginScreen 
          initialView="signup" 
          onBackToHome={() => setAuthScreen('landing')} 
        />
      );
    }
    return (
      <LandingPage 
        onLoginClick={() => setAuthScreen('signin')} 
        onSignupClick={() => setAuthScreen('signup')} 
      />
    );
  }

  if (!user.isOnboarded) {
    return <OnboardingScreen />;
  }

  // New Check: Subscription
  if (!user.hasSubscription) {
    return <PricingScreen />;
  }

  return <>{children}</>;
};
