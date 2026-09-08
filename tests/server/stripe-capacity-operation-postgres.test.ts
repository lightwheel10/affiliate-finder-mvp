import assert from 'node:assert/strict';
import test from 'node:test';
import type postgres from 'postgres';
import {
  assertNoOpenPaidCapacityChange,
  CapacityChangeOperationConflictError,
  bindPendingCapacityPayment,
  cancelInterruptedCapacityChangesForBaseLifecycle,
  prepareCapacityChangeOperation,
  readPendingCapacityChangeOperation,
} from '../../src/lib/stripe/capacity-change-postgres';
import { capacityChangeRequestFingerprint, type CapacityChangeIdentity } from '../../src/lib/stripe/capacity-change';

const firstIdentity: CapacityChangeIdentity = {
  operationId: '11111111-1111-4111-8111-111111111111',
  userId: 42,
  stripeCustomerId: 'cus_account',
  stripeBaseSubscriptionId: 'sub_base',
  basePlan: 'pro',
  stripeSubscriptionId: 'sub_capacity',
  from: { extraBrands: 2, extraLocations: 4 },
  to: { extraBrands: 1, extraLocations: 3 },
  prorationDateSeconds: 1_800_000_000,
  capacitySelectionVersion: 1,
  retainedBrandIds: ['10'],
  retainedLocationIds: ['101', '102', '103', '104', '105'],
};

interface OperationFixtureRow {
  operation_id: string;
  user_id: number;
  request_fingerprint: string;
  stripe_customer_id: string;
  stripe_base_subscription_id: string;
  base_plan: string;
  stripe_subscription_id: string | null;
  stripe_invoice_id: string | null;
  from_extra_brand_quantity: number;
  from_extra_location_quantity: number;
  to_extra_brand_quantity: number;
  to_extra_location_quantity: number;
  proration_date_seconds: number;
  capacity_selection_version: number | null;
  retained_brand_ids: readonly string[] | null;
  retained_location_ids: readonly string[] | null;
  reason: string;
  status: string;
  expires_at: string;
  completed_at: string | null;
  canceled_at: string | null;
  created_at: string;
}

function operationRow(
  identity: CapacityChangeIdentity,
  overrides: Partial<OperationFixtureRow> = {},
): OperationFixtureRow {
  return {
    operation_id: identity.operationId,
    user_id: identity.userId,
    request_fingerprint: capacityChangeRequestFingerprint(identity),
    stripe_customer_id: identity.stripeCustomerId,
    stripe_base_subscription_id: identity.stripeBaseSubscriptionId,
    base_plan: identity.basePlan,
    stripe_subscription_id: identity.stripeSubscriptionId,
    stripe_invoice_id: null,
    from_extra_brand_quantity: identity.from.extraBrands,
    from_extra_location_quantity: identity.from.extraLocations,
    to_extra_brand_quantity: identity.to.extraBrands,
    to_extra_location_quantity: identity.to.extraLocations,
    proration_date_seconds: identity.prorationDateSeconds,
    capacity_selection_version: identity.capacitySelectionVersion,
    retained_brand_ids: identity.retainedBrandIds,
    retained_location_ids: identity.retainedLocationIds,
    reason: 'customer_change',
    status: 'prepared',
    expires_at: '2035-01-01T00:30:00.000Z',
    completed_at: null,
    canceled_at: null,
    created_at: '2035-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function operationFixture(initialRows: ReturnType<typeof operationRow>[] = []) {
  const rows = [...initialRows];
  const statements: string[] = [];
  let insertIdentity = firstIdentity;
  const transaction = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join('?').replace(/\s+/g, ' ').trim();
    statements.push(text);
    if (text.includes('expires_at <= NOW()')) return [];
    if (text.startsWith('SELECT') && text.includes("status IN ('prepared', 'pending_payment')")) {
      return rows.filter((row) => row.status === 'prepared' || row.status === 'pending_payment');
    }
    if (text.startsWith('INSERT INTO crewcast.stripe_capacity_change_operations')) {
      const inserted = operationRow(insertIdentity);
      rows.push(inserted);
      return [inserted];
    }
    if (text.includes("SET status = 'canceled'")) {
      for (const row of rows) {
        if (row.status === 'prepared' || row.status === 'pending_payment') {
          row.status = 'canceled';
          row.canceled_at = '2035-01-01T00:05:00.000Z';
        }
      }
      return [];
    }
    if (text.startsWith('SELECT') && text.includes("status = 'pending_payment'")) {
      const userId = values.find((value) => typeof value === 'number') as number;
      return rows
        .filter((row) => row.user_id === userId)
        .filter((row) => row.status === 'pending_payment')
        .slice(0, 2);
    }
    if (text.startsWith('UPDATE') && text.includes("status = 'pending_payment'")) {
      const row = rows[0];
      if (!row || row.status !== 'prepared') return [];
      row.stripe_subscription_id = values.find((value) => typeof value === 'string' && value.startsWith('sub_')) as string;
      row.stripe_invoice_id = values.find((value) => typeof value === 'string' && value.startsWith('in_')) as string;
      row.status = 'pending_payment';
      row.expires_at = values.find((value) => typeof value === 'string' && value.startsWith('2036-')) as string;
      return [row];
    }
    if (text.includes('WHERE operation_id') && text.includes('LIMIT 2')) {
      return rows.slice(0, 1);
    }
    throw new Error(`Unexpected SQL in fixture: ${text}`);
  }) as unknown as postgres.Sql;
  transaction.unsafe = (() => '') as unknown as postgres.Sql['unsafe'];
  return {
    transaction,
    rows,
    statements,
    setInsertIdentity: (identity: CapacityChangeIdentity) => { insertIdentity = identity; },
  };
}

