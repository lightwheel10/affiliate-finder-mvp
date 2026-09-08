import assert from 'node:assert/strict';
import test from 'node:test';
import type Stripe from 'stripe';
import {
  applyCapacityChange,
  previewCapacityInvoice,
  readAuthoritativeCapacityBillingState,
  readCapacityBaseSubscriptionState,
  readCapacityChangeOutcome,
  retryPendingCapacityInvoicePayment,
  type CapacityChangeStripeClient,
} from '../../src/lib/stripe/capacity-change-server';
import type { PaidCapacityQuantities } from '../../src/lib/stripe/capacity-subscription';

const prices = {
  extraBrandMonthly: 'price_brand',
  extraLocationMonthly: 'price_location',
};
const operationId = '11111111-1111-4111-8111-111111111111';
const basePrices = {
  proMonthly: 'price_pro_month',
  proAnnual: 'price_pro_year',
  businessMonthly: 'price_business_month',
  businessAnnual: 'price_business_year',
};

function price(id: string, amount: number): Stripe.Price {
  return {
    id,
    active: true,
    billing_scheme: 'per_unit',
    currency: 'eur',
    type: 'recurring',
    unit_amount: amount,
    unit_amount_decimal: String(amount),
    transform_quantity: null,
    recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' },
  } as Stripe.Price;
}

function items(quantities: PaidCapacityQuantities): Stripe.SubscriptionItem[] {
  return [
    ...(quantities.extraBrands > 0 ? [{
      id: 'si_brand',
      price: price('price_brand', 2_500),
      quantity: quantities.extraBrands,
      current_period_end: 1_802_592_000,
    } as Stripe.SubscriptionItem] : []),
    ...(quantities.extraLocations > 0 ? [{
      id: 'si_location',
      price: price('price_location', 1_000),
      quantity: quantities.extraLocations,
      current_period_end: 1_802_592_000,
    } as Stripe.SubscriptionItem] : []),
  ];
}

function capacitySubscription(
  quantities: PaidCapacityQuantities,
  overrides: Partial<Stripe.Subscription> = {},
): Stripe.Subscription {
  return {
    id: 'sub_capacity',
    customer: 'cus_account',
    status: 'active',
    created: 1_800_000_000,
    collection_method: 'charge_automatically',
    discounts: [],
    metadata: {
      subscription_kind: 'capacity_addons',
      neon_user_id: '42',
    },
    items: {
      object: 'list',
      has_more: false,
      url: '/v1/subscription_items',
      data: items(quantities),
    },
    latest_invoice: {
      id: 'in_capacity',
      confirmation_secret: { client_secret: 'pi_capacity_secret_confirm' },
    } as Stripe.Invoice,
    pending_update: null,
    cancel_at: null,
    cancel_at_period_end: false,
    ...overrides,
  } as Stripe.Subscription;
}

function customer(): Stripe.Customer {
  return {
    id: 'cus_account',
    deleted: false,
    discount: null,
  } as unknown as Stripe.Customer;
}

function baseSubscription(overrides: Partial<Stripe.Subscription> = {}): Stripe.Subscription {
  return {
    id: 'sub_base',
    customer: 'cus_account',
    status: 'active',
    collection_method: 'charge_automatically',
    cancel_at_period_end: false,
    pending_update: null,
    schedule: null,
    metadata: { plan: 'pro', billing_interval: 'monthly' },
    items: {
      object: 'list',
      has_more: false,
      url: '/v1/subscription_items',
      data: [{
        id: 'si_base',
        price: { id: 'price_pro_month', recurring: { interval: 'month' } },
      } as Stripe.SubscriptionItem],
    },
    ...overrides,
  } as Stripe.Subscription;
}

test('base plan eligibility is verified from the configured Stripe price', async () => {
  const active = baseSubscription();
  const fakeStripe = {
    subscriptions: { retrieve: async () => active },
  } as unknown as CapacityChangeStripeClient;
  assert.deepEqual(await readCapacityBaseSubscriptionState(fakeStripe, {
    stripeSubscriptionId: 'sub_base',
    stripeCustomerId: 'cus_account',
    prices: basePrices,
  }), {
    plan: 'pro',
    status: 'active',
    canIncrease: true,
    hasPendingPlanChange: false,
  });

  active.cancel_at_period_end = true;
  assert.equal((await readCapacityBaseSubscriptionState(fakeStripe, {
    stripeSubscriptionId: 'sub_base',
    stripeCustomerId: 'cus_account',
    prices: basePrices,
  })).canIncrease, false);

  active.cancel_at_period_end = false;
  active.pending_update = {
    expires_at: 1_800_003_600,
    subscription_items: [],
    trial_end: null,
    trial_from_plan: false,
    billing_cycle_anchor: null,
  };
  const pending = await readCapacityBaseSubscriptionState(fakeStripe, {
    stripeSubscriptionId: 'sub_base',
    stripeCustomerId: 'cus_account',
    prices: basePrices,
  });
  assert.equal(pending.canIncrease, false);
  assert.equal(pending.hasPendingPlanChange, true);
});

