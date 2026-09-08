import 'server-only';

import { createHash } from 'node:crypto';
import type Stripe from 'stripe';
import {
  selectAuthoritativeCapacitySubscription,
  snapshotStripeCapacitySubscription,
  type CapacityPriceConfiguration,
  type StripeCapacitySubscriptionSnapshot,
} from './capacity-subscription';
import { extractInvoiceSubscriptionId, extractStripeId } from './subscription-state';

const BASE_CANCEL_AT_METADATA_KEY = 'app_base_cancel_at';
const BASE_SUBSCRIPTION_METADATA_KEY = 'app_base_subscription_id';
const TERMINAL_CAPACITY_STATUSES = new Set([
  'incomplete_expired',
  'canceled',
  'unpaid',
]);

export type CapacityLifecycleStripeClient = Pick<
  Stripe,
  'subscriptions' | 'invoices'
>;

export interface CapacityLifecycleIdentity {
  userId: number;
  stripeCustomerId: string;
  stripeBaseSubscriptionId: string;
}

export interface CapacityLifecycleResult {
  snapshot: StripeCapacitySubscriptionSnapshot | null;
  interruptedInvoiceId: string | null;
}

interface OwnedCapacitySubscription {
  subscription: Stripe.Subscription;
  snapshot: StripeCapacitySubscriptionSnapshot;
}

type CapacityLifecycleAction =
  | 'void-pending-change'
  | 'cancel-incomplete'
  | 'schedule-base-end'
  | 'clear-base-end'
  | 'cancel-base-ended';

function assertIdentity(input: CapacityLifecycleIdentity): void {
  if (!Number.isSafeInteger(input.userId) || input.userId <= 0) {
    throw new Error('Paid-capacity lifecycle account ID is invalid.');
  }
  if (!/^cus_[A-Za-z0-9]+$/.test(input.stripeCustomerId)) {
    throw new Error('Paid-capacity lifecycle customer ID is invalid.');
  }
  if (!/^sub_[A-Za-z0-9]+$/.test(input.stripeBaseSubscriptionId)) {
    throw new Error('Paid-capacity lifecycle base subscription ID is invalid.');
  }
}

function assertFutureTimestamp(value: number): void {
  if (!Number.isSafeInteger(value) || value <= Math.floor(Date.now() / 1_000)) {
    throw new Error('Paid-capacity lifecycle cancellation date must be in the future.');
  }
}

export function capacityLifecycleIdempotencyKey(
  action: CapacityLifecycleAction,
  input: CapacityLifecycleIdentity & {
    stripeCapacitySubscriptionId: string;
    timestampSeconds?: number;
    stripeInvoiceId?: string;
  },
): string {
  assertIdentity(input);
  if (!/^sub_[A-Za-z0-9]+$/.test(input.stripeCapacitySubscriptionId)) {
    throw new Error('Paid-capacity lifecycle subscription ID is invalid.');
  }
  if (
    input.timestampSeconds !== undefined
    && (!Number.isSafeInteger(input.timestampSeconds) || input.timestampSeconds <= 0)
  ) {
    throw new Error('Paid-capacity lifecycle timestamp is invalid.');
  }
  if (input.stripeInvoiceId !== undefined && !/^in_[A-Za-z0-9]+$/.test(input.stripeInvoiceId)) {
    throw new Error('Paid-capacity lifecycle invoice ID is invalid.');
  }
  const digest = createHash('sha256').update(JSON.stringify({
    action,
    userId: input.userId,
    stripeCustomerId: input.stripeCustomerId,
    stripeBaseSubscriptionId: input.stripeBaseSubscriptionId,
    stripeCapacitySubscriptionId: input.stripeCapacitySubscriptionId,
    timestampSeconds: input.timestampSeconds ?? null,
    stripeInvoiceId: input.stripeInvoiceId ?? null,
  })).digest('hex');
  return `capacity-${action}:v1:${digest}`;
}

async function readOwnedCapacitySubscription(
  stripeClient: CapacityLifecycleStripeClient,
  input: CapacityLifecycleIdentity,
  prices: CapacityPriceConfiguration,
): Promise<OwnedCapacitySubscription | null> {
  assertIdentity(input);
  const subscriptions = await stripeClient.subscriptions.list({
    customer: input.stripeCustomerId,
    status: 'all',
    limit: 100,
  });
  const selected = selectAuthoritativeCapacitySubscription(
    subscriptions.data,
    subscriptions.has_more,
    prices,
  );
  if (!selected) return null;

  const subscription = await stripeClient.subscriptions.retrieve(selected.id);
  const snapshot = snapshotStripeCapacitySubscription(subscription, prices);
  if (!snapshot || snapshot.customerId !== input.stripeCustomerId) {
    throw new Error('Stripe capacity lifecycle subscription failed ownership validation.');
  }
  if (subscription.metadata.neon_user_id !== String(input.userId)) {
    throw new Error('Stripe capacity lifecycle subscription belongs to another application account.');
  }
  return { subscription, snapshot };
}

