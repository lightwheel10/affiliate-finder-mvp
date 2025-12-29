/**
 * Lusha Enrichment Provider
 * 
 * Implements email enrichment using Lusha's Person API and Prospecting API.
 * Lusha provides B2B contact data including emails and phone numbers.
 * 
 * @module enrichment/providers/lusha
 * 
 * @see https://docs.lusha.com/apis/openapi/person-enrichment
 * @see https://docs.lusha.com/apis/openapi/prospecting
 * 
 * Search Strategies (in order of preference):
 * 1. Person API: LinkedIn URL → Direct lookup
 * 2. Person API: Email → Reverse lookup
 * 3. Person API: firstName + lastName + domain → Direct lookup
 * 4. Prospecting API: Domain only → Find company contacts (FALLBACK)
 * 
 * Features:
 * - Returns multiple email addresses
 * - Can return phone numbers (requires Unified Credits plan)
 * - Supports bulk enrichment (up to 100 contacts per request)
 * - Domain-only search via Prospecting API (finds any employee)
 * 
 * @example
 * ```typescript
 * const lusha = new LushaProvider();
 * if (lusha.isEnabled()) {
 *   // With full name - uses Person API
 *   const result = await lusha.findEmail({
 *     domain: 'example.com',
 *     firstName: 'John',
 *     lastName: 'Doe'
 *   });
 * 
 *   // Domain only - uses Prospecting API to find any contact
 *   const result = await lusha.findEmail({
 *     domain: 'example.com'
 *   });
 * }
 * ```
 */

import { BaseEnrichmentProvider } from './base.provider';
import { EnrichmentRequest, EnrichmentResponse, EnrichmentProviderName, EnrichedContact } from '../types';
import { ENRICHMENT_CONFIG } from '../config';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Lusha API base URL */
const LUSHA_API_BASE = 'https://api.lusha.com';

/** Lusha Person Enrichment endpoint */
const LUSHA_PERSON_ENDPOINT = '/v2/person';

/** Lusha Prospecting endpoints (for domain-only searches) */
const LUSHA_PROSPECTING_COMPANY_SEARCH = '/prospecting/company/search';
const LUSHA_PROSPECTING_CONTACT_SEARCH = '/prospecting/contact/search';
const LUSHA_PROSPECTING_CONTACT_ENRICH = '/prospecting/contact/enrich';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Lusha API response structure
 * Based on: https://docs.lusha.com/apis/openapi/person-enrichment
 */
interface LushaPersonResponse {
  firstName?: string;
  lastName?: string;
  emailAddresses?: string[];
  phoneNumbers?: string[];
  jobInfos?: Array<{
    title?: string;
    company?: {
      name?: string;
      domain?: string;
    };
  }>;
  linkedinUrl?: string;
  signals?: Record<string, unknown>;
}

/**
 * Lusha Prospecting Company Search Response
 */
interface LushaCompanySearchResponse {
  companies?: Array<{
    id: string;
    name: string;
    domain?: string;
    websiteUrl?: string;
    industry?: string;
    size?: string;
  }>;
  totalResults?: number;
}

/**
 * Lusha Prospecting Contact Search Response
 */
interface LushaContactSearchResponse {
  requestId?: string; // UUID needed for enrichment
  currentPage?: number;
  pageLength?: number;
  totalResults?: number;
  data?: Array<{
    contactId: string; // Note: it's contactId, not id
    name?: string;
    firstName?: string;
    lastName?: string;
    jobTitle?: string;
    companyId?: number;
    companyName?: string;
    fqdn?: string;
  }>;
  // Legacy format support
  contacts?: Array<{
    id: string;
    firstName?: string;
    lastName?: string;
    jobTitle?: string;
  }>;
}

/**
 * Lusha Prospecting Contact Enrich Response
 */
interface LushaContactEnrichResponse {
  contacts?: Array<{
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    emails?: string[];
    phone?: string;
    phones?: string[];
    linkedinUrl?: string;
    jobTitle?: string;
    company?: {
      id: string;
      name: string;
      domain?: string;
    };
  }>;
}

// =============================================================================
// PROVIDER IMPLEMENTATION
// =============================================================================

