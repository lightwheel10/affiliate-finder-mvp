import { loadStripe, Stripe } from '@stripe/stripe-js';
import { PLAN_CATALOG } from './plans/catalog';

// =============================================================================
// STRIPE CLIENT-SIDE CONFIGURATION
// This file is safe to import in client-side code (React components)
// 
// API Keys configured: 29th December 2025 (REV-68)
// Using SANDBOX/TEST keys for development. Switch to live keys for production.
// =============================================================================

// Singleton promise for Stripe instance
let stripePromise: Promise<Stripe | null> | null = null;

/**
 * Get the Stripe.js instance (singleton pattern)
 * Uses the publishable key from environment variables
 */
export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    
    if (!publishableKey) {
      console.error('Stripe publishable key is not set');
      return Promise.resolve(null);
    }
    
    stripePromise = loadStripe(publishableKey);
  }
  
  return stripePromise;
}

// =============================================================================
// PLAN PRICING FOR CLIENT-SIDE DISPLAY
// Note: These are display values only. Actual charges use Stripe Price IDs.
// =============================================================================
export const PLAN_PRICING = {
  pro: {
    name: 'Pro',
    description: 'For growing e-commerce & SaaS brands ready to scale their affiliate channel.',
    monthlyPrice: PLAN_CATALOG.pro.pricing.monthlyEur,
    annualPrice: PLAN_CATALOG.pro.pricing.annualMonthlyEquivalentEur,
    annualTotal: PLAN_CATALOG.pro.pricing.annualTotalEur,
    features: [
      'Find 75 new affiliates / month',
      '30 verified email credits / month',
      '30 hyper-personalized mail credits',
      `${PLAN_CATALOG.pro.entitlements.maxBrands} brand project`,
      'Search filters included',
      'Self-service (no support)',
      'Export to CSV',
    ],
    popular: true,
  },
  business: {
    name: 'Business Class',
    description: 'For growing brands that need more reach, more brands and e-mail support.',
    monthlyPrice: PLAN_CATALOG.business.pricing.monthlyEur,
    annualPrice: PLAN_CATALOG.business.pricing.annualMonthlyEquivalentEur,
    annualTotal: PLAN_CATALOG.business.pricing.annualTotalEur,
    features: [
      'Everything in Pro +',
      'Find unlimited affiliates',
      '150 verified email credits / month',
      '150 hyper-personalized mail credits',
      `${PLAN_CATALOG.business.entitlements.maxBrands} brand projects`,
      'E-mail support',
    ],
    popular: false,
  },
  enterprise: {
    name: 'Enterprise',
    description: 'For large organizations with custom discovery and scale needs.',
    monthlyPrice: null,  // Custom pricing
    annualPrice: null,
    features: [
      'Everything in Growth +',
      'Custom scan frequency',
      'Unlimited brand portfolio',
      'Unlimited team access',
      'API access & webhooks',
      '24/7 priority support',
    ],
    popular: false,
  },
} as const;

// Trial period in days
export const TRIAL_DAYS = 3;

// Currency symbol
export const CURRENCY_SYMBOL = '€';
