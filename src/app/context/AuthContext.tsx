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

interface AuthContextType {
  user: User | null;
  login: (email: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
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

  const completeSubscription = async (plan: User['plan'] = 'pro') => {
    if (!user) return;
    
    // Update plan and add mock billing info if upgrading from free trial
    const billingUpdate = plan !== 'free_trial' && !user.billing?.last4 ? {
      billing: {
        last4: '4242',
        brand: 'Visa',
        expiry: '12/2028',
        invoices: [
          { id: '2024001', date: new Date().toLocaleDateString(), amount: plan === 'business' ? '$249.00' : '$99.00', status: 'Paid' }
        ]
      }
    } : {};

    await updateProfile({ hasSubscription: true, plan, ...billingUpdate });
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateProfile, completeSubscription, isLoading }}>
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
