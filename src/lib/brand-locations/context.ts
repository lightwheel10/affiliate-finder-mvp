export const POSTGRES_BIGINT_MAX = BigInt('9223372036854775807');

export type RequestedBrandLocationId = string | number | null | undefined;
export type BrandLocationResolutionSource = 'requested' | 'account_default';

export interface ResolveBrandLocationContextInput {
  accountId: number;
  requestedBrandLocationId?: RequestedBrandLocationId;
}

export interface BrandLocationContextLookupInput {
  accountId: number;
  requestedBrandLocationId: string | null;
}

export interface BrandLocationContextLookupRow {
  account_id: unknown;
  brand_user_id: unknown;
  location_user_id: unknown;
  brand_id: unknown;
  brand_location_id: unknown;
  brand_name: unknown;
  normalized_domain: unknown;
  bio: unknown;
  affiliate_types: unknown;
  brand_is_default: unknown;
  brand_archived_at: unknown;
  country_code: unknown;
  language_code: unknown;
  topics: unknown;
  competitors: unknown;
  location_is_default: unknown;
  auto_scan_enabled: unknown;
  location_archived_at: unknown;
}

export type BrandLocationContextLookup = (
  input: BrandLocationContextLookupInput,
) => Promise<readonly BrandLocationContextLookupRow[]>;

export interface BrandLocationContext {
  accountId: number;
  source: BrandLocationResolutionSource;
  brand: {
    id: string;
    name: string;
    normalizedDomain: string | null;
    bio: string | null;
    affiliateTypes: string[];
    isDefault: boolean;
  };
  location: {
    id: string;
    countryCode: string | null;
    languageCode: string | null;
    topics: string[];
    competitors: string[];
    isDefault: boolean;
    autoScanEnabled: boolean;
  };
}

export type BrandLocationContextErrorCode =
  | 'INVALID_ACCOUNT_ID'
  | 'INVALID_BRAND_LOCATION_ID'
  | 'BRAND_LOCATION_NOT_FOUND'
  | 'DEFAULT_BRAND_LOCATION_NOT_FOUND'
  | 'BRAND_LOCATION_INTEGRITY_ERROR';

export class BrandLocationContextError extends Error {
  constructor(
    public readonly code: BrandLocationContextErrorCode,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'BrandLocationContextError';
  }
}

function integrityError(message: string): BrandLocationContextError {
  return new BrandLocationContextError(
    'BRAND_LOCATION_INTEGRITY_ERROR',
    500,
    message,
  );
}

function normalizePositivePostgresBigint(
  value: string | number,
  errorCode: 'INVALID_BRAND_LOCATION_ID' | 'BRAND_LOCATION_INTEGRITY_ERROR',
): string {
  let normalized: string;

  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new BrandLocationContextError(
        errorCode,
        errorCode === 'INVALID_BRAND_LOCATION_ID' ? 400 : 500,
        'Brand location ID must be a positive PostgreSQL bigint.',
      );
    }
    normalized = String(value);
  } else {
    const trimmed = value.trim();
    if (!/^[0-9]+$/.test(trimmed)) {
      throw new BrandLocationContextError(
        errorCode,
        errorCode === 'INVALID_BRAND_LOCATION_ID' ? 400 : 500,
        'Brand location ID must be a positive PostgreSQL bigint.',
      );
    }
    normalized = BigInt(trimmed).toString();
    if (normalized === '0') {
      throw new BrandLocationContextError(
        errorCode,
        errorCode === 'INVALID_BRAND_LOCATION_ID' ? 400 : 500,
        'Brand location ID must be a positive PostgreSQL bigint.',
      );
    }
  }

  if (BigInt(normalized) > POSTGRES_BIGINT_MAX) {
    throw new BrandLocationContextError(
      errorCode,
      errorCode === 'INVALID_BRAND_LOCATION_ID' ? 400 : 500,
      'Brand location ID exceeds the PostgreSQL bigint range.',
    );
  }

  return normalized;
}

export function normalizeRequestedBrandLocationId(
  value: RequestedBrandLocationId,
): string | null {
  if (value === null || value === undefined) return null;
  return normalizePositivePostgresBigint(value, 'INVALID_BRAND_LOCATION_ID');
}

function normalizeAccountId(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new BrandLocationContextError(
      'INVALID_ACCOUNT_ID',
      500,
      'Authenticated account ID must be a positive safe integer.',
    );
  }
  return value;
}

function readInteger(value: unknown, field: string): number {
  const numberValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^[1-9][0-9]*$/.test(value)
        ? Number(value)
        : Number.NaN;

  if (!Number.isSafeInteger(numberValue) || numberValue <= 0) {
    throw integrityError(field + ' is not a positive safe integer.');
  }

  return numberValue;
}

