/**
 * Email Enrichment Service
 * 
 * Orchestrates email enrichment across multiple providers (Apollo, Lusha).
 * Supports configurable strategies: primary/fallback or parallel search.
 * 
 * @module enrichment
 * 
 * @example Basic Usage
 * ```typescript
 * import { enrichmentService } from '@/app/services/enrichment';
 * 
 * // Find email for a domain
 * const result = await enrichmentService.findEmail({
 *   domain: 'example.com',
 *   personName: 'John Doe'
 * });
 * 
 * if (result.found) {
 *   console.log(`Email: ${result.email}`);
 *   console.log(`Provider: ${result.provider}`);
 * }
 * ```
 * 
 * @example Check Available Providers
 * ```typescript
 * const providers = enrichmentService.getAvailableProviders();
 * console.log(`Available: ${providers.join(', ')}`);
 * // Output: "Available: apollo, lusha"
 * ```
 * 
 * Configuration (via environment variables):
 * - APOLLO_ENABLED: Enable Apollo provider (default: true)
 * - LUSHA_ENABLED: Enable Lusha provider (default: false)
 * - PRIMARY_ENRICHMENT_PROVIDER: 'apollo' or 'lusha' (default: 'apollo')
 * - ENRICHMENT_FALLBACK: Try secondary if primary fails (default: true)
 * - ENRICHMENT_PARALLEL: Search all providers simultaneously (default: false)
 */

import { 
  IEnrichmentProvider, 
  EnrichmentRequest, 
  EnrichmentResponse,
  EnrichmentProviderName 
} from './types';
import { 
  ENRICHMENT_CONFIG, 
  validateEnrichmentConfig,
  getEffectivePrimaryProvider 
} from './config';
import { ApolloProvider, LushaProvider } from './providers';

// =============================================================================
// RE-EXPORTS
// =============================================================================

// Export types for consumers
export * from './types';
export { ENRICHMENT_CONFIG, validateEnrichmentConfig, getEnabledProviders } from './config';

// =============================================================================
// ENRICHMENT SERVICE CLASS
// =============================================================================

/**
 * Main orchestrator for email enrichment across multiple providers
 * 
 * This service manages provider registration, selection, and fallback logic.
 * It provides a unified interface for email enrichment regardless of which
 * provider is used under the hood.
 * 
 * Features:
 * - Automatic provider registration based on configuration
 * - Primary/fallback strategy for reliability
 * - Parallel search option for speed
 * - Consistent response format across all providers
 * 
 * @example
 * ```typescript
 * // The service is pre-configured and ready to use
 * import { enrichmentService } from '@/app/services/enrichment';
 * 
 * const result = await enrichmentService.findEmail({
 *   domain: 'company.com',
 *   firstName: 'John',
 *   lastName: 'Smith'
 * });
 * ```
 */
export class EnrichmentService {
  /** Map of registered providers by name */
  private providers: Map<EnrichmentProviderName, IEnrichmentProvider>;
  
  /** Whether the service has been initialized */
  private initialized: boolean = false;
  
  constructor() {
    this.providers = new Map();
    this.initialize();
  }
  
  // ===========================================================================
  // INITIALIZATION
  // ===========================================================================
  
  /**
   * Initialize the service by registering enabled providers
   * 
   * This is called automatically in the constructor but can be
   * called again to re-initialize with new configuration.
   */
  private initialize(): void {
    // Clear existing providers
    this.providers.clear();
    
    // Register Apollo provider if enabled
    const apollo = new ApolloProvider();
    if (apollo.isEnabled()) {
      this.providers.set('apollo', apollo);
      console.log('✅ [Enrichment] Apollo provider registered');
    }
    
    // Register Lusha provider if enabled
    const lusha = new LushaProvider();
    if (lusha.isEnabled()) {
      this.providers.set('lusha', lusha);
      console.log('✅ [Enrichment] Lusha provider registered');
    }
    
    // Validate configuration
    try {
      validateEnrichmentConfig();
      this.initialized = true;
    } catch (error) {
      console.error('❌ [Enrichment] Configuration validation failed:', error);
      this.initialized = false;
    }
  }
  
