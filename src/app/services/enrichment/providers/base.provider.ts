/**
 * Base Enrichment Provider
 * 
 * Abstract base class that all enrichment providers extend.
 * Provides common functionality and enforces the IEnrichmentProvider interface.
 * 
 * @module enrichment/providers/base
 */

import { 
  IEnrichmentProvider, 
  EnrichmentRequest, 
  EnrichmentResponse,
  EnrichmentProviderName 
} from '../types';

/**
 * Abstract base class for enrichment providers
 * 
 * Provides common functionality like error handling and domain cleaning.
 * Concrete providers (Apollo, Lusha) extend this class.
 * 
 * @example
 * ```typescript
 * class MyProvider extends BaseEnrichmentProvider {
 *   readonly name = 'myprovider' as EnrichmentProviderName;
 *   
 *   isEnabled(): boolean {
 *     return !!process.env.MY_API_KEY;
 *   }
 *   
 *   async findEmail(request: EnrichmentRequest): Promise<EnrichmentResponse> {
 *     // Implementation
 *   }
 *   
 *   estimateCost(): number {
 *     return 0.05;
 *   }
 * }
 * ```
 */
export abstract class BaseEnrichmentProvider implements IEnrichmentProvider {
  /**
   * Unique identifier for this provider
   * Must be overridden by concrete implementations
   */
  abstract readonly name: EnrichmentProviderName;
  
  /**
   * Check if this provider is enabled and properly configured
   * Must be overridden by concrete implementations
   */
  abstract isEnabled(): boolean;
  
  /**
   * Search for an email address using this provider
   * Must be overridden by concrete implementations
   */
  abstract findEmail(request: EnrichmentRequest): Promise<EnrichmentResponse>;
  
  /**
   * Get the estimated cost per API call
   * Must be overridden by concrete implementations
   */
  abstract estimateCost(): number;
  
  // ===========================================================================
  // PROTECTED HELPER METHODS
  // ===========================================================================
  
  /**
   * Create a standardized error response
   * 
   * Use this when the provider encounters an error to ensure
   * consistent error handling across all providers.
   * 
   * @param error - The error that occurred
   * @param context - Additional context for logging
   * @returns Standardized error response
   * 
   * @example
   * ```typescript
   * try {
   *   // API call
   * } catch (error) {
   *   return this.createErrorResponse(error, 'API call failed');
   * }
   * ```
   */
  protected createErrorResponse(error: Error | string, context?: string): EnrichmentResponse {
    const errorMessage = error instanceof Error ? error.message : error;
    const logMessage = context ? `${context}: ${errorMessage}` : errorMessage;
    
    console.error(`❌ [${this.name}] ${logMessage}`);
    
    return {
      email: null,
      found: false,
      provider: this.name,
      error: errorMessage,
      costEstimate: 0, // Don't charge for errors
    };
  }
  
  /**
   * Create a "not found" response
   * 
   * Use this when the API call succeeds but no email is found.
   * 
   * @param partialData - Any partial data that was found
   * @returns Standardized not-found response
   */
  protected createNotFoundResponse(partialData?: Partial<EnrichmentResponse>): EnrichmentResponse {
    return {
      email: null,
      found: false,
      provider: this.name,
      costEstimate: this.estimateCost(),
      ...partialData,
    };
  }
  
  /**
   * Create a success response
   * 
   * Use this when an email is successfully found.
   * 
   * @param email - The email address found
   * @param additionalData - Additional data from the API
   * @returns Standardized success response
   */
  protected createSuccessResponse(
    email: string, 
    additionalData?: Partial<EnrichmentResponse>
  ): EnrichmentResponse {
    return {
      email,
      found: true,
      provider: this.name,
      costEstimate: this.estimateCost(),
      ...additionalData,
    };
  }
  
  /**
   * Clean a domain string for API requests
   * 
   * Removes protocol, www prefix, and paths to get a clean domain.
   * 
   * @param domain - Raw domain string (may include protocol, www, paths)
   * @returns Clean domain string (e.g., "example.com")
   * 
   * @example
   * ```typescript
   * this.cleanDomain('https://www.example.com/page')
   * // Returns: 'example.com'
   * ```
   */
  protected cleanDomain(domain: string): string {
    return domain
      .replace(/^https?:\/\//, '')  // Remove protocol
      .replace(/^www\./, '')         // Remove www prefix
      .split('/')[0]                 // Remove paths
      .split('?')[0]                 // Remove query strings
      .toLowerCase()                 // Normalize to lowercase
      .trim();
  }
  
  /**
   * Parse a full name into first and last name components
   * 
   * @param fullName - Full name string (e.g., "John Doe Smith")
   * @returns Object with firstName and lastName
   * 
   * @example
   * ```typescript
   * this.parseName('John Doe Smith')
   * // Returns: { firstName: 'John', lastName: 'Doe Smith' }
   * ```
   */
  protected parseName(fullName: string): { firstName: string; lastName: string } {
    const parts = fullName.trim().split(/\s+/);
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';
    
    return { firstName, lastName };
  }
  
  /**
   * Log an informational message with provider context
   * 
   * @param message - Message to log
   */
  protected log(message: string): void {
    console.log(`📧 [${this.name}] ${message}`);
  }
  
  /**
   * Log a warning message with provider context
   * 
   * @param message - Warning message to log
   */
  protected warn(message: string): void {
    console.warn(`⚠️ [${this.name}] ${message}`);
  }
}

