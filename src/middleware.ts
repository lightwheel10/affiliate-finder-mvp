/**
 * =============================================================================
 * NEXT.JS MIDDLEWARE - SUPABASE SESSION REFRESH (using @supabase/ssr)
 * =============================================================================
 * 
 * Created: Original (Stack Auth passthrough)
 * Updated: January 19th, 2026 - Switched to @supabase/ssr for PKCE support
 * 
 * WHAT CHANGED (January 19th, 2026):
 * ----------------------------------
 * Switched from @supabase/supabase-js to @supabase/ssr for:
 * - Proper PKCE handling (code verifier stored in cookies)
 * - Automatic session refresh
 * - Consistent cookie management with client
 * 
 * WHAT THIS FILE DOES:
 * --------------------
 * Middleware runs on every request before the page/API route handler.
 * For Supabase Auth, it:
 * 
 * 1. Creates a Supabase client with cookie access
 * 2. Calls getUser() to validate and refresh the session
 * 3. @supabase/ssr automatically updates cookies if refreshed
 * 
 * WHY SESSION REFRESH IN MIDDLEWARE:
 * ----------------------------------
 * - Access tokens expire (default 1 hour in Supabase)
 * - Without refresh, user would be logged out after 1 hour
 * - Middleware can refresh before the request reaches the page
 * - This keeps users logged in seamlessly
 * 
 * PUBLIC VS PROTECTED ROUTES:
 * ---------------------------
 * Some routes don't need authentication:
 * - / (landing page)
 * - /sign-in, /sign-up (auth pages)
 * - /auth/callback (Supabase callback)
 * - /api/webhook, /api/stripe/webhook (webhooks use signatures)
 * - /admin (has its own JWT auth)
 * - /privacy, /terms, etc. (legal pages)
 * 
 * For these routes, we still refresh the session if one exists,
 * but we don't block access if there's no session.
 * 
 * =============================================================================
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

// =============================================================================
// PUBLIC ROUTES - No authentication required
// =============================================================================
const publicRoutes = [
  "/",
  "/sign-in",
  "/sign-up",
  "/auth/callback",  // Supabase auth callback
  "/handler",        // Legacy Stack Auth routes (will be removed)
  "/api/webhook",
  "/api/stripe/webhook", // Stripe webhook - secured by signature
  "/admin",          // Admin dashboard - has its own JWT auth
  "/api/admin",      // Admin API routes - have their own auth check
  "/privacy",        // Legal pages
  "/terms",
  "/cookies",
  "/security",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // ============================================================================
  // STEP 1: Create response (we'll modify cookies if needed)
  // January 19th, 2026: Using @supabase/ssr for cookie management
  // ============================================================================
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // ============================================================================
  // STEP 2: Create Supabase client with cookie access
  // January 19th, 2026: Using createServerClient from @supabase/ssr
  // ============================================================================
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Read cookies from the request
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        // Set cookies in the response
        set(name: string, value: string, options: CookieOptions) {
          // Set cookie on request for server components
          request.cookies.set({
            name,
            value,
            ...options,
          });
          // Set cookie on response for browser
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        // Remove cookies
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  // ============================================================================
  // STEP 3: Refresh session if exists
  // January 19th, 2026: getUser() validates and refreshes the session
  // ============================================================================
  // IMPORTANT: Always call getUser() to refresh the session
  // This ensures the user stays logged in across page navigations
  // The @supabase/ssr client will automatically update cookies if refreshed
  const { data: { user } } = await supabase.auth.getUser();

  // ============================================================================
  // STEP 4: Check if route is public
  // ============================================================================
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // ============================================================================
  // STEP 5: Handle protected routes
  // ============================================================================
  // If the route is protected and user is not authenticated,
  // we let AuthGuard handle the redirect (provides better UX)
  // Alternatively, we could redirect here:
  // if (!user && !isPublicRoute) {
  //   return NextResponse.redirect(new URL('/sign-in', request.url));
  // }

  return response;
}

// =============================================================================
// MIDDLEWARE MATCHER
// =============================================================================
// Determines which routes the middleware runs on
// 
// Excludes:
// - Next.js internals (_next/*)
// - Static files (images, CSS, JS, fonts, etc.)
// 
// Includes:
// - All page routes
// - All API routes

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
