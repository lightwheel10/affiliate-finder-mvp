import 'server-only';

import type postgres from 'postgres';
import {
  stripePaymentMethodUpdateRequestFingerprint,
  type StripeCardDisplay,
  type StripePaymentMethodUpdateIdentity,
} from './payment-method-update';

export type StripePaymentMethodUpdateSql = postgres.Sql;

interface PaymentMethodUpdateOperationRow {
  operation_id: string;
  user_id: number;
  request_fingerprint: string;
  stripe_customer_id: string;
  stripe_subscription_id: string | null;
  stripe_payment_method_id: string;
  status: 'prepared' | 'completed' | 'abandoned';
  completed_at: string | null;
  abandoned_at: string | null;
  failure_code: string | null;
  created_at: string;
}

export interface StripePaymentMethodUpdateOperation
  extends StripePaymentMethodUpdateIdentity {
  requestFingerprint: string;
  status: PaymentMethodUpdateOperationRow['status'];
  completedAt: string | null;
  abandonedAt: string | null;
  failureCode: string | null;
  createdAt: string;
}

export class StripePaymentMethodUpdateConflictError extends Error {
  readonly code = 'STRIPE_PAYMENT_METHOD_UPDATE_CONFLICT';
  readonly status = 409;

  constructor(message: string) {
    super(message);
    this.name = 'StripePaymentMethodUpdateConflictError';
  }
}

function mapRow(row: PaymentMethodUpdateOperationRow): StripePaymentMethodUpdateOperation {
  return {
    operationId: row.operation_id,
    userId: row.user_id,
    requestFingerprint: row.request_fingerprint.trim(),
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    stripePaymentMethodId: row.stripe_payment_method_id,
    status: row.status,
    completedAt: row.completed_at,
    abandonedAt: row.abandoned_at,
    failureCode: row.failure_code,
    createdAt: row.created_at,
  };
}

function matchesIdentity(
  operation: StripePaymentMethodUpdateOperation,
  input: StripePaymentMethodUpdateIdentity,
): boolean {
  return operation.userId === input.userId
    && operation.requestFingerprint === stripePaymentMethodUpdateRequestFingerprint(input)
    && operation.stripeCustomerId === input.stripeCustomerId
    && operation.stripeSubscriptionId === input.stripeSubscriptionId
    && operation.stripePaymentMethodId === input.stripePaymentMethodId;
}

export async function lockStripePaymentMethodUpdateOwner(
  transaction: StripePaymentMethodUpdateSql,
  input: {
    userId: number;
    stripeCustomerId: string;
    stripeSubscriptionId: string | null;
  },
): Promise<void> {
  await transaction`
    SELECT pg_advisory_xact_lock(
      hashtextextended(${`stripe-subscription:${input.stripeCustomerId}`}, 0)
    )
  `;
  // Canonical cross-table lock order: account root, then subscription.
  // Onboarding and every other billing writer use the same order so a Stripe
  // webhook cannot deadlock an authenticated account request.
  const users = await transaction<{ id: number }[]>`
    SELECT id
    FROM crewcast.users
    WHERE id = ${input.userId}
    LIMIT 2
    FOR UPDATE
  `;
  if (users.length !== 1) {
    throw new Error('Application account not found for payment-method update.');
  }
  const owners = await transaction<{
    user_id: number;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
  }[]>`
    SELECT user_id, stripe_customer_id, stripe_subscription_id
    FROM crewcast.subscriptions
    WHERE user_id = ${input.userId}
    LIMIT 2
    FOR UPDATE
  `;
  if (
    owners.length !== 1
    || owners[0].stripe_customer_id !== input.stripeCustomerId
    || owners[0].stripe_subscription_id !== input.stripeSubscriptionId
  ) {
    throw new StripePaymentMethodUpdateConflictError(
      'The account billing record changed while the payment method was being updated.',
    );
  }
}

