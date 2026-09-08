import 'server-only';

import type postgres from 'postgres';
import {
  effectiveCapacityLimits,
  effectivePaidCapacity,
  type StripeCapacitySubscriptionSnapshot,
} from './capacity-subscription';
import {
  assertNoPendingBasePlanChange,
  completeCapacityChangeOperation,
  lockCapacityBillingOwner,
  readCapacityChangeOperation,
  type CapacityBillingOwner,
  type CapacityChangeOperation,
  type CapacityChangeSql,
} from './capacity-change-postgres';
import { capacityChangeDirection } from './capacity-change';
import { reconcileAppliedPaidCapacityReduction } from './downgrade-capacity-postgres';
import { persistStripeCapacitySubscriptionSnapshot } from './capacity-subscription-postgres';

export interface CapacityChangeDatabase {
  begin<T>(operation: (transaction: postgres.Sql) => Promise<T>): Promise<T>;
}

export interface FinalizedCapacityChange {
  operation: CapacityChangeOperation;
  archivedBrands: number;
  archivedLocations: number;
}

/**
 * Transaction-scoped finalizer shared by the browser route and Stripe webhook.
 * The caller may already hold these locks; PostgreSQL safely reuses them.
 */
export async function finalizeAppliedCapacityChangeInTransaction(
  transaction: CapacityChangeSql,
  input: {
    owner: CapacityBillingOwner;
    operationId: string;
    snapshot: StripeCapacitySubscriptionSnapshot;
    stripeInvoiceId?: string | null;
  },
): Promise<FinalizedCapacityChange> {
  const owner = await lockCapacityBillingOwner(transaction, input.owner);
  await assertNoPendingBasePlanChange(transaction, owner.userId);
  const operation = await readCapacityChangeOperation(transaction, {
    userId: owner.userId,
    operationId: input.operationId,
  });
  if (!operation || operation.status === 'canceled') {
    throw new Error('Paid-capacity operation is missing or canceled.');
  }
  const appliedQuantities = effectivePaidCapacity(input.snapshot.status, input.snapshot);
  if (
    operation.stripeCustomerId !== input.snapshot.customerId
    || (
      operation.stripeSubscriptionId !== null
      && operation.stripeSubscriptionId !== input.snapshot.subscriptionId
    )
    || operation.to.extraBrands !== appliedQuantities.extraBrands
    || operation.to.extraLocations !== appliedQuantities.extraLocations
  ) {
    throw new Error('Applied Stripe capacity does not match the durable operation.');
  }
  if (
    operation.stripeInvoiceId
    && input.stripeInvoiceId
    && operation.stripeInvoiceId !== input.stripeInvoiceId
  ) {
    throw new Error('Applied Stripe invoice does not match the durable operation.');
  }

  await persistStripeCapacitySubscriptionSnapshot(
    transaction,
    owner.userId,
    input.snapshot,
  );

  let archivedBrands = 0;
  let archivedLocations = 0;
  if (capacityChangeDirection(operation.from, operation.to) === 'decrease') {
    if (
      operation.capacitySelectionVersion !== 1
      || !operation.retainedBrandIds
      || !operation.retainedLocationIds
    ) {
      throw new Error('Paid-capacity reduction is missing its required keep-list.');
    }
    const effectiveLimits = effectiveCapacityLimits(owner.plan, operation.to);
    const archived = await reconcileAppliedPaidCapacityReduction(transaction, {
      userId: owner.userId,
      operationId: operation.operationId,
      targetLimits: {
        maxBrands: effectiveLimits.maxBrands,
        maxLocations: effectiveLimits.maxLocationsPerAccount,
      },
      selection: {
        brandIds: [...operation.retainedBrandIds],
        locationIds: [...operation.retainedLocationIds],
      },
    });
    archivedBrands = archived.archivedBrands;
    archivedLocations = archived.archivedLocations;
  }

  const completed = await completeCapacityChangeOperation(transaction, {
    userId: owner.userId,
    operationId: operation.operationId,
    stripeSubscriptionId: input.snapshot.subscriptionId,
    stripeInvoiceId: input.stripeInvoiceId,
  });
  return { operation: completed, archivedBrands, archivedLocations };
}

/**
 * Publishes Stripe's applied result, any required recoverable archives and the
 * operation completion in one PostgreSQL transaction. A browser timeout can
 * safely retry this function without deleting data or applying a second bill.
 */
export async function finalizeAppliedCapacityChange(
  database: CapacityChangeDatabase,
  input: Parameters<typeof finalizeAppliedCapacityChangeInTransaction>[1],
): Promise<FinalizedCapacityChange> {
  return database.begin(async (rawTransaction) => {
    return finalizeAppliedCapacityChangeInTransaction(
      rawTransaction as CapacityChangeSql,
      input,
    );
  });
}
