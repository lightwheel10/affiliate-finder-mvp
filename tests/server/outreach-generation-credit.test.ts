import assert from 'node:assert/strict';
import test from 'node:test';
import type { CreditSqlExecutor } from '../../src/lib/credits';
import {
  releaseOutreachGeneration,
  reserveOutreachGeneration,
  type OutreachGenerationDatabase,
  type OutreachGenerationInput,
} from '../../src/lib/affiliates/outreach-generation-postgres';

interface TestCredit {
  total: number;
  used: number;
  topup: number;
  periodStartToken: string;
  active: boolean;
}

interface TestAffiliate {
  accountId: number;
  brandId: string;
  locationId: string;
  startedAt: string | null;
  generatedAt: string | null;
}

interface TestLedgerRow {
  amount: number;
  balanceAfter: number;
  referenceType: string;
}

interface TestState {
  accountExists: boolean;
  credit: TestCredit | null;
  affiliates: Map<number, TestAffiliate>;
  ledger: TestLedgerRow[];
}

type FailurePoint = 'usage_ledger' | 'affiliate_claim' | 'refund_ledger';

function normalizedSql(strings: TemplateStringsArray): string {
  return strings.join('?').replace(/\s+/g, ' ').trim().toLowerCase();
}

function fakeDatabase(initial: TestState): {
  database: OutreachGenerationDatabase;
  snapshot(): TestState;
  failNext(point: FailurePoint): void;
  setCreditPeriodStartToken(token: string): void;
} {
  let state = structuredClone(initial);
  let nextFailure: FailurePoint | null = null;
  let transactionQueue = Promise.resolve();
  let leaseSequence = 0;

  const database = (async () => {
    throw new Error('Queries must run inside a transaction.');
  }) as unknown as OutreachGenerationDatabase;

  database.begin = async <T>(
    operation: (transaction: CreditSqlExecutor) => Promise<T>,
  ): Promise<T> => {
    const previous = transactionQueue;
    let release!: () => void;
    transactionQueue = new Promise<void>((resolve) => { release = resolve; });
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
          ai_credits_total: draft.credit.total,
          ai_credits_used: draft.credit.used,
          ai_credits_topup: draft.credit.topup,
          period_start_token: draft.credit.periodStartToken,
          period_is_active: draft.credit.active,
        }];
      }

      if (query.includes('as lease_is_active')) {
        const affiliate = draft.affiliates.get(Number(values[1]));
        if (
          !affiliate
          || affiliate.accountId !== Number(values[2])
          || affiliate.brandId !== String(values[3])
          || affiliate.locationId !== String(values[4])
        ) return [];

        const started = affiliate.startedAt ? new Date(affiliate.startedAt).getTime() : 0;
        const generated = affiliate.generatedAt ? new Date(affiliate.generatedAt).getTime() : 0;
        const ageSeconds = started ? Math.max(0, (Date.now() - started) / 1000) : 0;
        return [{
          lease_is_active: started > 0 && ageSeconds < Number(values[0])
            && (generated === 0 || generated < started),
          started_seconds_ago: ageSeconds,
        }];
      }

      if (
        query.startsWith('update crewcast.user_credits')
        && query.includes('ai_credits_used = ai_credits_used +')
      ) {
        if (!draft.credit) return [];
        const amount = Number(values[0]);
        const remaining = draft.credit.total === -1
          ? Number.POSITIVE_INFINITY
          : Math.max(0, draft.credit.total - draft.credit.used) + draft.credit.topup;
        if (remaining < amount) return [];

        const subscription = draft.credit.total === -1
          ? amount
          : Math.min(amount, Math.max(0, draft.credit.total - draft.credit.used));
        draft.credit.used += subscription;
        draft.credit.topup -= amount - subscription;
        return [{
          total: draft.credit.total,
          used: draft.credit.used,
          topup: draft.credit.topup,
        }];
      }

      if (query.startsWith('insert into crewcast.credit_transactions')) {
        const isRefund = query.includes("'refund'");
        if (
          (nextFailure === 'usage_ledger' && !isRefund)
          || (nextFailure === 'refund_ledger' && isRefund)
        ) {
          nextFailure = null;
          throw new Error(`Injected ${isRefund ? 'refund' : 'usage'} ledger failure`);
        }
        draft.ledger.push({
          amount: Number(values[isRefund ? 1 : 2]),
          balanceAfter: Number(values[isRefund ? 2 : 3]),
          referenceType: isRefund ? 'outreach_refund' : String(values[5]),
        });
        return [];
      }

      if (query.includes('set ai_generation_started_at = date_trunc')) {
        if (nextFailure === 'affiliate_claim') {
          nextFailure = null;
          throw new Error('Injected affiliate claim failure');
        }
        const affiliate = draft.affiliates.get(Number(values[0]));
        if (
          !affiliate
          || affiliate.accountId !== Number(values[1])
          || affiliate.brandId !== String(values[2])
          || affiliate.locationId !== String(values[3])
        ) return [];
        const startedAt = new Date(Date.now() + (++leaseSequence * 10)).toISOString();
        affiliate.startedAt = startedAt;
        return [{ lease_started_at: startedAt }];
      }

      if (
        query.startsWith('select id from crewcast.saved_affiliates')
        && query.includes('ai_generation_started_at =')
      ) {
        const affiliate = draft.affiliates.get(Number(values[0]));
        if (
          !affiliate
          || affiliate.accountId !== Number(values[1])
          || affiliate.brandId !== String(values[2])
          || affiliate.locationId !== String(values[3])
          || affiliate.startedAt !== String(values[4])
          || (affiliate.generatedAt !== null
            && new Date(affiliate.generatedAt).getTime() >= new Date(affiliate.startedAt).getTime())
        ) return [];
        return [{ id: values[0] }];
      }

      if (
        query.startsWith('update crewcast.user_credits')
        && query.includes('ai_credits_topup = ai_credits_topup +')
      ) {
        if (!draft.credit) return [];
        const periodMatches = draft.credit.periodStartToken === String(values[0]);
        if (periodMatches) {
          draft.credit.used = Math.max(0, draft.credit.used - Number(values[1]));
        }
        draft.credit.topup += Number(values[2]);
        return [{
          total: draft.credit.total,
          used: draft.credit.used,
          topup: draft.credit.topup,
          period_matches: periodMatches,
        }];
      }

      if (query.includes('set ai_generation_started_at = null')) {
        const affiliate = draft.affiliates.get(Number(values[0]));
        if (
          !affiliate
          || affiliate.accountId !== Number(values[1])
          || affiliate.brandId !== String(values[2])
          || affiliate.locationId !== String(values[3])
          || affiliate.startedAt !== String(values[4])
        ) return [];
        affiliate.startedAt = null;
        return [{ id: values[0] }];
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
    setCreditPeriodStartToken: (token) => {
      if (!state.credit) throw new Error('Cannot change a missing credit period.');
      state.credit.periodStartToken = token;
    },
  };
}

