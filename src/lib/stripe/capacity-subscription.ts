import { PLAN_CATALOG, UNLIMITED, type PlanId } from '../plans/catalog';
import { extractStripeId } from './subscription-state';

export const CAPACITY_SUBSCRIPTION_KIND = 'capacity_addons' as const;

export const CAPACITY_ADDON_CATALOG = {
  brand: {
    monthlyEur: 25,
    maxQuantity: 10,
  },
  location: {
    monthlyEur: 10,
    maxQuantity: 25,
  },
} as const;

export interface CapacityPriceConfiguration {
  extraBrandMonthly?: string;
  extraLocationMonthly?: string;
}

export interface PaidCapacityQuantities {
  extraBrands: number;
  extraLocations: number;
}

export interface StripeCapacitySubscriptionLike {
  id?: unknown;
  customer?: unknown;
  status?: unknown;
  created?: unknown;
  metadata?: Record<string, string> | null;
  items?: {
    data?: Array<{
      id?: unknown;
      price?: StripeCapacityPriceLike | null;
      quantity?: unknown;
      current_period_end?: unknown;
    }>;
  } | null;
  current_period_end?: unknown;
  cancel_at?: unknown;
  cancel_at_period_end?: unknown;
  default_payment_method?: unknown;
  discounts?: unknown;
}

export interface StripeCapacityPriceLike {
  id?: unknown;
  active?: unknown;
  billing_scheme?: unknown;
  currency?: unknown;
  type?: unknown;
  unit_amount?: unknown;
  transform_quantity?: unknown;
  recurring?: {
    interval?: unknown;
    interval_count?: unknown;
    usage_type?: unknown;
  } | null;
}

export interface StripeCapacitySubscriptionSnapshot extends PaidCapacityQuantities {
  subscriptionId: string;
  customerId: string;
  status: string;
  brandItemId: string | null;
  locationItemId: string | null;
  currentPeriodEndSeconds: number | null;
  cancelAtSeconds: number | null;
  cancelAtPeriodEnd: boolean;
}

const SUPPORTED_STRIPE_SUBSCRIPTION_STATUSES = new Set([
  'incomplete',
  'incomplete_expired',
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'paused',
]);

const CAPACITY_GRANTING_STATUSES = new Set(['active', 'past_due']);
const REUSABLE_CAPACITY_SUBSCRIPTION_STATUSES = new Set([
  'active',
  'incomplete',
  'past_due',
  'paused',
]);

function readPositiveTimestamp(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? value
    : null;
}

function assertPriceConfiguration(
  prices: CapacityPriceConfiguration,
): asserts prices is Required<CapacityPriceConfiguration> {
  if (!prices.extraBrandMonthly || !prices.extraLocationMonthly) {
    throw new Error('Stripe capacity add-on prices are not fully configured.');
  }
  if (prices.extraBrandMonthly === prices.extraLocationMonthly) {
    throw new Error('Stripe brand and location add-ons must use different prices.');
  }
}

function readQuantity(value: unknown, label: string, maximum: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1 || (value as number) > maximum) {
    throw new Error(`Stripe ${label} add-on quantity must be an integer from 1 through ${maximum}.`);
  }
  return value as number;
}

/**
 * A capacity subscription is application-owned only when it carries the
 * server-written marker. Marked subscriptions are then validated strictly so
 * malformed Stripe state cannot silently grant or remove account capacity.
 */
