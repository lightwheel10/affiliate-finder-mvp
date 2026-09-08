import 'server-only';

import type postgres from 'postgres';
import type Stripe from 'stripe';
import {
  effectivePaidCapacity,
  selectAuthoritativeCapacitySubscription,
  snapshotStripeCapacitySubscription,
  type CapacityPriceConfiguration,
  type PaidCapacityQuantities,
} from './capacity-subscription';
import {
  cancelCapacityChangeOperation,
  lockCapacityBillingOwner,
  readCapacityBillingOwner,
  readOpenCapacityChangeForStripeEvent,
  type CapacityChangeOperation,
  type CapacityChangeSql,
} from './capacity-change-postgres';
import { finalizeAppliedCapacityChangeInTransaction } from './capacity-change-finalize-server';
import { readEffectivePaidCapacity } from './capacity-entitlements-postgres';
import { reconcileAutomaticPaidCapacityLoss } from './capacity-loss-postgres';
import { persistStripeCapacitySubscriptionSnapshot } from './capacity-subscription-postgres';

export { persistStripeCapacitySubscriptionSnapshot } from './capacity-subscription-postgres';

export type CapacitySubscriptionSyncSql = postgres.Sql;
export type CapacitySubscriptionSyncStripeClient = Pick<Stripe, 'subscriptions'>;

export interface CapacitySubscriptionSyncDatabase {
  begin<T>(
    operation: (transaction: CapacitySubscriptionSyncSql) => Promise<T>,
  ): Promise<T>;
}

const TERMINAL_CAPACITY_STATUSES = new Set(['incomplete_expired', 'canceled', 'unpaid']);
const TERMINAL_BASE_STATUSES = new Set(['incomplete_expired', 'canceled', 'unpaid']);

function sameCapacity(
  left: PaidCapacityQuantities,
  right: PaidCapacityQuantities,
): boolean {
  return left.extraBrands === right.extraBrands
    && left.extraLocations === right.extraLocations;
}

function metadataOperationId(value: unknown): string | null {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

async function readOpenOperation(
  transaction: CapacityChangeSql,
  input: {
    userId: number;
    stripeSubscriptionId: string;
    metadataOperationId: string | null;
  },
): Promise<CapacityChangeOperation | null> {
  const exact = input.metadataOperationId
    ? await readOpenCapacityChangeForStripeEvent(transaction, {
        userId: input.userId,
        stripeSubscriptionId: input.stripeSubscriptionId,
        operationId: input.metadataOperationId,
      })
    : null;
  return exact ?? readOpenCapacityChangeForStripeEvent(transaction, {
    userId: input.userId,
    stripeSubscriptionId: input.stripeSubscriptionId,
  });
}

/**
 * Synchronizes the customer's separate paid-capacity subscription, if this
 * event belongs to one. Base-plan credits and plan fields are intentionally
 * untouched. The same customer advisory lock serializes both subscription
 * types so delayed Stripe events cannot publish contradictory state.
 */
export async function synchronizeStripeCapacitySubscription(
  database: CapacitySubscriptionSyncDatabase,
  stripeClient: CapacitySubscriptionSyncStripeClient,
  eventSubscription: Stripe.Subscription,
  prices: CapacityPriceConfiguration,
): Promise<boolean> {
  const eventSnapshot = snapshotStripeCapacitySubscription(eventSubscription, prices);
  if (!eventSnapshot) return false;

  const customerId = eventSnapshot.customerId;
  await database.begin(async (transaction) => {
    await transaction`
      SELECT pg_advisory_xact_lock(
        hashtextextended(${`stripe-subscription:${customerId}`}, 0)
      )
    `;

    const owners = await transaction<{
      user_id: number;
      stripe_customer_id: string;
    }[]>`
      SELECT user_id, stripe_customer_id
      FROM crewcast.subscriptions
      WHERE stripe_customer_id = ${customerId}
      ORDER BY id
      LIMIT 2
    `;
    if (owners.length !== 1) {
      throw new Error(
        `Expected one application account for Stripe capacity customer ${customerId}; found ${owners.length}.`,
      );
    }

    const accounts = await transaction<{ id: number }[]>`
      SELECT id
      FROM crewcast.users
      WHERE id = ${owners[0].user_id}
      LIMIT 2
      FOR UPDATE
    `;
    if (accounts.length !== 1 || accounts[0].id !== owners[0].user_id) {
      throw new Error(`Application account for Stripe capacity customer ${customerId} no longer exists.`);
    }

    const expectedOwner = await readCapacityBillingOwner(
      transaction as CapacityChangeSql,
      owners[0].user_id,
    );
    if (!expectedOwner || expectedOwner.stripeCustomerId !== customerId) {
      throw new Error(`Stripe capacity customer ${customerId} changed owner while being synchronized.`);
    }
    const owner = await lockCapacityBillingOwner(
      transaction as CapacityChangeSql,
      expectedOwner,
    );
    const previousPaidCapacity = await readEffectivePaidCapacity(
      transaction as CapacityChangeSql,
      { userId: owner.userId, stripeCustomerId: customerId },
    );

    const customerSubscriptions = await stripeClient.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 100,
    });
    const authoritative = selectAuthoritativeCapacitySubscription(
      customerSubscriptions.data,
      customerSubscriptions.has_more,
      prices,
    );
    if (!authoritative) {
      throw new Error(`Stripe capacity subscription ${eventSubscription.id} is no longer discoverable.`);
    }

    const current = await stripeClient.subscriptions.retrieve(authoritative.id);
    const snapshot = snapshotStripeCapacitySubscription(current, prices);
    if (!snapshot || snapshot.customerId !== customerId) {
      throw new Error(`Stripe capacity subscription ${authoritative.id} failed ownership validation.`);
    }
    if (current.metadata.neon_user_id !== String(owner.userId)) {
      throw new Error(`Stripe capacity subscription ${snapshot.subscriptionId} has invalid account metadata.`);
    }

    const openOperation = await readOpenOperation(transaction as CapacityChangeSql, {
      userId: owner.userId,
      stripeSubscriptionId: snapshot.subscriptionId,
      metadataOperationId: metadataOperationId(current.metadata.app_capacity_operation_id),
    });
    const appliedCapacity = effectivePaidCapacity(snapshot.status, snapshot);
    if (openOperation && sameCapacity(openOperation.to, appliedCapacity)) {
      await finalizeAppliedCapacityChangeInTransaction(transaction as CapacityChangeSql, {
        owner,
        operationId: openOperation.operationId,
        snapshot,
      });
      return;
    }

    if (openOperation && TERMINAL_CAPACITY_STATUSES.has(snapshot.status)) {
      await cancelCapacityChangeOperation(transaction as CapacityChangeSql, {
        userId: owner.userId,
        operationId: openOperation.operationId,
      });
    }

    await persistStripeCapacitySubscriptionSnapshot(
      transaction,
      owner.userId,
      snapshot,
    );

    if (TERMINAL_CAPACITY_STATUSES.has(snapshot.status)) {
      await reconcileAutomaticPaidCapacityLoss(transaction as CapacityChangeSql, {
        userId: owner.userId,
        stripeCustomerId: owner.stripeCustomerId,
        stripeBaseSubscriptionId: owner.stripeSubscriptionId,
        basePlan: owner.plan,
        previousPaidCapacity,
        snapshot,
        reason: TERMINAL_BASE_STATUSES.has(owner.status)
          ? 'base_ended'
          : 'payment_failure',
      });
    }
  });

  return true;
}
