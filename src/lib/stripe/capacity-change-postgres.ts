import 'server-only';

import type postgres from 'postgres';
import {
  capacityChangeRequestFingerprint,
  type CapacityBasePlan,
  type CapacityChangeIdentity,
} from './capacity-change';

export type CapacityChangeSql = postgres.Sql;
export type CapacityChangeOperationStatus =
  | 'prepared'
  | 'pending_payment'
  | 'completed'
  | 'canceled';
export type CapacityChangeReason = 'customer_change' | 'payment_failure' | 'base_ended';

const OPERATION_STATUSES = new Set<CapacityChangeOperationStatus>([
  'prepared',
  'pending_payment',
  'completed',
  'canceled',
]);
const OPERATION_REASONS = new Set<CapacityChangeReason>([
  'customer_change',
  'payment_failure',
  'base_ended',
]);

interface CapacityChangeOperationRow {
  operation_id: string;
  user_id: unknown;
  request_fingerprint: string;
  stripe_customer_id: string;
  stripe_base_subscription_id: string;
  base_plan: unknown;
  stripe_subscription_id: string | null;
  stripe_invoice_id: string | null;
  from_extra_brand_quantity: unknown;
  from_extra_location_quantity: unknown;
  to_extra_brand_quantity: unknown;
  to_extra_location_quantity: unknown;
  proration_date_seconds: unknown;
  capacity_selection_version: unknown;
  retained_brand_ids: unknown;
  retained_location_ids: unknown;
  reason: unknown;
  status: unknown;
  expires_at: string;
  completed_at: string | null;
  canceled_at: string | null;
  created_at: string;
}

interface CapacityBillingOwnerRow {
  id: unknown;
  stripe_customer_id: unknown;
  stripe_subscription_id: unknown;
  plan: unknown;
  status: unknown;
}

export interface CapacityBillingOwner {
  userId: number;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  plan: CapacityBasePlan;
  status: string;
}

export interface CapacityChangeOperation extends CapacityChangeIdentity {
  requestFingerprint: string;
  stripeInvoiceId: string | null;
  reason: CapacityChangeReason;
  status: CapacityChangeOperationStatus;
  expiresAt: string;
  completedAt: string | null;
  canceledAt: string | null;
  createdAt: string;
}

export class CapacityChangeOperationConflictError extends Error {
  readonly code = 'CAPACITY_CHANGE_CONFLICT';
  readonly status = 409;

  constructor(message: string) {
    super(message);
    this.name = 'CapacityChangeOperationConflictError';
  }
}

function readInteger(value: unknown, label: string, minimum = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum) {
    throw new Error(`Stored ${label} is invalid.`);
  }
  return parsed;
}

function readNullableIdArray(value: unknown, label: string): string[] | null {
  if (value === null) return null;
  if (!Array.isArray(value)) throw new Error(`Stored ${label} is invalid.`);
  return value.map((item) => {
    const id = String(item);
    if (!/^[1-9][0-9]{0,18}$/.test(id)) {
      throw new Error(`Stored ${label} contains an invalid identifier.`);
    }
    return id;
  });
}

function readTimestamp(value: unknown, label: string): string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new Error(`Stored ${label} is invalid.`);
  }
  return value;
}

function readNullableTimestamp(value: unknown, label: string): string | null {
  return value === null ? null : readTimestamp(value, label);
}

function readIdentifier(value: unknown, pattern: RegExp, label: string): string {
  if (typeof value !== 'string' || !pattern.test(value)) {
    throw new Error(`Stored ${label} is invalid.`);
  }
  return value;
}

function readNullableIdentifier(
  value: unknown,
  pattern: RegExp,
  label: string,
): string | null {
  return value === null ? null : readIdentifier(value, pattern, label);
}

