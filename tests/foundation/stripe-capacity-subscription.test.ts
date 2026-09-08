import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CAPACITY_ADDON_CATALOG,
  assertCapacityPriceCatalog,
  canPurchaseCapacityAddons,
  effectiveCapacityLimits,
  effectivePaidCapacity,
  selectAuthoritativeCapacitySubscription,
  snapshotStripeCapacitySubscription,
  type CapacityPriceConfiguration,
  type StripeCapacitySubscriptionLike,
} from '../../src/lib/stripe/capacity-subscription';

const prices: CapacityPriceConfiguration = {
  extraBrandMonthly: 'price_extra_brand',
  extraLocationMonthly: 'price_extra_location',
};

function capacitySubscription(
  overrides: Partial<StripeCapacitySubscriptionLike> = {},
): StripeCapacitySubscriptionLike {
  return {
    id: 'sub_capacity',
    customer: 'cus_account',
    status: 'active',
    created: 1_800_000_000,
    metadata: { subscription_kind: 'capacity_addons' },
    items: {
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
  };
}

test('accepts one strict monthly capacity subscription with independent quantities', () => {
  assert.deepEqual(snapshotStripeCapacitySubscription(capacitySubscription(), prices), {
    subscriptionId: 'sub_capacity',
    customerId: 'cus_account',
    status: 'active',
    brandItemId: 'si_brand',
    locationItemId: 'si_location',
    extraBrands: 2,
    extraLocations: 4,
    currentPeriodEndSeconds: 1_802_592_000,
    cancelAtSeconds: null,
    cancelAtPeriodEnd: false,
  });

  const locationOnly = capacitySubscription({
    items: {
      data: [{
        id: 'si_location',
        price: { id: 'price_extra_location', recurring: { interval: 'month' } },
        quantity: 1,
      }],
    },
  });
  assert.deepEqual(snapshotStripeCapacitySubscription(locationOnly, prices), {
    subscriptionId: 'sub_capacity',
    customerId: 'cus_account',
    status: 'active',
    brandItemId: null,
    locationItemId: 'si_location',
    extraBrands: 0,
    extraLocations: 1,
    currentPeriodEndSeconds: null,
    cancelAtSeconds: null,
    cancelAtPeriodEnd: false,
  });
});

test('accepts only the approved active licensed monthly EUR prices', () => {
  const price = (id: string, amount: number) => ({
    id,
    active: true,
    billing_scheme: 'per_unit',
    currency: 'eur',
    type: 'recurring',
    unit_amount: amount,
    transform_quantity: null,
    recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' },
  });
  assert.doesNotThrow(() => assertCapacityPriceCatalog(
    price('price_extra_brand', 2_500),
    price('price_extra_location', 1_000),
    prices,
  ));
  assert.throws(() => assertCapacityPriceCatalog(
    price('price_extra_brand', 2_499),
    price('price_extra_location', 1_000),
    prices,
  ), /approved monthly EUR catalogue/i);
  assert.throws(() => assertCapacityPriceCatalog(
    price('price_wrong', 2_500),
    price('price_extra_location', 1_000),
    prices,
  ), /does not match configuration/i);
});

test('ignores subscriptions without the server-owned capacity marker', () => {
  assert.equal(snapshotStripeCapacitySubscription(capacitySubscription({
    metadata: { plan: 'pro' },
  }), prices), null);
});

test('rejects discounts on the isolated capacity subscription', () => {
  assert.throws(() => snapshotStripeCapacitySubscription(capacitySubscription({
    discounts: ['di_promotion'],
  }), prices), /must not have a discount/i);
});

test('capacity billing inherits the customer card instead of storing a stale card copy', () => {
  assert.throws(() => snapshotStripeCapacitySubscription(capacitySubscription({
    default_payment_method: 'pm_stale',
  }), prices), /inherit the customer's default payment method/i);
});

test('rejects incomplete, mixed, duplicated and non-monthly capacity price state', () => {
  assert.throws(
    () => snapshotStripeCapacitySubscription(capacitySubscription(), {
      extraBrandMonthly: 'price_same',
      extraLocationMonthly: 'price_same',
    }),
    /different prices/i,
  );
  assert.throws(
    () => snapshotStripeCapacitySubscription(capacitySubscription({ items: { data: [] } }), prices),
    /one or two add-on items/i,
  );
  assert.throws(
    () => snapshotStripeCapacitySubscription(capacitySubscription({
      status: 'trialing',
    }), prices),
    /must never have a trial/i,
  );
  assert.throws(
    () => snapshotStripeCapacitySubscription(capacitySubscription({
      items: {
        data: [{
          id: 'si_unknown',
          price: { id: 'price_unknown', recurring: { interval: 'month' } },
          quantity: 1,
        }],
      },
    }), prices),
    /unknown price/i,
  );
  assert.throws(
    () => snapshotStripeCapacitySubscription(capacitySubscription({
      items: {
        data: [
          {
            id: 'si_brand_one',
            price: { id: 'price_extra_brand', recurring: { interval: 'month' } },
            quantity: 1,
          },
          {
            id: 'si_brand_two',
            price: { id: 'price_extra_brand', recurring: { interval: 'month' } },
            quantity: 1,
          },
        ],
      },
    }), prices),
    /duplicate brand items/i,
  );
  assert.throws(
    () => snapshotStripeCapacitySubscription(capacitySubscription({
      items: {
        data: [{
          id: 'si_annual',
          price: { id: 'price_extra_brand', recurring: { interval: 'year' } },
          quantity: 1,
        }],
      },
    }), prices),
    /non-monthly/i,
  );
});

test('rejects unsafe quantities and inconsistent billing periods', () => {
  for (const quantity of [0, -1, 1.5, Number.NaN, CAPACITY_ADDON_CATALOG.brand.maxQuantity + 1]) {
    assert.throws(
      () => snapshotStripeCapacitySubscription(capacitySubscription({
        items: {
          data: [{
            id: 'si_brand',
            price: { id: 'price_extra_brand', recurring: { interval: 'month' } },
            quantity,
          }],
        },
      }), prices),
      /brand add-on quantity/i,
    );
  }
  assert.throws(
    () => snapshotStripeCapacitySubscription(capacitySubscription({
      items: {
        data: [
          {
            id: 'si_brand',
            price: { id: 'price_extra_brand', recurring: { interval: 'month' } },
            quantity: 1,
            current_period_end: 1_802_592_000,
          },
          {
            id: 'si_location',
            price: { id: 'price_extra_location', recurring: { interval: 'month' } },
            quantity: 1,
            current_period_end: 1_805_184_000,
          },
        ],
      },
    }), prices),
    /inconsistent item periods/i,
  );
});

test('starts add-on purchases only from an active paid base subscription', () => {
  assert.equal(canPurchaseCapacityAddons('active'), true);
  for (const status of ['trialing', 'past_due', 'unpaid', 'canceled', 'incomplete']) {
    assert.equal(canPurchaseCapacityAddons(status), false);
  }
});

test('keeps paid capacity during Stripe retries but removes it after terminal failure', () => {
  const quantities = { extraBrands: 2, extraLocations: 4 };
  assert.deepEqual(effectivePaidCapacity('active', quantities), quantities);
  assert.deepEqual(effectivePaidCapacity('past_due', quantities), quantities);
  for (const status of ['trialing', 'unpaid', 'canceled', 'incomplete_expired', null]) {
    assert.deepEqual(effectivePaidCapacity(status, quantities), {
      extraBrands: 0,
      extraLocations: 0,
    });
  }
});

test('rejects malformed stored quantities even when the subscription is terminal', () => {
  assert.throws(
    () => effectivePaidCapacity('canceled', {
      extraBrands: CAPACITY_ADDON_CATALOG.brand.maxQuantity + 1,
      extraLocations: 0,
    }),
    /extra brand quantity/i,
  );
});

test('selects capacity independently from the base plan and fails on duplicate live charges', () => {
  const basePlan = capacitySubscription({
    id: 'sub_base',
    metadata: { plan: 'business' },
    items: {
      data: [{
        id: 'si_base',
        price: { id: 'price_business_month', recurring: { interval: 'month' } },
        quantity: 1,
      }],
    },
  });
  const capacity = capacitySubscription();
  assert.equal(selectAuthoritativeCapacitySubscription([
    basePlan,
    capacitySubscription({ id: 'sub_old_unpaid', status: 'unpaid', created: 1_700_000_000 }),
    capacity,
  ], false, prices)?.id, 'sub_capacity');

  assert.throws(() => selectAuthoritativeCapacitySubscription([
    capacity,
    capacitySubscription({ id: 'sub_capacity_duplicate' }),
  ], false, prices), /more than one live capacity subscription/i);
  assert.throws(
    () => selectAuthoritativeCapacitySubscription([], true, prices),
    /truncated subscription list/i,
  );
});

test('selects the newest closed capacity subscription for durable terminal state', () => {
  assert.equal(selectAuthoritativeCapacitySubscription([
    capacitySubscription({
      id: 'sub_old',
      status: 'canceled',
      created: 1_700_000_000,
    }),
    capacitySubscription({
      id: 'sub_new',
      status: 'incomplete_expired',
      created: 1_800_000_000,
    }),
  ], false, prices)?.id, 'sub_new');
});

test('adds paid quantities to the base plan while preserving unlimited enterprise capacity', () => {
  assert.deepEqual(effectiveCapacityLimits('pro', {
    extraBrands: 2,
    extraLocations: 4,
  }), {
    maxBrands: 3,
    maxLocationsPerAccount: 6,
  });
  assert.deepEqual(effectiveCapacityLimits('business', {
    extraBrands: 10,
    extraLocations: 25,
  }), {
    maxBrands: 15,
    maxLocationsPerAccount: 30,
  });
  assert.deepEqual(effectiveCapacityLimits('enterprise', {
    extraBrands: 10,
    extraLocations: 25,
  }), {
    maxBrands: -1,
    maxLocationsPerAccount: -1,
  });
});
