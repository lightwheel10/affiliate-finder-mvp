import { createHash } from 'node:crypto';
import type Stripe from 'stripe';
import { extractStripeId } from './subscription-state';

export interface StripePaymentMethodUpdateIdentity {
  operationId: string;
  userId: number;
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  stripePaymentMethodId: string;
}

export interface StripeCardDisplay {
  last4: string;
  brand: string;
  expMonth: number;
  expYear: number;
}

export class StripePaymentMethodUpdateError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'StripePaymentMethodUpdateError';
  }
}

export function isStripePaymentMethodUpdateOperationId(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function assertIdentity(input: StripePaymentMethodUpdateIdentity): void {
  if (!isStripePaymentMethodUpdateOperationId(input.operationId)) {
    throw new Error('Stripe payment-method update operation ID is invalid.');
  }
  if (!Number.isSafeInteger(input.userId) || input.userId <= 0) {
    throw new Error('Stripe payment-method update account ID is invalid.');
  }
  if (!/^cus_[A-Za-z0-9]+$/.test(input.stripeCustomerId)) {
    throw new Error('Stripe payment-method update customer ID is invalid.');
  }
  if (
    input.stripeSubscriptionId !== null
    && !/^sub_[A-Za-z0-9]+$/.test(input.stripeSubscriptionId)
  ) {
    throw new Error('Stripe payment-method update subscription ID is invalid.');
  }
  if (!/^pm_[A-Za-z0-9]+$/.test(input.stripePaymentMethodId)) {
    throw new Error('Stripe payment-method update payment method ID is invalid.');
  }
}

export function stripePaymentMethodUpdateRequestFingerprint(
  input: StripePaymentMethodUpdateIdentity,
): string {
  assertIdentity(input);
  return createHash('sha256').update(JSON.stringify({
    userId: input.userId,
    stripeCustomerId: input.stripeCustomerId,
    stripeSubscriptionId: input.stripeSubscriptionId,
    stripePaymentMethodId: input.stripePaymentMethodId,
  })).digest('hex');
}

export function stripePaymentMethodUpdateIdempotencyKey(
  operationId: string,
  step: 'subscription-default' | 'customer-default',
): string {
  if (!isStripePaymentMethodUpdateOperationId(operationId)) {
    throw new Error('Stripe payment-method update operation ID is invalid.');
  }
  return `payment-method-update:v1:${operationId.toLowerCase()}:${step}`;
}

export function readStripePaymentMethodCard(
  paymentMethod: Stripe.PaymentMethod,
  expectedCustomerId: string,
): StripeCardDisplay {
  const attachedCustomerId = extractStripeId(paymentMethod.customer);
  if (attachedCustomerId && attachedCustomerId !== expectedCustomerId) {
    throw new StripePaymentMethodUpdateError(
      'STRIPE_CUSTOMER_MISMATCH',
      403,
      'This payment method belongs to a different Stripe customer.',
    );
  }
  if (!attachedCustomerId) {
    throw new StripePaymentMethodUpdateError(
      'PAYMENT_METHOD_NOT_ATTACHED',
      409,
      'The payment method is not attached to the expected Stripe customer.',
    );
  }
  if (paymentMethod.type !== 'card' || !paymentMethod.card) {
    throw new StripePaymentMethodUpdateError(
      'PAYMENT_METHOD_NOT_CARD',
      400,
      'Only card payment methods are supported.',
    );
  }
  return {
    last4: paymentMethod.card.last4,
    brand: paymentMethod.card.brand,
    expMonth: paymentMethod.card.exp_month,
    expYear: paymentMethod.card.exp_year,
  };
}

/**
 * Only deterministic provider or ownership failures may retire an operation.
 * Network, rate-limit and convergence errors stay prepared so Stripe can retry.
 */
export function stripePaymentMethodUpdatePermanentFailureCode(
  error: unknown,
): string | null {
  if (error instanceof StripePaymentMethodUpdateError) {
    if (error.code === 'STRIPE_PAYMENT_METHOD_UPDATE_NOT_CONVERGED') return null;
    return error.code.toLowerCase();
  }

  if (!error || typeof error !== 'object' || !('type' in error)) return null;
  const stripeErrorType = (error as { type?: unknown }).type;
  if (typeof stripeErrorType !== 'string') return null;
  const permanentStripeErrors = new Set([
    'StripeAuthenticationError',
    'StripeCardError',
    'StripeIdempotencyError',
    'StripeInvalidRequestError',
    'StripePermissionError',
  ]);
  return permanentStripeErrors.has(stripeErrorType)
    ? stripeErrorType.replace(/^Stripe/, '').replace(/Error$/, '').toLowerCase()
    : null;
}

/**
 * Refuses to publish local card details until Stripe's customer and current
 * subscription both point at the exact durable operation target.
 */
export function assertStripePaymentMethodUpdateConverged(
  operation: StripePaymentMethodUpdateIdentity,
  customer: Stripe.Customer | Stripe.DeletedCustomer,
  subscription: Stripe.Subscription | null,
  paymentMethod: Stripe.PaymentMethod,
): StripeCardDisplay {
  assertIdentity(operation);
  if (customer.deleted || customer.id !== operation.stripeCustomerId) {
    throw new StripePaymentMethodUpdateError(
      'STRIPE_PAYMENT_METHOD_UPDATE_NOT_CONVERGED',
      409,
      'Stripe customer state is not available for this payment-method update.',
    );
  }
  if (
    extractStripeId(customer.invoice_settings.default_payment_method)
    !== operation.stripePaymentMethodId
  ) {
    throw new StripePaymentMethodUpdateError(
      'STRIPE_PAYMENT_METHOD_UPDATE_NOT_CONVERGED',
      409,
      'Stripe has not made this card the customer default yet.',
    );
  }
  if (operation.stripeSubscriptionId !== null) {
    if (
      !subscription
      || subscription.id !== operation.stripeSubscriptionId
      || extractStripeId(subscription.customer) !== operation.stripeCustomerId
      || extractStripeId(subscription.default_payment_method)
        !== operation.stripePaymentMethodId
    ) {
      throw new StripePaymentMethodUpdateError(
        'STRIPE_PAYMENT_METHOD_UPDATE_NOT_CONVERGED',
        409,
        'Stripe has not made this card the subscription default yet.',
      );
    }
  } else if (subscription !== null) {
    throw new StripePaymentMethodUpdateError(
      'STRIPE_PAYMENT_METHOD_UPDATE_NOT_CONVERGED',
      409,
      'Unexpected Stripe subscription state was returned for this update.',
    );
  }
  if (paymentMethod.id !== operation.stripePaymentMethodId) {
    throw new StripePaymentMethodUpdateError(
      'STRIPE_PAYMENT_METHOD_UPDATE_NOT_CONVERGED',
      409,
      'Stripe returned a different payment method than the durable update target.',
    );
  }
  return readStripePaymentMethodCard(paymentMethod, operation.stripeCustomerId);
}
