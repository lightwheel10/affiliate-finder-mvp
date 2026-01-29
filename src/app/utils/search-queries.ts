/**
 * =============================================================================
 * BRAND AND COMPETITOR SEARCH QUERIES
 * =============================================================================
 *
 * Created: January 23, 2026
 * Purpose: Build optimized search queries to find existing brand affiliates
 *          and competitor affiliates that could be recruited.
 *
 * CONTEXT:
 * --------
 * When user searches for keywords, we also want to search for:
 * 1. People already promoting their brand (existing affiliates)
 * 2. People promoting competitors (potential recruits)
 *
 * This file provides shared utilities for building these search queries.
 * Used by both:
 * - /api/scout (manual search)
 * - /api/cron/auto-scan (automated weekly scan)
 *
 * QUERY PATTERNS:
 * ---------------
 * Brand searches find EXISTING affiliates:
 *   - "brand review" → Bloggers who reviewed the product
 *   - "brand affiliate" → People with affiliate links
 *   - "brand erfahrung" → German reviewers
 *
 * Competitor searches find POTENTIAL recruits:
 *   - "competitor alternative" → People comparing products
 *   - "competitor review" → Reviewers who could switch
 *   - "competitor vs" → Comparison content creators
 *
 * =============================================================================
 */

// =============================================================================
// DOMAIN PATTERNS - January 23, 2026
//
// Common TLD patterns to strip from domain names when extracting brand names.
// Ordered by frequency to optimize regex matching.
// =============================================================================
const TLD_PATTERN = /\.(com|io|co|net|org|app|de|uk|fr|es|it|nl|be|at|ch|se|no|dk|fi|pl|cz|hu|pt|gr|ie|au|nz|ca|us|in|jp|kr|cn|sg|hk|tw|br|mx|ar|cl|co\.uk|com\.au|co\.nz|com\.br)$/i;

// =============================================================================
// BRAND NAME EXTRACTION - January 23, 2026
//
// Extracts the brand name from a domain URL.
// Handles various formats:
// - Full URLs: https://www.guffles.com/page
// - Domains: www.guffles.com
// - Subdomains: app.guffles.io
// =============================================================================

/**
 * Extract the brand name from a domain or URL.
 *
 * Examples:
 *   - "guffles.com" → "guffles"
 *   - "https://www.leadfeeder.io/pricing" → "leadfeeder"
 *   - "my-brand.co.uk" → "my-brand"
 *   - "app.hubspot.com" → "hubspot"
 *
 * @param domain - The domain or URL to extract brand from
 * @returns The extracted brand name, or empty string if extraction fails
 */
export function extractBrandName(domain: string): string {
  if (!domain || typeof domain !== 'string') {
    return '';
  }

  let cleaned = domain.trim().toLowerCase();

  // Remove protocol (http://, https://)
  cleaned = cleaned.replace(/^https?:\/\//, '');

  // Remove www. prefix
  cleaned = cleaned.replace(/^www\./, '');

  // Remove path and query string (everything after first /)
  cleaned = cleaned.replace(/\/.*$/, '');

  // Remove port number if present (e.g., :3000)
  cleaned = cleaned.replace(/:\d+$/, '');

  // Handle subdomains: keep only the main domain
  // e.g., "app.hubspot.com" → "hubspot.com" → "hubspot"
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    // Check if last two parts form a compound TLD (co.uk, com.au, etc.)
    const lastTwo = parts.slice(-2).join('.');
    if (/^(co|com|org|net)\.[a-z]{2}$/.test(lastTwo)) {
      // Compound TLD: take the part before it
      cleaned = parts.slice(-3, -2).join('');
    } else {
      // Regular TLD: take the second-to-last part
      cleaned = parts.slice(-2, -1).join('');
    }
  } else if (parts.length === 2) {
    // Simple domain like "guffles.com"
    cleaned = parts[0];
  }

  // Final cleanup: remove any remaining TLD suffix
  cleaned = cleaned.replace(TLD_PATTERN, '');

  return cleaned;
}

// =============================================================================
// LOCALIZED SEARCH TERMS - January 29, 2026
//
// UPDATED: Now imports from shared utility for consistency.
// Uses FULLY_LOCALIZED_TERMS - no English mixing for non-English targets.
// =============================================================================
import { FULLY_LOCALIZED_TERMS, getLocalizedTerms } from './localized-search';

/**
 * Get the localized "review" term for a target language.
 * 
 * January 29, 2026 UPDATED: Now uses shared utility
 * 
 * @param targetLanguage - Language name from onboarding (e.g., "German", "Spanish")
 * @returns First search term (e.g., "erfahrung" for German, "review" for English)
 */
function getLocalizedReviewTerm(targetLanguage?: string | null): string {
  const terms = getLocalizedTerms(targetLanguage);
  return terms.searchTerms[0]; // First term (erfahrung, review, etc.)
}

/**
 * Get the localized discount term for a target language.
 */
function getLocalizedDiscountTerm(targetLanguage?: string | null): string {
  const terms = getLocalizedTerms(targetLanguage);
  return terms.discount;
}

// =============================================================================
// BRAND SEARCH QUERIES - January 23, 2026
//
// Build search queries to find people already promoting the user's brand.
// These are EXISTING affiliates - people who already know and review the product.
// =============================================================================

