import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { config as loadEnvironment } from 'dotenv';
import postgres from 'postgres';

const stagingProjectRef = 'jxerxreqezhdsisdwddw';
const fixtureEmail = 'codex-paid-search-migration@example.invalid';

loadEnvironment({
  path: path.resolve(process.cwd(), '.env.staging.local'),
  override: true,
  quiet: true,
});

const databaseUrl = process.env.SUPABASE_DATABASE_URL;
if (!databaseUrl) throw new Error('SUPABASE_DATABASE_URL is missing.');

function extractProjectRef(connectionUrl: string): string {
  const parsed = new URL(connectionUrl);
  const direct = parsed.hostname.match(/^db\.([a-z0-9]{20})\.supabase\.co$/);
  const pooler = decodeURIComponent(parsed.username).match(/^postgres\.([a-z0-9]{20})$/);
  if (direct) return direct[1];
  if (pooler && parsed.hostname.endsWith('.pooler.supabase.com')) return pooler[1];
  throw new Error('Could not prove a Supabase staging project reference.');
}

assert.equal(
  extractProjectRef(databaseUrl),
  stagingProjectRef,
  'Refusing to test against anything except Terminal-Backup.',
);

const mode = process.argv[2];
const validModes = new Set([
  'prepare',
  'verify-cleanup',
  'prepare-rollback-guard',
  'cleanup-rollback-guard',
]);
if (!mode || !validModes.has(mode)) {
  throw new Error(
    'Use prepare, verify-cleanup, prepare-rollback-guard, or cleanup-rollback-guard.',
  );
}

const sql = postgres(databaseUrl, { max: 1, prepare: false });

async function createFixture(kind: 'legacy' | 'marked'): Promise<void> {
  const existing = await sql<{ count: number }[]>`
    SELECT count(*)::integer AS count
    FROM crewcast.users
    WHERE email = ${fixtureEmail}
  `;
  assert.equal(existing[0].count, 0, 'A prior migration fixture must not remain.');

  await sql.begin(async (transaction) => {
    const users = await transaction<{ id: number }[]>`
      INSERT INTO crewcast.users (
        email, name, is_onboarded, onboarding_step, has_subscription, plan
      ) VALUES (${fixtureEmail}, 'Migration verification', true, 8, false, 'free_trial')
      RETURNING id
    `;
    const accountId = users[0].id;
    const brands = await transaction<{ id: string }[]>`
      INSERT INTO crewcast.brands (user_id, name, normalized_domain, is_default)
      VALUES (${accountId}, 'Migration verification', 'migration-verification.example', true)
      RETURNING id::text AS id
    `;
    const locations = await transaction<{ id: string }[]>`
      INSERT INTO crewcast.brand_locations (
        user_id, brand_id, country_code, language_code, topics, competitors, is_default
      ) VALUES (
        ${accountId}, ${brands[0].id}::bigint, 'gb', 'en',
        ARRAY['migration verification'], ARRAY[]::text[], true
      )
      RETURNING id::text AS id
    `;
    await transaction`
      INSERT INTO crewcast.user_credits (
        user_id, topic_search_credits_total, topic_search_credits_used,
        topic_search_credits_topup, period_start, period_end, is_trial_period
      ) VALUES (${accountId}, 1, 1, 0, NOW(), NOW() + INTERVAL '30 days', false)
    `;
    const requestId = randomUUID();
    const snapshot = transaction.json({
      version: 1,
      brand: {
        id: brands[0].id,
        name: 'Migration verification',
        normalizedDomain: 'migration-verification.example',
      },
      location: {
        id: locations[0].id,
        countryCode: 'gb',
        countryName: 'United Kingdom',
        languageCode: 'en',
        languageName: 'English',
      },
      search: {
        keywords: ['migration verification'],
        competitors: [],
        sources: ['Web'],
        requestId,
      },
    });

    if (kind === 'legacy') {
      // This statement intentionally contains only the pre-0019 columns.
      await transaction`
        INSERT INTO crewcast.search_credit_reservations (
          user_id, request_id, brand_id, brand_location_id, settings_snapshot,
          status, credit_period_start, subscription_credits_consumed,
          topup_credits_consumed, created_at, updated_at
        ) VALUES (
          ${accountId}, ${requestId}::uuid, ${brands[0].id}::bigint,
          ${locations[0].id}::bigint, ${snapshot}, 'reserved',
          (SELECT period_start FROM crewcast.user_credits WHERE user_id = ${accountId}),
          1, 0, NOW() - INTERVAL '10 minutes', NOW() - INTERVAL '10 minutes'
        )
      `;
      return;
    }

    // A committed launch marker must make the down migration refuse to run.
    await transaction`
      INSERT INTO crewcast.search_credit_reservations (
        user_id, request_id, brand_id, brand_location_id, settings_snapshot,
        status, credit_period_start, subscription_credits_consumed,
        topup_credits_consumed, launch_attempted_at, created_at, updated_at
      ) VALUES (
        ${accountId}, ${requestId}::uuid, ${brands[0].id}::bigint,
        ${locations[0].id}::bigint, ${snapshot}, 'reserved',
        (SELECT period_start FROM crewcast.user_credits WHERE user_id = ${accountId}),
        1, 0, NOW(), NOW(), NOW()
      )
    `;
  });
}

