import assert from 'node:assert/strict';
import test from 'node:test';
import type Stripe from 'stripe';
import type { StripePaymentMethodUpdateIdentity } from '../../src/lib/stripe/payment-method-update';
import {
  applyStripePaymentMethodUpdate,
  assertStripePaymentMethodUpdateSubscriptionIsCurrent,
  readAuthoritativeStripeSubscriptionForCustomer,
  readConvergedStripePaymentMethodUpdate,
  type PaymentMethodUpdateStripeClient,
} from '../../src/lib/stripe/payment-method-update-server';

test('replayable Stripe card update uses deterministic writes and converges', async () => {
  const calls: Array<{ name: string; idempotencyKey?: string }> = [];
  const input: StripePaymentMethodUpdateIdentity = {
    operationId: '11111111-1111-4111-8111-111111111111',
    userId: 7,
    stripeCustomerId: 'cus_customer123',
    stripeSubscriptionId: 'sub_subscription123',
    stripePaymentMethodId: 'pm_method123',
  };
  const method = {
    id: input.stripePaymentMethodId,
    type: 'card',
    customer: input.stripeCustomerId,
    card: {
      last4: '3184',
      brand: 'visa',
      exp_month: 12,
      exp_year: 2034,
    },
  } as Stripe.PaymentMethod;
  const customer = {
    id: input.stripeCustomerId,
    deleted: false,
    invoice_settings: { default_payment_method: 'pm_old123' },
  } as unknown as Stripe.Customer;
  const subscription = {
    id: input.stripeSubscriptionId,
    customer: input.stripeCustomerId,
    default_payment_method: 'pm_old123',
  } as Stripe.Subscription;
  const fakeStripe = {
    paymentMethods: {
      retrieve: async () => method,
    },
    subscriptions: {
      retrieve: async () => subscription,
      update: async (
        _subscriptionId: string,
        params: { default_payment_method?: string },
        options: { idempotencyKey?: string },
      ) => {
        calls.push({ name: 'subscription', idempotencyKey: options.idempotencyKey });
        subscription.default_payment_method = params.default_payment_method ?? null;
        return subscription;
      },
    },
    customers: {
      retrieve: async () => customer,
      update: async (
        _customerId: string,
        params: Stripe.CustomerUpdateParams,
        options: { idempotencyKey?: string },
      ) => {
        calls.push({ name: 'customer', idempotencyKey: options.idempotencyKey });
        customer.invoice_settings.default_payment_method =
          params.invoice_settings?.default_payment_method ?? null;
        return customer;
      },
    },
  } as unknown as PaymentMethodUpdateStripeClient;

  await applyStripePaymentMethodUpdate(fakeStripe, input);
  assert.deepEqual(calls.map((call) => call.name), [
    'subscription',
    'customer',
  ]);
  assert.equal(new Set(calls.map((call) => call.idempotencyKey)).size, 2);
  assert.deepEqual(
    await readConvergedStripePaymentMethodUpdate(fakeStripe, input),
    { last4: '3184', brand: 'visa', expMonth: 12, expYear: 2034 },
  );

  calls.length = 0;
  await applyStripePaymentMethodUpdate(fakeStripe, input);
  assert.deepEqual(calls.map((call) => call.name), ['subscription', 'customer']);
  assert.match(calls[0].idempotencyKey ?? '', new RegExp(input.operationId));
});

test('an unattached payment method is rejected before any Stripe write', async () => {
  const writes: string[] = [];
  const input: StripePaymentMethodUpdateIdentity = {
    operationId: '11111111-1111-4111-8111-111111111111',
    userId: 7,
    stripeCustomerId: 'cus_customer123',
    stripeSubscriptionId: 'sub_subscription123',
    stripePaymentMethodId: 'pm_method123',
  };
  const fakeStripe = {
    paymentMethods: {
      retrieve: async () => ({
        id: input.stripePaymentMethodId,
        type: 'card',
        customer: null,
        card: { last4: '3184', brand: 'visa', exp_month: 12, exp_year: 2034 },
      } as Stripe.PaymentMethod),
    },
    subscriptions: {
      retrieve: async () => {
        throw new Error('subscription read must not run');
      },
      update: async () => {
        writes.push('subscription');
        throw new Error('subscription write must not run');
      },
    },
    customers: {
      update: async () => {
        writes.push('customer');
        throw new Error('customer write must not run');
      },
    },
  } as unknown as PaymentMethodUpdateStripeClient;

  await assert.rejects(
    applyStripePaymentMethodUpdate(fakeStripe, input),
    /not attached/i,
  );
  assert.deepEqual(writes, []);
});

test('the current Stripe subscription wins over an old local subscription', async () => {
  const oldSubscription = {
    id: 'sub_old123',
    customer: 'cus_customer123',
    status: 'canceled',
    created: 1_900_000_000,
  } as Stripe.Subscription;
  const currentSubscription = {
    id: 'sub_current123',
    customer: 'cus_customer123',
    status: 'active',
    created: 1_800_000_000,
  } as Stripe.Subscription;
  const fakeStripe = {
    subscriptions: {
      list: async () => ({
        data: [oldSubscription, currentSubscription],
        has_more: false,
      }),
    },
  } as unknown as PaymentMethodUpdateStripeClient;

  assert.equal(
    (await readAuthoritativeStripeSubscriptionForCustomer(
      fakeStripe,
      'cus_customer123',
    ))?.id,
    currentSubscription.id,
  );
  await assert.rejects(
    assertStripePaymentMethodUpdateSubscriptionIsCurrent(fakeStripe, {
      stripeCustomerId: 'cus_customer123',
      stripeSubscriptionId: oldSubscription.id,
    }),
    (error: unknown) => (
      error instanceof Error
      && 'code' in error
      && error.code === 'STRIPE_SUBSCRIPTION_NOT_CURRENT'
    ),
  );
  await assert.doesNotReject(
    assertStripePaymentMethodUpdateSubscriptionIsCurrent(fakeStripe, {
      stripeCustomerId: 'cus_customer123',
      stripeSubscriptionId: currentSubscription.id,
    }),
  );
});
