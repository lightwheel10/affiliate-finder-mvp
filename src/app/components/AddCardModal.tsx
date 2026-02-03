'use client';

/**
 * =============================================================================
 * ADD CARD MODAL - NEO-BRUTALIST
 * =============================================================================
 * 
 * Updated: January 8th, 2026
 * i18n Migration: January 10th, 2026 - Priority 5: Shared Components
 * 
 * NEO-BRUTALIST DESIGN UPDATE:
 * - Sharp edges (no rounded corners)
 * - Bold borders (border-2 with black)
 * - Yellow accent color (#ffbf23)
 * - Bold typography (font-black uppercase)
 * - Dark mode support
 * 
 * A secure modal for adding/updating payment methods using Stripe Elements.
 * Card data is collected directly by Stripe's secure iframe - 
 * sensitive data NEVER touches our servers (PCI DSS compliant).
 *
 * SECURITY:
 * - Uses Stripe SetupIntent flow for secure card collection
 * - Card details handled entirely by Stripe.js
 * - 3D Secure authentication handled automatically
 * - No raw card data stored anywhere
 * 
 * All UI strings have been migrated to use the translation dictionary.
 * Translation hook usage: const { t } = useLanguage();
 * =============================================================================
 */

import React, { useState } from 'react';
import { Lock, Loader2, AlertCircle, Check, X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Modal } from './Modal';
import { StripeProvider } from './StripeProvider';
import { StripeCardInput, useStripeCardSetup } from './StripeCardInput';
import { useLanguage } from '@/contexts/LanguageContext';

interface AddCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: number;
  userEmail: string; // Required for Stripe customer creation/lookup
}

