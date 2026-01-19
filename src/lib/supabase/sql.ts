import 'server-only';

import postgres from 'postgres';

/**
 * Supabase PostgreSQL Connection
 * 
 * This is a drop-in replacement for Neon's `sql` tagged template literal.
 * It uses the `postgres` package with Supabase's direct PostgreSQL connection.
 * 
 * SETUP REQUIRED:
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
export const sql = postgres(connectionWithSchema, {
  // Serverless-optimized settings
  max: 1, // Use 1 connection per function invocation
  idle_timeout: 20, // Close idle connections after 20 seconds
  connect_timeout: 10, // 10 second connection timeout
  
  // Using direct connection (not pooler), so prepared statements are fine
  prepare: true, // Enable prepared statements for better performance
  
  // Transform options to match Neon behavior
  transform: {
    // Convert undefined to null
    undefined: null,
  },
});

// Export for backwards compatibility with existing code
export default sql;