  // ===========================================================================
  // PUBLIC METHODS
  // ===========================================================================
  
  /**
   * Find email using configured strategy
   * 
   * Depending on configuration, this will:
   * - Use parallel search (all providers simultaneously)
   * - Use sequential search (primary first, then fallback)
   * 
   * @param request - Search parameters
   * @returns Enrichment response from the first successful provider
   * 
   * @example
   * ```typescript
   * // Basic search
   * const result = await service.findEmail({
   *   domain: 'example.com'
   * });
   * 
   * // Search with person name
   * const result = await service.findEmail({
   *   domain: 'example.com',
   *   personName: 'Jane Doe'
   * });
   * 
   * // Search with LinkedIn URL (Lusha only)
   * const result = await service.findEmail({
   *   domain: 'example.com',
   *   linkedinUrl: 'https://linkedin.com/in/janedoe'
   * });
   * ```
   */
  async findEmail(request: EnrichmentRequest): Promise<EnrichmentResponse> {
    // Check if service is properly initialized
    if (!this.initialized || this.providers.size === 0) {
      console.error('❌ [Enrichment] Service not initialized or no providers available');
      return {
        email: null,
        found: false,
        provider: 'apollo', // Default for error response
        error: 'Enrichment service not properly configured',
        costEstimate: 0,
      };
    }
    
    const { parallelSearch } = ENRICHMENT_CONFIG.strategy;
    
    // Parallel search: query all providers simultaneously
    if (parallelSearch && this.providers.size > 1) {
      return this.parallelSearch(request);
    }
    
    // Sequential search: primary first, then fallback
    return this.sequentialSearch(request);
  }
  
  /**
   * Find email using a specific provider
   * 
   * Bypasses the configured strategy and uses only the specified provider.
   * Useful when you need to force a specific provider for testing or
   * when you know which provider has the best data for a domain.
   * 
   * @param providerName - Name of the provider to use
   * @param request - Search parameters
   * @returns Enrichment response from the specified provider
   * 
   * @example
   * ```typescript
   * // Force Apollo
   * const result = await service.findEmailWithProvider('apollo', {
   *   domain: 'example.com'
   * });
   * 
   * // Force Lusha
   * const result = await service.findEmailWithProvider('lusha', {
   *   domain: 'example.com',
   *   firstName: 'John',
   *   lastName: 'Doe'
   * });
   * ```
   */
  async findEmailWithProvider(
    providerName: EnrichmentProviderName,
    request: EnrichmentRequest
  ): Promise<EnrichmentResponse> {
    const provider = this.providers.get(providerName);
    
    if (!provider) {
      return {
        email: null,
        found: false,
        provider: providerName,
        error: `Provider '${providerName}' is not available`,
        costEstimate: 0,
      };
    }
    
    return provider.findEmail(request);
  }
  
  /**
   * Get list of available (enabled and configured) provider names
   * 
   * @returns Array of provider names that can be used
   * 
   * @example
   * ```typescript
   * const providers = service.getAvailableProviders();
   * // ['apollo'] or ['apollo', 'lusha']
   * ```
   */
  getAvailableProviders(): EnrichmentProviderName[] {
    return Array.from(this.providers.keys());
  }
  
  /**
   * Check if a specific provider is available
   * 
   * @param providerName - Name of the provider to check
   * @returns true if the provider is registered and enabled
   */
  isProviderAvailable(providerName: EnrichmentProviderName): boolean {
    return this.providers.has(providerName);
  }
  
