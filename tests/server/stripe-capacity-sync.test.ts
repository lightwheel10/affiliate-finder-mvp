import assert from 'node:assert/strict';
import test from 'node:test';
import type postgres from 'postgres';
import type Stripe from 'stripe';
import {
  synchronizeStripeCapacitySubscription,
  type CapacitySubscriptionSyncDatabase,
  type CapacitySubscriptionSyncStripeClient,
} from '../../src/lib/stripe/capacity-subscription-sync-server';

const prices = {
  extraBrandMonthly: 'price_extra_brand',
  extraLocationMonthly: 'price_extra_location',
};

function capacitySubscription(
  overrides: Record<string, unknown> = {},
): Stripe.Subscription {
  return {
    id: 'sub_capacity',
    customer: 'cus_account',
    status: 'active',
    created: 1_800_000_000,
    metadata: {
      subscription_kind: 'capacity_addons',
      neon_user_id: '42',
    },
    items: {
      object: 'list',
      has_more: false,
      url: '/v1/subscription_items',
      data: [
        {
          id: 'si_brand',
          price: { id: 'price_extra_brand', recurring: { interval: 'month' } },
          quantity: 2,
          current_period_end: 1_802_592_000,
        },
        {
          id: 'si_location',
          price: { id: 'price_extra_location', recurring: { interval: 'month' } },
          quantity: 4,
          current_period_end: 1_802_592_000,
        },
      ],
    },
    cancel_at: null,
    cancel_at_period_end: false,
    ...overrides,
  } as unknown as Stripe.Subscription;
}

interface CapacityMirrorRow {
  stripe_customer_id: string;
  stripe_subscription_id: string;
  status: string;
  extra_brand_quantity: number;
  extra_location_quantity: number;
}

interface ManagedBrandRow {
  id: string;
  is_default: boolean;
  archived: boolean;
}

interface ManagedLocationRow {
  id: string;
  brand_id: string;
  is_default: boolean;
  archived: boolean;
}

interface OperationRow {
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
  retained_brand_ids: string[] | null;
  retained_location_ids: string[] | null;
  reason: string;
  status: string;
  expires_at: string;
  completed_at: string | null;
  canceled_at: string | null;
  created_at: string;
}

