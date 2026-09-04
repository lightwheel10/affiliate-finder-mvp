import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { config as loadEnvironment } from 'dotenv';
import postgres from 'postgres';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { SqlDatabase } from '../src/lib/auth/account-postgres';

const STAGING_PROJECT_REF = 'jxerxreqezhdsisdwddw';
const SYNTHETIC_EMAIL_PATTERN = 'codex-account-identity-%@example.invalid';

loadEnvironment({
  path: path.resolve(process.cwd(), '.env.staging.local'),
  override: true,
  quiet: true,
});

const databaseUrl = process.env.SUPABASE_DATABASE_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!databaseUrl) throw new Error('SUPABASE_DATABASE_URL is missing.');
if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL is missing.');
if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing.');

function extractDatabaseProjectRef(connectionUrl: string): string {
  const parsed = new URL(connectionUrl);
  const candidates = new Set<string>();
  const direct = parsed.hostname.match(/^db\.([a-z0-9]{20})\.supabase\.co$/);
  if (direct) candidates.add(direct[1]);
  const pooler = decodeURIComponent(parsed.username).match(/^postgres\.([a-z0-9]{20})$/);
  if (pooler && parsed.hostname.endsWith('.pooler.supabase.com')) candidates.add(pooler[1]);
  if (candidates.size !== 1) throw new Error('Could not prove exactly one database project ref.');
  return [...candidates][0];
}

function extractApiProjectRef(apiUrl: string): string {
  const parsed = new URL(apiUrl);
  const match = parsed.hostname.match(/^([a-z0-9]{20})\.supabase\.co$/);
  if (!match) throw new Error('Could not prove the Supabase API project ref.');
  return match[1];
}

assert.equal(
  extractDatabaseProjectRef(databaseUrl),
  STAGING_PROJECT_REF,
  'Refusing to run account identity tests against anything except isolated staging.',
);
assert.equal(
  extractApiProjectRef(supabaseUrl),
  STAGING_PROJECT_REF,
  'Database and Auth API must both target the isolated staging project.',
);

interface GlobalState {
  applicationUsers: number;
  authUsers: number;
  syntheticApplicationUsers: number;
  syntheticAuthUsers: number;
}

interface IdentityHealth {
  nullBindings: number;
  duplicateBindings: number;
  mismatchedBindings: number;
}

const database = postgres(databaseUrl, {
  // Terminal-Backup has a verified 15-session ceiling. Eight connections are
  // enough for real lock contention without starving the Preview/dashboard.
  max: 8,
  prepare: false,
  connect_timeout: 10,
  idle_timeout: 10,
});
const admin: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

async function globalState(): Promise<GlobalState> {
  const rows = await database<GlobalState[]>`
    SELECT
      (SELECT count(*) FROM crewcast.users)::integer AS "applicationUsers",
      (SELECT count(*) FROM auth.users)::integer AS "authUsers",
      (
        SELECT count(*) FROM crewcast.users
        WHERE email LIKE ${SYNTHETIC_EMAIL_PATTERN}
      )::integer AS "syntheticApplicationUsers",
      (
        SELECT count(*) FROM auth.users
        WHERE email LIKE ${SYNTHETIC_EMAIL_PATTERN}
      )::integer AS "syntheticAuthUsers"
  `;
  assert.equal(rows.length, 1);
  return rows[0];
}

async function identityHealth(): Promise<IdentityHealth> {
  const rows = await database<IdentityHealth[]>`
    SELECT
      (SELECT count(*) FROM crewcast.users WHERE auth_user_id IS NULL)::integer AS "nullBindings",
      (
        SELECT count(*)
        FROM (
          SELECT auth_user_id
          FROM crewcast.users
          WHERE auth_user_id IS NOT NULL
          GROUP BY auth_user_id
          HAVING count(*) > 1
        ) AS duplicates
      )::integer AS "duplicateBindings",
      (
        SELECT count(*)
        FROM crewcast.users AS application_users
        LEFT JOIN auth.users AS auth_users
          ON auth_users.id = application_users.auth_user_id
        WHERE application_users.auth_user_id IS NOT NULL
          AND auth_users.id IS NULL
      )::integer AS "mismatchedBindings"
  `;
  assert.equal(rows.length, 1);
  return rows[0];
}

