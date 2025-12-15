'use client';

/**
 * useCredits Hook
 * 
 * Fetches and manages user credit balances for the credit system.
 * 
 * SECURITY:
 * - Only fetches when user is authenticated (has userId)
 * - API endpoint verifies user owns the requested data
 * - No sensitive data exposed in hook
 * 
 * FEATURE FLAG:
 * - Controlled by NEXT_PUBLIC_SHOW_REAL_CREDITS env variable
 * - When false, returns null (pages should show hardcoded fallback)
 * - When true, fetches real credits from API
 * 
 * Created: December 2025
 */

import { useState, useEffect, useCallback } from 'react';
import { useNeonUser } from './useNeonUser';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface CreditBalance {
  total: number;
  used: number;
  remaining: number;
  unlimited: boolean;
}

export interface CreditsData {
  topicSearches: CreditBalance;
  email: CreditBalance;
  ai: CreditBalance;
  period: {
    start: string;
    end: string;
    daysRemaining: number;
  };
  plan: string;
  isTrialing: boolean;
}

export interface UseCreditsResult {
  // Credit data (null if not loaded, feature flag off, or error)
  credits: CreditsData | null;
  // Loading state
  isLoading: boolean;
  // Error message (null if no error)
  error: string | null;
  // Whether the feature flag is enabled
  isEnabled: boolean;
  // Whether user has no credits yet (new user before trial)
  hasNoCredits: boolean;
  // Refetch credits
  refetch: () => Promise<void>;
}

// =============================================================================
// FEATURE FLAG CHECK
// =============================================================================

/**
 * Check if real credits should be shown.
 * Returns false if:
 * - Environment variable is not set
 * - Environment variable is 'false' or '0'
 */
function isCreditsFeatureEnabled(): boolean {
  const flag = process.env.NEXT_PUBLIC_SHOW_REAL_CREDITS;
  if (!flag) return false;
  return flag.toLowerCase() === 'true' || flag === '1';
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

export function useCredits(): UseCreditsResult {
  const { userId, isLoading: userLoading } = useNeonUser();
  const [credits, setCredits] = useState<CreditsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasNoCredits, setHasNoCredits] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  // Check feature flag once
  const isEnabled = isCreditsFeatureEnabled();

  // Fetch credits from API
  const fetchCredits = useCallback(async () => {
    // ==========================================================================
    // GUARD: Feature flag must be enabled
    // ==========================================================================
    if (!isEnabled) {
      setCredits(null);
      setIsLoading(false);
      setHasFetched(true);
      return;
    }

    // ==========================================================================
    // GUARD: Must have authenticated user
    // ==========================================================================
    if (!userId) {
      setCredits(null);
      setIsLoading(false);
      setHasNoCredits(false);
      setHasFetched(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // ==========================================================================
      // API CALL
      // The API endpoint handles authentication and authorization:
      // - Returns 401 if not authenticated
      // - Returns 403 if trying to access another user's credits
      // ==========================================================================
      const res = await fetch(`/api/credits?userId=${userId}`);
      
      // Handle non-OK responses
      if (!res.ok) {
        // Don't expose detailed error messages to UI for security
        if (res.status === 401) {
          setError('Please sign in to view credits');
        } else if (res.status === 403) {
          // This shouldn't happen in normal flow - log for debugging
          console.error('[useCredits] Authorization error - user mismatch');
          setError('Unable to load credits');
        } else if (res.status === 404) {
          setError('User not found');
        } else {
          setError('Unable to load credits');
        }
        setCredits(null);
        setHasNoCredits(false);
        return;
      }

      const data = await res.json();

      // ==========================================================================
      // HANDLE RESPONSE
      // ==========================================================================
      if (data.credits === null && data.message) {
        // User exists but has no credit record yet (before trial starts)
        setCredits(null);
        setHasNoCredits(true);
        setError(null);
      } else if (data.credits) {
        // Successfully got credits
        setCredits({
          topicSearches: data.credits.topicSearches,
          email: data.credits.email,
          ai: data.credits.ai,
          period: data.period,
          plan: data.plan,
          isTrialing: data.isTrialing,
        });
        setHasNoCredits(false);
        setError(null);
      } else {
        // Unexpected response format
        console.error('[useCredits] Unexpected response format:', data);
        setCredits(null);
        setHasNoCredits(false);
        setError('Unable to load credits');
      }
    } catch (err) {
      // Network or parsing error
      console.error('[useCredits] Error fetching credits:', err);
      setCredits(null);
      setHasNoCredits(false);
      setError('Unable to load credits');
    } finally {
      setIsLoading(false);
      setHasFetched(true);
    }
  }, [userId, isEnabled]);

  // ==========================================================================
  // FETCH ON MOUNT AND WHEN DEPENDENCIES CHANGE
  // ==========================================================================
  useEffect(() => {
    // Don't fetch while user is still loading
    if (userLoading) return;
    
    fetchCredits();
  }, [fetchCredits, userLoading]);

  // ==========================================================================
  // LISTEN FOR CREDIT UPDATES
  // Other components can dispatch 'credits-updated' event after consuming credits
  // ==========================================================================
  useEffect(() => {
    const handleCreditsUpdate = () => {
      console.log('[useCredits] Received credits-updated event, refetching...');
      fetchCredits();
    };

    window.addEventListener('credits-updated', handleCreditsUpdate);
    
    return () => {
      window.removeEventListener('credits-updated', handleCreditsUpdate);
    };
  }, [fetchCredits]);

  // ==========================================================================
  // RETURN
  // ==========================================================================
  return {
    credits,
    // Show loading if: user is loading OR (feature enabled AND userId exists AND haven't fetched yet)
    isLoading: userLoading || (isEnabled && !!userId && !hasFetched) || isLoading,
    error,
    isEnabled,
    hasNoCredits,
    refetch: fetchCredits,
  };
}

// =============================================================================
// HELPER: Format credit display
// =============================================================================

/**
 * Format credit value for display.
 * Handles unlimited credits (-1) and normal values.
 */
export function formatCreditDisplay(balance: CreditBalance): string {
  if (balance.unlimited) {
    return '∞';
  }
  return `${balance.remaining}/${balance.total}`;
}

/**
 * Format single credit value.
 * Handles unlimited credits (-1).
 */
export function formatCreditValue(value: number, isUnlimited: boolean): string {
  if (isUnlimited || value === -1) {
    return '∞';
  }
  return value.toString();
}
