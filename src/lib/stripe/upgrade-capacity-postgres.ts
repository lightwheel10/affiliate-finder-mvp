import 'server-only';

import type postgres from 'postgres';
import { resolveRestoredLocationSchedule } from '@/lib/brand-locations/restored-location-schedule';
import { PLAN_CATALOG, UNLIMITED, type PlanId } from '@/lib/plans/catalog';

export type UpgradeCapacitySql = postgres.Sql;

export type UpgradeCapacityRestorationOutcome =
  | {
      status: 'none';
      restoredBrands: 0;
      restoredLocations: 0;
    }
  | {
      status: 'restored';
      restoredBrands: number;
      restoredLocations: number;
    }
  | {
      status: 'selection_required';
      restoredBrands: 0;
      restoredLocations: 0;
      candidateBrands: number;
      candidateLocations: number;
      reason: 'capacity' | 'conflict' | 'parent_unavailable';
    };

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
  normalized_domain: unknown;
  is_default: unknown;
  archived_at: unknown;
  archive_change_id: unknown;
  archive_change_status: unknown;
}

interface LocationRow {
  id: unknown;
  brand_id: unknown;
  country_code: unknown;
  language_code: unknown;
  is_default: unknown;
  archived_at: unknown;
  archive_change_id: unknown;
  archive_change_status: unknown;
}

function readBigint(value: unknown, label: string): string {
  const candidate = typeof value === 'number' ? String(value) : value;
  if (typeof candidate !== 'string' || !/^[1-9][0-9]*$/.test(candidate)) {
    throw new Error(`${label} is not a positive PostgreSQL bigint.`);
  }
  return BigInt(candidate).toString();
}

function readAccountId(value: unknown): number {
  const candidate = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(candidate) || candidate <= 0) {
    throw new Error('Upgrade restoration received an invalid account ID.');
  }
  return candidate;
}

function readBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} is not boolean.`);
  return value;
}

function readNullableString(value: unknown, label: string): string | null {
  if (value === null || typeof value === 'string') return value;
  throw new Error(`${label} is not nullable text.`);
}

function readNullableTimestamp(value: unknown, label: string): string | null {
  if (value === null) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (!Number.isFinite(date.getTime())) throw new Error(`${label} is invalid.`);
  return date.toISOString();
}

function fitsLimit(count: number, limit: number): boolean {
  return limit === UNLIMITED || count <= limit;
}

function duplicateExists(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

/**
 * Restores only rows that a completed downgrade archived automatically.
 *
 * The operation is intentionally all-or-none. If every candidate cannot fit,
 * or restoring it would conflict with a later user choice, no row is changed;
 * the customer can then choose individual rows in Brands & Locations.
 */
export async function restoreDowngradeArchivedCapacity(
  transaction: UpgradeCapacitySql,
  input: {
    userId: number;
    targetPlan: PlanId;
    stripeSubscriptionId: string;
  },
): Promise<UpgradeCapacityRestorationOutcome> {
  const accounts = await transaction<AccountRow[]>`
    SELECT id, auto_scan_enabled
    FROM crewcast.users
    WHERE id = ${input.userId}
    LIMIT 2
    FOR UPDATE
  `;
  if (accounts.length !== 1 || readAccountId(accounts[0].id) !== input.userId) {
    throw new Error('Upgrade restoration could not lock exactly one account.');
  }

  const subscriptions = await transaction<SubscriptionRow[]>`
    SELECT plan, status, stripe_subscription_id, first_payment_at, next_auto_scan_at
    FROM crewcast.subscriptions
    WHERE user_id = ${input.userId}
    ORDER BY id
    LIMIT 2
    FOR UPDATE
  `;
  if (subscriptions.length !== 1) {
    throw new Error('Upgrade restoration could not lock exactly one subscription.');
  }
  const subscription = subscriptions[0];
  if (subscription.plan !== input.targetPlan) {
    throw new Error('Upgrade restoration refused a plan that is not authoritative in PostgreSQL.');
  }
  if (subscription.status !== 'active' && subscription.status !== 'trialing') {
    throw new Error('Upgrade restoration requires an active or trialing subscription.');
  }
  if (subscription.stripe_subscription_id !== input.stripeSubscriptionId) {
    throw new Error('Upgrade restoration refused a stale Stripe subscription.');
  }

  const brandRows = await transaction<BrandRow[]>`
    SELECT
      brands.id::text AS id,
      brands.normalized_domain,
      brands.is_default,
      brands.archived_at,
      brands.capacity_archived_by_plan_change_id::text AS archive_change_id,
      changes.status AS archive_change_status
    FROM crewcast.brands AS brands
    LEFT JOIN crewcast.subscription_plan_changes AS changes
      ON changes.id = brands.capacity_archived_by_plan_change_id
      AND changes.user_id = brands.user_id
    WHERE brands.user_id = ${input.userId}
      AND (
        brands.archived_at IS NULL
        OR brands.capacity_archived_by_plan_change_id IS NOT NULL
      )
    ORDER BY brands.is_default DESC, brands.created_at, brands.id
    FOR UPDATE OF brands
  `;
  const locationRows = await transaction<LocationRow[]>`
    SELECT
      locations.id::text AS id,
      locations.brand_id::text AS brand_id,
      locations.country_code,
      locations.language_code,
      locations.is_default,
      locations.archived_at,
      locations.capacity_archived_by_plan_change_id::text AS archive_change_id,
      changes.status AS archive_change_status
    FROM crewcast.brand_locations AS locations
    LEFT JOIN crewcast.subscription_plan_changes AS changes
      ON changes.id = locations.capacity_archived_by_plan_change_id
      AND changes.user_id = locations.user_id
    WHERE locations.user_id = ${input.userId}
      AND (
        locations.archived_at IS NULL
        OR locations.capacity_archived_by_plan_change_id IS NOT NULL
      )
    ORDER BY locations.is_default DESC, locations.created_at, locations.id
    FOR UPDATE OF locations
  `;

  const brands = brandRows.map((row) => ({
    id: readBigint(row.id, 'Upgrade brand ID'),
    normalizedDomain: readNullableString(row.normalized_domain, 'Upgrade brand domain'),
    isDefault: readBoolean(row.is_default, 'Upgrade brand default state'),
    archived: row.archived_at !== null,
    archiveChangeId: readNullableString(row.archive_change_id, 'Upgrade brand archive marker'),
    archiveChangeStatus: readNullableString(
      row.archive_change_status,
      'Upgrade brand archive status',
    ),
  }));
  const locations = locationRows.map((row) => ({
    id: readBigint(row.id, 'Upgrade location ID'),
    brandId: readBigint(row.brand_id, 'Upgrade location brand ID'),
    countryCode: readNullableString(row.country_code, 'Upgrade location country'),
    languageCode: readNullableString(row.language_code, 'Upgrade location language'),
    isDefault: readBoolean(row.is_default, 'Upgrade location default state'),
    archived: row.archived_at !== null,
    archiveChangeId: readNullableString(row.archive_change_id, 'Upgrade location archive marker'),
    archiveChangeStatus: readNullableString(
      row.archive_change_status,
      'Upgrade location archive status',
    ),
  }));

  const candidateBrands = brands.filter((brand) => brand.archived && brand.archiveChangeId !== null);
  const candidateLocations = locations.filter(
    (location) => location.archived && location.archiveChangeId !== null,
  );
  if (candidateBrands.length === 0 && candidateLocations.length === 0) {
    return { status: 'none', restoredBrands: 0, restoredLocations: 0 };
  }

  const invalidProvenance = [...candidateBrands, ...candidateLocations].some(
    (candidate) => candidate.archiveChangeStatus !== 'applied',
  );
  if (invalidProvenance) {
    throw new Error('Upgrade restoration found archive provenance without an applied plan change.');
  }

  const activeBrands = brands.filter((brand) => !brand.archived);
  const activeLocations = locations.filter((location) => !location.archived);
  const resultingBrands = [...activeBrands, ...candidateBrands];
  const resultingLocations = [...activeLocations, ...candidateLocations];
  const resultingBrandIds = new Set(resultingBrands.map((brand) => brand.id));
  const activeBrandIds = new Set(activeBrands.map((brand) => brand.id));

  // Existing active locations beneath an archived brand indicate corruption;
  // an automatic repair must not silently normalize unrelated data.
  if (activeLocations.some((location) => !activeBrandIds.has(location.brandId))) {
    throw new Error('Upgrade restoration found an active location beneath an archived brand.');
  }
  if (candidateLocations.some((location) => !resultingBrandIds.has(location.brandId))) {
    return {
      status: 'selection_required',
      restoredBrands: 0,
      restoredLocations: 0,
      candidateBrands: candidateBrands.length,
      candidateLocations: candidateLocations.length,
      reason: 'parent_unavailable',
    };
  }
  if (candidateBrands.some(
    (brand) => !resultingLocations.some((location) => location.brandId === brand.id),
  )) {
    return {
      status: 'selection_required',
      restoredBrands: 0,
      restoredLocations: 0,
      candidateBrands: candidateBrands.length,
      candidateLocations: candidateLocations.length,
      reason: 'parent_unavailable',
    };
  }

  const entitlements = PLAN_CATALOG[input.targetPlan].entitlements;
  if (
    !fitsLimit(resultingBrands.length, entitlements.maxBrands)
    || !fitsLimit(resultingLocations.length, entitlements.maxLocationsPerAccount)
  ) {
    return {
      status: 'selection_required',
      restoredBrands: 0,
      restoredLocations: 0,
      candidateBrands: candidateBrands.length,
      candidateLocations: candidateLocations.length,
      reason: 'capacity',
    };
  }

  const domains = resultingBrands.flatMap((brand) => (
    brand.normalizedDomain === null ? [] : [brand.normalizedDomain]
  ));
  const markets = resultingLocations.map((location) => JSON.stringify([
    location.brandId,
    location.countryCode,
    location.languageCode,
  ]));
  if (duplicateExists(domains) || duplicateExists(markets)) {
    return {
      status: 'selection_required',
      restoredBrands: 0,
      restoredLocations: 0,
      candidateBrands: candidateBrands.length,
      candidateLocations: candidateLocations.length,
      reason: 'conflict',
    };
  }

  const preferredBrand = activeBrands.find((brand) => brand.isDefault)
    ?? resultingBrands[0];
  if (!preferredBrand) throw new Error('Upgrade restoration would leave the account without a brand.');

  const locationDefaultIds: string[] = [];
  for (const brand of resultingBrands) {
    const brandLocations = resultingLocations.filter((location) => location.brandId === brand.id);
    const preferredLocation = brandLocations.find(
      (location) => !location.archived && location.isDefault,
    ) ?? brandLocations[0];
    if (!preferredLocation) {
      throw new Error(`Upgrade restoration would leave brand ${brand.id} without a location.`);
    }
    locationDefaultIds.push(preferredLocation.id);
  }

  const candidateBrandIds = candidateBrands.map((brand) => brand.id);
  const candidateLocationIds = candidateLocations.map((location) => location.id);
  const schedule = resolveRestoredLocationSchedule(
    readBoolean(accounts[0].auto_scan_enabled, 'Account auto-scan state'),
    {
      status: subscription.status,
      firstPaymentAt: readNullableTimestamp(
        subscription.first_payment_at,
        'Subscription first payment',
      ),
      nextAutoScanAt: readNullableTimestamp(
        subscription.next_auto_scan_at,
        'Subscription next scan',
      ),
    },
  );

  await transaction`
    UPDATE crewcast.brands
    SET is_default = false
    WHERE user_id = ${input.userId}
      AND archived_at IS NULL
      AND is_default
  `;
  const restoredBrands = candidateBrandIds.length === 0
    ? []
    : await transaction<{ id: unknown }[]>`
        UPDATE crewcast.brands
        SET
          is_default = false,
          archived_at = NULL,
          capacity_archived_by_plan_change_id = NULL
        WHERE user_id = ${input.userId}
          AND archived_at IS NOT NULL
          AND capacity_archived_by_plan_change_id IS NOT NULL
          AND id = ANY(${candidateBrandIds}::bigint[])
        RETURNING id
      `;
  if (restoredBrands.length !== candidateBrandIds.length) {
    throw new Error('Upgrade restoration did not restore the locked brand set exactly.');
  }
  await transaction`
    UPDATE crewcast.brands
    SET is_default = true
    WHERE user_id = ${input.userId}
      AND id = ${preferredBrand.id}::bigint
      AND archived_at IS NULL
  `;

  await transaction`
    UPDATE crewcast.brand_locations
    SET is_default = false
    WHERE user_id = ${input.userId}
      AND archived_at IS NULL
      AND is_default
  `;
  const restoredLocations = candidateLocationIds.length === 0
    ? []
    : await transaction<{ id: unknown }[]>`
        UPDATE crewcast.brand_locations
        SET
          is_default = false,
          auto_scan_enabled = ${schedule.autoScanEnabled},
          next_auto_scan_at = ${schedule.nextAutoScanAt},
          scan_claim_token = NULL,
          scan_claimed_at = NULL,
          scan_lease_expires_at = NULL,
          archived_at = NULL,
          capacity_archived_by_plan_change_id = NULL
        WHERE user_id = ${input.userId}
          AND archived_at IS NOT NULL
          AND capacity_archived_by_plan_change_id IS NOT NULL
          AND id = ANY(${candidateLocationIds}::bigint[])
        RETURNING id
      `;
  if (restoredLocations.length !== candidateLocationIds.length) {
    throw new Error('Upgrade restoration did not restore the locked location set exactly.');
  }
  for (const locationId of locationDefaultIds) {
    await transaction`
      UPDATE crewcast.brand_locations
      SET is_default = true
      WHERE user_id = ${input.userId}
        AND id = ${locationId}::bigint
        AND archived_at IS NULL
    `;
  }

  return {
    status: 'restored',
    restoredBrands: restoredBrands.length,
    restoredLocations: restoredLocations.length,
  };
}
