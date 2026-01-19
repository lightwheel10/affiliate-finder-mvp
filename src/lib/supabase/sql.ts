import 'server-only';

import postgres from 'postgres';

/**
 * =============================================================================
 * Supabase PostgreSQL Connection
 * =============================================================================
 * 
 * Created: January 18th, 2026
 * Updated: January 19th, 2026 - Fixed TypeScript compatibility with Neon types
 * 
 * This is a drop-in replacement for Neon's `sql` tagged template literal.
 * It uses the `postgres` package with Supabase's direct PostgreSQL connection.
 * 
 * TYPE COMPATIBILITY (January 19th, 2026):
 * ----------------------------------------
 * The postgres package has stricter types than Neon's sql. To maintain
 * compatibility with existing code that uses type assertions like:
 *   const users = await sql`...` as DbUser[];
 * 
 * We export sql typed as `any` to match Neon's behavior. This allows
 * existing code to work without modifications.
 * 
 * SETUP REQUIRED:
 * ---------------
 * 1. Go to Supabase Dashboard > Settings > Database
 * 2. Copy the "Connection string" (URI format)
 * 3. Add it to your .env.local as SUPABASE_DATABASE_URL
 * 
 * Example connection string (direct connection):
 * postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
 * 
 * Usage (identical to Neon):
 * ```ts
 * import { sql } from '@/lib/supabase/sql';
 * 
 * const users = await sql`SELECT * FROM users WHERE email = ${email}`;
 * const [user] = await sql`SELECT * FROM users WHERE id = ${id}`;
 * ```
 * 
 * =============================================================================
 */

// Connection string from Supabase Dashboard
const connectionString = process.env.SUPABASE_DATABASE_URL;

if (!connectionString) {
  console.warn(
    '⚠️ SUPABASE_DATABASE_URL is not set. Database queries will fail.\n' +
    'To fix this:\n' +
    '1. Go to Supabase Dashboard > Settings > Database\n' +
    '2. Copy the "Connection string" (URI format)\n' +
    '3. Add it to your .env.local as SUPABASE_DATABASE_URL'
  );
}

// Build connection string with schema
// Append search_path to the connection URL so all queries default to 'crewcast' schema
const connectionWithSchema = connectionString 
  ? (connectionString.includes('?') 
      ? `${connectionString}&options=-c%20search_path%3Dcrewcast`
      : `${connectionString}?options=-c%20search_path%3Dcrewcast`)
  : '';

// Create the postgres client with connection pooling settings
// optimized for serverless environments (Vercel, etc.)
const sqlClient = postgres(connectionWithSchema, {
  // Serverless-optimized settings
  max: 1, // Use 1 connection per function invocation
  idle_timeout: 20, // Close idle connections after 20 seconds
  connect_timeout: 10, // 10 second connection timeout
  
  // Using direct connection (not pooler), so prepared statements are fine
  prepare: true, // Enable prepared statements for better performance
  
  // Transform options to match Neon behavior
  transform: {
    // Convert undefined to null (prevents TypeScript errors with optional params)
    undefined: null,
  },
});

// =============================================================================
// TYPE COMPATIBILITY EXPORT (January 19th, 2026)
// =============================================================================
// Export as 'any' to match Neon's loose typing behavior.
// This allows existing code like `await sql`...` as SomeType[]` to work
// without TypeScript errors about RowList<Row[]> not being assignable.
//
// The actual runtime behavior is identical - this is just for TypeScript.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sql: any = sqlClient;

// Export for backwards compatibility with existing code
export default sql;
