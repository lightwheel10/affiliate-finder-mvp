import 'server-only';

import type postgres from 'postgres';
import type Stripe from 'stripe';
import {
  effectivePaidCapacity,
  snapshotStripeCapacitySubscription,
  type CapacityPriceConfiguration,
} from './capacity-subscription';
import {
  readCapacityBillingOwner,
  readOpenCapacityChangeForStripeEvent,
  type CapacityChangeOperation,
  type CapacityChangeSql,
} from './capacity-change-postgres';
import {
  finalizeAppliedCapacityChange,
  type CapacityChangeDatabase,
} from './capacity-change-finalize-server';

export interface CapacityRecoveryDatabase extends CapacityChangeDatabase {
  <T extends object = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<readonly T[]>;
}

function readAccountId(value: unknown): number {
  const parsed = typeof value === 'string' && /^[1-9][0-9]*$/.test(value)
    ? Number(value)
    : Number.NaN;
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error('Stripe capacity subscription has invalid account metadata.');
  }
  return parsed;
}

function readOperationId(value: unknown): string | null {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

async function findOpenOperation(
  database: CapacityRecoveryDatabase,
  input: {
    userId: number;
    stripeSubscriptionId: string;
    stripeInvoiceId: string;
    metadataOperationId: string | null;
  },
): Promise<CapacityChangeOperation | null> {
  return database.begin(async (rawTransaction: postgres.Sql) => {
    const transaction = rawTransaction as CapacityChangeSql;
    const exact = input.metadataOperationId
      ? await readOpenCapacityChangeForStripeEvent(transaction, {
          ...input,
          operationId: input.metadataOperationId,
        })
      : null;
    return exact ?? readOpenCapacityChangeForStripeEvent(transaction, input);
  });
}

/**
 * Completes a charge that Stripe confirmed after the browser closed or timed
 * out. Ordinary renewal invoices have no open operation and are ignored.
 */
export async function finalizePaidCapacityInvoiceOperation(
  database: CapacityRecoveryDatabase,
  subscription: Stripe.Subscription,
  stripeInvoiceId: string,
  prices: CapacityPriceConfiguration,
): Promise<boolean> {
  const snapshot = snapshotStripeCapacitySubscription(subscription, prices);
  if (!snapshot) return false;
  if (!/^in_[A-Za-z0-9]+$/.test(stripeInvoiceId)) {
    throw new Error('Stripe capacity invoice ID is invalid.');
  }
  const metadata = subscription.metadata;
  const userId = readAccountId(metadata?.neon_user_id);
  const operation = await findOpenOperation(database, {
    userId,
    stripeSubscriptionId: snapshot.subscriptionId,
    stripeInvoiceId,
    metadataOperationId: readOperationId(metadata?.app_capacity_operation_id),
  });
  if (!operation) return true;

  const applied = effectivePaidCapacity(snapshot.status, snapshot);
  if (
    applied.extraBrands !== operation.to.extraBrands
    || applied.extraLocations !== operation.to.extraLocations
  ) {
    throw new Error('Paid capacity invoice succeeded without the operation target becoming authoritative.');
  }
  const owner = await readCapacityBillingOwner(database as unknown as CapacityChangeSql, userId);
  if (!owner) throw new Error('Paid-capacity invoice owner no longer exists.');
  await finalizeAppliedCapacityChange(database, {
    owner,
    operationId: operation.operationId,
    snapshot,
    stripeInvoiceId,
  });
  return true;
}