test('authoritative read validates products, customer and the isolated subscription', async () => {
  const capacity = capacitySubscription({ extraBrands: 2, extraLocations: 4 });
  const fakeStripe = {
    customers: { retrieve: async () => customer() },
    prices: {
      retrieve: async (id: string) => id === 'price_brand'
        ? price(id, 2_500)
        : price(id, 1_000),
    },
    subscriptions: {
      list: async () => ({ data: [capacity], has_more: false }),
      retrieve: async () => capacity,
    },
  } as unknown as CapacityChangeStripeClient;

  const state = await readAuthoritativeCapacityBillingState(
    fakeStripe,
    'cus_account',
    prices,
  );
  assert.equal(state.current?.extraBrands, 2);
  assert.equal(state.current?.extraLocations, 4);
  assert.equal(state.currentSubscription?.id, 'sub_capacity');
});

test('invoice preview returns only verified EUR amounts with no inherited discount', async () => {
  const fakeStripe = {
    invoices: {
      createPreview: async (params: Stripe.InvoiceCreatePreviewParams) => {
        assert.equal(params.discounts, '');
        assert.equal(params.subscription_details?.proration_date, 1_800_000_000);
        return {
          customer: 'cus_account',
          currency: 'eur',
          amount_due: 2_100,
          total: 2_100,
          total_discount_amounts: [],
          lines: {
            data: [{
              amount: 2_100,
              discount_amounts: [],
              parent: { subscription_item_details: { proration: true } },
            }],
          },
        } as unknown as Stripe.Invoice;
      },
    },
  } as unknown as CapacityChangeStripeClient;
  const quote = await previewCapacityInvoice(fakeStripe, {
    stripeCustomerId: 'cus_account',
    current: {
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
    },
    target: { extraBrands: 3, extraLocations: 5 },
    prorationDateSeconds: 1_800_000_000,
    prices,
  });
  assert.deepEqual(quote, {
    currency: 'eur',
    amountDueNowCents: 2_100,
    totalCents: 2_100,
    prorationCents: 2_100,
    monthlySubtotalCents: 12_500,
  });
});

test('zero-capacity invoice preview simulates canceling the subscription', async () => {
  const previewCalls: Stripe.InvoiceCreatePreviewParams[] = [];
  const fakeStripe = {
    invoices: {
      createPreview: async (params: Stripe.InvoiceCreatePreviewParams) => {
        previewCalls.push(params);
        return {
          customer: 'cus_account',
          currency: 'eur',
          amount_due: 0,
          total: -2_000,
          total_discount_amounts: [],
          lines: {
            data: [{
              amount: -2_000,
              discount_amounts: [],
              parent: { subscription_item_details: { proration: true } },
            }],
          },
        } as unknown as Stripe.Invoice;
      },
    },
  } as unknown as CapacityChangeStripeClient;

  const quote = await previewCapacityInvoice(fakeStripe, {
    stripeCustomerId: 'cus_account',
    current: {
      subscriptionId: 'sub_capacity',
      customerId: 'cus_account',
      status: 'active',
      brandItemId: null,
      locationItemId: 'si_location',
      extraBrands: 0,
      extraLocations: 2,
      currentPeriodEndSeconds: 1_802_592_000,
      cancelAtSeconds: null,
      cancelAtPeriodEnd: false,
    },
    target: { extraBrands: 0, extraLocations: 0 },
    prorationDateSeconds: 1_800_000_000,
    prices,
  });

  assert.deepEqual(previewCalls[0]?.subscription_details, {
    cancel_now: true,
    proration_behavior: 'always_invoice',
  });
  assert.deepEqual(quote, {
    currency: 'eur',
    amountDueNowCents: 0,
    totalCents: -2_000,
    prorationCents: -2_000,
    monthlySubtotalCents: 0,
  });
});

test('new subscription is payment-gated and returns its 3DS confirmation secret', async () => {
  const incomplete = capacitySubscription(
    { extraBrands: 1, extraLocations: 2 },
    { status: 'incomplete' },
  );
  const calls: Array<{ params: Stripe.SubscriptionCreateParams; key?: string }> = [];
  const fakeStripe = {
    subscriptions: {
      create: async (
        params: Stripe.SubscriptionCreateParams,
        options: Stripe.RequestOptions,
      ) => {
        calls.push({ params, key: options.idempotencyKey });
        return incomplete;
      },
      retrieve: async () => incomplete,
    },
  } as unknown as CapacityChangeStripeClient;

  const result = await applyCapacityChange(fakeStripe, {
    operationId,
    userId: 42,
    stripeCustomerId: 'cus_account',
    current: null,
    target: { extraBrands: 1, extraLocations: 2 },
    prorationDateSeconds: 1_800_000_000,
    prices,
  });
  assert.equal(result.status, 'pending_payment');
  assert.equal(result.clientSecret, 'pi_capacity_secret_confirm');
  assert.match(calls[0].key ?? '', new RegExp(operationId));
  assert.equal(calls[0].params.payment_behavior, 'default_incomplete');
});

