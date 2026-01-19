/**
 * =============================================================================
 * SUPABASE SERVER CLIENT - Using @supabase/ssr
 * =============================================================================
 * 
 * Created: January 18th, 2026
 * Updated: January 19th, 2026 - Switched to @supabase/ssr for PKCE support
 * 
 * WHAT CHANGED (January 19th, 2026):
 * ----------------------------------
 * Switched from @supabase/supabase-js to @supabase/ssr for:
 * - Proper PKCE handling (code verifier stored in cookies)
 * - Consistent cookie management with browser client
 * - Automatic session refresh
 * 
 * WHAT THIS FILE DOES:
 * --------------------
 * Provides Supabase clients for server-side operations (API routes, middleware).
 * Two client types are available:
 * 
 * 1. SERVICE ROLE CLIENT (createServiceRoleClient / getSupabaseServerClient)
 *    - Uses service role key (bypasses Row Level Security)
 *    - For admin operations, background jobs, webhooks
 *    - NEVER expose this to the client!
 * 
 * 2. AUTHENTICATED CLIENT (getAuthenticatedUser)
 *    - Reads session from cookies set by @supabase/ssr
 *    - Respects RLS - queries run as the authenticated user
 *    - For API routes that need to verify the current user
 * 
 * HOW AUTH WORKS IN API ROUTES:
 * -----------------------------
 * 1. Client sends request with cookies (managed by @supabase/ssr)
 * 2. API route calls getAuthenticatedUser()
 * 3. We create a Supabase client with cookie access
 * 4. Call supabase.auth.getUser() to validate session
 * 5. Return user if valid, null if not authenticated
 * 
 * =============================================================================
 */

import 'server-only';

import { createClient, User } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

// =============================================================================
// SERVICE ROLE CLIENT (Admin Operations)
// =============================================================================

/**
 * Creates a Supabase client with service role key.
 * 
 * ⚠️ WARNING: This client BYPASSES Row Level Security!
 * Only use for:
 * - Admin operations
 * - Background jobs
 * - Webhook handlers
 * - Database migrations
 * 
 * NEVER use for user-initiated requests where you need to respect user permissions.
 */
export function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      '[Supabase Server] Missing environment variables. ' +
      'Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.'
    );
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      // Service role client doesn't need token refresh or persistence
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Singleton for service role client (stateless, safe to cache)
let serverClient: ReturnType<typeof createServiceRoleClient> | null = null;

/**
 * Gets the singleton service role Supabase client.
 * Use this for admin operations that need full database access.
 */
export function getSupabaseServerClient() {
  if (!serverClient) {
    serverClient = createServiceRoleClient();
  }
  return serverClient;
}

// =============================================================================
// AUTHENTICATED USER (From Cookies) - January 19th, 2026
// =============================================================================

/**
 * Creates a Supabase client with cookie access for server-side operations.
 * Uses @supabase/ssr for proper cookie management.
 * 
 * January 19th, 2026: Updated to use @supabase/ssr
 */
async function createSupabaseServerClientWithCookies() {
  const cookieStore = await cookies();
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // In read-only contexts (like Server Components), this will fail
            // That's okay - we only need to read cookies for auth
          }
        },
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
}

/**
 * Gets the currently authenticated user from session cookies.
 * 
 * January 19th, 2026: Updated to use @supabase/ssr which reads cookies
 * set by the browser client during Magic Link authentication.
 * 
 * This function:
 * 1. Creates a Supabase client with cookie access
 * 2. Calls getUser() which validates the session from cookies
 * 3. Returns the user if valid, null if not authenticated
 * 
 * USAGE IN API ROUTES:
 * --------------------
 * ```ts
 * import { getAuthenticatedUser } from '@/lib/supabase/server';
 * 
 * export async function GET(request: NextRequest) {
 *   const user = await getAuthenticatedUser();
 *   
 *   if (!user) {
 *     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 *   }
 *   
 *   // user.email contains the authenticated user's email
 *   // Use this to fetch their data from the database
 * }
 * ```
 * 
 * @returns User object if authenticated, null otherwise
 */
export async function getAuthenticatedUser(): Promise<User | null> {
  try {
    const supabase = await createSupabaseServerClientWithCookies();
    
    // getUser() validates the session from cookies
    // @supabase/ssr handles reading the auth token from cookies automatically
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      // Don't log common errors like "no session"
      if (error.message !== 'Auth session missing!') {
        console.error('[Supabase Server] Error getting user:', error.message);
      }
      return null;
    }
    
    return user;
  } catch (err) {
    console.error('[Supabase Server] Unexpected error:', err);
    return null;
  }
}

/**
 * Creates a Supabase client with the current user's session.
 * Use this when you need to make database queries that respect RLS.
 * 
 * January 19th, 2026: Updated to use @supabase/ssr
 * 
 * @returns Supabase client configured with user's session
 */
export async function createAuthenticatedClient() {
  return createSupabaseServerClientWithCookies();
}

// Legacy export for backward compatibility
export { createServiceRoleClient as createServerClient };
