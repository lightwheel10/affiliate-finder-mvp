import 'server-only';

import type postgres from 'postgres';
import { sql } from '@/lib/db';
import {
  assertCapacityAvailable,
  assertRetainedHistoryCapacityAvailable,
  BrandLocationManagementError,
  MANAGEMENT_RESOURCE_LIMITS,
  resolveCapacityEntitlements,
  type ManagementEntitlements,
  type PreparedBrandPatch,
  type PreparedBrandWrite,
  type PreparedLocationPatch,
  type PreparedLocationWrite,
} from '@/lib/brand-locations/management';
import type {
  ManagedBrand,
  ManagedCapacity,
  ManagedLocation,
  ManagedPortfolio,
} from '@/lib/brand-locations/portfolio';
import { assertNotRetainedByPendingDowngrade } from '@/lib/stripe/downgrade-capacity-postgres';
import { resolveRestoredLocationSchedule } from '@/lib/brand-locations/restored-location-schedule';

export type {
  ManagedBrand,
  ManagedCapacity,
  ManagedLocation,
  ManagedPortfolio,
} from '@/lib/brand-locations/portfolio';

type SqlClient = postgres.Sql;

interface AccountRow {
  id: unknown;
  auto_scan_enabled: unknown;
}

interface SubscriptionRow {
  plan: unknown;
  status: unknown;
  stripe_subscription_id: unknown;
  first_payment_at: unknown;
  next_auto_scan_at: unknown;
}

interface BrandRow {
  id: unknown;
  name: unknown;
  normalized_domain: unknown;
  bio: unknown;
  affiliate_types: unknown;
  is_default: unknown;
  archived_at: unknown;
  created_at: unknown;
  updated_at: unknown;
}

interface LocationRow {
  id: unknown;
  brand_id: unknown;
  country_code: unknown;
  language_code: unknown;
  topics: unknown;
  competitors: unknown;
  is_default: unknown;
  auto_scan_enabled: unknown;
  last_auto_scan_at: unknown;
  next_auto_scan_at: unknown;
  archived_at: unknown;
  created_at: unknown;
  updated_at: unknown;
}

interface CountRow {
  count: unknown;
}

interface ActiveWorkRow {
  has_active_work: unknown;
}

interface LockedLocationRow extends LocationRow {
  brand_is_default: unknown;
  brand_archived_at: unknown;
}

function integrityError(message: string) {
  return new BrandLocationManagementError(
    'MANAGEMENT_INTEGRITY_ERROR',
    500,
    message,
  );
}

function oneOrNull<T>(rows: readonly T[], label: string): T | null {
  if (rows.length > 1) throw integrityError(`${label} returned more than one row.`);
  return rows[0] ?? null;
}

function readAccountId(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw integrityError('The locked account ID is invalid.');
  }
  return parsed;
}

function readBigint(value: unknown, label: string): string {
  const parsed = typeof value === 'number' ? String(value) : value;
  if (typeof parsed !== 'string' || !/^[1-9][0-9]*$/.test(parsed)) {
    throw integrityError(`${label} is not a positive PostgreSQL bigint.`);
  }
  return parsed;
}

function readString(value: unknown, label: string): string {
  if (typeof value !== 'string') throw integrityError(`${label} is not text.`);
  return value;
}

function readNullableString(value: unknown, label: string): string | null {
  if (value === null || typeof value === 'string') return value;
  throw integrityError(`${label} is not nullable text.`);
}

function readBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw integrityError(`${label} is not a boolean.`);
  return value;
}

function readTextArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw integrityError(`${label} is not a text array.`);
  }
  return [...value];
}

function readTimestamp(value: unknown, label: string): string {
  const date = value instanceof Date ? value : new Date(String(value));
  if (!Number.isFinite(date.getTime())) throw integrityError(`${label} is invalid.`);
  return date.toISOString();
}

function readNullableTimestamp(value: unknown, label: string): string | null {
  return value === null ? null : readTimestamp(value, label);
}

function readCount(value: unknown, label: string): number {
  const count = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(count) || count < 0) {
    throw integrityError(`${label} is invalid.`);
  }
  return count;
}

function mapBrand(row: BrandRow): ManagedBrand {
  return {
    id: readBigint(row.id, 'Brand ID'),
    name: readString(row.name, 'Brand name'),
    normalizedDomain: readNullableString(row.normalized_domain, 'Brand domain'),
    bio: readNullableString(row.bio, 'Brand bio'),
    affiliateTypes: readTextArray(row.affiliate_types, 'Brand affiliate types'),
    isDefault: readBoolean(row.is_default, 'Brand default state'),
    archivedAt: readNullableTimestamp(row.archived_at, 'Brand archived timestamp'),
    createdAt: readTimestamp(row.created_at, 'Brand created timestamp'),
    updatedAt: readTimestamp(row.updated_at, 'Brand updated timestamp'),
    locations: [],
  };
}

