/**
 * Robots.txt Configuration for CrewCast Studio
 * 
 * This file generates a dynamic robots.txt for search engine crawlers.
 * Next.js App Router automatically serves this at /robots.txt
 * 
 * Created: January 5th, 2026
 * Author: Spectrum AI Labs (Paras)
 * 
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots
 */

import type { MetadataRoute } from 'next';

/**
 * Base URL for the site - uses environment variable or falls back to production URL
 */
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://crewcast.studio';

/**
 * Generates the robots.txt rules for the application
 * 
 * Rules:
 * - Allow all public pages to be crawled
 * - Disallow admin pages (internal use only)
 * - Disallow API routes (not meant for indexing)
 * - Disallow dashboard pages (require authentication)
 * - Disallow handler pages (Stack Auth internal routes)
 * 
 * @returns {MetadataRoute.Robots} Robots configuration object
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        // Default rules for all crawlers
        userAgent: '*',
        allow: [
          '/',           // Landing page
          '/privacy',    // Privacy policy
          '/terms',      // Terms of service
          '/cookies',    // Cookie policy
          '/security',   // Security page
          '/sign-in',    // Sign in page
          '/sign-up',    // Sign up page
        ],
        disallow: [
          '/admin/',      // Admin dashboard - internal only
          '/api/',        // API routes - not for indexing
          '/dashboard/',  // User dashboard - requires auth
          '/handler/',    // Stack Auth handlers
          '/find/',       // Protected dashboard routes
          '/discovered/', // Protected dashboard routes
          '/saved/',      // Protected dashboard routes
          '/outreach/',   // Protected dashboard routes
          '/settings/',   // Protected dashboard routes
        ],
      },
      {
        // Specific rules for Googlebot - allow slightly more for rich snippets
        userAgent: 'Googlebot',
        allow: ['/'],
        disallow: ['/admin/', '/api/', '/handler/'],
      },
    ],
    // Reference to sitemap for search engines
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}

