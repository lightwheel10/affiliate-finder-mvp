import { loadStripe, Stripe } from '@stripe/stripe-js';

// =============================================================================
// STRIPE CLIENT-SIDE CONFIGURATION
// This file is safe to import in client-side code (React components)
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
    description: 'Perfect for solo founders & small teams starting their affiliate journey.',
    monthlyPrice: 99,    // €99/month
    annualPrice: 79,     // €79/month (billed €948/year)
    annualTotal: 948,    // Total annual cost
    features: [
      'Find 500 new affiliates / month',
      '150 Verified email credits / month',
      '1 Brand Project',
      'Basic Search Filters',
      'Email Support',
      'Export to CSV',
    ],
    popular: false,
  },
  business: {
    name: 'Business',
    description: 'For growing brands that need to scale their outreach volume.',
    monthlyPrice: 249,   // €249/month
    annualPrice: 199,    // €199/month (billed €2,388/year)
    annualTotal: 2388,   // Total annual cost
    features: [
      'Find Unlimited affiliates',
      '500 Verified email credits / month',
      '5 Brand Projects',
      'Advanced Competitor Analysis',
      'Priority Chat Support',
      'API Access',
      'Team Collaboration (5 seats)',
    ],
    popular: true,
  },
  enterprise: {
    name: 'Enterprise',
    description: 'Custom solutions for large organizations with specific needs.',
    monthlyPrice: null,  // Custom pricing
    annualPrice: null,
    features: [
      'Unlimited everything',
      'Dedicated Account Manager',
      'Custom AI Model Training',
      'SSO & Advanced Security',
      'White-glove Onboarding',
      'Custom Invoicing',
    ],
    popular: false,
  },
} as const;

// Trial period in days
export const TRIAL_DAYS = 3;

// Currency symbol
export const CURRENCY_SYMBOL = '€';
