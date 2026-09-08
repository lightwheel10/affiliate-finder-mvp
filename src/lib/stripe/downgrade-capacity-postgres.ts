import 'server-only';

import type postgres from 'postgres';
import { BrandLocationManagementError } from '@/lib/brand-locations/management';
import {
  DowngradeCapacityError,
  resolveRetentionSelectionAgainstLimits,
  selectAutomaticRetentionAfterCapacityLoss,
  type ActiveBrandCapacity,
  type DowngradeRetentionSelection,
  type ExplicitCapacityLimits,
} from '@/lib/plans/downgrade-capacity';
import type { PurchasablePlanId } from '@/lib/plans/catalog';
import { effectiveCapacityLimits } from '@/lib/stripe/capacity-subscription';
import { readEffectivePaidCapacity } from '@/lib/stripe/capacity-entitlements-postgres';

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
    stripeCustomerId: string;
    targetPlan: PurchasablePlanId;
    requestedSelection?: DowngradeRetentionSelection;
  },
): Promise<{
  selectionVersion: 1;
  selection: DowngradeRetentionSelection;
}> {
  const paidCapacity = await readEffectivePaidCapacity(transaction, {
    userId: input.userId,
    stripeCustomerId: input.stripeCustomerId,
  });
  // Keep billing locks ahead of brand/location locks everywhere. A fixed lock
  // order prevents plan changes and brand-management requests from deadlocking.
  const locked = await lockActiveCapacity(transaction, input.userId);
  const effectiveLimits = effectiveCapacityLimits(input.targetPlan, paidCapacity);
  const resolved = resolveRetentionSelectionAgainstLimits(
    locked.activeBrands,
    {
      maxBrands: effectiveLimits.maxBrands,
      maxLocations: effectiveLimits.maxLocationsPerAccount,
    },
    input.requestedSelection,
  );
  return { selectionVersion: 1, selection: resolved.selection };
}

export async function preparePaidCapacityReductionSelection(
  transaction: DowngradeCapacitySql,
  input: {
    userId: number;
    targetLimits: ExplicitCapacityLimits;
    requestedSelection?: DowngradeRetentionSelection;
  },
): Promise<{
  selectionVersion: 1;
  selection: DowngradeRetentionSelection;
}> {
  const locked = await lockActiveCapacity(transaction, input.userId);
  const resolved = resolveRetentionSelectionAgainstLimits(
    locked.activeBrands,
    input.targetLimits,
    input.requestedSelection,
  );
  return { selectionVersion: 1, selection: resolved.selection };
}

/**
 * Builds the deterministic keep-list approved for an involuntary Stripe loss.
 * The SQL order makes current defaults win, followed by the oldest records.
 */
export async function prepareAutomaticPaidCapacityLossSelection(
  transaction: DowngradeCapacitySql,
  input: {
    userId: number;
    targetLimits: ExplicitCapacityLimits;
  },
): Promise<{
  selection: DowngradeRetentionSelection;
  activeBrands: number;
  activeLocations: number;
} | null> {
  const locked = await lockActiveCapacity(transaction, input.userId);
  if (locked.activeBrands.length === 0) return null;
  const selection = selectAutomaticRetentionAfterCapacityLoss(
    locked.activeBrands,
    input.targetLimits,
    locked.locationRows.map((location) => location.id),
  );
  return {
    selection,
    activeBrands: locked.activeBrands.length,
    activeLocations: locked.locationRows.length,
  };
}

