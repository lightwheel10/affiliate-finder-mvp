import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { config as loadEnvironment } from 'dotenv';
import postgres from 'postgres';
import {
  markSearchLaunchAttempted,
  releaseSearchCredit,
  reserveSearchCredit,
} from '../src/lib/search/credit-reservations-postgres';
import {
  persistSearchJobIfActive,
  type SearchStartSqlExecutor,
} from '../src/lib/search/start-postgres';
import type {
  SearchSettingsSnapshot,
} from '../src/lib/search/start';
import type { SearchResultSnapshot } from '../src/lib/search/status';

const stagingProjectRef = 'jxerxreqezhdsisdwddw';
const syntheticEmailPattern = 'codex-search-credit-%@example.invalid';
const stressCount = 100;

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
  const poolerHost = /\.pooler\.supabase\.com$/.test(parsed.hostname);
  const pooler = decodeURIComponent(parsed.username).match(/^postgres\.([a-z0-9]{20})$/);
  if (direct) return direct[1];
  if (poolerHost && pooler) return pooler[1];
  throw new Error('Could not prove a Supabase staging project reference.');
}

assert.equal(
  extractProjectRef(databaseUrl),
  stagingProjectRef,
  'Refusing to test against anything except Terminal-Backup.',
);

// Terminal-Backup's session pool is capped at 15 clients. Ten connections are
// enough to create real lock contention while leaving headroom for the app SQL
// client used by finalization checks.
const fixtureSql = postgres(databaseUrl, { max: 10, prepare: false });
const executor = fixtureSql as unknown as SearchStartSqlExecutor;

interface Foundation {
  accountId: number;
  email: string;
  brandId: string;
  locationId: string;
}

interface StatusModule {
  failSearchJob(
    context: object,
    input: {
      terminalStatus: 'failed';
      errorMessage: string;
      estimatedCostUsd: number;
      durationMs: number;
    },
  ): Promise<{ outcome: string }>;
  finalizeSearchJob(
    context: object,
    input: {
      results: readonly SearchResultSnapshot[];
      enrichmentSucceeded: boolean;
      estimatedCostUsd: number;
      durationMs: number;
    },
  ): Promise<{ outcome: string; resultsCount: number }>;
  loadOwnedSearchJob(accountId: number, jobId: number): Promise<object | null>;
}

async function loadStatusModule(): Promise<StatusModule> {
  const imported = await import('../src/lib/search/status-postgres');
  return (imported.default ?? imported) as unknown as StatusModule;
}

async function closeApplicationSql(): Promise<void> {
  const imported = await import('../src/lib/db');
  const exports = (imported.default ?? imported) as unknown as {
    sql: { end(options?: { timeout?: number }): Promise<void> };
  };
  await exports.sql.end({ timeout: 15 });
}

async function createFoundation(token: string): Promise<Foundation> {
  const email = `codex-search-credit-${token}@example.invalid`;
  const users = await fixtureSql<{ id: number }[]>`
    INSERT INTO crewcast.users (
      email, name, is_onboarded, onboarding_step, has_subscription, plan
    )
    VALUES (${email}, 'Credit reservation verification', true, 8, false, 'free_trial')
    RETURNING id
  `;
  const accountId = users[0].id;
  const brands = await fixtureSql<{ id: string }[]>`
    INSERT INTO crewcast.brands (user_id, name, normalized_domain, is_default)
    VALUES (${accountId}, 'Credit verification', ${`credit-${token}.example`}, true)
    RETURNING id::text AS id
  `;
  const brandId = brands[0].id;
  const locations = await fixtureSql<{ id: string }[]>`
    INSERT INTO crewcast.brand_locations (
      user_id, brand_id, country_code, language_code, topics, competitors, is_default
    )
    VALUES (
      ${accountId}, ${brandId}::bigint, 'gb', 'en',
      ARRAY['credit'], ARRAY[]::text[], true
    )
    RETURNING id::text AS id
  `;
  await fixtureSql`
    INSERT INTO crewcast.user_credits (
      user_id,
      topic_search_credits_total,
      topic_search_credits_used,
      topic_search_credits_topup,
      period_start,
      period_end,
      is_trial_period
    )
    VALUES (${accountId}, 1, 0, 0, NOW(), NOW() + INTERVAL '30 days', false)
  `;
  return { accountId, email, brandId, locationId: locations[0].id };
}

