import type postgres from 'postgres';
import {
  reconcileAppliedDowngradeCapacity,
} from './downgrade-capacity-postgres';
import type { BillingInterval, PaidPlan } from './subscription-change';

export type SubscriptionPlanChangeSql = postgres.Sql;

export interface PendingSubscriptionPlanChange {
  id: string;
  stripeSubscriptionId: string;
  stripeScheduleId: string;
  fromPlan: 'pro' | 'business' | 'enterprise';
  fromBillingInterval: BillingInterval;
  toPlan: PaidPlan;
  toBillingInterval: BillingInterval;
  effectiveAt: string;
  capacitySelectionVersion: 1 | null;
  retainedBrandIds: string[];
  retainedLocationIds: string[];
}

interface PendingRow {
  id: unknown;
  stripe_subscription_id: unknown;
  stripe_schedule_id: unknown;
  from_plan: unknown;
  from_billing_interval: unknown;
  to_plan: unknown;
  to_billing_interval: unknown;
  effective_at: unknown;
  capacity_selection_version: unknown;
  retained_brand_ids: unknown;
  retained_location_ids: unknown;
}

function readText(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} is invalid.`);
  }
  return value;
}

function readPlan(value: unknown, label: string): PendingSubscriptionPlanChange['fromPlan'] {
  if (value !== 'pro' && value !== 'business' && value !== 'enterprise') {
    throw new Error(`${label} is invalid.`);
  }
  return value;
}

function readPaidPlan(value: unknown, label: string): PaidPlan {
  if (value !== 'pro' && value !== 'business') throw new Error(`${label} is invalid.`);
  return value;
}

function readInterval(value: unknown, label: string): BillingInterval {
  if (value !== 'monthly' && value !== 'annual') throw new Error(`${label} is invalid.`);
  return value;
}

function readBigintArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${label} is invalid.`);
  const normalized = value.map((item) => {
    const candidate = typeof item === 'number' ? String(item) : item;
    if (typeof candidate !== 'string' || !/^[1-9][0-9]*$/.test(candidate)) {
      throw new Error(`${label} is invalid.`);
    }
    return BigInt(candidate).toString();
  });
  if (new Set(normalized).size !== normalized.length) {
    throw new Error(`${label} contains duplicate identifiers.`);
  }
  return normalized;
}

function mapPendingRow(row: PendingRow): PendingSubscriptionPlanChange {
  const selectionVersion = row.capacity_selection_version === null
    ? null
    : Number(row.capacity_selection_version);
  if (selectionVersion !== null && selectionVersion !== 1) {
    throw new Error('Plan-change capacity selection version is invalid.');
  }
  if (
    selectionVersion === null
    && (row.retained_brand_ids !== null || row.retained_location_ids !== null)
  ) {
    throw new Error('Legacy plan change unexpectedly contains a capacity selection.');
  }
  return {
    id: readText(row.id, 'Plan-change ID'),
    stripeSubscriptionId: readText(row.stripe_subscription_id, 'Stripe subscription ID'),
    stripeScheduleId: readText(row.stripe_schedule_id, 'Stripe schedule ID'),
    fromPlan: readPlan(row.from_plan, 'Plan-change source plan'),
    fromBillingInterval: readInterval(row.from_billing_interval, 'Plan-change source interval'),
    toPlan: readPaidPlan(row.to_plan, 'Plan-change target plan'),
    toBillingInterval: readInterval(row.to_billing_interval, 'Plan-change target interval'),
    effectiveAt: readText(row.effective_at, 'Plan-change effective time'),
    capacitySelectionVersion: selectionVersion,
    retainedBrandIds: selectionVersion === null
      ? []
      : readBigintArray(row.retained_brand_ids, 'Retained brand IDs'),
    retainedLocationIds: selectionVersion === null
      ? []
      : readBigintArray(row.retained_location_ids, 'Retained location IDs'),
  };
}

function pendingColumns(executor: SubscriptionPlanChangeSql) {
  return executor`
    id::text AS id,
    stripe_subscription_id,
    stripe_schedule_id,
    from_plan,
    from_billing_interval,
    to_plan,
    to_billing_interval,
    effective_at::text AS effective_at,
    capacity_selection_version,
    retained_brand_ids::text[] AS retained_brand_ids,
    retained_location_ids::text[] AS retained_location_ids
  `;
}

