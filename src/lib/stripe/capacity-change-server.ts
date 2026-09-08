import 'server-only';

import type Stripe from 'stripe';
import {
  assertCustomerHasNoInheritedDiscount,
  CapacityChangeError,
  capacityChangeDirection,
  capacityChangeIdempotencyKey,
  capacityInvoicePreviewParams,
  capacitySubscriptionCreateParams,
  capacitySubscriptionUpdateParams,
  monthlyCapacitySubtotalCents,
} from './capacity-change';
import {
  assertCapacityPriceCatalog,
  effectivePaidCapacity,
  selectAuthoritativeCapacitySubscription,
  snapshotStripeCapacitySubscription,
  type CapacityPriceConfiguration,
  type PaidCapacityQuantities,
  type StripeCapacitySubscriptionSnapshot,
} from './capacity-subscription';
import {
  extractInvoiceConfirmationClientSecret,
  extractStripeId,
  snapshotStripeSubscription,
  type SubscriptionPriceConfiguration,
} from './subscription-state';

export type CapacityChangeStripeClient = Pick<
  Stripe,
  'customers' | 'prices' | 'subscriptions' | 'invoices'
>;

export interface AuthoritativeCapacityBillingState {
  customer: Stripe.Customer;
  currentSubscription: Stripe.Subscription | null;
  authoritative: StripeCapacitySubscriptionSnapshot | null;
  current: StripeCapacitySubscriptionSnapshot | null;
}

export interface CapacityInvoiceQuote {
  currency: 'eur';
  amountDueNowCents: number;
  totalCents: number;
  prorationCents: number;
  monthlySubtotalCents: number;
}

export interface AppliedCapacityChange {
  status: 'applied' | 'pending_payment';
  subscription: Stripe.Subscription;
  snapshot: StripeCapacitySubscriptionSnapshot;
  invoiceId: string | null;
  clientSecret: string | null;
  pendingExpiresAtSeconds: number | null;
}

export interface CapacityBaseSubscriptionState {
  plan: 'pro' | 'business';
  status: string;
  canIncrease: boolean;
  hasPendingPlanChange: boolean;
}

/**
 * Confirms the stored base subscription still belongs to this account and is
 * one of the application's configured paid plans. Reductions remain possible
 * when billing is unhealthy so a customer is never trapped in an add-on.
 */
export async function readCapacityBaseSubscriptionState(
  stripeClient: Pick<Stripe, 'subscriptions'>,
  input: {
    stripeSubscriptionId: string;
    stripeCustomerId: string;
    prices: SubscriptionPriceConfiguration;
  },
): Promise<CapacityBaseSubscriptionState> {
  const subscription = await stripeClient.subscriptions.retrieve(
    input.stripeSubscriptionId,
  );
  const snapshot = snapshotStripeSubscription(subscription, input.prices);
  if (
    snapshot.subscriptionId !== input.stripeSubscriptionId
    || snapshot.customerId !== input.stripeCustomerId
  ) {
    throw new Error('The stored Stripe base subscription belongs to another account.');
  }
  if (snapshot.plan !== 'pro' && snapshot.plan !== 'business') {
    throw new Error('Paid capacity requires a configured Pro or Business base plan.');
  }
  if (subscription.collection_method !== 'charge_automatically') {
    throw new Error('Paid capacity requires automatic card billing.');
  }
  return {
    plan: snapshot.plan,
    status: snapshot.status,
    canIncrease: snapshot.status === 'active'
      && !snapshot.cancelAtPeriodEnd
      && !subscription.pending_update
      && !snapshot.scheduleId,
    hasPendingPlanChange: Boolean(subscription.pending_update || snapshot.scheduleId),
  };
}

function readMoney(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value)) throw new Error(`Stripe invoice ${label} is invalid.`);
  return value as number;
}

function readPendingExpiry(subscription: Stripe.Subscription): number | null {
  const value = subscription.pending_update?.expires_at;
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? value
    : null;
}

function hasDiscounts(invoice: Stripe.Invoice): boolean {
  if ((invoice.total_discount_amounts?.length ?? 0) > 0) return true;
  return invoice.lines.data.some((line) => (line.discount_amounts?.length ?? 0) > 0);
}

function readProrationTotal(invoice: Stripe.Invoice): number {
  return invoice.lines.data.reduce((total, line) => {
    const isProration = line.parent?.subscription_item_details?.proration === true;
    return isProration ? total + readMoney(line.amount, 'proration line amount') : total;
  }, 0);
}

function assertUsableCapacitySubscription(
  subscription: Stripe.Subscription,
  prices: CapacityPriceConfiguration,
  customerId: string,
  allowPendingChange: boolean,
): StripeCapacitySubscriptionSnapshot {
  const snapshot = snapshotStripeCapacitySubscription(subscription, prices);
  if (!snapshot || snapshot.customerId !== customerId) {
    throw new Error('Stripe capacity subscription failed ownership validation.');
  }
  if (subscription.collection_method !== 'charge_automatically') {
    throw new Error('Stripe capacity subscription must use automatic card billing.');
  }
  if (subscription.pending_update && !allowPendingChange) {
    throw new Error('A Stripe capacity change is already waiting for payment.');
  }
  return snapshot;
}

