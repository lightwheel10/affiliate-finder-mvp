import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { config as loadEnvironment } from 'dotenv';
import postgres from 'postgres';
import type Stripe from 'stripe';
import {
  bindStripeDowngradeOperationSchedule,
  completeStripeDowngradeOperation,
  prepareStripeDowngradeOperation,
  recoverPreparedStripeDowngradeOperation,
  StripeDowngradeOperationConflictError,
} from '../src/lib/stripe/downgrade-operations-postgres';
import {
  CreditCheckoutOperationConflictError,
  persistCreditCheckoutSession,
  prepareCreditCheckoutOperation,
  type CreditCheckoutSql,
} from '../src/lib/stripe/credit-checkout-postgres';
import type { CreditCheckoutIdentity } from '../src/lib/stripe/credit-checkout';
import {
  abandonStripePaymentMethodUpdateOperation,
  completeStripePaymentMethodUpdateOperation,
  prepareStripePaymentMethodUpdateOperation,
  StripePaymentMethodUpdateConflictError,
  type StripePaymentMethodUpdateOperation,
} from '../src/lib/stripe/payment-method-update-postgres';
import {
  reconcileInitialSubscription,
  type InitialSubscriptionDatabase,
} from '../src/lib/stripe/initial-subscription-postgres';

const STAGING_PROJECT_REF = 'jxerxreqezhdsisdwddw';
const SYNTHETIC_EMAIL_PREFIX = 'codex-stripe-consistency-';

loadEnvironment({
  path: path.resolve(process.cwd(), '.env.staging.local'),
  override: true,
  quiet: true,
});

const databaseUrl = process.env.SUPABASE_DATABASE_URL;
if (!databaseUrl) throw new Error('SUPABASE_DATABASE_URL is missing.');

function projectRef(connectionUrl: string): string {
  const parsed = new URL(connectionUrl);
  const direct = parsed.hostname.match(/^db\.([a-z0-9]{20})\.supabase\.co$/);
  const pooler = decodeURIComponent(parsed.username).match(/^postgres\.([a-z0-9]{20})$/);
  if (direct) return direct[1];
  if (pooler && parsed.hostname.endsWith('.pooler.supabase.com')) return pooler[1];
  throw new Error('Could not prove the Supabase project reference.');
}

assert.equal(
  projectRef(databaseUrl),
  STAGING_PROJECT_REF,
  'Refusing to test Stripe consistency outside Terminal-Backup.',
);

const sql = postgres(databaseUrl, {
  // The application credit helper owns one separate serverless-style
  // connection. Keep this verifier below Supabase's small staging pool cap.
  max: 4,
  prepare: false,
  connect_timeout: 10,
  idle_timeout: 10,
});
const token = randomUUID().replaceAll('-', '');
let accountId: number | null = null;

