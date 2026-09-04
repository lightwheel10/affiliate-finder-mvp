export function isMultiBrandLocationsEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_MULTI_BRAND_LOCATIONS_ENABLED
      ?.trim()
      .toLowerCase() === "true"
  );
}
