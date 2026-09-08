import {
  PLAN_CATALOG,
  type PurchasablePlanId,
} from '@/lib/plans/catalog';

export interface DowngradeRetentionSelection {
  brandIds: string[];
  locationIds: string[];
}

export interface ActiveBrandCapacity {
  id: string;
  locationIds: string[];
}

export interface DowngradeCapacityAssessment {
  targetPlan: PurchasablePlanId;
  maxBrands: number;
  maxLocations: number;
  activeBrands: number;
  activeLocations: number;
  selectionRequired: boolean;
}

export interface ExplicitCapacityLimits {
  maxBrands: number;
  maxLocations: number;
}

export interface CapacityAssessment extends ExplicitCapacityLimits {
  activeBrands: number;
  activeLocations: number;
  selectionRequired: boolean;
}

export type DowngradeCapacityErrorCode =
  | 'DOWNGRADE_SELECTION_REQUIRED'
  | 'INVALID_DOWNGRADE_SELECTION'
  | 'DOWNGRADE_CAPACITY_INTEGRITY_ERROR';

export class DowngradeCapacityError extends Error {
  constructor(
    public readonly code: DowngradeCapacityErrorCode,
    public readonly status: number,
    message: string,
    public readonly assessment?: CapacityAssessment | DowngradeCapacityAssessment,
  ) {
    super(message);
    this.name = 'DowngradeCapacityError';
  }
}

function assertIdentifier(value: string, label: string): void {
  if (!/^[1-9][0-9]{0,18}$/.test(value)) {
    throw new DowngradeCapacityError(
      'DOWNGRADE_CAPACITY_INTEGRITY_ERROR',
      500,
      `${label} is not a valid PostgreSQL bigint identifier.`,
    );
  }
}

function assertUniqueIdentifiers(values: readonly string[], label: string): void {
  for (const value of values) assertIdentifier(value, label);
  if (new Set(values).size !== values.length) {
    throw new DowngradeCapacityError(
      'INVALID_DOWNGRADE_SELECTION',
      400,
      `${label} contains a duplicate identifier.`,
    );
  }
}

function targetLimits(targetPlan: PurchasablePlanId) {
  const entitlements = PLAN_CATALOG[targetPlan].entitlements;
  return {
    maxBrands: Number(entitlements.maxBrands),
    maxLocations: Number(entitlements.maxLocationsPerAccount),
  };
}

function assertCapacityLimits(limits: ExplicitCapacityLimits): void {
  if (!Number.isSafeInteger(limits.maxBrands) || limits.maxBrands < 1) {
    throw new DowngradeCapacityError(
      'DOWNGRADE_CAPACITY_INTEGRITY_ERROR',
      500,
      'Target brand capacity is invalid.',
    );
  }
  if (!Number.isSafeInteger(limits.maxLocations) || limits.maxLocations < 1) {
    throw new DowngradeCapacityError(
      'DOWNGRADE_CAPACITY_INTEGRITY_ERROR',
      500,
      'Target location capacity is invalid.',
    );
  }
}

function indexActiveCapacity(activeBrands: readonly ActiveBrandCapacity[]) {
  if (activeBrands.length === 0) {
    throw new DowngradeCapacityError(
      'DOWNGRADE_CAPACITY_INTEGRITY_ERROR',
      500,
      'The account has no active brand to retain during a downgrade.',
    );
  }
  const brandIds = activeBrands.map((brand) => brand.id);
  assertUniqueIdentifiers(brandIds, 'Active brand ID');

  const locationOwner = new Map<string, string>();
  for (const brand of activeBrands) {
    assertUniqueIdentifiers(brand.locationIds, 'Active location ID');
    if (brand.locationIds.length === 0) {
      throw new DowngradeCapacityError(
        'DOWNGRADE_CAPACITY_INTEGRITY_ERROR',
        500,
        `Active brand ${brand.id} has no active location to retain.`,
      );
    }
    for (const locationId of brand.locationIds) {
      if (locationOwner.has(locationId)) {
        throw new DowngradeCapacityError(
          'DOWNGRADE_CAPACITY_INTEGRITY_ERROR',
          500,
          'An active location belongs to more than one brand.',
        );
      }
      locationOwner.set(locationId, brand.id);
    }
  }
  return { brandIds, locationOwner };
}

