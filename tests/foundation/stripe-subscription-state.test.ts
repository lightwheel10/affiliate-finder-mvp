import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractInvoiceConfirmationClientSecret,
  extractInvoiceSubscriptionId,
  extractInvoiceSubscriptionServicePeriod,
  extractPendingSubscriptionPriceId,
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

test('reads only a bounded Stripe invoice confirmation secret', () => {
  assert.equal(extractInvoiceConfirmationClientSecret({
    confirmation_secret: { client_secret: 'pi_payment_123_secret_auth_456' },
  }), 'pi_payment_123_secret_auth_456');
  assert.equal(extractInvoiceConfirmationClientSecret({
    payment_intent: { client_secret: 'pi_legacy_secret_value' },
  }), 'pi_legacy_secret_value');
  assert.equal(extractInvoiceConfirmationClientSecret({
    confirmation_secret: { client_secret: 'seti_wrong_secret_value' },
  }), null);
  assert.equal(extractInvoiceConfirmationClientSecret({
    confirmation_secret: { client_secret: 'pi_missing_marker' },
  }), null);
});

test('reads exactly one pending plan price and rejects ambiguous state', () => {
  assert.equal(extractPendingSubscriptionPriceId({ pending_update: null }), null);
  assert.equal(extractPendingSubscriptionPriceId({
    pending_update: { subscription_items: [{ price: 'price_business_month' }] },
  }), 'price_business_month');
  assert.throws(() => extractPendingSubscriptionPriceId({
    pending_update: {
      subscription_items: [
        { price: 'price_pro_month' },
        { price: 'price_business_month' },
      ],
    },
  }), /exactly one valid price/i);
  assert.throws(() => extractPendingSubscriptionPriceId({
    pending_update: { subscription_items: [{ price: null }] },
  }), /exactly one valid price/i);
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

test('unknown Stripe prices cannot inherit stale Pro or Business metadata', () => {
  const snapshot = snapshotStripeSubscription({
    id: 'sub_unknown_price',
    customer: 'cus_unknown_price',
    status: 'active',
    metadata: { plan: 'business', billing_interval: 'annual' },
    items: {
      data: [{
        price: {
          id: 'price_not_in_our_catalogue',
          recurring: { interval: 'year' },
        },
      }],
    },
  }, prices);

  assert.equal(snapshot.plan, null);
  assert.equal(snapshot.billingInterval, 'annual');
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

test('rejects ambiguous subscriptions with more than one plan item', () => {
  assert.throws(
    () => snapshotStripeSubscription({
      id: 'sub_multiple',
      customer: 'cus_multiple',
      status: 'active',
      items: {
        data: [
          { price: { id: 'price_pro_monthly' } },
          { price: { id: 'price_business_monthly' } },
        ],
      },
    }, prices),
    /exactly one plan item/i,
  );
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

test('extracts the non-proration subscription line service period from an invoice', () => {
  const period = extractInvoiceSubscriptionServicePeriod({
    lines: {
      data: [
        {
          period: { start: 1_799_900_000, end: 1_800_000_000 },
          parent: {
            subscription_item_details: {
              subscription: 'sub_current',
              proration: true,
            },
          },
        },
        {
          period: { start: 1_800_000_000, end: 1_802_592_000 },
          parent: {
            subscription_item_details: {
              subscription: 'sub_current',
              proration: false,
            },
          },
        },
      ],
    },
  }, 'sub_current');

  assert.deepEqual(period, {
    startSeconds: 1_800_000_000,
    endSeconds: 1_802_592_000,
  });
});

test('supports legacy invoice-line shape and rejects ambiguous periods', () => {
  assert.deepEqual(extractInvoiceSubscriptionServicePeriod({
    lines: {
      data: [{
        subscription: 'sub_legacy',
        proration: false,
        period: { start: 1_800_000_000, end: 1_802_592_000 },
      }],
    },
  }, 'sub_legacy'), {
    startSeconds: 1_800_000_000,
    endSeconds: 1_802_592_000,
  });

  assert.throws(() => extractInvoiceSubscriptionServicePeriod({
    lines: {
      data: [
        {
          subscription: 'sub_ambiguous',
          period: { start: 1_800_000_000, end: 1_802_592_000 },
        },
        {
          subscription: 'sub_ambiguous',
          period: { start: 1_802_592_000, end: 1_805_184_000 },
        },
      ],
    },
  }, 'sub_ambiguous'), /multiple non-proration service periods/i);
});

test('uses one documented proration period only for an explicit subscription-update fallback', () => {
  const invoice = {
    lines: {
      data: [
        {
          subscription: 'sub_upgrade',
          proration: true,
          period: { start: 1_801_000_000, end: 1_802_592_000 },
        },
        {
          subscription: 'sub_upgrade',
          proration: true,
          period: { start: 1_801_000_000, end: 1_802_592_000 },
        },
      ],
    },
  };
  assert.equal(extractInvoiceSubscriptionServicePeriod(invoice, 'sub_upgrade'), null);
  assert.deepEqual(extractInvoiceSubscriptionServicePeriod(
    invoice,
    'sub_upgrade',
    { allowProrationFallback: true },
  ), {
    startSeconds: 1_801_000_000,
    endSeconds: 1_802_592_000,
  });

  assert.throws(() => extractInvoiceSubscriptionServicePeriod({
    lines: {
      data: [
        {
          subscription: 'sub_upgrade',
          proration: true,
          period: { start: 1_801_000_000, end: 1_802_592_000 },
        },
        {
          subscription: 'sub_upgrade',
          proration: true,
          period: { start: 1_801_000_001, end: 1_802_592_000 },
        },
      ],
    },
  }, 'sub_upgrade', { allowProrationFallback: true }), /multiple proration periods/i);
});