test('increase remains pending until Stripe applies the exact target', async () => {
  const currentSubscription = capacitySubscription({ extraBrands: 2, extraLocations: 4 });
  const pending = capacitySubscription(
    { extraBrands: 2, extraLocations: 4 },
    {
      pending_update: {
        expires_at: 1_800_086_400,
        billing_cycle_anchor: null,
        trial_end: null,
        trial_from_plan: false,
        subscription_items: items({ extraBrands: 3, extraLocations: 5 }),
      },
    },
  );
  const updateCalls: Stripe.SubscriptionUpdateParams[] = [];
  const fakeStripe = {
    subscriptions: {
      update: async (_id: string, params: Stripe.SubscriptionUpdateParams) => {
        updateCalls.push(params);
        return pending;
      },
      retrieve: async () => pending,
    },
  } as unknown as CapacityChangeStripeClient;

  const result = await applyCapacityChange(fakeStripe, {
    operationId,
    userId: 42,
    stripeCustomerId: 'cus_account',
    current: {
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
    },
    target: { extraBrands: 3, extraLocations: 5 },
    prorationDateSeconds: 1_800_000_000,
    prices,
  });
  assert.equal(result.status, 'pending_payment');
  assert.equal(result.pendingExpiresAtSeconds, 1_800_086_400);
  const updateParams = updateCalls[0];
  assert.ok(updateParams);
  assert.equal(updateParams.payment_behavior, 'pending_if_incomplete');
  assert.equal(updateParams.proration_date, 1_800_000_000);
  assert.equal(currentSubscription.id, pending.id);
});

test('pure reduction applies immediately and removes a zero-quantity item', async () => {
  const reduced = capacitySubscription({ extraBrands: 0, extraLocations: 3 });
  const updateCalls: Stripe.SubscriptionUpdateParams[] = [];
  const fakeStripe = {
    subscriptions: {
      update: async (_id: string, params: Stripe.SubscriptionUpdateParams) => {
        updateCalls.push(params);
        return reduced;
      },
      retrieve: async () => reduced,
    },
  } as unknown as CapacityChangeStripeClient;
  const result = await applyCapacityChange(fakeStripe, {
    operationId,
    userId: 42,
    stripeCustomerId: 'cus_account',
    current: {
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
    },
    target: { extraBrands: 0, extraLocations: 3 },
    prorationDateSeconds: 1_800_000_000,
    prices,
  });
  assert.equal(result.status, 'applied');
  const updateParams = updateCalls[0];
  assert.ok(updateParams);
  assert.equal(updateParams.payment_behavior, 'allow_incomplete');
  assert.deepEqual(updateParams.items, [
    { id: 'si_brand', deleted: true },
    { id: 'si_location', quantity: 3 },
  ]);
});

test('removing the last capacity item cancels instead of creating an empty subscription', async () => {
  const canceled = capacitySubscription(
    { extraBrands: 0, extraLocations: 2 },
    { status: 'canceled' },
  );
  let updateCalled = false;
  let cancelCall: {
    id: string;
    params: Stripe.SubscriptionCancelParams;
    key?: string;
  } | null = null;
  const fakeStripe = {
    subscriptions: {
      update: async () => {
        updateCalled = true;
        throw new Error('update must not run');
      },
      cancel: async (
        id: string,
        params: Stripe.SubscriptionCancelParams,
        options: Stripe.RequestOptions,
      ) => {
        cancelCall = { id, params, key: options.idempotencyKey };
        return canceled;
      },
    },
  } as unknown as CapacityChangeStripeClient;

  const result = await applyCapacityChange(fakeStripe, {
    operationId,
    userId: 42,
    stripeCustomerId: 'cus_account',
    current: {
      subscriptionId: 'sub_capacity',
      customerId: 'cus_account',
      status: 'active',
      brandItemId: null,
      locationItemId: 'si_location',
      extraBrands: 0,
      extraLocations: 2,
      currentPeriodEndSeconds: 1_802_592_000,
      cancelAtSeconds: null,
      cancelAtPeriodEnd: false,
    },
    target: { extraBrands: 0, extraLocations: 0 },
    prorationDateSeconds: 1_800_000_000,
    prices,
  });

  assert.equal(updateCalled, false);
  assert.deepEqual(cancelCall, {
    id: 'sub_capacity',
    params: {
      invoice_now: true,
      prorate: true,
      expand: ['latest_invoice'],
    },
    key: `capacity-change:v1:${operationId}:cancel`,
  });
  assert.equal(result.status, 'applied');
  assert.equal(result.snapshot.status, 'canceled');
});

