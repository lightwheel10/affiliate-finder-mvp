export interface ApplicationAccountIdentity {
  id: number;
  email: string;
  authUserId: string | null;
}

export interface AccountIdentityTransaction {
  findByAuthUserId(authUserId: string): Promise<ApplicationAccountIdentity[]>;
  findByEmail(email: string): Promise<ApplicationAccountIdentity[]>;
  bindAuthUserId(
    accountId: number,
    authUserId: string,
    email: string,
  ): Promise<ApplicationAccountIdentity | null>;
  updateContactEmail(
    accountId: number,
    authUserId: string,
    email: string,
  ): Promise<ApplicationAccountIdentity | null>;
}

export interface AccountIdentityStore {
  transaction<T>(
    operation: (transaction: AccountIdentityTransaction) => Promise<T>,
  ): Promise<T>;
}

export class AccountIdentityConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccountIdentityConflictError';
  }
}

export class AccountAccessError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: 'UNAUTHORIZED' | 'ACCOUNT_NOT_FOUND' | 'INVALID_ACCOUNT_ID' | 'ACCOUNT_MISMATCH',
    message: string,
  ) {
    super(message);
    this.name = 'AccountAccessError';
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const POSTGRES_INTEGER_MAX = 2_147_483_647;

export function normalizeLegacyAccountId(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;

  let normalized: number;
  if (typeof value === 'number') {
    normalized = value;
  } else if (typeof value === 'string' && /^[1-9][0-9]*$/.test(value.trim())) {
    normalized = Number(value.trim());
  } else {
    throw new AccountAccessError(400, 'INVALID_ACCOUNT_ID', 'Invalid user ID.');
  }

  if (
    !Number.isSafeInteger(normalized)
    || normalized <= 0
    || normalized > POSTGRES_INTEGER_MAX
  ) {
    throw new AccountAccessError(400, 'INVALID_ACCOUNT_ID', 'Invalid user ID.');
  }
  return normalized;
}

export function legacyAccountIdMatches(
  requestedAccountId: number | undefined,
  authenticatedAccountId: number,
): boolean {
  return requestedAccountId === undefined || requestedAccountId === authenticatedAccountId;
}

export function assertLegacyAccountId(
  requestedAccountId: unknown,
  authenticatedAccountId: number,
): void {
  const normalized = normalizeLegacyAccountId(requestedAccountId);
  if (!legacyAccountIdMatches(normalized, authenticatedAccountId)) {
    throw new AccountAccessError(
      403,
      'ACCOUNT_MISMATCH',
      'Not authorized to access this resource.',
    );
  }
}

function normalizeIdentityInput(input: {
  authUserId: string;
  email: string;
}): { authUserId: string; email: string } {
  const authUserId = input.authUserId.trim().toLowerCase();
  const email = input.email.trim();
  if (!UUID_PATTERN.test(authUserId)) {
    throw new AccountIdentityConflictError('The authenticated identity is not a valid UUID.');
  }
  if (!email) {
    throw new AccountIdentityConflictError('The authenticated identity has no email address.');
  }
  return { authUserId, email };
}

function requireSingleAccount(
  rows: ApplicationAccountIdentity[],
  lookup: string,
): ApplicationAccountIdentity | null {
  if (rows.length > 1) {
    throw new AccountIdentityConflictError(
      `Multiple application accounts match the same ${lookup}.`,
    );
  }
  return rows[0] ?? null;
}

async function synchronizeEmail(
  account: ApplicationAccountIdentity,
  authUserId: string,
  email: string,
  transaction: AccountIdentityTransaction,
): Promise<ApplicationAccountIdentity> {
  if (account.email === email) return account;

  const updated = await transaction.updateContactEmail(
    account.id,
    authUserId,
    email,
  );
  if (!updated) {
    throw new AccountIdentityConflictError(
      'The application account changed while its contact email was being synchronized.',
    );
  }
  return updated;
}

/**
 * Resolves one application account from the immutable Supabase Auth UUID.
 *
 * Email is used only once to claim a pre-migration row whose auth_user_id is
 * still null. A row already owned by another UUID is never reassigned, even if
 * its contact email happens to match. This keeps rolling deployment compatible
 * without restoring mutable-email ownership.
 */
export async function resolveApplicationAccountIdentity(
  input: { authUserId: string; email: string },
  store: AccountIdentityStore,
): Promise<ApplicationAccountIdentity | null> {
  const { authUserId, email } = normalizeIdentityInput(input);

  return store.transaction(async (transaction) => {
    const accountByIdentity = requireSingleAccount(
      await transaction.findByAuthUserId(authUserId),
      'Supabase Auth identity',
    );
    if (accountByIdentity) {
      return synchronizeEmail(accountByIdentity, authUserId, email, transaction);
    }

    const legacyAccount = requireSingleAccount(
      await transaction.findByEmail(email),
      'legacy email address',
    );
    if (!legacyAccount) return null;

    if (legacyAccount.authUserId !== null) {
      if (legacyAccount.authUserId === authUserId) {
        return synchronizeEmail(legacyAccount, authUserId, email, transaction);
      }
      throw new AccountIdentityConflictError(
        'The email address belongs to an application account owned by another identity.',
      );
    }

    const claimed = await transaction.bindAuthUserId(
      legacyAccount.id,
      authUserId,
      email,
    );
    if (claimed) return claimed;

    // A concurrent request may have claimed the row while this transaction was
    // waiting. Only the exact same immutable identity may win that race.
    const concurrentWinner = requireSingleAccount(
      await transaction.findByAuthUserId(authUserId),
      'Supabase Auth identity after a concurrent claim',
    );
    if (concurrentWinner?.id === legacyAccount.id) {
      return synchronizeEmail(concurrentWinner, authUserId, email, transaction);
    }

    throw new AccountIdentityConflictError(
      'The application account could not be bound to the authenticated identity.',
    );
  });
}