export function assessDowngradeCapacity(
  activeBrands: readonly ActiveBrandCapacity[],
  targetPlan: PurchasablePlanId,
): DowngradeCapacityAssessment {
  const { maxBrands, maxLocations } = targetLimits(targetPlan);
  const assessment = assessCapacityAgainstLimits(activeBrands, {
    maxBrands,
    maxLocations,
  });
  return {
    targetPlan,
    ...assessment,
  };
}

/**
 * Shared assessment for both a base-plan downgrade and a paid add-on
 * reduction. Keeping one validator prevents the two billing paths from
 * disagreeing about which active rows fit inside the target capacity.
 */
export function assessCapacityAgainstLimits(
  activeBrands: readonly ActiveBrandCapacity[],
  limits: ExplicitCapacityLimits,
): CapacityAssessment {
  assertCapacityLimits(limits);
  const { brandIds, locationOwner } = indexActiveCapacity(activeBrands);
  return {
    ...limits,
    activeBrands: brandIds.length,
    activeLocations: locationOwner.size,
    selectionRequired:
      brandIds.length > limits.maxBrands || locationOwner.size > limits.maxLocations,
  };
}

/**
 * Validate a customer's explicit keep-list against one locked account snapshot.
 * The server calls this again after locking every active brand/location, so a
 * forged or stale browser choice can never archive another account's data.
 */
export function validateDowngradeRetentionSelection(
  activeBrands: readonly ActiveBrandCapacity[],
  targetPlan: PurchasablePlanId,
  selection: DowngradeRetentionSelection,
): DowngradeRetentionSelection {
  const { maxBrands, maxLocations } = targetLimits(targetPlan);
  return validateRetentionSelectionAgainstLimits(
    activeBrands,
    { maxBrands, maxLocations },
    selection,
  );
}

export function validateRetentionSelectionAgainstLimits(
  activeBrands: readonly ActiveBrandCapacity[],
  limits: ExplicitCapacityLimits,
  selection: DowngradeRetentionSelection,
): DowngradeRetentionSelection {
  assertCapacityLimits(limits);
  const { brandIds: activeBrandIds, locationOwner } = indexActiveCapacity(activeBrands);
  const { maxBrands, maxLocations } = limits;
  assertUniqueIdentifiers(selection.brandIds, 'Selected brand ID');
  assertUniqueIdentifiers(selection.locationIds, 'Selected location ID');

  if (selection.brandIds.length === 0 || selection.brandIds.length > maxBrands) {
    throw new DowngradeCapacityError(
      'INVALID_DOWNGRADE_SELECTION',
      400,
      `Choose between 1 and ${maxBrands} brands to keep active.`,
    );
  }
  if (selection.locationIds.length === 0 || selection.locationIds.length > maxLocations) {
    throw new DowngradeCapacityError(
      'INVALID_DOWNGRADE_SELECTION',
      400,
      `Choose between 1 and ${maxLocations} locations to keep active.`,
    );
  }

  const activeBrandSet = new Set(activeBrandIds);
  const selectedBrandSet = new Set(selection.brandIds);
  if (selection.brandIds.some((brandId) => !activeBrandSet.has(brandId))) {
    throw new DowngradeCapacityError(
      'INVALID_DOWNGRADE_SELECTION',
      409,
      'One of the selected brands is no longer active. Review the choice and try again.',
    );
  }

  const selectedBrandsWithLocations = new Set<string>();
  for (const locationId of selection.locationIds) {
    const ownerBrandId = locationOwner.get(locationId);
    if (!ownerBrandId || !selectedBrandSet.has(ownerBrandId)) {
      throw new DowngradeCapacityError(
        'INVALID_DOWNGRADE_SELECTION',
        409,
        'Every selected location must still be active under a selected brand.',
      );
    }
    selectedBrandsWithLocations.add(ownerBrandId);
  }
  if (selection.brandIds.some((brandId) => !selectedBrandsWithLocations.has(brandId))) {
    throw new DowngradeCapacityError(
      'INVALID_DOWNGRADE_SELECTION',
      400,
      'Choose at least one location for every brand you keep active.',
    );
  }

  // Preserve the locked database order. This makes defaults and audit records
  // deterministic even if the browser sends the same IDs in a different order.
  return {
    brandIds: activeBrandIds.filter((brandId) => selectedBrandSet.has(brandId)),
    locationIds: activeBrands.flatMap((brand) =>
      brand.locationIds.filter((locationId) => selection.locationIds.includes(locationId)),
    ),
  };
}

