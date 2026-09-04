import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { config as loadEnvironment } from 'dotenv';
import postgres from 'postgres';
import {
  recordDeferredPlanChange,
  synchronizePendingSubscriptionPlanChange,
  type RecordDeferredPlanChangeInput,
} from '../src/lib/stripe/subscription-plan-changes-postgres';

const STAGING_PROJECT_REF = 'jxerxreqezhdsisdwddw';
const SYNTHETIC_EMAIL_PREFIX = 'codex-plan-change-';

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
  'Refusing to test plan changes outside Terminal-Backup.',
);

const sql = postgres(databaseUrl, {
  // Terminal-Backup's session pool has 15 slots shared with the dashboard and
  // other checks. Stay below the previously verified safe test ceiling.
  max: 8,
  prepare: false,
  connect_timeout: 10,
  idle_timeout: 10,
});
const token = randomUUID().replaceAll('-', '');
let accountId: number | null = null;

async function removeInterruptedSyntheticFixtures(): Promise<void> {
  // A killed verifier can leave only its deliberately named .invalid account.
  // The exact staging-project guard above makes this cleanup unable to target
  // Preview or Production, and the narrow email pattern cannot match customers.
  const removed = await sql<{ id: number }[]>`
    DELETE FROM crewcast.users
    WHERE email LIKE ${`${SYNTHETIC_EMAIL_PREFIX}%@example.invalid`}
    RETURNING id
  `;
  if (removed.length > 0) {
    console.log(`Removed ${removed.length} interrupted synthetic fixture(s).`);
  }
}

async function verifyMigration(): Promise<void> {
  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/0018_deferred_subscription_plan_changes.up.sql',
  );
  const checksum = createHash('sha256').update(readFileSync(migrationPath)).digest('hex');
  const rows = await sql<{
    checksum: string;
    rls: boolean;
    grants: number;
    constraints: number;
    triggers: number;
  }[]>`
    SELECT
      migrations.checksum_sha256 AS checksum,
      (SELECT relrowsecurity FROM pg_class
        WHERE oid = 'crewcast.subscription_plan_changes'::regclass) AS rls,
      (SELECT count(*) FROM information_schema.role_table_grants
        WHERE table_schema = 'crewcast'
          AND table_name = 'subscription_plan_changes'
          AND grantee IN ('PUBLIC', 'anon', 'authenticated', 'service_role'))::integer AS grants,
      (SELECT count(*) FROM pg_constraint
        WHERE conrelid = 'crewcast.subscription_plan_changes'::regclass)::integer AS constraints,
      (SELECT count(*) FROM pg_trigger
        WHERE tgrelid = 'crewcast.subscription_plan_changes'::regclass
          AND tgname = 'subscription_plan_changes_lifecycle'
          AND NOT tgisinternal)::integer AS triggers
    FROM crewcast.schema_migrations AS migrations
    WHERE migrations.version = '0018'
      AND migrations.name = 'deferred_subscription_plan_changes'
  `;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].checksum, checksum);
  assert.equal(rows[0].rls, true);
  assert.equal(rows[0].grants, 0);
  // 0018 created nine constraints; 0020 adds the capacity-selection check.
  assert.equal(rows[0].constraints, 10);
  assert.equal(rows[0].triggers, 1);
}

async function createFixture(): Promise<number> {
  const users = await sql<{ id: number }[]>`
    INSERT INTO crewcast.users (
      email, name, is_onboarded, onboarding_step, has_subscription, plan
    ) VALUES (
      ${`${SYNTHETIC_EMAIL_PREFIX}${token}@example.invalid`},
      'Deferred plan-change verifier',
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
      ${`cus_codex_${token}`},
      ${`sub_codex_${token}`},
      'business',
      'active',
      'monthly',
      NOW() + INTERVAL '30 days'
    )
  `;
  return users[0].id;
}

function changeInput(id: number, suffix: string, interval: 'monthly' | 'annual'): RecordDeferredPlanChangeInput {
  return {
    userId: id,
    stripeSubscriptionId: `sub_codex_${token}`,
    stripeScheduleId: `sub_sched_codex_${token}_${suffix}`,
    fromPlan: 'business',
    fromBillingInterval: 'monthly',
    toPlan: 'pro',
    toBillingInterval: interval,
    effectiveAt: '2099-01-01T00:00:00.000Z',
  };
}

