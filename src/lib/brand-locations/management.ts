import { normalizeBrandDomain } from '@/lib/brands/domain';
import {
  getMarketCountryByIsoCode,
  getMarketLanguageByIsoCode,
} from '@/lib/markets/catalog';
import {
  PLAN_CATALOG,
  UNLIMITED,
  type PlanId,
} from '@/lib/plans/catalog';
import type {
  CreateBrandInput,
  CreateLocationInput,
  UpdateBrandInput,
  UpdateLocationInput,
} from '@/lib/brand-locations/management-input';

export type BrandLocationManagementErrorCode =
  | 'INVALID_IDENTIFIER'
  | 'INVALID_BRAND_DOMAIN'
  | 'UNSUPPORTED_MARKET'
  | 'ACCOUNT_NOT_FOUND'
  | 'SUBSCRIPTION_REQUIRED'
  | 'PLAN_LIMIT_REACHED'
  | 'RETAINED_HISTORY_LIMIT_REACHED'
  | 'BRAND_NOT_FOUND'
  | 'LOCATION_NOT_FOUND'
  | 'DUPLICATE_BRAND_DOMAIN'
  | 'DUPLICATE_LOCATION_MARKET'
  | 'ACTIVE_SEARCH_CONFLICT'
  | 'PENDING_DOWNGRADE_CONFLICT'
  | 'DEFAULT_CONTEXT_REQUIRED'
  | 'PARENT_BRAND_ARCHIVED'
  | 'MANAGEMENT_INTEGRITY_ERROR';

export class BrandLocationManagementError extends Error {
  constructor(
    public readonly code: BrandLocationManagementErrorCode,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'BrandLocationManagementError';
  }
}

export interface CapacitySubscription {
  plan: unknown;
  status: unknown;
  stripeSubscriptionId: unknown;
}

export interface ManagementEntitlements {
  plan: PlanId;
  maxBrands: number;
  maxLocationsPerAccount: number;
}

/**
 * Operational abuse ceilings, not commercial plan entitlements.
 *
 * Archived rows are intentionally recoverable, so active plan limits alone do
 * not bound storage. These deliberately high account-wide limits keep retained
 * history finite while leaving future paid-capacity decisions independent.
 */
export const MANAGEMENT_RESOURCE_LIMITS = Object.freeze({
  maxRetainedBrandsPerAccount: 100,
  maxRetainedLocationsPerAccount: 500,
});

export interface PreparedBrandWrite {
  name: string;
  normalizedDomain: string;
  bio: string | null;
  affiliateTypes: readonly string[];
}

export interface PreparedBrandPatch {
  name?: string;
  normalizedDomain?: string;
  bio?: string | null;
  affiliateTypes?: readonly string[];
}

export interface PreparedLocationWrite {
  countryCode: string;
  languageCode: string;
  topics: readonly string[];
  competitors: readonly string[];
}

export interface PreparedLocationPatch {
  countryCode?: string;
  languageCode?: string;
  topics?: readonly string[];
  competitors?: readonly string[];
}

function managementIntegrityError(message: string) {
  return new BrandLocationManagementError(
    'MANAGEMENT_INTEGRITY_ERROR',
    500,
    message,
  );
}

export function normalizeManagementId(value: unknown, label: string): string {
  const candidate = typeof value === 'number'
    ? Number.isSafeInteger(value) ? String(value) : ''
    : typeof value === 'string' ? value.trim() : '';
  if (!/^[0-9]+$/.test(candidate) || !/[1-9]/.test(candidate)) {
    throw new BrandLocationManagementError(
      'INVALID_IDENTIFIER',
      400,
      `${label} must be a positive integer.`,
    );
  }
  try {
    if (BigInt(candidate) > BigInt('9223372036854775807')) throw new Error();
  } catch {
    throw new BrandLocationManagementError(
      'INVALID_IDENTIFIER',
      400,
      `${label} is outside the supported identifier range.`,
    );
  }
  return BigInt(candidate).toString();
}