async function removeSyntheticFixtures(): Promise<void> {
  await database`
    DELETE FROM crewcast.users
    WHERE email LIKE ${SYNTHETIC_EMAIL_PATTERN}
  `;
  const authRows = await database<{ id: string }[]>`
    SELECT id::text AS id
    FROM auth.users
    WHERE email LIKE ${SYNTHETIC_EMAIL_PATTERN}
  `;
  for (const row of authRows) {
    const { error } = await admin.auth.admin.deleteUser(row.id);
    if (error) throw new Error(`Could not remove a synthetic Auth fixture: ${error.message}`);
  }
}

async function createAuthUser(email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`Could not create a synthetic Auth fixture: ${error?.message ?? 'missing user'}`);
  }
  return data.user.id;
}

async function assertMigration(): Promise<void> {
  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/0016_stable_application_account_identity.up.sql',
  );
  const checksum = createHash('sha256').update(readFileSync(migrationPath)).digest('hex');
  const rows = await database<{
    checksum: string;
    constraints: number;
    triggers: number;
  }[]>`
    SELECT
      migrations.checksum_sha256 AS checksum,
      (
        SELECT count(*)
        FROM pg_constraint
        WHERE conrelid = 'crewcast.users'::regclass
          AND conname = ANY(ARRAY[
            'users_auth_user_id_key',
            'users_auth_user_id_fkey'
          ]::text[])
      )::integer AS constraints,
      (
        SELECT count(*)
        FROM pg_trigger
        WHERE tgrelid = 'crewcast.users'::regclass
          AND tgname = ANY(ARRAY[
            'users_auth_user_id_immutable',
            'users_assign_auth_user_id_compatibility'
          ]::text[])
          AND NOT tgisinternal
      )::integer AS triggers
    FROM crewcast.schema_migrations AS migrations
    WHERE migrations.version = '0016'
  `;
  assert.equal(rows.length, 1, 'Migration 0016 must be applied exactly once.');
  assert.equal(rows[0].checksum, checksum, 'Migration 0016 checksum drifted.');
  assert.equal(rows[0].constraints, 2, 'Stable identity constraints are incomplete.');
  assert.equal(rows[0].triggers, 2, 'Stable identity triggers are incomplete.');
}

function syntheticEmail(label: string): string {
  return `codex-account-identity-${label}-${randomUUID().replaceAll('-', '')}@example.invalid`;
}

