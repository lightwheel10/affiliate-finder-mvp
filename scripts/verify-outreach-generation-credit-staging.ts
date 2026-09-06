import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { config as loadEnvironment } from 'dotenv';
import postgres from 'postgres';
import { sql as applicationSql } from '../src/lib/db';
import {
  releaseOutreachGeneration,
  reserveOutreachGeneration,
  type OutreachGenerationDatabase,
  type OutreachGenerationInput,
  type OutreachGenerationLease,
} from '../src/lib/affiliates/outreach-generation-postgres';

const STAGING_PROJECT_REF = 'jxerxreqezhdsisdwddw';
const SYNTHETIC_EMAIL_PREFIX = 'codex-outreach-credit-';

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
  'Refusing to test outreach charging outside Terminal-Backup.',
);

const sql = postgres(databaseUrl, {
  max: 12,
  prepare: false,
  connect_timeout: 10,
  idle_timeout: 10,
});
const database = sql as unknown as OutreachGenerationDatabase;
const token = randomUUID().replaceAll('-', '');
const syntheticEmail = `${SYNTHETIC_EMAIL_PREFIX}${token}@example.invalid`;

interface Fixture {
  accountId: number;
  brandId: string;
  locationId: string;
  affiliateIds: [number, number];
}

interface Snapshot {
  used: number;
  topup: number;
  activeLeases: number;
  usageRows: number;
  refundRows: number;
}

function input(
  fixture: Fixture,
  affiliateId = fixture.affiliateIds[0],
): OutreachGenerationInput {
  return {
    accountId: fixture.accountId,
    brandId: fixture.brandId,
    brandLocationId: fixture.locationId,
    affiliateId,
    enforceCredits: true,
  };
}

function reservedLease(
  result: Awaited<ReturnType<typeof reserveOutreachGeneration>>,
): OutreachGenerationLease {
  assert.equal(result.outcome, 'reserved');
  if (result.outcome !== 'reserved') throw new Error('Outreach lease was not reserved.');
  return result.lease;
}

