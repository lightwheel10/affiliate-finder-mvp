/**
 * Email Enrichment Service - Configuration
 * 
 * Centralized configuration for the multi-provider enrichment system.
 * All settings can be controlled via environment variables.
 * 
 * @module enrichment/config
 * 
 * @example Environment Variables:
 * ```bash
 * # Provider API Keys
 * APOLLO_API_KEY=your_apollo_key
 * LUSHA_API_KEY=your_lusha_key
 * 
 * # Provider Toggles (set to 'false' to disable)
 * APOLLO_ENABLED=true
 * LUSHA_ENABLED=false
 * 
 * # Strategy Configuration
 * PRIMARY_ENRICHMENT_PROVIDER=apollo  # 'apollo' or 'lusha'
 * ENRICHMENT_FALLBACK=true            # Try secondary if primary fails
 * ENRICHMENT_PARALLEL=false           # Search both simultaneously
 * 
 * # Feature Flags
 * ENRICH_PHONE_NUMBERS=false          # Also retrieve phone numbers
 * ```
 */

import { EnrichmentConfig, EnrichmentProviderName } from './types';

// =============================================================================
// CONFIGURATION OBJECT
// =============================================================================

/**
 * Main configuration object for the enrichment service
 * 
 * All values are read from environment variables with sensible defaults.
 * This configuration is read once at module load time.
 */
export const ENRICHMENT_CONFIG: EnrichmentConfig = {
  // ---------------------------------------------------------------------------
  // Provider Configuration
  // ---------------------------------------------------------------------------
  providers: {
    /**
     * Apollo.io Configuration
     * - Default: ENABLED (if API key is set)
     * - Cost: ~$0.03 per email lookup
     * - Endpoint: POST /v1/mixed_people/search
     */
    apollo: {
      enabled: process.env.APOLLO_ENABLED !== 'false',
      apiKey: process.env.APOLLO_API_KEY,
      costPerLookup: 0.03,
    },
    
    /**
     * Lusha Configuration
     * - Default: DISABLED (must explicitly enable)
     * - Cost: ~$0.05 per email lookup (estimate, verify with Lusha)
     * - Endpoint: GET/POST /v2/person
     * - Features: Bulk enrichment (100 contacts), phone numbers
     */
    lusha: {
      enabled: process.env.LUSHA_ENABLED === 'true',
      apiKey: process.env.LUSHA_API_KEY,
      costPerLookup: 0.05,
    },
    
    /**
     * Website Scraper Configuration - January 16, 2026
     * 
     * FREE fallback provider that scrapes affiliate websites for contact emails.
     * Runs ONLY when Lusha and Apollo both fail to find an email.
     * 
     * Why this exists:
     * - Lusha/Apollo are B2B databases that work great for large companies
     * - Affiliate sites are often small blogs/personal sites NOT in B2B databases
     * - Many countries have legal requirements to display contact info
     * - Testing showed 58% success rate vs 0% for Lusha/Apollo on affiliate sites
     * 
     * Methods used (in order):
     * 1. Contact pages (language-specific + universal)
     * 2. Mailto links (href="mailto:...")
     * 3. Structured data (JSON-LD)
     * 4. Meta tags
     * 
     * Cost: $0.00 (no API, just HTTP requests)
     * Credit policy: User pays 1 email credit if email is FOUND (consistent with other providers)
     * 
     * GLOBAL SUPPORT - January 16, 2026
     * Supports all 17 languages from onboarding:
     * - English, Spanish, German, French, Portuguese, Italian, Dutch
     * - Swedish, Danish, Norwegian, Finnish
     * - Polish, Czech
     * - Japanese, Korean
     * - Arabic, Hebrew
     */
    website_scraper: {
      enabled: process.env.WEBSITE_SCRAPER_ENABLED !== 'false', // Enabled by default
      timeoutMs: parseInt(process.env.WEBSITE_SCRAPER_TIMEOUT_MS || '10000', 10),
      // Universal contact paths that work across all languages
      // Language-specific paths are added dynamically by the provider
      contactPaths: [
        // Universal paths (English is the lingua franca of the web)
        '/contact',
        '/contact-us',
        '/about',
        '/about-us',
        // German (Impressumspflicht - legal requirement)
        '/impressum',
        '/kontakt',
        // French
        '/a-propos',
        '/mentions-legales',
        // Spanish
        '/contacto',
        '/sobre-nosotros',
        // Portuguese
        '/contato',
        '/sobre',
        // Italian
        '/contatti',
        '/chi-siamo',
        // Dutch
        '/over-ons',
        // Nordic (Swedish, Danish, Norwegian)
        '/om-oss',
        '/om-os',
        // Finnish
        '/yhteystiedot',
        '/meista',
        // Polish & Czech
        '/o-nas',
        // Homepage as last resort
        '/',
      ],
      costPerLookup: 0, // No API cost
    },
  },
  
  // ---------------------------------------------------------------------------
  // Strategy Configuration
  // ---------------------------------------------------------------------------
  strategy: {
    /**
     * Primary provider to use for lookups
     * - 'apollo' (default): Use Apollo.io first
     * - 'lusha': Use Lusha first
     */
    primary: (process.env.PRIMARY_ENRICHMENT_PROVIDER || 'apollo') as EnrichmentProviderName,
    
    /**
     * Whether to try the secondary provider if primary fails
     * - true (default): Automatically fallback
     * - false: Only use primary provider
     */
    fallbackEnabled: process.env.ENRICHMENT_FALLBACK !== 'false',
    
    /**
     * Whether to search all providers simultaneously
     * - true: Search in parallel (faster, but costs more)
     * - false (default): Search sequentially with fallback
     */
    parallelSearch: process.env.ENRICHMENT_PARALLEL === 'true',
  },
  
  // ---------------------------------------------------------------------------
  // Feature Flags
  // ---------------------------------------------------------------------------
  features: {
    /**
     * Enable bulk enrichment (Lusha supports up to 100 contacts per request)
     */
    bulkEnrichment: true,
    
    /**
     * Also retrieve phone numbers (Lusha only, requires Unified Credits plan)
     */
    phoneNumbers: process.env.ENRICH_PHONE_NUMBERS === 'true',
    
    /**
     * Accept partial profiles (some data may be missing)
     */
    partialProfiles: true,
  },
} as const;

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validates the enrichment configuration
 * 
 * Checks that at least one provider is enabled and properly configured.
 * Logs warnings for common configuration issues.
 * 
 * @throws Error if no providers are enabled
 * @returns true if configuration is valid
 * 
 * @example
 * ```typescript
 * try {
 *   validateEnrichmentConfig();
 *   console.log('Configuration is valid');
 * } catch (error) {
 *   console.error('Invalid configuration:', error.message);
 * }
 * ```
 */