async function verifyMigration(): Promise<void> {
  const expectedMigrations = [
    {
      version: '0024',
      name: 'durable_stripe_downgrade_operations',
      file: '0024_durable_stripe_downgrade_operations.up.sql',
    },
    {
      version: '0025',
      name: 'stripe_downgrade_schedule_history',
      file: '0025_stripe_downgrade_schedule_history.up.sql',
    },
    {
      version: '0026',
      name: 'durable_stripe_credit_checkouts',
      file: '0026_durable_stripe_credit_checkouts.up.sql',
    },
    {
      version: '0027',
      name: 'durable_stripe_payment_method_updates',
      file: '0027_durable_stripe_payment_method_updates.up.sql',
    },
    {
      version: '0028',
      name: 'resilient_stripe_payment_method_recovery',
      file: '0028_resilient_stripe_payment_method_recovery.up.sql',
    },
    {
      version: '0029',
      name: 'durable_downgrade_schedule_attachment',
      file: '0029_durable_downgrade_schedule_attachment.up.sql',
    },
  ];
  for (const migration of expectedMigrations) {
    const migrationPath = path.resolve(process.cwd(), 'supabase/migrations', migration.file);
    const checksum = createHash('sha256').update(readFileSync(migrationPath)).digest('hex');
    const applied = await sql<{ checksum: string }[]>`
      SELECT checksum_sha256 AS checksum
      FROM crewcast.schema_migrations
      WHERE version = ${migration.version}
        AND name = ${migration.name}
    `;
    assert.equal(applied.length, 1);
    assert.equal(applied[0].checksum, checksum);
  }

  const rows = await sql<{
    rls: boolean;
    grants: number;
    constraints: number;
    triggers: number;
    scheduleIndexUnique: boolean;
  }[]>`
    SELECT
      (SELECT relrowsecurity FROM pg_class
        WHERE oid = 'crewcast.stripe_downgrade_operations'::regclass) AS rls,
      (SELECT count(*) FROM information_schema.role_table_grants
        WHERE table_schema = 'crewcast'
          AND table_name = 'stripe_downgrade_operations'
          AND grantee IN ('PUBLIC', 'anon', 'authenticated', 'service_role'))::integer AS grants,
      (SELECT count(*) FROM pg_constraint
        WHERE conrelid = 'crewcast.stripe_downgrade_operations'::regclass)::integer AS constraints,
      (SELECT count(*) FROM pg_trigger
        WHERE tgrelid = 'crewcast.stripe_downgrade_operations'::regclass
          AND tgname = 'stripe_downgrade_operations_lifecycle'
          AND NOT tgisinternal)::integer AS triggers,
      (SELECT indisunique
        FROM pg_index
        WHERE indexrelid = 'crewcast.stripe_downgrade_operations_schedule_idx'::regclass
      ) AS "scheduleIndexUnique"
  `;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].rls, true);
  assert.equal(rows[0].grants, 0);
  assert.equal(rows[0].constraints, 12);
  assert.equal(rows[0].triggers, 1);
  assert.equal(rows[0].scheduleIndexUnique, false);

  const creditRows = await sql<{
    rls: boolean;
    grants: number;
    constraints: number;
    triggers: number;
    sessionIndexUnique: boolean;
  }[]>`
    SELECT
      (SELECT relrowsecurity FROM pg_class
        WHERE oid = 'crewcast.stripe_credit_checkout_operations'::regclass) AS rls,
      (SELECT count(*) FROM information_schema.role_table_grants
        WHERE table_schema = 'crewcast'
          AND table_name = 'stripe_credit_checkout_operations'
          AND grantee IN ('PUBLIC', 'anon', 'authenticated', 'service_role'))::integer AS grants,
      (SELECT count(*) FROM pg_constraint
        WHERE conrelid = 'crewcast.stripe_credit_checkout_operations'::regclass)::integer AS constraints,
      (SELECT count(*) FROM pg_trigger
        WHERE tgrelid = 'crewcast.stripe_credit_checkout_operations'::regclass
          AND tgname = 'stripe_credit_checkout_operations_lifecycle'
          AND NOT tgisinternal)::integer AS triggers,
      (SELECT indisunique
        FROM pg_index
        WHERE indexrelid = 'crewcast.stripe_credit_checkout_operations_session_key'::regclass
      ) AS "sessionIndexUnique"
  `;
  assert.deepEqual(creditRows[0], {
    rls: true,
    grants: 0,
    constraints: 10,
    triggers: 1,
    sessionIndexUnique: true,
  });

  const paymentMethodRows = await sql<{
    rls: boolean;
    grants: number;
    constraints: number;
    triggers: number;
    preparedIndexUnique: boolean;
    hasAbandonedAt: boolean;
    hasFailureCode: boolean;
  }[]>`
    SELECT
      (SELECT relrowsecurity FROM pg_class
        WHERE oid = 'crewcast.stripe_payment_method_update_operations'::regclass) AS rls,
      (SELECT count(*) FROM information_schema.role_table_grants
        WHERE table_schema = 'crewcast'
          AND table_name = 'stripe_payment_method_update_operations'
          AND grantee IN ('PUBLIC', 'anon', 'authenticated', 'service_role'))::integer AS grants,
      (SELECT count(*) FROM pg_constraint
        WHERE conrelid = 'crewcast.stripe_payment_method_update_operations'::regclass)::integer AS constraints,
      (SELECT count(*) FROM pg_trigger
        WHERE tgrelid = 'crewcast.stripe_payment_method_update_operations'::regclass
          AND tgname = 'stripe_payment_method_update_operations_lifecycle'
          AND NOT tgisinternal)::integer AS triggers,
      (SELECT indisunique
        FROM pg_index
        WHERE indexrelid =
          'crewcast.stripe_pm_update_one_prepared_user_key'::regclass
      ) AS "preparedIndexUnique",
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'crewcast'
          AND table_name = 'stripe_payment_method_update_operations'
          AND column_name = 'abandoned_at'
      ) AS "hasAbandonedAt",
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'crewcast'
          AND table_name = 'stripe_payment_method_update_operations'
          AND column_name = 'failure_code'
      ) AS "hasFailureCode"
  `;
  assert.deepEqual(paymentMethodRows[0], {
    rls: true,
    grants: 0,
    constraints: 9,
    triggers: 1,
    preparedIndexUnique: true,
    hasAbandonedAt: true,
    hasFailureCode: true,
  });
}

async function removeInterruptedFixtures(): Promise<void> {
  await sql`
    DELETE FROM crewcast.credit_purchases
    WHERE user_id IN (
      SELECT id
      FROM crewcast.users
      WHERE email LIKE ${`${SYNTHETIC_EMAIL_PREFIX}%@example.invalid`}
    )
  `;
  await sql`
    DELETE FROM crewcast.users
    WHERE email LIKE ${`${SYNTHETIC_EMAIL_PREFIX}%@example.invalid`}
  `;
}

async function createFixture(): Promise<number> {
  const users = await sql<{ id: number }[]>`
    INSERT INTO crewcast.users (
      email, name, is_onboarded, onboarding_step, has_subscription, plan
    ) VALUES (
      ${`${SYNTHETIC_EMAIL_PREFIX}${token}@example.invalid`},
      'Stripe consistency verifier',
      true,
      8,
      true,
      'business'
    )
    RETURNING id
  `;
  assert.equal(users.length, 1);
  await sql`
    INSERT INTO crewcast.subscriptions (
      user_id,
      stripe_customer_id,
      stripe_subscription_id,
      plan,
      status,
      billing_interval,
      current_period_end
    ) VALUES (
      ${users[0].id},
      ${`cus_codex${token}`},
      ${`sub_codex${token}`},
      'business',
      'active',
      'monthly',
      '2099-01-01T00:00:00.000Z'::timestamptz
    )
  `;
  return users[0].id;
}

function operationInput(userId: number, operationId: string) {
  return {
    operationId,
    userId,
    stripeCustomerId: `cus_codex${token}`,
    stripeSubscriptionId: `sub_codex${token}`,
    fromPlan: 'business' as const,
    fromBillingInterval: 'monthly' as const,
    sourcePeriodEndSeconds: 4_071_686_400,
    toPlan: 'pro' as const,
    toBillingInterval: 'monthly' as const,
    capacitySelectionVersion: 1 as const,
    retainedBrandIds: ['101'],
    retainedLocationIds: ['201', '202'],
  };
}

async function prepareUnderAccountLock(userId: number, operationId: string) {
  return sql.begin(async (transaction) => {
    await transaction`
      SELECT pg_advisory_xact_lock(
        hashtextextended(${`stripe-subscription:cus_codex${token}`}, 0)
      )
    `;
    return prepareStripeDowngradeOperation(transaction, operationInput(userId, operationId));
  });
}