function snapshot(foundation: Foundation, requestId: string, keyword: string): SearchSettingsSnapshot {
  return {
    version: 1,
    brand: {
      id: foundation.brandId,
      name: 'Credit verification',
      normalizedDomain: 'credit-verification.example',
    },
    location: {
      id: foundation.locationId,
      countryCode: 'gb',
      countryName: 'United Kingdom',
      languageCode: 'en',
      languageName: 'English',
    },
    search: {
      keywords: [keyword],
      competitors: [],
      sources: ['Web'],
      requestId,
    },
  };
}

async function reserve(
  foundation: Foundation,
  requestId: string,
  keyword: string,
) {
  return reserveSearchCredit(executor, {
    accountId: foundation.accountId,
    requestId,
    brandId: foundation.brandId,
    brandLocationId: foundation.locationId,
    settingsSnapshot: snapshot(foundation, requestId, keyword),
  });
}

async function balance(foundation: Foundation) {
  const rows = await fixtureSql<{
    used: number;
    topup: number;
    reservations: number;
  }[]>`
    SELECT
      credits.topic_search_credits_used AS used,
      credits.topic_search_credits_topup AS topup,
      (
        SELECT count(*)::integer
        FROM crewcast.search_credit_reservations AS reservations
        WHERE reservations.user_id = credits.user_id
      ) AS reservations
    FROM crewcast.user_credits AS credits
    WHERE credits.user_id = ${foundation.accountId}
  `;
  assert.equal(rows.length, 1);
  return rows[0];
}

async function createReservedJob(
  foundation: Foundation,
  requestId: string,
  keyword: string,
): Promise<number> {
  const settingsSnapshot = snapshot(foundation, requestId, keyword);
  const reservation = await reserve(foundation, requestId, keyword);
  assert.equal(reservation.outcome, 'reserved');
  await markSearchLaunchAttempted(executor, foundation.accountId, requestId);
  const job = await persistSearchJobIfActive(executor, {
    accountId: foundation.accountId,
    brandId: foundation.brandId,
    brandLocationId: foundation.locationId,
    combinedKeyword: keyword,
    sources: ['Web'],
    runId: `synthetic-${requestId}`,
    requestId,
    reservationKind: 'credit',
    userSettings: {
      targetCountry: 'United Kingdom',
      targetLanguage: 'English',
      userBrand: 'credit-verification.example',
      topics: [keyword],
      competitors: [],
    },
    settingsSnapshot,
  });
  assert.ok(job?.created);
  return job.id;
}

