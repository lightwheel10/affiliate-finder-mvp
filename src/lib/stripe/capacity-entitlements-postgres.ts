import 'server-only';

import type postgres from 'postgres';
import {
  effectivePaidCapacity,
  type PaidCapacityQuantities,
} from './capacity-subscription';

export type CapacityEntitlementsSql = postgres.Sql;

interface PaidCapacityRow {
  stripe_customer_id: unknown;
  status: unknown;
  extra_brand_quantity: unknown;
  extra_location_quantity: unknown;
}

const ZERO_PAID_CAPACITY: PaidCapacityQuantities = {
  extraBrands: 0,
  extraLocations: 0,
};

function readStripeCustomerId(value: unknown): string {
  if (typeof value !== 'string' || !/^cus_[A-Za-z0-9]+$/.test(value)) {
    throw new Error('Stored paid-capacity Stripe customer ID is invalid.');
  }
  return value;
}

function readStatus(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('Stored paid-capacity subscription status is invalid.');
  }
  return value;
}

function readQuantity(value: unknown, label: string): number {
  const quantity = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(quantity) || quantity < 0) {
    throw new Error(`Stored paid-capacity ${label} quantity is invalid.`);
  }
  return quantity;
}

/**
 * Reads the private Stripe mirror while preserving account ownership.
 *
 * Stripe remains the billing source of truth; this row is the transaction-safe
 * entitlement snapshot used when a plan change and brand/location rows must be
 * reconciled together in PostgreSQL.
 */
export async function readEffectivePaidCapacity(
  executor: CapacityEntitlementsSql,
  input: {
    userId: number;
    stripeCustomerId: string;
    lock?: boolean;
  },
): Promise<PaidCapacityQuantities> {
  if (!Number.isSafeInteger(input.userId) || input.userId <= 0) {
    throw new Error('Paid-capacity entitlement account ID is invalid.');
  }
  if (!/^cus_[A-Za-z0-9]+$/.test(input.stripeCustomerId)) {
    throw new Error('Paid-capacity entitlement Stripe customer ID is invalid.');
  }

  const rows = await executor<PaidCapacityRow[]>`
    SELECT
      stripe_customer_id,
      status,
      extra_brand_quantity,
      extra_location_quantity
    FROM crewcast.stripe_capacity_subscriptions
    WHERE user_id = ${input.userId}
    LIMIT 2
    ${input.lock === false ? executor`` : executor`FOR UPDATE`}
  `;
  if (rows.length > 1) {
    throw new Error('Paid-capacity entitlement row is duplicated.');
  }
  if (rows.length === 0) return { ...ZERO_PAID_CAPACITY };

  const row = rows[0];
  if (readStripeCustomerId(row.stripe_customer_id) !== input.stripeCustomerId) {
    throw new Error('Base and paid-capacity subscriptions belong to different Stripe customers.');
  }
  return effectivePaidCapacity(readStatus(row.status), {
    extraBrands: readQuantity(row.extra_brand_quantity, 'brand'),
    extraLocations: readQuantity(row.extra_location_quantity, 'location'),
  });
}
