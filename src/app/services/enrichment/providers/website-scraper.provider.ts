/**
 * Website Scraper Enrichment Provider
 * 
 * Created: January 16, 2026
 * Author: AI Assistant
 * 
 * =============================================================================
 * PURPOSE
 * =============================================================================
 * 
 * This provider is a FREE fallback for email discovery when paid providers
 * (Lusha, Apollo) fail to find an email. It scrapes the affiliate's website
 * to find contact information.
 * 
 * WHY THIS EXISTS:
 * - Lusha/Apollo are B2B databases optimized for large companies
 * - Affiliate sites are typically small blogs, personal sites, or niche sites
 *   that are NOT in B2B databases
 * - Many countries have legal requirements to display contact info on websites
 * - Testing showed website scraping finds emails where B2B databases fail
 * 
 * =============================================================================
 * GLOBAL LANGUAGE SUPPORT - January 16, 2026
 * =============================================================================
 * 
 * Supports all 17 languages from onboarding:
 * - English, Spanish, German, French, Portuguese, Italian, Dutch
 * - Swedish, Danish, Norwegian, Finnish
 * - Polish, Czech
 * - Japanese, Korean
 * - Arabic, Hebrew
 * 
 * The scraper prioritizes contact page paths based on the user's target
 * language. For example, German users will try /impressum first, while
 * Spanish users will try /contacto first.
 * 
 * =============================================================================
 * EXTRACTION METHODS (in order of effectiveness)
 * =============================================================================
 * 
 * 1. Contact Page Scraping
 *    - Checks language-specific paths (/impressum, /contacto, /contatti, etc.)
 *    - Falls back to universal paths (/contact, /about)
 *    - Extracts all email addresses from HTML
 *    - Handles obfuscated emails ([at], &#64;, etc.)
 * 
 * 2. Mailto Links
 *    - Finds all <a href="mailto:..."> links
 *    - Often found in headers, footers, and contact sections
 * 
 * 3. Structured Data / JSON-LD
 *    - Parses <script type="application/ld+json"> for email fields
 *    - Modern sites often embed contact info this way
 * 
 * 4. Meta Tags
 *    - Checks <meta name="author"> and <link rel="me">
 *    - Less common but occasionally useful
 * 
 * =============================================================================
 * CREDIT POLICY
 * =============================================================================
 * 
 * - Email found: 1 credit consumed (consistent with other providers)
 * - Email not found: FREE (no credit consumed)
 * 
 * The scraper itself has no API cost, but we charge for found emails to
 * maintain consistency with the user's credit policy.
 * 
 * =============================================================================
 * SECURITY CONSIDERATIONS
 * =============================================================================
 * 
 * - 10 second timeout per request
 * - Standard browser User-Agent
 * - No cookie storage
 * - Only fetches public pages (no authentication)
 * - Rate limiting: one request at a time, no parallelization
 * 
 * @module enrichment/providers/website-scraper
 */

import { BaseEnrichmentProvider } from './base.provider';
import { 
  EnrichmentRequest, 
  EnrichmentResponse, 
  EnrichmentProviderName 
} from '../types';
import { ENRICHMENT_CONFIG } from '../config';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Email patterns to filter OUT (non-useful system/generic emails)
 * These are common emails that won't be useful for affiliate outreach
 */
const EXCLUDED_EMAIL_PATTERNS = [
  'abuse@',
  'hostmaster@',
  'postmaster@',
  'webmaster@',
  'noreply@',
  'no-reply@',
  'mailer-daemon@',
  'support@', // Often automated
  '@sentry.io',
  '@schema.org',
  '@w3.org',
  '@example.com',
  '@test.com',
  '.png',
  '.jpg',
  '.svg',
  '.gif',
  '.webp',
];

/**
 * Email prefixes to PRIORITIZE (most useful for outreach)
 * Order matters - first match wins
 */