  /**
   * Get the estimated cost for an email lookup
   * 
   * Returns the cost based on the current strategy:
   * - Sequential: Cost of primary provider
   * - Parallel: Sum of all provider costs
   * 
   * @returns Estimated cost in USD
   */
  getEstimatedCost(): number {
    const { parallelSearch } = ENRICHMENT_CONFIG.strategy;
    
    if (parallelSearch) {
      // Parallel: sum of all provider costs
      let total = 0;
      for (const provider of this.providers.values()) {
        total += provider.estimateCost();
      }
      return total;
    }
    
    // Sequential: cost of primary provider
    const primaryName = getEffectivePrimaryProvider();
    const primaryProvider = this.providers.get(primaryName);
    return primaryProvider?.estimateCost() || 0;
  }
  
  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================
  
  /**
   * Search all providers in parallel and return first success
   * 
   * @param request - Search parameters
   * @returns First successful response, or last error
   */
  private async parallelSearch(request: EnrichmentRequest): Promise<EnrichmentResponse> {
    console.log('🔀 [Enrichment] Starting parallel search across all providers');
    
    // Create promises for all providers
    const promises = Array.from(this.providers.values()).map(provider =>
      provider.findEmail(request).catch(error => ({
        email: null,
        found: false,
        provider: provider.name,
        error: error instanceof Error ? error.message : String(error),
        costEstimate: 0,
      } as EnrichmentResponse))
    );
    
    // Wait for all to complete
    const results = await Promise.all(promises);
    
    // Return first successful result
    for (const result of results) {
      if (result.found && result.email) {
        console.log(`✅ [Enrichment] Parallel search succeeded via ${result.provider}`);
        return result;
      }
    }
    
    // All failed - return the last result (or a generic error)
    console.warn('⚠️ [Enrichment] Parallel search: no providers found an email');
    return results[results.length - 1] || {
      email: null,
      found: false,
      provider: getEffectivePrimaryProvider(),
      error: 'All providers failed to find an email',
      costEstimate: 0,
    };
  }
  
  /**
   * Search providers sequentially (primary first, then fallback)
   * 
   * @param request - Search parameters
   * @returns Response from primary or fallback provider
   */
  private async sequentialSearch(request: EnrichmentRequest): Promise<EnrichmentResponse> {
    const { fallbackEnabled } = ENRICHMENT_CONFIG.strategy;
    const primaryName = getEffectivePrimaryProvider();
    
    // Get primary provider
    const primaryProvider = this.providers.get(primaryName);
    
    if (!primaryProvider) {
      // Primary not available, try any available provider
      const availableProvider = this.providers.values().next().value;
      if (availableProvider) {
        console.warn(`⚠️ [Enrichment] Primary '${primaryName}' not available, using '${availableProvider.name}'`);
        return availableProvider.findEmail(request);
      }
      
      return {
        email: null,
        found: false,
        provider: primaryName,
        error: 'No enrichment providers available',
        costEstimate: 0,
      };
    }
    
    // Try primary provider
    console.log(`📧 [Enrichment] Searching with primary provider: ${primaryName}`);
    const primaryResult = await primaryProvider.findEmail(request);
    
    // If found or fallback disabled, return result
    if (primaryResult.found || !fallbackEnabled) {
      return primaryResult;
    }
    
    // Try fallback provider(s)
    for (const [name, provider] of this.providers) {
      if (name !== primaryName) {
        console.log(`🔄 [Enrichment] Primary failed, trying fallback: ${name}`);
        const fallbackResult = await provider.findEmail(request);
        
        if (fallbackResult.found) {
          return fallbackResult;
        }
      }
    }
    
    // All providers failed, return primary result
    console.warn('⚠️ [Enrichment] All providers failed to find an email');
    return primaryResult;
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

/**
 * Pre-configured singleton instance of the EnrichmentService
 * 
 * Use this for most cases. The service is initialized with
 * configuration from environment variables.
 * 
 * @example
 * ```typescript
 * import { enrichmentService } from '@/app/services/enrichment';
 * 
 * const result = await enrichmentService.findEmail({
 *   domain: 'example.com'
 * });
 * ```
 */
export const enrichmentService = new EnrichmentService();

