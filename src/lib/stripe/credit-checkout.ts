import { createHash } from 'node:crypto';
import type Stripe from 'stripe';
import { extractStripeId } from './subscription-state';

export type CreditCheckoutType = 'email' | 'ai' | 'topic_search';

export interface CreditCheckoutIdentity {
  operationId: string;
  userId: number;
  stripeCustomerId: string;
  packId: string;
  priceId: string;
  creditType: CreditCheckoutType;
  creditsAmount: number;
}

export type LegacyCreditCheckoutIdentity = Omit<CreditCheckoutIdentity, 'operationId'>;

export function isCreditCheckoutOperationId(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function isStripeCheckoutSessionId(value: unknown): value is string {
  return typeof value === 'string'
    && value.length <= 255
    && /^cs_(?:test_|live_)?[A-Za-z0-9]+$/.test(value);
}

function assertLegacyCreditCheckoutIdentity(input: LegacyCreditCheckoutIdentity): void {
  if (!Number.isSafeInteger(input.userId) || input.userId <= 0) {
    throw new Error('Credit checkout account ID is invalid.');
  }
  if (!/^cus_[A-Za-z0-9]+$/.test(input.stripeCustomerId)) {
    throw new Error('Credit checkout Stripe customer ID is invalid.');
  }
  if (!/^[a-z0-9_]{1,80}$/.test(input.packId)) {
    throw new Error('Credit checkout pack ID is invalid.');
  }
  if (!/^price_[A-Za-z0-9]+$/.test(input.priceId)) {
    throw new Error('Credit checkout Stripe price ID is invalid.');
  }
  if (!['email', 'ai', 'topic_search'].includes(input.creditType)) {
    throw new Error('Credit checkout type is invalid.');
  }
  if (!Number.isSafeInteger(input.creditsAmount) || input.creditsAmount <= 0) {
    throw new Error('Credit checkout amount is invalid.');
  }
}

function assertCreditCheckoutIdentity(input: CreditCheckoutIdentity): void {
  assertLegacyCreditCheckoutIdentity(input);
  if (!isCreditCheckoutOperationId(input.operationId)) {
    throw new Error('Credit checkout operation ID is invalid.');
  }
}

export function creditCheckoutRequestFingerprint(input: CreditCheckoutIdentity): string {
  assertCreditCheckoutIdentity(input);
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

export function creditCheckoutStripeIdempotencyKey(operationId: string): string {
  if (!isCreditCheckoutOperationId(operationId)) {
    throw new Error('Credit checkout operation ID is invalid.');
  }
  return `credit-checkout:v1:${operationId.toLowerCase()}`;
}

function assertCreditCheckoutSessionCommonIdentity(
  session: Stripe.Checkout.Session,
  expected: LegacyCreditCheckoutIdentity,
): void {
  assertLegacyCreditCheckoutIdentity(expected);
  if (session.mode !== 'payment') {
    throw new Error('Stripe credit checkout is not a one-time payment.');
  }
  if (extractStripeId(session.customer) !== expected.stripeCustomerId) {
    throw new Error('Stripe credit checkout belongs to a different customer.');
  }
  if (
    session.metadata?.user_id !== String(expected.userId)
    || session.metadata?.pack_id !== expected.packId
    || session.metadata?.credit_type !== expected.creditType
    || session.metadata?.credits_amount !== String(expected.creditsAmount)
  ) {
    throw new Error('Stripe credit checkout metadata does not match its durable operation.');
  }
  const lineItems = session.line_items?.data;
  if (
    !Array.isArray(lineItems)
    || lineItems.length !== 1
    || session.line_items?.has_more === true
  ) {
    throw new Error('Stripe credit checkout must contain exactly one line item.');
  }
  if (extractStripeId(lineItems[0].price) !== expected.priceId || lineItems[0].quantity !== 1) {
    throw new Error('Stripe credit checkout line item does not match the selected pack.');
  }
  if (!Number.isSafeInteger(session.amount_total) || (session.amount_total ?? 0) <= 0) {
    throw new Error('Stripe credit checkout has no positive total.');
  }
}

export function assertCreditCheckoutSessionIdentity(
  session: Stripe.Checkout.Session,
  expected: CreditCheckoutIdentity,
): void {
  assertCreditCheckoutIdentity(expected);
  assertCreditCheckoutSessionCommonIdentity(session, expected);
  if (session.metadata?.operation_id !== expected.operationId) {
    throw new Error('Stripe credit checkout operation metadata does not match its durable operation.');
  }
}

export function assertLegacyCreditCheckoutSessionIdentity(
  session: Stripe.Checkout.Session,
  expected: LegacyCreditCheckoutIdentity,
): void {
  assertCreditCheckoutSessionCommonIdentity(session, expected);
}

export function assertPaidCreditCheckoutSession(
  session: Stripe.Checkout.Session,
  expected: CreditCheckoutIdentity,
): void {
  assertCreditCheckoutSessionIdentity(session, expected);
  if (session.payment_status !== 'paid') {
    throw new Error('Stripe credit checkout is not paid.');
  }
}

export function assertPaidLegacyCreditCheckoutSession(
  session: Stripe.Checkout.Session,
  expected: LegacyCreditCheckoutIdentity,
): void {
  // Compatibility for payment pages created before the durable operation
  // migration. All server-owned customer, pack and price fields are still
  // verified; only the new operation UUID is absent.
  assertLegacyCreditCheckoutSessionIdentity(session, expected);
  if (session.payment_status !== 'paid') {
    throw new Error('Stripe credit checkout is not paid.');
  }
}