export function validateEnrichmentConfig(): boolean {
  const { providers, strategy } = ENRICHMENT_CONFIG;
  
  // Count enabled providers
  const enabledProviders: EnrichmentProviderName[] = [];
  
  if (providers.apollo.enabled) {
    enabledProviders.push('apollo');
  }
  
  if (providers.lusha.enabled) {
    enabledProviders.push('lusha');
  }
  
  // Ensure at least one provider is enabled
  if (enabledProviders.length === 0) {
    throw new Error(
      'No enrichment providers enabled. Set APOLLO_ENABLED=true or LUSHA_ENABLED=true'
    );
  }
  
  // Warn about missing API keys for enabled providers
  if (providers.apollo.enabled && !providers.apollo.apiKey) {
    console.warn('⚠️ [Enrichment] Apollo enabled but APOLLO_API_KEY not set');
  }
  
  if (providers.lusha.enabled && !providers.lusha.apiKey) {
    console.warn('⚠️ [Enrichment] Lusha enabled but LUSHA_API_KEY not set');
  }
  
  // Warn if primary provider is not enabled
  if (!enabledProviders.includes(strategy.primary)) {
    console.warn(
      `⚠️ [Enrichment] Primary provider '${strategy.primary}' is not enabled. ` +
      `Will use '${enabledProviders[0]}' instead.`
    );
  }
  
  // Log configuration summary
  console.log(
    `📧 [Enrichment] Configured with providers: ${enabledProviders.join(', ')} | ` +
    `Primary: ${strategy.primary} | Fallback: ${strategy.fallbackEnabled} | ` +
    `Parallel: ${strategy.parallelSearch}`
  );
  
  return true;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get list of currently enabled provider names
 * 
 * @returns Array of enabled provider names
 * 
 * @example
 * ```typescript
 * const providers = getEnabledProviders();
 * // ['apollo'] or ['apollo', 'lusha'] depending on config
 * ```
 */
export function getEnabledProviders(): EnrichmentProviderName[] {
  const enabled: EnrichmentProviderName[] = [];
  
  if (ENRICHMENT_CONFIG.providers.apollo.enabled) {
    enabled.push('apollo');
  }
  
  if (ENRICHMENT_CONFIG.providers.lusha.enabled) {
    enabled.push('lusha');
  }
  
  return enabled;
}

/**
 * Check if a specific provider is enabled
 * 
 * @param provider - Provider name to check
 * @returns true if the provider is enabled
 */
export function isProviderEnabled(provider: EnrichmentProviderName): boolean {
  return ENRICHMENT_CONFIG.providers[provider].enabled;
}

/**
 * Get the effective primary provider (accounting for disabled providers)
 * 
 * @returns The provider name to use as primary
 */
export function getEffectivePrimaryProvider(): EnrichmentProviderName {
  const { strategy, providers } = ENRICHMENT_CONFIG;
  
  // If configured primary is enabled, use it
  if (providers[strategy.primary].enabled) {
    return strategy.primary;
  }
  
  // Otherwise, return the first enabled provider
  if (providers.apollo.enabled) return 'apollo';
  if (providers.lusha.enabled) return 'lusha';
  
  // This shouldn't happen if validateEnrichmentConfig() was called
  throw new Error('No enrichment providers are enabled');
}