async function verifyConcurrentReservation(foundation: Foundation): Promise<void> {
  const duplicateRequest = randomUUID();
  await fixtureSql`
    UPDATE crewcast.user_credits
    SET topic_search_credits_total = 100, topic_search_credits_used = 0
    WHERE user_id = ${foundation.accountId}
  `;
  const duplicateResults = await Promise.all(
    Array.from({ length: stressCount }, () => reserve(foundation, duplicateRequest, 'duplicate')),
  );
  assert.equal(duplicateResults.filter(({ outcome }) => outcome === 'reserved').length, 1);
  assert.equal(
    duplicateResults.filter(({ outcome }) => outcome === 'existing').length,
    stressCount - 1,
  );
  assert.deepEqual(await balance(foundation), { used: 1, topup: 0, reservations: 1 });
  const duplicatePeriodEvidence = await fixtureSql<{
    period_matches: boolean;
    subscription_credits_consumed: number;
    topup_credits_consumed: number;
  }[]>`
    SELECT
      credits.period_start = reservations.credit_period_start AS period_matches,
      reservations.subscription_credits_consumed,
      reservations.topup_credits_consumed
    FROM crewcast.search_credit_reservations AS reservations
    JOIN crewcast.user_credits AS credits ON credits.user_id = reservations.user_id
    WHERE reservations.user_id = ${foundation.accountId}
      AND reservations.request_id = ${duplicateRequest}::uuid
  `;
  assert.equal(duplicatePeriodEvidence.length, 1);
  assert.equal(duplicatePeriodEvidence[0].period_matches, true);
  assert.equal(duplicatePeriodEvidence[0].subscription_credits_consumed, 1);
  assert.equal(duplicatePeriodEvidence[0].topup_credits_consumed, 0);
  await releaseSearchCredit(executor, foundation.accountId, duplicateRequest);
  const duplicateReleaseEvidence = await fixtureSql<{
    used: number;
    status: string;
  }[]>`
    SELECT credits.topic_search_credits_used AS used, reservations.status
    FROM crewcast.search_credit_reservations AS reservations
    JOIN crewcast.user_credits AS credits ON credits.user_id = reservations.user_id
    WHERE reservations.user_id = ${foundation.accountId}
      AND reservations.request_id = ${duplicateRequest}::uuid
  `;
  assert.equal(duplicateReleaseEvidence.length, 1);
  assert.equal(duplicateReleaseEvidence[0].used, 0);
  assert.equal(duplicateReleaseEvidence[0].status, 'released');

  await fixtureSql`
    UPDATE crewcast.user_credits
    SET topic_search_credits_total = 1, topic_search_credits_used = 0
    WHERE user_id = ${foundation.accountId}
  `;
  const distinctResults = await Promise.all(
    Array.from({ length: stressCount }, (_, index) =>
      reserve(foundation, randomUUID(), `distinct-${index}`)),
  );
  assert.equal(distinctResults.filter(({ outcome }) => outcome === 'reserved').length, 1);
  assert.equal(
    distinctResults.filter(({ outcome }) => outcome === 'insufficient').length,
    stressCount - 1,
  );
  assert.equal((await balance(foundation)).used, 1);
  const winning = await fixtureSql<{ request_id: string }[]>`
    SELECT request_id::text AS request_id
    FROM crewcast.search_credit_reservations
    WHERE user_id = ${foundation.accountId}
      AND status = 'reserved'
  `;
  assert.equal(winning.length, 1);
  const periodEvidence = await fixtureSql<{
    period_matches: boolean;
    subscription_credits_consumed: number;
    topup_credits_consumed: number;
  }[]>`
    SELECT
      credits.period_start = reservations.credit_period_start AS period_matches,
      reservations.subscription_credits_consumed,
      reservations.topup_credits_consumed
    FROM crewcast.search_credit_reservations AS reservations
    JOIN crewcast.user_credits AS credits ON credits.user_id = reservations.user_id
    WHERE reservations.user_id = ${foundation.accountId}
      AND reservations.request_id = ${winning[0].request_id}::uuid
  `;
  assert.equal(periodEvidence.length, 1);
  assert.equal(periodEvidence[0].period_matches, true);
  assert.equal(periodEvidence[0].subscription_credits_consumed, 1);
  assert.equal(periodEvidence[0].topup_credits_consumed, 0);
  await releaseSearchCredit(executor, foundation.accountId, winning[0].request_id);
  assert.equal((await balance(foundation)).used, 0);
}

async function verifyTopupRestoration(foundation: Foundation): Promise<void> {
  await fixtureSql`
    UPDATE crewcast.user_credits
    SET topic_search_credits_total = 0,
        topic_search_credits_used = 0,
        topic_search_credits_topup = 1
    WHERE user_id = ${foundation.accountId}
  `;
  const requestId = randomUUID();
  assert.equal((await reserve(foundation, requestId, 'topup')).outcome, 'reserved');
  assert.equal((await balance(foundation)).topup, 0);
  await releaseSearchCredit(executor, foundation.accountId, requestId);
  assert.equal((await balance(foundation)).topup, 1);
}