async function createFixture(): Promise<Fixture> {
  const users = await sql<{ id: number }[]>`
    INSERT INTO crewcast.users (
      email, name, is_onboarded, onboarding_step, has_subscription, plan
    )
    VALUES (${syntheticEmail}, 'Outreach credit verification', true, 8, false, 'free_trial')
    RETURNING id
  `;
  assert.equal(users.length, 1);
  const accountId = users[0].id;

  const brands = await sql<{ id: string }[]>`
    INSERT INTO crewcast.brands (user_id, name, normalized_domain, is_default)
    VALUES (${accountId}, 'Outreach verification', ${`outreach-${token}.example`}, true)
    RETURNING id::text AS id
  `;
  const brandId = brands[0].id;
  const locations = await sql<{ id: string }[]>`
    INSERT INTO crewcast.brand_locations (
      user_id, brand_id, country_code, language_code, topics, competitors, is_default
    )
    VALUES (
      ${accountId}, ${brandId}::bigint, 'gb', 'en',
      ARRAY['outreach verification'], ARRAY[]::text[], true
    )
    RETURNING id::text AS id
  `;
  const locationId = locations[0].id;

  await sql`
    INSERT INTO crewcast.user_credits (
      user_id,
      topic_search_credits_total,
      email_credits_total,
      ai_credits_total,
      topic_search_credits_used,
      email_credits_used,
      ai_credits_used,
      topic_search_credits_topup,
      email_credits_topup,
      ai_credits_topup,
      period_start,
      period_end,
      is_trial_period
    )
    VALUES (${accountId}, 0, 0, 10, 0, 0, 0, 0, 0, 0, NOW(), NOW() + INTERVAL '1 day', false)
  `;

  const affiliates = await sql<{ id: number }[]>`
    INSERT INTO crewcast.saved_affiliates (
      user_id, brand_id, brand_location_id, title, link, domain, snippet, source
    )
    VALUES
      (${accountId}, ${brandId}::bigint, ${locationId}::bigint,
        'Outreach creator one', ${`https://creator-one-${token}.example`},
        ${`creator-one-${token}.example`}, '', 'Instagram'),
      (${accountId}, ${brandId}::bigint, ${locationId}::bigint,
        'Outreach creator two', ${`https://creator-two-${token}.example`},
        ${`creator-two-${token}.example`}, '', 'TikTok')
    RETURNING id
  `;
  assert.equal(affiliates.length, 2);
  return {
    accountId,
    brandId,
    locationId,
    affiliateIds: [affiliates[0].id, affiliates[1].id],
  };
}

async function resetFixture(
  fixture: Fixture,
  total = 10,
  topup = 0,
): Promise<void> {
  await sql.begin(async (transaction) => {
    await transaction`
      UPDATE crewcast.user_credits
      SET ai_credits_total = ${total}, ai_credits_used = 0,
          ai_credits_topup = ${topup}, period_start = NOW(),
          period_end = NOW() + INTERVAL '1 day'
      WHERE user_id = ${fixture.accountId}
    `;
    await transaction`
      DELETE FROM crewcast.credit_transactions
      WHERE user_id = ${fixture.accountId}
        AND credit_type = 'ai'
    `;
    await transaction`
      UPDATE crewcast.saved_affiliates
      SET ai_generation_started_at = NULL, ai_generated_at = NULL,
          ai_generated_message = NULL, ai_generated_subject = NULL,
          ai_generated_messages = NULL
      WHERE user_id = ${fixture.accountId}
    `;
  });
}

async function snapshot(fixture: Fixture): Promise<Snapshot> {
  const rows = await sql<Snapshot[]>`
    SELECT
      credits.ai_credits_used AS used,
      credits.ai_credits_topup AS topup,
      (SELECT count(*)::integer
        FROM crewcast.saved_affiliates AS affiliates
        WHERE affiliates.user_id = credits.user_id
          AND affiliates.ai_generation_started_at IS NOT NULL
          AND (affiliates.ai_generated_at IS NULL
            OR affiliates.ai_generated_at < affiliates.ai_generation_started_at)
      ) AS "activeLeases",
      (SELECT count(*)::integer
        FROM crewcast.credit_transactions AS transactions
        WHERE transactions.user_id = credits.user_id
          AND transactions.credit_type = 'ai'
          AND transactions.reason = 'usage'
          AND transactions.reference_type = 'outreach'
      ) AS "usageRows",
      (SELECT count(*)::integer
        FROM crewcast.credit_transactions AS transactions
        WHERE transactions.user_id = credits.user_id
          AND transactions.credit_type = 'ai'
          AND transactions.reason = 'refund'
          AND transactions.reference_type = 'outreach_refund'
      ) AS "refundRows"
    FROM crewcast.user_credits AS credits
    WHERE credits.user_id = ${fixture.accountId}
  `;
  assert.equal(rows.length, 1);
  return rows[0];
}

async function verify(): Promise<void> {
  const fixture = await createFixture();
  const firstInput = input(fixture);

  const reservations = await Promise.all(Array.from({ length: 50 }, () =>
    reserveOutreachGeneration(firstInput, database),
  ));
  assert.equal(reservations.filter(({ outcome }) => outcome === 'reserved').length, 1);
  assert.equal(reservations.filter(({ outcome }) => outcome === 'in_progress').length, 49);
  assert.deepEqual(await snapshot(fixture), {
    used: 1, topup: 0, activeLeases: 1, usageRows: 1, refundRows: 0,
  });

  const lease = reservedLease(reservations.find(({ outcome }) => outcome === 'reserved')!);
  const releases = await Promise.all(Array.from({ length: 50 }, () =>
    releaseOutreachGeneration(firstInput, lease, database),
  ));
  assert.equal(releases.filter(Boolean).length, 1);
  assert.deepEqual(await snapshot(fixture), {
    used: 0, topup: 0, activeLeases: 0, usageRows: 1, refundRows: 1,
  });

  assert.equal(
    (await reserveOutreachGeneration(firstInput, database)).outcome,
    'reserved',
    'A released request must be immediately retryable.',
  );

  await resetFixture(fixture, 1);
  const competing = await Promise.all(fixture.affiliateIds.map((affiliateId) =>
    reserveOutreachGeneration(input(fixture, affiliateId), database),
  ));
  assert.equal(competing.filter(({ outcome }) => outcome === 'reserved').length, 1);
  assert.equal(competing.filter(({ outcome }) => outcome === 'insufficient_credits').length, 1);
  assert.deepEqual(await snapshot(fixture), {
    used: 1, topup: 0, activeLeases: 1, usageRows: 1, refundRows: 0,
  });

  await resetFixture(fixture, 0, 1);
  const topupLease = reservedLease(
    await reserveOutreachGeneration(firstInput, database),
  );
  assert.deepEqual(await snapshot(fixture), {
    used: 0, topup: 0, activeLeases: 1, usageRows: 1, refundRows: 0,
  });
  assert.equal(await releaseOutreachGeneration(firstInput, topupLease, database), true);
  assert.deepEqual(await snapshot(fixture), {
    used: 0, topup: 1, activeLeases: 0, usageRows: 1, refundRows: 1,
  });

  await resetFixture(fixture);
  const foreign = await reserveOutreachGeneration({
    ...firstInput,
    brandLocationId: '999999999999',
  }, database);
  assert.equal(foreign.outcome, 'affiliate_not_found');
  assert.deepEqual(await snapshot(fixture), {
    used: 0, topup: 0, activeLeases: 0, usageRows: 0, refundRows: 0,
  });

  console.log('Outreach generation credit staging verification passed.');
}

async function cleanup(): Promise<void> {
  await sql`
    DELETE FROM crewcast.users
    WHERE email = ${syntheticEmail}
  `;
  const remaining = await sql<{ count: number }[]>`
    SELECT count(*)::integer AS count
    FROM crewcast.users
    WHERE email LIKE ${`${SYNTHETIC_EMAIL_PREFIX}%@example.invalid`}
  `;
  assert.equal(remaining[0].count, 0, 'Synthetic outreach verifier users remain.');
}

async function main(): Promise<void> {
  try {
    await verify();
  } finally {
    await cleanup();
    await sql.end({ timeout: 15 });
    await applicationSql.end({ timeout: 15 });
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