async function applyCapacityRetention(
  transaction: DowngradeCapacitySql,
  input: {
    userId: number;
    selection: DowngradeRetentionSelection;
    planChangeId: string | null;
    addonOperationId: string | null;
    targetLimits: ExplicitCapacityLimits;
    allowAutomaticFallbackAfterPaidLoss: boolean;
  },
): Promise<{ archivedBrands: number; archivedLocations: number }> {
  if ((input.planChangeId === null) === (input.addonOperationId === null)) {
    throw new Error('Capacity reconciliation requires exactly one archive source.');
  }
  if (
    input.addonOperationId !== null
    && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(input.addonOperationId)
  ) {
    throw new Error('Paid-capacity archive operation ID is invalid.');
  }

  const locked = await lockActiveCapacity(transaction, input.userId);
  let selection: DowngradeRetentionSelection;
  try {
    selection = resolveRetentionSelectionAgainstLimits(
      locked.activeBrands,
      input.targetLimits,
      input.selection,
    ).selection;
  } catch (error) {
    const canRepairStalePlanSelection = input.allowAutomaticFallbackAfterPaidLoss
      && error instanceof DowngradeCapacityError
      && error.code === 'INVALID_DOWNGRADE_SELECTION'
      && await selectionWasArchivedByPaidCapacityLoss(
        transaction,
        input.userId,
        input.selection,
      );
    if (!canRepairStalePlanSelection) throw error;
    selection = selectAutomaticRetentionAfterCapacityLoss(
      locked.activeBrands,
      input.targetLimits,
      locked.locationRows.map((location) => location.id),
    );
  }
  const selectedBrands = new Set(selection.brandIds);
  const selectedLocations = new Set(selection.locationIds);

  const preferredBrand = locked.brandRows.find(
    (brand) => brand.isDefault && selectedBrands.has(brand.id),
  ) ?? locked.brandRows.find((brand) => selectedBrands.has(brand.id));
  if (!preferredBrand) throw new Error('Capacity reconciliation has no retained default brand.');

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
      capacity_archived_by_plan_change_id = ${input.planChangeId}::bigint,
      capacity_archived_by_addon_operation_id = ${input.addonOperationId}::uuid
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
      capacity_archived_by_plan_change_id = ${input.planChangeId}::bigint,
      capacity_archived_by_addon_operation_id = ${input.addonOperationId}::uuid
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
      throw new Error(`Capacity reconciliation has no retained location for brand ${brandId}.`);
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

interface SelectionProvenanceRow {
  expected_count: unknown;
  found_count: unknown;
  active_count: unknown;
  addon_archived_count: unknown;
}

function readSelectionProvenance(
  rows: SelectionProvenanceRow[],
  expected: number,
  label: string,
): { valid: boolean; repaired: boolean } {
  if (rows.length !== 1) {
    throw new Error(`${label} archive provenance returned invalid state.`);
  }
  const values = [
    rows[0].expected_count,
    rows[0].found_count,
    rows[0].active_count,
    rows[0].addon_archived_count,
  ].map(Number);
  if (values.some((value) => !Number.isSafeInteger(value) || value < 0)) {
    throw new Error(`${label} archive provenance returned invalid counts.`);
  }
  const [expectedCount, foundCount, activeCount, addonArchivedCount] = values;
  return {
    valid:
      expectedCount === expected
      && foundCount === expected
      && activeCount + addonArchivedCount === expected,
    repaired: addonArchivedCount > 0,
  };
}

/**
 * A pending base-plan choice is immutable. If a later involuntary add-on loss
 * archived one of those chosen rows, prove that provenance before replacing
 * the now-stale choice with the same approved default/oldest rule.
 */
async function selectionWasArchivedByPaidCapacityLoss(
  transaction: DowngradeCapacitySql,
  userId: number,
  selection: DowngradeRetentionSelection,
): Promise<boolean> {
  const brandRows = await transaction<SelectionProvenanceRow[]>`
    SELECT
      count(*)::integer AS expected_count,
      count(brands.id)::integer AS found_count,
      count(*) FILTER (WHERE brands.archived_at IS NULL)::integer AS active_count,
      count(*) FILTER (
        WHERE brands.archived_at IS NOT NULL
          AND brands.capacity_archived_by_addon_operation_id IS NOT NULL
      )::integer AS addon_archived_count
    FROM unnest(${selection.brandIds}::bigint[]) AS selected(id)
    LEFT JOIN crewcast.brands AS brands
      ON brands.id = selected.id
     AND brands.user_id = ${userId}
  `;
  const locationRows = await transaction<SelectionProvenanceRow[]>`
    SELECT
      count(*)::integer AS expected_count,
      count(locations.id)::integer AS found_count,
      count(*) FILTER (WHERE locations.archived_at IS NULL)::integer AS active_count,
      count(*) FILTER (
        WHERE locations.archived_at IS NOT NULL
          AND locations.capacity_archived_by_addon_operation_id IS NOT NULL
      )::integer AS addon_archived_count
    FROM unnest(${selection.locationIds}::bigint[]) AS selected(id)
    LEFT JOIN crewcast.brand_locations AS locations
      ON locations.id = selected.id
     AND locations.user_id = ${userId}
  `;
  const brands = readSelectionProvenance(
    brandRows,
    selection.brandIds.length,
    'Brand selection',
  );
  const locations = readSelectionProvenance(
    locationRows,
    selection.locationIds.length,
    'Location selection',
  );
  return brands.valid && locations.valid && (brands.repaired || locations.repaired);
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
    stripeCustomerId: string;
    planChangeId: string;
    targetPlan: PurchasablePlanId;
    selection: DowngradeRetentionSelection;
  },
): Promise<{ archivedBrands: number; archivedLocations: number }> {
  const paidCapacity = await readEffectivePaidCapacity(transaction, {
    userId: input.userId,
    stripeCustomerId: input.stripeCustomerId,
  });
  const effectiveLimits = effectiveCapacityLimits(input.targetPlan, paidCapacity);
  return applyCapacityRetention(transaction, {
    userId: input.userId,
    selection: input.selection,
    planChangeId: input.planChangeId,
    addonOperationId: null,
    targetLimits: {
      maxBrands: effectiveLimits.maxBrands,
      maxLocations: effectiveLimits.maxLocationsPerAccount,
    },
    allowAutomaticFallbackAfterPaidLoss: true,
  });
}