async function verifyFinalizationLifecycle(foundation: Foundation): Promise<void> {
  await fixtureSql`
    UPDATE crewcast.user_credits
    SET topic_search_credits_total = 3,
        topic_search_credits_used = 0,
        topic_search_credits_topup = 0
    WHERE user_id = ${foundation.accountId}
  `;
  const statusApi = await loadStatusModule();

  const successJobId = await createReservedJob(foundation, randomUUID(), 'success');
  const successContext = await statusApi.loadOwnedSearchJob(foundation.accountId, successJobId);
  assert.ok(successContext);
  const successful = await Promise.all(
    Array.from({ length: 30 }, () => statusApi.finalizeSearchJob(successContext, {
      results: [{
        title: 'Credit result',
        link: 'https://credit-result.example/path',
        domain: 'credit-result.example',
        source: 'Web',
        snippet: 'Synthetic credit reservation result',
        discoveryMethod: { type: 'keyword', value: 'success' },
      }],
      enrichmentSucceeded: true,
      estimatedCostUsd: 0.01,
      durationMs: 10,
    })),
  );
  assert.equal(successful.filter(({ outcome }) => outcome === 'completed').length, 1);
  assert.equal(successful.filter(({ outcome }) => outcome === 'already_completed').length, 29);

  const successRows = await fixtureSql<{
    reservation_status: string;
    used: number;
    usage_rows: number;
  }[]>`
    SELECT
      reservations.status AS reservation_status,
      credits.topic_search_credits_used AS used,
      (
        SELECT count(*)::integer
        FROM crewcast.credit_transactions AS transactions
        WHERE transactions.user_id = jobs.user_id
          AND transactions.search_job_id = jobs.id
          AND transactions.credit_type = 'topic_search'
          AND transactions.reason = 'usage'
      ) AS usage_rows
    FROM crewcast.search_jobs AS jobs
    JOIN crewcast.search_credit_reservations AS reservations
      ON reservations.search_job_id = jobs.id
     AND reservations.user_id = jobs.user_id
    JOIN crewcast.user_credits AS credits ON credits.user_id = jobs.user_id
    WHERE jobs.id = ${successJobId}
  `;
  assert.equal(successRows.length, 1);
  assert.equal(successRows[0].reservation_status, 'consumed');
  assert.equal(successRows[0].used, 1);
  assert.equal(successRows[0].usage_rows, 1);

  const zeroJobId = await createReservedJob(foundation, randomUUID(), 'zero');
  const zeroContext = await statusApi.loadOwnedSearchJob(foundation.accountId, zeroJobId);
  assert.ok(zeroContext);
  const zero = await statusApi.finalizeSearchJob(zeroContext, {
    results: [],
    enrichmentSucceeded: true,
    estimatedCostUsd: 0.01,
    durationMs: 10,
  });
  assert.equal(zero.outcome, 'completed');
  assert.equal((await balance(foundation)).used, 2);

  const failedJobId = await createReservedJob(foundation, randomUUID(), 'failed');
  const failedContext = await statusApi.loadOwnedSearchJob(foundation.accountId, failedJobId);
  assert.ok(failedContext);
  const failed = await statusApi.failSearchJob(failedContext, {
    terminalStatus: 'failed',
    errorMessage: 'Synthetic failure',
    estimatedCostUsd: 0.01,
    durationMs: 10,
  });
  assert.equal(failed.outcome, 'failed');
  assert.equal((await balance(foundation)).used, 2);

  const terminalRows = await fixtureSql<{ status: string; count: number }[]>`
    SELECT status, count(*)::integer AS count
    FROM crewcast.search_credit_reservations
    WHERE user_id = ${foundation.accountId}
      AND search_job_id IN (${zeroJobId}, ${failedJobId})
    GROUP BY status
    ORDER BY status
  `;
  assert.deepEqual(terminalRows.map((row) => ({ ...row })), [
    { status: 'consumed', count: 1 },
    { status: 'released', count: 1 },
  ]);
}