function state(credit: TestCredit | null = {
  total: 10,
  used: 0,
  topup: 0,
  periodStartToken: '1788220800000000',
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
        startedAt: null,
        generatedAt: null,
      }],
      [102, {
        accountId: 7,
        brandId: '11',
        locationId: '22',
        startedAt: null,
        generatedAt: null,
      }],
    ]),
    ledger: [],
  };
}

function input(overrides: Partial<OutreachGenerationInput> = {}): OutreachGenerationInput {
  return {
    accountId: 7,
    brandId: '11',
    brandLocationId: '21',
    affiliateId: 101,
    enforceCredits: true,
    ...overrides,
  };
}

test('50 concurrent requests for one affiliate create one lease and one charge', async () => {
  const fixture = fakeDatabase(state());
  const results = await Promise.all(Array.from({ length: 50 }, () =>
    reserveOutreachGeneration(input(), fixture.database),
  ));

  assert.equal(results.filter(({ outcome }) => outcome === 'reserved').length, 1);
  assert.equal(results.filter(({ outcome }) => outcome === 'in_progress').length, 49);
  const saved = fixture.snapshot();
  assert.equal(saved.credit?.used, 1);
  assert.equal(saved.ledger.filter(({ amount }) => amount === -1).length, 1);
  assert.ok(saved.affiliates.get(101)?.startedAt);
});