function readOperationStatus(value: unknown): CapacityChangeOperationStatus {
  if (typeof value !== 'string' || !OPERATION_STATUSES.has(value as CapacityChangeOperationStatus)) {
    throw new Error('Stored paid-capacity operation status is invalid.');
  }
  return value as CapacityChangeOperationStatus;
}

function readOperationReason(value: unknown): CapacityChangeReason {
  if (typeof value !== 'string' || !OPERATION_REASONS.has(value as CapacityChangeReason)) {
    throw new Error('Stored paid-capacity operation reason is invalid.');
  }
  return value as CapacityChangeReason;
}

function readBasePlan(value: unknown): CapacityBasePlan {
  if (value !== 'pro' && value !== 'business') {
    throw new Error('Stored paid-capacity base plan is invalid.');
  }
  return value;
}

function mapBillingOwner(row: CapacityBillingOwnerRow): CapacityBillingOwner {
  if (row.plan !== 'pro' && row.plan !== 'business') {
    throw new Error('Paid capacity requires a stored Pro or Business plan.');
  }
  if (typeof row.status !== 'string' || row.status.length === 0) {
    throw new Error('Stored base subscription status is invalid.');
  }
  return {
    userId: readInteger(row.id, 'account ID', 1),
    stripeCustomerId: readIdentifier(
      row.stripe_customer_id,
      /^cus_[A-Za-z0-9]+$/,
      'Stripe customer ID',
    ),
    stripeSubscriptionId: readIdentifier(
      row.stripe_subscription_id,
      /^sub_[A-Za-z0-9]+$/,
      'Stripe base subscription ID',
    ),
    plan: row.plan,
    status: row.status,
  };
}

async function selectCapacityBillingOwner(
  executor: CapacityChangeSql,
  userId: number,
  lock: boolean,
): Promise<CapacityBillingOwner | null> {
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new Error('Paid-capacity account ID is invalid.');
  }
  const accounts = await executor<{ id: unknown }[]>`
    SELECT id
    FROM crewcast.users
    WHERE id = ${userId}
    LIMIT 2
    ${lock ? executor`FOR UPDATE` : executor``}
  `;
  if (accounts.length > 1) throw new Error('Application account identity is duplicated.');
  if (accounts.length === 0) return null;

  const subscriptions = await executor<CapacityBillingOwnerRow[]>`
    SELECT
      ${userId} AS id,
      stripe_customer_id,
      stripe_subscription_id,
      plan,
      status
    FROM crewcast.subscriptions
    WHERE user_id = ${userId}
    ORDER BY id
    LIMIT 2
    ${lock ? executor`FOR UPDATE` : executor``}
  `;
  if (subscriptions.length !== 1) {
    throw new Error('Paid capacity requires exactly one stored base subscription.');
  }
  return mapBillingOwner(subscriptions[0]);
}

export function readCapacityBillingOwner(
  executor: CapacityChangeSql,
  userId: number,
): Promise<CapacityBillingOwner | null> {
  return selectCapacityBillingOwner(executor, userId, false);
}

export async function lockCapacityBillingOwner(
  transaction: CapacityChangeSql,
  expected: CapacityBillingOwner,
): Promise<CapacityBillingOwner> {
  await transaction`
    SELECT pg_advisory_xact_lock(
      hashtextextended(${`stripe-subscription:${expected.stripeCustomerId}`}, 0)
    )
  `;
  const locked = await selectCapacityBillingOwner(transaction, expected.userId, true);
  if (
    !locked
    || locked.stripeCustomerId !== expected.stripeCustomerId
    || locked.stripeSubscriptionId !== expected.stripeSubscriptionId
    || locked.plan !== expected.plan
    || locked.status !== expected.status
  ) {
    throw new CapacityChangeOperationConflictError(
      'The account subscription changed while paid capacity was being prepared.',
    );
  }
  return locked;
}

