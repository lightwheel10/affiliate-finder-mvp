import 'server-only';

import { sql } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/supabase/server';

export interface SearchReconciliationOperator {
  authUserId: string;
  email: string;
  displayName: string | null;
}

export type OperatorAuthenticationResult =
  | { outcome: 'authenticated'; operator: SearchReconciliationOperator }
  | { outcome: 'unauthenticated' }
  | { outcome: 'forbidden' };

/**
 * Operator authorization is deliberately independent from an ordinary app
 * account. Possessing a valid customer session must never grant repair access.
 */
export async function authenticateSearchReconciliationOperator(): Promise<OperatorAuthenticationResult> {
  const authUser = await getAuthenticatedUser();
  const email = authUser?.email?.trim();
  if (!authUser || !email) return { outcome: 'unauthenticated' };

  const rows = await sql<{
    auth_user_id: unknown;
    email: unknown;
    display_name: unknown;
  }[]>`
    SELECT auth_user_id::text AS auth_user_id, email, display_name
    FROM crewcast.search_reconciliation_operators
    WHERE auth_user_id = ${authUser.id}::uuid
      AND is_active
    LIMIT 2
  `;
  if (rows.length === 0) return { outcome: 'forbidden' };
  if (rows.length !== 1) {
    throw new Error('An authenticated operator matched multiple authorization rows.');
  }
  if (
    typeof rows[0].auth_user_id !== 'string'
    || rows[0].auth_user_id !== authUser.id
    || typeof rows[0].email !== 'string'
  ) {
    throw new Error('The operator authorization row is invalid.');
  }

  return {
    outcome: 'authenticated',
    operator: {
      authUserId: authUser.id,
      email,
      displayName: typeof rows[0].display_name === 'string'
        ? rows[0].display_name
        : null,
    },
  };
}
