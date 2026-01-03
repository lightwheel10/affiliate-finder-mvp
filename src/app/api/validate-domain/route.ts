/**
 * Domain Validation API Endpoint
 * Created: January 3rd, 2026
 * 
 * PURPOSE:
 * Validates that a user-provided domain is actually reachable before proceeding
 * with onboarding. This is critical because:
 * 1. We need a valid domain to scrape content using Firecrawl
 * 2. We generate AI suggestions (competitors, topics) based on the website content
 * 3. Invalid domains would waste API credits and provide poor UX
 * 
 * FLOW:
 * 1. User enters brand domain in Step 1 of onboarding
 * 2. Client-side regex validates format instantly
 * 3. On "Continue" click, this API is called to verify domain is reachable
 * 4. If valid, user proceeds to Step 2
 * 5. If invalid, error message is shown, user must fix before continuing
 * 
 * VALIDATION LOGIC:
 * 1. Normalize input (strip protocols, www, trailing slashes)
 * 2. Try HEAD request to https://{domain} (preferred, most sites use HTTPS)
 * 3. If HTTPS fails, try HEAD request to http://{domain} (fallback)
 * 4. Return validation result with normalized domain
 * 
 * FUTURE IMPROVEMENTS:
 * - Add rate limiting to prevent abuse
 * - Cache validation results for repeated checks
 * - Add DNS lookup as additional verification layer
 * - Consider using a dedicated domain validation service for edge cases
 */

import { NextRequest, NextResponse } from 'next/server';

// =============================================================================
// DOMAIN NORMALIZATION (January 3rd, 2026)
// 
// Cleans up user input to extract just the domain portion.
// Handles various input formats users might enter:
// - "https://example.com" → "example.com"
// - "http://www.example.com/" → "example.com"
// - "www.example.com/path" → "example.com"
// - "example.com" → "example.com"
// =============================================================================
function normalizeDomain(input: string): string {
  let domain = input.trim().toLowerCase();
  
  // Remove protocol (http:// or https://)
  domain = domain.replace(/^https?:\/\//, '');
  
  // Remove www. prefix
  domain = domain.replace(/^www\./, '');
  
  // Remove trailing slashes and paths
  domain = domain.split('/')[0];
  
  // Remove any query parameters
  domain = domain.split('?')[0];
  
  // Remove any hash fragments
  domain = domain.split('#')[0];
  
  // Remove port numbers (e.g., :8080)
  domain = domain.split(':')[0];
  
  return domain;
}

// =============================================================================
// DOMAIN FORMAT VALIDATION (January 3rd, 2026)
// 
// Quick regex check to ensure the domain has valid format before making
// network requests. This catches obvious typos and invalid characters.
// 
// Valid examples: example.com, sub.example.co.uk, my-site.io
// Invalid examples: example, .com, example..com, -example.com
// =============================================================================
function isValidDomainFormat(domain: string): boolean {
  // Regex explanation:
  // ^                     - Start of string
  // (?:[a-zA-Z0-9]        - First character must be alphanumeric
  // (?:[a-zA-Z0-9-]{0,61} - Middle can have alphanumeric and hyphens (max 63 chars per label)
  // [a-zA-Z0-9])?         - Last character of label must be alphanumeric (optional for single-char labels)
  // \.)+                  - Followed by a dot, repeat for subdomains
  // [a-zA-Z]{2,}$         - TLD must be at least 2 letters
  const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
  return domainRegex.test(domain);
}

// =============================================================================
// SSRF PROTECTION (January 3rd, 2026)
// 
// SECURITY: Prevents Server-Side Request Forgery (SSRF) attacks.
// 
// SSRF is when an attacker tricks our server into making requests to:
// - Internal services (localhost, 127.0.0.1)
// - Private networks (10.x.x.x, 192.168.x.x, 172.16-31.x.x)
// - Cloud metadata endpoints (169.254.169.254 - AWS/GCP/Azure)
// 
// Example attack: User enters "169.254.169.254" as their brand domain
// → Our server fetches AWS metadata → Attacker steals credentials!
// 
// This function blocks all internal/private IPs and suspicious hostnames.
// =============================================================================
function isInternalOrPrivate(domain: string): boolean {
  const lowerDomain = domain.toLowerCase();
  
  // Block localhost variations
  const localhostPatterns = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
    '[::1]',
    'localhost.localdomain',
  ];
  
  if (localhostPatterns.some(pattern => lowerDomain === pattern || lowerDomain.startsWith(pattern + '.'))) {
    return true;
  }
  
  // Block private IP ranges (IPv4)
  // 10.0.0.0 - 10.255.255.255 (Class A private)
  // 172.16.0.0 - 172.31.255.255 (Class B private)
  // 192.168.0.0 - 192.168.255.255 (Class C private)
  const privateIpPatterns = [
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}$/,
    /^192\.168\.\d{1,3}\.\d{1,3}$/,
  ];
  
  if (privateIpPatterns.some(pattern => pattern.test(lowerDomain))) {
    return true;
  }
  
  // Block link-local addresses (169.254.x.x)
  // CRITICAL: This is the AWS/GCP/Azure metadata endpoint!
  if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(lowerDomain)) {
    return true;
  }
  
  // Block other special IPs
  const specialPatterns = [
    /^0\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,     // 0.0.0.0/8
    /^100\.(6[4-9]|[7-9][0-9]|1[0-2][0-7])\.\d{1,3}\.\d{1,3}$/, // Carrier-grade NAT
    /^192\.0\.0\.\d{1,3}$/,                // IETF Protocol Assignments
    /^192\.0\.2\.\d{1,3}$/,                // TEST-NET-1
    /^198\.51\.100\.\d{1,3}$/,             // TEST-NET-2
    /^203\.0\.113\.\d{1,3}$/,              // TEST-NET-3
    /^224\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,    // Multicast
    /^240\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,    // Reserved
    /^255\.255\.255\.255$/,                 // Broadcast
  ];
  
  if (specialPatterns.some(pattern => pattern.test(lowerDomain))) {
    return true;
  }
  
  // Block internal/corporate hostname patterns
  // These are common internal hostnames that should never be user brands
  const internalHostPatterns = [
    /^.*\.internal$/,
    /^.*\.local$/,
    /^.*\.corp$/,
    /^.*\.lan$/,
    /^.*\.intranet$/,
    /^.*\.private$/,
    /^metadata\./,
    /^instance-data\./,
  ];
  
  if (internalHostPatterns.some(pattern => pattern.test(lowerDomain))) {
    return true;
  }
  
  return false;
}