async function verifyDowngradeCrashRecovery(userId: number): Promise<void> {
  const attempts = await Promise.all(
    Array.from({ length: 100 }, () => prepareUnderAccountLock(userId, randomUUID())),
  );
  assert.equal(new Set(attempts.map((attempt) => attempt.operationId)).size, 1);
  assert.equal(attempts[0].status, 'prepared');

  const counts = await sql<{ prepared: number; total: number }[]>`
    SELECT
      count(*) FILTER (WHERE status = 'prepared')::integer AS prepared,
      count(*)::integer AS total
    FROM crewcast.stripe_downgrade_operations
    WHERE user_id = ${userId}
  `;
  assert.deepEqual(counts[0], { prepared: 1, total: 1 });

  await assert.rejects(
    sql.begin(async (transaction) => {
      await transaction`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${`stripe-subscription:cus_codex${token}`}, 0)
        )
      `;
      await prepareStripeDowngradeOperation(transaction, {
        ...operationInput(userId, randomUUID()),
        toBillingInterval: 'annual',
      });
    }),
    StripeDowngradeOperationConflictError,
  );

  const operation = attempts[0];
  const scheduleId = `sub_sched_codex_${token}`;
  const bound = await Promise.all(Array.from({ length: 50 }, () =>
    sql.begin((transaction) => bindStripeDowngradeOperationSchedule(transaction, {
      userId,
      operationId: operation.operationId,
      stripeScheduleId: scheduleId,
    }))));
  assert.equal(bound.every((row) => row.status === 'prepared'), true);
  assert.equal(bound.every((row) => row.stripeScheduleId === scheduleId), true);
  await assert.rejects(
    sql.begin((transaction) => bindStripeDowngradeOperationSchedule(transaction, {
      userId,
      operationId: operation.operationId,
      stripeScheduleId: `sub_sched_other_${token}`,
    })),
    StripeDowngradeOperationConflictError,
  );

  const schedule = {
    id: scheduleId,
    status: 'active',
    subscription: operation.stripeSubscriptionId,
    metadata: {
      managed_by: 'affiliate-finder',
      change_kind: 'deferred_plan_downgrade',
      account_id: String(userId),
      target_plan: operation.toPlan,
      target_billing_interval: operation.toBillingInterval,
      effective_at: String(operation.sourcePeriodEndSeconds),
      app_downgrade_operation_id: operation.operationId,
    },
  } as unknown as Stripe.SubscriptionSchedule;

  const recovered = await sql.begin(async (transaction) => {
    await transaction`
      SELECT pg_advisory_xact_lock(
        hashtextextended(${`stripe-subscription:cus_codex${token}`}, 0)
      )
    `;
    return recoverPreparedStripeDowngradeOperation(transaction, { userId, schedule });
  });
  assert.equal(recovered, 'completed');

  const replay = await sql.begin(async (transaction) =>
    recoverPreparedStripeDowngradeOperation(transaction, { userId, schedule }));
  assert.equal(replay, 'none');

  const state = await sql<{
    operations: number;
    completed: number;
    plan_changes: number;
  }[]>`
    SELECT
      (SELECT count(*) FROM crewcast.stripe_downgrade_operations
        WHERE user_id = ${userId})::integer AS operations,
      (SELECT count(*) FROM crewcast.stripe_downgrade_operations
        WHERE user_id = ${userId} AND status = 'completed')::integer AS completed,
      (SELECT count(*) FROM crewcast.subscription_plan_changes
        WHERE user_id = ${userId} AND status = 'pending')::integer AS plan_changes
  `;
  assert.deepEqual(state[0], { operations: 1, completed: 1, plan_changes: 1 });

  await assert.rejects(
    sql`
      UPDATE crewcast.stripe_downgrade_operations
      SET to_billing_interval = 'annual'
      WHERE operation_id = ${operation.operationId}::uuid
    `,
    /Stripe downgrade operation .* immutable/i,
  );

  const completedAgain = await sql.begin(async (transaction) =>
    completeStripeDowngradeOperation(transaction, {
      userId,
      operationId: operation.operationId,
      stripeScheduleId: schedule.id,
      effectiveAt: new Date(operation.sourcePeriodEndSeconds * 1000).toISOString(),
    }));
  assert.equal(completedAgain.status, 'completed');

  // The customer may revise the target while Stripe keeps the same attached
  // schedule. Both immutable operation versions must remain auditable, while
  // only the latest application plan-change row remains pending.
  const revisedOperation = await sql.begin(async (transaction) => {
    await transaction`
      SELECT pg_advisory_xact_lock(
        hashtextextended(${`stripe-subscription:cus_codex${token}`}, 0)
      )
    `;
    return prepareStripeDowngradeOperation(transaction, {
      ...operationInput(userId, randomUUID()),
      attachedScheduleId: schedule.id,
      toBillingInterval: 'annual',
    });
  });
  const revisedSchedule = {
    ...schedule,
    metadata: {
      ...schedule.metadata,
      target_billing_interval: 'annual',
      app_downgrade_operation_id: revisedOperation.operationId,
    },
  } as unknown as Stripe.SubscriptionSchedule;
  const revisedRecovery = await sql.begin(async (transaction) =>
    recoverPreparedStripeDowngradeOperation(transaction, {
      userId,
      schedule: revisedSchedule,
    }));
  assert.equal(revisedRecovery, 'completed');

  const revisedState = await sql<{
    operations: number;
    completed: number;
    pending: number;
    targetInterval: string;
  }[]>`
    SELECT
      (SELECT count(*) FROM crewcast.stripe_downgrade_operations
        WHERE user_id = ${userId})::integer AS operations,
      (SELECT count(*) FROM crewcast.stripe_downgrade_operations
        WHERE user_id = ${userId} AND status = 'completed')::integer AS completed,
      (SELECT count(*) FROM crewcast.subscription_plan_changes
        WHERE user_id = ${userId} AND status = 'pending')::integer AS pending,
      (SELECT to_billing_interval FROM crewcast.subscription_plan_changes
        WHERE user_id = ${userId} AND status = 'pending') AS "targetInterval"
  `;
  assert.deepEqual(revisedState[0], {
    operations: 2,
    completed: 2,
    pending: 1,
    targetInterval: 'annual',
  });
}

