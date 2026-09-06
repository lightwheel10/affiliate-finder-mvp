import assert from 'node:assert/strict';
import test from 'node:test';
import type { CreditSqlExecutor } from '../../src/lib/credits';
import {
  finalizeSavedAffiliateEmail,
  reserveSavedAffiliateEmailLookup,
  type FinalizeSavedAffiliateEmailInput,
  type ReserveSavedAffiliateEmailLookupInput,
  type SavedAffiliateEmailDatabase,
} from '../../src/lib/affiliates/saved-email-postgres';

interface TestCredit {
  total: number;
  used: number;
  topup: number;
  active: boolean;
}

interface TestAffiliate {
  accountId: number;
  brandId: string;
  locationId: string;
  emailStatus: string | null;
  email: string | null;
  provider: string | null;
}

interface TestLedgerRow {
  userId: number;
  amount: number;
  balanceAfter: number;
  referenceId: string | null;
  referenceType: string | null;
}

interface TestState {
  accountExists: boolean;
  credit: TestCredit | null;
  affiliates: Map<number, TestAffiliate>;
  ledger: TestLedgerRow[];
}

type FailurePoint = 'ledger_insert' | 'affiliate_update';

function normalizedSql(strings: TemplateStringsArray): string {
  return strings.join('?').replace(/\s+/g, ' ').trim().toLowerCase();
}

function fakeDatabase(initial: TestState): {
  database: SavedAffiliateEmailDatabase;
  snapshot(): TestState;
  failNext(point: FailurePoint): void;
} {
  let state = structuredClone(initial);
  let nextFailure: FailurePoint | null = null;
  let transactionQueue = Promise.resolve();

  const database = (async () => {
    throw new Error('Queries must run inside a transaction.');
  }) as unknown as SavedAffiliateEmailDatabase;

  database.begin = async <T>(
    operation: (transaction: CreditSqlExecutor) => Promise<T>,
  ): Promise<T> => {
    const previous = transactionQueue;
    let release!: () => void;
    transactionQueue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;

    const draft = structuredClone(state);
    const transaction = (async (
      strings: TemplateStringsArray,
      ...values: unknown[]
    ): Promise<readonly object[]> => {
      const query = normalizedSql(strings);

      if (query.startsWith('select id from crewcast.users')) {
        return draft.accountExists ? [{ id: values[0] }] : [];
      }

      if (query.includes('from crewcast.user_credits') && query.includes('for update')) {
        if (!draft.credit) return [];
        return [{
          email_credits_total: draft.credit.total,
          email_credits_used: draft.credit.used,
          email_credits_topup: draft.credit.topup,
          period_is_active: draft.credit.active,
        }];
      }

      if (query.startsWith('select email_status, email from crewcast.saved_affiliates')) {
        const affiliateId = Number(values[0]);
        const affiliate = draft.affiliates.get(affiliateId);
        if (
          !affiliate
          || affiliate.accountId !== Number(values[1])
          || affiliate.brandId !== String(values[2])
          || affiliate.locationId !== String(values[3])
        ) {
          return [];
        }
        return [{ email_status: affiliate.emailStatus, email: affiliate.email }];
      }

      if (query.startsWith('update crewcast.user_credits')) {
        if (!draft.credit) return [];
        const amount = Number(values[0]);
        const remaining = draft.credit.total === -1
          ? Number.POSITIVE_INFINITY
          : Math.max(0, draft.credit.total - draft.credit.used) + draft.credit.topup;
        if (remaining < amount) return [];

        if (draft.credit.total === -1) {
          draft.credit.used += amount;
        } else {
          const fromSubscription = Math.min(
            amount,
            Math.max(0, draft.credit.total - draft.credit.used),
          );
          draft.credit.used += fromSubscription;
          draft.credit.topup -= amount - fromSubscription;
        }
        return [{
          total: draft.credit.total,
          used: draft.credit.used,
          topup: draft.credit.topup,
        }];
      }

      if (query.startsWith('insert into crewcast.credit_transactions')) {
        if (nextFailure === 'ledger_insert') {
          nextFailure = null;
          throw new Error('Injected ledger failure');
        }
        draft.ledger.push({
          userId: Number(values[0]),
          amount: Number(values[2]),
          balanceAfter: Number(values[3]),
          referenceId: values[4] === null ? null : String(values[4]),
          referenceType: values[5] === null ? null : String(values[5]),
        });
        return [];
      }

      if (query.startsWith('update crewcast.saved_affiliates')) {
        if (nextFailure === 'affiliate_update') {
          nextFailure = null;
          throw new Error('Injected affiliate failure');
        }
        const isLookupClaim = query.includes("set email_status = 'searching'");
        const affiliateId = Number(values[isLookupClaim ? 0 : 3]);
        const affiliate = draft.affiliates.get(affiliateId);
        if (
          !affiliate
          || affiliate.accountId !== Number(values[isLookupClaim ? 1 : 4])
          || affiliate.brandId !== String(values[isLookupClaim ? 2 : 5])
          || affiliate.locationId !== String(values[isLookupClaim ? 3 : 6])
        ) {
          return [];
        }
        if (isLookupClaim) {
          affiliate.emailStatus = 'searching';
        } else {
          affiliate.email = values[0] === null ? affiliate.email : String(values[0]);
          affiliate.emailStatus = String(values[1]);
          affiliate.provider = String(values[2]);
        }
        return [{ id: affiliateId }];
      }

      throw new Error(`Unexpected SQL in test: ${query}`);
    }) as CreditSqlExecutor;

    try {
      const result = await operation(transaction);
      state = draft;
      return result;
    } finally {
      release();
    }
  };

  return {
    database,
    snapshot: () => structuredClone(state),
    failNext: (point) => { nextFailure = point; },
  };
}

