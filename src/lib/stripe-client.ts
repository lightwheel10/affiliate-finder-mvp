import { loadStripe, Stripe } from '@stripe/stripe-js';

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
    monthlyPrice: 99,    // €99/month
    annualPrice: 79,     // €79/month (billed €948/year)
    annualTotal: 948,    // Total annual cost
    features: [
      'Find 75 new affiliates / month',
      '30 verified email credits / month',
      '30 hyper-personalized mail credits',
      '1 brand project',
      'Search filters included',
      'Self-service (no support)',
      'Export to CSV',
    ],
    popular: true,
  },
  business: {
    name: 'Business Class',
    description: 'For growing brands that need more reach, more brands and e-mail support.',
    monthlyPrice: 249,   // €249/month
    annualPrice: 199,    // €199/month (billed €2,388/year)
    annualTotal: 2388,   // Total annual cost
    features: [
      'Everything in Pro +',
      'Find unlimited affiliates',
      '150 verified email credits / month',
      '150 hyper-personalized mail credits',
      '5 brand projects',
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
