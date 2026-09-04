import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AccountIdentityConflictError,
  AccountAccessError,
  assertLegacyAccountId,
  normalizeLegacyAccountId,
  resolveApplicationAccountIdentity,
  type AccountIdentityStore,
  type AccountIdentityTransaction,
  type ApplicationAccountIdentity,
} from '../../src/lib/auth/account-identity';

const AUTH_A = '11111111-1111-4111-8111-111111111111';
const AUTH_B = '22222222-2222-4222-8222-222222222222';

class InMemoryIdentityStore implements AccountIdentityStore {
  readonly accounts: ApplicationAccountIdentity[];
  bindCount = 0;
  private queue: Promise<void> = Promise.resolve();

  constructor(accounts: ApplicationAccountIdentity[]) {
    this.accounts = structuredClone(accounts);
  }

  async transaction<T>(
    operation: (transaction: AccountIdentityTransaction) => Promise<T>,
  ): Promise<T> {
    let release!: () => void;
    const previous = this.queue;
    this.queue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation(this.createTransaction());
    } finally {
      release();
    }
  }

  private createTransaction(): AccountIdentityTransaction {
    return {
      findByAuthUserId: async (authUserId) => {
        await Promise.resolve();
        return structuredClone(
          this.accounts.filter((account) => account.authUserId === authUserId),
        );
      },
      findByEmail: async (email) => {
        await Promise.resolve();
        const normalized = email.toLowerCase();
        return structuredClone(
          this.accounts.filter((account) => account.email.toLowerCase() === normalized),
        );
      },
      bindAuthUserId: async (accountId, authUserId, email) => {
        await Promise.resolve();
        const account = this.accounts.find((candidate) => candidate.id === accountId);
        if (!account || account.authUserId !== null) return null;
        if (this.accounts.some((candidate) => candidate.authUserId === authUserId)) return null;
        account.authUserId = authUserId;
        account.email = email;
        this.bindCount += 1;
        return structuredClone(account);
      },
      updateContactEmail: async (accountId, authUserId, email) => {
        await Promise.resolve();
        const account = this.accounts.find(
          (candidate) => candidate.id === accountId && candidate.authUserId === authUserId,
        );
        if (!account) return null;
        const collision = this.accounts.some(
          (candidate) => candidate.id !== accountId
            && candidate.email.toLowerCase() === email.toLowerCase(),
        );
        if (collision) throw new Error('unique email conflict');
        account.email = email;
        return structuredClone(account);
      },
    };
  }
}

test('immutable Auth UUID keeps the same application account after an email change', async () => {
  const store = new InMemoryIdentityStore([
    { id: 7, email: 'old@example.com', authUserId: AUTH_A },
  ]);

  const account = await resolveApplicationAccountIdentity(
    { authUserId: AUTH_A, email: 'new@example.com' },
    store,
  );

  assert.equal(account?.id, 7);
  assert.equal(account?.authUserId, AUTH_A);
  assert.equal(account?.email, 'new@example.com');
  assert.equal(store.accounts.length, 1);
});

test('legacy email is used only to claim one still-unbound migration row', async () => {
  const store = new InMemoryIdentityStore([
    { id: 7, email: 'owner@example.com', authUserId: null },
  ]);

  const account = await resolveApplicationAccountIdentity(
    { authUserId: AUTH_A, email: 'OWNER@example.com' },
    store,
  );

  assert.equal(account?.id, 7);
  assert.equal(account?.authUserId, AUTH_A);
  assert.equal(store.bindCount, 1);
});

test('matching email never reassigns an account already owned by another UUID', async () => {
  const store = new InMemoryIdentityStore([
    { id: 7, email: 'owner@example.com', authUserId: AUTH_A },
  ]);

  await assert.rejects(
    resolveApplicationAccountIdentity(
      { authUserId: AUTH_B, email: 'owner@example.com' },
      store,
    ),
    AccountIdentityConflictError,
  );
  assert.equal(store.accounts[0].authUserId, AUTH_A);
});

test('100 concurrent legacy claims bind one account to one UUID exactly once', async () => {
  const store = new InMemoryIdentityStore([
    { id: 7, email: 'owner@example.com', authUserId: null },
  ]);

  const results = await Promise.all(
    Array.from({ length: 100 }, () => resolveApplicationAccountIdentity(
      { authUserId: AUTH_A, email: 'owner@example.com' },
      store,
    )),
  );

  assert.deepEqual(new Set(results.map((account) => account?.id)), new Set([7]));
  assert.equal(store.bindCount, 1);
  assert.equal(store.accounts.length, 1);
});

test('unknown and malformed identities fail safely without creating an account', async () => {
  const store = new InMemoryIdentityStore([]);
  assert.equal(
    await resolveApplicationAccountIdentity(
      { authUserId: AUTH_A, email: 'new@example.com' },
      store,
    ),
    null,
  );
  await assert.rejects(
    resolveApplicationAccountIdentity(
      { authUserId: 'not-a-uuid', email: 'new@example.com' },
      store,
    ),
    AccountIdentityConflictError,
  );
});

test('legacy client account IDs are strict assertions and never selectors', () => {
  assert.equal(normalizeLegacyAccountId(undefined), undefined);
  assert.equal(normalizeLegacyAccountId(' 7 '), 7);
  assert.doesNotThrow(() => assertLegacyAccountId(7, 7));
  assert.throws(() => assertLegacyAccountId(8, 7), AccountAccessError);

  for (const invalid of ['7junk', '0', '-1', '1.5', 1.5, 2_147_483_648]) {
    assert.throws(() => normalizeLegacyAccountId(invalid), AccountAccessError);
  }
});