export async function reconcileAppliedPaidCapacityReduction(
  transaction: DowngradeCapacitySql,
  input: {
    userId: number;
    operationId: string;
    targetLimits: ExplicitCapacityLimits;
    selection: DowngradeRetentionSelection;
  },
): Promise<{ archivedBrands: number; archivedLocations: number }> {
  return applyCapacityRetention(transaction, {
    userId: input.userId,
    selection: input.selection,
    planChangeId: null,
    addonOperationId: input.operationId,
    targetLimits: input.targetLimits,
    allowAutomaticFallbackAfterPaidLoss: false,
  });
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
      UNION ALL
      SELECT 1
      FROM crewcast.stripe_capacity_change_operations
      WHERE user_id = ${input.userId}
        AND status IN ('prepared', 'pending_payment')
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

/**
 * A paid-capacity reduction stores an exact keep-list. Creating or restoring
 * capacity while that list is open would make it stale before Stripe applies
 * the reduction, so those four capacity-increasing actions are paused briefly.
 */
export async function assertNoOpenPaidCapacityReduction(
  transaction: DowngradeCapacitySql,
  userId: number,
): Promise<void> {
  const rows = await transaction<{ conflict: unknown }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM crewcast.stripe_capacity_change_operations
      WHERE user_id = ${userId}
        AND status IN ('prepared', 'pending_payment')
        AND expires_at > NOW()
        AND (
          to_extra_brand_quantity < from_extra_brand_quantity
          OR to_extra_location_quantity < from_extra_location_quantity
        )
    ) AS conflict
  `;
  if (rows.length !== 1 || typeof rows[0].conflict !== 'boolean') {
    throw new Error('Pending paid-capacity reduction check returned invalid state.');
  }
  if (rows[0].conflict) {
    throw new BrandLocationManagementError(
      'PENDING_DOWNGRADE_CONFLICT',
      409,
      'Finish or replace the pending capacity reduction before adding or restoring a brand or location.',
    );
  }
}