test('different brand locations keep independent affiliate leases but share account credits', async () => {
  const fixture = fakeDatabase(state({
    total: 2,
    used: 0,
    topup: 0,
    periodStartToken: '1788220800000000',
    active: true,
  }));
  const results = await Promise.all([
    reserveOutreachGeneration(input(), fixture.database),
    reserveOutreachGeneration(input({ affiliateId: 102, brandLocationId: '22' }), fixture.database),
  ]);

  assert.equal(results.every(({ outcome }) => outcome === 'reserved'), true);
  assert.equal(fixture.snapshot().credit?.used, 2);
});

test('concurrent failure cleanup restores one credit and clears the lease exactly once', async () => {
  const fixture = fakeDatabase(state());
  const reserved = await reserveOutreachGeneration(input(), fixture.database);
  assert.equal(reserved.outcome, 'reserved');
  if (reserved.outcome !== 'reserved') return;

  const releases = await Promise.all(Array.from({ length: 50 }, () =>
    releaseOutreachGeneration(input(), reserved.lease, fixture.database),
  ));
  assert.equal(releases.filter(Boolean).length, 1);

  const saved = fixture.snapshot();
  assert.equal(saved.credit?.used, 0);
  assert.equal(saved.affiliates.get(101)?.startedAt, null);
  assert.deepEqual(saved.ledger.map(({ amount }) => amount), [-1, 1]);
  assert.equal(saved.ledger[1]?.referenceType, 'outreach_refund');
});

test('top-up and unlimited credits reserve and release through their original pools', async (t) => {
  await t.test('top-up', async () => {
    const fixture = fakeDatabase(state({
      total: 1,
      used: 1,
      topup: 2,
      periodStartToken: '1788220800000000',
      active: true,
    }));
    const reserved = await reserveOutreachGeneration(input(), fixture.database);
    assert.equal(reserved.outcome, 'reserved');
    if (reserved.outcome !== 'reserved') return;
    assert.equal(fixture.snapshot().credit?.topup, 1);
    assert.equal(await releaseOutreachGeneration(input(), reserved.lease, fixture.database), true);
    assert.equal(fixture.snapshot().credit?.topup, 2);
  });

  await t.test('unlimited', async () => {
    const fixture = fakeDatabase(state({
      total: -1,
      used: 4,
      topup: 0,
      periodStartToken: '1788220800000000',
      active: true,
    }));
    const reserved = await reserveOutreachGeneration(input(), fixture.database);
    assert.equal(reserved.outcome, 'reserved');
    if (reserved.outcome !== 'reserved') return;
    assert.equal(reserved.lease.creditsRemaining, -1);
    assert.equal(fixture.snapshot().credit?.used, 5);
    assert.equal(await releaseOutreachGeneration(input(), reserved.lease, fixture.database), true);
    assert.equal(fixture.snapshot().credit?.used, 4);
  });
});

test('missing, expired and empty balances fail without changing the affiliate', async (t) => {
  const cases: Array<[string, TestCredit | null]> = [
    ['missing', null],
    ['expired', {
      total: 1, used: 0, topup: 0,
      periodStartToken: '1788220800000000', active: false,
    }],
    ['empty', {
      total: 1, used: 1, topup: 0,
      periodStartToken: '1788220800000000', active: true,
    }],
  ];
  for (const [name, credit] of cases) {
    await t.test(name, async () => {
      const fixture = fakeDatabase(state(credit));
      assert.equal(
        (await reserveOutreachGeneration(input(), fixture.database)).outcome,
        'insufficient_credits',
      );
      assert.equal(fixture.snapshot().affiliates.get(101)?.startedAt, null);
      assert.equal(fixture.snapshot().ledger.length, 0);
    });
  }
});

test('foreign location, deleted account and enforcement-off states fail safely', async (t) => {
  await t.test('foreign location', async () => {
    const fixture = fakeDatabase(state());
    assert.equal(
      (await reserveOutreachGeneration(input({ brandLocationId: '999' }), fixture.database)).outcome,
      'affiliate_not_found',
    );
    assert.equal(fixture.snapshot().credit?.used, 0);
  });

  await t.test('deleted account', async () => {
    const initial = state();
    initial.accountExists = false;
    const fixture = fakeDatabase(initial);
    assert.equal(
      (await reserveOutreachGeneration(input(), fixture.database)).outcome,
      'affiliate_not_found',
    );
    assert.equal(fixture.snapshot().credit?.used, 0);
  });

  await t.test('credit enforcement off', async () => {
    const fixture = fakeDatabase(state(null));
    const reserved = await reserveOutreachGeneration(
      input({ enforceCredits: false }),
      fixture.database,
    );
    assert.equal(reserved.outcome, 'reserved');
    if (reserved.outcome !== 'reserved') return;
    assert.equal(reserved.lease.creditsConsumed, false);
    assert.equal(fixture.snapshot().ledger.length, 0);
    assert.equal(await releaseOutreachGeneration(
      input({ enforceCredits: false }),
      reserved.lease,
      fixture.database,
    ), true);
  });
});

