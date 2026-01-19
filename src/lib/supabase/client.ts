/**
 * =============================================================================
 * SUPABASE BROWSER CLIENT - Using @supabase/ssr
 * =============================================================================
 * 
 * Created: January 18th, 2026
 * Updated: January 19th, 2026 - Switched to @supabase/ssr for PKCE support
 * 
 * WHAT CHANGED (January 19th, 2026):
 * ----------------------------------
 * PROBLEM: Magic Link authentication was failing with error:
 *   "PKCE code verifier not found in storage"
 * 
 * CAUSE: The standard @supabase/supabase-js stores the PKCE code verifier
 * in localStorage. When the callback route runs on the server, it can't
 * access localStorage, so it can't find the verifier.
 * 
 * SOLUTION: Use @supabase/ssr which stores the code verifier in COOKIES.
 * Cookies are accessible on both client AND server, so the callback can
 * read the verifier and complete the PKCE exchange.
 * 
 * WHY SINGLETON PATTERN:
 * ----------------------
 * - Prevents creating multiple Supabase instances (memory leak)
 * - Ensures all components share the same auth state
 * - Maintains consistent session across the app
 * 
 * =============================================================================
 */

import { createBrowserClient } from '@supabase/ssr';
import { SupabaseClient, Session, User } from '@supabase/supabase-js';

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================
// Browser client is created once and reused across all components
// This ensures consistent auth state throughout the app

let browserClient: SupabaseClient | null = null;

/**
 * Gets the singleton Supabase browser client using @supabase/ssr.
 * 
 * January 19th, 2026: Now uses createBrowserClient from @supabase/ssr
 * which properly handles PKCE by storing code verifier in cookies.
 * 
 * @returns Supabase client instance
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (typeof window === 'undefined') {
    // Server-side: Create a new client each time (no singleton)
    // Note: For server operations, use the server.ts client instead
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  
  if (!browserClient) {
    // Client-side: Create singleton
    // @supabase/ssr's createBrowserClient automatically:
    // - Uses PKCE flow
    // - Stores code verifier in cookies (not localStorage)
    // - Handles session persistence
    // - Auto-refreshes tokens
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return browserClient;
}

// =============================================================================
// AUTH STATE TYPES
// =============================================================================
// Export types for use in hooks and components

export type { Session, User };

/**
 * Auth state returned by useSupabaseAuth hook
 */
export interface AuthState {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
}
