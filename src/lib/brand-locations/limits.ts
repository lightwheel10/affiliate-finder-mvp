import { SEARCH_INPUT_LIMITS } from '@/lib/plans/catalog';

/**
 * Shared management limits used by both browser forms and server validation.
 * Keeping these values in one client-safe module prevents the UI and API from
 * silently disagreeing about what a location can store.
 */
export const BRAND_LOCATION_MANAGEMENT_LIMITS = Object.freeze({
  affiliateTypes: 20,
  topics: SEARCH_INPUT_LIMITS.maxKeywords,
  competitors: SEARCH_INPUT_LIMITS.maxCompetitors,
});