function paymentMethodOperationInput(
  userId: number,
  operationId: string,
  paymentMethodId = `pm_codex${token}`,
) {
  return {
    operationId,
    userId,
    stripeCustomerId: `cus_codex${token}`,
    stripeSubscriptionId: `sub_codex${token}`,
    stripePaymentMethodId: paymentMethodId,
  };
}

async function preparePaymentMethodUpdateUnderLock(
  userId: number,
  operationId: string,
  paymentMethodId?: string,
): Promise<StripePaymentMethodUpdateOperation> {
  return sql.begin(async (transaction) => {
    await transaction`
      SELECT pg_advisory_xact_lock(
        hashtextextended(${`stripe-subscription:cus_codex${token}`}, 0)
      )
    `;
    return prepareStripePaymentMethodUpdateOperation(
      transaction,
      paymentMethodOperationInput(userId, operationId, paymentMethodId),
    );
  });
}

async function verifyPaymentMethodUpdateCrashRecovery(userId: number): Promise<void> {
  const preparedAttempts = await Promise.all(
    Array.from({ length: 100 }, () =>
      preparePaymentMethodUpdateUnderLock(userId, randomUUID())),
  );
  assert.equal(new Set(preparedAttempts.map((attempt) => attempt.operationId)).size, 1);
  assert.equal(preparedAttempts[0].status, 'prepared');

  const replacementOperation = await preparePaymentMethodUpdateUnderLock(
    userId,
    randomUUID(),
    `pm_codexreplacement${token}`,
  );
  assert.equal(replacementOperation.status, 'prepared');
  assert.notEqual(replacementOperation.operationId, preparedAttempts[0].operationId);
  const superseded = await sql<{
    status: string;
    abandoned_at: string | null;
    failure_code: string | null;
  }[]>`
    SELECT status, abandoned_at::text, failure_code
    FROM crewcast.stripe_payment_method_update_operations
    WHERE operation_id = ${preparedAttempts[0].operationId}::uuid
  `;
  assert.equal(superseded[0].status, 'abandoned');
  assert.ok(superseded[0].abandoned_at);
  assert.equal(superseded[0].failure_code, 'replaced_by_new_request');

  await assert.rejects(
    sql.begin(async (transaction) => {
      await transaction`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${`stripe-subscription:cus_codex${token}`}, 0)
        )
      `;
      return completeStripePaymentMethodUpdateOperation(transaction, {
        operation: preparedAttempts[0],
        card: { last4: '0000', brand: 'visa', expMonth: 1, expYear: 2035 },
      });
    }),
    StripePaymentMethodUpdateConflictError,
  );

  const completionResults = await Promise.all(
    Array.from({ length: 100 }, () => sql.begin(async (transaction) => {
      await transaction`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${`stripe-subscription:cus_codex${token}`}, 0)
        )
      `;
      return completeStripePaymentMethodUpdateOperation(transaction, {
        operation: replacementOperation,
        card: { last4: '3184', brand: 'visa', expMonth: 12, expYear: 2034 },
      });
    })),
  );
  assert.equal(completionResults.filter((result) => result === 'completed').length, 1);
  assert.equal(
    completionResults.filter((result) => result === 'already_completed').length,
    99,
  );

  const firstState = await sql<{
    operations: number;
    completed: number;
    abandoned: number;
    subscriptionMethod: string | null;
    subscriptionLast4: string | null;
    userLast4: string | null;
  }[]>`
    SELECT
      (SELECT count(*) FROM crewcast.stripe_payment_method_update_operations
        WHERE user_id = ${userId})::integer AS operations,
      (SELECT count(*) FROM crewcast.stripe_payment_method_update_operations
        WHERE user_id = ${userId} AND status = 'completed')::integer AS completed,
      (SELECT count(*) FROM crewcast.stripe_payment_method_update_operations
        WHERE user_id = ${userId} AND status = 'abandoned')::integer AS abandoned,
      (SELECT stripe_payment_method_id FROM crewcast.subscriptions
        WHERE user_id = ${userId}) AS "subscriptionMethod",
      (SELECT card_last4 FROM crewcast.subscriptions
        WHERE user_id = ${userId}) AS "subscriptionLast4",
      (SELECT billing_last4 FROM crewcast.users
        WHERE id = ${userId}) AS "userLast4"
  `;
  assert.deepEqual(firstState[0], {
    operations: 2,
    completed: 1,
    abandoned: 1,
    subscriptionMethod: `pm_codexreplacement${token}`,
    subscriptionLast4: '3184',
    userLast4: '3184',
  });

  const rollbackOperation = await preparePaymentMethodUpdateUnderLock(
    userId,
    randomUUID(),
    `pm_codexrollback${token}`,
  );
  await assert.rejects(
    sql.begin(async (transaction) => {
      await transaction`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${`stripe-subscription:cus_codex${token}`}, 0)
        )
      `;
      await completeStripePaymentMethodUpdateOperation(transaction, {
        operation: rollbackOperation,
        card: { last4: '0341', brand: 'visa', expMonth: 1, expYear: 2035 },
      });
      throw new Error('synthetic crash after local completion');
    }),
    /synthetic crash/i,
  );
  const rolledBack = await sql<{
    status: string;
    method: string | null;
    last4: string | null;
  }[]>`
    SELECT
      (SELECT status FROM crewcast.stripe_payment_method_update_operations
        WHERE operation_id = ${rollbackOperation.operationId}::uuid) AS status,
      (SELECT stripe_payment_method_id FROM crewcast.subscriptions
        WHERE user_id = ${userId}) AS method,
      (SELECT card_last4 FROM crewcast.subscriptions
        WHERE user_id = ${userId}) AS last4
  `;
  assert.deepEqual(rolledBack[0], {
    status: 'prepared',
    method: `pm_codexreplacement${token}`,
    last4: '3184',
  });

  await sql.begin(async (transaction) => {
    await transaction`
      SELECT pg_advisory_xact_lock(
        hashtextextended(${`stripe-subscription:cus_codex${token}`}, 0)
      )
    `;
    await completeStripePaymentMethodUpdateOperation(transaction, {
      operation: rollbackOperation,
      card: { last4: '0341', brand: 'visa', expMonth: 1, expYear: 2035 },
    });
  });
  await assert.rejects(
    sql`
      UPDATE crewcast.stripe_payment_method_update_operations
      SET stripe_payment_method_id = ${`pm_codexmutated${token}`}
      WHERE operation_id = ${rollbackOperation.operationId}::uuid
    `,
    /payment-method update operation identity is immutable/i,
  );

  const abandonedOperation = await preparePaymentMethodUpdateUnderLock(
    userId,
    randomUUID(),
    `pm_codexabandoned${token}`,
  );
  const abandonResults = await Promise.all(
    Array.from({ length: 100 }, () => sql.begin(async (transaction) => {
      await transaction`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${`stripe-subscription:cus_codex${token}`}, 0)
        )
      `;
      return abandonStripePaymentMethodUpdateOperation(transaction, {
        operation: abandonedOperation,
        failureCode: 'invalidrequest',
      });
    })),
  );
  assert.equal(abandonResults.filter((result) => result === 'abandoned').length, 1);
  assert.equal(
    abandonResults.filter((result) => result === 'already_abandoned').length,
    99,
  );
  const abandonedState = await sql<{
    status: string;
    completed_at: string | null;
    abandoned_at: string | null;
    failure_code: string | null;
  }[]>`
    SELECT status, completed_at::text, abandoned_at::text, failure_code
    FROM crewcast.stripe_payment_method_update_operations
    WHERE operation_id = ${abandonedOperation.operationId}::uuid
  `;
  assert.equal(abandonedState[0].status, 'abandoned');
  assert.equal(abandonedState[0].completed_at, null);
  assert.ok(abandonedState[0].abandoned_at);
  assert.equal(abandonedState[0].failure_code, 'invalidrequest');

  await assert.rejects(
    sql.begin(async (transaction) => {
      await transaction`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${`stripe-subscription:cus_codex${token}`}, 0)
        )
      `;
      return completeStripePaymentMethodUpdateOperation(transaction, {
        operation: abandonedOperation,
        card: { last4: '9999', brand: 'visa', expMonth: 1, expYear: 2035 },
      });
    }),
    StripePaymentMethodUpdateConflictError,
  );
  await assert.rejects(
    sql`
      UPDATE crewcast.stripe_payment_method_update_operations
      SET failure_code = 'mutated'
      WHERE operation_id = ${abandonedOperation.operationId}::uuid
    `,
    /terminal Stripe payment-method update is immutable/i,
  );
}