/**
 * Lusha email enrichment provider
 * 
 * Uses Lusha's Person API to find email addresses and phone numbers
 * for contacts based on name and company/domain.
 * 
 * Configuration:
 * - LUSHA_API_KEY: Required API key
 * - LUSHA_ENABLED: Set to 'true' to enable (default: false)
 * - ENRICH_PHONE_NUMBERS: Set to 'true' to also retrieve phone numbers
 * 
 * Pricing:
 * - (verify with Lusha for current pricing)
 * 
 * Rate Limits:
 * - Lusha provides rate limit headers in responses
 * - x-rate-limit-daily, x-hourly-requests-left, etc.
 */
export class LushaProvider extends BaseEnrichmentProvider {
  readonly name: EnrichmentProviderName = 'lusha';
  
  /** API key from environment */
  private readonly apiKey: string | undefined;
  
  /** Cost per lookup in USD */
  private readonly costPerLookup: number;
  
  constructor() {
    super();
    this.apiKey = ENRICHMENT_CONFIG.providers.lusha.apiKey;
    this.costPerLookup = ENRICHMENT_CONFIG.providers.lusha.costPerLookup;
  }
  
  // ===========================================================================
  // IEnrichmentProvider Implementation
  // ===========================================================================
  
  /**
   * Check if Lusha provider is enabled and configured
   * 
   * @returns true if Lusha is enabled AND has an API key
   */
  isEnabled(): boolean {
    return ENRICHMENT_CONFIG.providers.lusha.enabled && !!this.apiKey;
  }
  
  /**
   * Get the estimated cost per API call
   * 
   * @returns Cost in USD (~$0.05)
   */
  estimateCost(): number {
    return this.costPerLookup;
  }
  
  /**
   * Search for an email address using Lusha's APIs
   * 
   * Strategy:
   * 1. If we have linkedinUrl, email, or (firstName + lastName + domain) → Person API
   * 2. If we only have domain → Prospecting API (finds any employee at the company)
   * 
   * @param request - Search parameters
   * @returns Enrichment response with email(s) if found
   * 
   * @example
   * ```typescript
   * // Search by name and domain - uses Person API
   * const result = await lusha.findEmail({
   *   domain: 'example.com',
   *   firstName: 'Jane',
   *   lastName: 'Doe'
   * });
   * 
   * // Search by domain only - uses Prospecting API
   * const result = await lusha.findEmail({
   *   domain: 'example.com'
   * });
   * ```
   */
  async findEmail(request: EnrichmentRequest): Promise<EnrichmentResponse> {
    // Validate provider is enabled
    if (!this.isEnabled()) {
      return this.createErrorResponse(
        'Lusha provider is not enabled or API key is missing'
      );
    }
    
    const cleanDomain = request.domain ? this.cleanDomain(request.domain) : 'unknown';
    
    // Skip social media platform domains - they won't have useful contacts
    if (this.isSocialMediaDomain(cleanDomain)) {
      return this.createErrorResponse(
        `Cannot search social media domain "${cleanDomain}". Need the creator's business domain.`
      );
    }
    
    // Try Person API first (if we have enough data)
    const queryParams = this.buildQueryParams(request);
    
    if (queryParams) {
      this.log(`Searching with Person API: domain="${cleanDomain}"`);
      const personResult = await this.searchWithPersonApi(queryParams, cleanDomain);
      
      if (personResult.found || personResult.error) {
        return personResult;
      }
    }
    
    // Fallback to Prospecting API (domain-only search)
    if (request.domain) {
      this.log(`Falling back to Prospecting API: domain="${cleanDomain}"`);
      return this.searchWithProspectingApi(cleanDomain);
    }
    
    return this.createErrorResponse(
      'Insufficient search parameters. Need at least a domain.'
    );
  }
  
  /**
   * Check if a domain is a social media platform (YouTube, Instagram, TikTok, etc.)
   * These domains won't return useful business contacts.
   */
  private isSocialMediaDomain(domain: string): boolean {
    const socialDomains = [
      'youtube.com', 'www.youtube.com',
      'instagram.com', 'www.instagram.com',
      'tiktok.com', 'www.tiktok.com',
      'twitter.com', 'www.twitter.com', 'x.com',
      'facebook.com', 'www.facebook.com',
      'linkedin.com', 'www.linkedin.com',
    ];
    return socialDomains.includes(domain.toLowerCase());
  }
  