async function verifyImmutability(foundation: Foundation): Promise<void> {
  const reservation = await fixtureSql<{ id: string }[]>`
    SELECT id::text AS id
    FROM crewcast.search_credit_reservations
    WHERE user_id = ${foundation.accountId}
    ORDER BY id
    LIMIT 1
  `;
  assert.equal(reservation.length, 1);
  await assert.rejects(
    fixtureSql`
      UPDATE crewcast.search_credit_reservations
      SET settings_snapshot = jsonb_build_object('tampered', true)
      WHERE id = ${reservation[0].id}::bigint
    `,
    /provenance is immutable/i,
  );
  const job = await fixtureSql<{ id: number }[]>`
    SELECT id
    FROM crewcast.search_jobs
    WHERE user_id = ${foundation.accountId}
    ORDER BY id
    LIMIT 1
  `;
  assert.equal(job.length, 1);
  await assert.rejects(
    fixtureSql`
      UPDATE crewcast.search_jobs
      SET request_id = ${randomUUID()}::uuid
      WHERE id = ${job[0].id}
    `,
    /request_id cannot be changed/i,
  );
}

async function cleanup(foundation: Foundation): Promise<void> {
  await fixtureSql.begin(async (transaction) => {
    await transaction`DELETE FROM crewcast.api_calls WHERE user_id = ${foundation.accountId}`;
    await transaction`DELETE FROM crewcast.credit_transactions WHERE user_id = ${foundation.accountId}`;
    await transaction`DELETE FROM crewcast.search_job_results WHERE user_id = ${foundation.accountId}`;
    await transaction`DELETE FROM crewcast.discovered_affiliates WHERE user_id = ${foundation.accountId}`;
    await transaction`DELETE FROM crewcast.search_credit_reservations WHERE user_id = ${foundation.accountId}`;
    await transaction`DELETE FROM crewcast.search_jobs WHERE user_id = ${foundation.accountId}`;
    await transaction`DELETE FROM crewcast.user_credits WHERE user_id = ${foundation.accountId}`;
    await transaction`DELETE FROM crewcast.brand_locations WHERE user_id = ${foundation.accountId}`;
    await transaction`DELETE FROM crewcast.brands WHERE user_id = ${foundation.accountId}`;
    await transaction`
      DELETE FROM crewcast.users
      WHERE id = ${foundation.accountId}
        AND email = ${foundation.email}
    `;
  });
}

async function main(): Promise<void> {
  const leftovers = await fixtureSql<{ count: number }[]>`
    SELECT count(*)::integer AS count
    FROM crewcast.users
    WHERE email LIKE ${syntheticEmailPattern}
  `;
  assert.equal(leftovers[0].count, 0, 'A prior synthetic credit fixture must not remain.');
  const foundation = await createFoundation(randomUUID().replaceAll('-', ''));
  try {
    await verifyConcurrentReservation(foundation);
    await verifyTopupRestoration(foundation);
    await verifyFinalizationLifecycle(foundation);
    await verifyImmutability(foundation);
  } finally {
    try {
      await cleanup(foundation);
    } finally {
      try {
        await closeApplicationSql();
      } finally {
        await fixtureSql.end({ timeout: 10 });
      }
    }
  }

  const verificationSql = postgres(databaseUrl, { max: 1, prepare: false });
  try {
    const after = await verificationSql<{ count: number }[]>`
      SELECT count(*)::integer AS count
      FROM crewcast.users
      WHERE email LIKE ${syntheticEmailPattern}
    `;
    assert.equal(after[0].count, 0, 'Synthetic credit fixture cleanup must be complete.');
  } finally {
    await verificationSql.end({ timeout: 5 });
  }
  console.log('Search-credit staging verification passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