function mapLocation(row: LocationRow): ManagedLocation {
  return {
    id: readBigint(row.id, 'Location ID'),
    brandId: readBigint(row.brand_id, 'Location brand ID'),
    countryCode: readNullableString(row.country_code, 'Location country code'),
    languageCode: readNullableString(row.language_code, 'Location language code'),
    topics: readTextArray(row.topics, 'Location topics'),
    competitors: readTextArray(row.competitors, 'Location competitors'),
    isDefault: readBoolean(row.is_default, 'Location default state'),
    autoScanEnabled: readBoolean(row.auto_scan_enabled, 'Location auto-scan state'),
    lastAutoScanAt: readNullableTimestamp(row.last_auto_scan_at, 'Location last scan'),
    nextAutoScanAt: readNullableTimestamp(row.next_auto_scan_at, 'Location next scan'),
    archivedAt: readNullableTimestamp(row.archived_at, 'Location archived timestamp'),
    createdAt: readTimestamp(row.created_at, 'Location created timestamp'),
    updatedAt: readTimestamp(row.updated_at, 'Location updated timestamp'),
  };
}

async function withManagementTransaction<T>(
  database: SqlClient,
  operation: (transaction: SqlClient) => Promise<T>,
): Promise<T> {
  const candidate = database as unknown as {
    begin?: (callback: (transaction: SqlClient) => Promise<T>) => Promise<T>;
    savepoint?: (callback: (transaction: SqlClient) => Promise<T>) => Promise<T>;
  };
  if (typeof candidate.begin === 'function') return candidate.begin(operation);
  if (typeof candidate.savepoint === 'function') return candidate.savepoint(operation);
  throw integrityError('Brand and location management requires a transaction.');
}

async function withManagementReadSnapshot<T>(
  database: SqlClient,
  operation: (transaction: SqlClient) => Promise<T>,
): Promise<T> {
  const candidate = database as unknown as {
    begin?: (
      options: string,
      callback: (transaction: SqlClient) => Promise<T>,
    ) => Promise<T>;
    savepoint?: (callback: (transaction: SqlClient) => Promise<T>) => Promise<T>;
  };
  if (typeof candidate.begin === 'function') {
    return candidate.begin('isolation level repeatable read read only', operation);
  }
  // A caller-provided transaction owns its isolation level. Preserve nested
  // compatibility while still keeping all portfolio statements together.
  if (typeof candidate.savepoint === 'function') return candidate.savepoint(operation);
  throw integrityError('Brand and location portfolio reads require a transaction.');
}

async function lockAccount(
  transaction: SqlClient,
  accountId: number,
): Promise<{ id: number; autoScanEnabled: boolean }> {
  const rows = await transaction<AccountRow[]>`
    SELECT id, auto_scan_enabled
    FROM crewcast.users
    WHERE id = ${accountId}
    LIMIT 2
    FOR UPDATE
  `;
  const row = oneOrNull(rows, 'Account lock');
  if (!row) {
    throw new BrandLocationManagementError(
      'ACCOUNT_NOT_FOUND',
      404,
      'The authenticated application account no longer exists.',
    );
  }
  const id = readAccountId(row.id);
  if (id !== accountId) throw integrityError('The locked account owner changed.');
  return {
    id,
    autoScanEnabled: readBoolean(row.auto_scan_enabled, 'Account auto-scan state'),
  };
}

async function readSubscription(
  executor: SqlClient,
  accountId: number,
  lock: boolean,
): Promise<SubscriptionRow | null> {
  const rows = await executor<SubscriptionRow[]>`
    SELECT
      plan,
      status,
      stripe_subscription_id,
      first_payment_at,
      next_auto_scan_at
    FROM crewcast.subscriptions
    WHERE user_id = ${accountId}
    ORDER BY id
    LIMIT 2
    ${lock ? executor`FOR UPDATE` : executor``}
  `;
  return oneOrNull(rows, 'Subscription lookup');
}

async function requireCapacityEntitlements(
  transaction: SqlClient,
  accountId: number,
): Promise<{ entitlements: ManagementEntitlements; subscription: SubscriptionRow }> {
  const subscription = await readSubscription(transaction, accountId, true);
  const entitlements = resolveCapacityEntitlements(subscription && {
    plan: subscription.plan,
    status: subscription.status,
    stripeSubscriptionId: subscription.stripe_subscription_id,
  });
  if (!subscription) throw integrityError('Capacity validation lost its subscription row.');
  return { entitlements, subscription };
}

async function countActive(
  transaction: SqlClient,
  accountId: number,
  table: 'brands' | 'brand_locations',
): Promise<number> {
  const rows = table === 'brands'
    ? await transaction<CountRow[]>`
        SELECT count(*)::integer AS count
        FROM crewcast.brands
        WHERE user_id = ${accountId} AND archived_at IS NULL
      `
    : await transaction<CountRow[]>`
        SELECT count(*)::integer AS count
        FROM crewcast.brand_locations
        WHERE user_id = ${accountId} AND archived_at IS NULL
      `;
  const row = oneOrNull(rows, `Active ${table} count`);
  if (!row) throw integrityError(`Active ${table} count returned no row.`);
  return readCount(row.count, `Active ${table} count`);
}

