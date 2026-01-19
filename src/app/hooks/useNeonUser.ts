/**
 * =============================================================================
 * useNeonUser - BACKWARD COMPATIBILITY WRAPPER
 * =============================================================================
 * 
 * Created: January 3rd, 2026 (Original implementation with Stack Auth)
 * Updated: January 19th, 2026 - Now re-exports from useSupabaseUser
 * 
 * WHAT CHANGED:
 * -------------
 * This file used to contain the full useNeonUser implementation that:
 * 1. Used Stack Auth's useUser() to get the authenticated user
 * 2. Fetched/created the corresponding database user
 * 
 * Now it simply re-exports everything from useSupabaseUser.ts.
 * This provides backward compatibility for any components that still
 * import from this file.
 * 
 * MIGRATION NOTE:
 * ---------------
 * Components should eventually update their imports from:
 *   import { useNeonUser } from './hooks/useNeonUser';
 * to:
 *   import { useSupabaseUser } from './hooks/useSupabaseUser';
 * 
 * But this file ensures existing imports continue to work.
 * 
 * =============================================================================
 */

'use client';

// Re-export everything from useSupabaseUser for backward compatibility
export { 
  useSupabaseUser as useNeonUser,
  useSupabaseUser,
  clearUserCache,
  type SupabaseUserData as NeonUserData,
} from './useSupabaseUser';

// Also export useConvexUser for legacy support
export { useSupabaseUser as useConvexUser } from './useSupabaseUser';
