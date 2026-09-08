import assert from 'node:assert/strict';
import test from 'node:test';
import type postgres from 'postgres';
import type Stripe from 'stripe';
import {
  finalizePaidCapacityInvoiceOperation,
  type CapacityRecoveryDatabase,
} from '../../src/lib/stripe/capacity-change-recovery-server';

const prices = {
  extraBrandMonthly: 'price_brand',
  extraLocationMonthly: 'price_location',
};
const operationId = '22222222-2222-4222-8222-222222222222';

function subscription(extraBrands = 3, extraLocations = 5): Stripe.Subscription {
  return {
    id: 'sub_capacity',
    customer: 'cus_account',
    status: 'active',
    metadata: {
      subscription_kind: 'capacity_addons',
      neon_user_id: '42',
      // This remains the original creation operation on later quantity changes.
      app_capacity_operation_id: '11111111-1111-4111-8111-111111111111',
    },
    items: {
      object: 'list',
      has_more: false,
      url: '/v1/subscription_items',
      data: [
        {
          id: 'si_brand',
          price: { id: 'price_brand', recurring: { interval: 'month' } },
          quantity: extraBrands,
          current_period_end: 1_802_592_000,
        } as Stripe.SubscriptionItem,
        {
          id: 'si_location',
          price: { id: 'price_location', recurring: { interval: 'month' } },
          quantity: extraLocations,
          current_period_end: 1_802_592_000,
        } as Stripe.SubscriptionItem,
      ],
    },
    cancel_at: null,
    cancel_at_period_end: false,
  } as unknown as Stripe.Subscription;
}

function operationRow() {
  return {
    operation_id: operationId,
    user_id: 42,
    request_fingerprint: 'a'.repeat(64),
    stripe_customer_id: 'cus_account',
    stripe_base_subscription_id: 'sub_base',
    base_plan: 'pro',
    stripe_subscription_id: 'sub_capacity',
    stripe_invoice_id: 'in_paid',
    from_extra_brand_quantity: 2,
    from_extra_location_quantity: 4,
    to_extra_brand_quantity: 3,
    to_extra_location_quantity: 5,
    proration_date_seconds: 1_800_000_000,
    capacity_selection_version: null,
    retained_brand_ids: null,
    retained_location_ids: null,
    reason: 'customer_change',
    status: 'pending_payment',
    expires_at: '2035-01-01T00:30:00.000Z',
    completed_at: null as string | null,
    canceled_at: null,
    created_at: '2035-01-01T00:00:00.000Z',
  };
}

function databaseFixture(withOpenOperation = true) {
  const operation = operationRow();
  const statements: string[] = [];
  const execute = async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join('?').replace(/\s+/g, ' ').trim();
    statements.push(text);
    if (text === '' || text === 'FOR UPDATE' || text.includes('pg_advisory_xact_lock')) return [];
    if (text.includes('FROM crewcast.users')) return [{ id: 42 }];
    if (text.includes('FROM crewcast.subscriptions')) {
      return [{
        id: 42,
        stripe_customer_id: 'cus_account',
        stripe_subscription_id: 'sub_base',
        plan: 'pro',
        status: 'active',
      }];
    }
    if (text.includes('FROM crewcast.subscription_plan_changes')) return [{ conflict: false }];
    if (text.startsWith('SELECT') && text.includes('FROM crewcast.stripe_capacity_change_operations')) {
      if (!withOpenOperation || operation.status !== 'pending_payment') return [];
      if (text.includes('operation_id =') && values.includes('11111111-1111-4111-8111-111111111111')) {
        return [];
      }
      return [operation];
    }
    if (text.startsWith('INSERT INTO crewcast.stripe_capacity_subscriptions')) {
      return [{ user_id: 42 }];
    }
    if (text.startsWith('UPDATE crewcast.stripe_capacity_change_operations')
      && text.includes("status = 'completed'")) {
      operation.status = 'completed';
      operation.completed_at = '2035-01-01T00:06:00.000Z';
      return [operation];
    }
    throw new Error(`Unexpected SQL in recovery fixture: ${text}`);
  };
  const database = execute as unknown as CapacityRecoveryDatabase & postgres.Sql;
  database.unsafe = (() => '') as unknown as postgres.Sql['unsafe'];
  const begin: CapacityRecoveryDatabase['begin'] = async (run) => run(database);
  Object.assign(database, { begin });
  return { database, operation, statements };
}

test('a delayed paid invoice completes the open quantity operation exactly once', async () => {
  const fixture = databaseFixture();
  assert.equal(await finalizePaidCapacityInvoiceOperation(
    fixture.database,
    subscription(),
    'in_paid',
    prices,
  ), true);
  assert.equal(fixture.operation.status, 'completed');
  assert.equal(fixture.statements.some((text) =>
    text.includes('UPDATE crewcast.subscriptions')
    || text.includes('UPDATE crewcast.user_credits')),
  false);
});

test('ordinary capacity renewal invoices do not invent a change operation', async () => {
  const fixture = databaseFixture(false);
  assert.equal(await finalizePaidCapacityInvoiceOperation(
    fixture.database,
    subscription(),
    'in_renewal',
    prices,
  ), true);
  assert.equal(fixture.statements.some((text) =>
    text.startsWith('UPDATE crewcast.stripe_capacity_change_operations')),
  false);
});

test('a paid invoice cannot complete a different quantity target', async () => {
  const fixture = databaseFixture();
  await assert.rejects(
    finalizePaidCapacityInvoiceOperation(
      fixture.database,
      subscription(4, 5),
      'in_paid',
      prices,
    ),
    /without the operation target becoming authoritative/i,
  );
  assert.equal(fixture.operation.status, 'pending_payment');
});
