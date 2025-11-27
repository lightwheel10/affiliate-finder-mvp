'use client';

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LoginScreen } from './LoginScreen';
import { LandingPage } from './landing/LandingPage';
import { OnboardingScreen } from './OnboardingScreen';
import { PricingScreen } from './PricingScreen';
import { Loader2 } from 'lucide-react';

export const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#FDFDFD]">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
        <p className="text-sm text-slate-500 font-medium">Loading workspace...</p>
      </div>
    );
  }

  if (!user) {
    if (showLogin) {
      return <LoginScreen />;
    }
    return <LandingPage onLoginClick={() => setShowLogin(true)} />;
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