export function resolveDowngradeRetentionSelection(
  activeBrands: readonly ActiveBrandCapacity[],
  targetPlan: PurchasablePlanId,
  requestedSelection?: DowngradeRetentionSelection,
): {
  assessment: DowngradeCapacityAssessment;
  selection: DowngradeRetentionSelection;
} {
  const assessment = assessDowngradeCapacity(activeBrands, targetPlan);
  const resolved = resolveRetentionSelectionAgainstLimits(
    activeBrands,
    {
      maxBrands: assessment.maxBrands,
      maxLocations: assessment.maxLocations,
    },
    requestedSelection,
  );
  return { assessment, selection: resolved.selection };
}

export function resolveRetentionSelectionAgainstLimits(
  activeBrands: readonly ActiveBrandCapacity[],
  limits: ExplicitCapacityLimits,
  requestedSelection?: DowngradeRetentionSelection,
): {
  assessment: CapacityAssessment;
  selection: DowngradeRetentionSelection;
} {
  const assessment = assessCapacityAgainstLimits(activeBrands, limits);
  if (!assessment.selectionRequired) {
    return {
      assessment,
      selection: {
        brandIds: activeBrands.map((brand) => brand.id),
        locationIds: activeBrands.flatMap((brand) => brand.locationIds),
      },
    };
  }
  if (!requestedSelection) {
    throw new DowngradeCapacityError(
      'DOWNGRADE_SELECTION_REQUIRED',
      409,
      'Choose which brands and locations should remain active before downgrading.',
      assessment,
    );
  }
  return {
    assessment,
    selection: validateRetentionSelectionAgainstLimits(
      activeBrands,
      limits,
      requestedSelection,
    ),
  };
}

/**
 * Chooses a recoverable keep-list only when Stripe removes paid capacity while
 * no customer is present. Brands must be ordered default-first then oldest;
 * locationPriority must contain every active location default-first then oldest.
 * Customer-requested reductions continue to require an explicit keep-list.
 */
export function selectAutomaticRetentionAfterCapacityLoss(
  activeBrands: readonly ActiveBrandCapacity[],
  limits: ExplicitCapacityLimits,
  locationPriority: readonly string[],
): DowngradeRetentionSelection {
  assertCapacityLimits(limits);
  const { brandIds: activeBrandIds, locationOwner } = indexActiveCapacity(activeBrands);
  if (
    locationPriority.length !== locationOwner.size
    || new Set(locationPriority).size !== locationPriority.length
    || locationPriority.some((locationId) => !locationOwner.has(locationId))
  ) {
    throw new DowngradeCapacityError(
      'DOWNGRADE_CAPACITY_INTEGRITY_ERROR',
      500,
      'Automatic capacity retention received an invalid location priority.',
    );
  }

  const brandIds = activeBrandIds.slice(
    0,
    Math.min(activeBrandIds.length, limits.maxBrands, limits.maxLocations),
  );
  const retainedBrandSet = new Set(brandIds);
  const locationIds: string[] = [];
  const retainedLocationSet = new Set<string>();

  for (const brandId of brandIds) {
    const preferredLocation = locationPriority.find(
      (locationId) => locationOwner.get(locationId) === brandId,
    );
    if (!preferredLocation) {
      throw new DowngradeCapacityError(
        'DOWNGRADE_CAPACITY_INTEGRITY_ERROR',
        500,
        `Automatic capacity retention found no location for brand ${brandId}.`,
      );
    }
    locationIds.push(preferredLocation);
    retainedLocationSet.add(preferredLocation);
  }

  for (const locationId of locationPriority) {
    if (locationIds.length >= limits.maxLocations) break;
    const ownerBrandId = locationOwner.get(locationId);
    if (
      ownerBrandId
      && retainedBrandSet.has(ownerBrandId)
      && !retainedLocationSet.has(locationId)
    ) {
      locationIds.push(locationId);
      retainedLocationSet.add(locationId);
    }
  }

  return validateRetentionSelectionAgainstLimits(
    activeBrands,
    limits,
    { brandIds, locationIds },
  );
}
