import assert from 'node:assert/strict';
import test from 'node:test';
import type Stripe from 'stripe';
import {
  cancelCapacityAfterBaseEnded,
  capacityLifecycleIdempotencyKey,
  resumeCapacityWithBase,
  scheduleCapacityAtBaseEnd,
  type CapacityLifecycleStripeClient,
} from '../../src/lib/stripe/capacity-lifecycle-server';

const prices = {
  extraBrandMonthly: 'price_extra_brand',
  extraLocationMonthly: 'price_extra_location',
};

const identity = {
  userId: 42,
  stripeCustomerId: 'cus_account',
  stripeBaseSubscriptionId: 'sub_base',
};

function capacitySubscription(
  overrides: Record<string, unknown> = {},
): Stripe.Subscription {
  return {
    id: 'sub_capacity',
    customer: identity.stripeCustomerId,
    status: 'active',
    created: 1_800_000_000,
    collection_method: 'charge_automatically',
    metadata: {
      subscription_kind: 'capacity_addons',
      neon_user_id: String(identity.userId),
    },
    items: {
      object: 'list',
      has_more: false,
      url: '/v1/subscription_items',
      data: [{
        id: 'si_brand',
        object: 'subscription_item',
        price: {
          id: prices.extraBrandMonthly,
          recurring: { interval: 'month' },
        },
        quantity: 2,
        current_period_end: 1_802_592_000,
      }],
    },
    cancel_at: null,
    cancel_at_period_end: false,
    latest_invoice: null,
    pending_update: null,
    ...overrides,
  } as unknown as Stripe.Subscription;
}

function baseSubscription(): Stripe.Subscription {
  return {
    id: identity.stripeBaseSubscriptionId,
    customer: identity.stripeCustomerId,
    status: 'active',
    created: 1_700_000_000,
    metadata: { subscription_kind: 'base_plan' },
    items: {
      object: 'list',
      has_more: false,
      url: '/v1/subscription_items',
      data: [],
    },
  } as unknown as Stripe.Subscription;
}

function fixture(initialCapacity: Stripe.Subscription | null) {
  let capacity = initialCapacity;
  const calls: Array<{
    name: string;
    id?: string;
    params?: Stripe.SubscriptionUpdateParams;
    idempotencyKey?: string;
  }> = [];

  const stripeClient = {
    subscriptions: {
      list: async () => ({
        data: capacity ? [baseSubscription(), capacity] : [baseSubscription()],
        has_more: false,
      }),
      retrieve: async (id: string) => {
        assert.equal(id, capacity?.id);
        if (!capacity) throw new Error('Capacity subscription not found.');
        return capacity;
      },
      update: async (
        id: string,
        params: Stripe.SubscriptionUpdateParams,
        options: Stripe.RequestOptions,
      ) => {
        calls.push({ name: 'update', id, params, idempotencyKey: options.idempotencyKey });
        assert.ok(capacity);
        const metadata = { ...capacity.metadata };
        for (const [key, value] of Object.entries(params.metadata ?? {})) {
          if (value === '') delete metadata[key];
          else if (value !== undefined) metadata[key] = String(value);
        }
        capacity = {
          ...capacity,
          cancel_at: params.cancel_at === '' ? null : params.cancel_at ?? capacity.cancel_at,
          cancel_at_period_end:
            params.cancel_at_period_end ?? capacity.cancel_at_period_end,
          metadata,
        } as Stripe.Subscription;
        return capacity;
      },
      cancel: async (
        id: string,
        _params: Stripe.SubscriptionCancelParams,
        options: Stripe.RequestOptions,
      ) => {
        calls.push({ name: 'cancel', id, idempotencyKey: options.idempotencyKey });
        assert.ok(capacity);
        capacity = {
          ...capacity,
          status: 'canceled',
          cancel_at: null,
          cancel_at_period_end: false,
          pending_update: null,
        } as Stripe.Subscription;
        return capacity;
      },
    },
    invoices: {
      voidInvoice: async (
        id: string,
        _params: Stripe.InvoiceVoidInvoiceParams,
        options: Stripe.RequestOptions,
      ) => {
        calls.push({ name: 'void', id, idempotencyKey: options.idempotencyKey });
        assert.ok(capacity);
        capacity = { ...capacity, pending_update: null } as Stripe.Subscription;
        return {
          id,
          status: 'void',
          customer: identity.stripeCustomerId,
          parent: {
            type: 'subscription_details',
            subscription_details: { subscription: capacity.id },
          },
        } as unknown as Stripe.Invoice;
      },
    },
  } as unknown as CapacityLifecycleStripeClient;

  return {
    stripeClient,
    calls,
    readCapacity: () => capacity,
  };
}

test('no add-on subscription means base cancellation has no Stripe side effect', async () => {
  const { stripeClient, calls } = fixture(null);
  const result = await scheduleCapacityAtBaseEnd(
    stripeClient,
    { ...identity, baseEndsAtSeconds: Math.floor(Date.now() / 1_000) + 86_400 },
    prices,
  );
  assert.deepEqual(result, { snapshot: null, interruptedInvoiceId: null });
  assert.deepEqual(calls, []);
});

