import assert from 'node:assert/strict';
import test from 'node:test';
import type Stripe from 'stripe';
import {
  initialSubscriptionIdempotencyKey,
  initialSubscriptionAccessState,
  initialTrialDaysForAccount,
  immediateSubscriptionChangeIdempotencyKey,
  initialStripeCustomerIdempotencyKey,
  isReusableInitialSubscriptionStatus,
  latestTerminalSubscriptionId,
  paymentMethodMutationIdempotencyKey,
  recoveredInitialPaymentMethodDecision,
  selectAuthoritativeCustomerSubscription,
  selectSingleApplicationStripeCustomer,
  selectSingleReusableInitialSubscription,
  setupIntentIdempotencyKey,
  subscriptionLifecycleMutationIdempotencyKey,
  isZeroValueTrialStartInvoice,
} from '../../src/lib/stripe/subscription-creation';
import { stripeDowngradeRequestFingerprint } from '../../src/lib/stripe/downgrade-operations';

function subscription(
  id: string,
  status: Stripe.Subscription.Status,
  created = 1_800_000_000,
): Stripe.Subscription {
  return { id, status, created } as Stripe.Subscription;
}

test('offers the configured trial exactly once and validates Stripe limits', () => {
  assert.equal(initialTrialDaysForAccount({
    configuredTrialDays: 3,
    hasCreditRecord: false,
    hasTrialGrant: false,
  }), 3);
  assert.equal(initialTrialDaysForAccount({
    configuredTrialDays: 3,
    hasCreditRecord: true,
    hasTrialGrant: false,
  }), undefined);
  assert.equal(initialTrialDaysForAccount({
    configuredTrialDays: 3,
    hasCreditRecord: false,
    hasTrialGrant: true,
  }), undefined);
  assert.equal(initialTrialDaysForAccount({
    configuredTrialDays: 0,
    hasCreditRecord: false,
    hasTrialGrant: false,
  }), undefined);
  for (const invalid of [-1, 730.5, 731, Number.NaN]) {
    assert.throws(() => initialTrialDaysForAccount({
      configuredTrialDays: invalid,
      hasCreditRecord: false,
      hasTrialGrant: false,
    }), /0 through 730/i);
  }
});

test('keeps incomplete and inactive subscriptions locked until Stripe confirms payment', () => {
  assert.equal(initialSubscriptionAccessState('trialing', false), 'ready');
  assert.equal(initialSubscriptionAccessState('active', false), 'ready');
  assert.equal(
    initialSubscriptionAccessState('incomplete', true),
    'payment_action_required',
  );
  assert.equal(initialSubscriptionAccessState('incomplete', false), 'payment_pending');
  for (const status of ['past_due', 'paused', 'unpaid', 'canceled', 'incomplete_expired'] as const) {
    assert.equal(initialSubscriptionAccessState(status, true), 'blocked');
  }
});

test('allows a declined initial card to be replaced only while the subscription is incomplete', () => {
  assert.equal(recoveredInitialPaymentMethodDecision({
    subscriptionStatus: 'incomplete',
    existingPaymentMethodId: 'pm_declined',
    requestedPaymentMethodId: 'pm_replacement',
  }), 'replace_incomplete');
  assert.equal(recoveredInitialPaymentMethodDecision({
    subscriptionStatus: 'incomplete',
    existingPaymentMethodId: 'pm_same',
    requestedPaymentMethodId: 'pm_same',
  }), 'verified');
  assert.equal(recoveredInitialPaymentMethodDecision({
    subscriptionStatus: 'incomplete',
    existingPaymentMethodId: null,
    requestedPaymentMethodId: 'pm_first',
  }), 'replace_incomplete');
  for (const status of ['active', 'trialing', 'past_due', 'paused', 'unpaid'] as const) {
    assert.equal(recoveredInitialPaymentMethodDecision({
      subscriptionStatus: status,
      existingPaymentMethodId: 'pm_existing',
      requestedPaymentMethodId: 'pm_other',
    }), 'conflict');
  }
  assert.equal(recoveredInitialPaymentMethodDecision({
    subscriptionStatus: 'active',
    existingPaymentMethodId: null,
    requestedPaymentMethodId: 'pm_unverified',
  }), 'conflict');
  assert.throws(() => recoveredInitialPaymentMethodDecision({
    subscriptionStatus: 'incomplete',
    existingPaymentMethodId: 'not-a-payment-method',
    requestedPaymentMethodId: 'pm_replacement',
  }), /existing Stripe payment method ID is invalid/i);
});

