/**
 * Email Enrichment Service - Type Definitions
 * 
 * This module defines the core types and interfaces for the multi-provider
 * email enrichment system. It supports Apollo.io, Lusha, and future providers.
 * 
 * @module enrichment/types
 */

// =============================================================================
// PROVIDER TYPES
// =============================================================================

/**
 * Available enrichment provider identifiers
 * 
 * Updated: January 16, 2026 - Added 'website_scraper' provider
 * 
 * Provider order of priority (in sequential search):
 * 1. lusha - Primary B2B provider (paid API)
 * 2. apollo - Fallback B2B provider (paid API)
 * 3. website_scraper - Free fallback, scrapes contact pages (no API cost)
 */
export type EnrichmentProviderName = 'apollo' | 'lusha' | 'website_scraper';

/**
 * Email status values used throughout the application
 */
export type EmailStatus = 'not_searched' | 'searching' | 'found' | 'not_found' | 'error';

// =============================================================================
// REQUEST/RESPONSE INTERFACES
// =============================================================================

/**
 * Input parameters for email enrichment requests
 * 
 * Different providers require different combinations:
 * - Apollo: domain + optional personName
 * - Lusha: (firstName + lastName + domain) OR email OR linkedinUrl
 * - WebsiteScraper: domain + optional targetLanguage (for path prioritization)
 * 
 * Updated: January 16, 2026 - Added targetLanguage for global support
 */
export interface EnrichmentRequest {
  /** Company/website domain (e.g., "techcrunch.com") */
  domain: string;
  
  /** Full person name (will be split into first/last) */
  personName?: string;
  
  /** First name of the person */
  firstName?: string;
  
  /** Last name of the person */
  lastName?: string;
  
  /** Known email address (for reverse lookup) */
  email?: string;
  
  /** LinkedIn profile URL */
  linkedinUrl?: string;
  
  /**
   * User's target language from onboarding (January 16, 2026)
   * 
   * Used by WebsiteScraperProvider to prioritize language-specific
   * contact page paths. For example, if targetLanguage is 'German',
   * the scraper will try /impressum and /kontakt before /contact.
   * 
   * Supported values (from onboarding):
   * English, Spanish, German, French, Portuguese, Italian, Dutch,
   * Swedish, Danish, Norwegian, Finnish, Polish, Czech,
   * Japanese, Korean, Arabic, Hebrew
   */
  targetLanguage?: string;
}

/**
 * Contact details from enrichment
 */
export interface EnrichedContact {
  /** Person's first name */
  firstName?: string;
  
  /** Person's last name */
  lastName?: string;
  
  /** Full name (if first/last not available) */
  fullName?: string;
  
  /** Job title */
  title?: string;
  
  /** LinkedIn profile URL */
  linkedinUrl?: string;
  
  /** Email addresses for this contact */
  emails: string[];
  
  /** Phone numbers for this contact */
  phoneNumbers?: string[];
}

/**
 * Normalized response from any enrichment provider
 * 
 * All providers return data in this format, regardless of their
 * native response structure. This allows the application to work
 * with enrichment results without knowing which provider was used.
 */
export interface EnrichmentResponse {
  /** Primary email address found (null if not found) */
  email: string | null;
  
  /** All email addresses found across all contacts */
  emails?: string[];
  
  /** All contacts found with their details */
  contacts?: EnrichedContact[];
  
  /** Person's first name (from primary contact) */
  firstName?: string;
  
  /** Person's last name (from primary contact) */
  lastName?: string;
  
  /** Job title (from primary contact) */
  title?: string;
  
  /** LinkedIn profile URL (from primary contact) */
  linkedinUrl?: string;
  
  /** Phone numbers (from primary contact, Lusha only) */
  phoneNumbers?: string[];
  
  /** Whether an email was successfully found */
  found: boolean;
  
  /** Which provider returned this result */
  provider: EnrichmentProviderName;
  
  /** Error message if the lookup failed */
  error?: string;
  
  /** Estimated cost of this API call in USD */
  costEstimate: number;
}

// =============================================================================
// PROVIDER INTERFACE
// =============================================================================

/**
 * Interface that all enrichment providers must implement
 * 
 * This allows the EnrichmentService to work with any provider
 * without knowing the implementation details.
 * 
 * @example
 * ```typescript
 * class MyProvider implements IEnrichmentProvider {
 *   name = 'myprovider' as const;
 *   isEnabled() { return !!process.env.MY_API_KEY; }
 *   async findEmail(request) { ... }
 *   estimateCost() { return 0.05; }
 * }
 * ```
 */
export interface IEnrichmentProvider {
  /** Unique identifier for this provider */
  readonly name: EnrichmentProviderName;
  
  /**
   * Check if this provider is enabled and properly configured
   * @returns true if the provider can be used
   */
  isEnabled(): boolean;
  
  /**
   * Search for an email address using this provider
   * @param request - Search parameters
   * @returns Normalized enrichment response
   */
  findEmail(request: EnrichmentRequest): Promise<EnrichmentResponse>;
  
  /**
   * Get the estimated cost per API call for this provider
   * @returns Cost in USD
   */
  estimateCost(): number;
}

// =============================================================================
// CONFIGURATION TYPES
// =============================================================================

/**
 * Configuration for a single provider
 */
export interface ProviderConfig {
  /** Whether this provider is enabled */
  enabled: boolean;
  
  /** API key for authentication */
  apiKey: string | undefined;
  
  /** Cost per lookup in USD */
  costPerLookup: number;
}

/**
 * Strategy configuration for the enrichment service
 */
export interface StrategyConfig {
  /** Which provider to try first */
  primary: EnrichmentProviderName;
  
  /** Whether to try another provider if primary fails */
  fallbackEnabled: boolean;
  
  /** Whether to search all providers simultaneously */
  parallelSearch: boolean;
}

/**
 * Feature flags for the enrichment service
 */
export interface FeatureFlags {
  /** Enable bulk enrichment (Lusha supports up to 100 contacts) */
  bulkEnrichment: boolean;
  
  /** Also retrieve phone numbers (Lusha only) */
  phoneNumbers: boolean;
  
  /** Accept partial profiles (some data missing) */
  partialProfiles: boolean;
}

/**
 * Configuration for the website scraper provider
 * 
 * Added: January 16, 2026
 * 
 * The website scraper is a FREE fallback that runs when paid providers fail.
 * It scrapes contact pages, structured data, and mailto links to find emails.
 */
export interface WebsiteScraperConfig {
  /** Whether the scraper is enabled (default: true) */
  enabled: boolean;
  
  /** Request timeout in milliseconds (default: 10000) */
  timeoutMs: number;
  
  /** Contact page paths to check (in order) */
  contactPaths: string[];
  
  /** Cost per lookup (always 0 since no API cost) */
  costPerLookup: number;
}

/**
 * Complete enrichment service configuration
 * 
 * Updated: January 16, 2026 - Added website_scraper provider
 */
export interface EnrichmentConfig {
  providers: {
    apollo: ProviderConfig;
    lusha: ProviderConfig;
    website_scraper: WebsiteScraperConfig;
  };
  strategy: StrategyConfig;
  features: FeatureFlags;
}