/**
 * Re-reads Stripe before every quote/change. Environment IDs are checked
 * against the approved products, and customer-wide discounts fail closed so
 * a base-plan promotion cannot leak into fixed-price add-ons.
 */
export async function readAuthoritativeCapacityBillingState(
  stripeClient: CapacityChangeStripeClient,
  stripeCustomerId: string,
  prices: CapacityPriceConfiguration,
  options: { allowPendingChange?: boolean } = {},
): Promise<AuthoritativeCapacityBillingState> {
  if (!prices.extraBrandMonthly || !prices.extraLocationMonthly) {
    throw new Error('Stripe capacity add-on prices are not fully configured.');
  }
  const [customer, brandPrice, locationPrice, subscriptions] = await Promise.all([
    stripeClient.customers.retrieve(stripeCustomerId),
    stripeClient.prices.retrieve(prices.extraBrandMonthly),
    stripeClient.prices.retrieve(prices.extraLocationMonthly),
    stripeClient.subscriptions.list({
      customer: stripeCustomerId,
      status: 'all',
      limit: 100,
    }),
  ]);
  assertCustomerHasNoInheritedDiscount(customer, stripeCustomerId);
  assertCapacityPriceCatalog(brandPrice, locationPrice, prices);

  const selected = selectAuthoritativeCapacitySubscription(
    subscriptions.data,
    subscriptions.has_more,
    prices,
  );
  if (!selected) {
    return {
      customer,
      currentSubscription: null,
      authoritative: null,
      current: null,
    };
  }
  const currentSubscription = await stripeClient.subscriptions.retrieve(
    selected.id,
    { expand: ['latest_invoice.confirmation_secret'] },
  );
  const authoritative = assertUsableCapacitySubscription(
    currentSubscription,
    prices,
    stripeCustomerId,
    options.allowPendingChange === true,
  );
  return {
    customer,
    currentSubscription,
    authoritative,
    current: ['incomplete_expired', 'canceled', 'unpaid'].includes(authoritative.status)
      ? null
      : authoritative,
  };
}

export async function previewCapacityInvoice(
  stripeClient: CapacityChangeStripeClient,
  input: {
    stripeCustomerId: string;
    current: StripeCapacitySubscriptionSnapshot | null;
    target: PaidCapacityQuantities;
    prorationDateSeconds: number;
    prices: CapacityPriceConfiguration;
  },
): Promise<CapacityInvoiceQuote> {
  const invoice = await stripeClient.invoices.createPreview(
    capacityInvoicePreviewParams(input),
  );
  if (extractStripeId(invoice.customer) !== input.stripeCustomerId) {
    throw new Error('Stripe invoice preview belongs to another customer.');
  }
  if (invoice.currency !== 'eur') {
    throw new Error('Stripe capacity invoice preview is not in EUR.');
  }
  if (hasDiscounts(invoice)) {
    throw new Error('Stripe unexpectedly discounted the capacity invoice preview.');
  }
  return {
    currency: 'eur',
    amountDueNowCents: readMoney(invoice.amount_due, 'amount due'),
    totalCents: readMoney(invoice.total, 'total'),
    prorationCents: readProrationTotal(invoice),
    monthlySubtotalCents: monthlyCapacitySubtotalCents(input.target),
  };
}

async function retrieveChangedSubscription(
  stripeClient: CapacityChangeStripeClient,
  subscriptionId: string,
): Promise<Stripe.Subscription> {
  return stripeClient.subscriptions.retrieve(
    subscriptionId,
    { expand: ['latest_invoice.confirmation_secret'] },
  );
}

