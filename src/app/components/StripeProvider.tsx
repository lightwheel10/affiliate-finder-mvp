'use client';

import React, { useState, useEffect } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { Stripe } from '@stripe/stripe-js';
import { getStripe } from '@/lib/stripe-client';
import { Loader2 } from 'lucide-react';

// =============================================================================
// STRIPE PROVIDER
// 
// Wrapper component that provides Stripe Elements context to child components.
// This enables secure card collection using Stripe.js - card data never 
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

// Default loading component
const DefaultLoader = () => (
  <div className="flex items-center justify-center p-8">
    <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
    <span className="ml-2 text-sm text-slate-500">Loading payment form...</span>
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

  // Show error state
  if (error || !stripe) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-sm text-red-600 font-medium">
          {error || 'Unable to load payment form'}
        </p>
        <p className="text-xs text-red-500 mt-1">
          Please refresh the page or contact support if the problem persists.
        </p>
      </div>
    );
  }

  // Elements options for consistent styling and behavior
  // Updated January 16, 2026: Changed #D4E815 to #ffbf23 for brand consistency
  const elementsOptions = {
    // Appearance customization to match app theme
    appearance: {
      theme: 'stripe' as const,
      variables: {
        colorPrimary: '#ffbf23',
        colorBackground: '#ffffff',
        colorText: '#1e293b',
        colorDanger: '#ef4444',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSizeBase: '14px',
        borderRadius: '8px',
        spacingUnit: '4px',
      },
      rules: {
        '.Input': {
          border: '1px solid #e2e8f0',
          boxShadow: 'none',
          padding: '10px 12px',
        },
        '.Input:focus': {
          border: '1px solid #ffbf23',
          boxShadow: '0 0 0 1px rgba(255, 191, 35, 0.2)',
        },
        '.Input--invalid': {
          border: '1px solid #ef4444',
        },
        '.Label': {
          fontWeight: '600',
          fontSize: '12px',
          color: '#475569',
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