// =============================================================================
// DOMAIN REACHABILITY CHECK (January 3rd, 2026)
// 
// Performs a HEAD request to verify the domain has an active website.
// HEAD is preferred over GET because:
// 1. Faster - doesn't download the response body
// 2. Less bandwidth - only fetches headers
// 3. Same validation result - confirms server responds
// 
// We try HTTPS first (secure, most common), then fallback to HTTP.
// Timeout is set to 10 seconds to handle slow servers without blocking too long.
// =============================================================================
async function isDomainReachable(domain: string): Promise<{ reachable: boolean; protocol: 'https' | 'http' | null }> {
  const timeout = 10000; // 10 seconds
  
  // ==========================================================================
  // VERCEL DEPLOYMENT FIX (January 3rd, 2026)
  // 
  // Issues discovered during testing:
  // 1. Some sites have SSL certificate issues (e.g., spectrumailabs.com)
  // 2. HEAD requests are sometimes blocked by servers
  // 3. Vercel's serverless environment is strict about SSL
  // 
  // Solution:
  // 1. Try HTTPS HEAD first
  // 2. Try HTTPS GET as fallback (some servers reject HEAD)
  // 3. Try HTTP HEAD
  // 4. Try HTTP GET as final fallback
  // 
  // Added User-Agent header to avoid bot detection blocks.
  // ==========================================================================
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (compatible; DomainValidator/1.0)',
  };
  
  // Strategy 1: HTTPS with HEAD
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(`https://${domain}`, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
      headers,
    });
    
    clearTimeout(timeoutId);
    
    if (response.status < 600) {
      console.log(`[validate-domain] ${domain} reachable via HTTPS HEAD`);
      return { reachable: true, protocol: 'https' };
    }
  } catch (error) {
    console.log(`[validate-domain] HTTPS HEAD failed for ${domain}:`, error instanceof Error ? error.message : 'Unknown error');
  }
  
  // Strategy 2: HTTPS with GET (some servers reject HEAD)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(`https://${domain}`, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
      headers,
    });
    
    clearTimeout(timeoutId);
    
    if (response.status < 600) {
      console.log(`[validate-domain] ${domain} reachable via HTTPS GET`);
      return { reachable: true, protocol: 'https' };
    }
  } catch (error) {
    console.log(`[validate-domain] HTTPS GET failed for ${domain}:`, error instanceof Error ? error.message : 'Unknown error');
  }
  
  // Strategy 3: HTTP with HEAD (for sites with SSL issues)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(`http://${domain}`, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
      headers,
    });
    
    clearTimeout(timeoutId);
    
    if (response.status < 600) {
      console.log(`[validate-domain] ${domain} reachable via HTTP HEAD`);
      return { reachable: true, protocol: 'http' };
    }
  } catch (error) {
    console.log(`[validate-domain] HTTP HEAD failed for ${domain}:`, error instanceof Error ? error.message : 'Unknown error');
  }
  
  // Strategy 4: HTTP with GET (final fallback)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(`http://${domain}`, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
      headers,
    });
    
    clearTimeout(timeoutId);
    
    if (response.status < 600) {
      console.log(`[validate-domain] ${domain} reachable via HTTP GET`);
      return { reachable: true, protocol: 'http' };
    }
  } catch (error) {
    console.log(`[validate-domain] HTTP GET failed for ${domain}:`, error instanceof Error ? error.message : 'Unknown error');
  }
  
  console.log(`[validate-domain] ${domain} is NOT reachable via any method`);
  return { reachable: false, protocol: null };
}