function readAppliedOutcome(
  subscription: Stripe.Subscription,
  prices: CapacityPriceConfiguration,
  expectedCustomerId: string,
  target: PaidCapacityQuantities,
): AppliedCapacityChange {
  const snapshot = snapshotStripeCapacitySubscription(subscription, prices);
  if (!snapshot || snapshot.customerId !== expectedCustomerId) {
    throw new Error('Stripe returned an invalid paid-capacity subscription.');
  }
  const matchesTarget = snapshot.extraBrands === target.extraBrands
    && snapshot.extraLocations === target.extraLocations;
  const invoiceId = extractStripeId(subscription.latest_invoice);
  const clientSecret = extractInvoiceConfirmationClientSecret(subscription.latest_invoice);
  if (subscription.status === 'incomplete' && matchesTarget) {
    if (!invoiceId) throw new Error('Stripe incomplete capacity subscription has no invoice.');
    return {
      status: 'pending_payment',
      subscription,
      snapshot,
      invoiceId,
      clientSecret,
      pendingExpiresAtSeconds: null,
    };
  }
  if (subscription.pending_update) {
    if (matchesTarget) {
      throw new Error('Stripe reported a pending update after already applying its target quantities.');
    }
    if (!Array.isArray(subscription.pending_update.subscription_items)) {
      throw new Error('Stripe pending capacity update has no item list.');
    }
    const pendingSnapshot = snapshotStripeCapacitySubscription({
      ...subscription,
      status: 'active',
      items: { data: subscription.pending_update.subscription_items },
    }, prices);
    if (
      !pendingSnapshot
      || pendingSnapshot.extraBrands !== target.extraBrands
      || pendingSnapshot.extraLocations !== target.extraLocations
    ) {
      throw new Error('Stripe pending capacity update does not match the requested quantities.');
    }
    if (!invoiceId) throw new Error('Stripe pending capacity update has no invoice.');
    return {
      status: 'pending_payment',
      subscription,
      snapshot,
      invoiceId,
      clientSecret,
      pendingExpiresAtSeconds: readPendingExpiry(subscription),
    };
  }
  const effective = effectivePaidCapacity(subscription.status, snapshot);
  const matchesEffectiveTarget = effective.extraBrands === target.extraBrands
    && effective.extraLocations === target.extraLocations;
  const isAppliedStatus = subscription.status === 'active'
    || subscription.status === 'past_due'
    || (
      subscription.status === 'canceled'
      && target.extraBrands === 0
      && target.extraLocations === 0
    );
  if (!matchesEffectiveTarget || !isAppliedStatus) {
    throw new CapacityChangeError(
      'CAPACITY_CHANGE_NOT_APPLIED',
      409,
      'Stripe did not apply the requested paid-capacity quantities.',
    );
  }
  return {
    status: 'applied',
    subscription,
    snapshot,
    invoiceId,
    clientSecret: null,
    pendingExpiresAtSeconds: null,
  };
}

/**
 * Re-reads one operation's exact Stripe subscription after a browser retry or
 * webhook delay. It accepts only the requested target, so a stale operation
 * can never confirm a different quantity change.
 */
export async function readCapacityChangeOutcome(
  stripeClient: CapacityChangeStripeClient,
  input: {
    stripeSubscriptionId: string;
    stripeCustomerId: string;
    target: PaidCapacityQuantities;
    prices: CapacityPriceConfiguration;
  },
): Promise<AppliedCapacityChange> {
  const subscription = await retrieveChangedSubscription(
    stripeClient,
    input.stripeSubscriptionId,
  );
  return readAppliedOutcome(
    subscription,
    input.prices,
    input.stripeCustomerId,
    input.target,
  );
}

export async function applyCapacityChange(
  stripeClient: CapacityChangeStripeClient,
  input: {
    operationId: string;
    userId: number;
    stripeCustomerId: string;
    current: StripeCapacitySubscriptionSnapshot | null;
    target: PaidCapacityQuantities;
    prorationDateSeconds: number;
    prices: CapacityPriceConfiguration;
  },
): Promise<AppliedCapacityChange> {
  if (!input.current) {
    const created = await stripeClient.subscriptions.create(
      capacitySubscriptionCreateParams(input),
      { idempotencyKey: capacityChangeIdempotencyKey(input.operationId, 'create') },
    );
    const subscription = await retrieveChangedSubscription(stripeClient, created.id);
    return readAppliedOutcome(
      subscription,
      input.prices,
      input.stripeCustomerId,
      input.target,
    );
  }
  if (input.current.customerId !== input.stripeCustomerId) {
    throw new Error('Paid-capacity subscription belongs to another Stripe customer.');
  }
  const direction = capacityChangeDirection(input.current, input.target);
  if (
    input.current.status !== 'active'
    && !(input.current.status === 'past_due' && direction === 'decrease')
  ) {
    throw new Error('Only active paid capacity can be increased; past-due capacity may only be reduced.');
  }
  if (direction === 'mixed') {
    throw new Error('Mixed paid-capacity changes must be split before Stripe is called.');
  }
  if (input.target.extraBrands === 0 && input.target.extraLocations === 0) {
    const canceled = await stripeClient.subscriptions.cancel(
      input.current.subscriptionId,
      { invoice_now: true, prorate: true, expand: ['latest_invoice'] },
      { idempotencyKey: capacityChangeIdempotencyKey(input.operationId, 'cancel') },
    );
    const snapshot = snapshotStripeCapacitySubscription(canceled, input.prices);
    if (!snapshot || snapshot.customerId !== input.stripeCustomerId || canceled.status !== 'canceled') {
      throw new Error('Stripe did not cancel the paid-capacity subscription safely.');
    }
    return {
      status: 'applied',
      subscription: canceled,
      snapshot,
      invoiceId: extractStripeId(canceled.latest_invoice),
      clientSecret: null,
      pendingExpiresAtSeconds: null,
    };
  }

  const updated = await stripeClient.subscriptions.update(
    input.current.subscriptionId,
    capacitySubscriptionUpdateParams({
      current: input.current,
      target: input.target,
      prorationDateSeconds: input.prorationDateSeconds,
      prices: input.prices,
    }),
    {
      idempotencyKey: capacityChangeIdempotencyKey(
        input.operationId,
        direction === 'increase' ? 'increase' : 'decrease',
      ),
    },
  );
  const subscription = await retrieveChangedSubscription(stripeClient, updated.id);
  return readAppliedOutcome(
    subscription,
    input.prices,
    input.stripeCustomerId,
    input.target,
  );
}