  /**
   * Search using Lusha's Person API (requires name + domain or linkedinUrl)
   */
  private async searchWithPersonApi(
    queryParams: URLSearchParams, 
    cleanDomain: string
  ): Promise<EnrichmentResponse> {
    try {
      const url = `${LUSHA_API_BASE}${LUSHA_PERSON_ENDPOINT}?${queryParams.toString()}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'api_key': this.apiKey!,
          'Content-Type': 'application/json',
        },
      });
      
      this.logRateLimitHeaders(response.headers);
      
      if (!response.ok) {
        const errorText = await response.text();
        return this.handleApiError(response.status, errorText);
      }
      
      const data: LushaPersonResponse = await response.json();
      const primaryEmail = data.emailAddresses?.[0] || null;
      
      if (primaryEmail) {
        this.log(`[Person API] Found email for ${cleanDomain}`);
        return this.createSuccessResponse(primaryEmail, {
          emails: data.emailAddresses,
          firstName: data.firstName,
          lastName: data.lastName,
          title: data.jobInfos?.[0]?.title,
          linkedinUrl: data.linkedinUrl,
          phoneNumbers: data.phoneNumbers,
        });
      }
      
      this.warn(`[Person API] No email found for ${cleanDomain}`);
      return this.createNotFoundResponse({
        firstName: data.firstName,
        lastName: data.lastName,
        phoneNumbers: data.phoneNumbers,
      });
      
    } catch (error) {
      return this.createErrorResponse(
        error instanceof Error ? error : new Error(String(error)),
        'Lusha Person API request failed'
      );
    }
  }
  
  /**
   * Search using Lusha's Prospecting API (domain-only search)
   * 
   * This is a 3-step process:
   * 1. Search for the company by domain
   * 2. Search for contacts at that company
   * 3. Enrich contacts to get emails
   */
  private async searchWithProspectingApi(domain: string): Promise<EnrichmentResponse> {
    try {
      // Step 1: Search for company by domain
      this.log(`[Prospecting] Step 1: Searching for company with domain "${domain}"`);
      
      const companySearchResponse = await fetch(`${LUSHA_API_BASE}${LUSHA_PROSPECTING_COMPANY_SEARCH}`, {
        method: 'POST',
        headers: {
          'api_key': this.apiKey!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pages: { page: 0, size: 10 }, // Lusha requires minimum size of 10
          filters: {
            companies: {
              include: {
                domains: [domain],
              },
            },
          },
        }),
      });
      
      if (!companySearchResponse.ok) {
        const errorText = await companySearchResponse.text();
        this.warn(`[Prospecting] Company search failed: ${errorText}`);
        return this.handleApiError(companySearchResponse.status, errorText);
      }
      
      const companyDataRaw = await companySearchResponse.json();
      
      // DEBUG: Log the raw response to understand the structure
      this.log(`[Prospecting] Raw company response: ${JSON.stringify(companyDataRaw).substring(0, 500)}`);
      
      // Lusha may return different response structures
      // Try to find companies in various possible locations
      let companies: Array<{ id: string; name: string }> = [];
      
      if (Array.isArray(companyDataRaw)) {
        // Response is directly an array
        companies = companyDataRaw;
      } else if (companyDataRaw.companies && Array.isArray(companyDataRaw.companies)) {
        // Response has a companies property
        companies = companyDataRaw.companies;
      } else if (companyDataRaw.data && Array.isArray(companyDataRaw.data)) {
        // Response has a data property
        companies = companyDataRaw.data;
      } else if (companyDataRaw.results && Array.isArray(companyDataRaw.results)) {
        // Response has a results property
        companies = companyDataRaw.results;
      }
      
      if (!companies.length) {
        this.warn(`[Prospecting] No company found for domain "${domain}". Response structure: ${Object.keys(companyDataRaw).join(', ')}`);
        return this.createNotFoundResponse();
      }
      
      const companyId = companies[0].id;
      const companyName = companies[0].name;
      this.log(`[Prospecting] Found company: ${companyName} (ID: ${companyId})`);
      
      // Step 2: Search for contacts at this company
      // Use company NAME filter (not companyIds - that doesn't exist in this API)
      // Prioritize decision-makers: Marketing, Sales, Partnerships
      this.log(`[Prospecting] Step 2: Searching for contacts at ${companyName}`);
      
      const contactSearchResponse = await fetch(`${LUSHA_API_BASE}${LUSHA_PROSPECTING_CONTACT_SEARCH}`, {
        method: 'POST',
        headers: {
          'api_key': this.apiKey!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pages: { page: 0, size: 10 }, // Lusha requires minimum size of 10
          filters: {
            contacts: {
              include: {
                // Prioritize marketing/partnerships roles for affiliate outreach
                departments: ['Marketing', 'Sales', 'Business Development'],
                seniority: [4, 3, 2], // C-Level=4, VP=3, Director=2
                existing_data_points: ['work_email'], // Only contacts with email
              },
            },
            companies: {
              include: {
                names: [companyName], // Filter by company NAME
              },
            },
          },
        }),
      });
      
      if (!contactSearchResponse.ok) {
        // Try with just company name filter (no department/seniority)
        this.log(`[Prospecting] Retrying contact search with just company name`);
        
        const retryResponse = await fetch(`${LUSHA_API_BASE}${LUSHA_PROSPECTING_CONTACT_SEARCH}`, {
          method: 'POST',
          headers: {
            'api_key': this.apiKey!,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pages: { page: 0, size: 10 },
            filters: {
              contacts: {
                include: {
                  existing_data_points: ['work_email'],
                },
              },
              companies: {
                include: {
                  names: [companyName],
                },
              },
            },
          }),
        });
        
        if (!retryResponse.ok) {
          const errorText = await retryResponse.text();
          this.warn(`[Prospecting] Contact search failed: ${errorText}`);
          return this.handleApiError(retryResponse.status, errorText);
        }
        
        const contactData: LushaContactSearchResponse = await retryResponse.json();
        return this.enrichContacts(contactData, domain, companyName);
      }
      
      const contactData: LushaContactSearchResponse = await contactSearchResponse.json();
      return this.enrichContacts(contactData, domain, companyName);
      
    } catch (error) {
      return this.createErrorResponse(
        error instanceof Error ? error : new Error(String(error)),
        'Lusha Prospecting API request failed'
      );
    }
  }
  
  /**
   * Step 3: Enrich contacts to get their emails
   * 
   * Lusha's enrich endpoint requires the requestId from the search response
   */
  private async enrichContacts(
    contactData: LushaContactSearchResponse,
    domain: string,
    companyName?: string
  ): Promise<EnrichmentResponse> {
    // DEBUG: Log raw contact response
    this.log(`[Prospecting] Raw contact response: ${JSON.stringify(contactData).substring(0, 500)}`);
    
    // Get the requestId - required for enrichment
    const requestId = contactData.requestId;
    if (!requestId) {
      this.warn(`[Prospecting] No requestId in contact search response`);
      return this.createErrorResponse('Missing requestId from contact search');
    }
    
    // Get contacts from the data array
    const contacts = contactData.data || [];
    
    if (!contacts.length) {
      this.warn(`[Prospecting] No contacts found for ${companyName || domain}. Total results: ${contactData.totalResults}`);
      return this.createNotFoundResponse();
    }
    
    // Get contact IDs (note: field is contactId, not id)
    const contactIds = contacts.map(c => c.contactId).filter(Boolean);
    this.log(`[Prospecting] Step 3: Enriching ${contactIds.length} contacts using requestId: ${requestId}`);
    
    const enrichResponse = await fetch(`${LUSHA_API_BASE}${LUSHA_PROSPECTING_CONTACT_ENRICH}`, {
      method: 'POST',
      headers: {
        'api_key': this.apiKey!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requestId: requestId, // Use requestId from search response
        contactIds: contactIds,
      }),
    });
    
    if (!enrichResponse.ok) {
      const errorText = await enrichResponse.text();
      this.warn(`[Prospecting] Contact enrichment failed: ${errorText}`);
      return this.handleApiError(enrichResponse.status, errorText);
    }
    
    const enrichDataRaw = await enrichResponse.json();
    
    // DEBUG: Log raw enrichment response
    this.log(`[Prospecting] Raw enrichment response: ${JSON.stringify(enrichDataRaw).substring(0, 500)}`);
    
    // ==========================================================================
    // PARSE LUSHA'S NESTED ENRICHMENT RESPONSE STRUCTURE
    // 
    // Lusha returns:
    // {
    //   "contacts": [{
    //     "id": "...",
    //     "isSuccess": true,
    //     "data": {
    //       "firstName": "...",
    //       "lastName": "...",
    //       "jobTitle": "...",
    //       "emailAddresses": [{ "email": "...", "emailType": "work", "emailConfidence": "A+" }],
    //       "phoneNumbers": [{ "phone": "...", "phoneType": "mobile" }]
    //     }
    //   }]
    // }
    // ==========================================================================
    
    const rawContacts = enrichDataRaw.contacts || enrichDataRaw.data || [];
    
    // Extract ALL contacts with their full details
    const allEmails: string[] = [];
    const enrichedContacts: EnrichedContact[] = [];
    
    for (const contact of rawContacts) {
      // Skip failed enrichments
      if (contact.isSuccess === false) continue;
      
      // Get the nested data object (Lusha's actual structure)
      const contactData = contact.data || contact;
      
      // Extract emails from emailAddresses array
      const contactEmails: string[] = [];
      const emailAddresses = contactData.emailAddresses || contactData.emails || [];
      for (const emailObj of emailAddresses) {
        // Could be { email: "..." } or just a string
        const email = typeof emailObj === 'string' ? emailObj : emailObj.email;
        if (email) {
          contactEmails.push(email);
          if (!allEmails.includes(email)) {
            allEmails.push(email);
          }
        }
      }
      
      // Also check for direct email field
      if (contactData.email) {
        if (!contactEmails.includes(contactData.email)) {
          contactEmails.push(contactData.email);
        }
        if (!allEmails.includes(contactData.email)) {
          allEmails.push(contactData.email);
        }
      }
      
      // Extract phone numbers
      const phones: string[] = [];
      const phoneNumbers = contactData.phoneNumbers || contactData.phones || [];
      for (const phoneObj of phoneNumbers) {
        const phone = typeof phoneObj === 'string' ? phoneObj : phoneObj.phone;
        if (phone) phones.push(phone);
      }
      
      // Only add contacts that have emails
      if (contactEmails.length > 0 || contactData.firstName || contactData.fullName) {
        enrichedContacts.push({
          firstName: contactData.firstName,
          lastName: contactData.lastName,
          fullName: contactData.fullName,
          title: contactData.jobTitle,
          linkedinUrl: contactData.linkedinUrl,
          emails: contactEmails,
          phoneNumbers: phones.length > 0 ? phones : undefined,
        });
      }
    }
    
    // Return results with ALL contacts
    if (allEmails.length > 0) {
      // =========================================================================
      // BUG FIX - 29th December 2025 (REV-71)
      // 
      // PROBLEM: Previously, primaryContact was always enrichedContacts[0],
      // but allEmails[0] (the primary email) might come from a DIFFERENT contact.
      // 
      // Example:
      //   Contact A (CEO): no email
      //   Contact B (Marketing): jane@company.com
      //   
      //   Result before fix:
      //   - email: "jane@company.com" (from Contact B)
      //   - firstName: "John" (from Contact A - WRONG!)
      //   
      // FIX: Find the contact that actually owns the primary email (allEmails[0])
      // so the firstName/lastName/title match the email address.
      // =========================================================================
      const primaryEmail = allEmails[0];
      
      // Find the contact that has the primary email
      const primaryContact = enrichedContacts.find(
        c => c.emails && c.emails.includes(primaryEmail)
      ) || enrichedContacts[0]; // Fallback to first contact if not found
      
      const firstName = primaryContact?.firstName || (primaryContact?.fullName?.split(' ')[0]);
      const lastName = primaryContact?.lastName || (primaryContact?.fullName?.split(' ').slice(1).join(' '));
      
      this.log(`[Prospecting] ✅ Found ${allEmails.length} email(s) from ${enrichedContacts.length} contact(s) for ${domain}`);
      
      return this.createSuccessResponse(primaryEmail, {
        emails: allEmails,
        contacts: enrichedContacts, // Include ALL contacts with their details
        firstName,
        lastName,
        title: primaryContact?.title,
        linkedinUrl: primaryContact?.linkedinUrl,
        phoneNumbers: primaryContact?.phoneNumbers,
      });
    }
    
    this.warn(`[Prospecting] No emails found after enrichment for ${domain}`);
    return this.createNotFoundResponse();
  }
  
  // ===========================================================================
  // PRIVATE METHODS - Person API
  // ===========================================================================
  
  /**
   * Build query parameters for Lusha's Person API
   * 
   * Person API requires one of these combinations:
   * 1. linkedinUrl
   * 2. email (reverse lookup)
   * 3. firstName + lastName + (companyDomain OR companyName)
   * 
   * If none of these are available, returns null and we fall back to Prospecting API.
   * 
   * @param request - Original enrichment request
   * @returns URLSearchParams or null if insufficient data for Person API
   */
  private buildQueryParams(request: EnrichmentRequest): URLSearchParams | null {
    const params = new URLSearchParams();
    
    // Option 1: LinkedIn URL (highest priority - direct lookup)
    if (request.linkedinUrl) {
      this.log(`Using LinkedIn URL for Person API lookup`);
      params.append('linkedinUrl', request.linkedinUrl);
      this.addOptionalParams(params);
      return params;
    }
    
    // Option 2: Email (reverse lookup)
    if (request.email) {
      this.log(`Using email for Person API reverse lookup`);
      params.append('email', request.email);
      this.addOptionalParams(params);
      return params;
    }
    
    // Option 3: Name + Domain/Company
    let firstName = request.firstName;
    let lastName = request.lastName;
    
    // If only personName is provided, try to split it
    if (!firstName && !lastName && request.personName) {
      const parsed = this.parseName(request.personName);
      firstName = parsed.firstName;
      lastName = parsed.lastName;
      
      // Only use parsed name if we got a reasonable last name
      // Avoid names like "Dominic" -> firstName="Dominic", lastName=""
      if (!lastName || lastName.length < 2) {
        this.log(`Cannot use Person API: name "${request.personName}" doesn't have a valid last name`);
        return null;
      }
    }
    