export async function assertNoPendingBasePlanChange(
  transaction: CapacityChangeSql,
  userId: number,
): Promise<void> {
  const rows = await transaction<{ conflict: unknown }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM crewcast.subscription_plan_changes
      WHERE user_id = ${userId}
        AND status = 'pending'
      UNION ALL
      SELECT 1
      FROM crewcast.stripe_downgrade_operations
      WHERE user_id = ${userId}
        AND status = 'prepared'
    ) AS conflict
  `;
  if (rows.length !== 1 || typeof rows[0].conflict !== 'boolean') {
    throw new Error('Pending base-plan change check returned invalid state.');
  }
  if (rows[0].conflict) {
    throw new CapacityChangeOperationConflictError(
      'Finish or cancel the pending plan change before changing paid capacity.',
    );
  }
}

/**
 * Serializes base-plan changes with paid-capacity changes for one account.
 * Expired quotes that never reached Stripe are safe to retire automatically;
 * a payment-waiting operation remains blocking until Stripe is reconciled.
 */
export async function assertNoOpenPaidCapacityChange(
  transaction: CapacityChangeSql,
  userId: number,
): Promise<void> {
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new Error('Paid-capacity interlock account ID is invalid.');
  }
  await transaction`
    UPDATE crewcast.stripe_capacity_change_operations
    SET status = 'canceled', canceled_at = NOW()
    WHERE user_id = ${userId}
      AND status = 'prepared'
      AND expires_at <= NOW()
  `;
  const rows = await transaction<{ conflict: unknown }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM crewcast.stripe_capacity_change_operations
      WHERE user_id = ${userId}
        AND status IN ('prepared', 'pending_payment')
    ) AS conflict
  `;
  if (rows.length !== 1 || typeof rows[0].conflict !== 'boolean') {
    throw new Error('Open paid-capacity change check returned invalid state.');
  }
  if (rows[0].conflict) {
    throw new CapacityChangeOperationConflictError(
      'Finish or cancel the paid-capacity change before changing the base plan.',
    );
  }
}

function mapOperation(row: CapacityChangeOperationRow): CapacityChangeOperation {
  const capacitySelectionVersion = row.capacity_selection_version === null
    ? null
    : readInteger(row.capacity_selection_version, 'capacity selection version', 1);
  if (capacitySelectionVersion !== null && capacitySelectionVersion !== 1) {
    throw new Error('Stored capacity selection version is unsupported.');
  }
  const operation: CapacityChangeOperation = {
    operationId: readIdentifier(
      row.operation_id,
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      'paid-capacity operation ID',
    ),
    userId: readInteger(row.user_id, 'account ID', 1),
    requestFingerprint: readIdentifier(
      row.request_fingerprint.trim(),
      /^[0-9a-f]{64}$/,
      'paid-capacity request fingerprint',
    ),
    stripeCustomerId: readIdentifier(
      row.stripe_customer_id,
      /^cus_[A-Za-z0-9]+$/,
      'Stripe customer ID',
    ),
    stripeBaseSubscriptionId: readIdentifier(
      row.stripe_base_subscription_id,
      /^sub_[A-Za-z0-9]+$/,
      'Stripe base subscription ID',
    ),
    basePlan: readBasePlan(row.base_plan),
    stripeSubscriptionId: readNullableIdentifier(
      row.stripe_subscription_id,
      /^sub_[A-Za-z0-9]+$/,
      'Stripe capacity subscription ID',
    ),
    stripeInvoiceId: readNullableIdentifier(
      row.stripe_invoice_id,
      /^in_[A-Za-z0-9]+$/,
      'Stripe invoice ID',
    ),
    from: {
      extraBrands: readInteger(row.from_extra_brand_quantity, 'source extra-brand quantity'),
      extraLocations: readInteger(row.from_extra_location_quantity, 'source extra-location quantity'),
    },
    to: {
      extraBrands: readInteger(row.to_extra_brand_quantity, 'target extra-brand quantity'),
      extraLocations: readInteger(row.to_extra_location_quantity, 'target extra-location quantity'),
    },
    prorationDateSeconds: readInteger(row.proration_date_seconds, 'proration date', 1),
    capacitySelectionVersion,
    retainedBrandIds: readNullableIdArray(row.retained_brand_ids, 'retained brand IDs'),
    retainedLocationIds: readNullableIdArray(row.retained_location_ids, 'retained location IDs'),
    reason: readOperationReason(row.reason),
    status: readOperationStatus(row.status),
    expiresAt: readTimestamp(row.expires_at, 'paid-capacity operation expiry'),
    completedAt: readNullableTimestamp(row.completed_at, 'paid-capacity completion time'),
    canceledAt: readNullableTimestamp(row.canceled_at, 'paid-capacity cancellation time'),
    createdAt: readTimestamp(row.created_at, 'paid-capacity creation time'),
  };
  return operation;
}