export function resolveCapacityEntitlements(
  subscription: CapacitySubscription | null,
): ManagementEntitlements {
  if (
    !subscription
    || typeof subscription.stripeSubscriptionId !== 'string'
    || subscription.stripeSubscriptionId.trim() === ''
    || (subscription.status !== 'active' && subscription.status !== 'trialing')
  ) {
    throw new BrandLocationManagementError(
      'SUBSCRIPTION_REQUIRED',
      402,
      'An active or trialing subscription is required to add or restore capacity.',
    );
  }
  if (
    typeof subscription.plan !== 'string'
    || !(subscription.plan in PLAN_CATALOG)
  ) {
    throw managementIntegrityError('The subscription plan is not recognized.');
  }

  const plan = subscription.plan as PlanId;
  return {
    plan,
    maxBrands: PLAN_CATALOG[plan].entitlements.maxBrands,
    maxLocationsPerAccount:
      PLAN_CATALOG[plan].entitlements.maxLocationsPerAccount,
  };
}

export function assertCapacityAvailable(
  activeCount: number,
  limit: number,
  kind: 'brands' | 'locations',
): void {
  if (!Number.isSafeInteger(activeCount) || activeCount < 0) {
    throw managementIntegrityError(`The active ${kind} count is invalid.`);
  }
  if (limit !== UNLIMITED && activeCount >= limit) {
    throw new BrandLocationManagementError(
      'PLAN_LIMIT_REACHED',
      403,
      `The account has reached its active ${kind} limit of ${limit}.`,
    );
  }
}

export function assertRetainedHistoryCapacityAvailable(
  retainedCount: number,
  limit: number,
  kind: 'brands' | 'locations',
): void {
  if (!Number.isSafeInteger(retainedCount) || retainedCount < 0) {
    throw managementIntegrityError(`The retained ${kind} count is invalid.`);
  }
  if (!Number.isSafeInteger(limit) || limit <= 0) {
    throw managementIntegrityError(`The retained ${kind} safety limit is invalid.`);
  }
  if (retainedCount >= limit) {
    throw new BrandLocationManagementError(
      'RETAINED_HISTORY_LIMIT_REACHED',
      409,
      `The account has reached its retained ${kind} safety limit of ${limit}. Restore an archived item or contact support before adding another.`,
    );
  }
}

function prepareDomain(domain: string): string {
  const normalizedDomain = normalizeBrandDomain(domain);
  if (!normalizedDomain) {
    throw new BrandLocationManagementError(
      'INVALID_BRAND_DOMAIN',
      400,
      'Brand must contain a valid public website domain.',
    );
  }
  return normalizedDomain;
}

function prepareMarket(countryCode: string, languageCode: string) {
  const country = getMarketCountryByIsoCode(countryCode);
  const language = getMarketLanguageByIsoCode(languageCode);
  if (!country || !language) {
    throw new BrandLocationManagementError(
      'UNSUPPORTED_MARKET',
      400,
      'Country and language must come from the supported market catalogue.',
    );
  }
  return { countryCode: country.isoCode, languageCode: language.isoCode };
}

export function prepareBrandWrite(input: CreateBrandInput): PreparedBrandWrite {
  return {
    name: input.name,
    normalizedDomain: prepareDomain(input.domain),
    bio: input.bio === undefined || input.bio === '' ? null : input.bio,
    affiliateTypes: [...input.affiliateTypes],
  };
}

export function prepareBrandPatch(input: UpdateBrandInput): PreparedBrandPatch {
  return {
    ...(input.name === undefined ? {} : { name: input.name }),
    ...(input.domain === undefined
      ? {}
      : { normalizedDomain: prepareDomain(input.domain) }),
    ...(input.bio === undefined
      ? {}
      : { bio: input.bio === '' ? null : input.bio }),
    ...(input.affiliateTypes === undefined
      ? {}
      : { affiliateTypes: [...input.affiliateTypes] }),
  };
}

export function prepareLocationWrite(
  input: CreateLocationInput,
): PreparedLocationWrite {
  return {
    ...prepareMarket(input.countryCode, input.languageCode),
    topics: [...input.topics],
    competitors: [...input.competitors],
  };
}

export function prepareLocationPatch(
  input: UpdateLocationInput,
): PreparedLocationPatch {
  const market = input.countryCode === undefined
    ? {}
    : prepareMarket(input.countryCode, input.languageCode!);
  return {
    ...market,
    ...(input.topics === undefined ? {} : { topics: [...input.topics] }),
    ...(input.competitors === undefined
      ? {}
      : { competitors: [...input.competitors] }),
  };
}