test('usage ledger and affiliate claim failures roll back the charge and lease', async (t) => {
  for (const failure of ['usage_ledger', 'affiliate_claim'] as const) {
    await t.test(failure, async () => {
      const fixture = fakeDatabase(state());
      fixture.failNext(failure);
      await assert.rejects(
        reserveOutreachGeneration(input(), fixture.database),
        /injected/i,
      );
      const saved = fixture.snapshot();
      assert.equal(saved.credit?.used, 0);
      assert.equal(saved.affiliates.get(101)?.startedAt, null);
      assert.equal(saved.ledger.length, 0);
    });
  }
});

test('refund ledger failure rolls back both the refund and lease release', async () => {
  const fixture = fakeDatabase(state());
  const reserved = await reserveOutreachGeneration(input(), fixture.database);
  assert.equal(reserved.outcome, 'reserved');
  if (reserved.outcome !== 'reserved') return;

  fixture.failNext('refund_ledger');
  await assert.rejects(
    releaseOutreachGeneration(input(), reserved.lease, fixture.database),
    /injected refund ledger failure/i,
  );
  let saved = fixture.snapshot();
  assert.equal(saved.credit?.used, 1);
  assert.ok(saved.affiliates.get(101)?.startedAt);

  assert.equal(await releaseOutreachGeneration(input(), reserved.lease, fixture.database), true);
  saved = fixture.snapshot();
  assert.equal(saved.credit?.used, 0);
  assert.equal(saved.affiliates.get(101)?.startedAt, null);
});

test('a rollover never restores an old subscription credit into the new period', async () => {
  const fixture = fakeDatabase(state({
    total: 1,
    used: 0,
    topup: 1,
    periodStartToken: '1788220800000000',
    active: true,
  }));
  const reserved = await reserveOutreachGeneration(input(), fixture.database);
  assert.equal(reserved.outcome, 'reserved');
  if (reserved.outcome !== 'reserved') return;
  assert.equal(reserved.lease.subscriptionCreditsConsumed, 1);

  fixture.setCreditPeriodStartToken('1788825600000000');
  assert.equal(await releaseOutreachGeneration(input(), reserved.lease, fixture.database), true);

  const saved = fixture.snapshot();
  assert.equal(saved.credit?.used, 1);
  assert.equal(saved.credit?.topup, 1);
  assert.deepEqual(saved.ledger.map(({ amount }) => amount), [-1]);
});

test('a completed or stale prior lease remains eligible for an intentional regeneration', async (t) => {
  await t.test('completed', async () => {
    const initial = state();
    const affiliate = initial.affiliates.get(101)!;
    affiliate.startedAt = new Date(Date.now() - 10_000).toISOString();
    affiliate.generatedAt = new Date(Date.now() - 5_000).toISOString();
    const fixture = fakeDatabase(initial);
    assert.equal(
      (await reserveOutreachGeneration(input(), fixture.database)).outcome,
      'reserved',
    );
  });

  await t.test('stale unfinished', async () => {
    const initial = state();
    initial.affiliates.get(101)!.startedAt = new Date(Date.now() - 121_000).toISOString();
    const fixture = fakeDatabase(initial);
    assert.equal(
      (await reserveOutreachGeneration(input(), fixture.database)).outcome,
      'reserved',
    );
  });
});

test('a live request cannot lose its lease at the former 60-second boundary', async () => {
  const initial = state();
  initial.affiliates.get(101)!.startedAt = new Date(Date.now() - 61_000).toISOString();
  const fixture = fakeDatabase(initial);

  assert.equal(
    (await reserveOutreachGeneration(input(), fixture.database)).outcome,
    'in_progress',
  );
  assert.equal(fixture.snapshot().credit?.used, 0);
});
