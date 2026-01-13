'use client';

import { useUser } from '@stackframe/stack';
import { useEffect, useState, useCallback, useRef } from 'react';

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
  profile_image_url?: string; // January 13th, 2026: Added for Vercel Blob storage
}

// =============================================================================
// GLOBAL CACHE - January 3rd, 2026
// =============================================================================
//
// PROBLEM IDENTIFIED:
// When the app loads or navigates, multiple components (AuthGuard, Sidebar, 
// Dashboard, etc.) each call useNeonUser() simultaneously. Each hook instance
// has its own state, so they ALL see neonUser === null and ALL start fetching.
// This caused 15+ duplicate API calls on initial load and loading screens on
// every navigation.
//
// SOLUTION:
// Use module-level (global) variables that persist across all hook instances:
//
// 1. userCache: Stores the fetched user data so all hook instances can share it
// 2. cacheEmail: Tracks which email the cache is for (invalidate on user change)
// 3. fetchPromise: If a fetch is in progress, all callers await the SAME promise
//                  instead of starting their own fetch. This prevents race conditions.
// 4. cacheListeners: When the global cache updates, notify all hook instances so
//                    they can update their local state.
//
// =============================================================================

let userCache: NeonUserData | null = null;
let cacheEmail: string | null = null;
let fetchPromise: Promise<NeonUserData | null> | null = null;
const cacheListeners: Set<(user: NeonUserData | null) => void> = new Set();

// Notify all hook instances when cache updates
function notifyCacheListeners(user: NeonUserData | null) {
  cacheListeners.forEach(listener => listener(user));
}

// Clear cache (used on logout or user change)
export function clearUserCache() {
  userCache = null;
  cacheEmail = null;
  fetchPromise = null;
  notifyCacheListeners(null);
}

/**
 * Hook to get or create the current user in Neon using Stack Auth identity
 * 
 * Flow:
 * 1. Check if Stack Auth user exists
 * 2. If yes, fetch/create Neon user (using global cache to prevent duplicates)
 * 3. Return user data with onboarding status
 */
export function useNeonUser() {
  const stackUser = useUser();
  const [neonUser, setNeonUser] = useState<NeonUserData | null>(() => {
    // Initialize from cache if available for this email
    const email = stackUser?.primaryEmail;
    if (userCache && cacheEmail === email) {
      return userCache;
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(() => {
    // If we have cached data, don't show loading
    const email = stackUser?.primaryEmail;
    if (userCache && cacheEmail === email) {
      return false;
    }
    return true;
  });
  const [error, setError] = useState<string | null>(null);
  
  // Track if this instance has subscribed to cache updates
  const hasSubscribedRef = useRef(false);

  // Get email and name from Stack Auth user
  const email = stackUser?.primaryEmail;
  const name = stackUser?.displayName || email?.split('@')[0] || 'User';

  // Subscribe to cache updates on mount
  // ==========================================================================
  // CACHE LISTENER - January 3rd, 2026
  // 
  // When the global cache updates (either with new user data or null on logout),
  // all hook instances are notified so they can update their local state.
  // 
  // BUG FIX: Previously, setIsLoading(false) was only called when user was
  // not null: `if (user) setIsLoading(false)`. This meant when clearUserCache()
  // notified listeners with null (during logout or user change), isLoading
  // would stay stuck at true forever, blocking the UI indefinitely.
  // 
  // The fix: Always set isLoading to false when cache updates. Whether we
  // received user data or null, the "loading" phase is complete.
  // ==========================================================================
  useEffect(() => {
    if (!hasSubscribedRef.current) {
      const listener = (user: NeonUserData | null) => {
        setNeonUser(user);
        // Always stop loading when cache updates (whether user is null or not)
        setIsLoading(false);
      };
      cacheListeners.add(listener);
      hasSubscribedRef.current = true;
      
      return () => {
        cacheListeners.delete(listener);
        hasSubscribedRef.current = false;
      };
    }
  }, []);

  // Fetch or create user in Neon
  const syncUser = useCallback(async () => {
    // If Stack Auth is still loading (undefined), wait
    if (stackUser === undefined) {
      return;
    }

    // If not authenticated, clear user and cache, stop loading
    if (!stackUser || !email) {
      setNeonUser(null);
      setIsLoading(false);
      clearUserCache();
      return;
    }

    // =========================================================================
    // CACHE CHECK - January 3rd, 2026
    // 
    // If we have cached data for this email, use it immediately.
    // No loading state, no API call, no flash of loading screens.
    // =========================================================================
    if (userCache && cacheEmail === email) {
      setNeonUser(userCache);
      setIsLoading(false);
      return;
    }

    // =========================================================================
    // REQUEST DEDUPLICATION - January 3rd, 2026
    // 
    // If a fetch is already in progress for this email, await the SAME promise
    // instead of starting a new fetch. This prevents multiple simultaneous
    // API calls when many components mount at the same time.
    // =========================================================================
    if (fetchPromise && cacheEmail === email) {
      setIsLoading(true);
      try {
        const user = await fetchPromise;
        if (user) {
          setNeonUser(user);
        }
      } catch {
        // Error handled by the original request
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // =========================================================================
    // NEW REQUEST - January 3rd, 2026
    // 
    // No cache and no in-flight request. Start a new fetch and store the
    // promise so other callers can await it instead of starting duplicates.
    // =========================================================================
    setIsLoading(true);
    setError(null);
    cacheEmail = email; // Mark which email we're fetching for

    const doFetch = async (): Promise<NeonUserData | null> => {
      try {
        // First, try to get existing user
        const getRes = await fetch(`/api/users?email=${encodeURIComponent(email)}`);
        const getData = await getRes.json();

        if (getData.user) {
          userCache = getData.user;
          notifyCacheListeners(getData.user);
          return getData.user;
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
          userCache = createData.user;
          notifyCacheListeners(createData.user);
          return createData.user;
        } else {
          throw new Error('Failed to create user');
        }
      } catch (err) {
        console.error('Error syncing user:', err);
        throw err;
      }
    };

    fetchPromise = doFetch();
    
    try {
      const user = await fetchPromise;
      if (user) {
        setNeonUser(user);
      }
    } catch (err) {
      setError('Failed to sync user');
    } finally {
      setIsLoading(false);
      fetchPromise = null; // Clear the promise so future calls can start fresh if needed
    }
  }, [stackUser, email, name]);

  // Sync user when Stack Auth user changes
  useEffect(() => {
    syncUser();
  }, [syncUser]);

  // ==========================================================================
  // REFETCH - January 3rd, 2026
  // 
  // Force refetch user data from the API and update both local state AND
  // global cache. Use this after making changes to user data (e.g., completing
  // onboarding, updating profile) to ensure all components see the new data.
  // ==========================================================================
  const refetch = useCallback(async () => {
    if (!email) return;
    
    try {
      const res = await fetch(`/api/users?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      if (data.user) {
        // Update both local state and global cache
        setNeonUser(data.user);
        userCache = data.user;
        cacheEmail = email;
        notifyCacheListeners(data.user);
      }
    } catch (err) {
      console.error('Error refetching user:', err);
    }
  }, [email]);

  // ==========================================================================
  // UPDATE ONBOARDING STEP - January 3rd, 2026
  // 
  // Update the user's onboarding step. Also updates the global cache so all
  // components stay in sync.
  // ==========================================================================
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
        // Update local state
        setNeonUser(prev => {
          if (!prev) return null;
          const updated = { ...prev, onboarding_step: step };
          // Also update global cache
          userCache = updated;
          notifyCacheListeners(updated);
          return updated;
        });
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