async function countRetainedUpToLimit(
  transaction: SqlClient,
  accountId: number,
  table: 'brands' | 'brand_locations',
  limit: number,
): Promise<number> {
  // Counting a bounded subquery avoids scanning an attacker-controlled number
  // of rows if an account was populated outside the guarded application path.
  const rows = table === 'brands'
    ? await transaction<CountRow[]>`
        SELECT count(*)::integer AS count
        FROM (
          SELECT 1
          FROM crewcast.brands
          WHERE user_id = ${accountId}
          LIMIT ${limit}
        ) AS retained
      `
    : await transaction<CountRow[]>`
        SELECT count(*)::integer AS count
        FROM (
          SELECT 1
          FROM crewcast.brand_locations
          WHERE user_id = ${accountId}
          LIMIT ${limit}
        ) AS retained
      `;
  const row = oneOrNull(rows, `Retained ${table} count`);
  if (!row) throw integrityError(`Retained ${table} count returned no row.`);
  return readCount(row.count, `Retained ${table} count`);
}

function assertPortfolioRowsBounded(
  rowCount: number,
  limit: number,
  kind: 'brands' | 'locations',
): void {
  if (rowCount > limit) {
    throw integrityError(
      `The account exceeds the retained ${kind} safety limit and requires administrative review.`,
    );
  }
}

function nextLocationSchedule(
  accountAutoScanEnabled: boolean,
  subscription: SubscriptionRow,
): { autoScanEnabled: boolean; nextAutoScanAt: string | null } {
  return resolveRestoredLocationSchedule(accountAutoScanEnabled, {
    status: readString(subscription.status, 'Subscription status'),
    firstPaymentAt: readNullableTimestamp(
      subscription.first_payment_at,
      'Subscription first payment',
    ),
    nextAutoScanAt: readNullableTimestamp(
      subscription.next_auto_scan_at,
      'Subscription next scan',
    ),
  });
}

function translateUniqueViolation(error: unknown): never {
  const databaseError = error as { code?: unknown; constraint_name?: unknown };
  if (databaseError.code === '23505') {
    if (databaseError.constraint_name === 'brands_active_domain_key') {
      throw new BrandLocationManagementError(
        'DUPLICATE_BRAND_DOMAIN',
        409,
        'An active brand already uses this domain.',
      );
    }
    if (databaseError.constraint_name === 'brand_locations_active_market_key') {
      throw new BrandLocationManagementError(
        'DUPLICATE_LOCATION_MARKET',
        409,
        'This brand already has an active location for that country and language.',
      );
    }
  }
  throw error;
}

const BRAND_COLUMNS = sql`
  id::text AS id,
  name,
  normalized_domain,
  bio,
  affiliate_types,
  is_default,
  archived_at,
  created_at,
  updated_at
`;

const LOCATION_COLUMNS = sql`
  id::text AS id,
  brand_id::text AS brand_id,
  country_code,
  language_code,
  topics,
  competitors,
  is_default,
  auto_scan_enabled,
  last_auto_scan_at,
  next_auto_scan_at,
  archived_at,
  created_at,
  updated_at
`;

const ALIASED_LOCATION_COLUMNS = sql`
  locations.id::text AS id,
  locations.brand_id::text AS brand_id,
  locations.country_code,
  locations.language_code,
  locations.topics,
  locations.competitors,
  locations.is_default,
  locations.auto_scan_enabled,
  locations.last_auto_scan_at,
  locations.next_auto_scan_at,
  locations.archived_at,
  locations.created_at,
  locations.updated_at
`;