export async function readPendingSubscriptionPlanChange(
  executor: SubscriptionPlanChangeSql,
  userId: number,
): Promise<PendingSubscriptionPlanChange | null> {
  const rows = await executor<PendingRow[]>`
    SELECT ${pendingColumns(executor)}
    FROM crewcast.subscription_plan_changes
    WHERE user_id = ${userId}
      AND status = 'pending'
    ORDER BY id DESC
    LIMIT 2
  `;
  if (rows.length > 1) throw new Error('An account has multiple pending plan changes.');
  return rows[0] ? mapPendingRow(rows[0]) : null;
}

interface RecordDeferredPlanChangeBase {
  userId: number;
  stripeSubscriptionId: string;
  stripeScheduleId: string;
  fromPlan: PendingSubscriptionPlanChange['fromPlan'];
  fromBillingInterval: BillingInterval;
  toPlan: PaidPlan;
  toBillingInterval: BillingInterval;
  effectiveAt: string;
}

export type RecordDeferredPlanChangeInput = RecordDeferredPlanChangeBase & (
  | {
      capacitySelectionVersion: 1;
      retainedBrandIds: string[];
      retainedLocationIds: string[];
    }
  | {
      // Rolling-deployment compatibility for a still-running pre-0020 server.
      // New application requests always use version 1.
      capacitySelectionVersion?: undefined;
      retainedBrandIds?: undefined;
      retainedLocationIds?: undefined;
    }
);

/**
 * Stores the Stripe future transition as a durable application fact. Callers
 * must already hold the account's subscription advisory lock. Repeating the
 * exact same request is idempotent; changing the target closes the old audit
 * row before creating the replacement.
 */
export async function recordDeferredPlanChange(
  executor: SubscriptionPlanChangeSql,
  input: RecordDeferredPlanChangeInput,
): Promise<PendingSubscriptionPlanChange> {
  const existingRows = await executor<PendingRow[]>`
    SELECT ${pendingColumns(executor)}
    FROM crewcast.subscription_plan_changes
    WHERE user_id = ${input.userId}
      AND status = 'pending'
    ORDER BY id DESC
    LIMIT 2
    FOR UPDATE
  `;
  if (existingRows.length > 1) throw new Error('An account has multiple pending plan changes.');
  const existing = existingRows[0] ? mapPendingRow(existingRows[0]) : null;
  const effectiveAtMs = Date.parse(input.effectiveAt);
  if (!Number.isFinite(effectiveAtMs)) throw new Error('Deferred plan effective time is invalid.');
  const capacitySelectionVersion = input.capacitySelectionVersion ?? null;
  const retainedBrandIds = input.retainedBrandIds ?? null;
  const retainedLocationIds = input.retainedLocationIds ?? null;

  if (
    existing
    && existing.stripeSubscriptionId === input.stripeSubscriptionId
    && existing.stripeScheduleId === input.stripeScheduleId
    && existing.fromPlan === input.fromPlan
    && existing.fromBillingInterval === input.fromBillingInterval
    && existing.toPlan === input.toPlan
    && existing.toBillingInterval === input.toBillingInterval
    && Date.parse(existing.effectiveAt) === effectiveAtMs
    && existing.capacitySelectionVersion === capacitySelectionVersion
    && JSON.stringify(existing.retainedBrandIds) === JSON.stringify(retainedBrandIds ?? [])
    && JSON.stringify(existing.retainedLocationIds) === JSON.stringify(retainedLocationIds ?? [])
  ) {
    return existing;
  }

  if (existing) {
    const canceled = await executor<{ id: unknown }[]>`
      UPDATE crewcast.subscription_plan_changes
      SET status = 'canceled', canceled_at = NOW()
      WHERE id = ${existing.id}::bigint
        AND user_id = ${input.userId}
        AND status = 'pending'
      RETURNING id
    `;
    if (canceled.length !== 1) throw new Error('Pending plan change could not be replaced safely.');
  }

  const inserted = await executor<PendingRow[]>`
    INSERT INTO crewcast.subscription_plan_changes (
      user_id,
      stripe_subscription_id,
      stripe_schedule_id,
      from_plan,
      from_billing_interval,
      to_plan,
      to_billing_interval,
      effective_at,
      capacity_selection_version,
      retained_brand_ids,
      retained_location_ids
    )
    VALUES (
      ${input.userId},
      ${input.stripeSubscriptionId},
      ${input.stripeScheduleId},
      ${input.fromPlan},
      ${input.fromBillingInterval},
      ${input.toPlan},
      ${input.toBillingInterval},
      ${input.effectiveAt}::timestamptz,
      ${capacitySelectionVersion},
      ${retainedBrandIds}::bigint[],
      ${retainedLocationIds}::bigint[]
    )
    RETURNING
      id::text AS id,
      stripe_subscription_id,
      stripe_schedule_id,
      from_plan,
      from_billing_interval,
      to_plan,
      to_billing_interval,
      effective_at::text AS effective_at,
      capacity_selection_version,
      retained_brand_ids::text[] AS retained_brand_ids,
      retained_location_ids::text[] AS retained_location_ids
  `;
  if (inserted.length !== 1) throw new Error('Deferred plan change was not recorded exactly once.');
  return mapPendingRow(inserted[0]);
}

