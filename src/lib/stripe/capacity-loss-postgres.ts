import 'server-only';

import { randomUUID } from 'node:crypto';
import {
  capacitySelectionIdentity,
  type CapacityBasePlan,
} from './capacity-change';
import {
  completeCapacityChangeOperation,
  prepareCapacityChangeOperation,
  type CapacityChangeOperation,
  type CapacityChangeReason,
  type CapacityChangeSql,
} from './capacity-change-postgres';
import {
  effectiveCapacityLimits,
  type PaidCapacityQuantities,
  type StripeCapacitySubscriptionSnapshot,
} from './capacity-subscription';
import {
  prepareAutomaticPaidCapacityLossSelection,
  reconcileAppliedPaidCapacityReduction,
} from './downgrade-capacity-postgres';

type AutomaticCapacityLossReason = Exclude<CapacityChangeReason, 'customer_change'>;

export interface AutomaticCapacityLossResult {
  operation: CapacityChangeOperation | null;
  archivedBrands: number;
  archivedLocations: number;
}

/**
 * Removes an entitlement Stripe has already ended. It never deletes customer
 * data: defaults and oldest rows stay active, while overflow is archived with
 * an immutable operation reference for support and later restoration.
 */
export async function reconcileAutomaticPaidCapacityLoss(
  transaction: CapacityChangeSql,
  input: {
    userId: number;
    stripeCustomerId: string;
    stripeBaseSubscriptionId: string;
    basePlan: CapacityBasePlan;
    previousPaidCapacity: PaidCapacityQuantities;
    snapshot: StripeCapacitySubscriptionSnapshot;
    reason: AutomaticCapacityLossReason;
    operationId?: string;
    occurredAt?: Date;
  },
): Promise<AutomaticCapacityLossResult> {
  if (
    input.snapshot.customerId !== input.stripeCustomerId
    || input.snapshot.subscriptionId.length === 0
  ) {
    throw new Error('Automatic paid-capacity loss failed Stripe ownership validation.');
  }
  if (!['incomplete_expired', 'canceled', 'unpaid'].includes(input.snapshot.status)) {
    throw new Error('Automatic paid-capacity loss requires a terminal Stripe status.');
  }

  const occurredAt = input.occurredAt ?? new Date();
  if (!Number.isFinite(occurredAt.getTime())) {
    throw new Error('Automatic paid-capacity loss timestamp is invalid.');
  }
  const effectiveSeconds = Math.max(1, Math.floor(occurredAt.getTime() / 1000));
  const target = { extraBrands: 0, extraLocations: 0 } as const;
  const limits = effectiveCapacityLimits(input.basePlan, target);
  const prepared = await prepareAutomaticPaidCapacityLossSelection(transaction, {
    userId: input.userId,
    targetLimits: {
      maxBrands: limits.maxBrands,
      maxLocations: limits.maxLocationsPerAccount,
    },
  });
  if (
    !prepared
    || (
      prepared.selection.brandIds.length === prepared.activeBrands
      && prepared.selection.locationIds.length === prepared.activeLocations
    )
  ) {
    return { operation: null, archivedBrands: 0, archivedLocations: 0 };
  }

  // A terminal event can arrive before the earlier active webhook. In that
  // case the private mirror still says zero, but the terminal Stripe snapshot
  // retains the quantities that were actually lost. Using that signed source
  // keeps the repair possible without trusting active-row counts as billing data.
  const from = (
    input.previousPaidCapacity.extraBrands > 0
    || input.previousPaidCapacity.extraLocations > 0
  )
    ? input.previousPaidCapacity
    : {
        extraBrands: input.snapshot.extraBrands,
        extraLocations: input.snapshot.extraLocations,
      };
  if (from.extraBrands === 0 && from.extraLocations === 0) {
    throw new Error('Automatic paid-capacity loss has no prior Stripe capacity to reconcile.');
  }

  const selection = prepared.selection;
  const selectionIdentity = capacitySelectionIdentity(selection ?? undefined);
  const operation = await prepareCapacityChangeOperation(transaction, {
    operationId: input.operationId ?? randomUUID(),
    userId: input.userId,
    stripeCustomerId: input.stripeCustomerId,
    stripeBaseSubscriptionId: input.stripeBaseSubscriptionId,
    basePlan: input.basePlan,
    stripeSubscriptionId: input.snapshot.subscriptionId,
    from,
    to: target,
    prorationDateSeconds: effectiveSeconds,
    ...selectionIdentity,
    reason: input.reason,
    expiresAt: new Date(occurredAt.getTime() + 15 * 60 * 1000).toISOString(),
  });

  let archivedBrands = 0;
  let archivedLocations = 0;
  if (selection) {
    const archived = await reconcileAppliedPaidCapacityReduction(transaction, {
      userId: input.userId,
      operationId: operation.operationId,
      targetLimits: {
        maxBrands: limits.maxBrands,
        maxLocations: limits.maxLocationsPerAccount,
      },
      selection,
    });
    archivedBrands = archived.archivedBrands;
    archivedLocations = archived.archivedLocations;
  }

  const completed = await completeCapacityChangeOperation(transaction, {
    userId: input.userId,
    operationId: operation.operationId,
    stripeSubscriptionId: input.snapshot.subscriptionId,
  });
  return { operation: completed, archivedBrands, archivedLocations };
}
