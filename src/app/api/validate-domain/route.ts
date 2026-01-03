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
  
  // Try HTTPS first (preferred)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(`https://${domain}`, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow', // Follow redirects (common for www → non-www, etc.)
    });
    
    clearTimeout(timeoutId);
    
    // Consider any response (even 4xx/5xx) as "reachable" - the server responded
    // We only care that the domain has a website, not that it returns 200
    if (response.status < 600) {
      return { reachable: true, protocol: 'https' };
    }
  } catch {
    // HTTPS failed, try HTTP
  }
  
  // Try HTTP fallback
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(`http://${domain}`, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
    });
    
    clearTimeout(timeoutId);
    
    if (response.status < 600) {
      return { reachable: true, protocol: 'http' };
    }
  } catch {
    // HTTP also failed
  }
  
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

