/**
 * Sitemap Configuration for Afforce One
 * 
 * This file generates a dynamic sitemap.xml for SEO purposes.
 * Next.js App Router automatically serves this at /sitemap.xml
 * 
 * The sitemap is regenerated on each build/deployment, ensuring
 * lastModified dates are always current when pushing to GitHub.
 * 
 * Created: January 5th, 2026
 * Author: Spectrum AI Labs (Paras)
 * 
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
 */

import type { MetadataRoute } from 'next';
import { getAppUrl } from '@/lib/app-url';

/**
 * Generates the sitemap for the application
 * 
 * Public pages included:
 * - Landing page (/)
 * - Legal pages (privacy, terms, cookies, security)
 * - Authentication pages (sign-in, sign-up)
 * 
 * Protected dashboard pages are excluded as they require authentication
 * Admin pages are excluded as they should not be indexed
 * 
 * @returns {MetadataRoute.Sitemap} Array of sitemap entries
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getAppUrl();

  // Current date for lastModified - updates on each build/deployment
  const currentDate = new Date();

  /**
   * Public marketing pages - highest priority for SEO
   * These are the pages we want search engines to index
   */
  const publicPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 1.0, // Homepage - highest priority
    },
  ];

  /**
   * Legal and compliance pages
   * Important for trust signals but lower priority
   */
  const legalPages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/privacy`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/cookies`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.2,
    },
    {
      url: `${baseUrl}/security`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];

  /**
   * Authentication pages
   * Medium priority - entry points for new users
   */
  const authPages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/sign-in`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/sign-up`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.6, // Slightly higher - we want signups
    },
  ];

  // Combine all pages into final sitemap
  return [...publicPages, ...legalPages, ...authPages];
}

