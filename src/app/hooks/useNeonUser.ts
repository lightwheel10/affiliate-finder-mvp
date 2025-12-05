'use client';

import { useUser } from '@stackframe/stack';
import { useEffect, useState, useCallback } from 'react';

// User data type from Neon
export interface NeonUserData {
  id: number;
  email: string;
  name: string;
  is_onboarded: boolean;
  onboarding_step: number; // 1-5 for tracking progress
  has_subscription: boolean;
  role?: string;
  brand?: string;
  plan: "free_trial" | "pro" | "business" | "enterprise";
  trial_plan?: "pro" | "business";
  trial_start_date?: string;
  trial_end_date?: string;
  target_country?: string;
  target_language?: string;
  competitors?: string[];
  topics?: string[];
  affiliate_types?: string[];
}

/**
 * Hook to get or create the current user in Neon using Stack Auth identity
 * 
 * Flow:
 * 1. Check if Stack Auth user exists
 * 2. If yes, fetch/create Neon user
 * 3. Return user data with onboarding status
 */
export function useNeonUser() {
  const stackUser = useUser();
  const [neonUser, setNeonUser] = useState<NeonUserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get email and name from Stack Auth user
  const email = stackUser?.primaryEmail;
  const name = stackUser?.displayName || email?.split('@')[0] || 'User';

  // Fetch or create user in Neon
  const syncUser = useCallback(async () => {
    // If Stack Auth is still loading (undefined), wait
    if (stackUser === undefined) {
      return;
    }

    // If not authenticated, clear user and stop loading
    if (!stackUser || !email) {
      setNeonUser(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // First, try to get existing user
      const getRes = await fetch(`/api/users?email=${encodeURIComponent(email)}`);
      const getData = await getRes.json();

      if (getData.user) {
        setNeonUser(getData.user);
        setIsLoading(false);
        return;
      }

      // User doesn't exist, create one
      const createRes = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name,
          isOnboarded: false,
          onboardingStep: 1,
          hasSubscription: false,
          plan: 'free_trial',
        }),
      });

      const createData = await createRes.json();
      if (createData.user) {
        setNeonUser(createData.user);
      } else {
        setError('Failed to create user');
      }
    } catch (err) {
      console.error('Error syncing user:', err);
      setError('Failed to sync user');
    } finally {
      setIsLoading(false);
    }
  }, [stackUser, email, name]);

  // Sync user when Stack Auth user changes
  useEffect(() => {
    syncUser();
  }, [syncUser]);

  // Refetch user data
  const refetch = useCallback(async () => {
    if (!email) return;
    
    try {
      const res = await fetch(`/api/users?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      if (data.user) {
        setNeonUser(data.user);
      }
    } catch (err) {
      console.error('Error refetching user:', err);
    }
  }, [email]);

  // Update onboarding step
  const updateOnboardingStep = useCallback(async (step: number) => {
    if (!neonUser?.id) return;
    
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: neonUser.id,
          onboardingStep: step,
        }),
      });
      
      if (res.ok) {
        setNeonUser(prev => prev ? { ...prev, onboarding_step: step } : null);
      }
    } catch (err) {
      console.error('Error updating onboarding step:', err);
    }
  }, [neonUser?.id]);

  return {
    // User ID (null if not loaded/authenticated)
    userId: neonUser?.id ?? null,
    // Full user object
    user: neonUser,
    // Loading state (true while Stack Auth or Neon is loading)
    isLoading: stackUser === undefined || isLoading,
    // Is user authenticated with both Stack Auth AND has Neon user
    isAuthenticated: !!stackUser && !!neonUser,
    // Has user completed onboarding
    isOnboarded: neonUser?.is_onboarded ?? false,
    // Current onboarding step (1-5)
    onboardingStep: neonUser?.onboarding_step ?? 1,
    // Stack Auth user object
    stackUser,
    // User's display name
    userName: name,
    // Error message if any
    error,
    // Refetch user data
    refetch,
    // Update onboarding step
    updateOnboardingStep,
  };
}

// Keep the old export name for backwards compatibility during migration
export { useNeonUser as useConvexUser };
