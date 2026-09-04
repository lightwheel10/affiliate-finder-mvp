import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { config as loadEnvironment } from 'dotenv';
import postgres from 'postgres';
import {
  fingerprintSuggestionAnalysis,
  type SuggestionAnalysisInput,
} from '../src/lib/suggestions/analysis';
import {
  claimOnboardingSuggestionAnalysis,
  completeOnboardingSuggestionAnalysis,
  deleteOnboardingSuggestionIdentityGuard,
  failOnboardingSuggestionAnalysis,
  markOnboardingSuggestionProvidersStarted,
  type SuggestionAnalysisSqlExecutor,
} from '../src/lib/suggestions/analysis-postgres';
import type { SuggestionAnalysisResult } from '../src/lib/suggestions/result';
import { deletePostgresAccountData } from '../src/lib/users/delete-account-postgres';

const STAGING_PROJECT_REF = 'jxerxreqezhdsisdwddw';
const SYNTHETIC_EMAIL_PATTERN = 'codex-suggestions-%@example.invalid';
const SYNTHETIC_AUTH_PREFIX = '00000000-0000-4000-8000-';

loadEnvironment({
  path: path.resolve(process.cwd(), '.env.staging.local'),
  override: true,
  quiet: true,
});

const databaseUrl = process.env.SUPABASE_DATABASE_URL;
if (!databaseUrl) throw new Error('SUPABASE_DATABASE_URL is missing.');

function extractProjectRef(connectionUrl: string): string {
  const parsed = new URL(connectionUrl);
  const candidates = new Set<string>();
  const direct = parsed.hostname.match(/^db\.([a-z0-9]{20})\.supabase\.co$/);
  if (direct) candidates.add(direct[1]);
  const pooler = decodeURIComponent(parsed.username).match(/^postgres\.([a-z0-9]{20})$/);
  if (pooler && parsed.hostname.endsWith('.pooler.supabase.com')) candidates.add(pooler[1]);
  if (candidates.size !== 1) throw new Error('Could not prove exactly one Supabase project ref.');
  return [...candidates][0];
}

assert.equal(
  extractProjectRef(databaseUrl),
  STAGING_PROJECT_REF,
  'Refusing to run suggestion tests against anything except the isolated staging project.',
);

const database = postgres(databaseUrl, {
  // The staging session pool currently allows 15 clients. Eight independent
  // connections are enough to exercise real lock contention without starving
  // the dashboard or preview application.
  max: 8,
  prepare: false,
  connect_timeout: 10,
  idle_timeout: 10,
});
const executor = database as unknown as SuggestionAnalysisSqlExecutor;

interface GlobalState {
  users: number;
  analyses: number;
  identityGuards: number;
  syntheticUsers: number;
}

async function globalState(): Promise<GlobalState> {
  const rows = await database<GlobalState[]>`
    SELECT
      (SELECT count(*) FROM crewcast.users)::integer AS users,
      (SELECT count(*) FROM crewcast.onboarding_suggestion_analyses)::integer AS analyses,
      (
        SELECT count(*)
        FROM crewcast.onboarding_suggestion_identity_guards
      )::integer AS "identityGuards",
      (
        SELECT count(*)
        FROM crewcast.users
        WHERE email LIKE ${SYNTHETIC_EMAIL_PATTERN}
      )::integer AS "syntheticUsers"
  `;
  assert.equal(rows.length, 1);
  return rows[0];
}

async function removeSyntheticFixtures(): Promise<number> {
  const guards = await database<{ auth_user_id: string }[]>`
    DELETE FROM crewcast.onboarding_suggestion_identity_guards
    WHERE auth_user_id::text LIKE ${`${SYNTHETIC_AUTH_PREFIX}%`}
    RETURNING auth_user_id::text AS auth_user_id
  `;
  const rows = await database<{ id: number }[]>`
    DELETE FROM crewcast.users
    WHERE email LIKE ${SYNTHETIC_EMAIL_PATTERN}
    RETURNING id
  `;
  return guards.length + rows.length;
}

function syntheticAuthUserId(): string {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  return `${SYNTHETIC_AUTH_PREFIX}${suffix}`;
}

