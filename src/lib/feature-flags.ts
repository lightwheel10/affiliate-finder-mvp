export function isMultiBrandLocationsEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_MULTI_BRAND_LOCATIONS_ENABLED
      ?.trim()
      .toLowerCase() === "true"
  );
}

/** Paid capacity is unusable unless the underlying management feature is on. */
export function isPaidCapacityEnabled(): boolean {
  return isMultiBrandLocationsEnabled()
    && process.env.PAID_CAPACITY_ENABLED?.trim().toLowerCase() === 'true';
}
