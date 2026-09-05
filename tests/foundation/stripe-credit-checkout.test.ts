import assert from 'node:assert/strict';
import test from 'node:test';
import type Stripe from 'stripe';
import {
  assertPaidCreditCheckoutSession,
  assertPaidLegacyCreditCheckoutSession,
  creditCheckoutRequestFingerprint,
  creditCheckoutStripeIdempotencyKey,
  isCreditCheckoutOperationId,
  isStripeCheckoutSessionId,
  type CreditCheckoutIdentity,
} from '../../src/lib/stripe/credit-checkout';

const identity: CreditCheckoutIdentity = {
  operationId: '4d8ddfac-842f-4b3e-9ccd-94d18f77a57c',
  userId: 42,
  stripeCustomerId: 'cus_test123',
  packId: 'search_5',
  priceId: 'price_test123',
  creditType: 'topic_search',
  creditsAmount: 5,
};

function paidSession(overrides: Record<string, unknown> = {}): Stripe.Checkout.Session {
  return {
    id: 'cs_test_session123',
    mode: 'payment',
    payment_status: 'paid',
    customer: identity.stripeCustomerId,
    amount_total: 500,
    metadata: {
      operation_id: identity.operationId,
      user_id: String(identity.userId),
      pack_id: identity.packId,
      credit_type: identity.creditType,
      credits_amount: String(identity.creditsAmount),
    },
    line_items: {
      data: [{ price: { id: identity.priceId }, quantity: 1 }],
    },
    ...overrides,
  } as unknown as Stripe.Checkout.Session;
}

test('credit checkout identity produces stable secret-free request keys', () => {
  const fingerprint = creditCheckoutRequestFingerprint(identity);
  assert.equal(creditCheckoutRequestFingerprint(identity), fingerprint);
  assert.match(fingerprint, /^[0-9a-f]{64}$/);
  const key = creditCheckoutStripeIdempotencyKey(identity.operationId);
  assert.equal(key, `credit-checkout:v1:${identity.operationId}`);
  assert.equal(key.includes(identity.stripeCustomerId), false);
  assert.equal(isCreditCheckoutOperationId(identity.operationId), true);
  assert.equal(isCreditCheckoutOperationId('not-a-uuid'), false);
  assert.equal(isStripeCheckoutSessionId('cs_test_session123'), true);
  assert.equal(isStripeCheckoutSessionId('pi_test_session123'), false);
});

test('paid credit checkout must match customer, metadata, price and quantity', () => {
  assert.doesNotThrow(() => assertPaidCreditCheckoutSession(paidSession(), identity));
  assert.throws(() => assertPaidCreditCheckoutSession(
    paidSession({ customer: 'cus_attacker' }),
    identity,
  ), /different customer/i);
  assert.throws(() => assertPaidCreditCheckoutSession(
    paidSession({ metadata: { ...paidSession().metadata, user_id: '7' } }),
    identity,
  ), /metadata/i);
  assert.throws(() => assertPaidCreditCheckoutSession(
    paidSession({ line_items: { data: [{ price: { id: 'price_wrong' }, quantity: 1 }] } }),
    identity,
  ), /line item/i);
  assert.throws(() => assertPaidCreditCheckoutSession(
    paidSession({ line_items: { data: [{ price: { id: identity.priceId }, quantity: 1 }], has_more: true } }),
    identity,
  ), /exactly one line item/i);
  assert.throws(() => assertPaidCreditCheckoutSession(
    paidSession({ payment_status: 'unpaid' }),
    identity,
  ), /not paid/i);
});

test('legacy paid sessions retain strict customer, pack and price validation', () => {
  const legacyIdentity = {
    userId: identity.userId,
    stripeCustomerId: identity.stripeCustomerId,
    packId: identity.packId,
    priceId: identity.priceId,
    creditType: identity.creditType,
    creditsAmount: identity.creditsAmount,
  };
  const legacySession = paidSession({
    metadata: {
      user_id: String(identity.userId),
      pack_id: identity.packId,
      credit_type: identity.creditType,
      credits_amount: String(identity.creditsAmount),
    },
  });
  assert.doesNotThrow(() => assertPaidLegacyCreditCheckoutSession(legacySession, legacyIdentity));
  assert.throws(() => assertPaidLegacyCreditCheckoutSession(
    legacySession,
    { ...legacyIdentity, stripeCustomerId: 'cus_another' },
  ), /different customer/i);
});