function latestInvoiceId(subscription: Stripe.Subscription): string | null {
  return extractStripeId(subscription.latest_invoice);
}

async function voidPendingCapacityChange(
  stripeClient: CapacityLifecycleStripeClient,
  input: CapacityLifecycleIdentity,
  owned: OwnedCapacitySubscription,
  prices: CapacityPriceConfiguration,
): Promise<{ owned: OwnedCapacitySubscription; invoiceId: string | null }> {
  if (!owned.subscription.pending_update) {
    return { owned, invoiceId: null };
  }
  const invoiceId = latestInvoiceId(owned.subscription);
  if (!invoiceId) {
    throw new Error('Stripe pending capacity change has no invoice to void.');
  }
  const invoice = await stripeClient.invoices.voidInvoice(
    invoiceId,
    {},
    {
      idempotencyKey: capacityLifecycleIdempotencyKey('void-pending-change', {
        ...input,
        stripeCapacitySubscriptionId: owned.snapshot.subscriptionId,
        stripeInvoiceId: invoiceId,
      }),
    },
  );
  if (
    invoice.status !== 'void'
    || extractStripeId(invoice.customer) !== input.stripeCustomerId
    || extractInvoiceSubscriptionId(invoice) !== owned.snapshot.subscriptionId
  ) {
    throw new Error('Stripe did not safely void the pending capacity invoice.');
  }

  const subscription = await stripeClient.subscriptions.retrieve(
    owned.snapshot.subscriptionId,
  );
  if (subscription.pending_update) {
    throw new Error('Stripe still reports a pending capacity change after voiding its invoice.');
  }
  const snapshot = snapshotStripeCapacitySubscription(subscription, prices);
  if (!snapshot || snapshot.customerId !== input.stripeCustomerId) {
    throw new Error('Stripe capacity subscription changed identity after its invoice was voided.');
  }
  return { owned: { subscription, snapshot }, invoiceId };
}

function scheduledEnd(owned: OwnedCapacitySubscription): number | null {
  if (owned.snapshot.cancelAtSeconds !== null) return owned.snapshot.cancelAtSeconds;
  return owned.snapshot.cancelAtPeriodEnd
    ? owned.snapshot.currentPeriodEndSeconds
    : null;
}

/**
 * Ends the separate monthly add-on no later than the base plan. Stripe keeps
 * renewing it until this date and prorates its final partial month.
 */
export async function scheduleCapacityAtBaseEnd(
  stripeClient: CapacityLifecycleStripeClient,
  input: CapacityLifecycleIdentity & { baseEndsAtSeconds: number | null },
  prices: CapacityPriceConfiguration,
): Promise<CapacityLifecycleResult> {
  let owned = await readOwnedCapacitySubscription(stripeClient, input, prices);
  if (!owned || TERMINAL_CAPACITY_STATUSES.has(owned.snapshot.status)) {
    return { snapshot: owned?.snapshot ?? null, interruptedInvoiceId: null };
  }
  if (input.baseEndsAtSeconds === null) {
    throw new Error('A live paid-capacity subscription requires a base-plan end date.');
  }
  assertFutureTimestamp(input.baseEndsAtSeconds);

  const interrupted = await voidPendingCapacityChange(stripeClient, input, owned, prices);
  owned = interrupted.owned;
  if (owned.snapshot.status === 'incomplete') {
    const canceled = await stripeClient.subscriptions.cancel(
      owned.snapshot.subscriptionId,
      {},
      {
        idempotencyKey: capacityLifecycleIdempotencyKey('cancel-incomplete', {
          ...input,
          stripeCapacitySubscriptionId: owned.snapshot.subscriptionId,
        }),
      },
    );
    const snapshot = snapshotStripeCapacitySubscription(canceled, prices);
    if (!snapshot || snapshot.status !== 'canceled') {
      throw new Error('Stripe did not cancel the unpaid capacity subscription.');
    }
    return { snapshot, interruptedInvoiceId: latestInvoiceId(owned.subscription) };
  }

  const existingEnd = scheduledEnd(owned);
  if (existingEnd !== null && existingEnd <= input.baseEndsAtSeconds) {
    return { snapshot: owned.snapshot, interruptedInvoiceId: interrupted.invoiceId };
  }

  const updated = await stripeClient.subscriptions.update(
    owned.snapshot.subscriptionId,
    {
      cancel_at: input.baseEndsAtSeconds,
      cancel_at_period_end: false,
      proration_behavior: 'create_prorations',
      metadata: {
        [BASE_CANCEL_AT_METADATA_KEY]: String(input.baseEndsAtSeconds),
        [BASE_SUBSCRIPTION_METADATA_KEY]: input.stripeBaseSubscriptionId,
      },
    },
    {
      idempotencyKey: capacityLifecycleIdempotencyKey('schedule-base-end', {
        ...input,
        stripeCapacitySubscriptionId: owned.snapshot.subscriptionId,
        timestampSeconds: input.baseEndsAtSeconds,
      }),
    },
  );
  const snapshot = snapshotStripeCapacitySubscription(updated, prices);
  if (
    !snapshot
    || snapshot.cancelAtSeconds !== input.baseEndsAtSeconds
    || updated.metadata[BASE_CANCEL_AT_METADATA_KEY] !== String(input.baseEndsAtSeconds)
    || updated.metadata[BASE_SUBSCRIPTION_METADATA_KEY] !== input.stripeBaseSubscriptionId
  ) {
    throw new Error('Stripe did not align paid capacity with the base-plan end.');
  }
  return { snapshot, interruptedInvoiceId: interrupted.invoiceId };
}