export async function cancelPendingSubscriptionPlanChange(
  executor: SubscriptionPlanChangeSql,
  userId: number,
  stripeScheduleId?: string,
): Promise<number> {
  const rows = await executor<{ id: unknown }[]>`
    UPDATE crewcast.subscription_plan_changes
    SET status = 'canceled', canceled_at = NOW()
    WHERE user_id = ${userId}
      AND status = 'pending'
      AND (${stripeScheduleId ?? null}::text IS NULL OR stripe_schedule_id = ${stripeScheduleId ?? null})
    RETURNING id
  `;
  if (rows.length > 1) throw new Error('More than one pending plan change was canceled.');
  return rows.length;
}

export type PendingPlanSyncOutcome = 'none' | 'pending' | 'applied' | 'canceled';

export async function synchronizePendingSubscriptionPlanChange(
  executor: SubscriptionPlanChangeSql,
  input: {
    userId: number;
    stripeSubscriptionId: string;
    stripeScheduleId: string | null;
    currentPlan: PendingSubscriptionPlanChange['fromPlan'];
    currentBillingInterval: BillingInterval | null;
  },
): Promise<PendingPlanSyncOutcome> {
  const candidate = executor as unknown as {
    begin?: <T>(callback: (transaction: SubscriptionPlanChangeSql) => Promise<T>) => Promise<T>;
    savepoint?: <T>(callback: (transaction: SubscriptionPlanChangeSql) => Promise<T>) => Promise<T>;
  };
  const operation = async (transaction: SubscriptionPlanChangeSql): Promise<PendingPlanSyncOutcome> => {
    const pending = await readPendingSubscriptionPlanChange(transaction, input.userId);
    if (!pending) return 'none';

    const sameSubscription = input.stripeSubscriptionId === pending.stripeSubscriptionId;
    const reachedTarget = sameSubscription
      && input.currentPlan === pending.toPlan
      && input.currentBillingInterval === pending.toBillingInterval;
    if (reachedTarget) {
      if (pending.capacitySelectionVersion === 1) {
        await reconcileAppliedDowngradeCapacity(transaction, {
          userId: input.userId,
          planChangeId: pending.id,
          targetPlan: pending.toPlan,
          selection: {
            brandIds: pending.retainedBrandIds,
            locationIds: pending.retainedLocationIds,
          },
        });
      }
      const rows = await transaction<{ id: unknown }[]>`
        UPDATE crewcast.subscription_plan_changes
        SET
          status = 'applied',
          applied_at = NOW(),
          capacity_reconciled_at = CASE
            WHEN capacity_selection_version = 1 THEN NOW()
            ELSE NULL
          END
        WHERE id = ${pending.id}::bigint
          AND user_id = ${input.userId}
          AND status = 'pending'
        RETURNING id
      `;
      if (rows.length !== 1) throw new Error('Applied plan change was not settled exactly once.');
      return 'applied';
    }

    const scheduleStillAttached = sameSubscription
      && input.stripeScheduleId === pending.stripeScheduleId;
    if (scheduleStillAttached) return 'pending';

    const rows = await transaction<{ id: unknown }[]>`
      UPDATE crewcast.subscription_plan_changes
      SET status = 'canceled', canceled_at = NOW()
      WHERE id = ${pending.id}::bigint
        AND user_id = ${input.userId}
        AND status = 'pending'
      RETURNING id
    `;
    if (rows.length !== 1) throw new Error('Detached plan change was not canceled exactly once.');
    return 'canceled';
  };

  if (typeof candidate.savepoint === 'function') return candidate.savepoint(operation);
  if (typeof candidate.begin === 'function') return candidate.begin(operation);
  throw new Error('Plan-change synchronization requires a database transaction.');
}