function initialSubscriptionInput(
  userId: number,
  input: {
    status: Stripe.Subscription.Status;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    trialEnd: string | null;
    paidInvoice: {
      invoiceId: string;
      periodStart: Date;
      paidAt: string;
    } | null;
  },
) {
  return {
    userId,
    stripeCustomerId: `cus_codex${token}`,
    stripeSubscriptionId: `sub_codex${token}`,
    stripePaymentMethodId: `pm_codex${token}`,
    plan: 'business' as const,
    billingInterval: 'monthly' as const,
    cancelAtPeriodEnd: false,
    card: {
      last4: '4242',
      brand: 'visa',
      expMonth: 12,
      expYear: 2099,
    },
    ...input,
  };
}

async function verifyInitialSubscriptionReconciliation(userId: number): Promise<void> {
  const trialInput = initialSubscriptionInput(userId, {
    status: 'trialing',
    currentPeriodStart: '2097-01-01T00:00:00.000Z',
    currentPeriodEnd: '2097-01-04T00:00:00.000Z',
    trialEnd: '2097-01-04T00:00:00.000Z',
    paidInvoice: null,
  });
  const trialAttempts = await Promise.all(
    Array.from({ length: 50 }, () => reconcileInitialSubscription(
      sql as unknown as InitialSubscriptionDatabase,
      trialInput,
    )),
  );
  assert.equal(trialAttempts.every((attempt) => attempt.creditReset === null), true);

  const trialState = await sql<{
    subscription_status: string;
    has_subscription: boolean;
    credit_rows: number;
    trial_transactions: number;
    is_trial_period: boolean;
  }[]>`
    SELECT
      subscriptions.status AS subscription_status,
      users.has_subscription,
      (SELECT count(*) FROM crewcast.user_credits
        WHERE user_id = ${userId})::integer AS credit_rows,
      (SELECT count(*) FROM crewcast.credit_transactions
        WHERE user_id = ${userId} AND reason = 'trial_start')::integer AS trial_transactions,
      credits.is_trial_period
    FROM crewcast.users AS users
    JOIN crewcast.subscriptions AS subscriptions ON subscriptions.user_id = users.id
    JOIN crewcast.user_credits AS credits ON credits.user_id = users.id
    WHERE users.id = ${userId}
  `;
  assert.deepEqual(trialState[0], {
    subscription_status: 'trialing',
    has_subscription: true,
    credit_rows: 1,
    trial_transactions: 3,
    is_trial_period: true,
  });

  const paidInput = initialSubscriptionInput(userId, {
    status: 'active',
    currentPeriodStart: '2098-01-01T00:00:00.000Z',
    currentPeriodEnd: '2098-02-01T00:00:00.000Z',
    trialEnd: null,
    paidInvoice: {
      invoiceId: `in_initial_${token}`,
      periodStart: new Date('2098-01-01T00:00:00.000Z'),
      paidAt: '2098-01-01T00:00:01.000Z',
    },
  });
  const paidAttempts = await Promise.all(
    Array.from({ length: 50 }, () => reconcileInitialSubscription(
      sql as unknown as InitialSubscriptionDatabase,
      paidInput,
    )),
  );
  assert.equal(paidAttempts.filter((attempt) => attempt.creditReset === 'applied').length, 1);
  assert.equal(
    paidAttempts.filter((attempt) => attempt.creditReset === 'duplicate_invoice').length,
    49,
  );

  const paidState = await sql<{
    subscription_status: string;
    has_subscription: boolean;
    is_trial_period: boolean;
    reset_transactions: number;
    first_payment_at: string;
    next_auto_scan_at: string;
  }[]>`
    SELECT
      subscriptions.status AS subscription_status,
      users.has_subscription,
      credits.is_trial_period,
      (SELECT count(*) FROM crewcast.credit_transactions
        WHERE user_id = ${userId}
          AND reason = 'reset'
          AND reference_id = ${paidInput.paidInvoice!.invoiceId})::integer AS reset_transactions,
      subscriptions.first_payment_at::text,
      subscriptions.next_auto_scan_at::text
    FROM crewcast.users AS users
    JOIN crewcast.subscriptions AS subscriptions ON subscriptions.user_id = users.id
    JOIN crewcast.user_credits AS credits ON credits.user_id = users.id
    WHERE users.id = ${userId}
  `;
  assert.equal(paidState[0].subscription_status, 'active');
  assert.equal(paidState[0].has_subscription, true);
  assert.equal(paidState[0].is_trial_period, false);
  assert.equal(paidState[0].reset_transactions, 3);
  assert.equal(
    new Date(paidState[0].first_payment_at).toISOString(),
    '2098-01-01T00:00:01.000Z',
  );
  assert.equal(
    new Date(paidState[0].next_auto_scan_at).toISOString(),
    '2098-01-08T00:00:01.000Z',
  );

  // An impossible second trial must roll back the subscription/user updates,
  // not leave Stripe state marked as usable without matching trial credits.
  await assert.rejects(
    reconcileInitialSubscription(sql as unknown as InitialSubscriptionDatabase, initialSubscriptionInput(userId, {
      status: 'trialing',
      currentPeriodStart: '2099-01-01T00:00:00.000Z',
      currentPeriodEnd: '2099-01-04T00:00:00.000Z',
      trialEnd: '2099-01-04T00:00:00.000Z',
      paidInvoice: null,
    })),
    /no matching trial credits/i,
  );
  const afterRollback = await sql<{
    subscription_status: string;
    has_subscription: boolean;
    is_trial_period: boolean;
  }[]>`
    SELECT
      subscriptions.status AS subscription_status,
      users.has_subscription,
      credits.is_trial_period
    FROM crewcast.users AS users
    JOIN crewcast.subscriptions AS subscriptions ON subscriptions.user_id = users.id
    JOIN crewcast.user_credits AS credits ON credits.user_id = users.id
    WHERE users.id = ${userId}
  `;
  assert.deepEqual(afterRollback[0], {
    subscription_status: 'active',
    has_subscription: true,
    is_trial_period: false,
  });

  await assert.rejects(
    reconcileInitialSubscription(
      sql as unknown as InitialSubscriptionDatabase,
      initialSubscriptionInput(userId, {
        status: 'incomplete',
        currentPeriodStart: '2098-01-01T00:00:00.000Z',
        currentPeriodEnd: '2098-02-01T00:00:00.000Z',
        trialEnd: null,
        paidInvoice: paidInput.paidInvoice,
      }),
    ),
    /only an active initial subscription may reconcile a paid invoice/i,
  );

  const incompleteInput = initialSubscriptionInput(userId, {
    status: 'incomplete',
    currentPeriodStart: '2098-01-01T00:00:00.000Z',
    currentPeriodEnd: '2098-02-01T00:00:00.000Z',
    trialEnd: null,
    paidInvoice: null,
  });
  await reconcileInitialSubscription(
    sql as unknown as InitialSubscriptionDatabase,
    incompleteInput,
  );
  const locked = await sql<{ status: string; has_subscription: boolean }[]>`
    SELECT subscriptions.status, users.has_subscription
    FROM crewcast.users AS users
    JOIN crewcast.subscriptions AS subscriptions ON subscriptions.user_id = users.id
    WHERE users.id = ${userId}
  `;
  assert.deepEqual(locked[0], { status: 'incomplete', has_subscription: false });

  const recovered = await reconcileInitialSubscription(
    sql as unknown as InitialSubscriptionDatabase,
    paidInput,
  );
  assert.equal(recovered.creditReset, 'duplicate_invoice');
  const unlocked = await sql<{ status: string; has_subscription: boolean }[]>`
    SELECT subscriptions.status, users.has_subscription
    FROM crewcast.users AS users
    JOIN crewcast.subscriptions AS subscriptions ON subscriptions.user_id = users.id
    WHERE users.id = ${userId}
  `;
  assert.deepEqual(unlocked[0], { status: 'active', has_subscription: true });
}

