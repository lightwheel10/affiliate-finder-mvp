import { createHash } from 'node:crypto';
import type Stripe from 'stripe';
import type { DowngradeRetentionSelection } from '@/lib/plans/downgrade-capacity';
import {
  CAPACITY_ADDON_CATALOG,
  CAPACITY_SUBSCRIPTION_KIND,
  assertCapacityQuantities,
  type CapacityPriceConfiguration,
  type PaidCapacityQuantities,
  type StripeCapacitySubscriptionSnapshot,
} from './capacity-subscription';

export type CapacityChangeDirection = 'increase' | 'decrease' | 'mixed';
export type CapacityBasePlan = 'pro' | 'business';

export interface CapacityChangeIdentity {
  operationId: string;
  userId: number;
  stripeCustomerId: string;
  stripeBaseSubscriptionId: string;
  basePlan: CapacityBasePlan;
  stripeSubscriptionId: string | null;
  from: PaidCapacityQuantities;
  to: PaidCapacityQuantities;
  prorationDateSeconds: number;
  capacitySelectionVersion: 1 | null;
  retainedBrandIds: readonly string[] | null;
  retainedLocationIds: readonly string[] | null;
}

export class CapacityChangeError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'CapacityChangeError';
  }
}

function assertUuid(value: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error('Paid-capacity operation ID is invalid.');
  }
}

function assertStripeReference(value: string, prefix: 'cus_' | 'sub_'): void {
  if (!new RegExp(`^${prefix}[A-Za-z0-9]+$`).test(value)) {
    throw new Error(`Paid-capacity Stripe ${prefix === 'cus_' ? 'customer' : 'subscription'} ID is invalid.`);
  }
}

function sortedPostgresIds(values: readonly string[]): string[] {
  for (const value of values) {
    if (!/^[1-9][0-9]{0,18}$/.test(value)) {
      throw new Error('Paid-capacity retention ID is invalid.');
    }
  }
  if (new Set(values).size !== values.length) {
    throw new Error('Paid-capacity retention IDs must be unique.');
  }
  return [...values].sort((left, right) => {
    const leftId = BigInt(left);
    const rightId = BigInt(right);
    return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
  });
}

function assertSelectionIdentity(input: CapacityChangeIdentity): void {
  const allNull = input.capacitySelectionVersion === null
    && input.retainedBrandIds === null
    && input.retainedLocationIds === null;
  const allPresent = input.capacitySelectionVersion === 1
    && input.retainedBrandIds !== null
    && input.retainedLocationIds !== null;
  if (!allNull && !allPresent) {
    throw new Error('Paid-capacity retention selection is incomplete.');
  }
  if (allPresent) {
    sortedPostgresIds(input.retainedBrandIds!);
    sortedPostgresIds(input.retainedLocationIds!);
  }
}

function assertIdentity(input: CapacityChangeIdentity): void {
  assertUuid(input.operationId);
  if (!Number.isSafeInteger(input.userId) || input.userId <= 0) {
    throw new Error('Paid-capacity account ID is invalid.');
  }
  assertStripeReference(input.stripeCustomerId, 'cus_');
  assertStripeReference(input.stripeBaseSubscriptionId, 'sub_');
  if (input.basePlan !== 'pro' && input.basePlan !== 'business') {
    throw new Error('Paid-capacity base plan is invalid.');
  }
  if (input.stripeSubscriptionId !== null) {
    assertStripeReference(input.stripeSubscriptionId, 'sub_');
  }
  assertCapacityQuantities(input.from);
  assertCapacityQuantities(input.to);
  if (!Number.isSafeInteger(input.prorationDateSeconds) || input.prorationDateSeconds <= 0) {
    throw new Error('Paid-capacity proration date is invalid.');
  }
  capacityChangeDirection(input.from, input.to);
  assertSelectionIdentity(input);
}

export function capacityChangeDirection(
  from: PaidCapacityQuantities,
  to: PaidCapacityQuantities,
): CapacityChangeDirection {
  const validFrom = assertCapacityQuantities(from);
  const validTo = assertCapacityQuantities(to);
  const brandDelta = validTo.extraBrands - validFrom.extraBrands;
  const locationDelta = validTo.extraLocations - validFrom.extraLocations;
  if (brandDelta === 0 && locationDelta === 0) {
    throw new CapacityChangeError(
      'CAPACITY_NO_CHANGE',
      400,
      'Choose a different number of extra brands or locations.',
    );
  }
  const hasIncrease = brandDelta > 0 || locationDelta > 0;
  const hasDecrease = brandDelta < 0 || locationDelta < 0;
  if (hasIncrease && hasDecrease) return 'mixed';
  return hasIncrease ? 'increase' : 'decrease';
}