async function assertMigration(): Promise<void> {
  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/0014_onboarding_suggestion_analysis.up.sql',
  );
  const expectedChecksum = createHash('sha256')
    .update(readFileSync(migrationPath))
    .digest('hex');
  const rows = await database<{
    checksum: string;
    constraints: number;
    triggers: number;
    rlsEnabled: boolean;
    authenticatedPrivileges: boolean;
  }[]>`
    SELECT
      migrations.checksum_sha256 AS checksum,
      (
        SELECT count(*)
        FROM pg_constraint
        WHERE conrelid = 'crewcast.onboarding_suggestion_analyses'::regclass
      )::integer AS constraints,
      (
        SELECT count(*)
        FROM pg_trigger
        WHERE tgrelid = 'crewcast.onboarding_suggestion_analyses'::regclass
          AND tgname = 'onboarding_suggestion_analyses_lifecycle'
          AND NOT tgisinternal
      )::integer AS triggers,
      (
        SELECT relrowsecurity
        FROM pg_class
        WHERE oid = 'crewcast.onboarding_suggestion_analyses'::regclass
      ) AS "rlsEnabled",
      has_table_privilege(
        'authenticated',
        'crewcast.onboarding_suggestion_analyses',
        'SELECT,INSERT,UPDATE,DELETE'
      ) AS "authenticatedPrivileges"
    FROM crewcast.schema_migrations AS migrations
    WHERE migrations.version = '0014'
  `;
  assert.equal(rows.length, 1, 'Migration 0014 must be applied exactly once.');
  assert.equal(rows[0].checksum, expectedChecksum, 'Migration 0014 checksum drifted.');
  assert.equal(rows[0].constraints, 9, 'Suggestion analysis constraints are incomplete.');
  assert.equal(rows[0].triggers, 1, 'Suggestion analysis lifecycle trigger is missing.');
  assert.equal(rows[0].rlsEnabled, true, 'Suggestion analysis RLS is disabled.');
  assert.equal(
    rows[0].authenticatedPrivileges,
    false,
    'The authenticated browser role can access server-owned suggestion state.',
  );

  const guardMigrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/0015_onboarding_suggestion_identity_guard.up.sql',
  );
  const guardChecksum = createHash('sha256')
    .update(readFileSync(guardMigrationPath))
    .digest('hex');
  const guardRows = await database<{
    checksum: string;
    primaryKeys: number;
    rlsEnabled: boolean;
    browserPrivileges: boolean;
  }[]>`
    SELECT
      migrations.checksum_sha256 AS checksum,
      (
        SELECT count(*)
        FROM pg_constraint
        WHERE conrelid = 'crewcast.onboarding_suggestion_identity_guards'::regclass
          AND contype = 'p'
      )::integer AS "primaryKeys",
      (
        SELECT relrowsecurity
        FROM pg_class
        WHERE oid = 'crewcast.onboarding_suggestion_identity_guards'::regclass
      ) AS "rlsEnabled",
      has_table_privilege(
        'authenticated',
        'crewcast.onboarding_suggestion_identity_guards',
        'SELECT,INSERT,UPDATE,DELETE'
      ) AS "browserPrivileges"
    FROM crewcast.schema_migrations AS migrations
    WHERE migrations.version = '0015'
  `;
  assert.equal(guardRows.length, 1, 'Migration 0015 must be applied exactly once.');
  assert.equal(guardRows[0].checksum, guardChecksum, 'Migration 0015 checksum drifted.');
  assert.equal(guardRows[0].primaryKeys, 1, 'Suggestion identity guard key is missing.');
  assert.equal(guardRows[0].rlsEnabled, true, 'Suggestion identity guard RLS is disabled.');
  assert.equal(
    guardRows[0].browserPrivileges,
    false,
    'The authenticated browser role can access suggestion identity guards.',
  );
}

async function createAccount(label: string, isOnboarded = false): Promise<number> {
  const token = randomUUID().replaceAll('-', '');
  const rows = await database<{ id: number }[]>`
    INSERT INTO crewcast.users (
      email,
      name,
      is_onboarded,
      onboarding_step,
      has_subscription,
      plan
    ) VALUES (
      ${`codex-suggestions-${label}-${token}@example.invalid`},
      'Suggestion staging verification',
      ${isOnboarded},
      ${isOnboarded ? 7 : 3},
      false,
      'free_trial'
    )
    RETURNING id
  `;
  assert.equal(rows.length, 1);
  return rows[0].id;
}

