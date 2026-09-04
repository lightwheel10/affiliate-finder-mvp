export const UNLIMITED = -1 as const;

export const SEARCH_INPUT_LIMITS = {
  maxKeywords: 5,
  maxCompetitors: 5,
  maxSources: 4,
} as const;

export const PLAN_CATALOG = {
  free_trial: {
    purchasable: false,
    pricing: null,
    credits: { topicSearches: 1, email: 30, ai: 30 },
    entitlements: {
      maxBrands: 1,
      maxLocationsPerAccount: 1,
    },
  },
  pro: {
    purchasable: true,
    pricing: {
      monthlyEur: 99,
      annualMonthlyEquivalentEur: 79,
      annualTotalEur: 948,
    },
    credits: { topicSearches: 5, email: 30, ai: 30 },
    entitlements: {
      maxBrands: 1,
      maxLocationsPerAccount: 2,
    },
  },
  business: {
    purchasable: true,
    pricing: {
      monthlyEur: 249,
      annualMonthlyEquivalentEur: 199,
      annualTotalEur: 2388,
    },
    credits: { topicSearches: 10, email: 150, ai: 150 },
    entitlements: {
      maxBrands: 5,
      maxLocationsPerAccount: 5,
    },
  },
  enterprise: {
    purchasable: false,
    pricing: null,
    credits: {
      topicSearches: UNLIMITED,
      email: UNLIMITED,
      ai: UNLIMITED,
    },
    entitlements: {
      maxBrands: UNLIMITED,
      maxLocationsPerAccount: UNLIMITED,
    },
  },
} as const;

export type PlanId = keyof typeof PLAN_CATALOG;
export type PurchasablePlanId = 'pro' | 'business';

export const PURCHASABLE_PLAN_IDS = ['pro', 'business'] as const satisfies readonly PurchasablePlanId[];

export function isPurchasablePlanId(value: string): value is PurchasablePlanId {
  return (PURCHASABLE_PLAN_IDS as readonly string[]).includes(value);
}

function comparableLimit(limit: number): number {
  return limit === UNLIMITED ? Number.POSITIVE_INFINITY : limit;
}

/** True only when the destination expands capacity without reducing another limit. */
export function isPlanCapacityIncrease(fromPlan: PlanId, toPlan: PlanId): boolean {
  const from = PLAN_CATALOG[fromPlan].entitlements;
  const to = PLAN_CATALOG[toPlan].entitlements;
  const brandChange = comparableLimit(to.maxBrands) - comparableLimit(from.maxBrands);
  const locationChange = comparableLimit(to.maxLocationsPerAccount)
    - comparableLimit(from.maxLocationsPerAccount);
  return brandChange >= 0 && locationChange >= 0 && (brandChange > 0 || locationChange > 0);
}