export function snapshotStripeCapacitySubscription(
  subscription: StripeCapacitySubscriptionLike,
  prices: CapacityPriceConfiguration,
): StripeCapacitySubscriptionSnapshot | null {
  if (subscription.metadata?.subscription_kind !== CAPACITY_SUBSCRIPTION_KIND) {
    return null;
  }

  assertPriceConfiguration(prices);
  const subscriptionId = extractStripeId(subscription.id);
  const customerId = extractStripeId(subscription.customer);
  if (!subscriptionId) throw new Error('Stripe capacity subscription ID is missing.');
  if (!customerId) {
    throw new Error(`Stripe capacity subscription ${subscriptionId} has no customer ID.`);
  }
  if (
    typeof subscription.status !== 'string'
    || !SUPPORTED_STRIPE_SUBSCRIPTION_STATUSES.has(subscription.status)
  ) {
    throw new Error(`Stripe capacity subscription ${subscriptionId} has an unsupported status.`);
  }
  if (subscription.status === 'trialing') {
    throw new Error(`Stripe capacity subscription ${subscriptionId} must never have a trial.`);
  }
  if (Array.isArray(subscription.discounts) && subscription.discounts.length > 0) {
    throw new Error(`Stripe capacity subscription ${subscriptionId} must not have a discount.`);
  }
  if (extractStripeId(subscription.default_payment_method)) {
    throw new Error(
      `Stripe capacity subscription ${subscriptionId} must inherit the customer's default payment method.`,
    );
  }

  const items = subscription.items?.data;
  if (!Array.isArray(items) || items.length < 1 || items.length > 2) {
    throw new Error(
      `Stripe capacity subscription ${subscriptionId} must contain one or two add-on items.`,
    );
  }

  let brandItemId: string | null = null;
  let locationItemId: string | null = null;
  let extraBrands = 0;
  let extraLocations = 0;
  const itemPeriodEnds = new Set<number>();

  for (const item of items) {
    const itemId = extractStripeId(item.id);
    const priceId = extractStripeId(item.price);
    if (!itemId) {
      throw new Error(`Stripe capacity subscription ${subscriptionId} has an item without an ID.`);
    }
    if (item.price?.recurring?.interval !== 'month') {
      throw new Error(`Stripe capacity subscription ${subscriptionId} has a non-monthly item.`);
    }

    if (priceId === prices.extraBrandMonthly) {
      if (brandItemId) {
        throw new Error(`Stripe capacity subscription ${subscriptionId} has duplicate brand items.`);
      }
      brandItemId = itemId;
      extraBrands = readQuantity(
        item.quantity,
        'brand',
        CAPACITY_ADDON_CATALOG.brand.maxQuantity,
      );
    } else if (priceId === prices.extraLocationMonthly) {
      if (locationItemId) {
        throw new Error(`Stripe capacity subscription ${subscriptionId} has duplicate location items.`);
      }
      locationItemId = itemId;
      extraLocations = readQuantity(
        item.quantity,
        'location',
        CAPACITY_ADDON_CATALOG.location.maxQuantity,
      );
    } else {
      throw new Error(`Stripe capacity subscription ${subscriptionId} contains an unknown price.`);
    }

    const itemPeriodEnd = readPositiveTimestamp(item.current_period_end);
    if (itemPeriodEnd !== null) itemPeriodEnds.add(itemPeriodEnd);
  }

  if (itemPeriodEnds.size > 1) {
    throw new Error(`Stripe capacity subscription ${subscriptionId} has inconsistent item periods.`);
  }

  return {
    subscriptionId,
    customerId,
    status: subscription.status,
    brandItemId,
    locationItemId,
    extraBrands,
    extraLocations,
    currentPeriodEndSeconds:
      readPositiveTimestamp(subscription.current_period_end)
      ?? itemPeriodEnds.values().next().value
      ?? null,
    cancelAtSeconds: readPositiveTimestamp(subscription.cancel_at),
    cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
  };
}

function assertCapacityPrice(
  price: StripeCapacityPriceLike,
  expectedId: string,
  expectedUnitAmount: number,
  label: string,
): void {
  if (extractStripeId(price.id) !== expectedId) {
    throw new Error(`Stripe ${label} add-on price ID does not match configuration.`);
  }
  if (
    price.active !== true
    || price.type !== 'recurring'
    || price.billing_scheme !== 'per_unit'
    || price.currency !== 'eur'
    || price.unit_amount !== expectedUnitAmount
    || price.transform_quantity !== null
    || price.recurring?.interval !== 'month'
    || price.recurring.interval_count !== 1
    || price.recurring.usage_type !== 'licensed'
  ) {
    throw new Error(`Stripe ${label} add-on price does not match the approved monthly EUR catalogue.`);
  }
}

/** Verifies environment price IDs resolve to the approved fixed-price products. */
export function assertCapacityPriceCatalog(
  brandPrice: StripeCapacityPriceLike,
  locationPrice: StripeCapacityPriceLike,
  prices: CapacityPriceConfiguration,
): void {
  assertPriceConfiguration(prices);
  assertCapacityPrice(
    brandPrice,
    prices.extraBrandMonthly,
    CAPACITY_ADDON_CATALOG.brand.monthlyEur * 100,
    'brand',
  );
  assertCapacityPrice(
    locationPrice,
    prices.extraLocationMonthly,
    CAPACITY_ADDON_CATALOG.location.monthlyEur * 100,
    'location',
  );
}