function sameIds(left: readonly string[] | null, right: readonly string[] | null): boolean {
  if (left === null || right === null) return left === right;
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function isSameOperationRequest(
  operation: CapacityChangeOperation,
  input: CapacityChangeIdentity,
): boolean {
  return operation.userId === input.userId
    && operation.stripeCustomerId === input.stripeCustomerId
    && operation.stripeBaseSubscriptionId === input.stripeBaseSubscriptionId
    && operation.basePlan === input.basePlan
    && operation.stripeSubscriptionId === input.stripeSubscriptionId
    && operation.from.extraBrands === input.from.extraBrands
    && operation.from.extraLocations === input.from.extraLocations
    && operation.to.extraBrands === input.to.extraBrands
    && operation.to.extraLocations === input.to.extraLocations
    && operation.capacitySelectionVersion === input.capacitySelectionVersion
    && sameIds(operation.retainedBrandIds, input.retainedBrandIds)
    && sameIds(operation.retainedLocationIds, input.retainedLocationIds);
}

const OPERATION_COLUMNS = `
  operation_id::text AS operation_id,
  user_id,
  request_fingerprint,
  stripe_customer_id,
  stripe_base_subscription_id,
  base_plan,
  stripe_subscription_id,
  stripe_invoice_id,
  from_extra_brand_quantity,
  from_extra_location_quantity,
  to_extra_brand_quantity,
  to_extra_location_quantity,
  proration_date_seconds,
  capacity_selection_version,
  retained_brand_ids::text[] AS retained_brand_ids,
  retained_location_ids::text[] AS retained_location_ids,
  reason,
  status,
  expires_at::text AS expires_at,
  completed_at::text AS completed_at,
  canceled_at::text AS canceled_at,
  created_at::text AS created_at
`;

/**
 * Writes the immutable operation before any Stripe mutation. The caller must
 * already hold the account/subscription row lock; the partial unique index is
 * a second guard against two open changes for one account.
 */
export async function prepareCapacityChangeOperation(
  transaction: CapacityChangeSql,
  input: CapacityChangeIdentity & {
    reason?: CapacityChangeReason;
    expiresAt: string;
    replacePrepared?: boolean;
  },
): Promise<CapacityChangeOperation> {
  const requestFingerprint = capacityChangeRequestFingerprint(input);
  if (!Number.isFinite(Date.parse(input.expiresAt)) || Date.parse(input.expiresAt) <= Date.now()) {
    throw new Error('Paid-capacity operation expiry is invalid.');
  }

  await transaction`
    UPDATE crewcast.stripe_capacity_change_operations
    SET status = 'canceled', canceled_at = NOW()
    WHERE user_id = ${input.userId}
      AND status IN ('prepared', 'pending_payment')
      AND expires_at <= NOW()
  `;

  const existing = await transaction<CapacityChangeOperationRow[]>`
    SELECT ${transaction.unsafe(OPERATION_COLUMNS)}
    FROM crewcast.stripe_capacity_change_operations
    WHERE user_id = ${input.userId}
      AND status IN ('prepared', 'pending_payment')
    ORDER BY created_at DESC
    LIMIT 2
    FOR UPDATE
  `;
  if (existing.length > 1) {
    throw new Error('More than one open paid-capacity operation exists for this account.');
  }
  if (existing.length === 1) {
    const operation = mapOperation(existing[0]);
    if (operation.operationId === input.operationId) {
      if (!isSameOperationRequest(operation, input)) {
        throw new CapacityChangeOperationConflictError(
          'This paid-capacity request ID was already used for different quantities.',
        );
      }
      return operation;
    }
    if (operation.requestFingerprint !== requestFingerprint) {
      if (operation.status === 'prepared' && input.replacePrepared === true) {
        await transaction`
          UPDATE crewcast.stripe_capacity_change_operations
          SET status = 'canceled', canceled_at = NOW()
          WHERE operation_id = ${operation.operationId}::uuid
            AND user_id = ${input.userId}
            AND status = 'prepared'
        `;
      } else {
        throw new CapacityChangeOperationConflictError(
          'Another paid-capacity change is already being processed for this account.',
        );
      }
    } else {
      return operation;
    }
  }

  const inserted = await transaction<CapacityChangeOperationRow[]>`
    INSERT INTO crewcast.stripe_capacity_change_operations (
      operation_id,
      user_id,
      request_fingerprint,
      stripe_customer_id,
      stripe_base_subscription_id,
      base_plan,
      stripe_subscription_id,
      from_extra_brand_quantity,
      from_extra_location_quantity,
      to_extra_brand_quantity,
      to_extra_location_quantity,
      proration_date_seconds,
      capacity_selection_version,
      retained_brand_ids,
      retained_location_ids,
      reason,
      expires_at
    ) VALUES (
      ${input.operationId}::uuid,
      ${input.userId},
      ${requestFingerprint},
      ${input.stripeCustomerId},
      ${input.stripeBaseSubscriptionId},
      ${input.basePlan},
      ${input.stripeSubscriptionId},
      ${input.from.extraBrands},
      ${input.from.extraLocations},
      ${input.to.extraBrands},
      ${input.to.extraLocations},
      ${input.prorationDateSeconds},
      ${input.capacitySelectionVersion},
      ${input.retainedBrandIds}::bigint[],
      ${input.retainedLocationIds}::bigint[],
      ${input.reason ?? 'customer_change'},
      ${input.expiresAt}::timestamptz
    )
    RETURNING ${transaction.unsafe(OPERATION_COLUMNS)}
  `;
  if (inserted.length !== 1) {
    throw new Error('Paid-capacity operation was not prepared exactly once.');
  }
  return mapOperation(inserted[0]);
}

export async function bindPendingCapacityPayment(
  transaction: CapacityChangeSql,
  input: {
    userId: number;
    operationId: string;
    stripeSubscriptionId: string;
    stripeInvoiceId: string;
    expiresAt?: string | null;
  },
): Promise<CapacityChangeOperation> {
  if (input.expiresAt !== undefined && input.expiresAt !== null) {
    if (!Number.isFinite(Date.parse(input.expiresAt)) || Date.parse(input.expiresAt) <= Date.now()) {
      throw new Error('Paid-capacity payment expiry is invalid.');
    }
  }
  const updated = await transaction<CapacityChangeOperationRow[]>`
    UPDATE crewcast.stripe_capacity_change_operations
    SET
      stripe_subscription_id = ${input.stripeSubscriptionId},
      stripe_invoice_id = ${input.stripeInvoiceId},
      expires_at = COALESCE(${input.expiresAt ?? null}::timestamptz, expires_at),
      status = 'pending_payment'
    WHERE operation_id = ${input.operationId}::uuid
      AND user_id = ${input.userId}
      AND status = 'prepared'
      AND (stripe_subscription_id IS NULL OR stripe_subscription_id = ${input.stripeSubscriptionId})
    RETURNING ${transaction.unsafe(OPERATION_COLUMNS)}
  `;
  if (updated.length === 1) return mapOperation(updated[0]);

  const existing = await readCapacityChangeOperation(transaction, input);
  if (
    existing?.status === 'pending_payment'
    && existing.stripeSubscriptionId === input.stripeSubscriptionId
    && existing.stripeInvoiceId === input.stripeInvoiceId
  ) {
    return existing;
  }
  throw new CapacityChangeOperationConflictError(
    'Paid-capacity payment state no longer matches this operation.',
  );
}

export async function completeCapacityChangeOperation(
  transaction: CapacityChangeSql,
  input: {
    userId: number;
    operationId: string;
    stripeSubscriptionId: string;
    stripeInvoiceId?: string | null;
  },
): Promise<CapacityChangeOperation> {
  const updated = await transaction<CapacityChangeOperationRow[]>`
    UPDATE crewcast.stripe_capacity_change_operations
    SET
      stripe_subscription_id = ${input.stripeSubscriptionId},
      stripe_invoice_id = COALESCE(${input.stripeInvoiceId ?? null}, stripe_invoice_id),
      status = 'completed',
      completed_at = NOW()
    WHERE operation_id = ${input.operationId}::uuid
      AND user_id = ${input.userId}
      AND status IN ('prepared', 'pending_payment')
      AND (stripe_subscription_id IS NULL OR stripe_subscription_id = ${input.stripeSubscriptionId})
    RETURNING ${transaction.unsafe(OPERATION_COLUMNS)}
  `;
  if (updated.length === 1) return mapOperation(updated[0]);

  const existing = await readCapacityChangeOperation(transaction, input);
  if (
    existing?.status === 'completed'
    && existing.stripeSubscriptionId === input.stripeSubscriptionId
    && (
      input.stripeInvoiceId === undefined
      || input.stripeInvoiceId === null
      || existing.stripeInvoiceId === input.stripeInvoiceId
    )
  ) {
    return existing;
  }
  throw new CapacityChangeOperationConflictError(
    'Paid-capacity operation could not be completed safely.',
  );
}

export async function readOpenCapacityChangeForStripeEvent(
  transaction: CapacityChangeSql,
  input: {
    userId: number;
    stripeSubscriptionId: string;
    stripeInvoiceId?: string | null;
    operationId?: string | null;
  },
): Promise<CapacityChangeOperation | null> {
  const rows = input.operationId
    ? await transaction<CapacityChangeOperationRow[]>`
        SELECT ${transaction.unsafe(OPERATION_COLUMNS)}
        FROM crewcast.stripe_capacity_change_operations
        WHERE operation_id = ${input.operationId}::uuid
          AND user_id = ${input.userId}
          AND status IN ('prepared', 'pending_payment')
        LIMIT 2
        FOR UPDATE
      `
    : await transaction<CapacityChangeOperationRow[]>`
        SELECT ${transaction.unsafe(OPERATION_COLUMNS)}
        FROM crewcast.stripe_capacity_change_operations
        WHERE user_id = ${input.userId}
          AND stripe_subscription_id = ${input.stripeSubscriptionId}
          AND status IN ('prepared', 'pending_payment')
        ORDER BY created_at DESC
        LIMIT 2
        FOR UPDATE
      `;
  if (rows.length > 1) {
    throw new Error('Stripe event matches more than one open paid-capacity operation.');
  }
  if (rows.length === 0) return null;
  const operation = mapOperation(rows[0]);
  if (operation.stripeSubscriptionId && operation.stripeSubscriptionId !== input.stripeSubscriptionId) {
    throw new Error('Stripe event subscription does not match the paid-capacity operation.');
  }
  if (
    operation.stripeInvoiceId
    && input.stripeInvoiceId
    && operation.stripeInvoiceId !== input.stripeInvoiceId
  ) {
    throw new Error('Stripe event invoice does not match the paid-capacity operation.');
  }
  return operation;
}

export async function cancelCapacityChangeOperation(
  transaction: CapacityChangeSql,
  input: { userId: number; operationId: string },
): Promise<void> {
  await transaction`
    UPDATE crewcast.stripe_capacity_change_operations
    SET status = 'canceled', canceled_at = NOW()
    WHERE operation_id = ${input.operationId}::uuid
      AND user_id = ${input.userId}
      AND status IN ('prepared', 'pending_payment')
  `;
}

/**
 * Base cancellation makes an unsubmitted quote invalid. A payment-waiting
 * operation is canceled only when Stripe has confirmed that its exact invoice
 * was interrupted; a different invoice fails closed instead of being hidden.
 */
export async function cancelInterruptedCapacityChangesForBaseLifecycle(
  transaction: CapacityChangeSql,
  input: { userId: number; interruptedInvoiceId: string | null },
): Promise<number> {
  if (!Number.isSafeInteger(input.userId) || input.userId <= 0) {
    throw new Error('Paid-capacity lifecycle account ID is invalid.');
  }
  if (
    input.interruptedInvoiceId !== null
    && !/^in_[A-Za-z0-9]+$/.test(input.interruptedInvoiceId)
  ) {
    throw new Error('Paid-capacity lifecycle invoice ID is invalid.');
  }
  const canceled = await transaction<{ operation_id: string }[]>`
    UPDATE crewcast.stripe_capacity_change_operations
    SET status = 'canceled', canceled_at = NOW()
    WHERE user_id = ${input.userId}
      AND (
        status = 'prepared'
        OR (
          status = 'pending_payment'
          AND stripe_invoice_id = ${input.interruptedInvoiceId}
        )
      )
    RETURNING operation_id::text AS operation_id
  `;
  const remaining = await transaction<{ operation_id: string }[]>`
    SELECT operation_id::text AS operation_id
    FROM crewcast.stripe_capacity_change_operations
    WHERE user_id = ${input.userId}
      AND status IN ('prepared', 'pending_payment')
    LIMIT 2
    FOR UPDATE
  `;
  if (remaining.length > 0) {
    throw new CapacityChangeOperationConflictError(
      'A different paid-capacity payment is still being processed for this account.',
    );
  }
  return canceled.length;
}

export async function readCapacityChangeOperation(
  transaction: CapacityChangeSql,
  input: { userId: number; operationId: string },
): Promise<CapacityChangeOperation | null> {
  const rows = await transaction<CapacityChangeOperationRow[]>`
    SELECT ${transaction.unsafe(OPERATION_COLUMNS)}
    FROM crewcast.stripe_capacity_change_operations
    WHERE operation_id = ${input.operationId}::uuid
      AND user_id = ${input.userId}
    LIMIT 2
    FOR UPDATE
  `;
  if (rows.length > 1) throw new Error('Paid-capacity operation identity is duplicated.');
  return rows.length === 1 ? mapOperation(rows[0]) : null;
}

/**
 * Returns the one durable payment that this account can safely resume after a
 * browser refresh. Stripe identifiers and payment secrets stay server-side;
 * the route exposes only the operation ID, target quantities, and expiry.
 */
export async function readPendingCapacityChangeOperation(
  transaction: CapacityChangeSql,
  userId: number,
): Promise<CapacityChangeOperation | null> {
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new Error('Paid-capacity account ID is invalid.');
  }
  const rows = await transaction<CapacityChangeOperationRow[]>`
    SELECT ${transaction.unsafe(OPERATION_COLUMNS)}
    FROM crewcast.stripe_capacity_change_operations
    WHERE user_id = ${userId}
      AND status = 'pending_payment'
    ORDER BY created_at DESC
    LIMIT 2
  `;
  if (rows.length > 1) {
    throw new Error('More than one pending paid-capacity payment exists for this account.');
  }
  return rows.length === 1 ? mapOperation(rows[0]) : null;
}
