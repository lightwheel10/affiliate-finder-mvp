import { createHash } from 'node:crypto';
import type Stripe from 'stripe';

const REUSABLE_INITIAL_SUBSCRIPTION_STATUSES = new Set<Stripe.Subscription.Status>([
  'active',
  'incomplete',
  'past_due',
  'paused',
  'trialing',
  'unpaid',
]);

const MAX_STRIPE_TRIAL_DAYS = 730;

export type InitialSubscriptionAccessState =
  | 'ready'
  | 'payment_action_required'
  | 'payment_pending'
  | 'blocked';

export type RecoveredInitialPaymentMethodDecision =
  | 'verified'
  | 'replace_incomplete'
  | 'conflict';

/**
 * Returns the trial length only when this is genuinely the account's first
 * entitlement. Existing credit rows are durable evidence too: they cover old
 * paid accounts whose trial audit rows may predate the current ledger.
 */
export function initialTrialDaysForAccount(input: {
  configuredTrialDays: number;
  hasCreditRecord: boolean;
  hasTrialGrant: boolean;
}): number | undefined {
  if (
    !Number.isSafeInteger(input.configuredTrialDays)
    || input.configuredTrialDays < 0
    || input.configuredTrialDays > MAX_STRIPE_TRIAL_DAYS
  ) {
    throw new Error('Stripe trial days must be an integer from 0 through 730.');
  }
  if (
    input.configuredTrialDays === 0
    || input.hasCreditRecord
    || input.hasTrialGrant
  ) {
    return undefined;
  }
  return input.configuredTrialDays;
}

/**
 * Stripe is the access authority. An incomplete first invoice may be resolved
 * in the browser when a confirmation secret exists, but it never grants app
 * access until Stripe moves the subscription to active.
 */
export function initialSubscriptionAccessState(
  status: Stripe.Subscription.Status,
  hasConfirmationSecret: boolean,
): InitialSubscriptionAccessState {
  if (status === 'active' || status === 'trialing') return 'ready';
  if (status === 'incomplete') {
    return hasConfirmationSecret ? 'payment_action_required' : 'payment_pending';
  }
  return 'blocked';
}

/**
 * A failed first invoice must remain recoverable with a new card. Stripe keeps
 * that subscription `incomplete`, so the browser should confirm its existing
 * PaymentIntent with the replacement payment method instead of creating a
 * second subscription. Once a subscription is active/trialing, a different
 * card belongs to the normal payment-method update flow and is a conflict here.
 */
export function recoveredInitialPaymentMethodDecision(input: {
  subscriptionStatus: Stripe.Subscription.Status;
  existingPaymentMethodId: string | null;
  requestedPaymentMethodId: string;
}): RecoveredInitialPaymentMethodDecision {
  if (!/^pm_[A-Za-z0-9_]+$/.test(input.requestedPaymentMethodId)) {
    throw new Error('Requested Stripe payment method ID is invalid.');
  }
  if (
    input.existingPaymentMethodId !== null
    && !/^pm_[A-Za-z0-9_]+$/.test(input.existingPaymentMethodId)
  ) {
    throw new Error('Existing Stripe payment method ID is invalid.');
  }
  if (input.existingPaymentMethodId === input.requestedPaymentMethodId) {
    return 'verified';
  }
  return input.subscriptionStatus === 'incomplete'
    ? 'replace_incomplete'
    : 'conflict';
}

/** A zero-value subscription-create invoice is a trial invoice only while Stripe says trialing. */
export function isZeroValueTrialStartInvoice(input: {
  amountPaid: number;
  billingReason: string | null;
  subscriptionStatus: Stripe.Subscription.Status;
}): boolean {
  return input.amountPaid === 0
    && input.billingReason === 'subscription_create'
    && input.subscriptionStatus === 'trialing';
}

/**
 * A single Stripe idempotency namespace is reserved for the first subscription
 * owned by one application account/customer pair. The key intentionally omits
 * plan and card details: two concurrent requests with different inputs must
 * conflict at Stripe rather than create two chargeable subscriptions.
 */