test('does not mistake an active zero-value promotion invoice for a trial invoice', () => {
  assert.equal(isZeroValueTrialStartInvoice({
    amountPaid: 0,
    billingReason: 'subscription_create',
    subscriptionStatus: 'trialing',
  }), true);
  assert.equal(isZeroValueTrialStartInvoice({
    amountPaid: 0,
    billingReason: 'subscription_create',
    subscriptionStatus: 'active',
  }), false);
  assert.equal(isZeroValueTrialStartInvoice({
    amountPaid: 100,
    billingReason: 'subscription_create',
    subscriptionStatus: 'trialing',
  }), false);
});

test('initial subscription key is stable and does not vary with request choices', () => {
  const key = initialSubscriptionIdempotencyKey(42, 'cus_test_42');
  assert.equal(initialSubscriptionIdempotencyKey(42, 'cus_test_42'), key);
  assert.notEqual(initialSubscriptionIdempotencyKey(43, 'cus_test_42'), key);
  assert.notEqual(
    initialSubscriptionIdempotencyKey(42, 'cus_test_42', 'sub_canceled'),
    key,
  );
  assert.match(key, /^initial-subscription:v1:[0-9a-f]{64}$/);
  assert.equal(key.includes('cus_test_42'), false);
});

test('payment-method mutation keys are stable and operation-specific', () => {
  const attach = paymentMethodMutationIdempotencyKey('attach', 'cus_test', 'pm_test');
  const repeated = Array.from({ length: 100 }, () =>
    paymentMethodMutationIdempotencyKey('attach', 'cus_test', 'pm_test'));
  assert.equal(new Set(repeated).size, 1);
  assert.equal(repeated[0], attach);
  assert.notEqual(
    attach,
    paymentMethodMutationIdempotencyKey('make-default', 'cus_test', 'pm_test'),
  );
  assert.notEqual(
    attach,
    paymentMethodMutationIdempotencyKey('make-subscription-default', 'cus_test', 'pm_test'),
  );
});

test('subscription lifecycle keys are stable and action-specific', () => {
  const firstRequestId = '018f47a8-1e29-7b88-9a64-3cf87e8aa001';
  const secondRequestId = '018f47a8-1e29-7b88-9a64-3cf87e8aa002';
  const cancel = subscriptionLifecycleMutationIdempotencyKey(
    'cancel-at-period-end',
    'cus_test',
    'sub_test',
    firstRequestId,
  );
  assert.equal(subscriptionLifecycleMutationIdempotencyKey(
    'cancel-at-period-end',
    'cus_test',
    'sub_test',
    firstRequestId,
  ), cancel);
  assert.notEqual(subscriptionLifecycleMutationIdempotencyKey(
    'resume',
    'cus_test',
    'sub_test',
    firstRequestId,
  ), cancel);
  assert.notEqual(subscriptionLifecycleMutationIdempotencyKey(
    'cancel-at-period-end',
    'cus_test',
    'sub_test',
    secondRequestId,
  ), cancel);
  assert.throws(
    () => subscriptionLifecycleMutationIdempotencyKey(
      'resume',
      'cus_test',
      'sub_test',
      'not-a-request-id',
    ),
    /request ID is invalid/i,
  );
  assert.match(cancel, /^subscription-cancel-at-period-end:v1:[0-9a-f]{64}$/);
  assert.equal(cancel.includes('sub_test'), false);
});

test('initial Stripe customer key is stable per application account and contains no account ID', () => {
  const key = initialStripeCustomerIdempotencyKey(42);
  assert.equal(initialStripeCustomerIdempotencyKey(42), key);
  assert.notEqual(initialStripeCustomerIdempotencyKey(43), key);
  assert.match(key, /^initial-stripe-customer:v1:[0-9a-f]{64}$/);
  assert.equal(key.includes(':42'), false);
});

test('SetupIntent keys retry one request but separate later card-setup attempts', () => {
  const firstRequestId = '018f47a8-1e29-7b88-9a64-3cf87e8aa011';
  const secondRequestId = '018f47a8-1e29-7b88-9a64-3cf87e8aa012';
  const first = setupIntentIdempotencyKey(42, 'cus_test', firstRequestId);
  assert.equal(setupIntentIdempotencyKey(42, 'cus_test', firstRequestId), first);
  assert.notEqual(setupIntentIdempotencyKey(42, 'cus_test', secondRequestId), first);
  assert.match(first, /^setup-intent:v1:[0-9a-f]{64}$/);
  assert.equal(first.includes('cus_test'), false);
});

