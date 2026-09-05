import 'server-only';

import type postgres from 'postgres';
import type Stripe from 'stripe';
import type { DowngradeRetentionSelection } from '@/lib/plans/downgrade-capacity';
import type { BillingInterval, PaidPlan } from '@/lib/stripe/subscription-change';
import {
  assertStripeDowngradeOperationId,
  stripeDowngradeRequestFingerprint,
  type StripeDowngradeOperationIdentity,
} from '@/lib/stripe/downgrade-operations';
import {
  MANAGED_PLAN_SCHEDULE_KIND,
  MANAGED_PLAN_SCHEDULE_OWNER,
} from '@/lib/stripe/subscription-change';
import { extractStripeId } from '@/lib/stripe/subscription-state';
import { recordDeferredPlanChange } from '@/lib/stripe/subscription-plan-changes-postgres';

export type StripeDowngradeOperationSql = postgres.Sql;

export class StripeDowngradeOperationConflictError extends Error {
  readonly code = 'STRIPE_DOWNGRADE_OPERATION_CONFLICT';
  readonly status = 409;

  constructor(message: string) {
    super(message);
    this.name = 'StripeDowngradeOperationConflictError';
  }
}

interface OperationRow {
  operation_id: string;
  request_fingerprint: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  from_plan: 'pro' | 'business' | 'enterprise';
  from_billing_interval: BillingInterval;
  source_period_end_seconds: string;
  to_plan: PaidPlan;
  to_billing_interval: BillingInterval;
  capacity_selection_version: 1;
  retained_brand_ids: string[];
  retained_location_ids: string[];
  status: 'prepared' | 'completed' | 'canceled';
  stripe_schedule_id: string | null;
  effective_at: string | null;
  created_at: string;
}

export interface StripeDowngradeOperation {
  operationId: string;
  requestFingerprint: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  fromPlan: OperationRow['from_plan'];
  fromBillingInterval: BillingInterval;
  sourcePeriodEndSeconds: number;
  toPlan: PaidPlan;
  toBillingInterval: BillingInterval;
  capacitySelectionVersion: 1;
  selection: DowngradeRetentionSelection;
  status: OperationRow['status'];
  stripeScheduleId: string | null;
  effectiveAt: string | null;
  createdAt: string;
}

function mapRow(row: OperationRow): StripeDowngradeOperation {
  const sourcePeriodEndSeconds = Number(row.source_period_end_seconds);
  if (!Number.isSafeInteger(sourcePeriodEndSeconds) || sourcePeriodEndSeconds <= 0) {
    throw new Error('Stored Stripe downgrade source period is invalid.');
  }
  return {
    operationId: row.operation_id,
    requestFingerprint: row.request_fingerprint.trim(),
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    fromPlan: row.from_plan,
    fromBillingInterval: row.from_billing_interval,
    sourcePeriodEndSeconds,
    toPlan: row.to_plan,
    toBillingInterval: row.to_billing_interval,
    capacitySelectionVersion: row.capacity_selection_version,
    selection: {
      brandIds: row.retained_brand_ids.map(String),
      locationIds: row.retained_location_ids.map(String),
    },
    status: row.status,
    stripeScheduleId: row.stripe_schedule_id,
    effectiveAt: row.effective_at,
    createdAt: row.created_at,
  };
}