async function verifyAccountFirstSubscriptionLockOrder(userId: number): Promise<void> {
  let signalAccountLocked!: () => void;
  let rejectAccountLock!: (error: unknown) => void;
  const accountLocked = new Promise<void>((resolve, reject) => {
    signalAccountLocked = resolve;
    rejectAccountLock = reject;
  });
  let releaseAccountLock!: () => void;
  const accountLockRelease = new Promise<void>((resolve) => {
    releaseAccountLock = resolve;
  });

  const accountFirstContender = sql.begin(async (transaction) => {
    const accounts = await transaction<{ id: number }[]>`
      SELECT id
      FROM crewcast.users
      WHERE id = ${userId}
      FOR UPDATE
    `;
    assert.equal(accounts.length, 1);
    signalAccountLocked();
    await accountLockRelease;

    const subscriptions = await transaction<{ user_id: number }[]>`
      SELECT user_id
      FROM crewcast.subscriptions
      WHERE user_id = ${userId}
      FOR UPDATE
    `;
    assert.equal(subscriptions.length, 1);
  }).catch((error) => {
    rejectAccountLock(error);
    throw error;
  });

  await accountLocked;
  let reconciliationSettled = false;
  const reconciliation = reconcileInitialSubscription(
    sql as unknown as InitialSubscriptionDatabase,
    initialSubscriptionInput(userId, {
      status: 'active',
      currentPeriodStart: '2098-01-01T00:00:00.000Z',
      currentPeriodEnd: '2098-02-01T00:00:00.000Z',
      trialEnd: null,
      paidInvoice: {
        invoiceId: `in_initial_${token}`,
        periodStart: new Date('2098-01-01T00:00:00.000Z'),
        paidAt: '2098-01-01T00:00:01.000Z',
      },
    }),
  ).finally(() => {
    reconciliationSettled = true;
  });

  try {
    // Give reconciliation time to reach the account lock. It must wait there;
    // taking the subscription first would create the exact production
    // onboarding/webhook deadlock when the contender continues below.
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal(reconciliationSettled, false);
  } finally {
    releaseAccountLock();
  }

  const [, outcome] = await Promise.all([accountFirstContender, reconciliation]);
  assert.equal(outcome.creditReset, 'duplicate_invoice');
}

