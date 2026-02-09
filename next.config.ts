/**
 * Next.js Configuration for CrewCast Studio
 * 
 * Updated: January 5th, 2026
 * Added environment variable configuration for sitemap generation
 * 
 * Updated: February 10th, 2026
 * Added serverExternalPackages for 'postgres' package.
 * 
 * WHY: The 'postgres' package (by porsager) is NOT in Next.js's auto-opted-out
 * serverExternalPackages list (unlike 'pg' which IS). When webpack bundles it
 * for Pages Router API routes (e.g., /api/stripe/webhook), the bundled code
 * breaks TCP/TLS connection handling to Supabase. This caused all database
 * operations in the Stripe webhook handler to fail silently on Vercel, while
 * App Router routes (which use a different bundling strategy) worked fine.
 * 
 * FIX: Adding 'postgres' to serverExternalPackages tells Next.js to use
 * native Node.js require() instead of webpack bundling for this package.
 */

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Environment variables available on the client side
   * NEXT_PUBLIC_SITE_URL is used by sitemap.ts and robots.ts
   * 
   * Set this in your deployment environment (Vercel, etc.)
   * Falls back to production URL if not set
   */
  env: {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'https://crewcast.studio',
  },

  /**
   * Packages that should NOT be bundled by webpack for server-side code.
   * These use native Node.js require() instead.
   * 
   * 'postgres' - Supabase DB client; bundling breaks TCP connections in
   *              Pages Router API routes on Vercel (webhook handler).
   */
  serverExternalPackages: ['postgres'],
};

export default nextConfig;