export async function prepareStripeDowngradeOperation(
  transaction: StripeDowngradeOperationSql,
  input: StripeDowngradeOperationIdentity & {
    operationId: string;
    attachedScheduleId?: string | null;
  },
): Promise<StripeDowngradeOperation> {
  assertStripeDowngradeOperationId(input.operationId);
  const fingerprint = stripeDowngradeRequestFingerprint(input);
  const existing = await transaction<OperationRow[]>`
    SELECT
      operation_id::text AS operation_id,
      request_fingerprint,
      stripe_customer_id,
      stripe_subscription_id,
      from_plan,
      from_billing_interval,
      source_period_end_seconds::text,
      to_plan,
      to_billing_interval,
      capacity_selection_version,
      retained_brand_ids::text[] AS retained_brand_ids,
      retained_location_ids::text[] AS retained_location_ids,
      status,
      stripe_schedule_id,
      effective_at::text AS effective_at,
      created_at::text AS created_at
    FROM crewcast.stripe_downgrade_operations
    WHERE user_id = ${input.userId}
      AND status = 'prepared'
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE
  `;
  if (existing.length === 1) {
    const operation = mapRow(existing[0]);
    if (operation.requestFingerprint !== fingerprint) {
      throw new StripeDowngradeOperationConflictError(
        'A different Stripe downgrade is already being processed for this account.',
      );
    }
    return operation;
  }

  const completed = input.attachedScheduleId
    ? await transaction<OperationRow[]>`
    SELECT
      operation_id::text AS operation_id,
      request_fingerprint,
      stripe_customer_id,
      stripe_subscription_id,
      from_plan,
      from_billing_interval,
      source_period_end_seconds::text,
      to_plan,
      to_billing_interval,
      capacity_selection_version,
      retained_brand_ids::text[] AS retained_brand_ids,
      retained_location_ids::text[] AS retained_location_ids,
      status,
      stripe_schedule_id,
      effective_at::text AS effective_at,
      created_at::text AS created_at
    FROM crewcast.stripe_downgrade_operations
    WHERE user_id = ${input.userId}
      AND request_fingerprint = ${fingerprint}
      AND status = 'completed'
      AND stripe_schedule_id = ${input.attachedScheduleId}
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE
    `
    : [];
  if (completed.length === 1) return mapRow(completed[0]);

  const inserted = await transaction<OperationRow[]>`
    INSERT INTO crewcast.stripe_downgrade_operations (
      operation_id,
      user_id,
      request_fingerprint,
      stripe_customer_id,
      stripe_subscription_id,
      from_plan,
      from_billing_interval,
      source_period_end_seconds,
      to_plan,
      to_billing_interval,
      capacity_selection_version,
      retained_brand_ids,
      retained_location_ids
    ) VALUES (
      ${input.operationId}::uuid,
      ${input.userId},
      ${fingerprint},
      ${input.stripeCustomerId},
      ${input.stripeSubscriptionId},
      ${input.fromPlan},
      ${input.fromBillingInterval},
      ${input.sourcePeriodEndSeconds},
      ${input.toPlan},
      ${input.toBillingInterval},
      ${input.capacitySelectionVersion},
      ${input.retainedBrandIds}::bigint[],
      ${input.retainedLocationIds}::bigint[]
    )
    RETURNING
      operation_id::text AS operation_id,
      request_fingerprint,
      stripe_customer_id,
      stripe_subscription_id,
      from_plan,
      from_billing_interval,
      source_period_end_seconds::text,
      to_plan,
      to_billing_interval,
      capacity_selection_version,
      retained_brand_ids::text[] AS retained_brand_ids,
      retained_location_ids::text[] AS retained_location_ids,
      status,
      stripe_schedule_id,
      effective_at::text AS effective_at,
      created_at::text AS created_at
  `;
  if (inserted.length !== 1) throw new Error('Stripe downgrade operation was not prepared exactly once.');
  return mapRow(inserted[0]);
}