export async function listManagedPortfolio(
  accountId: number,
  includeArchived: boolean,
  database: SqlClient = sql as SqlClient,
): Promise<ManagedPortfolio> {
  return withManagementReadSnapshot(database, async (snapshot) => {
    const [brandRows, locationRows, subscription, countRows] = await Promise.all([
      snapshot<BrandRow[]>`
      SELECT ${BRAND_COLUMNS}
      FROM crewcast.brands
      WHERE user_id = ${accountId}
        AND (${includeArchived} OR archived_at IS NULL)
      ORDER BY archived_at NULLS FIRST, is_default DESC, created_at, id
      LIMIT ${MANAGEMENT_RESOURCE_LIMITS.maxRetainedBrandsPerAccount + 1}
    `,
      snapshot<LocationRow[]>`
      SELECT ${LOCATION_COLUMNS}
      FROM crewcast.brand_locations
      WHERE user_id = ${accountId}
        AND (${includeArchived} OR archived_at IS NULL)
      ORDER BY archived_at NULLS FIRST, is_default DESC, created_at, id
      LIMIT ${MANAGEMENT_RESOURCE_LIMITS.maxRetainedLocationsPerAccount + 1}
    `,
      readSubscription(snapshot, accountId, false),
      snapshot<{ active_brands: unknown; active_locations: unknown }[]>`
      SELECT
        (SELECT count(*) FROM crewcast.brands
         WHERE user_id = ${accountId} AND archived_at IS NULL)::integer AS active_brands,
        (SELECT count(*) FROM crewcast.brand_locations
         WHERE user_id = ${accountId} AND archived_at IS NULL)::integer AS active_locations
    `,
    ]);

    // Never silently truncate archive history: cap + 1 detects legacy or
    // privileged writes that bypassed the guarded creation path.
    assertPortfolioRowsBounded(
      brandRows.length,
      MANAGEMENT_RESOURCE_LIMITS.maxRetainedBrandsPerAccount,
      'brands',
    );
    assertPortfolioRowsBounded(
      locationRows.length,
      MANAGEMENT_RESOURCE_LIMITS.maxRetainedLocationsPerAccount,
      'locations',
    );

    const brands = brandRows.map(mapBrand);
    const byId = new Map(brands.map((brand) => [brand.id, brand]));
    for (const locationRow of locationRows) {
      const location = mapLocation(locationRow);
      const parent = byId.get(location.brandId);
      if (!parent) {
        throw integrityError('A managed location has no matching portfolio brand.');
      }
      parent.locations.push(location);
    }

    let capacity: ManagedCapacity | null = null;
    if (subscription) {
      try {
        const entitlements = resolveCapacityEntitlements({
          plan: subscription.plan,
          status: subscription.status,
          stripeSubscriptionId: subscription.stripe_subscription_id,
        });
        const counts = oneOrNull(countRows, 'Portfolio capacity count');
        if (!counts) throw integrityError('Portfolio capacity count returned no row.');
        capacity = {
          ...entitlements,
          activeBrands: readCount(counts.active_brands, 'Active brand count'),
          activeLocations: readCount(counts.active_locations, 'Active location count'),
        };
      } catch (error) {
        if (
          !(error instanceof BrandLocationManagementError)
          || error.code !== 'SUBSCRIPTION_REQUIRED'
        ) throw error;
      }
    }
    return { brands, capacity };
  });
}

export async function createManagedBrand(
  accountId: number,
  input: PreparedBrandWrite,
  database: SqlClient = sql as SqlClient,
): Promise<ManagedBrand> {
  return withManagementTransaction(database, async (transaction) => {
    await lockAccount(transaction, accountId);
    const { entitlements } = await requireCapacityEntitlements(transaction, accountId);
    const activeBrands = await countActive(transaction, accountId, 'brands');
    assertCapacityAvailable(activeBrands, entitlements.maxBrands, 'brands');
    const retainedBrands = await countRetainedUpToLimit(
      transaction,
      accountId,
      'brands',
      MANAGEMENT_RESOURCE_LIMITS.maxRetainedBrandsPerAccount,
    );
    assertRetainedHistoryCapacityAvailable(
      retainedBrands,
      MANAGEMENT_RESOURCE_LIMITS.maxRetainedBrandsPerAccount,
      'brands',
    );
    try {
      const rows = await transaction<BrandRow[]>`
        INSERT INTO crewcast.brands (
          user_id, name, normalized_domain, bio, affiliate_types, is_default
        ) VALUES (
          ${accountId}, ${input.name}, ${input.normalizedDomain}, ${input.bio},
          ${input.affiliateTypes}, ${activeBrands === 0}
        )
        RETURNING ${BRAND_COLUMNS}
      `;
      const row = oneOrNull(rows, 'Brand insert');
      if (!row) throw integrityError('Brand insert returned no row.');
      return mapBrand(row);
    } catch (error) {
      return translateUniqueViolation(error);
    }
  });
}

export async function updateManagedBrand(
  accountId: number,
  brandId: string,
  patch: PreparedBrandPatch,
  database: SqlClient = sql as SqlClient,
): Promise<ManagedBrand> {
  return withManagementTransaction(database, async (transaction) => {
    await lockAccount(transaction, accountId);
    try {
      const rows = await transaction<BrandRow[]>`
        UPDATE crewcast.brands
        SET
          name = CASE WHEN ${patch.name !== undefined} THEN ${patch.name ?? null} ELSE name END,
          normalized_domain = CASE
            WHEN ${patch.normalizedDomain !== undefined}
            THEN ${patch.normalizedDomain ?? null}
            ELSE normalized_domain
          END,
          bio = CASE WHEN ${patch.bio !== undefined} THEN ${patch.bio ?? null} ELSE bio END,
          affiliate_types = CASE
            WHEN ${patch.affiliateTypes !== undefined}
            THEN ${patch.affiliateTypes ?? []}
            ELSE affiliate_types
          END
        WHERE id = ${brandId}::bigint
          AND user_id = ${accountId}
          AND archived_at IS NULL
        RETURNING ${BRAND_COLUMNS}
      `;
      const row = oneOrNull(rows, 'Brand update');
      if (!row) {
        throw new BrandLocationManagementError(
          'BRAND_NOT_FOUND',
          404,
          'Brand not found.',
        );
      }
      return mapBrand(row);
    } catch (error) {
      if (error instanceof BrandLocationManagementError) throw error;
      return translateUniqueViolation(error);
    }
  });
}

