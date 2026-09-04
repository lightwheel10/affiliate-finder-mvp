import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractInvoiceSubscriptionId,
  extractStripeId,
  snapshotStripeSubscription,
} from '../../src/lib/stripe/subscription-state';

const prices = {
  proMonthly: 'price_pro_month',
  proAnnual: 'price_pro_year',
  businessMonthly: 'price_business_month',
  businessAnnual: 'price_business_year',
};

test('extracts string and expanded Stripe references without coercion', () => {
  assert.equal(extractStripeId('sub_123'), 'sub_123');
  assert.equal(extractStripeId({ id: 'sub_456' }), 'sub_456');
  assert.equal(extractStripeId({ id: 123 }), null);
  assert.equal(extractStripeId(''), null);
});

test('normalizes subscription plan, interval and timestamps from current Stripe state', () => {
  assert.deepEqual(snapshotStripeSubscription({
    id: 'sub_current',
    customer: { id: 'cus_current' },
    status: 'active',
    metadata: {},
    items: {
      data: [{
        price: {
          id: 'price_business_year',
          recurring: { interval: 'year' },
        },
      }],
    },
    current_period_start: 1_800_000_000,
    current_period_end: 1_802_592_000,
    trial_end: null,
    cancel_at_period_end: false,
  }, prices), {
    subscriptionId: 'sub_current',
    customerId: 'cus_current',
    status: 'active',
    plan: 'business',
    billingInterval: 'annual',
    currentPeriodStartSeconds: 1_800_000_000,
    currentPeriodEndSeconds: 1_802_592_000,
    trialEndSeconds: null,
    cancelAtPeriodEnd: false,
    scheduleId: null,
  });
});

test('metadata remains the fallback for enterprise and unsupported metadata is rejected', () => {
  const valid = snapshotStripeSubscription({
    id: 'sub_valid',
    customer: 'cus_valid',
    status: 'trialing',
    metadata: { plan: 'enterprise', billing_interval: 'monthly' },
  }, prices);
  assert.equal(valid.plan, 'enterprise');
  assert.equal(valid.billingInterval, 'monthly');

  const invalid = snapshotStripeSubscription({
    id: 'sub_invalid',
    customer: 'cus_invalid',
    status: 'active',
    metadata: { plan: 'admin', billing_interval: 'forever' },
  }, prices);
  assert.equal(invalid.plan, null);
  assert.equal(invalid.billingInterval, null);
});

test('configured price wins over stale plan metadata during a scheduled transition', () => {
  const snapshot = snapshotStripeSubscription({
    id: 'sub_scheduled',
    customer: 'cus_scheduled',
    status: 'active',
    metadata: { plan: 'business', billing_interval: 'annual' },
    items: {
      data: [{
        price: {
          id: 'price_pro_month',
          recurring: { interval: 'month' },
        },
      }],
    },
    schedule: { id: 'sub_sched_123' },
  }, prices);

  assert.equal(snapshot.plan, 'pro');
  assert.equal(snapshot.billingInterval, 'monthly');
  assert.equal(snapshot.scheduleId, 'sub_sched_123');
});

test('reads current billing periods from newer Stripe subscription-item shape', () => {
  const snapshot = snapshotStripeSubscription({
    id: 'sub_item_period',
    customer: 'cus_item_period',
    status: 'active',
    metadata: { plan: 'pro', billing_interval: 'monthly' },
    items: {
      data: [{
        price: { id: 'price_pro_month' },
        current_period_start: 1_800_000_000,
        current_period_end: 1_802_592_000,
      }],
    },
  }, prices);

  assert.equal(snapshot.currentPeriodStartSeconds, 1_800_000_000);
  assert.equal(snapshot.currentPeriodEndSeconds, 1_802_592_000);
});

test('extracts invoice subscription IDs across supported Stripe API shapes', () => {
  assert.equal(extractInvoiceSubscriptionId({ subscription: 'sub_old' }), 'sub_old');
  assert.equal(extractInvoiceSubscriptionId({ subscription: { id: 'sub_expanded' } }), 'sub_expanded');
  assert.equal(extractInvoiceSubscriptionId({
    parent: { subscription_details: { subscription: 'sub_parent' } },
  }), 'sub_parent');
  assert.equal(extractInvoiceSubscriptionId({
    lines: { data: [{ parent: { subscription_item_details: { subscription: 'sub_line' } } }] },
  }), 'sub_line');
  assert.equal(extractInvoiceSubscriptionId({}), null);
});
