import assert from 'node:assert/strict';
import test from 'node:test';
import type Stripe from 'stripe';
import {
  assertStripePaymentMethodUpdateConverged,
  readStripePaymentMethodCard,
  stripePaymentMethodUpdatePermanentFailureCode,
  stripePaymentMethodUpdateIdempotencyKey,
  stripePaymentMethodUpdateRequestFingerprint,
  type StripePaymentMethodUpdateIdentity,
} from '../../src/lib/stripe/payment-method-update';

function operation(
  operationId = '11111111-1111-4111-8111-111111111111',
): StripePaymentMethodUpdateIdentity {
  return {
    operationId,
    userId: 7,
    stripeCustomerId: 'cus_customer123',
    stripeSubscriptionId: 'sub_subscription123',
    stripePaymentMethodId: 'pm_method123',
  };
}

function paymentMethod(customer: string | null = 'cus_customer123'): Stripe.PaymentMethod {
  return {
    id: 'pm_method123',
    type: 'card',
    customer,
    card: {
      last4: '3184',
      brand: 'visa',
      exp_month: 12,
      exp_year: 2034,
    },
  } as Stripe.PaymentMethod;
}

test('payment-method operation fingerprint is stable while Stripe writes are operation-scoped', () => {
  const first = operation();
  const retry = operation('22222222-2222-4222-8222-222222222222');
  assert.equal(
    stripePaymentMethodUpdateRequestFingerprint(first),
    stripePaymentMethodUpdateRequestFingerprint(retry),
  );
  assert.notEqual(
    stripePaymentMethodUpdateIdempotencyKey(first.operationId, 'customer-default'),
    stripePaymentMethodUpdateIdempotencyKey(retry.operationId, 'customer-default'),
  );
  assert.notEqual(
    stripePaymentMethodUpdateIdempotencyKey(first.operationId, 'customer-default'),
    stripePaymentMethodUpdateIdempotencyKey(first.operationId, 'subscription-default'),
  );
});

test('card validation requires customer ownership before mutation', () => {
  assert.throws(
    () => readStripePaymentMethodCard(paymentMethod(null), 'cus_customer123'),
    /not attached/i,
  );
  assert.throws(
    () => readStripePaymentMethodCard(paymentMethod('cus_other123'), 'cus_customer123'),
    /different Stripe customer/i,
  );
  assert.throws(
    () => readStripePaymentMethodCard({
      ...paymentMethod(),
      type: 'sepa_debit',
      card: undefined,
    } as unknown as Stripe.PaymentMethod, 'cus_customer123'),
    /only card payment methods/i,
  );
});

test('only deterministic Stripe failures abandon a durable update', () => {
  assert.equal(
    stripePaymentMethodUpdatePermanentFailureCode({ type: 'StripeInvalidRequestError' }),
    'invalidrequest',
  );
  assert.equal(
    stripePaymentMethodUpdatePermanentFailureCode({ type: 'StripeConnectionError' }),
    null,
  );
  assert.equal(
    stripePaymentMethodUpdatePermanentFailureCode(
      new Error('unknown internal failure'),
    ),
    null,
  );
});

test('local card data is accepted only after customer and subscription defaults agree', () => {
  const input = operation();
  const customer = {
    id: input.stripeCustomerId,
    deleted: false,
    invoice_settings: { default_payment_method: input.stripePaymentMethodId },
  } as unknown as Stripe.Customer;
  const subscription = {
    id: input.stripeSubscriptionId,
    customer: input.stripeCustomerId,
    default_payment_method: input.stripePaymentMethodId,
  } as Stripe.Subscription;
  assert.deepEqual(
    assertStripePaymentMethodUpdateConverged(
      input,
      customer,
      subscription,
      paymentMethod(),
    ),
    { last4: '3184', brand: 'visa', expMonth: 12, expYear: 2034 },
  );
  assert.throws(
    () => assertStripePaymentMethodUpdateConverged(
      input,
      customer,
      { ...subscription, default_payment_method: 'pm_old123' } as Stripe.Subscription,
      paymentMethod(),
    ),
    /subscription default/i,
  );
  assert.throws(
    () => assertStripePaymentMethodUpdateConverged(
      input,
      {
        ...customer,
        invoice_settings: { default_payment_method: 'pm_old123' },
      } as Stripe.Customer,
      subscription,
      paymentMethod(),
    ),
    /customer default/i,
  );
});