function state(credit: TestCredit | null = {
  total: 1,
  used: 0,
  topup: 0,
  active: true,
}): TestState {
  return {
    accountExists: true,
    credit,
    affiliates: new Map([
      [101, {
        accountId: 7,
        brandId: '11',
        locationId: '21',
        emailStatus: 'not_searched',
        email: null,
        provider: null,
      }],
      [102, {
        accountId: 7,
        brandId: '11',
        locationId: '21',
        emailStatus: 'not_searched',
        email: null,
        provider: null,
      }],
    ]),
    ledger: [],
  };
}

function input(overrides: Partial<FinalizeSavedAffiliateEmailInput> = {}): FinalizeSavedAffiliateEmailInput {
  return {
    accountId: 7,
    brandId: '11',
    brandLocationId: '21',
    affiliateId: 101,
    emailStatus: 'found',
    email: 'creator@example.test',
    provider: 'bio_extraction',
    enforceCredits: true,
    ...overrides,
  };
}

function reserveInput(
  overrides: Partial<ReserveSavedAffiliateEmailLookupInput> = {},
): ReserveSavedAffiliateEmailLookupInput {
  return {
    accountId: 7,
    brandId: '11',
    brandLocationId: '21',
    affiliateId: 101,
    enforceCredits: true,
    ...overrides,
  };
}

test('found email commits affiliate, balance and ledger together', async () => {
  const fixture = fakeDatabase(state());
  const result = await finalizeSavedAffiliateEmail(input(), fixture.database);

  assert.deepEqual(result, {
    outcome: 'updated',
    email: 'creator@example.test',
    status: 'found',
    creditsConsumed: true,
    creditsRemaining: 0,
  });
  const saved = fixture.snapshot();
  assert.equal(saved.affiliates.get(101)?.emailStatus, 'found');
  assert.equal(saved.credit?.used, 1);
  assert.deepEqual(saved.ledger, [{
    userId: 7,
    amount: -1,
    balanceAfter: 0,
    referenceId: '101',
    referenceType: 'bio_extraction',
  }]);
});

test('concurrent requests for one affiliate charge exactly once', async () => {
  const fixture = fakeDatabase(state());
  const results = await Promise.all(Array.from({ length: 50 }, () =>
    finalizeSavedAffiliateEmail(input(), fixture.database),
  ));

  assert.equal(results.filter((result) => result.outcome === 'updated').length, 1);
  assert.equal(results.filter((result) => result.outcome === 'already_processed').length, 49);
  assert.equal(fixture.snapshot().credit?.used, 1);
  assert.equal(fixture.snapshot().ledger.length, 1);
});

test('concurrent provider reservations claim one affiliate and charge exactly once', async () => {
  const fixture = fakeDatabase(state());
  const results = await Promise.all(Array.from({ length: 50 }, () =>
    reserveSavedAffiliateEmailLookup(reserveInput(), fixture.database),
  ));

  assert.equal(results.filter((result) => result.outcome === 'reserved').length, 1);
  assert.equal(results.filter((result) => result.outcome === 'in_progress').length, 49);
  const saved = fixture.snapshot();
  assert.equal(saved.affiliates.get(101)?.emailStatus, 'searching');
  assert.equal(saved.credit?.used, 1);
  assert.equal(saved.ledger.length, 1);
  assert.equal(saved.ledger[0]?.referenceType, 'affiliate');
});