async function cleanupFixture(): Promise<void> {
  await sql.begin(async (transaction) => {
      await transaction`
        ALTER TABLE crewcast.search_reconciliation_case_events
        DISABLE TRIGGER search_reconciliation_events_immutable
      `;
      await transaction`
        DELETE FROM crewcast.search_reconciliation_case_events AS events
        USING crewcast.search_reconciliation_cases AS cases,
              crewcast.users AS users
        WHERE events.case_id = cases.id
          AND cases.user_id = users.id
          AND users.email = ${fixtureEmail}
      `;
      await transaction`
        ALTER TABLE crewcast.search_reconciliation_case_events
        ENABLE TRIGGER search_reconciliation_events_immutable
      `;
      await transaction`
        DELETE FROM crewcast.search_reconciliation_cases AS cases
        USING crewcast.users AS users
        WHERE cases.user_id = users.id
          AND users.email = ${fixtureEmail}
      `;
      await transaction`
        DELETE FROM crewcast.search_credit_reservations AS reservations
        USING crewcast.users AS users
        WHERE reservations.user_id = users.id
          AND users.email = ${fixtureEmail}
      `;
      await transaction`
        DELETE FROM crewcast.user_credits AS credits
        USING crewcast.users AS users
        WHERE credits.user_id = users.id
          AND users.email = ${fixtureEmail}
      `;
      await transaction`
        DELETE FROM crewcast.brand_locations AS locations
        USING crewcast.users AS users
        WHERE locations.user_id = users.id
          AND users.email = ${fixtureEmail}
      `;
      await transaction`
        DELETE FROM crewcast.brands AS brands
        USING crewcast.users AS users
        WHERE brands.user_id = users.id
          AND users.email = ${fixtureEmail}
      `;
      await transaction`DELETE FROM crewcast.users WHERE email = ${fixtureEmail}`;
  });

  const residue = await sql<{ count: number }[]>`
    SELECT count(*)::integer AS count
    FROM crewcast.users
    WHERE email = ${fixtureEmail}
  `;
  assert.equal(residue[0].count, 0);
}

async function prepare(): Promise<void> {
  await createFixture('legacy');
  console.log('Pre-0019 reserved/no-job fixture prepared on Terminal-Backup.');
}

async function verifyAndCleanup(): Promise<void> {
  try {
    const rows = await sql<{
      reservation_status: string;
      marker_matches_created_at: boolean;
      error_message: string;
      case_type: string;
      case_status: string;
      event_count: number;
    }[]>`
      SELECT
        reservations.status AS reservation_status,
        reservations.launch_attempted_at = reservations.created_at
          AS marker_matches_created_at,
        reservations.error_message,
        cases.case_type,
        cases.status AS case_status,
        (
          SELECT count(*)::integer
          FROM crewcast.search_reconciliation_case_events AS events
          WHERE events.case_id = cases.id
        ) AS event_count
      FROM crewcast.users AS users
      JOIN crewcast.search_credit_reservations AS reservations
        ON reservations.user_id = users.id
      JOIN crewcast.search_reconciliation_cases AS cases
        ON cases.user_id = reservations.user_id
       AND cases.source_request_id = reservations.request_id
       AND cases.case_type = 'paid_search'
      WHERE users.email = ${fixtureEmail}
    `;
    assert.equal(rows.length, 1);
    assert.deepEqual({ ...rows[0] }, {
      reservation_status: 'uncertain',
      marker_matches_created_at: true,
      error_message: 'Pre-migration reservation had no job; provider launch requires review.',
      case_type: 'paid_search',
      case_status: 'open',
      event_count: 1,
    });
  } finally {
    await cleanupFixture();
  }
  console.log('Migration backfill verified and synthetic fixture removed.');
}

async function prepareRollbackGuard(): Promise<void> {
  await createFixture('marked');
  console.log('In-flight paid-search rollback-guard fixture prepared on Terminal-Backup.');
}

async function cleanupRollbackGuard(): Promise<void> {
  await cleanupFixture();
  console.log('Rollback-guard fixture removed from Terminal-Backup.');
}

async function main(): Promise<void> {
  try {
    if (mode === 'prepare') await prepare();
    else if (mode === 'verify-cleanup') await verifyAndCleanup();
    else if (mode === 'prepare-rollback-guard') await prepareRollbackGuard();
    else await cleanupRollbackGuard();
  } finally {
    await sql.end({ timeout: 5 });
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