export async function prepareStripePaymentMethodUpdateOperation(
  transaction: StripePaymentMethodUpdateSql,
  input: StripePaymentMethodUpdateIdentity,
): Promise<StripePaymentMethodUpdateOperation> {
  const fingerprint = stripePaymentMethodUpdateRequestFingerprint(input);
  const existing = await transaction<PaymentMethodUpdateOperationRow[]>`
    SELECT
      operation_id::text,
      user_id,
      request_fingerprint,
      stripe_customer_id,
      stripe_subscription_id,
      stripe_payment_method_id,
      status,
      completed_at::text,
      abandoned_at::text,
      failure_code,
      created_at::text
    FROM crewcast.stripe_payment_method_update_operations
    WHERE user_id = ${input.userId}
      AND status = 'prepared'
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE
  `;
  if (existing.length === 1) {
    const operation = mapRow(existing[0]);
    if (matchesIdentity(operation, input)) return operation;

    // A new explicit card choice safely supersedes a stuck one: the new
    // operation will set both Stripe defaults before publishing local data.
    await abandonStripePaymentMethodUpdateOperation(transaction, {
      operation,
      failureCode: 'replaced_by_new_request',
    });
  }

  const inserted = await transaction<PaymentMethodUpdateOperationRow[]>`
    INSERT INTO crewcast.stripe_payment_method_update_operations (
      operation_id,
      user_id,
      request_fingerprint,
      stripe_customer_id,
      stripe_subscription_id,
      stripe_payment_method_id
    ) VALUES (
      ${input.operationId}::uuid,
      ${input.userId},
      ${fingerprint},
      ${input.stripeCustomerId},
      ${input.stripeSubscriptionId},
      ${input.stripePaymentMethodId}
    )
    RETURNING
      operation_id::text,
      user_id,
      request_fingerprint,
      stripe_customer_id,
      stripe_subscription_id,
      stripe_payment_method_id,
      status,
      completed_at::text,
      abandoned_at::text,
      failure_code,
      created_at::text
  `;
  if (inserted.length !== 1) {
    throw new Error('Stripe payment-method update was not prepared exactly once.');
  }
  return mapRow(inserted[0]);
}

export async function readStripePaymentMethodUpdateOperation(
  transaction: StripePaymentMethodUpdateSql,
  input: { userId: number; operationId: string },
): Promise<StripePaymentMethodUpdateOperation | null> {
  const rows = await transaction<PaymentMethodUpdateOperationRow[]>`
    SELECT
      operation_id::text,
      user_id,
      request_fingerprint,
      stripe_customer_id,
      stripe_subscription_id,
      stripe_payment_method_id,
      status,
      completed_at::text,
      abandoned_at::text,
      failure_code,
      created_at::text
    FROM crewcast.stripe_payment_method_update_operations
    WHERE operation_id = ${input.operationId}::uuid
      AND user_id = ${input.userId}
    LIMIT 2
    FOR UPDATE
  `;
  return rows.length === 1 ? mapRow(rows[0]) : null;
}

export async function readPreparedStripePaymentMethodUpdateForCustomer(
  transaction: StripePaymentMethodUpdateSql,
  input: { userId: number; stripeCustomerId: string },
): Promise<StripePaymentMethodUpdateOperation | null> {
  const rows = await transaction<PaymentMethodUpdateOperationRow[]>`
    SELECT
      operation_id::text,
      user_id,
      request_fingerprint,
      stripe_customer_id,
      stripe_subscription_id,
      stripe_payment_method_id,
      status,
      completed_at::text,
      abandoned_at::text,
      failure_code,
      created_at::text
    FROM crewcast.stripe_payment_method_update_operations
    WHERE user_id = ${input.userId}
      AND stripe_customer_id = ${input.stripeCustomerId}
      AND status = 'prepared'
    ORDER BY created_at DESC
    LIMIT 2
    FOR UPDATE
  `;
  if (rows.length > 1) {
    throw new Error('Multiple prepared Stripe payment-method updates exist for one account.');
  }
  return rows.length === 1 ? mapRow(rows[0]) : null;
}

