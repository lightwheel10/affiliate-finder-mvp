import 'server-only';

import { sql } from '@/lib/db';
import type {
  AccountIdentityStore,
  AccountIdentityTransaction,
  ApplicationAccountIdentity,
} from '@/lib/auth/account-identity';

export interface SqlExecutor {
  <T extends object = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<readonly T[]>;
}

export interface SqlDatabase extends SqlExecutor {
  begin<T>(operation: (transaction: SqlExecutor) => Promise<T>): Promise<T>;
}

interface AccountIdentityRow {
  id: number;
  email: string;
  auth_user_id: string | null;
}

function mapAccount(row: AccountIdentityRow): ApplicationAccountIdentity {
  return {
    id: row.id,
    email: row.email,
    authUserId: row.auth_user_id,
  };
}

function createTransaction(executor: SqlExecutor): AccountIdentityTransaction {
  return {
    findByAuthUserId: async (authUserId) => {
      const rows = await executor<AccountIdentityRow>`
        SELECT id, email, auth_user_id::text AS auth_user_id
        FROM crewcast.users
        WHERE auth_user_id = ${authUserId}::uuid
        ORDER BY id
        LIMIT 2
        FOR UPDATE
      `;
      return rows.map((row) => mapAccount(row));
    },
    findByEmail: async (email) => {
      const rows = await executor<AccountIdentityRow>`
        SELECT id, email, auth_user_id::text AS auth_user_id
        FROM crewcast.users
        WHERE lower(btrim(email)) = lower(btrim(${email}))
        ORDER BY id
        LIMIT 2
        FOR UPDATE
      `;
      return rows.map((row) => mapAccount(row));
    },
    bindAuthUserId: async (accountId, authUserId, email) => {
      const rows = await executor<AccountIdentityRow>`
        UPDATE crewcast.users
        SET
          auth_user_id = ${authUserId}::uuid,
          email = ${email},
          updated_at = NOW()
        WHERE id = ${accountId}
          AND auth_user_id IS NULL
        RETURNING id, email, auth_user_id::text AS auth_user_id
      `;
      return rows[0] ? mapAccount(rows[0]) : null;
    },
    updateContactEmail: async (accountId, authUserId, email) => {
      const rows = await executor<AccountIdentityRow>`
        UPDATE crewcast.users
        SET email = ${email}, updated_at = NOW()
        WHERE id = ${accountId}
          AND auth_user_id = ${authUserId}::uuid
        RETURNING id, email, auth_user_id::text AS auth_user_id
      `;
      return rows[0] ? mapAccount(rows[0]) : null;
    },
  };
}

export function createPostgresAccountIdentityStore(
  database: SqlDatabase = sql,
): AccountIdentityStore {
  return {
    transaction: (operation) => database.begin(
      (transaction) => operation(createTransaction(transaction)),
    ),
  };
}