async function main(): Promise<void> {
  await removeSyntheticFixtures();
  const before = await globalState();
  assert.equal(before.syntheticApplicationUsers, 0);
  assert.equal(before.syntheticAuthUsers, 0);

  const createdAuthIds: string[] = [];
  try {
    await assertMigration();
    assert.deepEqual(
      await identityHealth(),
      { nullBindings: 0, duplicateBindings: 0, mismatchedBindings: 0 },
      'Existing application accounts are not bound one-to-one to Auth users.',
    );

    const {
      AccountIdentityConflictError,
      resolveApplicationAccountIdentity,
    } = await import('../src/lib/auth/account-identity');
    const { createPostgresAccountIdentityStore } = await import('../src/lib/auth/account-postgres');
    const identityStore = createPostgresAccountIdentityStore(
      database as unknown as SqlDatabase,
    );

    const firstEmail = syntheticEmail('owner-old');
    const changedEmail = syntheticEmail('owner-new');
    const secondEmail = syntheticEmail('other');
    const ownerAuthId = await createAuthUser(firstEmail);
    createdAuthIds.push(ownerAuthId);
    const otherAuthId = await createAuthUser(secondEmail);
    createdAuthIds.push(otherAuthId);

    const inserted = await database<{ id: number }[]>`
      INSERT INTO crewcast.users (
        auth_user_id, email, name, is_onboarded, onboarding_step,
        has_subscription, plan
      ) VALUES (
        ${ownerAuthId}::uuid,
        ${firstEmail},
        'Account identity staging verification',
        false,
        1,
        false,
        'free_trial'
      )
      RETURNING id
    `;
    assert.equal(inserted.length, 1);
    const accountId = inserted[0].id;

    const { data: rotated, error: rotateError } = await admin.auth.admin.updateUserById(
      ownerAuthId,
      { email: changedEmail, email_confirm: true },
    );
    assert.equal(rotateError, null, rotateError?.message);
    assert.equal(rotated.user?.id, ownerAuthId);

    // Reproduce the currently deployed legacy POST /api/users shape during the
    // schema-first rolling window. It omits auth_user_id, then fetches by email
    // when INSERT returns no row. A confirmed email change must reuse the
    // existing account rather than collide on the UUID constraint.
    const legacyInsertAfterEmailChange = await database<{ id: number }[]>`
      INSERT INTO crewcast.users (
        email, name, is_onboarded, onboarding_step, has_subscription, plan
      ) VALUES (
        ${changedEmail},
        'Legacy rolling-deployment request',
        false,
        1,
        false,
        'free_trial'
      )
      ON CONFLICT (email) DO NOTHING
      RETURNING id
    `;
    assert.equal(
      legacyInsertAfterEmailChange.length,
      0,
      'Legacy email-change insert unexpectedly created another account.',
    );
    const legacyFallback = await database<{ id: number; authUserId: string }[]>`
      SELECT id, auth_user_id::text AS "authUserId"
      FROM crewcast.users
      WHERE email = ${changedEmail}
    `;
    assert.equal(
      legacyFallback.length,
      1,
      'Legacy rolling fallback did not recover exactly one account.',
    );
    assert.equal(legacyFallback[0].id, accountId);
    assert.equal(legacyFallback[0].authUserId, ownerAuthId);

    const resolved = await resolveApplicationAccountIdentity(
      { authUserId: ownerAuthId, email: changedEmail },
      identityStore,
    );
    assert.equal(resolved?.id, accountId, 'Email rotation created or selected another account.');
    assert.equal(resolved?.email, changedEmail, 'Contact email was not synchronized.');

    await assert.rejects(
      resolveApplicationAccountIdentity(
        { authUserId: otherAuthId, email: changedEmail },
        identityStore,
      ),
      AccountIdentityConflictError,
      'Another Auth UUID claimed an existing portfolio through its email.',
    );

    await assert.rejects(
      database`
        UPDATE crewcast.users
        SET auth_user_id = ${otherAuthId}::uuid
        WHERE id = ${accountId}
      `,
      /immutable once assigned/i,
      'The database allowed an account owner UUID to be replaced.',
    );

    await assert.rejects(
      database`DELETE FROM auth.users WHERE id = ${ownerAuthId}::uuid`,
      /foreign key constraint|users_auth_user_id_fkey/i,
      'Direct Auth deletion bypassed application cleanup.',
    );

    const legacyEmail = syntheticEmail('legacy-claim');
    const legacyRows = await database<{ id: number }[]>`
      INSERT INTO crewcast.users (
        email, name, is_onboarded, onboarding_step, has_subscription, plan
      ) VALUES (
        ${legacyEmail},
        'Legacy identity claim staging verification',
        false,
        1,
        false,
        'free_trial'
      )
      RETURNING id
    `;
    assert.equal(legacyRows.length, 1);
    const legacyAccountId = legacyRows[0].id;
    const legacyAuthId = await createAuthUser(legacyEmail);
    createdAuthIds.push(legacyAuthId);

    const concurrent = await Promise.all(
      Array.from({ length: 100 }, () => resolveApplicationAccountIdentity(
        { authUserId: legacyAuthId, email: legacyEmail },
        identityStore,
      )),
    );
    assert.deepEqual(
      new Set(concurrent.map((account) => account?.id)),
      new Set([legacyAccountId]),
      'Concurrent claims did not resolve to one application account.',
    );
    const legacyBinding = await database<{ count: number }[]>`
      SELECT count(*)::integer AS count
      FROM crewcast.users
      WHERE id = ${legacyAccountId}
        AND auth_user_id = ${legacyAuthId}::uuid
    `;
    assert.equal(legacyBinding[0].count, 1, 'Legacy account was not bound exactly once.');

    assert.deepEqual(
      await identityHealth(),
      { nullBindings: 0, duplicateBindings: 0, mismatchedBindings: 0 },
      'Identity stress test left an invalid mapping.',
    );
    console.log('Stable application-account identity staging verification passed.');
  } finally {
    await removeSyntheticFixtures();
    const after = await globalState();
    assert.deepEqual(after, before, 'Staging verification did not restore global row counts.');
    await database.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
