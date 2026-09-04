import 'server-only';

import {
  AffiliateRequestContextError,
  normalizeLegacyAffiliateAccountId,
  normalizeRequestedAffiliateLocationIds,
  type AffiliateRequestContextErrorCode,
  type LegacyAffiliateAccountId,
} from '@/lib/affiliates/context';
import {
  BrandLocationContextError,
  type RequestedBrandLocationId,
} from '@/lib/brand-locations/context';
import { resolveServerBrandLocationContext } from '@/lib/brand-locations/server';
import {
  legacyAccountIdMatches,
  resolveAuthenticatedAccount,
} from '@/lib/auth/account';

export interface ResolveAffiliateRequestContextInput {
  legacyAccountId?: LegacyAffiliateAccountId;
  requestedBrandLocationId?: RequestedBrandLocationId;
}

export interface ResolveAffiliateReadRequestContextInput {
  legacyAccountId?: LegacyAffiliateAccountId;
  requestedBrandLocationIds?: readonly string[];
}

export interface AffiliateRequestContext {
  accountId: number;
  brandId: string;
  brandLocationId: string;
  source: 'requested' | 'account_default';
  brand: {
    name: string;
    normalizedDomain: string | null;
    bio: string | null;
    affiliateTypes: string[];
  };
  location: {
    countryCode: string | null;
    languageCode: string | null;
    topics: string[];
    competitors: string[];
  };
}

export interface AffiliateReadRequestContext {
  accountId: number;
  brandId: string;
  brandLocationIds: string[];
}

async function resolveAffiliateAccountId(
  legacyValue: LegacyAffiliateAccountId,
): Promise<number> {
  const legacyAccountId = normalizeLegacyAffiliateAccountId(legacyValue);
  const authenticated = await resolveAuthenticatedAccount();
  if (!authenticated) {
    throw new AffiliateRequestContextError(
      'UNAUTHORIZED',
      401,
      'Unauthorized. Please sign in.',
    );
  }
  if (!authenticated.account) {
    throw new AffiliateRequestContextError(
      'ACCOUNT_NOT_FOUND',
      404,
      'User account not found. Please complete onboarding.',
    );
  }
  if (!legacyAccountIdMatches(legacyAccountId, authenticated.account.id)) {
    throw new AffiliateRequestContextError(
      'ACCOUNT_MISMATCH',
      403,
      'Not authorized to access this resource.',
    );
  }
  return authenticated.account.id;
}

function translateBrandLocationContextError(error: unknown): never {
  if (error instanceof BrandLocationContextError) {
    throw new AffiliateRequestContextError(
      error.code,
      error.status,
      error.message,
    );
  }
  throw error;
}

/**
 * One authorization boundary for every affiliate API. It derives the account
 * from Supabase Auth, treats a legacy userId only as a consistency assertion,
 * and resolves an active location owned by that account. Omitting a location
 * temporarily selects the account's active default for old clients.
 */
export async function resolveAffiliateRequestContext(
  input: ResolveAffiliateRequestContextInput,
): Promise<AffiliateRequestContext> {
  const accountId = await resolveAffiliateAccountId(input.legacyAccountId);

  try {
    const context = await resolveServerBrandLocationContext({
      accountId,
      requestedBrandLocationId: input.requestedBrandLocationId,
    });

    return {
      accountId: context.accountId,
      brandId: context.brand.id,
      brandLocationId: context.location.id,
      source: context.source,
      brand: {
        name: context.brand.name,
        normalizedDomain: context.brand.normalizedDomain,
        bio: context.brand.bio,
        affiliateTypes: context.brand.affiliateTypes,
      },
      location: {
        countryCode: context.location.countryCode,
        languageCode: context.location.languageCode,
        topics: context.location.topics,
        competitors: context.location.competitors,
      },
    };
  } catch (error) {
    translateBrandLocationContextError(error);
  }
}

/**
 * Read-only affiliate views may aggregate several active locations, but every
 * requested location must belong to the authenticated account and one brand.
 * Write APIs continue to use resolveAffiliateRequestContext and one location.
 */
export async function resolveAffiliateReadRequestContext(
  input: ResolveAffiliateReadRequestContextInput,
): Promise<AffiliateReadRequestContext> {
  const accountId = await resolveAffiliateAccountId(input.legacyAccountId);
  const requestedIds = normalizeRequestedAffiliateLocationIds(
    input.requestedBrandLocationIds ?? [],
  );
  try {
    if (!requestedIds) {
      const fallback = await resolveServerBrandLocationContext({ accountId });
      return {
        accountId,
        brandId: fallback.brand.id,
        brandLocationIds: [fallback.location.id],
      };
    }

    const contexts = await Promise.all(requestedIds.map(
      (requestedBrandLocationId) => resolveServerBrandLocationContext({
        accountId,
        requestedBrandLocationId,
      }),
    ));
    const brandId = contexts[0].brand.id;
    if (contexts.some((context) => context.brand.id !== brandId)) {
      throw new AffiliateRequestContextError(
        'MIXED_BRAND_LOCATION_SCOPE',
        400,
        'All selected locations must belong to one brand.',
      );
    }
    return {
      accountId,
      brandId,
      brandLocationIds: contexts.map((context) => context.location.id),
    };
  } catch (error) {
    if (error instanceof AffiliateRequestContextError) throw error;
    translateBrandLocationContextError(error);
  }
}

export function affiliateRequestErrorResponse(error: unknown): {
  body: { error: string; code: AffiliateRequestContextErrorCode };
  status: number;
} | null {
  if (!(error instanceof AffiliateRequestContextError)) return null;
  return {
    body: { error: error.message, code: error.code },
    status: error.status,
  };
}