export function monthlyCapacitySubtotalCents(quantities: PaidCapacityQuantities): number {
  const valid = assertCapacityQuantities(quantities);
  return valid.extraBrands * CAPACITY_ADDON_CATALOG.brand.monthlyEur * 100
    + valid.extraLocations * CAPACITY_ADDON_CATALOG.location.monthlyEur * 100;
}

export function capacityChangeRequestFingerprint(input: CapacityChangeIdentity): string {
  assertIdentity(input);
  const canonical = {
    userId: input.userId,
    stripeCustomerId: input.stripeCustomerId,
    stripeBaseSubscriptionId: input.stripeBaseSubscriptionId,
    basePlan: input.basePlan,
    stripeSubscriptionId: input.stripeSubscriptionId,
    from: input.from,
    to: input.to,
    prorationDateSeconds: input.prorationDateSeconds,
    capacitySelectionVersion: input.capacitySelectionVersion,
    retainedBrandIds: input.retainedBrandIds
      ? sortedPostgresIds(input.retainedBrandIds)
      : null,
    retainedLocationIds: input.retainedLocationIds
      ? sortedPostgresIds(input.retainedLocationIds)
      : null,
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

export function capacityChangeIdempotencyKey(
  operationId: string,
  step: 'create' | 'increase' | 'decrease' | 'cancel',
): string {
  assertUuid(operationId);
  return `capacity-change:v1:${operationId.toLowerCase()}:${step}`;
}

function requirePrices(
  prices: CapacityPriceConfiguration,
): asserts prices is Required<CapacityPriceConfiguration> {
  if (!prices.extraBrandMonthly || !prices.extraLocationMonthly) {
    throw new Error('Stripe capacity add-on prices are not fully configured.');
  }
  if (prices.extraBrandMonthly === prices.extraLocationMonthly) {
    throw new Error('Stripe capacity add-on prices must be different.');
  }
}

function createItems(
  target: PaidCapacityQuantities,
  prices: Required<CapacityPriceConfiguration>,
): Stripe.SubscriptionCreateParams.Item[] {
  const items: Stripe.SubscriptionCreateParams.Item[] = [];
  if (target.extraBrands > 0) {
    items.push({ price: prices.extraBrandMonthly, quantity: target.extraBrands });
  }
  if (target.extraLocations > 0) {
    items.push({ price: prices.extraLocationMonthly, quantity: target.extraLocations });
  }
  if (items.length === 0) {
    throw new CapacityChangeError(
      'CAPACITY_EMPTY_SUBSCRIPTION',
      400,
      'At least one paid capacity item is required.',
    );
  }
  return items;
}

function updateItems(
  current: StripeCapacitySubscriptionSnapshot,
  target: PaidCapacityQuantities,
  prices: Required<CapacityPriceConfiguration>,
): Stripe.SubscriptionUpdateParams.Item[] {
  const items: Stripe.SubscriptionUpdateParams.Item[] = [];
  if (current.brandItemId) {
    items.push(target.extraBrands > 0
      ? { id: current.brandItemId, quantity: target.extraBrands }
      : { id: current.brandItemId, deleted: true });
  } else if (target.extraBrands > 0) {
    items.push({ price: prices.extraBrandMonthly, quantity: target.extraBrands });
  }
  if (current.locationItemId) {
    items.push(target.extraLocations > 0
      ? { id: current.locationItemId, quantity: target.extraLocations }
      : { id: current.locationItemId, deleted: true });
  } else if (target.extraLocations > 0) {
    items.push({ price: prices.extraLocationMonthly, quantity: target.extraLocations });
  }
  return items;
}

export function capacityInvoicePreviewParams(input: {
  stripeCustomerId: string;
  current: StripeCapacitySubscriptionSnapshot | null;
  target: PaidCapacityQuantities;
  prorationDateSeconds: number;
  prices: CapacityPriceConfiguration;
}): Stripe.InvoiceCreatePreviewParams {
  assertStripeReference(input.stripeCustomerId, 'cus_');
  const target = assertCapacityQuantities(input.target);
  requirePrices(input.prices);
  if (!Number.isSafeInteger(input.prorationDateSeconds) || input.prorationDateSeconds <= 0) {
    throw new Error('Paid-capacity proration date is invalid.');
  }
  if (!input.current) {
    return {
      customer: input.stripeCustomerId,
      discounts: '',
      subscription_details: {
        billing_mode: { type: 'flexible' },
        items: createItems(target, input.prices),
      },
    };
  }
  if (input.current.customerId !== input.stripeCustomerId) {
    throw new Error('Paid-capacity subscription belongs to another Stripe customer.');
  }
  capacityChangeDirection(input.current, target);
  if (target.extraBrands === 0 && target.extraLocations === 0) {
    return {
      customer: input.stripeCustomerId,
      subscription: input.current.subscriptionId,
      discounts: '',
      subscription_details: {
        cancel_now: true,
        proration_behavior: 'always_invoice',
      },
    };
  }
  return {
    customer: input.stripeCustomerId,
    subscription: input.current.subscriptionId,
    discounts: '',
    subscription_details: {
      items: updateItems(input.current, target, input.prices),
      proration_behavior: 'always_invoice',
      proration_date: input.prorationDateSeconds,
    },
  };
}

export function capacitySubscriptionCreateParams(input: {
  operationId: string;
  userId: number;
  stripeCustomerId: string;
  target: PaidCapacityQuantities;
  prices: CapacityPriceConfiguration;
}): Stripe.SubscriptionCreateParams {
  assertUuid(input.operationId);
  if (!Number.isSafeInteger(input.userId) || input.userId <= 0) {
    throw new Error('Paid-capacity account ID is invalid.');
  }
  assertStripeReference(input.stripeCustomerId, 'cus_');
  const target = assertCapacityQuantities(input.target);
  requirePrices(input.prices);
  return {
    customer: input.stripeCustomerId,
    items: createItems(target, input.prices),
    payment_behavior: 'default_incomplete',
    payment_settings: {
      payment_method_types: ['card'],
    },
    billing_mode: { type: 'flexible' },
    metadata: {
      neon_user_id: String(input.userId),
      subscription_kind: CAPACITY_SUBSCRIPTION_KIND,
      app_capacity_operation_id: input.operationId,
    },
    expand: ['latest_invoice.confirmation_secret'],
  };
}

export function capacitySubscriptionUpdateParams(input: {
  current: StripeCapacitySubscriptionSnapshot;
  target: PaidCapacityQuantities;
  prorationDateSeconds: number;
  prices: CapacityPriceConfiguration;
}): Stripe.SubscriptionUpdateParams {
  const target = assertCapacityQuantities(input.target);
  requirePrices(input.prices);
  if (!Number.isSafeInteger(input.prorationDateSeconds) || input.prorationDateSeconds <= 0) {
    throw new Error('Paid-capacity proration date is invalid.');
  }
  const direction = capacityChangeDirection(input.current, target);
  if (direction === 'mixed') {
    throw new CapacityChangeError(
      'CAPACITY_MIXED_CHANGE',
      409,
      'Increase and decrease paid capacity in separate confirmed changes.',
    );
  }
  if (target.extraBrands === 0 && target.extraLocations === 0) {
    throw new CapacityChangeError(
      'CAPACITY_CANCEL_REQUIRED',
      409,
      'Removing all paid capacity must cancel the capacity subscription.',
    );
  }
  const items = updateItems(input.current, target, input.prices);
  if (direction === 'increase' && items.some((item) => item.deleted === true)) {
    throw new Error('A paid-capacity increase unexpectedly removes an item.');
  }
  return {
    items,
    payment_behavior: direction === 'increase' ? 'pending_if_incomplete' : 'allow_incomplete',
    proration_behavior: 'always_invoice',
    proration_date: input.prorationDateSeconds,
    expand: ['latest_invoice.confirmation_secret'],
  };
}

export function assertCustomerHasNoInheritedDiscount(
  customer: Stripe.Customer | Stripe.DeletedCustomer,
  expectedCustomerId: string,
): asserts customer is Stripe.Customer {
  if (customer.deleted || customer.id !== expectedCustomerId) {
    throw new Error('Stripe customer is deleted or belongs to another account.');
  }
  if (customer.discount) {
    throw new CapacityChangeError(
      'CAPACITY_CUSTOMER_DISCOUNT_CONFLICT',
      409,
      'This account has a customer-wide Stripe discount. Capacity billing needs support review.',
    );
  }
}

export function capacitySelectionIdentity(
  selection?: DowngradeRetentionSelection,
): Pick<
  CapacityChangeIdentity,
  'capacitySelectionVersion' | 'retainedBrandIds' | 'retainedLocationIds'
> {
  return selection
    ? {
        capacitySelectionVersion: 1,
        retainedBrandIds: sortedPostgresIds(selection.brandIds),
        retainedLocationIds: sortedPostgresIds(selection.locationIds),
      }
    : {
        capacitySelectionVersion: null,
        retainedBrandIds: null,
        retainedLocationIds: null,
      };
}