export async function createManagedLocation(
  accountId: number,
  brandId: string,
  input: PreparedLocationWrite,
  database: SqlClient = sql as SqlClient,
): Promise<ManagedLocation> {
  return withManagementTransaction(database, async (transaction) => {
    const account = await lockAccount(transaction, accountId);
    const { entitlements, subscription } = await requireCapacityEntitlements(
      transaction,
      accountId,
    );
    const brands = await transaction<{ id: unknown }[]>`
      SELECT id::text AS id
      FROM crewcast.brands
      WHERE id = ${brandId}::bigint
        AND user_id = ${accountId}
        AND archived_at IS NULL
      LIMIT 2
      FOR UPDATE
    `;
    if (!oneOrNull(brands, 'Location parent brand lock')) {
      throw new BrandLocationManagementError(
        'BRAND_NOT_FOUND',
        404,
        'Brand not found.',
      );
    }
    const activeLocations = await countActive(transaction, accountId, 'brand_locations');
    assertCapacityAvailable(
      activeLocations,
      entitlements.maxLocationsPerAccount,
      'locations',
    );
    const retainedLocations = await countRetainedUpToLimit(
      transaction,
      accountId,
      'brand_locations',
      MANAGEMENT_RESOURCE_LIMITS.maxRetainedLocationsPerAccount,
    );
    assertRetainedHistoryCapacityAvailable(
      retainedLocations,
      MANAGEMENT_RESOURCE_LIMITS.maxRetainedLocationsPerAccount,
      'locations',
    );
    const defaultCounts = await transaction<CountRow[]>`
      SELECT count(*)::integer AS count
      FROM crewcast.brand_locations
      WHERE user_id = ${accountId}
        AND brand_id = ${brandId}::bigint
        AND archived_at IS NULL
    `;
    const defaultCountRow = oneOrNull(defaultCounts, 'Brand active location count');
    if (!defaultCountRow) throw integrityError('Brand active location count returned no row.');
    const schedule = nextLocationSchedule(account.autoScanEnabled, subscription);
    try {
      const rows = await transaction<LocationRow[]>`
        INSERT INTO crewcast.brand_locations (
          user_id,
          brand_id,
          country_code,
          language_code,
          topics,
          competitors,
          is_default,
          auto_scan_enabled,
          next_auto_scan_at
        ) VALUES (
          ${accountId},
          ${brandId}::bigint,
          ${input.countryCode},
          ${input.languageCode},
          ${input.topics},
          ${input.competitors},
          ${readCount(defaultCountRow.count, 'Brand active location count') === 0},
          ${schedule.autoScanEnabled},
          ${schedule.nextAutoScanAt}
        )
        RETURNING ${LOCATION_COLUMNS}
      `;
      const row = oneOrNull(rows, 'Location insert');
      if (!row) throw integrityError('Location insert returned no row.');
      return mapLocation(row);
    } catch (error) {
      return translateUniqueViolation(error);
    }
  });
}

export async function updateManagedLocation(
  accountId: number,
  locationId: string,
  patch: PreparedLocationPatch,
  database: SqlClient = sql as SqlClient,
): Promise<ManagedLocation> {
  return withManagementTransaction(database, async (transaction) => {
    await lockAccount(transaction, accountId);
    try {
      const rows = await transaction<LocationRow[]>`
        UPDATE crewcast.brand_locations AS locations
        SET
          country_code = CASE
            WHEN ${patch.countryCode !== undefined}
            THEN ${patch.countryCode ?? null}
            ELSE country_code
          END,
          language_code = CASE
            WHEN ${patch.languageCode !== undefined}
            THEN ${patch.languageCode ?? null}
            ELSE language_code
          END,
          topics = CASE
            WHEN ${patch.topics !== undefined}
            THEN ${patch.topics ?? []}
            ELSE topics
          END,
          competitors = CASE
            WHEN ${patch.competitors !== undefined}
            THEN ${patch.competitors ?? []}
            ELSE competitors
          END
        FROM crewcast.brands AS brands
        WHERE locations.id = ${locationId}::bigint
          AND locations.user_id = ${accountId}
          AND locations.archived_at IS NULL
          AND brands.id = locations.brand_id
          AND brands.user_id = locations.user_id
          AND brands.archived_at IS NULL
        RETURNING ${ALIASED_LOCATION_COLUMNS}
      `;
      const row = oneOrNull(rows, 'Location update');
      if (!row) {
        throw new BrandLocationManagementError(
          'LOCATION_NOT_FOUND',
          404,
          'Location not found.',
        );
      }
      return mapLocation(row);
    } catch (error) {
      if (error instanceof BrandLocationManagementError) throw error;
      return translateUniqueViolation(error);
    }
  });
}