const PRIORITY_EMAIL_PREFIXES = [
  'affiliate@',      // Perfect for affiliate outreach
  'partner@',        // Partnership inquiries
  'partnerships@',
  'marketing@',      // Marketing team
  'press@',          // Press/media
  'kontakt@',        // German contact
  'contact@',        // General contact
  'contacto@',       // Spanish contact
  'contato@',        // Portuguese contact
  'contatti@',       // Italian contact
  'info@',           // General info
  'hello@',          // Friendly contact
  'office@',         // Office
  'team@',           // Team
];

/**
 * Language-specific contact page paths - January 16, 2026
 * 
 * Maps each supported language to its preferred contact page paths.
 * These paths are tried FIRST before falling back to the universal paths.
 * 
 * Supports all 17 languages from onboarding:
 * - English, Spanish, German, French, Portuguese, Italian, Dutch
 * - Swedish, Danish, Norwegian, Finnish
 * - Polish, Czech
 * - Japanese, Korean
 * - Arabic, Hebrew
 */
const LANGUAGE_CONTACT_PATHS: Record<string, string[]> = {
  // English-speaking countries (US, UK, Canada, Australia, NZ, Ireland, Singapore)
  'English': [
    '/contact',
    '/contact-us',
    '/about',
    '/about-us',
    '/team',
    '/get-in-touch',
  ],
  
  // German-speaking countries (Germany, Austria, Switzerland)
  // Impressumspflicht - legal requirement to display contact info
  'German': [
    '/impressum',
    '/kontakt',
    '/ueber-uns',
    '/about',
    '/contact',
  ],
  
  // French-speaking countries (France, Belgium, Switzerland)
  'French': [
    '/contact',
    '/a-propos',
    '/mentions-legales',
    '/qui-sommes-nous',
    '/about',
  ],
  
  // Spanish-speaking markets (Spain)
  'Spanish': [
    '/contacto',
    '/sobre-nosotros',
    '/aviso-legal',
    '/quienes-somos',
    '/contact',
  ],
  
  // Portuguese-speaking markets (Portugal)
  'Portuguese': [
    '/contato',
    '/contacto',  // European Portuguese
    '/sobre',
    '/sobre-nos',
    '/contact',
  ],
  
  // Italian markets (Italy)
  'Italian': [
    '/contatti',
    '/chi-siamo',
    '/about',
    '/contact',
  ],
  
  // Dutch-speaking markets (Netherlands, Belgium)
  'Dutch': [
    '/contact',
    '/over-ons',
    '/about',
  ],
  
  // Swedish markets (Sweden)
  'Swedish': [
    '/kontakt',
    '/om-oss',
    '/about',
    '/contact',
  ],
  
  // Danish markets (Denmark)
  'Danish': [
    '/kontakt',
    '/om-os',
    '/about',
    '/contact',
  ],
  
  // Norwegian markets (Norway)
  'Norwegian': [
    '/kontakt',
    '/om-oss',
    '/about',
    '/contact',
  ],
  
  // Finnish markets (Finland)
  'Finnish': [
    '/yhteystiedot',
    '/meista',
    '/ota-yhteytta',
    '/contact',
  ],
  
  // Polish markets (Poland)
  'Polish': [
    '/kontakt',
    '/o-nas',
    '/about',
    '/contact',
  ],
  
  // Czech markets (Czech Republic)
  'Czech': [
    '/kontakt',
    '/o-nas',
    '/about',
    '/contact',
  ],
  
  // Japanese markets (Japan)
  // Most Japanese business sites use English paths or /company
  'Japanese': [
    '/contact',
    '/company',
    '/about',
    '/inquiry',
  ],
  
  // Korean markets (South Korea)
  // Most Korean business sites use English paths
  'Korean': [
    '/contact',
    '/about',
    '/company',
  ],
  
  // Arabic markets (UAE, Saudi Arabia)
  // Most business sites targeting these markets use English paths
  'Arabic': [
    '/contact',
    '/contact-us',
    '/about',
    '/about-us',
  ],
  
  // Hebrew markets (Israel)
  // Most Israeli business sites use English paths
  'Hebrew': [
    '/contact',
    '/about',
    '/contact-us',
  ],
};

// =============================================================================
// PROVIDER IMPLEMENTATION
// =============================================================================

