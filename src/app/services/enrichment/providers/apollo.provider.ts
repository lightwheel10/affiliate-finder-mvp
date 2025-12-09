/**
 * Apollo.io Enrichment Provider
 * 
 * Implements email enrichment using Apollo.io's People Search API.
 * Apollo is a B2B contact database that provides email addresses
 * based on company domain and optional person name.
 * 
 * @module enrichment/providers/apollo
 * 
 * @see https://apolloio.github.io/apollo-api-docs/
 * 
 * @example
 * ```typescript
 * const apollo = new ApolloProvider();
 * if (apollo.isEnabled()) {
 *   const result = await apollo.findEmail({
 *     domain: 'techcrunch.com',
 *     personName: 'John Smith'
 *   });
 *   console.log(result.email); // 'john.smith@techcrunch.com'
 * }
 * ```
 */

import { BaseEnrichmentProvider } from './base.provider';
import { EnrichmentRequest, EnrichmentResponse, EnrichmentProviderName } from '../types';
import { ENRICHMENT_CONFIG } from '../config';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Apollo API base URL */
const APOLLO_API_BASE = 'https://api.apollo.io';

/** Apollo People Search endpoint */
const APOLLO_SEARCH_ENDPOINT = '/v1/mixed_people/search';

// =============================================================================
// PROVIDER IMPLEMENTATION
// =============================================================================

/**
 * Apollo.io email enrichment provider
 * 
 * Uses Apollo's People Search API to find email addresses for contacts
 * at a given company domain. Optionally filters by person name.
 * 
 * Configuration:
 * - APOLLO_API_KEY: Required API key
 * - APOLLO_ENABLED: Set to 'false' to disable (default: true)
 * 
 * Pricing:
 * - ~$0.03 per email lookup
 */
export class ApolloProvider extends BaseEnrichmentProvider {
  readonly name: EnrichmentProviderName = 'apollo';
  
  /** API key from environment */
  private readonly apiKey: string | undefined;
  
  /** Cost per lookup in USD */
  private readonly costPerLookup: number;
  
  constructor() {
    super();
    this.apiKey = ENRICHMENT_CONFIG.providers.apollo.apiKey;
    this.costPerLookup = ENRICHMENT_CONFIG.providers.apollo.costPerLookup;
  }
  
  // ===========================================================================
  // IEnrichmentProvider Implementation
  // ===========================================================================
  
  /**
   * Check if Apollo provider is enabled and configured
   * 
   * @returns true if Apollo is enabled AND has an API key
   */
  isEnabled(): boolean {
    return ENRICHMENT_CONFIG.providers.apollo.enabled && !!this.apiKey;
  }
  
  /**
   * Get the estimated cost per API call
   * 
   * @returns Cost in USD (~$0.03)
   */
  estimateCost(): number {
    return this.costPerLookup;
  }
  
  /**
   * Search for an email address using Apollo's People Search API
   * 
   * @param request - Search parameters (domain required, personName optional)
   * @returns Enrichment response with email if found
   * 
   * @example
   * ```typescript
   * const result = await apollo.findEmail({
   *   domain: 'example.com',
   *   personName: 'Jane Doe'
   * });
   * 
   * if (result.found) {
   *   console.log(`Found: ${result.email}`);
   *   console.log(`Title: ${result.title}`);
   * }
   * ```
   */
  async findEmail(request: EnrichmentRequest): Promise<EnrichmentResponse> {
    // Validate provider is enabled
    if (!this.isEnabled()) {
      return this.createErrorResponse(
        'Apollo provider is not enabled or API key is missing'
      );
    }
    
    // Validate required parameters
    if (!request.domain) {
      return this.createErrorResponse('Domain is required for Apollo search');
    }
    
    // Clean and prepare search parameters
    const cleanDomain = this.cleanDomain(request.domain);
    
    this.log(`Searching for email: domain="${cleanDomain}", person="${request.personName || 'any'}"`);
    
    try {
      // Build Apollo search payload
      const searchPayload = this.buildSearchPayload(cleanDomain, request);
      
      // Make API request
      const response = await fetch(`${APOLLO_API_BASE}${APOLLO_SEARCH_ENDPOINT}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Api-Key': this.apiKey!,
        },
        body: JSON.stringify(searchPayload),
      });
      
      // Handle API errors
      if (!response.ok) {
        const errorText = await response.text();
        return this.createErrorResponse(
          `API error: ${response.status}`,
          `Apollo API returned ${response.status}: ${errorText}`
        );
      }
      
      // Parse response
      const data = await response.json();
      
      // Check for results
      if (!data.people || data.people.length === 0) {
        this.warn(`No people found for domain: ${cleanDomain}`);
        return this.createNotFoundResponse();
      }
      
      // Extract first person's data
      const person = data.people[0];
      
      // Check if email is available
      if (person.email) {
        this.log(`Found email for ${cleanDomain}`);
        
        return this.createSuccessResponse(person.email, {
          firstName: person.first_name,
          lastName: person.last_name,
          title: person.title,
          linkedinUrl: person.linkedin_url,
        });
      }
      
      // Person found but no email available
      // Note: Apollo has a separate "reveal" endpoint that costs credits
      // For now, we just return not found
      this.warn(`Person found but no email available for ${cleanDomain}`);
      
      return this.createNotFoundResponse({
        firstName: person.first_name,
        lastName: person.last_name,
      });
      
    } catch (error) {
      return this.createErrorResponse(
        error instanceof Error ? error : new Error(String(error)),
        'Apollo API request failed'
      );
    }
  }
  
  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================
  
  /**
   * Build the search payload for Apollo's API
   * 
   * @param domain - Cleaned domain string
   * @param request - Original request with optional person name
   * @returns Apollo API payload object
   */
  private buildSearchPayload(
    domain: string, 
    request: EnrichmentRequest
  ): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      q_organization_domains: domain,
      page: 1,
      per_page: 1, // We only need one result
    };
    
    // Add person name filter if provided
    const personName = request.personName || 
      (request.firstName && request.lastName 
        ? `${request.firstName} ${request.lastName}` 
        : request.firstName || request.lastName);
    
    if (personName) {
      const nameParts = personName.trim().split(/\s+/);
      
      if (nameParts.length >= 1) {
        // Use q_keywords for name search
        payload.q_keywords = personName;
      }
    }
    
    return payload;
  }
}

