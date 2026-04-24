'use client';

import React, { useState, useEffect } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { Stripe } from '@stripe/stripe-js';
import { getStripe } from '@/lib/stripe-client';
import { Loader2 } from 'lucide-react';

// =============================================================================
// STRIPE PROVIDER
//
// Updated: April 24th, 2026 — smoover palette migration
//   - DefaultLoader spinner + label use smoover muted token (#8898aa).
//   - Error callout tightened to bg-red-50 + vivid red-500 border +
//     rounded-xl (matches Step 7 + Analyzing error boxes).
//   - elementsOptions.appearance migrated to smoover tokens. Note: the
//     active card fields (CardNumber / CardExpiry / CardCvc) in
//     StripeCardInput.tsx override these via options.style.base, so the
//     appearance here is effectively a fallback — updated for future-proof
//     consistency if any other Stripe Element is ever added.
//
// Wrapper component that provides Stripe Elements context to child components.
// This enables secure card collection using Stripe.js — card data never
// touches our servers (PCI compliant).
//
// Usage:
// <StripeProvider>
//   <YourCardForm />
// </StripeProvider>
//
// SECURITY:
// - Uses singleton pattern for Stripe instance (prevents multiple loads)
// - Publishable key only (safe for client-side)
// - Card data handled entirely by Stripe's secure iframe
// =============================================================================

interface StripeProviderProps {
  children: React.ReactNode;
  // Optional loading component
  loadingComponent?: React.ReactNode;
  // Optional error handler
  onError?: (error: string) => void;
}

// Default loading component — smoover refresh (April 24th, 2026)
const DefaultLoader = () => (
  <div className="flex items-center justify-center p-8">
    <Loader2 className="w-6 h-6 animate-spin text-[#8898aa]" />
    <span className="ml-2 text-sm text-[#8898aa] font-medium">Loading payment form...</span>
  </div>
);

export const StripeProvider: React.FC<StripeProviderProps> = ({
  children,
  loadingComponent,
  onError,
}) => {
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadStripeInstance = async () => {
      try {
        const stripeInstance = await getStripe();
        
        if (!isMounted) return;
        
        if (!stripeInstance) {
          const errorMsg = 'Failed to load Stripe. Please check your configuration.';
          setError(errorMsg);
          onError?.(errorMsg);
        } else {
          setStripe(stripeInstance);
        }
      } catch (err) {
        if (!isMounted) return;
        const errorMsg = 'Error loading payment system. Please refresh the page.';
        setError(errorMsg);
        onError?.(errorMsg);
        console.error('[StripeProvider] Error loading Stripe:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadStripeInstance();

    return () => {
      isMounted = false;
    };
  }, [onError]);

  // Show loading state
  if (isLoading) {
    return <>{loadingComponent || <DefaultLoader />}</>;
  }

  // Show error state — smoover refresh (April 24th, 2026). Tightened to
  // vivid red-500 border + rounded-xl to match Step 7 + AnalyzingScreen
  // error callouts. font-medium -> font-semibold on the primary message.
  if (error || !stripe) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-500 rounded-xl">
        <p className="text-sm text-red-600 dark:text-red-400 font-semibold">
          {error || 'Unable to load payment form'}
        </p>
        <p className="text-xs text-red-500 dark:text-red-400 mt-1">
          Please refresh the page or contact support if the problem persists.
        </p>
      </div>
    );
  }

  // Elements options for consistent styling and behavior
  // Updated January 16, 2026: Changed #D4E815 to #ffbf23 for brand consistency
  // Updated April 24th, 2026: Migrated slate tokens to smoover palette
  //   - colorText: #1e293b -> #0f172a
  //   - .Input border: #e2e8f0 -> #e6ebf1
  //   - .Input focus: ring 1px -> 2px yellow/20 (matches wizard inputs)
  //   - .Label color: #475569 -> #425466
  //   - .Input border radius: matches the 12px (rounded-xl) used by wizard
  //     inputs via StripeCardInput.tsx
  const elementsOptions = {
    // Appearance customization to match app theme
    appearance: {
      theme: 'stripe' as const,
      variables: {
        colorPrimary: '#ffbf23',
        colorBackground: '#ffffff',
        colorText: '#0f172a',
        colorDanger: '#ef4444',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSizeBase: '14px',
        borderRadius: '12px',
        spacingUnit: '4px',
      },
      rules: {
        '.Input': {
          border: '1px solid #e6ebf1',
          boxShadow: 'none',
          padding: '10px 12px',
        },
        '.Input:focus': {
          border: '1px solid #ffbf23',
          boxShadow: '0 0 0 2px rgba(255, 191, 35, 0.2)',
        },
        '.Input--invalid': {
          border: '1px solid #ef4444',
        },
        '.Label': {
          fontWeight: '600',
          fontSize: '12px',
          color: '#425466',
        },
        '.Error': {
          fontSize: '11px',
          color: '#ef4444',
        },
      },
    },
  };

  return (
    <Elements stripe={stripe} options={elementsOptions}>
      {children}
    </Elements>
  );
};

export default StripeProvider;