export function initialSubscriptionIdempotencyKey(
  accountId: number,
  stripeCustomerId: string,
  priorTerminalSubscriptionId: string | null = null,
): string {
  if (!Number.isSafeInteger(accountId) || accountId <= 0) {
    throw new Error('Application account ID is invalid.');
  }
  if (!/^cus_[A-Za-z0-9_]+$/.test(stripeCustomerId)) {
    throw new Error('Stripe customer ID is invalid.');
  }
  if (
    priorTerminalSubscriptionId !== null
    && !/^sub_[A-Za-z0-9_]+$/.test(priorTerminalSubscriptionId)
  ) {
    throw new Error('Prior Stripe subscription ID is invalid.');
  }
  const digest = createHash('sha256')
    .update(
      `initial-subscription:v1:${accountId}:${stripeCustomerId}:${priorTerminalSubscriptionId ?? 'none'}`,
    )
    .digest('hex');
  return `initial-subscription:v1:${digest}`;
}

export function paymentMethodMutationIdempotencyKey(
  operation: 'attach' | 'make-default' | 'make-subscription-default',
  stripeCustomerId: string,
  paymentMethodId: string,
): string {
  if (!/^cus_[A-Za-z0-9_]+$/.test(stripeCustomerId)) {
    throw new Error('Stripe customer ID is invalid.');
  }
  if (!/^pm_[A-Za-z0-9_]+$/.test(paymentMethodId)) {
    throw new Error('Stripe payment method ID is invalid.');
  }
  const digest = createHash('sha256')
    .update(`${operation}:v1:${stripeCustomerId}:${paymentMethodId}`)
    .digest('hex');
  return `${operation}:v1:${digest}`;
}

export function subscriptionLifecycleMutationIdempotencyKey(
  operation: 'cancel-at-period-end' | 'resume',
  stripeCustomerId: string,
  stripeSubscriptionId: string,
  requestId: string,
): string {
  if (!/^cus_[A-Za-z0-9_]+$/.test(stripeCustomerId)) {
    throw new Error('Stripe customer ID is invalid.');
  }
  if (!/^sub_[A-Za-z0-9_]+$/.test(stripeSubscriptionId)) {
    throw new Error('Stripe subscription ID is invalid.');
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
    throw new Error('Subscription lifecycle request ID is invalid.');
  }
  const digest = createHash('sha256')
    .update(JSON.stringify({
      operation,
      stripeCustomerId,
      stripeSubscriptionId,
      requestId: requestId.toLowerCase(),
    }))
    .digest('hex');
  return `subscription-${operation}:v1:${digest}`;
}

export function initialStripeCustomerIdempotencyKey(accountId: number): string {
  if (!Number.isSafeInteger(accountId) || accountId <= 0) {
    throw new Error('Application account ID is invalid.');
  }
  const digest = createHash('sha256')
    .update(`initial-stripe-customer:v1:${accountId}`)
    .digest('hex');
  return `initial-stripe-customer:v1:${digest}`;
}

export function setupIntentIdempotencyKey(
  accountId: number,
  stripeCustomerId: string,
  requestId: string,
): string {
  if (!Number.isSafeInteger(accountId) || accountId <= 0) {
    throw new Error('Application account ID is invalid.');
  }
  if (!/^cus_[A-Za-z0-9_]+$/.test(stripeCustomerId)) {
    throw new Error('Stripe customer ID is invalid.');
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
    throw new Error('SetupIntent request ID is invalid.');
  }
  const digest = createHash('sha256')
    .update(`setup-intent:v1:${accountId}:${stripeCustomerId}:${requestId.toLowerCase()}`)
    .digest('hex');
  return `setup-intent:v1:${digest}`;
}

export function selectSingleApplicationStripeCustomer(
  customers: readonly Stripe.Customer[],
  hasMore: boolean,
  accountId: number,
): Stripe.Customer | null {
  if (!Number.isSafeInteger(accountId) || accountId <= 0) {
    throw new Error('Application account ID is invalid.');
  }
  if (hasMore) {
    throw new Error('Stripe returned a truncated customer list; refusing to guess which customer belongs to this account.');
  }
  const matching = customers.filter((customer) =>
    customer.metadata.neon_user_id === String(accountId));
  if (matching.length > 1) {
    throw new Error('Stripe has more than one customer for this application account.');
  }
  return matching[0] ?? null;
}

