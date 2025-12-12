'use client';

import { useEffect, useState, useCallback } from 'react';
import { DbSubscription } from '@/lib/db';

// =============================================================================
// useSubscription Hook
//
// Manages subscription data fetching and actions (cancel/resume).
// All subscription modifications go through Stripe API routes to ensure
// Stripe remains the source of truth.
//
// IMPORTANT: Cancel/Resume use Stripe API routes, NOT the legacy DB route.
// =============================================================================

// Subscription data with computed fields
export interface SubscriptionData extends DbSubscription {
  // Computed fields for UI
  isTrialing: boolean;
  isActive: boolean;
  isCanceled: boolean;
  daysLeftInTrial: number | null;
  formattedPrice: string;
  nextBillingDate: string | null;
}

// Plan pricing info
const PLAN_PRICES = {
  pro: { monthly: 99, annual: 79 },
  business: { monthly: 249, annual: 199 },
  enterprise: { monthly: 0, annual: 0 },
  free_trial: { monthly: 0, annual: 0 },
};

/**
 * Hook to fetch and manage user subscription data
 * 
 * @param userId - The Neon user ID
 */
export function useSubscription(userId: number | null) {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false); // Track if we've fetched for current userId

  // Fetch subscription data
  const fetchSubscription = useCallback(async () => {
    if (!userId) {
      setSubscription(null);
      setIsLoading(false);
      setHasFetched(false); // Reset when no userId
      return;
    }

    setIsLoading(true);
    setHasFetched(false);
    setError(null);

    try {
      const res = await fetch(`/api/subscriptions?userId=${userId}`);
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        setSubscription(null);
      } else if (data.subscription) {
        // Compute additional fields
        const sub = data.subscription as DbSubscription;
        const now = new Date();
        const trialEnd = sub.trial_ends_at ? new Date(sub.trial_ends_at) : null;
        
        // Calculate days left in trial
        let daysLeftInTrial: number | null = null;
        if (trialEnd && sub.status === 'trialing') {
          const diffTime = trialEnd.getTime() - now.getTime();
          daysLeftInTrial = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
        }

        // Format price
        const planPrices = PLAN_PRICES[sub.plan as keyof typeof PLAN_PRICES] || { monthly: 0, annual: 0 };
        const price = sub.billing_interval === 'annual' ? planPrices.annual : planPrices.monthly;
        const formattedPrice = sub.plan === 'enterprise' ? 'Custom' : `$${price}/mo`;

        // Format next billing date
        let nextBillingDate: string | null = null;
        if (sub.status === 'trialing' && trialEnd) {
          nextBillingDate = trialEnd.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
          });
        } else if (sub.current_period_end) {
          const periodEnd = new Date(sub.current_period_end);
          nextBillingDate = periodEnd.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
          });
        }

        setSubscription({
          ...sub,
          isTrialing: sub.status === 'trialing',
          isActive: sub.status === 'active' || sub.status === 'trialing',
          isCanceled: sub.status === 'canceled' || sub.cancel_at_period_end,
          daysLeftInTrial,
          formattedPrice,
          nextBillingDate,
        });
      } else {
        setSubscription(null);
      }
    } catch (err) {
      console.error('Error fetching subscription:', err);
      setError('Failed to fetch subscription');
      setSubscription(null);
    } finally {
      setIsLoading(false);
      setHasFetched(true); // Mark that we've completed fetching
    }
  }, [userId]);

  // Fetch on mount and when userId changes
  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // ==========================================================================
  // LISTEN FOR SUBSCRIPTION UPDATES FROM OTHER COMPONENTS
  // 
  // When any component updates the subscription (e.g., PricingModal),
  // it dispatches a custom 'subscription-updated' event.
  // All useSubscription instances listen for this event and refetch.
  // This ensures the Sidebar and Settings page stay in sync.
  // Added December 2025.
  // ==========================================================================
  useEffect(() => {
    const handleSubscriptionUpdate = () => {
      console.log('[useSubscription] Received subscription-updated event, refetching...');
      fetchSubscription();
    };

    window.addEventListener('subscription-updated', handleSubscriptionUpdate);
    
    return () => {
      window.removeEventListener('subscription-updated', handleSubscriptionUpdate);
    };
  }, [fetchSubscription]);

  // ==========================================================================
  // CANCEL SUBSCRIPTION (via Stripe API)
  // 
  // Calls the Stripe API to cancel at period end.
  // This ensures Stripe is the source of truth.
  // ==========================================================================
  const cancelSubscription = useCallback(async () => {
    if (!userId) return null;
    
    setError(null);
    
    try {
      const res = await fetch('/api/stripe/cancel-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      
      const data = await res.json();
      
      if (!res.ok || data.error) {
        const errorMsg = data.error || 'Failed to cancel subscription';
        setError(errorMsg);
        console.error('Error canceling subscription:', errorMsg);
        return null;
      }
      
      // Refetch to get updated data
      await fetchSubscription();
      return data.subscription;
    } catch (err) {
      console.error('Error canceling subscription:', err);
      setError('Failed to cancel subscription');
      return null;
    }
  }, [userId, fetchSubscription]);

  // ==========================================================================
  // RESUME SUBSCRIPTION (via Stripe API)
  // 
  // Calls the Stripe API to remove cancellation.
  // This ensures Stripe is the source of truth.
  // ==========================================================================
  const resumeSubscription = useCallback(async () => {
    if (!userId) return null;
    
    setError(null);
    
    try {
      const res = await fetch('/api/stripe/resume-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      
      const data = await res.json();
      
      if (!res.ok || data.error) {
        const errorMsg = data.error || 'Failed to resume subscription';
        setError(errorMsg);
        console.error('Error resuming subscription:', errorMsg);
        return null;
      }
      
      // Refetch to get updated data
      await fetchSubscription();
      return data.subscription;
    } catch (err) {
      console.error('Error resuming subscription:', err);
      setError('Failed to resume subscription');
      return null;
    }
  }, [userId, fetchSubscription]);

  return {
    // Subscription data with computed fields
    subscription,
    // Loading state - true if loading OR if we have a userId but haven't fetched yet
    isLoading: isLoading || (!!userId && !hasFetched),
    // Error message if any
    error,
    // Refetch subscription data
    refetch: fetchSubscription,
    // Cancel subscription at period end (via Stripe API)
    cancelSubscription,
    // Resume a canceled subscription (via Stripe API)
    resumeSubscription,
    // Quick access to common states
    isTrialing: subscription?.isTrialing ?? false,
    isActive: subscription?.isActive ?? false,
    isCanceled: subscription?.isCanceled ?? false,
    plan: subscription?.plan ?? null,
    daysLeftInTrial: subscription?.daysLeftInTrial ?? null,
    // Whether we've completed fetching for the current userId
    hasFetched,
  };
}

