import { createHash } from 'node:crypto';
import type { BillingInterval, PaidPlan } from './subscription-change';

export const STRIPE_DOWNGRADE_OPERATION_METADATA_KEY = 'app_downgrade_operation_id';

export interface StripeDowngradeOperationIdentity {
  userId: number;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  fromPlan: 'pro' | 'business' | 'enterprise';
  fromBillingInterval: BillingInterval;
  sourcePeriodEndSeconds: number;
  toPlan: PaidPlan;
  toBillingInterval: BillingInterval;
  capacitySelectionVersion: 1;
  retainedBrandIds: readonly string[];
  retainedLocationIds: readonly string[];
}

function sortedPostgresIds(values: readonly string[]): string[] {
  return [...values].sort((left, right) => {
    const leftId = BigInt(left);
    const rightId = BigInt(right);
    return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
  });
}

export function stripeDowngradeRequestFingerprint(
  input: StripeDowngradeOperationIdentity,
): string {
  const canonical = JSON.stringify({
    userId: input.userId,
    stripeCustomerId: input.stripeCustomerId,
    stripeSubscriptionId: input.stripeSubscriptionId,
    fromPlan: input.fromPlan,
    fromBillingInterval: input.fromBillingInterval,
    sourcePeriodEndSeconds: input.sourcePeriodEndSeconds,
    toPlan: input.toPlan,
    toBillingInterval: input.toBillingInterval,
    capacitySelectionVersion: input.capacitySelectionVersion,
    retainedBrandIds: sortedPostgresIds(input.retainedBrandIds),
    retainedLocationIds: sortedPostgresIds(input.retainedLocationIds),
  });
  return createHash('sha256').update(canonical).digest('hex');
}

export function assertStripeDowngradeOperationId(value: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error('Stripe downgrade operation ID is invalid.');
  }
}