async function verifyInvoiceCreditMonotonicity(userId: number): Promise<void> {
  const { resetCreditsForNewPeriod } = await import('../src/lib/credits');
  const simultaneous = await Promise.all(
    Array.from({ length: 50 }, () => resetCreditsForNewPeriod(
      userId,
      'business',
      new Date('2098-02-01T00:00:00.000Z'),
      new Date('2098-03-01T00:00:00.000Z'),
      { stripeInvoiceId: `in_current_${token}` },
    )),
  );
  assert.equal(simultaneous.filter((outcome) => outcome === 'applied').length, 1);
  assert.equal(simultaneous.filter((outcome) => outcome === 'duplicate_invoice').length, 49);
  await sql`
    UPDATE crewcast.user_credits
    SET topic_search_credits_used = 5
    WHERE user_id = ${userId}
  `;

  const duplicate = await resetCreditsForNewPeriod(
    userId,
    'business',
    new Date('2098-02-01T00:00:00.000Z'),
    new Date('2098-03-01T00:00:00.000Z'),
    { stripeInvoiceId: `in_current_${token}` },
  );
  const stale = await resetCreditsForNewPeriod(
    userId,
    'business',
    new Date('2098-01-01T00:00:00.000Z'),
    new Date('2098-02-01T00:00:00.000Z'),
    { stripeInvoiceId: `in_stale_${token}` },
  );
  assert.equal(duplicate, 'duplicate_invoice');
  assert.equal(stale, 'stale_period');

  const unchanged = await sql<{ used: number; period_start: string }[]>`
    SELECT topic_search_credits_used AS used, period_start::text AS period_start
    FROM crewcast.user_credits
    WHERE user_id = ${userId}
  `;
  assert.equal(unchanged[0].used, 5);
  assert.equal(new Date(unchanged[0].period_start).toISOString(), '2098-02-01T00:00:00.000Z');

  const newer = await resetCreditsForNewPeriod(
    userId,
    'business',
    new Date('2098-03-01T00:00:00.000Z'),
    new Date('2098-04-01T00:00:00.000Z'),
    { stripeInvoiceId: `in_newer_${token}` },
  );
  assert.equal(newer, 'applied');
  const advanced = await sql<{ used: number; period_start: string }[]>`
    SELECT topic_search_credits_used AS used, period_start::text AS period_start
    FROM crewcast.user_credits
    WHERE user_id = ${userId}
  `;
  assert.equal(advanced[0].used, 0);
  assert.equal(new Date(advanced[0].period_start).toISOString(), '2098-03-01T00:00:00.000Z');
}

