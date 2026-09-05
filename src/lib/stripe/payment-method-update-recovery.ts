import 'server-only';

import type Stripe from 'stripe';
import {
  abandonStripePaymentMethodUpdateOperation,
  completeStripePaymentMethodUpdateOperation,
  readPreparedStripePaymentMethodUpdateForCustomer,
  readStripePaymentMethodUpdateOperation,
  StripePaymentMethodUpdateConflictError,
  type StripePaymentMethodUpdateSql,
} from './payment-method-update-postgres';
import { stripePaymentMethodUpdatePermanentFailureCode } from './payment-method-update';
import {
  applyStripePaymentMethodUpdate,
  readConvergedStripePaymentMethodUpdate,
} from './payment-method-update-server';

type PaymentMethodUpdateStripeClient = Pick<
  Stripe,
  'customers' | 'paymentMethods' | 'subscriptions'
>;

/**
 * Replays and completes a database-prepared card update while the caller holds
 * the per-customer advisory lock. If Stripe succeeds but this transaction
 * rolls back, the prepared row remains available to the next request/webhook.
 */
export async function recoverStripePaymentMethodUpdate(
  transaction: StripePaymentMethodUpdateSql,
  stripeClient: PaymentMethodUpdateStripeClient,
  input: {
    userId: number;
    stripeCustomerId: string;
    stripeSubscriptionId: string | null;
    operationId?: string;
  },
): Promise<
  'none' | 'completed' | 'already_completed' | 'abandoned' | 'already_abandoned'
> {
  const operation = input.operationId
    ? await readStripePaymentMethodUpdateOperation(transaction, {
        userId: input.userId,
        operationId: input.operationId,
      })
    : await readPreparedStripePaymentMethodUpdateForCustomer(transaction, {
        userId: input.userId,
        stripeCustomerId: input.stripeCustomerId,
      });
  if (!operation) {
    if (input.operationId) {
      throw new StripePaymentMethodUpdateConflictError(
        'The prepared payment-method update could not be found.',
      );
    }
    return 'none';
  }
  if (operation.stripeCustomerId !== input.stripeCustomerId) {
    throw new StripePaymentMethodUpdateConflictError(
      'The prepared payment-method update belongs to a different Stripe customer.',
    );
  }
  if (operation.stripeSubscriptionId !== input.stripeSubscriptionId) {
    return abandonStripePaymentMethodUpdateOperation(transaction, {
      operation,
      failureCode: 'subscription_changed',
    });
  }
  if (operation.status === 'completed') return 'already_completed';
  if (operation.status === 'abandoned') return 'already_abandoned';

  try {
    await applyStripePaymentMethodUpdate(stripeClient, operation);
    const card = await readConvergedStripePaymentMethodUpdate(stripeClient, operation);
    return completeStripePaymentMethodUpdateOperation(transaction, { operation, card });
  } catch (error) {
    const failureCode = stripePaymentMethodUpdatePermanentFailureCode(error);
    if (!failureCode) throw error;
    return abandonStripePaymentMethodUpdateOperation(transaction, {
      operation,
      failureCode,
    });
  }
}