const input: SuggestionAnalysisInput = {
  normalizedDomain: 'selecdoo.com',
  targetCountry: 'Germany',
  targetLanguage: 'German',
};
const inputHash = fingerprintSuggestionAnalysis(input);
const result: SuggestionAnalysisResult = {
  competitors: [{ name: 'Competitor', domain: 'competitor.example' }],
  topics: [{ keyword: 'Affiliate Software' }],
  industry: 'Affiliate marketing',
  targetAudience: 'Affiliate managers',
};

async function main(): Promise<void> {
  const createdAccountIds: number[] = [];
  const staleFixtures = await removeSyntheticFixtures();
  if (staleFixtures > 0) {
    console.warn(`Removed ${staleFixtures} stale synthetic suggestion fixture(s).`);
  }
  const before = await globalState();
  assert.equal(before.syntheticUsers, 0, 'Stale synthetic suggestion accounts must be removed first.');

  try {
    await assertMigration();

  const accountId = await createAccount('concurrency');
  const authUserId = syntheticAuthUserId();
  createdAccountIds.push(accountId);
  const requestIds = Array.from({ length: 100 }, () => randomUUID());
  const claims = await Promise.all(requestIds.map((requestId) =>
    claimOnboardingSuggestionAnalysis({
      accountId,
      authUserId,
      requestId,
      inputHash,
      inputSnapshot: input,
    }, executor)));
  const claimedIndexes = claims
    .map((claim, index) => claim.outcome === 'claimed' ? index : -1)
    .filter((index) => index >= 0);
  assert.deepEqual(claimedIndexes.length, 1, 'Exactly one concurrent request must win.');
  for (const [index, claim] of claims.entries()) {
    if (index === claimedIndexes[0]) continue;
    assert.deepEqual(claim, { outcome: 'blocked', reason: 'in_progress' });
  }

  const winningRequestId = requestIds[claimedIndexes[0]];
  await markOnboardingSuggestionProvidersStarted(
    accountId,
    winningRequestId,
    inputHash,
    executor,
  );
  await completeOnboardingSuggestionAnalysis(
    accountId,
    winningRequestId,
    inputHash,
    result,
    executor,
  );
  const cached = await claimOnboardingSuggestionAnalysis({
    accountId,
    authUserId,
    requestId: randomUUID(),
    inputHash,
    inputSnapshot: input,
  }, executor);
  assert.deepEqual(cached, { outcome: 'cached', result });

  const changedInput = { ...input, targetCountry: 'United Kingdom' };
  const changed = await claimOnboardingSuggestionAnalysis({
    accountId,
    authUserId,
    requestId: randomUUID(),
    inputHash: fingerprintSuggestionAnalysis(changedInput),
    inputSnapshot: changedInput,
  }, executor);
  assert.deepEqual(changed, { outcome: 'blocked', reason: 'already_used' });

  const rotatedEmailAccountId = await createAccount('rotated-email');
  createdAccountIds.push(rotatedEmailAccountId);
  assert.deepEqual(await claimOnboardingSuggestionAnalysis({
    accountId: rotatedEmailAccountId,
    authUserId,
    requestId: randomUUID(),
    inputHash,
    inputSnapshot: input,
  }, executor), { outcome: 'blocked', reason: 'already_used' });

  await assert.rejects(database`
    UPDATE crewcast.onboarding_suggestion_analyses
    SET input_hash = ${fingerprintSuggestionAnalysis(changedInput)}
    WHERE user_id = ${accountId}
  `, /provenance is immutable|terminal onboarding suggestion analysis is immutable/i);

  const failedAccountId = await createAccount('failed');
  const failedAuthUserId = syntheticAuthUserId();
  createdAccountIds.push(failedAccountId);
  const failedRequestId = randomUUID();
  assert.deepEqual(await claimOnboardingSuggestionAnalysis({
    accountId: failedAccountId,
    authUserId: failedAuthUserId,
    requestId: failedRequestId,
    inputHash,
    inputSnapshot: input,
  }, executor), { outcome: 'claimed' });
  await markOnboardingSuggestionProvidersStarted(
    failedAccountId,
    failedRequestId,
    inputHash,
    executor,
  );
  await failOnboardingSuggestionAnalysis(
    failedAccountId,
    failedRequestId,
    inputHash,
    'FAILED_TO_SCRAPE_WEBSITE',
    executor,
  );
  assert.deepEqual(await claimOnboardingSuggestionAnalysis({
    accountId: failedAccountId,
    authUserId: failedAuthUserId,
    requestId: randomUUID(),
    inputHash,
    inputSnapshot: input,
  }, executor), { outcome: 'blocked', reason: 'already_used' });

  const onboardedAccountId = await createAccount('onboarded', true);
  const onboardedAuthUserId = syntheticAuthUserId();
  createdAccountIds.push(onboardedAccountId);
  assert.deepEqual(await claimOnboardingSuggestionAnalysis({
    accountId: onboardedAccountId,
    authUserId: onboardedAuthUserId,
    requestId: randomUUID(),
    inputHash,
    inputSnapshot: input,
  }, executor), { outcome: 'blocked', reason: 'account_not_eligible' });
  const onboardedRows = await database<{ count: number }[]>`
    SELECT count(*)::integer AS count
    FROM crewcast.onboarding_suggestion_analyses
    WHERE user_id = ${onboardedAccountId}
  `;
  assert.equal(onboardedRows[0].count, 0);

  const deletionAccountId = await createAccount('deletion');
  const deletionAuthUserId = syntheticAuthUserId();
  createdAccountIds.push(deletionAccountId);
  const deletionRequestId = randomUUID();
  assert.deepEqual(await claimOnboardingSuggestionAnalysis({
    accountId: deletionAccountId,
    authUserId: deletionAuthUserId,
    requestId: deletionRequestId,
    inputHash,
    inputSnapshot: input,
  }, executor), { outcome: 'claimed' });
  await markOnboardingSuggestionProvidersStarted(
    deletionAccountId,
    deletionRequestId,
    inputHash,
    executor,
  );
  const deleted = await deletePostgresAccountData(deletionAccountId, database);
  assert.equal(
    deleted.suggestionAnalyses,
    1,
    'Account deletion must explicitly remove and report the suggestion analysis.',
  );
  const deletedAccountRows = await database<{ count: number }[]>`
    SELECT count(*)::integer AS count
    FROM crewcast.users
    WHERE id = ${deletionAccountId}
  `;
  assert.equal(deletedAccountRows[0].count, 0, 'The deletion fixture account still exists.');
  await assert.rejects(
    completeOnboardingSuggestionAnalysis(
      deletionAccountId,
      deletionRequestId,
      inputHash,
      result,
      executor,
    ),
    /could not be completed safely/i,
    'A provider completion cannot recreate analysis state after account deletion.',
  );

  const recreatedAccountId = await createAccount('recreated-after-delete');
  createdAccountIds.push(recreatedAccountId);
  assert.deepEqual(await claimOnboardingSuggestionAnalysis({
    accountId: recreatedAccountId,
    authUserId: deletionAuthUserId,
    requestId: randomUUID(),
    inputHash,
    inputSnapshot: input,
  }, executor), { outcome: 'blocked', reason: 'already_used' });
  assert.equal(
    await deleteOnboardingSuggestionIdentityGuard(deletionAuthUserId, executor),
    true,
    'Confirmed Auth deletion must remove the minimal identity guard.',
  );

    console.log('Onboarding suggestion staging verification passed.');
  } finally {
    await database`
      DELETE FROM crewcast.onboarding_suggestion_identity_guards
      WHERE auth_user_id::text LIKE ${`${SYNTHETIC_AUTH_PREFIX}%`}
    `;
    if (createdAccountIds.length > 0) {
      await database`
        DELETE FROM crewcast.users
        WHERE id = ANY(${createdAccountIds}::integer[])
      `;
    }
    const after = await globalState();
    assert.deepEqual(after, before, 'Staging verification did not restore global row counts.');
    await database.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
