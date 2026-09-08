import assert from 'node:assert/strict';
import test from 'node:test';
import type Stripe from 'stripe';
import {
  assertCustomerHasNoInheritedDiscount,
  capacityChangeDirection,
  capacityChangeIdempotencyKey,
  capacityChangeRequestFingerprint,
  capacityInvoicePreviewParams,
  capacitySelectionIdentity,
  capacitySubscriptionCreateParams,
  capacitySubscriptionUpdateParams,
  monthlyCapacitySubtotalCents,
} from '../../src/lib/stripe/capacity-change';
import type { StripeCapacitySubscriptionSnapshot } from '../../src/lib/stripe/capacity-subscription';

const prices = {
  extraBrandMonthly: 'price_brand',
  extraLocationMonthly: 'price_location',
};

const current: StripeCapacitySubscriptionSnapshot = {
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
};

test('classifies capacity changes and computes the approved monthly subtotal', () => {
  assert.equal(capacityChangeDirection(current, { extraBrands: 3, extraLocations: 4 }), 'increase');
  assert.equal(capacityChangeDirection(current, { extraBrands: 1, extraLocations: 4 }), 'decrease');
  assert.equal(capacityChangeDirection(current, { extraBrands: 3, extraLocations: 3 }), 'mixed');
  assert.equal(monthlyCapacitySubtotalCents({ extraBrands: 2, extraLocations: 4 }), 9_000);
  assert.throws(
    () => capacityChangeDirection(current, { extraBrands: 2, extraLocations: 4 }),
    /different number/i,
  );
});

test('capacity operation fingerprints are stable across harmless keep-list ordering', () => {
  const identity = {
    operationId: '11111111-1111-4111-8111-111111111111',
    userId: 42,
    stripeCustomerId: 'cus_account',
    stripeBaseSubscriptionId: 'sub_base',
    basePlan: 'business' as const,
    stripeSubscriptionId: 'sub_capacity',
    from: { extraBrands: 2, extraLocations: 4 },
    to: { extraBrands: 1, extraLocations: 3 },
    prorationDateSeconds: 1_800_000_000,
    capacitySelectionVersion: 1 as const,
    retainedBrandIds: ['20', '10'],
    retainedLocationIds: ['201', '101'],
  };
  assert.equal(
    capacityChangeRequestFingerprint(identity),
    capacityChangeRequestFingerprint({
      ...identity,
      operationId: '22222222-2222-4222-8222-222222222222',
      retainedBrandIds: ['10', '20'],
      retainedLocationIds: ['101', '201'],
    }),
  );
  assert.equal(
    capacityChangeIdempotencyKey(identity.operationId, 'increase'),
    'capacity-change:v1:11111111-1111-4111-8111-111111111111:increase',
  );
});

test('new capacity preview and creation use separate flexible monthly items', () => {
  assert.deepEqual(capacityInvoicePreviewParams({
    stripeCustomerId: 'cus_account',
    current: null,
    target: { extraBrands: 1, extraLocations: 3 },
    prorationDateSeconds: 1_800_000_000,
    prices,
  }), {
    customer: 'cus_account',
    discounts: '',
    subscription_details: {
      billing_mode: { type: 'flexible' },
      items: [
        { price: 'price_brand', quantity: 1 },
        { price: 'price_location', quantity: 3 },
      ],
    },
  });

  const create = capacitySubscriptionCreateParams({
    operationId: '11111111-1111-4111-8111-111111111111',
    userId: 42,
    stripeCustomerId: 'cus_account',
    target: { extraBrands: 1, extraLocations: 3 },
    prices,
  });
  assert.equal(create.payment_behavior, 'default_incomplete');
  assert.deepEqual(create.billing_mode, { type: 'flexible' });
  assert.deepEqual(create.payment_settings, { payment_method_types: ['card'] });
  assert.deepEqual(create.metadata, {
    neon_user_id: '42',
    subscription_kind: 'capacity_addons',
    app_capacity_operation_id: '11111111-1111-4111-8111-111111111111',
  });
  assert.deepEqual(create.items, [
    { price: 'price_brand', quantity: 1 },
    { price: 'price_location', quantity: 3 },
  ]);
});

test('existing preview and increase reuse the exact proration timestamp', () => {
  const preview = capacityInvoicePreviewParams({
    stripeCustomerId: 'cus_account',
    current,
    target: { extraBrands: 3, extraLocations: 5 },
    prorationDateSeconds: 1_800_000_000,
    prices,
  });
  assert.equal(preview.subscription, 'sub_capacity');
  assert.equal(preview.subscription_details?.proration_date, 1_800_000_000);
  assert.equal(preview.subscription_details?.proration_behavior, 'always_invoice');

  const update = capacitySubscriptionUpdateParams({
    current,
    target: { extraBrands: 3, extraLocations: 5 },
    prorationDateSeconds: 1_800_000_000,
    prices,
  });
  assert.equal(update.payment_behavior, 'pending_if_incomplete');
  assert.equal(update.proration_date, preview.subscription_details?.proration_date);
  assert.equal(update.proration_behavior, 'always_invoice');
  assert.deepEqual(update.items, [
    { id: 'si_brand', quantity: 3 },
    { id: 'si_location', quantity: 5 },
  ]);
});

test('a pure reduction may remove one item but mixed and empty updates are explicit', () => {
  const update = capacitySubscriptionUpdateParams({
    current,
    target: { extraBrands: 0, extraLocations: 3 },
    prorationDateSeconds: 1_800_000_000,
    prices,
  });
  assert.equal(update.payment_behavior, 'allow_incomplete');
  assert.deepEqual(update.items, [
    { id: 'si_brand', deleted: true },
    { id: 'si_location', quantity: 3 },
  ]);
  assert.throws(() => capacitySubscriptionUpdateParams({
    current,
    target: { extraBrands: 3, extraLocations: 3 },
    prorationDateSeconds: 1_800_000_000,
    prices,
  }), /separate confirmed changes/i);
  assert.throws(() => capacitySubscriptionUpdateParams({
    current,
    target: { extraBrands: 0, extraLocations: 0 },
    prorationDateSeconds: 1_800_000_000,
    prices,
  }), /cancel the capacity subscription/i);
});

test('customer-wide discounts fail closed while base subscription discounts stay separate', () => {
  const customer = {
    id: 'cus_account',
    deleted: false,
    discount: null,
  } as unknown as Stripe.Customer;
  assert.doesNotThrow(() => assertCustomerHasNoInheritedDiscount(customer, 'cus_account'));
  assert.throws(() => assertCustomerHasNoInheritedDiscount({
    ...customer,
    discount: { id: 'di_customer' },
  } as unknown as Stripe.Customer, 'cus_account'), /customer-wide Stripe discount/i);
});

test('selection identity is all present or all absent and has stable ID ordering', () => {
  assert.deepEqual(capacitySelectionIdentity(), {
    capacitySelectionVersion: null,
    retainedBrandIds: null,
    retainedLocationIds: null,
  });
  assert.deepEqual(capacitySelectionIdentity({
    brandIds: ['10', '2'],
    locationIds: ['101', '20'],
  }), {
    capacitySelectionVersion: 1,
    retainedBrandIds: ['2', '10'],
    retainedLocationIds: ['20', '101'],
  });
});