async function assertNoActiveWork(
  transaction: SqlClient,
  accountId: number,
  brandId: string,
  locationId: string | null,
): Promise<void> {
  const rows = await transaction<ActiveWorkRow[]>`
    SELECT (
      EXISTS (
        SELECT 1 FROM crewcast.search_jobs
        WHERE user_id = ${accountId}
          AND brand_id = ${brandId}::bigint
          AND (${locationId}::bigint IS NULL OR brand_location_id = ${locationId}::bigint)
          AND status NOT IN ('done', 'failed', 'timeout')
      ) OR EXISTS (
        SELECT 1 FROM crewcast.search_credit_reservations
        WHERE user_id = ${accountId}
          AND brand_id = ${brandId}::bigint
          AND (${locationId}::bigint IS NULL OR brand_location_id = ${locationId}::bigint)
          AND status IN ('reserved', 'uncertain')
      ) OR EXISTS (
        SELECT 1 FROM crewcast.search_enrichment_dispatches
        WHERE user_id = ${accountId}
          AND brand_id = ${brandId}::bigint
          AND (${locationId}::bigint IS NULL OR brand_location_id = ${locationId}::bigint)
          AND status IN ('pending', 'claimed', 'dispatching', 'running', 'uncertain')
      ) OR EXISTS (
        SELECT 1 FROM crewcast.onboarding_search_entitlements
        WHERE user_id = ${accountId}
          AND brand_id = ${brandId}::bigint
          AND (${locationId}::bigint IS NULL OR brand_location_id = ${locationId}::bigint)
          AND status IN ('reserved', 'dispatching', 'uncertain')
      ) OR EXISTS (
        SELECT 1 FROM crewcast.weekly_auto_scan_locations
        WHERE user_id = ${accountId}
          AND brand_id = ${brandId}::bigint
          AND (${locationId}::bigint IS NULL OR brand_location_id = ${locationId}::bigint)
          AND status IN ('claimed', 'dispatching', 'running')
      )
    ) AS has_active_work
  `;
  const row = oneOrNull(rows, 'Active work check');
  if (!row || typeof row.has_active_work !== 'boolean') {
    throw integrityError('Active work check returned invalid state.');
  }
  if (row.has_active_work) {
    throw new BrandLocationManagementError(
      'ACTIVE_SEARCH_CONFLICT',
      409,
      'This item cannot be archived while a search is still active.',
    );
  }
}

export async function archiveManagedLocation(
  accountId: number,
  locationId: string,
  database: SqlClient = sql as SqlClient,
): Promise<ManagedLocation> {
  return withManagementTransaction(database, async (transaction) => {
    await lockAccount(transaction, accountId);
    const rows = await transaction<LockedLocationRow[]>`
      SELECT
        ${ALIASED_LOCATION_COLUMNS},
        brands.is_default AS brand_is_default,
        brands.archived_at AS brand_archived_at
      FROM crewcast.brand_locations AS locations
      JOIN crewcast.brands AS brands
        ON brands.id = locations.brand_id
       AND brands.user_id = locations.user_id
      WHERE locations.id = ${locationId}::bigint
        AND locations.user_id = ${accountId}
        AND locations.archived_at IS NULL
        AND brands.archived_at IS NULL
      LIMIT 2
      FOR UPDATE OF brands, locations
    `;
    const location = oneOrNull(rows, 'Location archive lock');
    if (!location) {
      throw new BrandLocationManagementError(
        'LOCATION_NOT_FOUND',
        404,
        'Location not found.',
      );
    }
    const brandId = readBigint(location.brand_id, 'Location brand ID');
    await assertNotRetainedByPendingDowngrade(transaction, {
      userId: accountId,
      brandId,
      locationId,
    });
    await assertNoActiveWork(transaction, accountId, brandId, locationId);

    if (readBoolean(location.is_default, 'Location default state')) {
      const replacements = await transaction<{ id: unknown }[]>`
        SELECT id::text AS id
        FROM crewcast.brand_locations
        WHERE user_id = ${accountId}
          AND brand_id = ${brandId}::bigint
          AND id <> ${locationId}::bigint
          AND archived_at IS NULL
        ORDER BY created_at, id
        LIMIT 1
        FOR UPDATE
      `;
      const replacement = replacements[0] ?? null;
      if (!replacement && readBoolean(location.brand_is_default, 'Brand default state')) {
        throw new BrandLocationManagementError(
          'DEFAULT_CONTEXT_REQUIRED',
          409,
          'The account default brand must keep at least one active location.',
        );
      }
      await transaction`
        UPDATE crewcast.brand_locations
        SET is_default = false
        WHERE id = ${locationId}::bigint
          AND user_id = ${accountId}
          AND brand_id = ${brandId}::bigint
      `;
      if (replacement) {
        await transaction`
          UPDATE crewcast.brand_locations
          SET is_default = true
          WHERE id = ${readBigint(replacement.id, 'Replacement location ID')}::bigint
            AND user_id = ${accountId}
            AND brand_id = ${brandId}::bigint
            AND archived_at IS NULL
        `;
      }
    }

    const archived = await transaction<LocationRow[]>`
      UPDATE crewcast.brand_locations
      SET
        is_default = false,
        auto_scan_enabled = false,
        next_auto_scan_at = NULL,
        scan_claim_token = NULL,
        scan_claimed_at = NULL,
        scan_lease_expires_at = NULL,
        capacity_archived_by_plan_change_id = NULL,
        archived_at = statement_timestamp()
      WHERE id = ${locationId}::bigint
        AND user_id = ${accountId}
        AND brand_id = ${brandId}::bigint
        AND archived_at IS NULL
      RETURNING ${LOCATION_COLUMNS}
    `;
    const archivedRow = oneOrNull(archived, 'Location archive');
    if (!archivedRow) throw integrityError('Location archive lost its locked row.');
    return mapLocation(archivedRow);
  });
}