/**
 * Website Scraper Provider
 * 
 * Scrapes affiliate websites to find contact emails when B2B providers fail.
 * 
 * @example
 * ```typescript
 * const scraper = new WebsiteScraperProvider();
 * 
 * if (scraper.isEnabled()) {
 *   const result = await scraper.findEmail({
 *     domain: 'example.com'
 *   });
 *   
 *   if (result.found) {
 *     console.log(`Found email: ${result.email}`);
 *   }
 * }
 * ```
 */
export class WebsiteScraperProvider extends BaseEnrichmentProvider {
  readonly name: EnrichmentProviderName = 'website_scraper';
  
  /** Configuration from environment */
  private readonly config = ENRICHMENT_CONFIG.providers.website_scraper;
  
  // ===========================================================================
  // IEnrichmentProvider Implementation
  // ===========================================================================
  
  /**
   * Check if the website scraper is enabled
   * 
   * @returns true if enabled (default: true)
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
  
  /**
   * Get the estimated cost per lookup
   * 
   * @returns 0 (no API cost)
   */
  estimateCost(): number {
    return this.config.costPerLookup;
  }
  
  /**
   * Find email by scraping the affiliate's website
   * 
   * @param request - Search parameters (only domain is used)
   * @returns Enrichment response with email if found
   */
  async findEmail(request: EnrichmentRequest): Promise<EnrichmentResponse> {
    // Validate provider is enabled
    if (!this.isEnabled()) {
      return this.createErrorResponse(
        'Website scraper provider is disabled'
      );
    }
    
    // Validate domain is provided
    if (!request.domain) {
      return this.createErrorResponse(
        'Domain is required for website scraping'
      );
    }
    
    const cleanDomain = this.cleanDomain(request.domain);
    
    // Skip social media domains (they won't have useful contact pages)
    if (this.isSocialMediaDomain(cleanDomain)) {
      this.log(`Skipping social media domain: ${cleanDomain}`);
      return this.createNotFoundResponse();
    }
    
    this.log(`Starting website scrape for domain: ${cleanDomain}`);
    
    try {
      // Collect all found emails from all methods
      const allEmails = new Set<string>();
      
      // =========================================================================
      // METHOD 1: Contact Page Scraping
      // 
      // Try contact pages in order of priority:
      // 1. Language-specific paths (if targetLanguage is provided)
      // 2. Universal paths from config
      // 
      // January 16, 2026: Added global language support
      // =========================================================================
      
      // Build prioritized path list based on user's language
      const pathsToTry = this.getPrioritizedPaths(request.targetLanguage);
      
      for (const path of pathsToTry) {
        const emails = await this.scrapeContactPage(cleanDomain, path);
        emails.forEach(e => allEmails.add(e));
        
        // If we found emails, we can stop checking more paths
        if (allEmails.size > 0) {
          this.log(`Found ${allEmails.size} email(s) on ${path}`);
          break;
        }
      }
      
      // If still no emails, try homepage with additional extraction methods
      if (allEmails.size === 0) {
        const homepageEmails = await this.scrapeHomepageExtras(cleanDomain);
        homepageEmails.forEach(e => allEmails.add(e));
      }
      
      // =========================================================================
      // PROCESS RESULTS
      // =========================================================================
      if (allEmails.size === 0) {
        this.warn(`No emails found for domain: ${cleanDomain}`);
        return this.createNotFoundResponse();
      }
      
      // Prioritize and select the best email
      const emailList = [...allEmails];
      const primaryEmail = this.selectBestEmail(emailList, cleanDomain);
      
      this.log(`✅ Found ${emailList.length} email(s) for ${cleanDomain}, selected: ${primaryEmail}`);
      
      return this.createSuccessResponse(primaryEmail, {
        emails: emailList,
        // Note: We don't have contact names from scraping, just emails
      });
      
    } catch (error) {
      return this.createErrorResponse(
        error instanceof Error ? error : new Error(String(error)),
        `Failed to scrape website: ${cleanDomain}`
      );
    }
  }
  
  // ===========================================================================
  // PRIVATE METHODS - Scraping
  // ===========================================================================
  
