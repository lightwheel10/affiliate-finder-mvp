export const BRAND_AFFILIATE_TYPE_IDS = [
  'web',
  'instagram',
  'tiktok',
  'youtube',
] as const;

export type BrandAffiliateTypeId = typeof BRAND_AFFILIATE_TYPE_IDS[number];

const STORAGE_VALUES: Record<BrandAffiliateTypeId, string> = {
  web: 'Web',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
};

const LEGACY_ALIASES: Record<BrandAffiliateTypeId, readonly string[]> = {
  web: ['web', 'publishers/bloggers', 'publisher/blogger'],
  instagram: ['instagram'],
  tiktok: ['tiktok'],
  youtube: ['youtube'],
};

/**
 * Converts old translated/display values into the four stable choices used by
 * the brand form. Unknown legacy metadata is intentionally not exposed as a
 * custom option because the product supports only these four selections.
 */
export function readBrandAffiliateTypeIds(
  values: readonly string[],
): BrandAffiliateTypeId[] {
  const normalized = new Set(values.map((value) => value.trim().toLocaleLowerCase('en-US')));
  return BRAND_AFFILIATE_TYPE_IDS.filter((id) =>
    LEGACY_ALIASES[id].some((alias) => normalized.has(alias)));
}

export function writeBrandAffiliateTypes(
  ids: readonly BrandAffiliateTypeId[],
): string[] {
  const selected = new Set(ids);
  return BRAND_AFFILIATE_TYPE_IDS
    .filter((id) => selected.has(id))
    .map((id) => STORAGE_VALUES[id]);
}