/** Clears only the cancellation marker created for this exact base plan. */
export async function resumeCapacityWithBase(
  stripeClient: CapacityLifecycleStripeClient,
  input: CapacityLifecycleIdentity,
  prices: CapacityPriceConfiguration,
): Promise<CapacityLifecycleResult> {
  const owned = await readOwnedCapacitySubscription(stripeClient, input, prices);
  if (!owned || TERMINAL_CAPACITY_STATUSES.has(owned.snapshot.status)) {
    return { snapshot: owned?.snapshot ?? null, interruptedInvoiceId: null };
  }
  const markedBase = owned.subscription.metadata[BASE_SUBSCRIPTION_METADATA_KEY];
  const markedEnd = owned.subscription.metadata[BASE_CANCEL_AT_METADATA_KEY];
  if (
    owned.snapshot.cancelAtSeconds === null
    || markedBase !== input.stripeBaseSubscriptionId
    || markedEnd !== String(owned.snapshot.cancelAtSeconds)
  ) {
    return { snapshot: owned.snapshot, interruptedInvoiceId: null };
  }

  const updated = await stripeClient.subscriptions.update(
    owned.snapshot.subscriptionId,
    {
      cancel_at: '',
      cancel_at_period_end: false,
      proration_behavior: 'create_prorations',
      metadata: {
        [BASE_CANCEL_AT_METADATA_KEY]: '',
        [BASE_SUBSCRIPTION_METADATA_KEY]: '',
      },
    },
    {
      idempotencyKey: capacityLifecycleIdempotencyKey('clear-base-end', {
        ...input,
        stripeCapacitySubscriptionId: owned.snapshot.subscriptionId,
        timestampSeconds: owned.snapshot.cancelAtSeconds ?? undefined,
      }),
    },
  );
  const snapshot = snapshotStripeCapacitySubscription(updated, prices);
  if (
    !snapshot
    || snapshot.cancelAtSeconds !== null
    || snapshot.cancelAtPeriodEnd
    || updated.metadata[BASE_CANCEL_AT_METADATA_KEY]
    || updated.metadata[BASE_SUBSCRIPTION_METADATA_KEY]
  ) {
    throw new Error('Stripe did not resume paid capacity with the base plan.');
  }
  return { snapshot, interruptedInvoiceId: null };
}

/** Stops a capacity charge immediately after its required base plan ends. */
export async function cancelCapacityAfterBaseEnded(
  stripeClient: CapacityLifecycleStripeClient,
  input: CapacityLifecycleIdentity,
  prices: CapacityPriceConfiguration,
): Promise<CapacityLifecycleResult> {
  let owned = await readOwnedCapacitySubscription(stripeClient, input, prices);
  if (!owned || TERMINAL_CAPACITY_STATUSES.has(owned.snapshot.status)) {
    return { snapshot: owned?.snapshot ?? null, interruptedInvoiceId: null };
  }
  const interrupted = await voidPendingCapacityChange(stripeClient, input, owned, prices);
  owned = interrupted.owned;
  const canceled = await stripeClient.subscriptions.cancel(
    owned.snapshot.subscriptionId,
    {},
    {
      idempotencyKey: capacityLifecycleIdempotencyKey('cancel-base-ended', {
        ...input,
        stripeCapacitySubscriptionId: owned.snapshot.subscriptionId,
      }),
    },
  );
  const snapshot = snapshotStripeCapacitySubscription(canceled, prices);
  if (!snapshot || snapshot.status !== 'canceled') {
    throw new Error('Stripe did not stop paid capacity after the base plan ended.');
  }
  return {
    snapshot,
    interruptedInvoiceId: interrupted.invoiceId
      ?? (owned.snapshot.status === 'incomplete' ? latestInvoiceId(owned.subscription) : null),
  };
}