/**
 * Selects one authoritative capacity subscription without confusing it with
 * the customer's base plan or another Stripe product. A live subscription
 * wins; otherwise the newest terminal capacity subscription is retained as
 * the closed state. Multiple live capacity subscriptions fail closed because
 * they could represent duplicate recurring charges.
 */
export function selectAuthoritativeCapacitySubscription<T extends StripeCapacitySubscriptionLike>(
  subscriptions: readonly T[],
  hasMore: boolean,
  prices: CapacityPriceConfiguration,
): T | null {
  if (hasMore) {
    throw new Error('Stripe returned a truncated subscription list; refusing to guess which capacity subscription is current.');
  }

  const capacitySubscriptions = subscriptions.filter(
    (subscription) => snapshotStripeCapacitySubscription(subscription, prices) !== null,
  );
  const reusable = capacitySubscriptions.filter(
    (subscription) => typeof subscription.status === 'string'
      && REUSABLE_CAPACITY_SUBSCRIPTION_STATUSES.has(subscription.status),
  );
  if (reusable.length > 1) {
    throw new Error('Stripe has more than one live capacity subscription for this customer.');
  }
  if (reusable.length === 1) return reusable[0];
  if (capacitySubscriptions.length === 0) return null;

  let latest = capacitySubscriptions[0];
  let latestCreated = readPositiveTimestamp(latest.created);
  if (latestCreated === null) {
    throw new Error('Stripe terminal capacity subscription has an invalid creation timestamp.');
  }
  for (const subscription of capacitySubscriptions.slice(1)) {
    const created = readPositiveTimestamp(subscription.created);
    if (created === null) {
      throw new Error('Stripe terminal capacity subscription has an invalid creation timestamp.');
    }
    if (created > latestCreated) {
      latest = subscription;
      latestCreated = created;
    }
  }
  return latest;
}

/** Only a successfully paid base subscription may start or increase add-ons. */
export function canPurchaseCapacityAddons(baseSubscriptionStatus: string): boolean {
  return baseSubscriptionStatus === 'active';
}

/**
 * Keep capacity while Stripe retries a failed payment (`past_due`). Stop it
 * only after Stripe reaches a terminal non-paying state, as the product owner
 * requested.
 */
export function effectivePaidCapacity(
  status: string | null,
  quantities: PaidCapacityQuantities,
): PaidCapacityQuantities {
  const validQuantities = assertCapacityQuantities(quantities);
  return status !== null && CAPACITY_GRANTING_STATUSES.has(status)
    ? validQuantities
    : { extraBrands: 0, extraLocations: 0 };
}

export function assertCapacityQuantities(
  quantities: PaidCapacityQuantities,
): PaidCapacityQuantities {
  if (
    !Number.isSafeInteger(quantities.extraBrands)
    || quantities.extraBrands < 0
    || quantities.extraBrands > CAPACITY_ADDON_CATALOG.brand.maxQuantity
  ) {
    throw new Error(
      `Extra brand quantity must be an integer from 0 through ${CAPACITY_ADDON_CATALOG.brand.maxQuantity}.`,
    );
  }
  if (
    !Number.isSafeInteger(quantities.extraLocations)
    || quantities.extraLocations < 0
    || quantities.extraLocations > CAPACITY_ADDON_CATALOG.location.maxQuantity
  ) {
    throw new Error(
      `Extra location quantity must be an integer from 0 through ${CAPACITY_ADDON_CATALOG.location.maxQuantity}.`,
    );
  }
  return quantities;
}

function addCapacity(baseLimit: number, extra: number): number {
  return baseLimit === UNLIMITED ? UNLIMITED : baseLimit + extra;
}

export function effectiveCapacityLimits(
  plan: PlanId,
  paidCapacity: PaidCapacityQuantities,
): { maxBrands: number; maxLocationsPerAccount: number } {
  const validCapacity = assertCapacityQuantities(paidCapacity);
  const base = PLAN_CATALOG[plan].entitlements;
  return {
    maxBrands: addCapacity(base.maxBrands, validCapacity.extraBrands),
    maxLocationsPerAccount: addCapacity(
      base.maxLocationsPerAccount,
      validCapacity.extraLocations,
    ),
  };
}