async function recordUnderAccountLock(input: RecordDeferredPlanChangeInput) {
  return sql.begin(async (transaction) => {
    await transaction`
      SELECT pg_advisory_xact_lock(
        hashtextextended(${`stripe-subscription:cus_codex_${token}`}, 0)
      )
    `;
    return recordDeferredPlanChange(transaction, input);
  });
}

async function verifyIdempotencyAndLifecycle(id: number): Promise<void> {
  const firstInput = changeInput(id, 'first', 'monthly');
  const repeated = await Promise.all(
    Array.from({ length: 100 }, () => recordUnderAccountLock(firstInput)),
  );
  assert.equal(new Set(repeated.map((change) => change.id)).size, 1);

  const counts = await sql<{ pending: number; total: number }[]>`
    SELECT
      count(*) FILTER (WHERE status = 'pending')::integer AS pending,
      count(*)::integer AS total
    FROM crewcast.subscription_plan_changes
    WHERE user_id = ${id}
  `;
  assert.deepEqual(counts[0], { pending: 1, total: 1 });

  const replacementInput = changeInput(id, 'replacement', 'annual');
  const replacement = await recordUnderAccountLock(replacementInput);
  assert.notEqual(replacement.id, repeated[0].id);

  const history = await sql<{ status: string; count: number }[]>`
    SELECT status, count(*)::integer AS count
    FROM crewcast.subscription_plan_changes
    WHERE user_id = ${id}
    GROUP BY status
    ORDER BY status
  `;
  assert.deepEqual(Array.from(history), [
    { status: 'canceled', count: 1 },
    { status: 'pending', count: 1 },
  ]);

  const waiting = await synchronizePendingSubscriptionPlanChange(sql, {
    userId: id,
    stripeSubscriptionId: replacementInput.stripeSubscriptionId,
    stripeScheduleId: replacementInput.stripeScheduleId,
    currentPlan: 'business',
    currentBillingInterval: 'monthly',
  });
  assert.equal(waiting, 'pending');

  const wrongSubscription = await synchronizePendingSubscriptionPlanChange(sql, {
    userId: id,
    stripeSubscriptionId: `sub_replacement_${token}`,
    stripeScheduleId: replacementInput.stripeScheduleId,
    currentPlan: 'pro',
    currentBillingInterval: 'annual',
  });
  assert.equal(wrongSubscription, 'canceled');

  const reappliedInput = changeInput(id, 'reapplied', 'annual');
  await recordUnderAccountLock(reappliedInput);

  const applied = await synchronizePendingSubscriptionPlanChange(sql, {
    userId: id,
    stripeSubscriptionId: reappliedInput.stripeSubscriptionId,
    stripeScheduleId: reappliedInput.stripeScheduleId,
    currentPlan: 'pro',
    currentBillingInterval: 'annual',
  });
  assert.equal(applied, 'applied');

  await assert.rejects(
    sql`
      UPDATE crewcast.subscription_plan_changes
      SET to_plan = 'business'
      WHERE id = ${replacement.id}::bigint
    `,
    /identity is immutable/i,
  );

  const detachedInput = changeInput(id, 'detached', 'monthly');
  await recordUnderAccountLock(detachedInput);
  const canceled = await synchronizePendingSubscriptionPlanChange(sql, {
    userId: id,
    stripeSubscriptionId: detachedInput.stripeSubscriptionId,
    stripeScheduleId: null,
    currentPlan: 'business',
    currentBillingInterval: 'monthly',
  });
  assert.equal(canceled, 'canceled');
}

async function cleanup(): Promise<void> {
  if (accountId !== null) await sql`DELETE FROM crewcast.users WHERE id = ${accountId}`;
  const residue = await sql<{ users: number; changes: number }[]>`
    SELECT
      (SELECT count(*) FROM crewcast.users
        WHERE email LIKE ${`${SYNTHETIC_EMAIL_PREFIX}%`})::integer AS users,
      (SELECT count(*) FROM crewcast.subscription_plan_changes AS changes
        JOIN crewcast.users AS users ON users.id = changes.user_id
        WHERE users.email LIKE ${`${SYNTHETIC_EMAIL_PREFIX}%`})::integer AS changes
  `;
  assert.deepEqual(residue[0], { users: 0, changes: 0 });
}

async function main(): Promise<void> {
  try {
    await verifyMigration();
    await removeInterruptedSyntheticFixtures();
    accountId = await createFixture();
    await verifyIdempotencyAndLifecycle(accountId);
    console.log('Deferred subscription plan-change staging verification passed.');
  } finally {
    await cleanup();
    await sql.end();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
