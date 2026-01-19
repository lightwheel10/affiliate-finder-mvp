/**
 * =============================================================================
 * SUPABASE AUTH CALLBACK ROUTE - Using @supabase/ssr
 * =============================================================================
 * 
 * Created: January 19th, 2026
 * Updated: January 19th, 2026 - Fixed PKCE error by using @supabase/ssr
 * 
 * WHAT CHANGED (January 19th, 2026 - PKCE Fix):
 * ---------------------------------------------
 * PROBLEM: Magic Link callback was failing with error:
 *   "PKCE code verifier not found in storage"
 * 
 * CAUSE: We were using @supabase/supabase-js which stores the PKCE code
 * verifier in localStorage. Server-side routes can't access localStorage.
 * 
 * SOLUTION: Use @supabase/ssr which:
 * - Reads the code verifier from COOKIES (set by the browser client)
 * - Can exchange the code for a session server-side
 * - Properly sets the session cookies
 * 
 * WHAT THIS FILE DOES:
 * --------------------
 * When a user clicks the magic link in their email, Supabase redirects them
 * to this callback URL with an authorization code. This route:
 * 
 * 1. Creates a Supabase client that can read/write cookies
 * 2. Exchanges the 'code' parameter for a session
 * 3. Session cookies are automatically set by @supabase/ssr
 * 4. Redirects the user to the app (AuthGuard handles onboarding check)
 * 
 * FLOW:
 * -----
 * User clicks magic link in email
 *   → Supabase redirects to /auth/callback?code=xxx
 *   → This route exchanges code for session (using verifier from cookies)
 *   → @supabase/ssr sets session cookies automatically
 *   → User is redirected to "/" with valid session
 *   → AuthGuard checks if user is onboarded
 *   → Shows OnboardingScreen or Dashboard accordingly
 * 
 * =============================================================================
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // ============================================================================
  // STEP 1: Extract the authorization code from the URL
  // ============================================================================
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  
  // Optional: Get the 'next' parameter for custom redirect after auth
  const next = searchParams.get('next') ?? '/';

  // ============================================================================
  // STEP 2: Handle errors from Supabase (e.g., expired link)
  // January 19th, 2026: Added proper error handling
  // ============================================================================
  const error = searchParams.get('error');
  const errorCode = searchParams.get('error_code');
  const errorDescription = searchParams.get('error_description');
  
  if (error) {
    console.error('[Auth Callback] Supabase error:', { error, errorCode, errorDescription });
    // Redirect to sign-in with appropriate error
    const errorParam = errorCode === 'otp_expired' ? 'invalid_token' : 'auth_failed';
    return NextResponse.redirect(new URL(`/sign-in?error=${errorParam}`, origin));
  }

  // ============================================================================
  // STEP 3: Validate we have a code
  // ============================================================================
  if (!code) {
    console.error('[Auth Callback] No code provided in callback URL');
    return NextResponse.redirect(new URL('/sign-in?error=no_code', origin));
  }

  // ============================================================================
  // STEP 4: Create Supabase server client with cookie access
  // January 19th, 2026: Using @supabase/ssr for proper PKCE handling
  // ============================================================================
  const cookieStore = await cookies();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Read cookies from the request
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        // Set cookies in the response
        // Note: This is called by @supabase/ssr when exchanging code for session
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // In middleware, cookies() is read-only
            // This is fine for route handlers
          }
        },
        // Remove cookies
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.delete({ name, ...options });
          } catch {
            // Same as above
          }
        },
      },
    }
  );

  // ============================================================================
  // STEP 5: Exchange the code for a session
  // January 19th, 2026: @supabase/ssr reads code verifier from cookies
  // ============================================================================
  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error('[Auth Callback] Error exchanging code for session:', exchangeError.message);
    return NextResponse.redirect(new URL('/sign-in?error=auth_failed', origin));
  }

  // ============================================================================
  // STEP 6: Success! Redirect to the app
  // January 19th, 2026: Session cookies are automatically set by @supabase/ssr
  // ============================================================================
  if (data.session) {
    console.log('[Auth Callback] Session established for user:', data.session.user.email);
  }

  // Redirect to the home page (or custom 'next' destination)
  // AuthGuard will check onboarding status and route appropriately
  return NextResponse.redirect(new URL(next, origin));
}