/**
 * Build search queries to find existing affiliates of a brand.
 *
 * These queries help find:
 * - Bloggers who have reviewed the product
 * - Content creators with affiliate links
 * - People promoting the brand on social media
 *
 * @param brand - The brand domain (e.g., "guffles.com") or name
 * @param targetLanguage - User's target language from onboarding (optional)
 * @returns Array of search query strings
 */
export function buildBrandSearchQueries(brand: string, targetLanguage?: string | null): string[] {
  const brandName = extractBrandName(brand);

  if (!brandName) {
    return [];
  }

  // ==========================================================================
  // BRAND QUERY PATTERNS - January 29, 2026
  // UPDATED: Now uses FULLY LOCALIZED terms - no English mixing
  //
  // For German: "bedrop erfahrung", "bedrop test", "bedrop bewertung", "bedrop rabatt"
  // For English: "bedrop review", "bedrop test", "bedrop blog", "bedrop discount"
  // ==========================================================================
  const terms = getLocalizedTerms(targetLanguage);
  
  const queries: string[] = [];
  
  // Add first 3 web terms
  for (const term of terms.webTerms.slice(0, 3)) {
    queries.push(`"${brandName} ${term}"`);
  }
  
  // Add discount term
  queries.push(`"${brandName} ${terms.discount}"`);

  return queries;
}

// =============================================================================
// COMPETITOR SEARCH QUERIES - January 23, 2026
//
// Build search queries to find people promoting competitors.
// These are POTENTIAL recruits - people who could switch to promoting our brand.
// =============================================================================

/**
 * Build search queries to find affiliates of a competitor.
 *
 * These queries help find:
 * - Reviewers who cover the competitor's product
 * - People testing/discussing the competitor
 * - People with discount codes (potential affiliates)
 *
 * @param competitor - The competitor domain (e.g., "leadfeeder.com") or name
 * @param targetLanguage - User's target language from onboarding (optional)
 * @returns Array of search query strings
 */
export function buildCompetitorSearchQueries(competitor: string, targetLanguage?: string | null): string[] {
  const competitorName = extractBrandName(competitor);

  if (!competitorName) {
    return [];
  }

  // ==========================================================================
  // COMPETITOR QUERY PATTERNS - January 29, 2026
  // UPDATED: Now uses FULLY LOCALIZED terms - no English mixing
  //
  // OLD (buggy): "bedrop alternative", "bedrop review", "bedrop vs" (English)
  // NEW: "bedrop erfahrung", "bedrop test", "bedrop bewertung", "bedrop rabatt"
  //
  // Rationale: "alternative" and "vs" are English words that don't work well
  // for non-English markets. Use review/test terms instead to find affiliates
  // who are actually reviewing/promoting the competitor.
  // ==========================================================================
  const terms = getLocalizedTerms(targetLanguage);
  
  const queries: string[] = [];
  
  // Add first 3 web terms
  for (const term of terms.webTerms.slice(0, 3)) {
    queries.push(`"${competitorName} ${term}"`);
  }
  
  // Add discount term (find people with competitor discount codes)
  queries.push(`"${competitorName} ${terms.discount}"`);

  return queries;
}

// =============================================================================
// COMBINED QUERY BUILDER - January 23, 2026
//
// Builds all search queries for a user's brand and competitors.
// Used by the scout API to run all searches in parallel.
// =============================================================================

/**
 * Search query with metadata about its type.
 */
export interface TaggedSearchQuery {
  query: string;
  type: 'brand' | 'competitor';
  /** The original domain/value (for discoveryMethod tagging) */
  sourceValue: string;
}

/**
 * Build all brand and competitor search queries for a user.
 *
 * This combines brand queries and competitor queries into a single array
 * with metadata for proper discoveryMethod tagging.
 *
 * @param brand - User's brand domain (optional)
 * @param competitors - Array of competitor domains (optional)
 * @param targetLanguage - User's target language from onboarding (optional)
 * @returns Array of tagged search queries
 */
export function buildAllBrandCompetitorQueries(
  brand?: string | null,
  competitors?: string[] | null,
  targetLanguage?: string | null
): TaggedSearchQuery[] {
  const queries: TaggedSearchQuery[] = [];

  // ==========================================================================
  // BRAND QUERIES - January 23, 2026
  // Updated: January 23, 2026 - Pass targetLanguage for localized queries
  // Add queries to find existing affiliates of the user's brand
  // ==========================================================================
  if (brand) {
    const brandQueries = buildBrandSearchQueries(brand, targetLanguage);
    for (const query of brandQueries) {
      queries.push({
        query,
        type: 'brand',
        sourceValue: brand,
      });
    }
  }

  // ==========================================================================
  // COMPETITOR QUERIES - January 23, 2026
  // Updated: January 23, 2026 - Pass targetLanguage for localized queries
  // Add queries to find affiliates of each competitor
  // ==========================================================================
  if (competitors && competitors.length > 0) {
    for (const competitor of competitors) {
      const competitorQueries = buildCompetitorSearchQueries(competitor, targetLanguage);
      for (const query of competitorQueries) {
        queries.push({
          query,
          type: 'competitor',
          sourceValue: competitor,
        });
      }
    }
  }

  return queries;
}
