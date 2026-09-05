import 'server-only';

import type Stripe from 'stripe';
import {
  assertStripePaymentMethodUpdateConverged,
  readStripePaymentMethodCard,
  StripePaymentMethodUpdateError,
  stripePaymentMethodUpdateIdempotencyKey,
  type StripeCardDisplay,
  type StripePaymentMethodUpdateIdentity,
} from './payment-method-update';
import { selectAuthoritativeCustomerSubscription } from './subscription-creation';
import { extractStripeId } from './subscription-state';

export type PaymentMethodUpdateStripeClient = Pick<
  Stripe,
  'customers' | 'paymentMethods' | 'subscriptions'
>;

/** Resolves the one subscription Stripe currently considers authoritative. */
export async function readAuthoritativeStripeSubscriptionForCustomer(
  stripeClient: PaymentMethodUpdateStripeClient,
  stripeCustomerId: string,
): Promise<Stripe.Subscription | null> {
  const subscriptions = await stripeClient.subscriptions.list({
    customer: stripeCustomerId,
    status: 'all',
    limit: 100,
  });
  const subscription = selectAuthoritativeCustomerSubscription(
    subscriptions.data,
    subscriptions.has_more,
  );
  if (subscription && extractStripeId(subscription.customer) !== stripeCustomerId) {
    throw new StripePaymentMethodUpdateError(
      'STRIPE_SUBSCRIPTION_MISMATCH',
      409,
      'Stripe returned a subscription for a different customer.',
    );
  }
  return subscription;
}

export async function assertStripePaymentMethodUpdateSubscriptionIsCurrent(
  stripeClient: PaymentMethodUpdateStripeClient,
  input: { stripeCustomerId: string; stripeSubscriptionId: string | null },
): Promise<void> {
  const current = await readAuthoritativeStripeSubscriptionForCustomer(
    stripeClient,
    input.stripeCustomerId,
  );
  if ((current?.id ?? null) !== input.stripeSubscriptionId) {
    throw new StripePaymentMethodUpdateError(
      'STRIPE_SUBSCRIPTION_NOT_CURRENT',
      409,
      'Billing is still synchronizing with Stripe. Please retry the card update.',
    );
  }
}

/**
 * Replays every external step from one durable operation. Each Stripe write has
 * an operation-scoped idempotency key, so request retries and webhook recovery
 * converge instead of creating a second side effect.
 */
export async function applyStripePaymentMethodUpdate(
  stripeClient: PaymentMethodUpdateStripeClient,
  operation: StripePaymentMethodUpdateIdentity,
): Promise<void> {
  const paymentMethod = await stripeClient.paymentMethods.retrieve(
    operation.stripePaymentMethodId,
  );
  readStripePaymentMethodCard(paymentMethod, operation.stripeCustomerId);

  // The subscription is updated before the customer. Therefore the final
  // customer.updated event is emitted only after both invoice defaults agree.
  if (operation.stripeSubscriptionId) {
    const subscription = await stripeClient.subscriptions.retrieve(
      operation.stripeSubscriptionId,
    );
    if (extractStripeId(subscription.customer) !== operation.stripeCustomerId) {
      throw new StripePaymentMethodUpdateError(
        'STRIPE_SUBSCRIPTION_MISMATCH',
        409,
        'The Stripe subscription belongs to a different customer.',
      );
    }
    await stripeClient.subscriptions.update(
      operation.stripeSubscriptionId,
      { default_payment_method: operation.stripePaymentMethodId },
      {
        idempotencyKey: stripePaymentMethodUpdateIdempotencyKey(
          operation.operationId,
          'subscription-default',
        ),
      },
    );
  }

  await stripeClient.customers.update(
    operation.stripeCustomerId,
    { invoice_settings: { default_payment_method: operation.stripePaymentMethodId } },
    {
      idempotencyKey: stripePaymentMethodUpdateIdempotencyKey(
        operation.operationId,
        'customer-default',
      ),
    },
  );
}

/** Reads Stripe again after mutation; local state must use this fresh truth. */
export async function readConvergedStripePaymentMethodUpdate(
  stripeClient: PaymentMethodUpdateStripeClient,
  operation: StripePaymentMethodUpdateIdentity,
): Promise<StripeCardDisplay> {
  const [customer, subscription, paymentMethod] = await Promise.all([
    stripeClient.customers.retrieve(operation.stripeCustomerId),
    operation.stripeSubscriptionId
      ? stripeClient.subscriptions.retrieve(operation.stripeSubscriptionId)
      : Promise.resolve(null),
    stripeClient.paymentMethods.retrieve(operation.stripePaymentMethodId),
  ]);
  return assertStripePaymentMethodUpdateConverged(
    operation,
    customer,
    subscription,
    paymentMethod,
  );
}