export async function completeStripeDowngradeOperation(
  transaction: StripeDowngradeOperationSql,
  input: {
    userId: number;
    operationId: string;
    stripeScheduleId: string;
    effectiveAt: string;
  },
): Promise<StripeDowngradeOperation> {
  assertStripeDowngradeOperationId(input.operationId);
  const updated = await transaction<OperationRow[]>`
    UPDATE crewcast.stripe_downgrade_operations
    SET
      status = 'completed',
      stripe_schedule_id = ${input.stripeScheduleId},
      effective_at = ${input.effectiveAt}::timestamptz,
      completed_at = NOW()
    WHERE operation_id = ${input.operationId}::uuid
      AND user_id = ${input.userId}
      AND status = 'prepared'
    RETURNING
      operation_id::text AS operation_id,
      request_fingerprint,
      stripe_customer_id,
      stripe_subscription_id,
      from_plan,
      from_billing_interval,
      source_period_end_seconds::text,
      to_plan,
      to_billing_interval,
      capacity_selection_version,
      retained_brand_ids::text[] AS retained_brand_ids,
      retained_location_ids::text[] AS retained_location_ids,
      status,
      stripe_schedule_id,
      effective_at::text AS effective_at,
      created_at::text AS created_at
  `;
  if (updated.length === 1) return mapRow(updated[0]);

  const existing = await transaction<OperationRow[]>`
    SELECT
      operation_id::text AS operation_id,
      request_fingerprint,
      stripe_customer_id,
      stripe_subscription_id,
      from_plan,
      from_billing_interval,
      source_period_end_seconds::text,
      to_plan,
      to_billing_interval,
      capacity_selection_version,
      retained_brand_ids::text[] AS retained_brand_ids,
      retained_location_ids::text[] AS retained_location_ids,
      status,
      stripe_schedule_id,
      effective_at::text AS effective_at,
      created_at::text AS created_at
    FROM crewcast.stripe_downgrade_operations
    WHERE operation_id = ${input.operationId}::uuid
      AND user_id = ${input.userId}
    LIMIT 1
    FOR UPDATE
  `;
  if (
    existing.length === 1
    && existing[0].status === 'completed'
    && existing[0].stripe_schedule_id === input.stripeScheduleId
    && existing[0].effective_at !== null
    && Date.parse(existing[0].effective_at) === Date.parse(input.effectiveAt)
  ) {
    return mapRow(existing[0]);
  }
  throw new Error('Stripe downgrade operation could not be completed safely.');
}

/**
 * Binds the Stripe schedule created for a prepared downgrade before its phases
 * are configured. This closes the create/update crash window: a retry can use
 * only the exact schedule already recorded for this immutable operation.
 */
export async function bindStripeDowngradeOperationSchedule(
  transaction: StripeDowngradeOperationSql,
  input: {
    userId: number;
    operationId: string;
    stripeScheduleId: string;
  },
): Promise<StripeDowngradeOperation> {
  assertStripeDowngradeOperationId(input.operationId);
  const updated = await transaction<OperationRow[]>`
    UPDATE crewcast.stripe_downgrade_operations
    SET stripe_schedule_id = ${input.stripeScheduleId}
    WHERE operation_id = ${input.operationId}::uuid
      AND user_id = ${input.userId}
      AND status = 'prepared'
      AND stripe_schedule_id IS NULL
    RETURNING
      operation_id::text AS operation_id,
      request_fingerprint,
      stripe_customer_id,
      stripe_subscription_id,
      from_plan,
      from_billing_interval,
      source_period_end_seconds::text,
      to_plan,
      to_billing_interval,
      capacity_selection_version,
      retained_brand_ids::text[] AS retained_brand_ids,
      retained_location_ids::text[] AS retained_location_ids,
      status,
      stripe_schedule_id,
      effective_at::text AS effective_at,
      created_at::text AS created_at
  `;
  if (updated.length === 1) return mapRow(updated[0]);

  const existing = await transaction<OperationRow[]>`
    SELECT
      operation_id::text AS operation_id,
      request_fingerprint,
      stripe_customer_id,
      stripe_subscription_id,
      from_plan,
      from_billing_interval,
      source_period_end_seconds::text,
      to_plan,
      to_billing_interval,
      capacity_selection_version,
      retained_brand_ids::text[] AS retained_brand_ids,
      retained_location_ids::text[] AS retained_location_ids,
      status,
      stripe_schedule_id,
      effective_at::text AS effective_at,
      created_at::text AS created_at
    FROM crewcast.stripe_downgrade_operations
    WHERE operation_id = ${input.operationId}::uuid
      AND user_id = ${input.userId}
    LIMIT 1
    FOR UPDATE
  `;
  if (
    existing.length === 1
    && existing[0].status === 'prepared'
    && existing[0].stripe_schedule_id === input.stripeScheduleId
  ) {
    return mapRow(existing[0]);
  }
  throw new StripeDowngradeOperationConflictError(
    'The prepared downgrade is already bound to a different Stripe schedule.',
  );
}

