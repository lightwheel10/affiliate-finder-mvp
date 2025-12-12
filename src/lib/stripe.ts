import Stripe from 'stripe';

// =============================================================================
// STRIPE SERVER-SIDE CONFIGURATION
// This file should only be imported in server-side code (API routes)
// =============================================================================

// Initialize Stripe with secret key (server-side only)
// API version is pinned to ensure consistent behavior across deployments
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-11-17.clover', // Pinned API version - update carefully after testing
  typescript: true,
});

// =============================================================================
// PRICE IDs MAPPING
// Maps our plan names to Stripe Price IDs
// =============================================================================
export const STRIPE_PRICE_IDS = {
  pro: {
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY!,
    annual: process.env.STRIPE_PRICE_PRO_ANNUAL!,
  },
  business: {
    monthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY!,
    annual: process.env.STRIPE_PRICE_BUSINESS_ANNUAL!,
  },
} as const;

// =============================================================================
// PLAN DETAILS (for reference and validation)
// Prices in EUR cents for internal calculations
// =============================================================================
export const PLAN_DETAILS = {
  pro: {
    name: 'Pro',
    monthly: {
      amount: 9900, // €99.00 in cents
      priceId: process.env.STRIPE_PRICE_PRO_MONTHLY!,
      interval: 'month' as const,
    },
    annual: {
      amount: 94800, // €948.00 in cents (€79/mo)
      priceId: process.env.STRIPE_PRICE_PRO_ANNUAL!,
      interval: 'year' as const,
    },
  },
  business: {
    name: 'Business',
    monthly: {
      amount: 24900, // €249.00 in cents
      priceId: process.env.STRIPE_PRICE_BUSINESS_MONTHLY!,
      interval: 'month' as const,
    },
    annual: {
      amount: 238800, // €2,388.00 in cents (€199/mo)
      priceId: process.env.STRIPE_PRICE_BUSINESS_ANNUAL!,
      interval: 'year' as const,
    },
  },
} as const;

// =============================================================================
// TRIAL CONFIGURATION
// =============================================================================
export const TRIAL_DAYS = parseInt(process.env.STRIPE_TRIAL_DAYS || '3', 10);

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get the Stripe Price ID for a given plan and billing interval
 */
export function getPriceId(
  plan: 'pro' | 'business',
  interval: 'monthly' | 'annual'
): string {
  return STRIPE_PRICE_IDS[plan][interval];
}

/**
 * Validate that a plan name is valid
 */
export function isValidPlan(plan: string): plan is 'pro' | 'business' {
  return plan === 'pro' || plan === 'business';
}

/**
 * Validate that a billing interval is valid
 */
export function isValidInterval(interval: string): interval is 'monthly' | 'annual' {
  return interval === 'monthly' || interval === 'annual';
}

/**
 * Get plan details by plan name
 */
export function getPlanDetails(plan: 'pro' | 'business') {
  return PLAN_DETAILS[plan];
}

/**
 * Format amount from cents to display string (EUR)
 */
export function formatAmountEUR(amountInCents: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amountInCents / 100);
}