export async function restoreManagedLocation(
  accountId: number,
  locationId: string,
  database: SqlClient = sql as SqlClient,
): Promise<ManagedLocation> {
  return withManagementTransaction(database, async (transaction) => {
    const account = await lockAccount(transaction, accountId);
    const { entitlements, subscription } = await requireCapacityEntitlements(
      transaction,
      accountId,
    );
    const rows = await transaction<LockedLocationRow[]>`
      SELECT
        ${ALIASED_LOCATION_COLUMNS},
        brands.is_default AS brand_is_default,
        brands.archived_at AS brand_archived_at
      FROM crewcast.brand_locations AS locations
      JOIN crewcast.brands AS brands
        ON brands.id = locations.brand_id
       AND brands.user_id = locations.user_id
      WHERE locations.id = ${locationId}::bigint
        AND locations.user_id = ${accountId}
        AND locations.archived_at IS NOT NULL
      LIMIT 2
      FOR UPDATE OF brands, locations
    `;
    const location = oneOrNull(rows, 'Location restore lock');
    if (!location) {
      throw new BrandLocationManagementError(
        'LOCATION_NOT_FOUND',
        404,
        'Location not found.',
      );
    }
    if (location.brand_archived_at !== null) {
      throw new BrandLocationManagementError(
        'PARENT_BRAND_ARCHIVED',
        409,
        'Restore the parent brand before restoring this location.',
      );
    }
    const activeLocations = await countActive(transaction, accountId, 'brand_locations');
    assertCapacityAvailable(
      activeLocations,
      entitlements.maxLocationsPerAccount,
      'locations',
    );
    const brandId = readBigint(location.brand_id, 'Location brand ID');
    const defaultCounts = await transaction<CountRow[]>`
      SELECT count(*)::integer AS count
      FROM crewcast.brand_locations
      WHERE user_id = ${accountId}
        AND brand_id = ${brandId}::bigint
        AND archived_at IS NULL
    `;
    const defaultCount = oneOrNull(defaultCounts, 'Brand active location count');
    if (!defaultCount) throw integrityError('Brand active location count returned no row.');
    const schedule = nextLocationSchedule(account.autoScanEnabled, subscription);
    try {
      const restored = await transaction<LocationRow[]>`
        UPDATE crewcast.brand_locations
        SET
          is_default = ${readCount(defaultCount.count, 'Brand active location count') === 0},
          auto_scan_enabled = ${schedule.autoScanEnabled},
          next_auto_scan_at = ${schedule.nextAutoScanAt},
          capacity_archived_by_plan_change_id = NULL,
          archived_at = NULL
        WHERE id = ${locationId}::bigint
          AND user_id = ${accountId}
          AND brand_id = ${brandId}::bigint
          AND archived_at IS NOT NULL
        RETURNING ${LOCATION_COLUMNS}
      `;
      const restoredRow = oneOrNull(restored, 'Location restore');
      if (!restoredRow) throw integrityError('Location restore lost its locked row.');
      return mapLocation(restoredRow);
    } catch (error) {
      return translateUniqueViolation(error);
    }
  });
}