test('a mismatched Stripe pending update is never treated as this request', async () => {
  const pending = capacitySubscription(
    { extraBrands: 2, extraLocations: 4 },
    {
      pending_update: {
        expires_at: 1_800_086_400,
        billing_cycle_anchor: null,
        trial_end: null,
        trial_from_plan: false,
        subscription_items: items({ extraBrands: 9, extraLocations: 9 }),
      },
    },
  );
  const fakeStripe = {
    subscriptions: {
      update: async () => pending,
      retrieve: async () => pending,
    },
  } as unknown as CapacityChangeStripeClient;
  await assert.rejects(applyCapacityChange(fakeStripe, {
    operationId,
    userId: 42,
    stripeCustomerId: 'cus_account',
    current: {
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
    },
    target: { extraBrands: 3, extraLocations: 5 },
    prorationDateSeconds: 1_800_000_000,
    prices,
  }), /does not match the requested quantities/i);
});

test('a canceled zero-capacity operation is recoverable after a route timeout', async () => {
  const canceled = capacitySubscription(
    { extraBrands: 2, extraLocations: 4 },
    { status: 'canceled' },
  );
  const fakeStripe = {
    subscriptions: { retrieve: async () => canceled },
  } as unknown as CapacityChangeStripeClient;
  const result = await readCapacityChangeOutcome(fakeStripe, {
    stripeSubscriptionId: 'sub_capacity',
    stripeCustomerId: 'cus_account',
    target: { extraBrands: 0, extraLocations: 0 },
    prices,
  });
  assert.equal(result.status, 'applied');
  assert.equal(result.snapshot.status, 'canceled');
});

test('an open capacity invoice retries with the customer current default card', async () => {
  const calls: Array<{ paymentMethod?: string; key?: string }> = [];
  const currentCustomer = {
    ...customer(),
    invoice_settings: { default_payment_method: 'pm_replacement' },
  } as Stripe.Customer;
  const fakeStripe = {
    invoices: {
      retrieve: async () => ({
        id: 'in_pending',
        customer: 'cus_account',
        status: 'open',
      } as Stripe.Invoice),
      pay: async (
        _id: string,
        params: Stripe.InvoicePayParams,
        options: Stripe.RequestOptions,
      ) => {
        calls.push({
          paymentMethod: params.payment_method,
          key: options.idempotencyKey,
        });
        return { id: 'in_pending', status: 'paid' } as Stripe.Invoice;
      },
    },
  } as unknown as CapacityChangeStripeClient;

  await retryPendingCapacityInvoicePayment(fakeStripe, {
    operationId,
    stripeInvoiceId: 'in_pending',
    stripeCustomerId: 'cus_account',
    customer: currentCustomer,
  });

  assert.deepEqual(calls, [{
    paymentMethod: 'pm_replacement',
    key: `capacity-payment-retry:v1:${operationId}:pm_replacement`,
  }]);
});

test('a declined replacement card keeps the capacity operation recoverable', async () => {
  const currentCustomer = {
    ...customer(),
    invoice_settings: { default_payment_method: 'pm_declined' },
  } as Stripe.Customer;
  const fakeStripe = {
    invoices: {
      retrieve: async () => ({
        id: 'in_pending',
        customer: 'cus_account',
        status: 'open',
      } as Stripe.Invoice),
      pay: async () => {
        throw { type: 'StripeCardError' };
      },
    },
  } as unknown as CapacityChangeStripeClient;

  await assert.doesNotReject(retryPendingCapacityInvoicePayment(fakeStripe, {
    operationId,
    stripeInvoiceId: 'in_pending',
    stripeCustomerId: 'cus_account',
    customer: currentCustomer,
  }));
});

test('a pending capacity invoice cannot be retried for another customer', async () => {
  const currentCustomer = {
    ...customer(),
    invoice_settings: { default_payment_method: 'pm_replacement' },
  } as Stripe.Customer;
  const fakeStripe = {
    invoices: {
      retrieve: async () => ({
        id: 'in_pending',
        customer: 'cus_other',
        status: 'open',
      } as Stripe.Invoice),
      pay: async () => {
        throw new Error('payment must not run');
      },
    },
  } as unknown as CapacityChangeStripeClient;

  await assert.rejects(retryPendingCapacityInvoicePayment(fakeStripe, {
    operationId,
    stripeInvoiceId: 'in_pending',
    stripeCustomerId: 'cus_account',
    customer: currentCustomer,
  }), /another Stripe customer/i);
});