async function verifyCreditCheckoutCrashRecovery(userId: number): Promise<void> {
  const operationId = randomUUID();
  const identity: CreditCheckoutIdentity = {
    operationId,
    userId,
    stripeCustomerId: `cus_${token}`,
    packId: 'search_5',
    priceId: `price_${token}`,
    creditType: 'topic_search',
    creditsAmount: 5,
  };
  const prepareOnce = () => sql.begin((transaction) => prepareCreditCheckoutOperation(
    transaction as unknown as CreditCheckoutSql,
    identity,
  ));
  const prepared = await Promise.all(Array.from({ length: 100 }, prepareOnce));
  assert.equal(new Set(prepared.map((row) => row.operation_id)).size, 1);
  assert.equal(prepared[0].status, 'prepared');

  const preparedCounts = await sql<{ prepared: number; total: number }[]>`
    SELECT
      count(*) FILTER (WHERE status = 'prepared')::integer AS prepared,
      count(*)::integer AS total
    FROM crewcast.stripe_credit_checkout_operations
    WHERE user_id = ${userId}
  `;
  assert.deepEqual(preparedCounts[0], { prepared: 1, total: 1 });

  await assert.rejects(
    sql.begin((transaction) => prepareCreditCheckoutOperation(
      transaction as unknown as CreditCheckoutSql,
      { ...identity, creditsAmount: 15 },
    )),
    CreditCheckoutOperationConflictError,
  );

  const sessionId = `cs_test_${token}`;
  const attachOnce = () => sql.begin((transaction) => persistCreditCheckoutSession(
    transaction as unknown as CreditCheckoutSql,
    identity,
    sessionId,
    { amountPaid: 2_900, currency: 'eur' },
  ));
  await Promise.all(Array.from({ length: 50 }, attachOnce));

  const before = await sql<{ topup: number }[]>`
    SELECT topic_search_credits_topup AS topup
    FROM crewcast.user_credits
    WHERE user_id = ${userId}
  `;
  assert.equal(before.length, 1);
  const { addTopupCredits } = await import('../src/lib/credits');
  const grants = await Promise.all(
    Array.from({ length: 50 }, () => addTopupCredits(
      userId,
      identity.creditType,
      identity.creditsAmount,
      sessionId,
      operationId,
    )),
  );
  assert.equal(grants.filter((result) => result === 'applied').length, 1);
  assert.equal(grants.filter((result) => result === 'already_applied').length, 49);

  const completed = await sql<{
    operation_status: string;
    purchase_status: string;
    purchases: number;
    amount_paid: number;
    currency: string;
    topup: number;
    transactions: number;
  }[]>`
    SELECT
      (SELECT status FROM crewcast.stripe_credit_checkout_operations
        WHERE operation_id = ${operationId}::uuid) AS operation_status,
      (SELECT status FROM crewcast.credit_purchases
        WHERE stripe_checkout_session_id = ${sessionId}) AS purchase_status,
      (SELECT count(*) FROM crewcast.credit_purchases
        WHERE stripe_checkout_session_id = ${sessionId})::integer AS purchases,
      (SELECT amount_paid FROM crewcast.credit_purchases
        WHERE stripe_checkout_session_id = ${sessionId}) AS amount_paid,
      (SELECT currency FROM crewcast.credit_purchases
        WHERE stripe_checkout_session_id = ${sessionId}) AS currency,
      (SELECT topic_search_credits_topup FROM crewcast.user_credits
        WHERE user_id = ${userId}) AS topup,
      (SELECT count(*) FROM crewcast.credit_transactions
        WHERE user_id = ${userId}
          AND reason = 'topup_purchase'
          AND reference_type = 'credit_purchase')::integer AS transactions
  `;
  assert.deepEqual(completed[0], {
    operation_status: 'completed',
    purchase_status: 'completed',
    purchases: 1,
    amount_paid: 2_900,
    currency: 'eur',
    topup: before[0].topup + identity.creditsAmount,
    transactions: 1,
  });

  await assert.rejects(
    sql.begin((transaction) => persistCreditCheckoutSession(
      transaction as unknown as CreditCheckoutSql,
      identity,
      `cs_test_other${token}`,
      { amountPaid: 2_900, currency: 'eur' },
    )),
    CreditCheckoutOperationConflictError,
  );
  await assert.rejects(
    sql`
      UPDATE crewcast.stripe_credit_checkout_operations
      SET pack_id = 'search_15'
      WHERE operation_id = ${operationId}::uuid
    `,
    /Stripe credit checkout operation identity is immutable/i,
  );
}

async function cleanup(): Promise<void> {
  const removedAccountId = accountId;
  if (removedAccountId !== null) {
    // credit_purchases intentionally has no user foreign key in the legacy
    // schema, so verifier cleanup must remove its synthetic billing row first.
    await sql`DELETE FROM crewcast.credit_purchases WHERE user_id = ${removedAccountId}`;
    await sql`DELETE FROM crewcast.users WHERE id = ${removedAccountId}`;
  }
  const residue = await sql<{
    users: number;
    downgrade_operations: number;
    credit_operations: number;
    payment_method_operations: number;
    purchases: number;
  }[]>`
    SELECT
      (SELECT count(*) FROM crewcast.users
        WHERE email LIKE ${`${SYNTHETIC_EMAIL_PREFIX}%@example.invalid`})::integer AS users,
      (SELECT count(*) FROM crewcast.stripe_downgrade_operations
        WHERE user_id = COALESCE(${removedAccountId}, -1))::integer AS downgrade_operations,
      (SELECT count(*) FROM crewcast.stripe_credit_checkout_operations
        WHERE user_id = COALESCE(${removedAccountId}, -1))::integer AS credit_operations,
      (SELECT count(*) FROM crewcast.stripe_payment_method_update_operations
        WHERE user_id = COALESCE(${removedAccountId}, -1))::integer AS payment_method_operations,
      (SELECT count(*) FROM crewcast.credit_purchases
        WHERE user_id = COALESCE(${removedAccountId}, -1))::integer AS purchases
  `;
  assert.deepEqual(residue[0], {
    users: 0,
    downgrade_operations: 0,
    credit_operations: 0,
    payment_method_operations: 0,
    purchases: 0,
  });
}

async function main(): Promise<void> {
  try {
    await verifyMigration();
    console.log('Verified Stripe billing migration structure.');
    await removeInterruptedFixtures();
    accountId = await createFixture();
    await verifyInitialSubscriptionReconciliation(accountId);
    console.log('Verified concurrent initial subscription reconciliation and rollback safety.');
    await verifyAccountFirstSubscriptionLockOrder(accountId);
    console.log('Verified account-first billing lock order against the onboarding deadlock interleaving.');
    await verifyDowngradeCrashRecovery(accountId);
    console.log('Verified durable downgrade retries and crash recovery.');
    await verifyPaymentMethodUpdateCrashRecovery(accountId);
    console.log(
      'Verified durable payment-method update retries, replacement, abandonment and crash recovery.',
    );
    await verifyInvoiceCreditMonotonicity(accountId);
    console.log('Verified concurrent invoice credit reset idempotency.');
    await verifyCreditCheckoutCrashRecovery(accountId);
    console.log('Verified durable credit checkout retries and exactly-once grant.');
    console.log('Stripe billing consistency staging verification passed.');
  } finally {
    await cleanup();
    await sql.end();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
