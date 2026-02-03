/**
 * =============================================================================
 * useSupabaseUser HOOK - SUPABASE AUTH + DATABASE USER
 * =============================================================================
 * 
 * Created: January 19th, 2026
 * Purpose: Replace useNeonUser with Supabase authentication
 * 
 * WHAT THIS HOOK DOES:
 * --------------------
 * This hook bridges Supabase Auth and our database user table. It:
 * 
 * 1. Listens to Supabase auth state changes (login/logout)
 * 2. When authenticated, fetches or creates the user in our database
 * 3. Provides user data, loading states, and helper functions
 * 4. Uses caching to prevent duplicate API calls (same as useNeonUser)
 * 
 * WHY WE NEED THIS:
 * -----------------
 * - Supabase Auth only stores auth info (email, uid, provider)
 * - Our app needs additional user data (onboarding status, credits, etc.)
 * - This hook syncs Supabase Auth with our 'users' table in the database
 * 
 * MIGRATION FROM useNeonUser:
 * ---------------------------
 * This hook has the SAME INTERFACE as useNeonUser, making migration easy:
 * - Same return values: userId, user, isLoading, isAuthenticated, etc.
 * - Same caching mechanism to prevent duplicate fetches
 * - Components just need to change the import
 * 
 * FLOW:
 * -----
 * 1. Hook initializes, subscribes to Supabase auth state
 * 2. If user is logged in (has session):
 *    - Extract email from session
 *    - Call /api/users to get or create database user
 *    - Return user data with onboarding status
 * 3. If user logs out:
 *    - Clear cache and local state
 *    - Return null user
 * 
 * CACHING EXPLANATION:
 * --------------------
 * When the app loads, multiple components call useSupabaseUser() simultaneously.
 * Without caching, each would trigger its own API call (bad!).
 * 
 * We use module-level (global) variables:
 * - userCache: Stores fetched user data
 * - cacheEmail: Tracks which email the cache is for
 * - fetchPromise: If a fetch is in progress, others await the same promise
 * - cacheListeners: Notifies all hook instances when cache updates
 * 
 * =============================================================================
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { getSupabaseBrowserClient, Session, User as SupabaseUser } from '@/lib/supabase/client';

// =============================================================================
// USER DATA TYPE (Same as useNeonUser for compatibility)
// =============================================================================

export interface SupabaseUserData {
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
  profile_image_url?: string;
}

// =============================================================================
// GLOBAL CACHE (Same pattern as useNeonUser)
// =============================================================================
// 
// These module-level variables persist across all hook instances:
// - Prevents duplicate API calls when multiple components mount
// - Keeps all components in sync when user data changes
// 
// =============================================================================

let userCache: SupabaseUserData | null = null;
let cacheEmail: string | null = null;
let fetchPromise: Promise<SupabaseUserData | null> | null = null;
const cacheListeners: Set<(user: SupabaseUserData | null) => void> = new Set();

/**
 * Notify all hook instances when cache updates
 */
function notifyCacheListeners(user: SupabaseUserData | null) {
  cacheListeners.forEach(listener => listener(user));
}

/**
 * Clear cache (used on logout or user change)
 */
export function clearUserCache() {
  userCache = null;
  cacheEmail = null;
  fetchPromise = null;
  notifyCacheListeners(null);
}

// =============================================================================
// MAIN HOOK
// =============================================================================

/**
 * Hook to manage Supabase authentication and database user sync.
 * 
 * Returns the same interface as useNeonUser for easy migration:
 * - userId: Database user ID (number)
 * - user: Full user object from database
 * - isLoading: True while auth or database fetch is in progress
 * - isAuthenticated: True if user is logged in AND has database record
 * - isOnboarded: True if user completed onboarding
 * - onboardingStep: Current step (1-5)
 * - supabaseUser: Raw Supabase auth user object
 * - userName: Display name
 * - error: Error message if any
 * - refetch: Force refetch user data
 * - updateOnboardingStep: Update onboarding progress
 * - signOut: Sign out the user
 */