  /**
   * Scrape a specific contact page for emails
   * 
   * @param domain - Clean domain name
   * @param path - Page path to scrape (e.g., "/impressum")
   * @returns Array of found email addresses
   */
  private async scrapeContactPage(domain: string, path: string): Promise<string[]> {
    // Try with www first, then without
    const urls = [
      `https://www.${domain}${path}`,
      `https://${domain}${path}`,
    ];
    
    for (const url of urls) {
      try {
        const html = await this.fetchPage(url);
        if (html) {
          const emails = this.extractAllEmails(html);
          if (emails.length > 0) {
            return emails;
          }
        }
      } catch {
        // Ignore errors, try next URL
      }
    }
    
    return [];
  }
  
  /**
   * Scrape homepage with additional extraction methods
   * (JSON-LD, meta tags) that might not be on contact pages
   * 
   * @param domain - Clean domain name
   * @returns Array of found email addresses
   */
  private async scrapeHomepageExtras(domain: string): Promise<string[]> {
    const urls = [
      `https://www.${domain}/`,
      `https://${domain}/`,
    ];
    
    for (const url of urls) {
      try {
        const html = await this.fetchPage(url);
        if (!html) continue;
        
        const emails = new Set<string>();
        
        // Try JSON-LD structured data
        const jsonLdEmails = this.extractFromJsonLd(html);
        jsonLdEmails.forEach(e => emails.add(e));
        
        // Try meta tags
        const metaEmails = this.extractFromMetaTags(html);
        metaEmails.forEach(e => emails.add(e));
        
        // Try mailto links specifically
        const mailtoEmails = this.extractFromMailtoLinks(html);
        mailtoEmails.forEach(e => emails.add(e));
        
        if (emails.size > 0) {
          return [...emails];
        }
      } catch {
        // Ignore errors
      }
    }
    
    return [];
  }
  