test('provider reservation and bio finalization cannot both charge one affiliate', async (t) => {
  await t.test('provider wins the lock', async () => {
    const fixture = fakeDatabase(state({ total: 2, used: 0, topup: 0, active: true }));
    const [reservation, finalization] = await Promise.all([
      reserveSavedAffiliateEmailLookup(reserveInput(), fixture.database),
      finalizeSavedAffiliateEmail(input(), fixture.database),
    ]);

    assert.equal(reservation.outcome, 'reserved');
    assert.equal(finalization.outcome, 'in_progress');
    assert.equal(fixture.snapshot().credit?.used, 1);
    assert.equal(fixture.snapshot().ledger.length, 1);
  });

  await t.test('bio finalization wins the lock', async () => {
    const fixture = fakeDatabase(state({ total: 2, used: 0, topup: 0, active: true }));
    const [finalization, reservation] = await Promise.all([
      finalizeSavedAffiliateEmail(input(), fixture.database),
      reserveSavedAffiliateEmailLookup(reserveInput(), fixture.database),
    ]);

    assert.equal(finalization.outcome, 'updated');
    assert.equal(reservation.outcome, 'already_processed');
    assert.equal(fixture.snapshot().credit?.used, 1);
    assert.equal(fixture.snapshot().ledger.length, 1);
  });
});

test('an already-found retry remains free even without a credit row', async () => {
  const initial = state(null);
  const affiliate = initial.affiliates.get(101);
  assert.ok(affiliate);
  affiliate.emailStatus = 'found';
  affiliate.email = 'stored@example.test';
  const fixture = fakeDatabase(initial);

  const result = await finalizeSavedAffiliateEmail(input({
    email: 'different@example.test',
  }), fixture.database);
  assert.deepEqual(result, {
    outcome: 'already_processed',
    email: 'stored@example.test',
  });
  assert.equal(fixture.snapshot().ledger.length, 0);
});

test('searching, malformed and deleted-account states fail safely without a charge', async (t) => {
  await t.test('searching is reported as in progress', async () => {
    const initial = state();
    const affiliate = initial.affiliates.get(101);
    assert.ok(affiliate);
    affiliate.emailStatus = 'searching';
    const fixture = fakeDatabase(initial);

    assert.deepEqual(
      await finalizeSavedAffiliateEmail(input(), fixture.database),
      { outcome: 'in_progress' },
    );
    assert.equal(fixture.snapshot().credit?.used, 0);
    assert.equal(fixture.snapshot().ledger.length, 0);
  });

  await t.test('malformed stored status rolls back', async () => {
    const initial = state();
    const affiliate = initial.affiliates.get(101);
    assert.ok(affiliate);
    affiliate.emailStatus = 'found ';
    affiliate.email = 'stored@example.test';
    const fixture = fakeDatabase(initial);

    await assert.rejects(
      finalizeSavedAffiliateEmail(input(), fixture.database),
      /email status is invalid/i,
    );
    assert.equal(fixture.snapshot().credit?.used, 0);
    assert.equal(fixture.snapshot().ledger.length, 0);
  });

  await t.test('deleted account maps to not found', async () => {
    const initial = state();
    initial.accountExists = false;
    const fixture = fakeDatabase(initial);

    assert.deepEqual(
      await finalizeSavedAffiliateEmail(input(), fixture.database),
      { outcome: 'affiliate_not_found' },
    );
    assert.equal(fixture.snapshot().credit?.used, 0);
    assert.equal(fixture.snapshot().ledger.length, 0);
  });
});

test('two affiliates competing for one credit produce one result and one 402 outcome', async () => {
  const fixture = fakeDatabase(state());
  const results = await Promise.all([
    finalizeSavedAffiliateEmail(input({ affiliateId: 101 }), fixture.database),
    finalizeSavedAffiliateEmail(input({
      affiliateId: 102,
      email: 'second@example.test',
    }), fixture.database),
  ]);

  assert.equal(results.filter((result) => result.outcome === 'updated').length, 1);
  assert.equal(results.filter((result) => result.outcome === 'insufficient_credits').length, 1);
  const saved = fixture.snapshot();
  assert.equal([...saved.affiliates.values()].filter((affiliate) => affiliate.emailStatus === 'found').length, 1);
  assert.equal(saved.credit?.used, 1);
  assert.equal(saved.ledger.length, 1);
});