function operationRow(
  overrides: Partial<OperationRow> = {},
): OperationRow {
  return {
    operation_id: '11111111-1111-4111-8111-111111111111',
    user_id: 42,
    request_fingerprint: 'a'.repeat(64),
    stripe_customer_id: 'cus_account',
    stripe_base_subscription_id: 'sub_base',
    base_plan: 'pro',
    stripe_subscription_id: 'sub_capacity',
    stripe_invoice_id: null,
    from_extra_brand_quantity: 2,
    from_extra_location_quantity: 4,
    to_extra_brand_quantity: 0,
    to_extra_location_quantity: 0,
    proration_date_seconds: 1_800_000_000,
    capacity_selection_version: 1,
    retained_brand_ids: ['30'],
    retained_location_ids: ['301'],
    reason: 'customer_change',
    status: 'prepared',
    expires_at: '2035-01-01T00:30:00.000Z',
    completed_at: null,
    canceled_at: null,
    created_at: '2035-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function databaseFixture(options: {
  baseStatus?: string;
  mirror?: CapacityMirrorRow | null;
  brands?: ManagedBrandRow[];
  locations?: ManagedLocationRow[];
  operations?: OperationRow[];
} = {}) {
  const statements: Array<{ text: string; values: unknown[] }> = [];
  let mirror = options.mirror ?? null;
  const brands = options.brands ?? [];
  const locations = options.locations ?? [];
  const operations = options.operations ?? [];
  const transaction = (async (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => {
    const text = strings.join('?').replace(/\s+/g, ' ').trim();
    if (text.length === 0 || text === 'FOR UPDATE') return [];
    statements.push({ text, values });
    if (text.includes('pg_advisory_xact_lock')) return [];
    if (
      text.includes('FROM crewcast.subscriptions')
      && text.includes('stripe_customer_id =')
    ) {
      return [{ user_id: 42, stripe_customer_id: 'cus_account' }];
    }
    if (text.includes('FROM crewcast.users')) return [{ id: 42 }];
    if (text.includes('FROM crewcast.subscriptions')) {
      return [{
        id: 42,
        stripe_customer_id: 'cus_account',
        stripe_subscription_id: 'sub_base',
        plan: 'pro',
        status: options.baseStatus ?? 'active',
      }];
    }
    if (
      text.startsWith('SELECT')
      && text.includes('FROM crewcast.stripe_capacity_subscriptions')
    ) {
      return mirror ? [mirror] : [];
    }
    if (text.startsWith('SELECT EXISTS') && text.includes('subscription_plan_changes')) {
      return [{ conflict: false }];
    }
    if (
      text.startsWith('SELECT')
      && text.includes('FROM crewcast.stripe_capacity_change_operations')
    ) {
      const open = operations.filter((operation) =>
        operation.status === 'prepared' || operation.status === 'pending_payment');
      const operationId = values.find((value) =>
        typeof value === 'string' && /^[0-9a-f]{8}-/i.test(value));
      const subscriptionId = values.find((value) =>
        typeof value === 'string' && value.startsWith('sub_capacity'));
      return open.filter((operation) =>
        (operationId === undefined || operation.operation_id === operationId)
        && (
          subscriptionId === undefined
          || operation.stripe_subscription_id === null
          || operation.stripe_subscription_id === subscriptionId
        )
      ).slice(0, 2);
    }
    if (text.includes('INSERT INTO crewcast.stripe_capacity_subscriptions')) {
      mirror = {
        stripe_customer_id: String(values[1]),
        stripe_subscription_id: String(values[2]),
        status: String(values[5]),
        extra_brand_quantity: Number(values[6]),
        extra_location_quantity: Number(values[7]),
      };
      return [{ user_id: 42 }];
    }
    if (
      text.startsWith('UPDATE crewcast.stripe_capacity_change_operations')
      && text.includes('expires_at <= NOW()')
    ) {
      return [];
    }
    if (text.startsWith('INSERT INTO crewcast.stripe_capacity_change_operations')) {
      const inserted = operationRow({
        operation_id: String(values[0]),
        user_id: Number(values[1]),
        request_fingerprint: String(values[2]),
        stripe_customer_id: String(values[3]),
        stripe_base_subscription_id: String(values[4]),
        base_plan: String(values[5]),
        stripe_subscription_id: values[6] === null ? null : String(values[6]),
        from_extra_brand_quantity: Number(values[7]),
        from_extra_location_quantity: Number(values[8]),
        to_extra_brand_quantity: Number(values[9]),
        to_extra_location_quantity: Number(values[10]),
        proration_date_seconds: Number(values[11]),
        capacity_selection_version: values[12] === null ? null : Number(values[12]),
        retained_brand_ids: values[13] as string[] | null,
        retained_location_ids: values[14] as string[] | null,
        reason: String(values[15]),
        expires_at: String(values[16]),
      });
      operations.push(inserted);
      return [inserted];
    }
    if (
      text.startsWith('UPDATE crewcast.stripe_capacity_change_operations')
      && text.includes("status = 'completed'")
    ) {
      const operationId = String(values[2]);
      const operation = operations.find((candidate) =>
        candidate.operation_id === operationId
        && (candidate.status === 'prepared' || candidate.status === 'pending_payment'));
      if (!operation) return [];
      operation.stripe_subscription_id = String(values[0]);
      operation.status = 'completed';
      operation.completed_at = '2035-01-01T00:10:00.000Z';
      return [operation];
    }
    if (
      text.startsWith('UPDATE crewcast.stripe_capacity_change_operations')
      && text.includes("status = 'canceled'")
    ) {
      const operationId = values.find((value) =>
        typeof value === 'string' && /^[0-9a-f]{8}-/i.test(value));
      for (const operation of operations) {
        if (
          (operationId === undefined || operation.operation_id === operationId)
          && (operation.status === 'prepared' || operation.status === 'pending_payment')
        ) {
          operation.status = 'canceled';
          operation.canceled_at = '2035-01-01T00:10:00.000Z';
        }
      }
      return [];
    }
    if (text.includes('FROM crewcast.brands') && text.includes('archived_at IS NULL')) {
      return brands
        .filter((brand) => !brand.archived)
        .map(({ id, is_default }) => ({ id, is_default }));
    }
    if (
      text.includes('FROM crewcast.brand_locations')
      && text.includes('archived_at IS NULL')
    ) {
      return locations
        .filter((location) => !location.archived)
        .map(({ id, brand_id, is_default }) => ({ id, brand_id, is_default }));
    }
    if (
      text.startsWith('UPDATE crewcast.brand_locations')
      && text.includes('archived_at = statement_timestamp()')
    ) {
      const keepIds = values.find(Array.isArray) as string[];
      const archived = locations.filter((location) =>
        !location.archived && !keepIds.includes(location.id));
      archived.forEach((location) => { location.archived = true; });
      return archived.map((location) => ({ id: location.id }));
    }
    if (
      text.startsWith('UPDATE crewcast.brands')
      && text.includes('archived_at = statement_timestamp()')
    ) {
      const keepIds = values.find(Array.isArray) as string[];
      const archived = brands.filter((brand) =>
        !brand.archived && !keepIds.includes(brand.id));
      archived.forEach((brand) => { brand.archived = true; });
      return archived.map((brand) => ({ id: brand.id }));
    }
    if (
      text.startsWith('UPDATE crewcast.brands')
      || text.startsWith('UPDATE crewcast.brand_locations')
    ) {
      return [];
    }
    throw new Error(`Unexpected SQL in fixture: ${text}`);
  }) as unknown as postgres.Sql;
  transaction.unsafe = (() => '') as unknown as postgres.Sql['unsafe'];
  const database: CapacitySubscriptionSyncDatabase = {
    begin: async (operation) => operation(transaction),
  };
  return {
    database,
    statements,
    brands,
    locations,
    operations,
    readMirror: () => mirror,
  };
}

function overCapacityPortfolio() {
  return {
    brands: [
      { id: '10', is_default: true, archived: false },
      { id: '20', is_default: false, archived: false },
      { id: '30', is_default: false, archived: false },
    ],
    locations: [
      { id: '101', brand_id: '10', is_default: true, archived: false },
      { id: '201', brand_id: '20', is_default: true, archived: false },
      { id: '301', brand_id: '30', is_default: true, archived: false },
      { id: '102', brand_id: '10', is_default: false, archived: false },
      { id: '202', brand_id: '20', is_default: false, archived: false },
    ],
  };
}

function activeMirror(): CapacityMirrorRow {
  return {
    stripe_customer_id: 'cus_account',
    stripe_subscription_id: 'sub_capacity',
    status: 'active',
    extra_brand_quantity: 2,
    extra_location_quantity: 4,
  };
}

function stripeFixture(subscriptions: Stripe.Subscription[]) {
  let retrieveCount = 0;
  const stripeClient = {
    subscriptions: {
      list: async () => ({ data: subscriptions, has_more: false }),
      retrieve: async (id: string) => {
        retrieveCount += 1;
        const found = subscriptions.find((subscription) => subscription.id === id);
        if (!found) throw new Error(`Unknown fixture subscription ${id}.`);
        return found;
      },
    },
  } as unknown as CapacitySubscriptionSyncStripeClient;
  return { stripeClient, readRetrieveCount: () => retrieveCount };
}

test('a base subscription event never touches the capacity mirror', async () => {
  const base = capacitySubscription({
    id: 'sub_base',
    metadata: { subscription_kind: 'base_plan', neon_user_id: '42' },
    items: {
      object: 'list',
      has_more: false,
      url: '/v1/subscription_items',
      data: [{
        id: 'si_base',
        price: { id: 'price_business_month', recurring: { interval: 'month' } },
        quantity: 1,
      }],
    },
  });
  const { database, statements } = databaseFixture();
  const { stripeClient, readRetrieveCount } = stripeFixture([base]);

  assert.equal(await synchronizeStripeCapacitySubscription(
    database,
    stripeClient,
    base,
    prices,
  ), false);
  assert.equal(statements.length, 0);
  assert.equal(readRetrieveCount(), 0);
});

test('a capacity event updates only the private capacity mirror', async () => {
  const capacity = capacitySubscription();
  const { database, statements } = databaseFixture();
  const { stripeClient, readRetrieveCount } = stripeFixture([capacity]);

  assert.equal(await synchronizeStripeCapacitySubscription(
    database,
    stripeClient,
    capacity,
    prices,
  ), true);
  assert.equal(readRetrieveCount(), 1);
  const write = statements.find((statement) =>
    statement.text.includes('INSERT INTO crewcast.stripe_capacity_subscriptions'));
  assert.ok(write);
  assert.ok(write.values.includes(2));
  assert.ok(write.values.includes(4));
  assert.equal(statements.some((statement) =>
    statement.text.includes('UPDATE crewcast.subscriptions')
    || statement.text.includes('UPDATE crewcast.user_credits')
  ), false);
});

test('capacity synchronization rejects wrong account metadata before writing', async () => {
  const capacity = capacitySubscription({
    metadata: {
      subscription_kind: 'capacity_addons',
      neon_user_id: '99',
    },
  });
  const { database, statements } = databaseFixture();
  const { stripeClient } = stripeFixture([capacity]);

  await assert.rejects(
    synchronizeStripeCapacitySubscription(database, stripeClient, capacity, prices),
    /invalid account metadata/i,
  );
  assert.equal(statements.some((statement) =>
    statement.text.includes('INSERT INTO crewcast.stripe_capacity_subscriptions')),
  false);
});

test('capacity synchronization fails closed for duplicate live recurring charges', async () => {
  const capacity = capacitySubscription();
  const duplicate = capacitySubscription({ id: 'sub_capacity_duplicate' });
  const { database, statements } = databaseFixture();
  const { stripeClient } = stripeFixture([capacity, duplicate]);

  await assert.rejects(
    synchronizeStripeCapacitySubscription(database, stripeClient, capacity, prices),
    /more than one live capacity subscription/i,
  );
  assert.equal(statements.some((statement) =>
    statement.text.includes('INSERT INTO crewcast.stripe_capacity_subscriptions')),
  false);
});

test('past-due capacity stays active while Stripe is retrying payment', async () => {
  const capacity = capacitySubscription({ status: 'past_due' });
  const portfolio = overCapacityPortfolio();
  const fixture = databaseFixture({
    mirror: activeMirror(),
    ...portfolio,
  });
  const { stripeClient } = stripeFixture([capacity]);

  assert.equal(await synchronizeStripeCapacitySubscription(
    fixture.database,
    stripeClient,
    capacity,
    prices,
  ), true);
  assert.equal(fixture.operations.length, 0);
  assert.equal(fixture.brands.every((brand) => !brand.archived), true);
  assert.equal(fixture.locations.every((location) => !location.archived), true);
  assert.equal(fixture.readMirror()?.status, 'past_due');
});

test('terminal payment loss keeps defaults then oldest and archives overflow once', async () => {
  const capacity = capacitySubscription({ status: 'unpaid' });
  const portfolio = overCapacityPortfolio();
  const fixture = databaseFixture({
    mirror: activeMirror(),
    ...portfolio,
  });
  const { stripeClient } = stripeFixture([capacity]);

  await synchronizeStripeCapacitySubscription(
    fixture.database,
    stripeClient,
    capacity,
    prices,
  );
  assert.deepEqual(
    fixture.brands.filter((brand) => !brand.archived).map((brand) => brand.id),
    ['10'],
  );
  assert.deepEqual(
    fixture.locations.filter((location) => !location.archived).map((location) => location.id),
    ['101', '102'],
  );
  assert.equal(fixture.operations.length, 1);
  assert.equal(fixture.operations[0].reason, 'payment_failure');
  assert.equal(fixture.operations[0].status, 'completed');
  assert.equal(fixture.operations[0].from_extra_brand_quantity, 2);
  assert.equal(fixture.operations[0].from_extra_location_quantity, 4);

  await synchronizeStripeCapacitySubscription(
    fixture.database,
    stripeClient,
    capacity,
    prices,
  );
  assert.equal(fixture.operations.length, 1, 'a webhook retry must not create another repair');
});

test('a first-seen terminal event can repair overflow without an earlier mirror event', async () => {
  const capacity = capacitySubscription({ status: 'canceled' });
  const fixture = databaseFixture(overCapacityPortfolio());
  const { stripeClient } = stripeFixture([capacity]);

  await synchronizeStripeCapacitySubscription(
    fixture.database,
    stripeClient,
    capacity,
    prices,
  );
  assert.equal(fixture.operations.length, 1);
  assert.equal(fixture.operations[0].from_extra_brand_quantity, 2);
  assert.equal(fixture.operations[0].from_extra_location_quantity, 4);
  assert.deepEqual(
    fixture.brands.filter((brand) => !brand.archived).map((brand) => brand.id),
    ['10'],
  );
});

test('terminal capacity before onboarding has nothing to archive and creates no operation', async () => {
  const capacity = capacitySubscription({ status: 'incomplete_expired' });
  const fixture = databaseFixture({ mirror: activeMirror() });
  const { stripeClient } = stripeFixture([capacity]);

  await synchronizeStripeCapacitySubscription(
    fixture.database,
    stripeClient,
    capacity,
    prices,
  );
  assert.equal(fixture.operations.length, 0);
  assert.equal(fixture.readMirror()?.status, 'incomplete_expired');
});

test('a customer zero-capacity operation keeps the customer-selected rows', async () => {
  const operation = operationRow();
  const capacity = capacitySubscription({
    status: 'canceled',
    metadata: {
      subscription_kind: 'capacity_addons',
      neon_user_id: '42',
      app_capacity_operation_id: operation.operation_id,
    },
  });
  const fixture = databaseFixture({
    mirror: activeMirror(),
    operations: [operation],
    ...overCapacityPortfolio(),
  });
  const { stripeClient } = stripeFixture([capacity]);

  await synchronizeStripeCapacitySubscription(
    fixture.database,
    stripeClient,
    capacity,
    prices,
  );
  assert.deepEqual(
    fixture.brands.filter((brand) => !brand.archived).map((brand) => brand.id),
    ['30'],
  );
  assert.deepEqual(
    fixture.locations.filter((location) => !location.archived).map((location) => location.id),
    ['301'],
  );
  assert.equal(operation.status, 'completed');
  assert.equal(fixture.operations.length, 1);
});

test('repurchased capacity creates room but never silently restores archived rows', async () => {
  const operation = operationRow({
    from_extra_brand_quantity: 0,
    from_extra_location_quantity: 0,
    to_extra_brand_quantity: 2,
    to_extra_location_quantity: 4,
    capacity_selection_version: null,
    retained_brand_ids: null,
    retained_location_ids: null,
    stripe_subscription_id: null,
  });
  const capacity = capacitySubscription({
    metadata: {
      subscription_kind: 'capacity_addons',
      neon_user_id: '42',
      app_capacity_operation_id: operation.operation_id,
    },
  });
  const portfolio = overCapacityPortfolio();
  portfolio.brands[1].archived = true;
  portfolio.locations[1].archived = true;
  const fixture = databaseFixture({
    mirror: { ...activeMirror(), status: 'canceled' },
    operations: [operation],
    ...portfolio,
  });
  const { stripeClient } = stripeFixture([capacity]);

  await synchronizeStripeCapacitySubscription(
    fixture.database,
    stripeClient,
    capacity,
    prices,
  );
  assert.equal(operation.status, 'completed');
  assert.equal(portfolio.brands[1].archived, true);
  assert.equal(portfolio.locations[1].archived, true);
  assert.equal(fixture.readMirror()?.status, 'active');
});

test('terminal Stripe state cancels a mismatched customer change before automatic repair', async () => {
  const staleOperation = operationRow({
    to_extra_brand_quantity: 1,
    to_extra_location_quantity: 2,
    retained_brand_ids: ['10', '20'],
    retained_location_ids: ['101', '201', '102', '202'],
  });
  const capacity = capacitySubscription({ status: 'unpaid' });
  const fixture = databaseFixture({
    mirror: activeMirror(),
    operations: [staleOperation],
    ...overCapacityPortfolio(),
  });
  const { stripeClient } = stripeFixture([capacity]);

  await synchronizeStripeCapacitySubscription(
    fixture.database,
    stripeClient,
    capacity,
    prices,
  );
  assert.equal(staleOperation.status, 'canceled');
  assert.equal(fixture.operations.length, 2);
  assert.equal(fixture.operations[1].reason, 'payment_failure');
  assert.equal(fixture.operations[1].status, 'completed');
});

test('base-plan termination records the automatic loss as base-ended', async () => {
  const capacity = capacitySubscription({ status: 'canceled' });
  const fixture = databaseFixture({
    baseStatus: 'canceled',
    mirror: activeMirror(),
    ...overCapacityPortfolio(),
  });
  const { stripeClient } = stripeFixture([capacity]);

  await synchronizeStripeCapacitySubscription(
    fixture.database,
    stripeClient,
    capacity,
    prices,
  );
  assert.equal(fixture.operations[0]?.reason, 'base_ended');
});