function readBigint(value: unknown, field: string): string {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw integrityError(field + ' is not a PostgreSQL bigint.');
  }

  try {
    return normalizePositivePostgresBigint(
      value,
      'BRAND_LOCATION_INTEGRITY_ERROR',
    );
  } catch (error) {
    if (error instanceof BrandLocationContextError) throw error;
    throw integrityError(field + ' is not a PostgreSQL bigint.');
  }
}

function readRequiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw integrityError(field + ' is not a non-empty string.');
  }
  return value;
}

function readNullableString(value: unknown, field: string): string | null {
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw integrityError(field + ' is not a nullable string.');
  }
  return value;
}

function readStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw integrityError(field + ' is not a string array.');
  }
  return [...value];
}

function readBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw integrityError(field + ' is not a boolean.');
  }
  return value;
}

function assertActive(value: unknown, field: string): void {
  if (value !== null) {
    throw integrityError(field + ' must be null for an active context.');
  }
}

export async function resolveBrandLocationContext(
  input: ResolveBrandLocationContextInput,
  lookup: BrandLocationContextLookup,
): Promise<BrandLocationContext> {
  const accountId = normalizeAccountId(input.accountId);
  const requestedBrandLocationId = normalizeRequestedBrandLocationId(
    input.requestedBrandLocationId,
  );
  const source: BrandLocationResolutionSource = requestedBrandLocationId
    ? 'requested'
    : 'account_default';

  const rows = await lookup({ accountId, requestedBrandLocationId });

  if (!Array.isArray(rows)) {
    throw integrityError('Brand-location lookup did not return a row array.');
  }

  if (rows.length === 0) {
    if (source === 'requested') {
      throw new BrandLocationContextError(
        'BRAND_LOCATION_NOT_FOUND',
        404,
        'Brand location was not found.',
      );
    }
    throw new BrandLocationContextError(
      'DEFAULT_BRAND_LOCATION_NOT_FOUND',
      409,
      'The account has no active default brand location.',
    );
  }

  if (rows.length !== 1) {
    throw integrityError('Brand-location lookup returned more than one context.');
  }

  const row = rows[0];
  const rowAccountId = readInteger(row.account_id, 'account_id');
  const brandOwnerId = readInteger(row.brand_user_id, 'brand_user_id');
  const locationOwnerId = readInteger(row.location_user_id, 'location_user_id');

  if (
    rowAccountId !== accountId
    || brandOwnerId !== accountId
    || locationOwnerId !== accountId
  ) {
    throw integrityError('Brand-location ownership does not match the account.');
  }

  assertActive(row.brand_archived_at, 'brand_archived_at');
  assertActive(row.location_archived_at, 'location_archived_at');

  const brandId = readBigint(row.brand_id, 'brand_id');
  const brandLocationId = readBigint(
    row.brand_location_id,
    'brand_location_id',
  );
  const brandIsDefault = readBoolean(
    row.brand_is_default,
    'brand_is_default',
  );
  const locationIsDefault = readBoolean(
    row.location_is_default,
    'location_is_default',
  );

  if (
    source === 'account_default'
    && (!brandIsDefault || !locationIsDefault)
  ) {
    throw integrityError(
      'Default resolution returned a non-default brand or location.',
    );
  }

  if (
    requestedBrandLocationId
    && brandLocationId !== requestedBrandLocationId
  ) {
    throw integrityError(
      'Requested brand location does not match the resolved location.',
    );
  }

  const countryCode = readNullableString(row.country_code, 'country_code');
  const languageCode = readNullableString(row.language_code, 'language_code');
  if ((countryCode === null) !== (languageCode === null)) {
    throw integrityError('Country and language must be configured together.');
  }
  if (
    (countryCode !== null && !/^[a-z]{2}$/.test(countryCode))
    || (languageCode !== null && !/^[a-z]{2}$/.test(languageCode))
  ) {
    throw integrityError('Country and language must use lowercase ISO codes.');
  }

  return {
    accountId,
    source,
    brand: {
      id: brandId,
      name: readRequiredString(row.brand_name, 'brand_name'),
      normalizedDomain: readNullableString(
        row.normalized_domain,
        'normalized_domain',
      ),
      bio: readNullableString(row.bio, 'bio'),
      affiliateTypes: readStringArray(
        row.affiliate_types,
        'affiliate_types',
      ),
      isDefault: brandIsDefault,
    },
    location: {
      id: brandLocationId,
      countryCode,
      languageCode,
      topics: readStringArray(row.topics, 'topics'),
      competitors: readStringArray(row.competitors, 'competitors'),
      isDefault: locationIsDefault,
      autoScanEnabled: readBoolean(
        row.auto_scan_enabled,
        'auto_scan_enabled',
      ),
    },
  };
}