// =============================================================================
// API HANDLER
// =============================================================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { domain } = body;
    
    // Validate input
    if (!domain || typeof domain !== 'string') {
      return NextResponse.json(
        { valid: false, error: 'Domain is required' },
        { status: 400 }
      );
    }
    
    // Normalize the domain
    const normalizedDomain = normalizeDomain(domain);
    
    if (!normalizedDomain) {
      return NextResponse.json(
        { valid: false, error: 'Invalid domain format' },
        { status: 400 }
      );
    }
    
    // Check format with regex
    if (!isValidDomainFormat(normalizedDomain)) {
      return NextResponse.json({
        valid: false,
        normalizedDomain,
        error: 'Invalid domain format. Please enter a valid domain (e.g., example.com)',
      });
    }
    
    // ==========================================================================
    // SSRF PROTECTION CHECK (January 3rd, 2026)
    // 
    // SECURITY: Block internal/private IPs and suspicious hostnames.
    // This prevents attackers from using our server to probe internal networks
    // or steal cloud metadata credentials.
    // 
    // We check BEFORE making any network requests to avoid any data leakage.
    // ==========================================================================
    if (isInternalOrPrivate(normalizedDomain)) {
      console.log(`[validate-domain] SSRF BLOCKED: ${normalizedDomain}`);
      return NextResponse.json({
        valid: false,
        normalizedDomain,
        error: 'This domain cannot be validated. Please enter a public website domain.',
      });
    }
    
    // Check if domain is reachable
    const { reachable, protocol } = await isDomainReachable(normalizedDomain);
    
    if (!reachable) {
      return NextResponse.json({
        valid: false,
        normalizedDomain,
        error: 'Domain is not reachable. Please check the domain and try again.',
      });
    }
    
    // Success - domain is valid and reachable
    return NextResponse.json({
      valid: true,
      normalizedDomain,
      protocol,
      message: 'Domain verified successfully',
    });
    
  } catch (error) {
    console.error('[validate-domain] Error:', error);
    return NextResponse.json(
      { valid: false, error: 'Failed to validate domain' },
      { status: 500 }
    );
  }
}

