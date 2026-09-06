import 'server-only';

import type { NextRequest } from 'next/server';

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
import {
  AFFILIATE_BATCH_BODY_MAX_BYTES,
  AFFILIATE_DELETE_BATCH_MAX_ITEMS,
} from '@/lib/affiliates/mutation-limits';

export const MAX_AFFILIATE_MUTATION_BODY_BYTES = 64 * 1_024;
export const MAX_AFFILIATE_BATCH_BODY_BYTES = AFFILIATE_BATCH_BODY_MAX_BYTES;
export const MAX_OUTREACH_MUTATION_BODY_BYTES = 64 * 1_024;

const MAX_AFFILIATE_JSON_STRING_CHARS = 16 * 1_024;
const MAX_AFFILIATE_JSON_OBJECT_KEYS = 100;
const MAX_AFFILIATE_JSON_DEPTH = 8;

export type AffiliateRequestGuardErrorCode =
  | 'INVALID_JSON'
  | 'INVALID_INPUT'
  | 'REQUEST_TOO_LARGE'
  | 'TOO_MANY_ITEMS';

export class AffiliateRequestGuardError extends Error {
  constructor(
    public readonly code: AffiliateRequestGuardErrorCode,
    public readonly status: 400 | 413,
    message: string,
  ) {
    super(message);
    this.name = 'AffiliateRequestGuardError';
  }
}

function requestGuardError(
  code: AffiliateRequestGuardErrorCode,
  status: 400 | 413,
  message: string,
): AffiliateRequestGuardError {
  return new AffiliateRequestGuardError(code, status, message);
}

function assertBoundedJsonStructure(value: unknown, depth = 0): void {
  if (depth > MAX_AFFILIATE_JSON_DEPTH) {
    throw requestGuardError('INVALID_INPUT', 400, 'Request input is too deeply nested.');
  }
  if (typeof value === 'string') {
    if (value.length > MAX_AFFILIATE_JSON_STRING_CHARS) {
      throw requestGuardError('REQUEST_TOO_LARGE', 413, 'Request input contains oversized text.');
    }
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > AFFILIATE_DELETE_BATCH_MAX_ITEMS) {
      throw requestGuardError('TOO_MANY_ITEMS', 413, 'Request contains too many items.');
    }
    for (const item of value) assertBoundedJsonStructure(item, depth + 1);
    return;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length > MAX_AFFILIATE_JSON_OBJECT_KEYS) {
      throw requestGuardError('INVALID_INPUT', 400, 'Request input contains too many fields.');
    }
    for (const [, item] of entries) assertBoundedJsonStructure(item, depth + 1);
  }
}

/**
 * Reads one affiliate mutation without trusting Content-Length. Existing
 * clients may omit that header, so the real stream is always counted before
 * JSON parsing and before any database or provider work can begin.
 */
// The route-specific checks retain the same flexible payload shape previously
// returned by request.json(); this helper owns resource bounds, not field schemas.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AffiliateMutationJson = Record<string, any>;

export async function readAffiliateMutationJson(
  request: NextRequest,
  maxBytes = MAX_AFFILIATE_MUTATION_BODY_BYTES,
): Promise<AffiliateMutationJson> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new Error('Affiliate mutation body limit is invalid.');
  }

  const declaredLength = request.headers.get('content-length');
  if (declaredLength !== null) {
    const bytes = Number(declaredLength);
    if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > maxBytes) {
      throw requestGuardError('REQUEST_TOO_LARGE', 413, 'Request body is too large.');
    }
  }

  const reader = request.body?.getReader();
  if (!reader) {
    throw requestGuardError('INVALID_JSON', 400, 'Invalid JSON body.');
  }

  const decoder = new TextDecoder('utf-8', { fatal: true });
  let receivedBytes = 0;
  const bodyParts: string[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedBytes += value.byteLength;
      if (receivedBytes > maxBytes) {
        await reader.cancel();
        throw requestGuardError('REQUEST_TOO_LARGE', 413, 'Request body is too large.');
      }
      bodyParts.push(decoder.decode(value, { stream: true }));
    }
    bodyParts.push(decoder.decode());
  } catch (error) {
    if (error instanceof AffiliateRequestGuardError) throw error;
    throw requestGuardError('INVALID_JSON', 400, 'Invalid JSON body.');
  } finally {
    reader.releaseLock();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyParts.join(''));
  } catch {
    throw requestGuardError('INVALID_JSON', 400, 'Invalid JSON body.');
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw requestGuardError('INVALID_INPUT', 400, 'Request body must be a JSON object.');
  }
  assertBoundedJsonStructure(parsed);
  return parsed as AffiliateMutationJson;
}

export function assertAffiliateObjectBatch(
  items: unknown[],
  maxItems: number,
): asserts items is Array<Record<string, unknown>> {
  if (items.length > maxItems) {
    throw requestGuardError('TOO_MANY_ITEMS', 413, `A maximum of ${maxItems} affiliates is allowed per request.`);
  }
  if (items.some((item) => item === null || typeof item !== 'object' || Array.isArray(item))) {
    throw requestGuardError('INVALID_INPUT', 400, 'Every affiliate must be a JSON object.');
  }
}

export function assertAffiliateLinkBatch(
  links: unknown[],
  maxItems: number,
): asserts links is string[] {
  if (links.length > maxItems) {
    throw requestGuardError('TOO_MANY_ITEMS', 413, `A maximum of ${maxItems} links is allowed per request.`);
  }
  if (links.some((link) => typeof link !== 'string' || link.length === 0)) {
    throw requestGuardError('INVALID_INPUT', 400, 'Every affiliate link must be a non-empty string.');
  }
}

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
  body: { error: string; code: AffiliateRequestContextErrorCode | AffiliateRequestGuardErrorCode };
  status: number;
} | null {
  if (
    !(error instanceof AffiliateRequestContextError)
    && !(error instanceof AffiliateRequestGuardError)
  ) return null;
  return {
    body: { error: error.message, code: error.code },
    status: error.status,
  };
}
