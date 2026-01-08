/**
 * Next.js Configuration for CrewCast Studio
 * 
 * Updated: January 5th, 2026
 * Added environment variable configuration for sitemap generation
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
};

export default nextConfig;