    // Validate we have name and domain (and domain isn't a social platform)
    if (firstName && lastName && request.domain) {
      const cleanDomain = this.cleanDomain(request.domain);
      
      // Don't use Person API with social media domains
      if (this.isSocialMediaDomain(cleanDomain)) {
        this.log(`Cannot use Person API with social media domain "${cleanDomain}"`);
        return null;
      }
      
      this.log(`Using name + domain for Person API: ${firstName} ${lastName} @ ${cleanDomain}`);
      params.append('firstName', firstName);
      params.append('lastName', lastName);
      params.append('companyDomain', cleanDomain);
      this.addOptionalParams(params);
      return params;
    }
    
    // Insufficient data for Person API - will fall back to Prospecting API
    return null;
  }
  
  /**
   * Add optional parameters to the request
   * 
   * @param params - URLSearchParams to modify
   */
  private addOptionalParams(params: URLSearchParams): void {
    // Always request emails
    params.append('revealEmails', 'true');
    
    // Request phone numbers if enabled
    if (ENRICHMENT_CONFIG.features.phoneNumbers) {
      params.append('revealPhones', 'true');
    }
    
    // Accept partial profiles
    if (ENRICHMENT_CONFIG.features.partialProfiles) {
      params.append('partialProfile', 'true');
    }
  }
  
  /**
   * Handle API error responses
   * 
   * @param status - HTTP status code
   * @param errorText - Error response body
   * @returns Standardized error response
   */
  private handleApiError(status: number, errorText: string): EnrichmentResponse {
    // Map common error codes to user-friendly messages
    const errorMessages: Record<number, string> = {
      400: 'Invalid request parameters',
      401: 'Invalid API key',
      403: 'Access forbidden - check your Lusha plan',
      404: 'Person not found',
      429: 'Rate limit exceeded',
      500: 'Lusha server error',
    };
    
    const message = errorMessages[status] || `API error: ${status}`;
    
    return this.createErrorResponse(
      message,
      `Lusha API returned ${status}: ${errorText}`
    );
  }
  
  /**
   * Log rate limit headers for monitoring
   * 
   * Lusha provides these headers:
   * - x-rate-limit-daily
   * - x-daily-requests-left
   * - x-rate-limit-hourly
   * - x-hourly-requests-left
   * 
   * @param headers - Response headers
   */
  private logRateLimitHeaders(headers: Headers): void {
    const dailyLeft = headers.get('x-daily-requests-left');
    const hourlyLeft = headers.get('x-hourly-requests-left');
    
    if (dailyLeft || hourlyLeft) {
      this.log(`Rate limits - Daily: ${dailyLeft || 'N/A'}, Hourly: ${hourlyLeft || 'N/A'}`);
    }
  }
}

