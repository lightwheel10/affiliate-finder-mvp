'use client';

import React, { useState, useCallback } from 'react';
import { 
  CardNumberElement, 
  CardExpiryElement, 
  CardCvcElement, 
  useStripe, 
  useElements 
} from '@stripe/react-stripe-js';
import { 
  StripeCardNumberElementChangeEvent,
  StripeCardExpiryElementChangeEvent,
  StripeCardCvcElementChangeEvent,
} from '@stripe/stripe-js';
import { Lock, AlertCircle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * =============================================================================
 * STRIPE CARD INPUT COMPONENT (Split Elements) - NEO-BRUTALIST
 * =============================================================================
 * 
 * Updated: January 8th, 2026
 *
 * NEO-BRUTALIST DESIGN UPDATE:
 * - Sharp edges (no rounded corners)
 * - Bold borders (border-2 with black)
 * - Yellow accent color (#ffbf23)
 * - Bold typography (font-black uppercase labels)
 * - Dark mode support
 *
 * A secure card input component using separate Stripe Elements for:
 * - Card Number
 * - Expiry Date  
 * - CVC
 *
 * Card data is collected directly by Stripe's secure iframes - 
 * sensitive data NEVER touches our servers.
 *
 * SECURITY:
 * - PCI DSS compliant - card data handled entirely by Stripe
 * - 3D Secure authentication handled automatically
 * - Real-time card validation via Stripe.js
 * - No raw card data stored anywhere
 * =============================================================================
 */

interface StripeCardInputProps {
  // Cardholder name (managed externally)
  cardholderName: string;
  onCardholderNameChange: (name: string) => void;
  
  // Callbacks
  onCardReady?: (isReady: boolean) => void;
  onError?: (error: string | null) => void;
  
  // Optional styling
  className?: string;
  disabled?: boolean;
  
  // Show security badge
  showSecurityBadge?: boolean;
}

// Element styling options to match app design
const ELEMENT_STYLES = {
  style: {
    base: {
      fontSize: '14px',
      color: '#1e293b',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSmoothing: 'antialiased',
      '::placeholder': {
        color: '#94a3b8',
      },
      iconColor: '#64748b',
    },
    invalid: {
      color: '#ef4444',
      iconColor: '#ef4444',
    },
    complete: {
      color: '#1e293b',
      iconColor: '#22c55e',
    },
  },
};

// Card brand display component - NEO-BRUTALIST (Updated January 8th, 2026)
const CardBrandBadge: React.FC<{ brand: string | null }> = ({ brand }) => {
  if (!brand || brand === 'unknown') return null;
  
  const brandColors: Record<string, string> = {
    visa: 'bg-blue-600',
    mastercard: 'bg-gradient-to-r from-red-500 to-yellow-500',
    amex: 'bg-blue-800',
    discover: 'bg-orange-500',
  };
  
  const bgClass = brandColors[brand] || 'bg-gray-500';
  
  return (
    <span className={cn(
      "text-[10px] px-1.5 py-0.5 text-white uppercase font-black border border-black",
      bgClass
    )}>
      {brand}
    </span>
  );
};

export const StripeCardInput: React.FC<StripeCardInputProps> = ({
  cardholderName,
  onCardholderNameChange,
  onCardReady,
  onError,
  className,
  disabled = false,
  showSecurityBadge = true,
}) => {
  const stripe = useStripe();
  const elements = useElements();
  
  // Track completion and errors for each element
  const [cardNumberComplete, setCardNumberComplete] = useState(false);
  const [cardExpiryComplete, setCardExpiryComplete] = useState(false);
  const [cardCvcComplete, setCardCvcComplete] = useState(false);
  
  const [cardNumberError, setCardNumberError] = useState<string | null>(null);
  const [cardExpiryError, setCardExpiryError] = useState<string | null>(null);
  const [cardCvcError, setCardCvcError] = useState<string | null>(null);
  
  const [cardBrand, setCardBrand] = useState<string | null>(null);
  
  // Focus states for styling
  const [cardNumberFocused, setCardNumberFocused] = useState(false);
  const [cardExpiryFocused, setCardExpiryFocused] = useState(false);
  const [cardCvcFocused, setCardCvcFocused] = useState(false);

  // Check if all fields are complete
  const allComplete = cardNumberComplete && cardExpiryComplete && cardCvcComplete;
  const isReady = !!(stripe && elements && allComplete && cardholderName.trim());

  // Combined error for parent
  const combinedError = cardNumberError || cardExpiryError || cardCvcError;

  // Notify parent of ready state changes
  React.useEffect(() => {
    onCardReady?.(isReady);
  }, [isReady, onCardReady]);

  // Notify parent of errors
  React.useEffect(() => {
    onError?.(combinedError);
  }, [combinedError, onError]);

  // Handle card number changes
  const handleCardNumberChange = useCallback((event: StripeCardNumberElementChangeEvent) => {
    setCardNumberComplete(event.complete);
    setCardBrand(event.brand || null);
    setCardNumberError(event.error?.message || null);
  }, []);

  // Handle expiry changes
  const handleExpiryChange = useCallback((event: StripeCardExpiryElementChangeEvent) => {
    setCardExpiryComplete(event.complete);
    setCardExpiryError(event.error?.message || null);
  }, []);

  // Handle CVC changes
  const handleCvcChange = useCallback((event: StripeCardCvcElementChangeEvent) => {
    setCardCvcComplete(event.complete);
    setCardCvcError(event.error?.message || null);
  }, []);

  // Shared input container styles - NEO-BRUTALIST (Updated January 8th, 2026)
  const getInputContainerClass = (focused: boolean, error: string | null, complete: boolean) => cn(
    "px-3 py-3 bg-white dark:bg-gray-900 border-2 transition-all",
    focused 
      ? "border-black dark:border-white" 
      : error 
        ? "border-red-500" 
        : complete
          ? "border-green-500"
          : "border-gray-300 dark:border-gray-600",
    disabled && "bg-gray-50 dark:bg-gray-800 cursor-not-allowed opacity-60"
  );

  return (
    <div className={cn("space-y-4", className)}>
      {/* Security Badge - NEO-BRUTALIST (Updated January 8th, 2026) */}
      {showSecurityBadge && (
        <div className="flex items-center gap-2 p-3 bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-500">
          <Lock size={14} className="text-blue-600 shrink-0" />
          <div className="text-xs text-blue-800 dark:text-blue-300">
            <span className="font-black uppercase">Secure payment</span>
            <span className="text-blue-600 dark:text-blue-400 ml-1 font-medium">• Powered by Stripe</span>
          </div>
        </div>
      )}

      {/* Cardholder Name - NEO-BRUTALIST */}
      <div className="space-y-1.5">
        <label className="text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wide">
          Cardholder Name
        </label>
        <input
          type="text"
          value={cardholderName}
          onChange={(e) => onCardholderNameChange(e.target.value)}
          placeholder="John Doe"
          disabled={disabled}
          autoComplete="cc-name"
          className={cn(
            "w-full px-3 py-2.5 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-sm text-gray-900 dark:text-white",
            "focus:outline-none focus:border-black dark:focus:border-white",
            "transition-all placeholder:text-gray-400",
            disabled && "bg-gray-50 dark:bg-gray-800 cursor-not-allowed opacity-60"
          )}
        />
      </div>

      {/* Card Number - NEO-BRUTALIST */}
      <div className="space-y-1.5">
        <label className="text-xs font-black text-gray-700 dark:text-gray-300 flex items-center gap-2 uppercase tracking-wide">
          Card Number
          <CardBrandBadge brand={cardBrand} />
        </label>
        <div className={cn(
          getInputContainerClass(cardNumberFocused, cardNumberError, cardNumberComplete),
          "relative"
        )}>
          <CardNumberElement
            options={{
              ...ELEMENT_STYLES,
              disabled,
              showIcon: true,
            }}
            onChange={handleCardNumberChange}
            onFocus={() => setCardNumberFocused(true)}
            onBlur={() => setCardNumberFocused(false)}
          />
          {cardNumberComplete && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <Check size={16} className="text-green-500" />
            </div>
          )}
        </div>
        {cardNumberError && (
          <div className="flex items-center gap-1.5 text-red-500">
            <AlertCircle size={12} />
            <p className="text-[11px]">{cardNumberError}</p>
          </div>
        )}
      </div>

      {/* Expiry and CVC in a row - NEO-BRUTALIST */}
      <div className="grid grid-cols-2 gap-4">
        {/* Expiry Date */}
        <div className="space-y-1.5">
          <label className="text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            Expiry Date
          </label>
          <div className={getInputContainerClass(cardExpiryFocused, cardExpiryError, cardExpiryComplete)}>
            <CardExpiryElement
              options={{
                ...ELEMENT_STYLES,
                disabled,
              }}
              onChange={handleExpiryChange}
              onFocus={() => setCardExpiryFocused(true)}
              onBlur={() => setCardExpiryFocused(false)}
            />
          </div>
          {cardExpiryError && (
            <div className="flex items-center gap-1.5 text-red-500">
              <AlertCircle size={12} />
              <p className="text-[11px]">{cardExpiryError}</p>
            </div>
          )}
        </div>

        {/* CVC - NEO-BRUTALIST */}
        <div className="space-y-1.5">
          <label className="text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            CVC
          </label>
          <div className={getInputContainerClass(cardCvcFocused, cardCvcError, cardCvcComplete)}>
            <CardCvcElement
              options={{
                ...ELEMENT_STYLES,
                disabled,
              }}
              onChange={handleCvcChange}
              onFocus={() => setCardCvcFocused(true)}
              onBlur={() => setCardCvcFocused(false)}
            />
          </div>
          {cardCvcError && (
            <div className="flex items-center gap-1.5 text-red-500">
              <AlertCircle size={12} />
              <p className="text-[11px]">{cardCvcError}</p>
            </div>
          )}
        </div>
      </div>

      {/* Ready indicator (for debugging - can be removed in production) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="text-[10px] text-slate-400 flex flex-wrap gap-2">
          <span>{stripe ? '✓ Stripe' : '○ Stripe'}</span>
          <span>{cardNumberComplete ? '✓ Card' : '○ Card'}</span>
          <span>{cardExpiryComplete ? '✓ Expiry' : '○ Expiry'}</span>
          <span>{cardCvcComplete ? '✓ CVC' : '○ CVC'}</span>
          <span>{cardholderName.trim() ? '✓ Name' : '○ Name'}</span>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// HOOK: useStripeCardSetup
//
// Custom hook to handle the SetupIntent confirmation flow with split elements.
// Call this when user submits the card form.
//
// Usage:
// const { confirmSetup, isProcessing, error } = useStripeCardSetup();
// const result = await confirmSetup(clientSecret, cardholderName);
// =============================================================================

interface SetupResult {
  success: boolean;
  paymentMethodId?: string;
  error?: string;
}

export function useStripeCardSetup() {
  const stripe = useStripe();
  const elements = useElements();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmSetup = async (
    clientSecret: string,
    cardholderName: string
  ): Promise<SetupResult> => {
    if (!stripe || !elements) {
      const errorMsg = 'Payment system not ready. Please refresh the page.';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }

    // Get the CardNumberElement (required for confirmCardSetup with split elements)
    const cardNumberElement = elements.getElement(CardNumberElement);
    if (!cardNumberElement) {
      const errorMsg = 'Card input not found. Please refresh the page.';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Confirm the SetupIntent with the card details
      // This handles 3D Secure authentication automatically
      const { setupIntent, error: confirmError } = await stripe.confirmCardSetup(
        clientSecret,
        {
          payment_method: {
            card: cardNumberElement,
            billing_details: {
              name: cardholderName.trim(),
            },
          },
        }
      );

      if (confirmError) {
        // User-friendly error messages
        let userMessage = confirmError.message || 'Card setup failed';
        
        // Handle specific error types
        if (confirmError.type === 'card_error') {
          userMessage = confirmError.message || 'Your card was declined';
        } else if (confirmError.type === 'validation_error') {
          userMessage = 'Please check your card details';
        }
        
        setError(userMessage);
        console.error('[Stripe] Card setup error:', confirmError);
        return { success: false, error: userMessage };
      }

      if (!setupIntent || !setupIntent.payment_method) {
        const errorMsg = 'Card setup incomplete. Please try again.';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      // Success! Return the payment method ID
      const paymentMethodId = typeof setupIntent.payment_method === 'string'
        ? setupIntent.payment_method
        : setupIntent.payment_method.id;

      console.log('[Stripe] Card setup successful:', paymentMethodId);
      return { success: true, paymentMethodId };

    } catch (err) {
      const errorMsg = 'An unexpected error occurred. Please try again.';
      setError(errorMsg);
      console.error('[Stripe] Unexpected error:', err);
      return { success: false, error: errorMsg };
    } finally {
      setIsProcessing(false);
    }
  };

  // Clear all card elements after successful setup
  const clearCard = () => {
    const cardNumberElement = elements?.getElement(CardNumberElement);
    const cardExpiryElement = elements?.getElement(CardExpiryElement);
    const cardCvcElement = elements?.getElement(CardCvcElement);
    
    cardNumberElement?.clear();
    cardExpiryElement?.clear();
    cardCvcElement?.clear();
  };

  return {
    confirmSetup,
    clearCard,
    isProcessing,
    error,
    isReady: !!(stripe && elements),
  };
}

export default StripeCardInput;