test('durable operation stores the base subscription and approved base plan', async () => {
  const fixture = operationFixture();
  fixture.setInsertIdentity(firstIdentity);
  const operation = await prepareCapacityChangeOperation(fixture.transaction, {
    ...firstIdentity,
    expiresAt: '2035-01-01T00:30:00.000Z',
  });
  assert.equal(operation.stripeBaseSubscriptionId, 'sub_base');
  assert.equal(operation.basePlan, 'pro');
  assert.equal(fixture.rows.length, 1);
});

test('a network retry reuses the same request ID and original proration instant', async () => {
  const fixture = operationFixture([operationRow(firstIdentity)]);
  const operation = await prepareCapacityChangeOperation(fixture.transaction, {
    ...firstIdentity,
    prorationDateSeconds: firstIdentity.prorationDateSeconds + 30,
    expiresAt: '2035-01-01T00:31:00.000Z',
  });
  assert.equal(operation.operationId, firstIdentity.operationId);
  assert.equal(operation.prorationDateSeconds, firstIdentity.prorationDateSeconds);
  assert.equal(fixture.statements.some((text) => text.startsWith('INSERT INTO')), false);
});

test('a new quote may replace a prepared quote but never a pending payment', async () => {
  const secondIdentity: CapacityChangeIdentity = {
    ...firstIdentity,
    operationId: '22222222-2222-4222-8222-222222222222',
    to: { extraBrands: 0, extraLocations: 2 },
  };
  const replaceable = operationFixture([operationRow(firstIdentity)]);
  replaceable.setInsertIdentity(secondIdentity);
  const replaced = await prepareCapacityChangeOperation(replaceable.transaction, {
    ...secondIdentity,
    expiresAt: '2035-01-01T00:30:00.000Z',
    replacePrepared: true,
  });
  assert.equal(replaced.operationId, secondIdentity.operationId);
  assert.equal(replaceable.rows.filter((row) => row.status === 'prepared').length, 1);

  const pending = operationFixture([operationRow(firstIdentity, {
    status: 'pending_payment',
    stripe_invoice_id: 'in_pending',
  })]);
  await assert.rejects(
    prepareCapacityChangeOperation(pending.transaction, {
      ...secondIdentity,
      expiresAt: '2035-01-01T00:30:00.000Z',
      replacePrepared: true,
    }),
    CapacityChangeOperationConflictError,
  );
});

test('pending payment binds the exact Stripe invoice and expiry', async () => {
  const fixture = operationFixture([operationRow(firstIdentity)]);
  const operation = await bindPendingCapacityPayment(fixture.transaction, {
    userId: 42,
    operationId: firstIdentity.operationId,
    stripeSubscriptionId: 'sub_capacity',
    stripeInvoiceId: 'in_pending',
    expiresAt: '2036-01-01T00:00:00.000Z',
  });
  assert.equal(operation.status, 'pending_payment');
  assert.equal(operation.stripeInvoiceId, 'in_pending');
  assert.equal(operation.expiresAt, '2036-01-01T00:00:00.000Z');
});

test('pending payment recovery is account-scoped and returns only resumable state', async () => {
  const anotherAccount: CapacityChangeIdentity = {
    ...firstIdentity,
    operationId: '22222222-2222-4222-8222-222222222222',
    userId: 99,
  };
  const fixture = operationFixture([
    operationRow(firstIdentity, {
      status: 'pending_payment',
      stripe_invoice_id: 'in_pending',
    }),
    operationRow(anotherAccount, {
      status: 'pending_payment',
      stripe_invoice_id: 'in_other',
    }),
  ]);

  const operation = await readPendingCapacityChangeOperation(fixture.transaction, 42);

  assert.equal(operation?.operationId, firstIdentity.operationId);
  assert.deepEqual(operation?.to, firstIdentity.to);
});