test('missing, expired and empty credit balances change nothing', async (t) => {
  const cases: Array<[string, TestCredit | null]> = [
    ['missing', null],
    ['expired', { total: 1, used: 0, topup: 0, active: false }],
    ['empty', { total: 1, used: 1, topup: 0, active: true }],
  ];
  for (const [name, credit] of cases) {
    await t.test(name, async () => {
      const fixture = fakeDatabase(state(credit));
      const result = await finalizeSavedAffiliateEmail(input(), fixture.database);
      assert.equal(result.outcome, 'insufficient_credits');
      const saved = fixture.snapshot();
      assert.equal(saved.affiliates.get(101)?.emailStatus, 'not_searched');
      assert.equal(saved.ledger.length, 0);
    });
  }
});

test('top-up and unlimited balances preserve existing charging rules', async (t) => {
  await t.test('top-up is used after the subscription pool', async () => {
    const fixture = fakeDatabase(state({ total: 1, used: 1, topup: 2, active: true }));
    const result = await finalizeSavedAffiliateEmail(input(), fixture.database);
    assert.equal(result.outcome, 'updated');
    const saved = fixture.snapshot();
    assert.equal(saved.credit?.used, 1);
    assert.equal(saved.credit?.topup, 1);
    assert.equal(saved.ledger[0]?.balanceAfter, 1);
  });

  await t.test('unlimited remains unlimited', async () => {
    const fixture = fakeDatabase(state({ total: -1, used: 4, topup: 0, active: true }));
    const result = await finalizeSavedAffiliateEmail(input(), fixture.database);
    assert.equal(result.outcome, 'updated');
    assert.equal(result.outcome === 'updated' && result.creditsRemaining, -1);
    assert.equal(fixture.snapshot().credit?.used, 5);
    assert.equal(fixture.snapshot().ledger[0]?.balanceAfter, -1);
  });
});

test('ledger failure rolls back the debit and email, then a retry succeeds once', async () => {
  const fixture = fakeDatabase(state());
  fixture.failNext('ledger_insert');
  await assert.rejects(
    finalizeSavedAffiliateEmail(input(), fixture.database),
    /injected ledger failure/i,
  );
  let saved = fixture.snapshot();
  assert.equal(saved.affiliates.get(101)?.emailStatus, 'not_searched');
  assert.equal(saved.credit?.used, 0);
  assert.equal(saved.ledger.length, 0);

  assert.equal((await finalizeSavedAffiliateEmail(input(), fixture.database)).outcome, 'updated');
  saved = fixture.snapshot();
  assert.equal(saved.affiliates.get(101)?.emailStatus, 'found');
  assert.equal(saved.credit?.used, 1);
  assert.equal(saved.ledger.length, 1);
});

test('affiliate update failure rolls back both the debit and ledger', async () => {
  const fixture = fakeDatabase(state());
  fixture.failNext('affiliate_update');
  await assert.rejects(
    finalizeSavedAffiliateEmail(input(), fixture.database),
    /injected affiliate failure/i,
  );
  const saved = fixture.snapshot();
  assert.equal(saved.affiliates.get(101)?.emailStatus, 'not_searched');
  assert.equal(saved.credit?.used, 0);
  assert.equal(saved.ledger.length, 0);
});

test('not-found remains free and enforcement-off preserves the rollout behavior', async () => {
  const notFoundFixture = fakeDatabase(state(null));
  const notFound = await finalizeSavedAffiliateEmail(input({
    emailStatus: 'not_found',
    email: null,
  }), notFoundFixture.database);
  assert.deepEqual(notFound, {
    outcome: 'updated',
    email: null,
    status: 'not_found',
    creditsConsumed: false,
    creditsRemaining: 0,
  });
  assert.equal(notFoundFixture.snapshot().ledger.length, 0);

  const disabledFixture = fakeDatabase(state(null));
  const disabled = await finalizeSavedAffiliateEmail(input({
    enforceCredits: false,
  }), disabledFixture.database);
  assert.equal(disabled.outcome, 'updated');
  assert.equal(disabledFixture.snapshot().affiliates.get(101)?.emailStatus, 'found');
  assert.equal(disabledFixture.snapshot().ledger.length, 0);
});

test('an affiliate outside the exact brand/location is not changed or charged', async () => {
  const fixture = fakeDatabase(state());
  const result = await finalizeSavedAffiliateEmail(input({
    brandLocationId: '999',
  }), fixture.database);
  assert.deepEqual(result, { outcome: 'affiliate_not_found' });
  const saved = fixture.snapshot();
  assert.equal(saved.credit?.used, 0);
  assert.equal(saved.ledger.length, 0);
});