test('recovers exactly one Stripe customer by server-owned application metadata', () => {
  const customer = (id: string, accountId: string) => ({
    id,
    metadata: { neon_user_id: accountId },
  }) as unknown as Stripe.Customer;
  assert.equal(selectSingleApplicationStripeCustomer([
    customer('cus_other', '7'),
    customer('cus_matching', '42'),
  ], false, 42)?.id, 'cus_matching');
  assert.equal(selectSingleApplicationStripeCustomer([], false, 42), null);
  assert.throws(
    () => selectSingleApplicationStripeCustomer([
      customer('cus_one', '42'),
      customer('cus_two', '42'),
    ], false, 42),
    /more than one customer/i,
  );
  assert.throws(
    () => selectSingleApplicationStripeCustomer([], true, 42),
    /truncated customer list/i,
  );
});

test('immediate plan-change key is stable for one source generation and conflicts across destinations', () => {
  const source = {
    accountId: 42,
    stripeCustomerId: 'cus_test',
    stripeSubscriptionId: 'sub_test',
    sourcePriceId: 'price_pro_month',
    sourceStatus: 'active' as const,
    sourcePeriodEndSeconds: 1_802_592_000,
    attachedScheduleId: null,
  };
  const key = immediateSubscriptionChangeIdempotencyKey(source);
  assert.equal(immediateSubscriptionChangeIdempotencyKey(source), key);
  assert.notEqual(immediateSubscriptionChangeIdempotencyKey({
    ...source,
    sourcePriceId: 'price_business_month',
  }), key);
  assert.match(key, /^change-subscription:v1:[0-9a-f]{64}$/);
  assert.equal(key.includes('cus_test'), false);
});

test('reuses exactly one live subscription and ignores terminal subscriptions', () => {
  assert.equal(isReusableInitialSubscriptionStatus('incomplete'), true);
  assert.equal(isReusableInitialSubscriptionStatus('incomplete_expired'), false);
  assert.equal(isReusableInitialSubscriptionStatus('canceled'), false);
  assert.equal(
    selectSingleReusableInitialSubscription([
      subscription('sub_old', 'canceled'),
      subscription('sub_current', 'trialing'),
    ], false)?.id,
    'sub_current',
  );
  assert.equal(
    selectSingleReusableInitialSubscription([
      subscription('sub_old', 'incomplete_expired'),
    ], false),
    null,
  );
  assert.equal(latestTerminalSubscriptionId([
    subscription('sub_older_expired', 'incomplete_expired', 1_700_000_000),
    subscription('sub_latest_canceled', 'canceled', 1_800_000_000),
  ]), 'sub_latest_canceled');
  assert.equal(selectAuthoritativeCustomerSubscription([
    subscription('sub_old_local', 'canceled', 1_900_000_000),
    subscription('sub_new_paid', 'active', 1_800_000_000),
  ], false)?.id, 'sub_new_paid');
  assert.equal(selectAuthoritativeCustomerSubscription([
    subscription('sub_older_expired', 'incomplete_expired', 1_700_000_000),
    subscription('sub_latest_canceled', 'canceled', 1_800_000_000),
  ], false)?.id, 'sub_latest_canceled');
});

test('fails closed for ambiguous or truncated Stripe subscription state', () => {
  assert.throws(
    () => selectSingleReusableInitialSubscription([
      subscription('sub_one', 'active'),
      subscription('sub_two', 'past_due'),
    ], false),
    /more than one live subscription/i,
  );
  assert.throws(
    () => selectSingleReusableInitialSubscription([], true),
    /truncated subscription list/i,
  );
});

test('downgrade fingerprints are stable across harmless keep-list ordering changes', () => {
  const input = {
    userId: 42,
    stripeCustomerId: 'cus_test',
    stripeSubscriptionId: 'sub_test',
    fromPlan: 'business' as const,
    fromBillingInterval: 'monthly' as const,
    sourcePeriodEndSeconds: 1_802_592_000,
    toPlan: 'pro' as const,
    toBillingInterval: 'monthly' as const,
    capacitySelectionVersion: 1 as const,
    retainedBrandIds: ['2', '1'],
    retainedLocationIds: ['20', '10'],
  };
  const fingerprint = stripeDowngradeRequestFingerprint(input);
  assert.equal(fingerprint, stripeDowngradeRequestFingerprint({
    ...input,
    retainedBrandIds: ['1', '2'],
    retainedLocationIds: ['10', '20'],
  }));
  assert.notEqual(fingerprint, stripeDowngradeRequestFingerprint({
    ...input,
    sourcePeriodEndSeconds: input.sourcePeriodEndSeconds + 1,
  }));
});
