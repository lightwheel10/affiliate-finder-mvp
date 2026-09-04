const POSTGRES_INTEGER_MAX = 2_147_483_647;

export type LegacyAffiliateAccountId = string | number | null | undefined;

export type AffiliateRequestContextErrorCode =
  | 'UNAUTHORIZED'
  | 'INVALID_ACCOUNT_ID'
  | 'ACCOUNT_NOT_FOUND'
  | 'ACCOUNT_MISMATCH'
  | 'INVALID_BRAND_LOCATION_ID'
  | 'MIXED_BRAND_LOCATION_SCOPE'
  | 'BRAND_LOCATION_NOT_FOUND'
  | 'DEFAULT_BRAND_LOCATION_NOT_FOUND'
  | 'BRAND_LOCATION_INTEGRITY_ERROR';

export class AffiliateRequestContextError extends Error {
  constructor(
    public readonly code: AffiliateRequestContextErrorCode,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AffiliateRequestContextError';
  }
}

/**
 * The authenticated session is authoritative. `userId` remains accepted only
 * as a backwards-compatibility assertion for existing clients; partial values
 * such as "12abc", floats, zero, and PostgreSQL-incompatible integers fail.
 */
export function normalizeLegacyAffiliateAccountId(
  value: LegacyAffiliateAccountId,
): number | undefined {
  if (value === null || value === undefined) return undefined;

  let normalized: number;
  if (typeof value === 'number') {
    normalized = value;
  } else {
    const trimmed = value.trim();
    if (!/^[1-9][0-9]*$/.test(trimmed)) {
      throw new AffiliateRequestContextError(
        'INVALID_ACCOUNT_ID',
        400,
        'User ID must be a positive integer.',
      );
    }
    normalized = Number(trimmed);
  }

  if (
    !Number.isSafeInteger(normalized)
    || normalized <= 0
    || normalized > POSTGRES_INTEGER_MAX
  ) {
    throw new AffiliateRequestContextError(
      'INVALID_ACCOUNT_ID',
      400,
      'User ID must be a positive PostgreSQL integer.',
    );
  }

  return normalized;
}

const MAX_AFFILIATE_LOCATION_SCOPE = 50;

/**
 * Normalize repeated brandLocationId query parameters without trusting the
 * browser. Duplicate IDs are collapsed and an intentionally small ceiling
 * prevents one request from causing unbounded location-resolution work.
 */
export function normalizeRequestedAffiliateLocationIds(
  values: readonly string[],
): string[] | undefined {
  if (values.length === 0) return undefined;
  if (values.length > MAX_AFFILIATE_LOCATION_SCOPE) {
    throw new AffiliateRequestContextError(
      'INVALID_BRAND_LOCATION_ID',
      400,
      `No more than ${MAX_AFFILIATE_LOCATION_SCOPE} locations may be requested.`,
    );
  }
  const normalized = values.map((value) => {
    const trimmed = value.trim();
    if (!/^[1-9][0-9]{0,18}$/.test(trimmed)) {
      throw new AffiliateRequestContextError(
        'INVALID_BRAND_LOCATION_ID',
        400,
        'Brand location ID must be a positive PostgreSQL bigint.',
      );
    }
    const canonical = BigInt(trimmed).toString();
    if (BigInt(canonical) > BigInt('9223372036854775807')) {
      throw new AffiliateRequestContextError(
        'INVALID_BRAND_LOCATION_ID',
        400,
        'Brand location ID exceeds the PostgreSQL bigint range.',
      );
    }
    return canonical;
  });
  return Array.from(new Set(normalized));
}