export interface ImmediateSubscriptionChangeIdentity {
  accountId: number;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  sourcePriceId: string;
  sourceStatus: Stripe.Subscription.Status;
  sourcePeriodEndSeconds: number | null;
  attachedScheduleId: string | null;
}

/**
 * Identifies one immediate plan-change generation from Stripe's current state.
 * The requested destination is deliberately omitted: competing requests that
 * start from the same source state must conflict at Stripe instead of applying
 * two chargeable changes. Once Stripe changes the source state, a later genuine
 * customer choice receives a new key.
 */
export function immediateSubscriptionChangeIdempotencyKey(
  input: ImmediateSubscriptionChangeIdentity,
): string {
  if (!Number.isSafeInteger(input.accountId) || input.accountId <= 0) {
    throw new Error('Application account ID is invalid.');
  }
  if (!/^cus_[A-Za-z0-9_]+$/.test(input.stripeCustomerId)) {
    throw new Error('Stripe customer ID is invalid.');
  }
  if (!/^sub_[A-Za-z0-9_]+$/.test(input.stripeSubscriptionId)) {
    throw new Error('Stripe subscription ID is invalid.');
  }
  if (!/^price_[A-Za-z0-9_]+$/.test(input.sourcePriceId)) {
    throw new Error('Stripe source price ID is invalid.');
  }
  if (
    input.sourcePeriodEndSeconds !== null
    && (!Number.isSafeInteger(input.sourcePeriodEndSeconds) || input.sourcePeriodEndSeconds <= 0)
  ) {
    throw new Error('Stripe source billing-period end is invalid.');
  }
  if (
    input.attachedScheduleId !== null
    && !/^sub_sched_[A-Za-z0-9_]+$/.test(input.attachedScheduleId)
  ) {
    throw new Error('Stripe subscription schedule ID is invalid.');
  }

  const digest = createHash('sha256')
    .update(JSON.stringify(input))
    .digest('hex');
  return `change-subscription:v1:${digest}`;
}

export function isReusableInitialSubscriptionStatus(
  status: Stripe.Subscription.Status,
): boolean {
  return REUSABLE_INITIAL_SUBSCRIPTION_STATUSES.has(status);
}

/**
 * Fail closed when Stripe contains more than one live subscription. Picking one
 * would hide a possible double charge and make the database disagreement worse.
 */
export function selectSingleReusableInitialSubscription(
  subscriptions: readonly Stripe.Subscription[],
  hasMore: boolean,
): Stripe.Subscription | null {
  if (hasMore) {
    throw new Error('Stripe returned a truncated subscription list; refusing to guess which subscription is current.');
  }
  const reusable = subscriptions.filter((subscription) =>
    isReusableInitialSubscriptionStatus(subscription.status));
  if (reusable.length > 1) {
    throw new Error('Stripe has more than one live subscription for this customer.');
  }
  return reusable[0] ?? null;
}

export function latestTerminalSubscriptionId(
  subscriptions: readonly Stripe.Subscription[],
): string | null {
  const terminal = subscriptions.filter((subscription) =>
    !isReusableInitialSubscriptionStatus(subscription.status));
  if (terminal.length === 0) return null;

  let latest = terminal[0];
  if (!Number.isSafeInteger(latest.created) || latest.created <= 0) {
    throw new Error('Stripe terminal subscription has an invalid creation timestamp.');
  }
  for (const subscription of terminal.slice(1)) {
    if (!Number.isSafeInteger(subscription.created) || subscription.created <= 0) {
      throw new Error('Stripe terminal subscription has an invalid creation timestamp.');
    }
    if (subscription.created > latest.created) latest = subscription;
  }
  return latest.id;
}

/**
 * Chooses Stripe's current subscription without trusting a possibly stale local
 * subscription ID. A live subscription always wins; otherwise the newest
 * terminal subscription is the authoritative closed state.
 */
export function selectAuthoritativeCustomerSubscription(
  subscriptions: readonly Stripe.Subscription[],
  hasMore: boolean,
): Stripe.Subscription | null {
  const reusable = selectSingleReusableInitialSubscription(subscriptions, hasMore);
  if (reusable) return reusable;
  const terminalId = latestTerminalSubscriptionId(subscriptions);
  return terminalId === null
    ? null
    : subscriptions.find((subscription) => subscription.id === terminalId) ?? null;
}