test('active capacity is scheduled to end with the base plan and retry is a no-op', async () => {
  const { stripeClient, calls, readCapacity } = fixture(capacitySubscription());
  const baseEndsAtSeconds = Math.floor(Date.now() / 1_000) + 365 * 86_400;
  const input = { ...identity, baseEndsAtSeconds };

  const first = await scheduleCapacityAtBaseEnd(stripeClient, input, prices);
  assert.equal(first.snapshot?.cancelAtSeconds, baseEndsAtSeconds);
  assert.equal(first.interruptedInvoiceId, null);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'update');
  assert.equal(calls[0].params?.proration_behavior, 'create_prorations');
  assert.equal(readCapacity()?.metadata.app_base_subscription_id, identity.stripeBaseSubscriptionId);
  assert.equal(readCapacity()?.metadata.app_base_cancel_at, String(baseEndsAtSeconds));

  await scheduleCapacityAtBaseEnd(stripeClient, input, prices);
  assert.equal(calls.length, 1);
});

test('an earlier independent capacity cancellation is never extended or cleared', async () => {
  const existingEnd = Math.floor(Date.now() / 1_000) + 7 * 86_400;
  const { stripeClient, calls } = fixture(capacitySubscription({ cancel_at: existingEnd }));
  await scheduleCapacityAtBaseEnd(
    stripeClient,
    { ...identity, baseEndsAtSeconds: existingEnd + 86_400 },
    prices,
  );
  await resumeCapacityWithBase(stripeClient, identity, prices);
  assert.deepEqual(calls, []);
});

test('resume clears only the cancellation marker owned by this base subscription', async () => {
  const baseEndsAtSeconds = Math.floor(Date.now() / 1_000) + 86_400;
  const { stripeClient, calls, readCapacity } = fixture(capacitySubscription({
    cancel_at: baseEndsAtSeconds,
    metadata: {
      subscription_kind: 'capacity_addons',
      neon_user_id: String(identity.userId),
      app_base_subscription_id: identity.stripeBaseSubscriptionId,
      app_base_cancel_at: String(baseEndsAtSeconds),
    },
  }));
  const result = await resumeCapacityWithBase(stripeClient, identity, prices);
  assert.equal(result.snapshot?.cancelAtSeconds, null);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'update');
  assert.equal(calls[0].params?.cancel_at, '');
  assert.equal(readCapacity()?.metadata.app_base_subscription_id, undefined);
  assert.equal(readCapacity()?.metadata.app_base_cancel_at, undefined);
});

test('a pending increase is voided before existing capacity is scheduled to end', async () => {
  const invoiceId = 'in_pending';
  const { stripeClient, calls } = fixture(capacitySubscription({
    latest_invoice: invoiceId,
    pending_update: { expires_at: Math.floor(Date.now() / 1_000) + 3_600 },
  }));
  const result = await scheduleCapacityAtBaseEnd(
    stripeClient,
    { ...identity, baseEndsAtSeconds: Math.floor(Date.now() / 1_000) + 86_400 },
    prices,
  );
  assert.equal(result.interruptedInvoiceId, invoiceId);
  assert.deepEqual(calls.map((call) => call.name), ['void', 'update']);
  assert.equal(new Set(calls.map((call) => call.idempotencyKey)).size, 2);
});

test('an unpaid initial capacity subscription is canceled instead of renewed', async () => {
  const invoiceId = 'in_initial';
  const { stripeClient, calls } = fixture(capacitySubscription({
    status: 'incomplete',
    latest_invoice: invoiceId,
  }));
  const result = await scheduleCapacityAtBaseEnd(
    stripeClient,
    { ...identity, baseEndsAtSeconds: Math.floor(Date.now() / 1_000) + 86_400 },
    prices,
  );
  assert.equal(result.snapshot?.status, 'canceled');
  assert.equal(result.interruptedInvoiceId, invoiceId);
  assert.deepEqual(calls.map((call) => call.name), ['cancel']);
});

test('base termination voids a pending change before stopping capacity immediately', async () => {
  const invoiceId = 'in_pending';
  const { stripeClient, calls } = fixture(capacitySubscription({
    latest_invoice: invoiceId,
    pending_update: { expires_at: Math.floor(Date.now() / 1_000) + 3_600 },
  }));
  const result = await cancelCapacityAfterBaseEnded(stripeClient, identity, prices);
  assert.equal(result.snapshot?.status, 'canceled');
  assert.equal(result.interruptedInvoiceId, invoiceId);
  assert.deepEqual(calls.map((call) => call.name), ['void', 'cancel']);
});

test('wrong application ownership is rejected before a Stripe write', async () => {
  const { stripeClient, calls } = fixture(capacitySubscription({
    metadata: {
      subscription_kind: 'capacity_addons',
      neon_user_id: '99',
    },
  }));
  await assert.rejects(
    scheduleCapacityAtBaseEnd(
      stripeClient,
      { ...identity, baseEndsAtSeconds: Math.floor(Date.now() / 1_000) + 86_400 },
      prices,
    ),
    /another application account/i,
  );
  assert.deepEqual(calls, []);
});

test('capacity lifecycle keys are stable without exposing Stripe IDs', () => {
  const key = capacityLifecycleIdempotencyKey('schedule-base-end', {
    ...identity,
    stripeCapacitySubscriptionId: 'sub_capacity',
    timestampSeconds: 1_900_000_000,
  });
  assert.equal(capacityLifecycleIdempotencyKey('schedule-base-end', {
    ...identity,
    stripeCapacitySubscriptionId: 'sub_capacity',
    timestampSeconds: 1_900_000_000,
  }), key);
  assert.match(key, /^capacity-schedule-base-end:v1:[0-9a-f]{64}$/);
  assert.equal(key.includes(identity.stripeCustomerId), false);
  assert.equal(key.includes('sub_capacity'), false);
});
