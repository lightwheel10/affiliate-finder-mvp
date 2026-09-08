import assert from 'node:assert/strict';
import test from 'node:test';
import type postgres from 'postgres';
import { readEffectivePaidCapacity } from '../../src/lib/stripe/capacity-entitlements-postgres';

interface CapacityRow {
  stripe_customer_id: unknown;
  status: unknown;
  extra_brand_quantity: unknown;
  extra_location_quantity: unknown;
}

function databaseFixture(rows: CapacityRow[]) {
  const statements: string[] = [];
  const transaction = (async (strings: TemplateStringsArray) => {
    const text = strings.join('?').replace(/\s+/g, ' ').trim();
    if (text.length === 0) return [];
    statements.push(text);
    if (text === 'FOR UPDATE') return [];
    if (text.includes('FROM crewcast.stripe_capacity_subscriptions')) return rows;
    throw new Error(`Unexpected SQL in fixture: ${text}`);
  }) as unknown as postgres.Sql;
  return { transaction, statements };
}

test('missing capacity row grants no paid capacity', async () => {
  const fixture = databaseFixture([]);
  assert.deepEqual(await readEffectivePaidCapacity(fixture.transaction, {
    userId: 42,
    stripeCustomerId: 'cus_account',
  }), { extraBrands: 0, extraLocations: 0 });
  assert.equal(fixture.statements.includes('FOR UPDATE'), true);
});

test('active and past-due rows keep their paid capacity', async () => {
  for (const status of ['active', 'past_due']) {
    const fixture = databaseFixture([{
      stripe_customer_id: 'cus_account',
      status,
      extra_brand_quantity: 2,
      extra_location_quantity: 4,
    }]);
    assert.deepEqual(await readEffectivePaidCapacity(fixture.transaction, {
      userId: 42,
      stripeCustomerId: 'cus_account',
    }), { extraBrands: 2, extraLocations: 4 });
  }
});

test('terminal capacity row grants no paid capacity', async () => {
  const fixture = databaseFixture([{
    stripe_customer_id: 'cus_account',
    status: 'canceled',
    extra_brand_quantity: 2,
    extra_location_quantity: 4,
  }]);
  assert.deepEqual(await readEffectivePaidCapacity(fixture.transaction, {
    userId: 42,
    stripeCustomerId: 'cus_account',
  }), { extraBrands: 0, extraLocations: 0 });
});

test('capacity mirror cannot cross Stripe customer ownership', async () => {
  const fixture = databaseFixture([{
    stripe_customer_id: 'cus_other',
    status: 'active',
    extra_brand_quantity: 1,
    extra_location_quantity: 1,
  }]);
  await assert.rejects(
    readEffectivePaidCapacity(fixture.transaction, {
      userId: 42,
      stripeCustomerId: 'cus_account',
    }),
    /different Stripe customers/i,
  );
});

test('corrupt quantities fail closed instead of granting capacity', async () => {
  const fixture = databaseFixture([{
    stripe_customer_id: 'cus_account',
    status: 'active',
    extra_brand_quantity: 11,
    extra_location_quantity: 1,
  }]);
  await assert.rejects(
    readEffectivePaidCapacity(fixture.transaction, {
      userId: 42,
      stripeCustomerId: 'cus_account',
    }),
    /Extra brand quantity must be an integer from 0 through 10/i,
  );
});
