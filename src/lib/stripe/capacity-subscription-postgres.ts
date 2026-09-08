import 'server-only';

import type postgres from 'postgres';
import type { StripeCapacitySubscriptionSnapshot } from './capacity-subscription';

export type CapacitySubscriptionPostgresSql = postgres.Sql;

function unixSecondsToIso(value: number | null): string | null {
  return value === null ? null : new Date(value * 1000).toISOString();
}

/** Persists only a capacity snapshot that already passed Stripe validation. */
export async function persistStripeCapacitySubscriptionSnapshot(
  transaction: CapacitySubscriptionPostgresSql,
  userId: number,
  snapshot: StripeCapacitySubscriptionSnapshot,
): Promise<void> {
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new Error('Capacity subscription account ID is invalid.');
  }
  const synchronized = await transaction<{ user_id: number }[]>`
    INSERT INTO crewcast.stripe_capacity_subscriptions (
      user_id,
      stripe_customer_id,
      stripe_subscription_id,
      stripe_brand_item_id,
      stripe_location_item_id,
      status,
      extra_brand_quantity,
      extra_location_quantity,
      current_period_end,
      cancel_at,
      cancel_at_period_end
    ) VALUES (
      ${userId},
      ${snapshot.customerId},
      ${snapshot.subscriptionId},
      ${snapshot.brandItemId},
      ${snapshot.locationItemId},
      ${snapshot.status},
      ${snapshot.extraBrands},
      ${snapshot.extraLocations},
      ${unixSecondsToIso(snapshot.currentPeriodEndSeconds)}::timestamptz,
      ${unixSecondsToIso(snapshot.cancelAtSeconds)}::timestamptz,
      ${snapshot.cancelAtPeriodEnd}
    )
    ON CONFLICT (user_id) DO UPDATE
    SET
      stripe_customer_id = EXCLUDED.stripe_customer_id,
      stripe_subscription_id = EXCLUDED.stripe_subscription_id,
      stripe_brand_item_id = EXCLUDED.stripe_brand_item_id,
      stripe_location_item_id = EXCLUDED.stripe_location_item_id,
      status = EXCLUDED.status,
      extra_brand_quantity = EXCLUDED.extra_brand_quantity,
      extra_location_quantity = EXCLUDED.extra_location_quantity,
      current_period_end = EXCLUDED.current_period_end,
      cancel_at = EXCLUDED.cancel_at,
      cancel_at_period_end = EXCLUDED.cancel_at_period_end,
      updated_at = NOW()
    WHERE crewcast.stripe_capacity_subscriptions.stripe_subscription_id
            = EXCLUDED.stripe_subscription_id
       OR crewcast.stripe_capacity_subscriptions.status
            IN ('incomplete_expired', 'canceled', 'unpaid')
    RETURNING user_id
  `;
  if (synchronized.length !== 1 || synchronized[0].user_id !== userId) {
    throw new Error(`Stripe capacity state did not update account ${userId}.`);
  }
}
