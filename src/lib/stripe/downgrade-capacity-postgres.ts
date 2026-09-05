import 'server-only';

import type postgres from 'postgres';
import { BrandLocationManagementError } from '@/lib/brand-locations/management';
import {
  resolveDowngradeRetentionSelection,
  validateDowngradeRetentionSelection,
  type ActiveBrandCapacity,
  type DowngradeRetentionSelection,
} from '@/lib/plans/downgrade-capacity';
import type { PurchasablePlanId } from '@/lib/plans/catalog';

export type DowngradeCapacitySql = postgres.Sql;

interface BrandRow {
  id: unknown;
  is_default: unknown;
}

interface LocationRow {
  id: unknown;
  brand_id: unknown;
  is_default: unknown;
}

function readBigint(value: unknown, label: string): string {
  const candidate = typeof value === 'number' ? String(value) : value;
  if (typeof candidate !== 'string' || !/^[1-9][0-9]*$/.test(candidate)) {
    throw new Error(`${label} is not a positive PostgreSQL bigint.`);
  }
  return BigInt(candidate).toString();
}

function readBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} is not boolean.`);
  return value;
}

async function lockActiveCapacity(
  transaction: DowngradeCapacitySql,
  userId: number,
): Promise<{
  activeBrands: ActiveBrandCapacity[];
  brandRows: Array<{ id: string; isDefault: boolean }>;
  locationRows: Array<{ id: string; brandId: string; isDefault: boolean }>;
}> {
  const brands = await transaction<BrandRow[]>`
    SELECT id::text AS id, is_default
    FROM crewcast.brands
    WHERE user_id = ${userId}
      AND archived_at IS NULL
    ORDER BY is_default DESC, created_at, id
    FOR UPDATE
  `;
  const locations = await transaction<LocationRow[]>`
    SELECT id::text AS id, brand_id::text AS brand_id, is_default
    FROM crewcast.brand_locations
    WHERE user_id = ${userId}
      AND archived_at IS NULL
    ORDER BY is_default DESC, created_at, id
    FOR UPDATE
  `;

  const brandRows = brands.map((brand) => ({
    id: readBigint(brand.id, 'Active brand ID'),
    isDefault: readBoolean(brand.is_default, 'Active brand default state'),
  }));
  const brandIds = new Set(brandRows.map((brand) => brand.id));
  const locationRows = locations.map((location) => {
    const brandId = readBigint(location.brand_id, 'Active location brand ID');
    if (!brandIds.has(brandId)) {
      throw new Error('An active location belongs to an archived or missing brand.');
    }
    return {
      id: readBigint(location.id, 'Active location ID'),
      brandId,
      isDefault: readBoolean(location.is_default, 'Active location default state'),
    };
  });

  return {
    activeBrands: brandRows.map((brand) => ({
      id: brand.id,
      locationIds: locationRows
        .filter((location) => location.brandId === brand.id)
        .map((location) => location.id),
    })),
    brandRows,
    locationRows,
  };
}

/**
 * Locks one account's current active capacity and resolves the exact keep-list
 * that will be stored beside the Stripe schedule. Callers must already hold the
 * subscription-owner row lock in the surrounding transaction.
 */
export async function prepareDowngradeCapacitySelection(
  transaction: DowngradeCapacitySql,
  input: {
    userId: number;
    targetPlan: PurchasablePlanId;
    requestedSelection?: DowngradeRetentionSelection;
  },
): Promise<{
  selectionVersion: 1;
  selection: DowngradeRetentionSelection;
}> {
  const locked = await lockActiveCapacity(transaction, input.userId);
  const resolved = resolveDowngradeRetentionSelection(
    locked.activeBrands,
    input.targetPlan,
    input.requestedSelection,
  );
  return { selectionVersion: 1, selection: resolved.selection };
}

/**
 * Applies a previously chosen keep-list at the real Stripe period boundary.
 * Excess rows are recoverably archived; lead, outreach and search history is
 * untouched. Defaults are reassigned in one transaction before it commits.
 */
export async function reconcileAppliedDowngradeCapacity(
  transaction: DowngradeCapacitySql,
  input: {
    userId: number;
    planChangeId: string;
    targetPlan: PurchasablePlanId;
    selection: DowngradeRetentionSelection;
  },
): Promise<{ archivedBrands: number; archivedLocations: number }> {
  const locked = await lockActiveCapacity(transaction, input.userId);
  const selection = validateDowngradeRetentionSelection(
    locked.activeBrands,
    input.targetPlan,
    input.selection,
  );
  const selectedBrands = new Set(selection.brandIds);
  const selectedLocations = new Set(selection.locationIds);

  const preferredBrand = locked.brandRows.find(
    (brand) => brand.isDefault && selectedBrands.has(brand.id),
  ) ?? locked.brandRows.find((brand) => selectedBrands.has(brand.id));
  if (!preferredBrand) throw new Error('Downgrade reconciliation has no retained default brand.');

  await transaction`
    UPDATE crewcast.brands
    SET is_default = false
    WHERE user_id = ${input.userId}
      AND archived_at IS NULL
      AND is_default
  `;
  await transaction`
    UPDATE crewcast.brand_locations
    SET is_default = false
    WHERE user_id = ${input.userId}
      AND archived_at IS NULL
      AND is_default
  `;

  const archivedLocationRows = await transaction<{ id: unknown }[]>`
    UPDATE crewcast.brand_locations
    SET
      is_default = false,
      auto_scan_enabled = false,
      next_auto_scan_at = NULL,
      scan_claim_token = NULL,
      scan_claimed_at = NULL,
      scan_lease_expires_at = NULL,
      archived_at = statement_timestamp(),
      capacity_archived_by_plan_change_id = ${input.planChangeId}::bigint
    WHERE user_id = ${input.userId}
      AND archived_at IS NULL
      AND NOT (id = ANY(${selection.locationIds}::bigint[]))
    RETURNING id
  `;
  const archivedBrandRows = await transaction<{ id: unknown }[]>`
    UPDATE crewcast.brands
    SET
      is_default = false,
      archived_at = statement_timestamp(),
      capacity_archived_by_plan_change_id = ${input.planChangeId}::bigint
    WHERE user_id = ${input.userId}
      AND archived_at IS NULL
      AND NOT (id = ANY(${selection.brandIds}::bigint[]))
    RETURNING id
  `;

  await transaction`
    UPDATE crewcast.brands
    SET is_default = (id = ${preferredBrand.id}::bigint)
    WHERE user_id = ${input.userId}
      AND archived_at IS NULL
      AND id = ANY(${selection.brandIds}::bigint[])
  `;

  for (const brandId of selection.brandIds) {
    const retainedForBrand = locked.locationRows.filter(
      (location) => location.brandId === brandId && selectedLocations.has(location.id),
    );
    const preferredLocation = retainedForBrand.find((location) => location.isDefault)
      ?? retainedForBrand[0];
    if (!preferredLocation) {
      throw new Error(`Downgrade reconciliation has no retained location for brand ${brandId}.`);
    }
    await transaction`
      UPDATE crewcast.brand_locations
      SET is_default = (id = ${preferredLocation.id}::bigint)
      WHERE user_id = ${input.userId}
        AND brand_id = ${brandId}::bigint
        AND archived_at IS NULL
        AND id = ANY(${selection.locationIds}::bigint[])
    `;
  }

  return {
    archivedBrands: archivedBrandRows.length,
    archivedLocations: archivedLocationRows.length,
  };
}

export async function assertNotRetainedByPendingDowngrade(
  transaction: DowngradeCapacitySql,
  input: { userId: number; brandId: string; locationId?: string },
): Promise<void> {
  const rows = await transaction<{ conflict: unknown }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM crewcast.subscription_plan_changes
      WHERE user_id = ${input.userId}
        AND status = 'pending'
        AND capacity_selection_version = 1
        AND CASE
          WHEN ${input.locationId ?? null}::bigint IS NOT NULL
            THEN ${input.locationId ?? null}::bigint = ANY(retained_location_ids)
          ELSE ${input.brandId}::bigint = ANY(retained_brand_ids)
        END
      UNION ALL
      SELECT 1
      FROM crewcast.stripe_downgrade_operations
      WHERE user_id = ${input.userId}
        AND status = 'prepared'
        AND capacity_selection_version = 1
        AND CASE
          WHEN ${input.locationId ?? null}::bigint IS NOT NULL
            THEN ${input.locationId ?? null}::bigint = ANY(retained_location_ids)
          ELSE ${input.brandId}::bigint = ANY(retained_brand_ids)
        END
    ) AS conflict
  `;
  if (rows.length !== 1 || typeof rows[0].conflict !== 'boolean') {
    throw new Error('Pending downgrade retention check returned invalid state.');
  }
  if (rows[0].conflict) {
    throw new BrandLocationManagementError(
      'PENDING_DOWNGRADE_CONFLICT',
      409,
      'This brand or location is reserved by a pending downgrade. Cancel or replace the downgrade choice first.',
    );
  }
}