  /**
   * Fetch a page with timeout and proper headers
   * 
   * @param url - URL to fetch
   * @returns HTML content or null if failed
   */
  private async fetchPage(url: string): Promise<string | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.config.timeoutMs
      );
      
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'de,en;q=0.9',
        },
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        return await response.text();
      }
      
      return null;
    } catch {
      return null;
    }
  }
  
  // ===========================================================================
  // PRIVATE METHODS - Email Extraction
  // ===========================================================================
  
  /**
   * Extract all emails from HTML content
   * Combines multiple extraction methods and deduplicates
   * 
   * @param html - Raw HTML content
   * @returns Array of cleaned, unique email addresses
   */
  private extractAllEmails(html: string): string[] {
    const emails = new Set<string>();
    
    // Decode obfuscated emails first
    const decoded = this.decodeObfuscatedEmails(html);
    
    // Extract using regex
    const regexEmails = this.extractWithRegex(decoded);
    regexEmails.forEach(e => emails.add(e));
    
    // Extract from mailto links
    const mailtoEmails = this.extractFromMailtoLinks(html);
    mailtoEmails.forEach(e => emails.add(e));
    
    // Extract from JSON-LD
    const jsonLdEmails = this.extractFromJsonLd(html);
    jsonLdEmails.forEach(e => emails.add(e));
    
    // Extract from meta tags
    const metaEmails = this.extractFromMetaTags(html);
    metaEmails.forEach(e => emails.add(e));
    
    // Filter and validate
    return [...emails].filter(email => this.isValidEmail(email));
  }
  
  /**
   * Decode commonly obfuscated email patterns
   * 
   * Websites often obfuscate emails to prevent spam harvesting:
   * - [at] or (at) instead of @
   * - [dot] or (dot) instead of .
   * - HTML entities: &#64; for @, &#46; for .
   * 
   * @param html - HTML content with potentially obfuscated emails
   * @returns HTML with decoded emails
   */
  private decodeObfuscatedEmails(html: string): string {
    return html
      // Text-based obfuscation
      .replace(/\[at\]/gi, '@')
      .replace(/\(at\)/gi, '@')
      .replace(/\[dot\]/gi, '.')
      .replace(/\(dot\)/gi, '.')
      .replace(/ at /gi, '@')
      .replace(/ dot /gi, '.')
      // HTML entities
      .replace(/&#64;/g, '@')
      .replace(/&#46;/g, '.')
      .replace(/&commat;/g, '@')
      .replace(/&#x40;/gi, '@')
      .replace(/&#x2e;/gi, '.');
  }
  
  /**
   * Extract emails using regex pattern matching
   * 
   * @param text - Text content to search
   * @returns Array of email addresses found
   */
  private extractWithRegex(text: string): string[] {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = text.match(emailRegex) || [];
    return [...new Set(matches.map(e => e.toLowerCase()))];
  }
  
  /**
   * Extract emails from mailto: links
   * 
   * @param html - HTML content
   * @returns Array of email addresses from mailto links
   */
  private extractFromMailtoLinks(html: string): string[] {
    const emails: string[] = [];
    
    // Match mailto: links
    const mailtoRegex = /href=["']mailto:([^"'?]+)/gi;
    let match;
    
    while ((match = mailtoRegex.exec(html)) !== null) {
      const email = match[1].toLowerCase().trim();
      if (email.includes('@')) {
        emails.push(email);
      }
    }
    
    return emails;
  }
  
  /**
   * Extract emails from JSON-LD structured data
   * 
   * Modern websites often include structured data like:
   * <script type="application/ld+json">
   * { "@type": "Organization", "email": "contact@example.com" }
   * </script>
   * 
   * @param html - HTML content
   * @returns Array of emails found in JSON-LD
   */
  private extractFromJsonLd(html: string): string[] {
    const emails: string[] = [];
    
    // Match JSON-LD script tags
    const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    
    while ((match = jsonLdRegex.exec(html)) !== null) {
      try {
        const jsonStr = match[1];
        const data = JSON.parse(jsonStr);
        
        // Recursively search for email fields
        this.findEmailsInObject(data, emails);
      } catch {
        // Invalid JSON, skip
      }
    }
    
    return emails;
  }
  
  /**
   * Recursively search an object for email fields
   * 
   * @param obj - Object to search
   * @param emails - Array to add found emails to
   */
  private findEmailsInObject(obj: unknown, emails: string[]): void {
    if (!obj || typeof obj !== 'object') return;
    
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      // Check if key suggests an email field
      if (key.toLowerCase().includes('email') && typeof value === 'string') {
        const email = value.replace('mailto:', '').toLowerCase().trim();
        if (email.includes('@')) {
          emails.push(email);
        }
      }
      
      // Recurse into nested objects and arrays
      if (typeof value === 'object') {
        this.findEmailsInObject(value, emails);
      }
      if (Array.isArray(value)) {
        value.forEach(item => this.findEmailsInObject(item, emails));
      }
    }
  }
  
  /**
   * Extract emails from meta tags
   * 
   * Some sites include email in:
   * <meta name="author" content="john@example.com">
   * <link rel="me" href="mailto:contact@example.com">
   * 
   * @param html - HTML content
   * @returns Array of emails found in meta tags
   */
  private extractFromMetaTags(html: string): string[] {
    const emails: string[] = [];
    
    // Meta author tag
    const authorRegex = /<meta[^>]*name=["']author["'][^>]*content=["']([^"']*)["']/gi;
    let match;
    
    while ((match = authorRegex.exec(html)) !== null) {
      const content = match[1];
      if (content.includes('@')) {
        emails.push(content.toLowerCase().trim());
      }
    }
    
    // Link rel="me" with mailto
    const linkMeRegex = /<link[^>]*rel=["']me["'][^>]*href=["']mailto:([^"']*)["']/gi;
    
    while ((match = linkMeRegex.exec(html)) !== null) {
      const email = match[1].toLowerCase().trim();
      if (email.includes('@')) {
        emails.push(email);
      }
    }
    
    return emails;
  }
  
  // ===========================================================================
  // PRIVATE METHODS - Validation & Selection
  // ===========================================================================
  
  /**
   * Check if an email address is valid and useful
   * 
   * @param email - Email address to validate
   * @returns true if the email is valid and useful for outreach
   */
  private isValidEmail(email: string): boolean {
    // Must contain @ and at least one dot after @
    if (!email.includes('@')) return false;
    const [, domain] = email.split('@');
    if (!domain || !domain.includes('.')) return false;
    
    // Must be reasonable length
    if (email.length < 5 || email.length > 100) return false;
    
    // Check against excluded patterns
    const lowerEmail = email.toLowerCase();
    for (const pattern of EXCLUDED_EMAIL_PATTERNS) {
      if (lowerEmail.includes(pattern.toLowerCase())) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Select the best email from a list based on priority
   * 
   * Priority order:
   * 1. Emails matching the domain (e.g., info@domain.com for domain.com)
   * 2. Emails with priority prefixes (affiliate@, partner@, contact@, etc.)
   * 3. First available email
   * 
   * @param emails - Array of email addresses
   * @param domain - The domain we're searching for (to prioritize matching emails)
   * @returns The best email address
   */
  private selectBestEmail(emails: string[], domain: string): string {
    if (emails.length === 0) {
      throw new Error('No emails to select from');
    }
    
    if (emails.length === 1) {
      return emails[0];
    }
    
    // First: Prefer emails from the same domain
    const sameDomainEmails = emails.filter(email => {
      const [, emailDomain] = email.split('@');
      return emailDomain && (
        emailDomain === domain ||
        emailDomain === `www.${domain}` ||
        domain.includes(emailDomain) ||
        emailDomain.includes(domain.replace('www.', ''))
      );
    });
    
    const candidateEmails = sameDomainEmails.length > 0 ? sameDomainEmails : emails;
    
    // Second: Check for priority prefixes
    for (const prefix of PRIORITY_EMAIL_PREFIXES) {
      const match = candidateEmails.find(e => e.toLowerCase().startsWith(prefix));
      if (match) {
        return match;
      }
    }
    
    // Third: Return first available
    return candidateEmails[0];
  }
  
  /**
   * Get prioritized contact page paths based on user's target language
   * 
   * This method builds a list of paths to try, with language-specific
   * paths first (if language is provided), followed by universal paths.
   * Duplicates are removed to avoid wasting requests.
   * 
   * @param targetLanguage - User's target language from onboarding
   * @returns Ordered array of paths to try
   * 
   * @example
   * ```typescript
   * // German user
   * this.getPrioritizedPaths('German')
   * // Returns: ['/impressum', '/kontakt', '/ueber-uns', '/about', '/contact', ...]
   * 
   * // No language specified
   * this.getPrioritizedPaths(undefined)
   * // Returns: ['/contact', '/contact-us', '/about', ...] (config defaults)
   * ```
   */
  private getPrioritizedPaths(targetLanguage?: string): string[] {
    const paths = new Set<string>();
    
    // Add language-specific paths first (if language is provided and supported)
    if (targetLanguage && LANGUAGE_CONTACT_PATHS[targetLanguage]) {
      for (const path of LANGUAGE_CONTACT_PATHS[targetLanguage]) {
        paths.add(path);
      }
      this.log(`Prioritizing ${targetLanguage} paths: ${LANGUAGE_CONTACT_PATHS[targetLanguage].join(', ')}`);
    }
    
    // Add universal paths from config
    for (const path of this.config.contactPaths) {
      paths.add(path);
    }
    
    return [...paths];
  }
  
  /**
   * Check if a domain is a social media platform
   * 
   * Social media domains don't have useful contact pages for scraping.
   * 
   * @param domain - Domain to check
   * @returns true if it's a social media domain
   */
  private isSocialMediaDomain(domain: string): boolean {
    const socialDomains = [
      'youtube.com',
      'www.youtube.com',
      'instagram.com',
      'www.instagram.com',
      'tiktok.com',
      'www.tiktok.com',
      'twitter.com',
      'www.twitter.com',
      'x.com',
      'facebook.com',
      'www.facebook.com',
      'linkedin.com',
      'www.linkedin.com',
    ];
    
    return socialDomains.includes(domain.toLowerCase());
  }
}