export async function archiveManagedBrand(
  accountId: number,
  brandId: string,
  database: SqlClient = sql as SqlClient,
): Promise<ManagedBrand> {
  return withManagementTransaction(database, async (transaction) => {
    await lockAccount(transaction, accountId);
    const rows = await transaction<BrandRow[]>`
      SELECT ${BRAND_COLUMNS}
      FROM crewcast.brands
      WHERE id = ${brandId}::bigint
        AND user_id = ${accountId}
        AND archived_at IS NULL
      LIMIT 2
      FOR UPDATE
    `;
    const brand = oneOrNull(rows, 'Brand archive lock');
    if (!brand) {
      throw new BrandLocationManagementError(
        'BRAND_NOT_FOUND',
        404,
        'Brand not found.',
      );
    }
    await assertNotRetainedByPendingDowngrade(transaction, {
      userId: accountId,
      brandId,
    });
    await transaction`
      SELECT id
      FROM crewcast.brand_locations
      WHERE user_id = ${accountId}
        AND brand_id = ${brandId}::bigint
        AND archived_at IS NULL
      ORDER BY id
      FOR UPDATE
    `;
    const activeBrands = await countActive(transaction, accountId, 'brands');
    if (activeBrands <= 1) {
      throw new BrandLocationManagementError(
        'DEFAULT_CONTEXT_REQUIRED',
        409,
        'An account must keep at least one active brand.',
      );
    }
    await assertNoActiveWork(transaction, accountId, brandId, null);

    if (readBoolean(brand.is_default, 'Brand default state')) {
      const replacements = await transaction<{ id: unknown }[]>`
        SELECT brands.id::text AS id
        FROM crewcast.brands AS brands
        WHERE brands.user_id = ${accountId}
          AND brands.id <> ${brandId}::bigint
          AND brands.archived_at IS NULL
          AND EXISTS (
            SELECT 1
            FROM crewcast.brand_locations AS locations
            WHERE locations.user_id = brands.user_id
              AND locations.brand_id = brands.id
              AND locations.archived_at IS NULL
              AND locations.is_default
          )
        ORDER BY brands.created_at, brands.id
        LIMIT 1
        FOR UPDATE OF brands
      `;
      const replacement = replacements[0] ?? null;
      if (!replacement) {
        throw new BrandLocationManagementError(
          'DEFAULT_CONTEXT_REQUIRED',
          409,
          'Another active brand with a default location is required first.',
        );
      }
      await transaction`
        UPDATE crewcast.brands
        SET is_default = false
        WHERE id = ${brandId}::bigint AND user_id = ${accountId}
      `;
      await transaction`
        UPDATE crewcast.brands
        SET is_default = true
        WHERE id = ${readBigint(replacement.id, 'Replacement brand ID')}::bigint
          AND user_id = ${accountId}
          AND archived_at IS NULL
      `;
    }

    await transaction`
      UPDATE crewcast.brand_locations
      SET
        is_default = false,
        auto_scan_enabled = false,
        next_auto_scan_at = NULL,
        scan_claim_token = NULL,
        scan_claimed_at = NULL,
        scan_lease_expires_at = NULL,
        capacity_archived_by_plan_change_id = NULL,
        archived_at = statement_timestamp()
      WHERE user_id = ${accountId}
        AND brand_id = ${brandId}::bigint
        AND archived_at IS NULL
    `;
    const archived = await transaction<BrandRow[]>`
      UPDATE crewcast.brands
      SET
        is_default = false,
        capacity_archived_by_plan_change_id = NULL,
        archived_at = statement_timestamp()
      WHERE id = ${brandId}::bigint
        AND user_id = ${accountId}
        AND archived_at IS NULL
      RETURNING ${BRAND_COLUMNS}
    `;
    const archivedRow = oneOrNull(archived, 'Brand archive');
    if (!archivedRow) throw integrityError('Brand archive lost its locked row.');
    return mapBrand(archivedRow);
  });
}

export async function restoreManagedBrand(
  accountId: number,
  brandId: string,
  database: SqlClient = sql as SqlClient,
): Promise<ManagedBrand> {
  return withManagementTransaction(database, async (transaction) => {
    await lockAccount(transaction, accountId);
    const { entitlements } = await requireCapacityEntitlements(transaction, accountId);
    const rows = await transaction<BrandRow[]>`
      SELECT ${BRAND_COLUMNS}
      FROM crewcast.brands
      WHERE id = ${brandId}::bigint
        AND user_id = ${accountId}
        AND archived_at IS NOT NULL
      LIMIT 2
      FOR UPDATE
    `;
    const brand = oneOrNull(rows, 'Brand restore lock');
    if (!brand) {
      throw new BrandLocationManagementError(
        'BRAND_NOT_FOUND',
        404,
        'Brand not found.',
      );
    }
    const activeBrands = await countActive(transaction, accountId, 'brands');
    assertCapacityAvailable(activeBrands, entitlements.maxBrands, 'brands');
    try {
      const restored = await transaction<BrandRow[]>`
        UPDATE crewcast.brands
        SET
          is_default = ${activeBrands === 0},
          capacity_archived_by_plan_change_id = NULL,
          archived_at = NULL
        WHERE id = ${brandId}::bigint
          AND user_id = ${accountId}
          AND archived_at IS NOT NULL
        RETURNING ${BRAND_COLUMNS}
      `;
      const restoredRow = oneOrNull(restored, 'Brand restore');
      if (!restoredRow) throw integrityError('Brand restore lost its locked row.');
      return mapBrand(restoredRow);
    } catch (error) {
      return translateUniqueViolation(error);
    }
  });
}
