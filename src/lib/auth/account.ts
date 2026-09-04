import 'server-only';

import type { User } from '@supabase/supabase-js';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import {
  AccountAccessError,
  AccountIdentityConflictError,
  resolveApplicationAccountIdentity,
} from '@/lib/auth/account-identity';
import { createPostgresAccountIdentityStore } from '@/lib/auth/account-postgres';

export {
  AccountAccessError,
  assertLegacyAccountId,
  legacyAccountIdMatches,
  normalizeLegacyAccountId,
} from '@/lib/auth/account-identity';

export interface AccountIdentity {
  id: number;
  email: string;
  authUserId: string;
}

export interface AuthenticatedAccountContext {
  authUser: User;
  account: AccountIdentity | null;
}

export async function resolveAuthenticatedAccount(): Promise<AuthenticatedAccountContext | null> {
  const authUser = await getAuthenticatedUser();
  const email = authUser?.email?.trim();

  if (!authUser || !email) return null;

  const account = await resolveApplicationAccountIdentity(
    { authUserId: authUser.id, email },
    createPostgresAccountIdentityStore(),
  );

  if (account && !account.authUserId) {
    throw new AccountIdentityConflictError(
      'The resolved application account has no immutable Auth identity.',
    );
  }

  return {
    authUser,
    account: account
      ? { id: account.id, email: account.email, authUserId: account.authUserId as string }
      : null,
  };
}

export async function requireAuthenticatedAccount(): Promise<
  AuthenticatedAccountContext & { account: AccountIdentity }
> {
  try {
    const context = await resolveAuthenticatedAccount();
    if (!context) {
      throw new AccountAccessError(401, 'UNAUTHORIZED', 'Unauthorized.');
    }
    if (!context.account) {
      throw new AccountAccessError(404, 'ACCOUNT_NOT_FOUND', 'User account not found.');
    }
    return context as AuthenticatedAccountContext & { account: AccountIdentity };
  } catch (error) {
    if (error instanceof AccountAccessError) throw error;
    if (error instanceof AccountIdentityConflictError) {
      console.error('[Account Identity] Refused an ambiguous account mapping:', error);
    }
    throw error;
  }
}