export function useSupabaseUser() {
  // Supabase auth state
  const [session, setSession] = useState<Session | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // Database user state
  const [dbUser, setDbUser] = useState<SupabaseUserData | null>(() => {
    // Initialize from cache if available
    if (userCache && cacheEmail) {
      return userCache;
    }
    return null;
  });
  const [dbLoading, setDbLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Track subscription to cache updates
  const hasSubscribedRef = useRef(false);
  
  // Get Supabase client (singleton)
  const supabase = getSupabaseBrowserClient();
  
  // Derived values
  const email = supabaseUser?.email;
  const name = supabaseUser?.user_metadata?.name || email?.split('@')[0] || 'User';

  // ===========================================================================
  // STEP 1: Subscribe to Supabase Auth State Changes
  // ===========================================================================
  useEffect(() => {
    // Get initial session
    const initSession = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        setSession(initialSession);
        setSupabaseUser(initialSession?.user ?? null);
      } catch (err) {
        console.error('[useSupabaseUser] Error getting initial session:', err);
      } finally {
        setAuthLoading(false);
      }
    };
    
    initSession();
    
    // Subscribe to auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        setSupabaseUser(newSession?.user ?? null);
        
        // Clear cache on logout
        if (event === 'SIGNED_OUT') {
          clearUserCache();
          setDbUser(null);
          setDbLoading(false);
        }
      }
    );
    
    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  // ===========================================================================
  // STEP 2: Subscribe to Cache Updates
  // ===========================================================================
  useEffect(() => {
    if (!hasSubscribedRef.current) {
      const listener = (user: SupabaseUserData | null) => {
        setDbUser(user);
        setDbLoading(false);
      };
      cacheListeners.add(listener);
      hasSubscribedRef.current = true;
      
      return () => {
        cacheListeners.delete(listener);
        hasSubscribedRef.current = false;
      };
    }
  }, []);

  // ===========================================================================
  // STEP 3: Sync Database User When Auth Changes
  // ===========================================================================
  const syncUser = useCallback(async () => {
    // Still loading auth state
    if (authLoading) {
      return;
    }

    // Not authenticated - clear state
    if (!supabaseUser || !email) {
      setDbUser(null);
      setDbLoading(false);
      clearUserCache();
      return;
    }

    // Check cache first
    if (userCache && cacheEmail === email) {
      setDbUser(userCache);
      setDbLoading(false);
      return;
    }

    // If fetch already in progress for this email, wait for it
    if (fetchPromise && cacheEmail === email) {
      setDbLoading(true);
      try {
        const user = await fetchPromise;
        if (user) {
          setDbUser(user);
        }
      } catch {
        // Error handled by original request
      } finally {
        setDbLoading(false);
      }
      return;
    }

    // Start new fetch
    setDbLoading(true);
    setError(null);
    cacheEmail = email;

    const doFetch = async (): Promise<SupabaseUserData | null> => {
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
        console.error('[useSupabaseUser] Error syncing user:', err);
        throw err;
      }
    };

    fetchPromise = doFetch();
    
    try {
      const user = await fetchPromise;
      if (user) {
        setDbUser(user);
      }
    } catch (err) {
      setError('Failed to sync user');
    } finally {
      setDbLoading(false);
      fetchPromise = null;
    }
  }, [authLoading, supabaseUser, email, name]);

  // Trigger sync when auth state changes
  useEffect(() => {
    syncUser();
  }, [syncUser]);

  // ===========================================================================
  // HELPER FUNCTIONS
  // ===========================================================================

  /**
   * Force refetch user data from API
   */
  const refetch = useCallback(async () => {
    if (!email) return;
    
    try {
      const res = await fetch(`/api/users?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      if (data.user) {
        setDbUser(data.user);
        userCache = data.user;
        cacheEmail = email;
        notifyCacheListeners(data.user);
      }
    } catch (err) {
      console.error('[useSupabaseUser] Error refetching user:', err);
    }
  }, [email]);

  /**
   * Update onboarding step
   */
  const updateOnboardingStep = useCallback(async (step: number) => {
    if (!dbUser?.id) return;
    
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: dbUser.id,
          onboardingStep: step,
        }),
      });
      
      if (res.ok) {
        setDbUser(prev => {
          if (!prev) return null;
          const updated = { ...prev, onboarding_step: step };
          userCache = updated;
          notifyCacheListeners(updated);
          return updated;
        });
      }
    } catch (err) {
      console.error('[useSupabaseUser] Error updating onboarding step:', err);
    }
  }, [dbUser?.id]);

  /**
   * Sign out the user
   */
  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      clearUserCache();
    } catch (err) {
      console.error('[useSupabaseUser] Error signing out:', err);
    }
  }, [supabase]);

  // ===========================================================================
  // RETURN VALUES (Same interface as useNeonUser)
  // ===========================================================================
  return {
    // Database user ID (null if not loaded/authenticated)
    userId: dbUser?.id ?? null,
    // Full database user object
    user: dbUser,
    // Loading state (true while auth or database fetch is in progress)
    isLoading: authLoading || dbLoading,
    // Is user authenticated with Supabase AND has database record
    isAuthenticated: !!supabaseUser && !!dbUser,
    // Has user completed onboarding
    isOnboarded: dbUser?.is_onboarded ?? false,
    // Current onboarding step (1-5)
    onboardingStep: dbUser?.onboarding_step ?? 1,
    // Supabase auth user object (replaces stackUser)
    supabaseUser,
    // User's display name
    userName: name,
    // Error message if any
    error,
    // Supabase session
    session,
    // Force refetch user data
    refetch,
    // Update onboarding step
    updateOnboardingStep,
    // Sign out function
    signOut,
  };
}

// =============================================================================
// BACKWARDS COMPATIBILITY EXPORTS
// =============================================================================
// These exports allow gradual migration from useNeonUser

export { useSupabaseUser as useNeonUser };
export type { SupabaseUserData as NeonUserData };