test('pending payment recovery fails closed if account invariants are broken', async () => {
  const secondIdentity: CapacityChangeIdentity = {
    ...firstIdentity,
    operationId: '22222222-2222-4222-8222-222222222222',
  };
  const fixture = operationFixture([
    operationRow(firstIdentity, { status: 'pending_payment', stripe_invoice_id: 'in_one' }),
    operationRow(secondIdentity, { status: 'pending_payment', stripe_invoice_id: 'in_two' }),
  ]);

  await assert.rejects(
    readPendingCapacityChangeOperation(fixture.transaction, 42),
    /More than one pending paid-capacity payment/,
  );
  await assert.rejects(
    readPendingCapacityChangeOperation(fixture.transaction, 0),
    /account ID is invalid/,
  );
});

function lifecycleCancellationFixture(initialRows: OperationFixtureRow[]) {
  const rows = [...initialRows];
  const transaction = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join('?').replace(/\s+/g, ' ').trim();
    if (text.startsWith('UPDATE crewcast.stripe_capacity_change_operations')) {
      const userId = Number(values[0]);
      const invoiceId = values[1];
      const canceled: Array<{ operation_id: string }> = [];
      for (const row of rows) {
        if (
          row.user_id === userId
          && (
            row.status === 'prepared'
            || (row.status === 'pending_payment' && row.stripe_invoice_id === invoiceId)
          )
        ) {
          row.status = 'canceled';
          row.canceled_at = '2035-01-01T00:05:00.000Z';
          canceled.push({ operation_id: row.operation_id });
        }
      }
      return canceled;
    }
    if (text.startsWith('SELECT operation_id::text')) {
      return rows
        .filter((row) => row.user_id === Number(values[0]))
        .filter((row) => row.status === 'prepared' || row.status === 'pending_payment')
        .slice(0, 2)
        .map((row) => ({ operation_id: row.operation_id }));
    }
    throw new Error(`Unexpected SQL in lifecycle fixture: ${text}`);
  }) as unknown as postgres.Sql;
  return { transaction, rows };
}

test('base lifecycle invalidates an unsubmitted capacity quote', async () => {
  const fixture = lifecycleCancellationFixture([operationRow(firstIdentity)]);
  assert.equal(await cancelInterruptedCapacityChangesForBaseLifecycle(
    fixture.transaction,
    { userId: 42, interruptedInvoiceId: 'in_interrupted' },
  ), 1);
  assert.equal(fixture.rows[0].status, 'canceled');
});

test('base lifecycle cancels the exact Stripe payment it interrupted', async () => {
  const fixture = lifecycleCancellationFixture([
    operationRow(firstIdentity, {
      status: 'pending_payment',
      stripe_invoice_id: 'in_interrupted',
    }),
  ]);
  assert.equal(await cancelInterruptedCapacityChangesForBaseLifecycle(
    fixture.transaction,
    { userId: 42, interruptedInvoiceId: 'in_interrupted' },
  ), 1);
  assert.equal(fixture.rows[0].status, 'canceled');
});

test('base lifecycle fails closed when a different payment is still open', async () => {
  const fixture = lifecycleCancellationFixture([
    operationRow(firstIdentity, {
      status: 'pending_payment',
      stripe_invoice_id: 'in_other',
    }),
  ]);
  await assert.rejects(
    cancelInterruptedCapacityChangesForBaseLifecycle(
      fixture.transaction,
      { userId: 42, interruptedInvoiceId: 'in_interrupted' },
    ),
    CapacityChangeOperationConflictError,
  );
  assert.equal(fixture.rows[0].status, 'pending_payment');
});

function planInterlockFixture(openStatus: 'none' | 'prepared' | 'pending_payment') {
  let expiredPreparedCanceled = false;
  const transaction = (async (strings: TemplateStringsArray) => {
    const text = strings.join('?').replace(/\s+/g, ' ').trim();
    if (text.startsWith('UPDATE crewcast.stripe_capacity_change_operations')) {
      expiredPreparedCanceled = true;
      return [];
    }
    if (text.startsWith('SELECT EXISTS')) {
      return [{ conflict: openStatus !== 'none' }];
    }
    throw new Error(`Unexpected SQL in plan interlock fixture: ${text}`);
  }) as unknown as postgres.Sql;
  return {
    transaction,
    wasExpiredPreparedCanceled: () => expiredPreparedCanceled,
  };
}

test('base plan change retires expired quotes before checking the interlock', async () => {
  const fixture = planInterlockFixture('none');
  await assertNoOpenPaidCapacityChange(fixture.transaction, 42);
  assert.equal(fixture.wasExpiredPreparedCanceled(), true);
});

test('base plan change is blocked by prepared or payment-waiting capacity work', async () => {
  for (const status of ['prepared', 'pending_payment'] as const) {
    const fixture = planInterlockFixture(status);
    await assert.rejects(
      assertNoOpenPaidCapacityChange(fixture.transaction, 42),
      CapacityChangeOperationConflictError,
    );
  }
});