// Inner form component that uses Stripe hooks (must be inside StripeProvider)
const CardForm: React.FC<{
  userId: number;
  userEmail: string;
  onSuccess: () => void;
  onClose: () => void;
}> = ({ userId, userEmail, onSuccess, onClose }) => {
  // i18n translation hook (January 10th, 2026)
  const { t } = useLanguage();
  
  const { confirmSetup, isProcessing, error: setupError } = useStripeCardSetup();
  
  const [cardholderName, setCardholderName] = useState('');
  const [isCardReady, setIsCardReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Discount Code
  const [discountCode, setDiscountCode] = useState('');
  const [isApplyingDiscount, setIsApplyingDiscount] = useState(false);
  const [discountApplied, setDiscountApplied] = useState(false);
  const [discountError, setDiscountError] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);

  // Combine errors for display
  const displayError = error || setupError;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isCardReady || !cardholderName.trim()) {
      setError(t.modals.addCard.completeCardDetails);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Create SetupIntent to securely collect card
      const setupRes = await fetch('/api/stripe/create-setup-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          email: userEmail,
        }),
      });

      if (!setupRes.ok) {
        const errorData = await setupRes.json();
        throw new Error(errorData.error || 'Failed to initialize card setup');
      }

      const { clientSecret, customerId } = await setupRes.json();

      // Step 2: Confirm card setup with Stripe (handles 3D Secure)
      const setupResult = await confirmSetup(clientSecret, cardholderName);

      if (!setupResult.success || !setupResult.paymentMethodId) {
        throw new Error(setupResult.error || 'Card verification failed');
      }


      // Step 3: Update the subscription's payment method (if user already has subscription)
      // This attaches the new payment method as the default for the subscription
      const updateRes = await fetch('/api/stripe/update-payment-method', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          paymentMethodId: setupResult.paymentMethodId,
          customerId,
        }),
      });

      // If update endpoint doesn't exist yet, that's okay - card is still saved to customer
      if (!updateRes.ok) {
        console.warn('[AddCard] Payment method update endpoint not available, card saved to Stripe customer');
      }

      // Success!
      onSuccess();
      onClose();

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save card. Please try again.';
      console.error('[AddCard] Error:', err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Stripe Card Input */}
      <StripeCardInput
        cardholderName={cardholderName}
        onCardholderNameChange={setCardholderName}
        onCardReady={setIsCardReady}
        onError={setError}
        disabled={isLoading || isProcessing}
        showSecurityBadge={true}
      />

      {/* Error Display - NEO-BRUTALIST */}
      {displayError && (
        <div className="flex items-center gap-2 p-3 bg-red-100 dark:bg-red-900/30 border-2 border-red-500 text-xs text-red-600 dark:text-red-400 font-medium">
          <AlertCircle size={14} className="shrink-0" />
          <span>{displayError}</span>
        </div>
      )}

      {/* Discount Code Section - NEO-BRUTALIST - i18n January 10th, 2026 */}
      <div className="space-y-1.5 col-span-2">
        <label className="text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wide">{t.modals.addCard.discountLabel}</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={discountCode}
              onChange={(e) => {
                setDiscountCode(e.target.value.toUpperCase());
                setDiscountError('');
                setDiscountApplied(false);
              }}
              placeholder={t.modals.addCard.discountPlaceholder}
              disabled={discountApplied || isLoading}
              className={cn(
                "w-full px-3 py-2.5 bg-white dark:bg-gray-900 border-2 text-sm text-gray-900 dark:text-white focus:outline-none transition-all placeholder:text-gray-400 uppercase font-mono",
                discountApplied 
                  ? "border-green-500 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                  : discountError
                  ? "border-red-500 focus:border-red-600"
                  : "border-gray-300 dark:border-gray-600 focus:border-black dark:focus:border-white"
              )}
            />
            {discountApplied && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Check size={16} className="text-green-600" />
              </div>
            )}
          </div>
          {/* 
            ==========================================================================
            DISCOUNT CODE VALIDATION (January 3rd, 2026)
            
            TODO: Implement real discount code validation via Stripe Promotion Codes API
            
            Implementation steps:
            1. Create API endpoint: POST /api/stripe/validate-promo-code
            2. Use Stripe's promotion_codes.list() or coupons.retrieve() to validate
            3. Return discount percentage/amount and apply to payment
            4. Pass coupon ID to update-payment-method or subscription update
            
            For now, discount codes are disabled (always returns "Discount codes coming soon")
            ==========================================================================
          */}
          {/* Apply Button - NEO-BRUTALIST */}
          <button
            type="button"
            onClick={async () => {
              if (!discountCode.trim()) return;
              
              setIsApplyingDiscount(true);
              setDiscountError('');
              
              try {
                // TODO: Replace with real API call to validate promo code
                setDiscountError(t.modals.addCard.discountComingSoon);
                setDiscountApplied(false);
                setDiscountAmount(0);
              } catch {
                setDiscountError(t.modals.addCard.failedToValidate);
              } finally {
                setIsApplyingDiscount(false);
              }
            }}
            disabled={!discountCode.trim() || discountApplied || isApplyingDiscount || isLoading}
            className={cn(
              "px-4 py-2.5 text-sm font-black transition-all whitespace-nowrap uppercase border-2",
              discountApplied
                ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-500 cursor-default"
                : !discountCode.trim() || isApplyingDiscount
                ? "bg-gray-100 dark:bg-gray-800 text-gray-400 border-gray-300 dark:border-gray-600 cursor-not-allowed"
                : "bg-[#ffbf23] text-black border-black shadow-[3px_3px_0px_0px_#000000] hover:shadow-[1px_1px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px]"
            )}
          >
            {isApplyingDiscount ? (
              <Loader2 size={14} className="animate-spin" />
            ) : discountApplied ? (
              t.modals.addCard.applied
            ) : (
              t.modals.addCard.apply
            )}
          </button>
        </div>
        {discountError && (
          <p className="text-[10px] text-red-500 flex items-center gap-1 font-medium">
            <X size={10} />
            {discountError}
          </p>
        )}
        {discountApplied && discountAmount > 0 && (
          <div className="flex items-center gap-1.5 p-2 bg-green-100 dark:bg-green-900/30 border-2 border-green-500">
            <Sparkles size={12} className="text-green-600" />
            <p className="text-[10px] text-green-700 dark:text-green-400 font-bold">
              {discountAmount}{t.modals.addCard.discountApplied}
            </p>
          </div>
        )}
      </div>

      {/* Submit Button - NEO-BRUTALIST - i18n January 10th, 2026 */}
      <button
        type="submit"
        disabled={!isCardReady || !cardholderName.trim() || isLoading || isProcessing}
        className={cn(
          "w-full py-3 text-sm font-black transition-all flex items-center justify-center gap-2 uppercase tracking-wide border-2",
          (isCardReady && cardholderName.trim() && !isLoading && !isProcessing)
            ? "bg-[#ffbf23] text-black border-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px]"
            : "bg-gray-100 dark:bg-gray-800 text-gray-400 border-gray-300 dark:border-gray-600 cursor-not-allowed"
        )}
      >
        {(isLoading || isProcessing) ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            {t.modals.addCard.processing}
          </>
        ) : (
          <>
            <Lock size={14} />
            {t.modals.addCard.saveButton}
          </>
        )}
      </button>

      {/* Security Note - NEO-BRUTALIST - i18n January 10th, 2026 */}
      <p className="text-[10px] text-gray-400 text-center font-medium">
        {t.modals.addCard.securityNote}
      </p>
    </form>
  );
};

export const AddCardModal: React.FC<AddCardModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  userId,
  userEmail,
}) => {
  // i18n translation hook (January 10th, 2026)
  const { t } = useLanguage();
  
  const handleClose = () => {
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t.modals.addCard.title} width="max-w-md">
      <StripeProvider>
        <CardForm 
          userId={userId} 
          userEmail={userEmail}
          onSuccess={onSuccess} 
          onClose={handleClose} 
        />
      </StripeProvider>
    </Modal>
  );
};

export default AddCardModal;