export async function readPreparedStripeDowngradeOperation(
  transaction: StripeDowngradeOperationSql,
  input: { userId: number; operationId: string },
): Promise<StripeDowngradeOperation | null> {
  assertStripeDowngradeOperationId(input.operationId);
  const rows = await transaction<OperationRow[]>`
    SELECT
      operation_id::text AS operation_id,
      request_fingerprint,
      stripe_customer_id,
      stripe_subscription_id,
      from_plan,
      from_billing_interval,
      source_period_end_seconds::text,
      to_plan,
      to_billing_interval,
      capacity_selection_version,
      retained_brand_ids::text[] AS retained_brand_ids,
      retained_location_ids::text[] AS retained_location_ids,
      status,
      stripe_schedule_id,
      effective_at::text AS effective_at,
      created_at::text AS created_at
    FROM crewcast.stripe_downgrade_operations
    WHERE operation_id = ${input.operationId}::uuid
      AND user_id = ${input.userId}
      AND status = 'prepared'
    LIMIT 1
    FOR UPDATE
  `;
  return rows.length === 1 ? mapRow(rows[0]) : null;
}

/**
 * Completes a prepared database operation from an authoritative Stripe schedule.
 * This is the webhook recovery path for a server process that stopped after
 * Stripe accepted the schedule but before the request transaction committed.
 */
export async function recoverPreparedStripeDowngradeOperation(
  transaction: StripeDowngradeOperationSql,
  input: { userId: number; schedule: Stripe.SubscriptionSchedule },
): Promise<'none' | 'completed'> {
  const metadata = input.schedule.metadata;
  const operationId = metadata?.app_downgrade_operation_id;
  if (!operationId) return 'none';
  if (
    metadata.managed_by !== MANAGED_PLAN_SCHEDULE_OWNER
    || metadata.change_kind !== MANAGED_PLAN_SCHEDULE_KIND
    || metadata.account_id !== String(input.userId)
  ) {
    throw new Error('Stripe downgrade schedule ownership metadata is invalid.');
  }
  const operation = await readPreparedStripeDowngradeOperation(transaction, {
    userId: input.userId,
    operationId,
  });
  if (!operation) return 'none';

  const scheduleSubscriptionId = extractStripeId(input.schedule.subscription);
  const effectiveAtSeconds = Number(metadata.effective_at);
  if (
    scheduleSubscriptionId !== operation.stripeSubscriptionId
    || metadata.target_plan !== operation.toPlan
    || metadata.target_billing_interval !== operation.toBillingInterval
    || !Number.isSafeInteger(effectiveAtSeconds)
    || effectiveAtSeconds <= 0
    || effectiveAtSeconds !== operation.sourcePeriodEndSeconds
    || input.schedule.status !== 'active'
  ) {
    throw new Error('Stripe downgrade schedule does not match its prepared database operation.');
  }
  const effectiveAt = new Date(effectiveAtSeconds * 1000).toISOString();
  await recordDeferredPlanChange(transaction, {
    userId: input.userId,
    stripeSubscriptionId: operation.stripeSubscriptionId,
    stripeScheduleId: input.schedule.id,
    fromPlan: operation.fromPlan,
    fromBillingInterval: operation.fromBillingInterval,
    toPlan: operation.toPlan,
    toBillingInterval: operation.toBillingInterval,
    effectiveAt,
    capacitySelectionVersion: operation.capacitySelectionVersion,
    retainedBrandIds: operation.selection.brandIds,
    retainedLocationIds: operation.selection.locationIds,
  });
  await completeStripeDowngradeOperation(transaction, {
    userId: input.userId,
    operationId: operation.operationId,
    stripeScheduleId: input.schedule.id,
    effectiveAt,
  });
  return 'completed';
}
