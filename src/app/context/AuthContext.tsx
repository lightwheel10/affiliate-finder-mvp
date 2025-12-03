'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export interface User {
  email: string;
  name: string;
  isOnboarded: boolean;
  hasSubscription: boolean;
  role?: string;
  brand?: string;
  plan: 'free_trial' | 'pro' | 'business' | 'enterprise';
  // Trial-specific fields
  trialPlan?: 'pro' | 'business'; // The plan user will convert to after trial
  trialStartDate?: string; // ISO date string
  trialEndDate?: string; // ISO date string
  bio?: string;
  billing?: {
    last4?: string;
    brand?: string;
    expiry?: string;
    invoices?: { id: string; date: string; amount: string; status: string }[];
  };
  notifications?: {
    emailMatches: boolean;
    emailReports: boolean;
    emailUpdates: boolean;
    appReplies: boolean;
    appReminders: boolean;
  };
}

// Helper function to calculate days remaining in trial
export function getTrialDaysRemaining(trialEndDate?: string): number {
  if (!trialEndDate) return 0;
  const end = new Date(trialEndDate);
  const now = new Date();
  const diffTime = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

// Helper function to check if trial has expired
export function isTrialExpired(trialEndDate?: string): boolean {
  if (!trialEndDate) return false;
  return new Date(trialEndDate) < new Date();
}

interface AuthContextType {
  user: User | null;
  login: (email: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  startFreeTrial: (selectedPlan: 'pro' | 'business') => Promise<void>;
  cancelTrial: () => Promise<void>;
  completeSubscription: (plan?: User['plan']) => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = () => {
      const storedUser = localStorage.getItem('affiliate_user');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        // Migrate old users to have a plan
        if (!parsedUser.plan) {
          parsedUser.plan = 'free_trial';
        }
        setUser(parsedUser);
      }
      setIsLoading(false);
    };
    checkAuth();
  }, []);

  const login = async (email: string, name?: string) => {
    setIsLoading(true);
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const isSignup = !!name;
    
    // For existing users (login), we assume they are onboarded and have a sub for this mock.
    // For new users (signup), they need onboarding and subscription.
    const isOnboarded = !isSignup; 
    const hasSubscription = !isSignup;

    const newUser: User = {
      email,
      name: name || email.split('@')[0],
      isOnboarded,
      hasSubscription,
      plan: 'free_trial',
      notifications: {
        emailMatches: true,
        emailReports: true,
        emailUpdates: true,
        appReplies: true,
        appReminders: true,
      }
    };
    
    setUser(newUser);
    localStorage.setItem('affiliate_user', JSON.stringify(newUser));
    setIsLoading(false);
  };

  const logout = async () => {
    setIsLoading(true);
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    setUser(null);
    localStorage.removeItem('affiliate_user');
    setIsLoading(false);
  };

  const updateProfile = async (data: Partial<User>) => {
    if (!user) return;
    
    const updatedUser = { ...user, ...data };
    setUser(updatedUser);
    localStorage.setItem('affiliate_user', JSON.stringify(updatedUser));
  };

  // Start a 7-day free trial with the selected plan
  const startFreeTrial = async (selectedPlan: 'pro' | 'business') => {
    if (!user) return;
    
    const now = new Date();
    const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    
    await updateProfile({
      hasSubscription: true, // Allow access to dashboard
      plan: 'free_trial',
      trialPlan: selectedPlan,
      trialStartDate: now.toISOString(),
      trialEndDate: trialEnd.toISOString(),
      // No billing info yet - user hasn't been charged
    });
  };

  // Cancel the trial - user will lose access
  const cancelTrial = async () => {
    if (!user) return;
    
    await updateProfile({
      hasSubscription: false,
      plan: 'free_trial',
      trialPlan: undefined,
      trialStartDate: undefined,
      trialEndDate: undefined,
    });
  };

  // Convert trial to paid subscription (called when user upgrades or trial ends and they pay)
  const completeSubscription = async (plan: User['plan'] = 'pro') => {
    if (!user) return;
    
    // Add billing info when converting to paid plan
    const billingUpdate = plan !== 'free_trial' ? {
      billing: {
        last4: '4242',
        brand: 'Visa',
        expiry: '12/2028',
        invoices: [
          { id: `INV-${Date.now()}`, date: new Date().toLocaleDateString(), amount: plan === 'business' ? '$249.00' : '$99.00', status: 'Paid' }
        ]
      },
      // Clear trial fields when converting to paid
      trialPlan: undefined,
      trialStartDate: undefined,
      trialEndDate: undefined,
    } : {};

    await updateProfile({ hasSubscription: true, plan, ...billingUpdate });
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateProfile, startFreeTrial, cancelTrial, completeSubscription, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