export async function abandonStripePaymentMethodUpdateOperation(
  transaction: StripePaymentMethodUpdateSql,
  input: {
    operation: StripePaymentMethodUpdateOperation;
    failureCode: string;
  },
): Promise<'abandoned' | 'already_abandoned'> {
  if (!/^[a-z0-9_]{1,64}$/.test(input.failureCode)) {
    throw new Error('Stripe payment-method update failure code is invalid.');
  }
  const current = await readStripePaymentMethodUpdateOperation(transaction, {
    userId: input.operation.userId,
    operationId: input.operation.operationId,
  });
  if (!current || !matchesIdentity(current, input.operation)) {
    throw new StripePaymentMethodUpdateConflictError(
      'The durable payment-method update no longer matches this request.',
    );
  }
  if (current.status === 'abandoned') return 'already_abandoned';
  if (current.status === 'completed') {
    throw new StripePaymentMethodUpdateConflictError(
      'A completed payment-method update cannot be abandoned.',
    );
  }

  const abandoned = await transaction<{ operation_id: string }[]>`
    UPDATE crewcast.stripe_payment_method_update_operations
    SET
      status = 'abandoned',
      abandoned_at = NOW(),
      failure_code = ${input.failureCode},
      updated_at = NOW()
    WHERE operation_id = ${input.operation.operationId}::uuid
      AND user_id = ${input.operation.userId}
      AND status = 'prepared'
    RETURNING operation_id::text
  `;
  if (abandoned.length !== 1) {
    throw new Error('Stripe payment-method update was not abandoned exactly once.');
  }
  return 'abandoned';
}

export async function completeStripePaymentMethodUpdateOperation(
  transaction: StripePaymentMethodUpdateSql,
  input: {
    operation: StripePaymentMethodUpdateOperation;
    card: StripeCardDisplay;
  },
): Promise<'completed' | 'already_completed'> {
  const current = await readStripePaymentMethodUpdateOperation(transaction, {
    userId: input.operation.userId,
    operationId: input.operation.operationId,
  });
  if (!current || !matchesIdentity(current, input.operation)) {
    throw new StripePaymentMethodUpdateConflictError(
      'The durable payment-method update no longer matches this request.',
    );
  }
  if (current.status === 'completed') return 'already_completed';
  if (current.status === 'abandoned') {
    throw new StripePaymentMethodUpdateConflictError(
      'An abandoned payment-method update cannot be completed.',
    );
  }

  const updatedSubscriptions = await transaction<{ user_id: number }[]>`
    UPDATE crewcast.subscriptions
    SET
      stripe_payment_method_id = ${input.operation.stripePaymentMethodId},
      card_last4 = ${input.card.last4},
      card_brand = ${input.card.brand},
      card_exp_month = ${input.card.expMonth},
      card_exp_year = ${input.card.expYear},
      updated_at = NOW()
    WHERE user_id = ${input.operation.userId}
      AND stripe_customer_id = ${input.operation.stripeCustomerId}
      AND stripe_subscription_id IS NOT DISTINCT FROM ${input.operation.stripeSubscriptionId}
    RETURNING user_id
  `;
  if (updatedSubscriptions.length !== 1) {
    throw new StripePaymentMethodUpdateConflictError(
      'The account subscription changed before the card update could be saved.',
    );
  }
  const updatedUsers = await transaction<{ id: number }[]>`
    UPDATE crewcast.users
    SET
      billing_last4 = ${input.card.last4},
      billing_brand = ${input.card.brand},
      billing_expiry = ${`${String(input.card.expMonth).padStart(2, '0')}/${String(input.card.expYear).slice(-2)}`},
      updated_at = NOW()
    WHERE id = ${input.operation.userId}
    RETURNING id
  `;
  if (updatedUsers.length !== 1) {
    throw new Error('Payment method did not update exactly one application account.');
  }
  const completed = await transaction<{ operation_id: string }[]>`
    UPDATE crewcast.stripe_payment_method_update_operations
    SET status = 'completed', completed_at = NOW(), updated_at = NOW()
    WHERE operation_id = ${input.operation.operationId}::uuid
      AND user_id = ${input.operation.userId}
      AND status = 'prepared'
    RETURNING operation_id::text
  `;
  if (completed.length !== 1) {
    throw new Error('Stripe payment-method update was not completed exactly once.');
  }
  return 'completed';
}
