import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { config as loadEnvironment } from 'dotenv';
import postgres from 'postgres';
import {
  claimNextWeeklyScanWork,
  completeWeeklyScanLocation,
  failWeeklyScanLocation,
  prepareWeeklyScanEnrichmentProvider,
  prepareWeeklyScanPrimaryProvider,
  recordWeeklyScanProviderRun,
  settleWeeklyScanProviderRun,
  type WeeklyScanClaimResult,
} from '../src/lib/weekly-scan/weekly-scan-postgres';
import {
  weeklyProviderCorrelationId,
  type WeeklyProviderLaunchInput,
  type WeeklyScanProvider,
} from '../src/lib/weekly-scan/provider-runs';

const STAGING_PROJECT_REF = 'jxerxreqezhdsisdwddw';
const SYNTHETIC_EMAIL_PATTERN = 'codex-weekly-scan-%@example.invalid';

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
  'Refusing to run weekly scan tests outside the isolated staging project.',
);

interface Fixture {
  accountId: number;
  brandCount: number;
  locationIds: string[];
}

interface GlobalState {
  users: number;
  batches: number;
  batchLocations: number;
  providerRuns: number;
  syntheticUsers: number;
}

const fixtureSql = postgres(databaseUrl, {
  // The staging session pool currently allows 15 clients. Ten still creates
  // real overlap while leaving headroom for the dashboard and migration checks.
  max: 10,
  prepare: false,
  connect_timeout: 10,
  idle_timeout: 10,
});

async function globalState(): Promise<GlobalState> {
  const rows = await fixtureSql<GlobalState[]>`
    SELECT
      (SELECT count(*) FROM crewcast.users)::integer AS users,
      (SELECT count(*) FROM crewcast.weekly_auto_scan_batches)::integer AS batches,
      (SELECT count(*) FROM crewcast.weekly_auto_scan_locations)::integer AS "batchLocations",
      (SELECT count(*) FROM crewcast.weekly_auto_scan_provider_runs)::integer AS "providerRuns",
      (
        SELECT count(*)
        FROM crewcast.users
        WHERE email LIKE ${SYNTHETIC_EMAIL_PATTERN}
      )::integer AS "syntheticUsers"
  `;
  assert.equal(rows.length, 1);
  return rows[0];
}

async function assertMigrations(): Promise<void> {
  const batchMigrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/0013_weekly_auto_scan_batches.up.sql',
  );
  const claimMigrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/0021_weekly_scan_single_active_location.up.sql',
  );
  const providerMigrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/0022_weekly_provider_receipts.up.sql',
  );
  const expectedBatchChecksum = createHash('sha256')
    .update(readFileSync(batchMigrationPath))
    .digest('hex');
  const expectedClaimChecksum = createHash('sha256')
    .update(readFileSync(claimMigrationPath))
    .digest('hex');
  const expectedProviderChecksum = createHash('sha256')
    .update(readFileSync(providerMigrationPath))
    .digest('hex');
  const rows = await fixtureSql<{
    version: string;
    checksum: string;
    tables: number;
    triggers: number;
    singleActiveIndexes: number;
    providerReceiptTables: number;
    providerReceiptTriggers: number;
  }[]>`
    SELECT
      migrations.version,
      migrations.checksum_sha256 AS checksum,
      (
        SELECT count(*)
        FROM pg_class
        WHERE oid = ANY(ARRAY[
          'crewcast.weekly_auto_scan_batches'::regclass,
          'crewcast.weekly_auto_scan_locations'::regclass
        ])
      )::integer AS tables,
      (
        SELECT count(*)
        FROM pg_trigger
        WHERE tgrelid = ANY(ARRAY[
          'crewcast.weekly_auto_scan_batches'::regclass,
          'crewcast.weekly_auto_scan_locations'::regclass
        ])
          AND NOT tgisinternal
      )::integer AS triggers,
      (
        SELECT count(*)
        FROM pg_indexes
        WHERE schemaname = 'crewcast'
          AND indexname = 'weekly_auto_scan_locations_one_active_per_batch_key'
      )::integer AS "singleActiveIndexes"
      ,(
        SELECT count(*)
        FROM pg_class
        WHERE oid = 'crewcast.weekly_auto_scan_provider_runs'::regclass
      )::integer AS "providerReceiptTables"
      ,(
        SELECT count(*)
        FROM pg_trigger
        WHERE tgrelid = 'crewcast.weekly_auto_scan_provider_runs'::regclass
          AND NOT tgisinternal
      )::integer AS "providerReceiptTriggers"
    FROM crewcast.schema_migrations AS migrations
    WHERE migrations.version IN ('0013', '0021', '0022')
    ORDER BY migrations.version
  `;
  assert.equal(rows.length, 3, 'Migrations 0013, 0021 and 0022 must each be applied once.');
  assert.equal(rows[0].version, '0013');
  assert.equal(rows[0].checksum, expectedBatchChecksum, 'Migration 0013 checksum drifted.');
  assert.equal(rows[0].tables, 2);
  assert.equal(rows[0].triggers, 4);
  assert.equal(rows[1].version, '0021');
  assert.equal(rows[1].checksum, expectedClaimChecksum, 'Migration 0021 checksum drifted.');
  assert.equal(rows[1].singleActiveIndexes, 1);
  assert.equal(rows[2].version, '0022');
  assert.equal(rows[2].checksum, expectedProviderChecksum, 'Migration 0022 checksum drifted.');
  assert.equal(rows[2].providerReceiptTables, 1);
  assert.equal(rows[2].providerReceiptTriggers, 2);
}

async function assertNoRealWeeklyWorkInProgress(): Promise<void> {
  const rows = await fixtureSql<{ count: number }[]>`
    SELECT count(*)::integer AS count
    FROM crewcast.weekly_auto_scan_batches AS batches
    JOIN crewcast.users AS users ON users.id = batches.user_id
    WHERE batches.status IN ('pending', 'running')
      AND users.email NOT LIKE ${SYNTHETIC_EMAIL_PATTERN}
  `;
  assert.equal(rows.length, 1);
  assert.equal(
    rows[0].count,
    0,
    'Refusing synthetic verification while a real weekly batch is active.',
  );
}

async function createFixture(input: {
  label: string;
  brandCount?: number;
  searchableLocations: number;
  emptyLocations?: number;
  totalCredits: number;
}): Promise<Fixture> {
  const token = randomUUID().replaceAll('-', '');
  const email = `codex-weekly-scan-${input.label}-${token}@example.invalid`;
  return fixtureSql.begin(async (transaction) => {
    const users = await transaction<{ id: number }[]>`
      INSERT INTO crewcast.users (
        email, name, is_onboarded, onboarding_step,
        has_subscription, plan, auto_scan_enabled
      ) VALUES (
        ${email}, 'Weekly scan staging verification', true, 8,
        true, 'business', true
      )
      RETURNING id
    `;
    const accountId = users[0].id;
    await transaction`
      INSERT INTO crewcast.subscriptions (
        user_id, stripe_subscription_id, plan, status, billing_interval,
        first_payment_at, next_auto_scan_at
      ) VALUES (
        ${accountId}, ${`sub_codex_weekly_${accountId}`}, 'business', 'active', 'monthly',
        statement_timestamp() - INTERVAL '30 days',
        statement_timestamp() - INTERVAL '1 minute'
      )
    `;
    await transaction`
      INSERT INTO crewcast.user_credits (
        user_id,
        topic_search_credits_total,
        topic_search_credits_used,
        topic_search_credits_topup,
        email_credits_total,
        email_credits_used,
        email_credits_topup,
        ai_credits_total,
        ai_credits_used,
        ai_credits_topup,
        period_start,
        period_end
      ) VALUES (
        ${accountId},
        ${input.totalCredits}, 0, 0,
        10, 0, 0,
        10, 0, 0,
        statement_timestamp() - INTERVAL '1 day',
        statement_timestamp() + INTERVAL '29 days'
      )
    `;
    const brandCount = input.brandCount ?? 1;
    assert.ok(brandCount > 0, 'A fixture must contain at least one brand.');
    const brandIds: string[] = [];
    for (let index = 0; index < brandCount; index += 1) {
      const brands = await transaction<{ id: string }[]>`
        INSERT INTO crewcast.brands (
          user_id, name, normalized_domain, affiliate_types, is_default
        ) VALUES (
          ${accountId}, ${`Weekly ${input.label} ${index + 1}`},
          ${`weekly-${input.label}-${index + 1}-${token}.example`},
          ARRAY['Web']::text[], ${index === 0}
        )
        RETURNING id::text AS id
      `;
      brandIds.push(brands[0].id);
    }
    const totalLocations = input.searchableLocations + (input.emptyLocations ?? 0);
    const locationIds: string[] = [];
    const brandsWithDefaultLocation = new Set<string>();
    for (let index = 0; index < totalLocations; index += 1) {
      const searchable = index < input.searchableLocations;
      const brandId = brandIds[index % brandIds.length];
      const isDefaultLocation = !brandsWithDefaultLocation.has(brandId);
      const locations = await transaction<{ id: string }[]>`
        INSERT INTO crewcast.brand_locations (
          user_id, brand_id, country_code, language_code,
          topics, competitors, is_default, auto_scan_enabled, next_auto_scan_at
        ) VALUES (
          ${accountId}, ${brandId}::bigint,
          ${index === 0 ? 'gb' : index === 1 ? 'de' : 'fr'},
          ${index === 0 ? 'en' : index === 1 ? 'de' : 'fr'},
          ${searchable ? [`topic-${index}`] : []}::text[],
          ARRAY[]::text[],
          ${isDefaultLocation}, true, statement_timestamp() - INTERVAL '1 minute'
        )
        RETURNING id::text AS id
      `;
      brandsWithDefaultLocation.add(brandId);
      locationIds.push(locations[0].id);
    }
    return { accountId, brandCount, locationIds };
  });
}

function claimed(results: readonly WeeklyScanClaimResult[]) {
  return results.filter(
    (result): result is Extract<WeeklyScanClaimResult, { outcome: 'claimed' }> =>
      result.outcome === 'claimed',
  );
}

function providerLaunch(
  work: { batchId: string; brandLocationId: string },
  provider: WeeklyScanProvider,
): WeeklyProviderLaunchInput {
  return {
    provider,
    inputFingerprint: createHash('sha256')
      .update(`${work.batchId}:${work.brandLocationId}:${provider}`)
      .digest('hex'),
    correlationId: weeklyProviderCorrelationId({
      batchId: work.batchId,
      brandLocationId: work.brandLocationId,
      provider,
    }),
  };
}

async function claimConcurrently(accountId: number, now: Date, count = 20) {
  return Promise.all(Array.from({ length: count }, () => claimNextWeeklyScanWork(
    fixtureSql,
    { now, batchId: randomUUID(), claimToken: randomUUID(), accountId },
  )));
}

async function verifyOneCreditMultiLocationBatch(fixture: Fixture): Promise<void> {
  const now = new Date();
  const firstRace = await claimConcurrently(fixture.accountId, now);
  const firstClaims = claimed(firstRace);
  assert.equal(firstClaims.length, 1, 'Concurrent cron calls must claim one child only.');
  assert.equal(
    firstRace.filter(({ outcome }) => outcome === 'disabled_insufficient').length,
    0,
  );
  const first = firstClaims[0].work;
  assert.equal(first.accountId, fixture.accountId);

  const stateAfterClaim = await fixtureSql<{
    batches: number;
    brands: number;
    children: number;
    claimed: number;
    pending: number;
    skipped: number;
    used: number;
  }[]>`
    SELECT
      (SELECT count(*) FROM crewcast.weekly_auto_scan_batches WHERE user_id = ${fixture.accountId})::integer AS batches,
      (SELECT count(DISTINCT brand_id) FROM crewcast.weekly_auto_scan_locations WHERE user_id = ${fixture.accountId})::integer AS brands,
      (SELECT count(*) FROM crewcast.weekly_auto_scan_locations WHERE user_id = ${fixture.accountId})::integer AS children,
      (SELECT count(*) FROM crewcast.weekly_auto_scan_locations WHERE user_id = ${fixture.accountId} AND status = 'claimed')::integer AS claimed,
      (SELECT count(*) FROM crewcast.weekly_auto_scan_locations WHERE user_id = ${fixture.accountId} AND status = 'pending')::integer AS pending,
      (SELECT count(*) FROM crewcast.weekly_auto_scan_locations WHERE user_id = ${fixture.accountId} AND status = 'skipped')::integer AS skipped,
      (SELECT topic_search_credits_used FROM crewcast.user_credits WHERE user_id = ${fixture.accountId})::integer AS used
  `;
  assert.deepEqual(stateAfterClaim[0], {
    batches: 1,
    brands: fixture.brandCount,
    children: 3,
    claimed: 1,
    pending: 1,
    skipped: 1,
    used: 1,
  });

  const firstGoogle = providerLaunch(first, 'google');
  await prepareWeeklyScanPrimaryProvider(fixtureSql, first, {
    now: new Date(), searchId: 100001, launch: firstGoogle,
  });
  const firstGoogleRun = `run-${randomUUID()}`;
  await recordWeeklyScanProviderRun(fixtureSql, first, firstGoogle, firstGoogleRun);
  await settleWeeklyScanProviderRun(fixtureSql, first, firstGoogle, {
    outcome: 'succeeded', providerRunId: firstGoogleRun, exactCostUsd: 0.101,
  });
  const firstYoutube = providerLaunch(first, 'youtube');
  await prepareWeeklyScanEnrichmentProvider(fixtureSql, first, {
    now: new Date(), launch: firstYoutube,
  });
  const firstYoutubeRun = `run-${randomUUID()}`;
  await recordWeeklyScanProviderRun(fixtureSql, first, firstYoutube, firstYoutubeRun);
  await settleWeeklyScanProviderRun(fixtureSql, first, firstYoutube, {
    outcome: 'succeeded', providerRunId: firstYoutubeRun, exactCostUsd: 0.177,
  });
  const firstCompletion = await completeWeeklyScanLocation(fixtureSql, first, {
    resultsCount: 7,
    sourceCounts: { youtube: 1, instagram: 2, tiktok: 1, web: 3 },
  });
  assert.equal(firstCompletion.batchFinished, false);
  const firstReceipts = await fixtureSql<{
    provider_runs: number;
    exact_cost: number;
    stored_total: number;
  }[]>`
    SELECT
      count(*)::integer AS provider_runs,
      sum(receipts.exact_cost_usd)::float AS exact_cost,
      max(work.estimated_cost)::float AS stored_total
    FROM crewcast.weekly_auto_scan_provider_runs AS receipts
    JOIN crewcast.weekly_auto_scan_locations AS work
      ON work.batch_id = receipts.batch_id
     AND work.brand_location_id = receipts.brand_location_id
    WHERE receipts.batch_id = ${first.batchId}::uuid
      AND receipts.brand_location_id = ${first.brandLocationId}::bigint
  `;
  assert.deepEqual(firstReceipts[0], {
    provider_runs: 2,
    exact_cost: 0.278,
    stored_total: 0.278,
  });

  const secondRace = await claimConcurrently(fixture.accountId, new Date());
  const secondClaims = claimed(secondRace);
  assert.equal(secondClaims.length, 1, 'The second location must also have one worker.');
  const second = secondClaims[0].work;
  assert.equal(second.batchId, first.batchId, 'Every location belongs to the same weekly batch.');
  assert.notEqual(second.brandLocationId, first.brandLocationId);

  const secondGoogle = providerLaunch(second, 'google');
  await prepareWeeklyScanPrimaryProvider(fixtureSql, second, {
    now: new Date(), searchId: 100002, launch: secondGoogle,
  });
  const secondGoogleRun = `run-${randomUUID()}`;
  await recordWeeklyScanProviderRun(fixtureSql, second, secondGoogle, secondGoogleRun);
  await settleWeeklyScanProviderRun(fixtureSql, second, secondGoogle, {
    outcome: 'failed',
    providerRunId: secondGoogleRun,
    exactCostUsd: 0.05,
    errorMessage: 'Synthetic provider terminal failure.',
  });
  const final = await failWeeklyScanLocation(fixtureSql, second, {
    outcome: 'failed',
    code: 'provider_terminal_failure',
    message: 'Synthetic provider terminal failure.',
  });
  assert.equal(final.batchFinished, true);
  assert.equal(final.batchStatus, 'partial');
  assert.equal(final.totalResults, 7);
  assert.deepEqual(final.sourceCounts, { youtube: 1, instagram: 2, tiktok: 1, web: 3 });

  const finalRows = await fixtureSql<{
    status: string;
    credit_status: string;
    used: number;
    active_claims: number;
  }[]>`
    SELECT
      batches.status,
      batches.credit_status,
      credits.topic_search_credits_used::integer AS used,
      (
        SELECT count(*)
        FROM crewcast.brand_locations
        WHERE user_id = ${fixture.accountId} AND scan_claim_token IS NOT NULL
      )::integer AS active_claims
    FROM crewcast.weekly_auto_scan_batches AS batches
    JOIN crewcast.user_credits AS credits ON credits.user_id = batches.user_id
    WHERE batches.id = ${first.batchId}::uuid
  `;
  assert.deepEqual(finalRows[0], {
    status: 'partial',
    credit_status: 'consumed',
    used: 1,
    active_claims: 0,
  });
  await assert.rejects(
    () => completeWeeklyScanLocation(fixtureSql, first, {
      resultsCount: 7,
      sourceCounts: { youtube: 1, instagram: 2, tiktok: 1, web: 3 },
    }),
    /lease is missing|unexpected state/,
  );
}

async function verifyInsufficientCreditSwitchOff(fixture: Fixture): Promise<void> {
  const results = await claimConcurrently(fixture.accountId, new Date());
  assert.equal(
    results.filter(({ outcome }) => outcome === 'disabled_insufficient').length,
    1,
    'Exactly one cron transaction must perform the switch-off.',
  );
  assert.equal(claimed(results).length, 0);
  const rows = await fixtureSql<{
    enabled: boolean;
    batches: number;
    enabled_locations: number;
    scheduled_locations: number;
    used: number;
  }[]>`
    SELECT
      users.auto_scan_enabled AS enabled,
      (SELECT count(*) FROM crewcast.weekly_auto_scan_batches WHERE user_id = ${fixture.accountId})::integer AS batches,
      (SELECT count(*) FROM crewcast.brand_locations WHERE user_id = ${fixture.accountId} AND auto_scan_enabled)::integer AS enabled_locations,
      (SELECT count(*) FROM crewcast.brand_locations WHERE user_id = ${fixture.accountId} AND next_auto_scan_at IS NOT NULL)::integer AS scheduled_locations,
      credits.topic_search_credits_used::integer AS used
    FROM crewcast.users AS users
    JOIN crewcast.user_credits AS credits ON credits.user_id = users.id
    WHERE users.id = ${fixture.accountId}
  `;
  assert.deepEqual(rows[0], {
    enabled: false,
    batches: 0,
    enabled_locations: 0,
    scheduled_locations: 0,
    used: 0,
  });
}

async function verifyNoWorkNoCharge(fixture: Fixture): Promise<void> {
  const results = await claimConcurrently(fixture.accountId, new Date());
  assert.equal(results.filter(({ outcome }) => outcome === 'no_work').length, 1);
  assert.equal(claimed(results).length, 0);
  const rows = await fixtureSql<{
    status: string;
    credit_status: string;
    used: number;
    skipped: number;
  }[]>`
    SELECT
      batches.status,
      batches.credit_status,
      credits.topic_search_credits_used::integer AS used,
      (
        SELECT count(*)
        FROM crewcast.weekly_auto_scan_locations
        WHERE batch_id = batches.id AND status = 'skipped'
      )::integer AS skipped
    FROM crewcast.weekly_auto_scan_batches AS batches
    JOIN crewcast.user_credits AS credits ON credits.user_id = batches.user_id
    WHERE batches.user_id = ${fixture.accountId}
  `;
  assert.deepEqual(rows[0], {
    status: 'no_work',
    credit_status: 'not_required',
    used: 0,
    skipped: 2,
  });
}

async function expireLease(fixture: Fixture, claimToken: string): Promise<void> {
  await fixtureSql.begin(async (transaction) => {
    await transaction`
      UPDATE crewcast.weekly_auto_scan_locations
      SET
        claimed_at = statement_timestamp() - INTERVAL '20 minutes',
        lease_expires_at = statement_timestamp() - INTERVAL '10 minutes'
      WHERE user_id = ${fixture.accountId}
        AND claim_token = ${claimToken}::uuid
    `;
    await transaction`
      UPDATE crewcast.brand_locations
      SET
        scan_claimed_at = statement_timestamp() - INTERVAL '20 minutes',
        scan_lease_expires_at = statement_timestamp() - INTERVAL '10 minutes'
      WHERE user_id = ${fixture.accountId}
        AND scan_claim_token = ${claimToken}::uuid
    `;
  });
}

async function verifyLeaseRecovery(fixture: Fixture): Promise<void> {
  const first = claimed(await claimConcurrently(fixture.accountId, new Date(), 1))[0].work;
  await expireLease(fixture, first.claimToken);
  const second = claimed(await claimConcurrently(fixture.accountId, new Date(), 1))[0].work;
  assert.equal(second.batchId, first.batchId);
  assert.equal(second.brandLocationId, first.brandLocationId);
  assert.notEqual(second.claimToken, first.claimToken);
  const credits = await fixtureSql<{ used: number }[]>`
    SELECT topic_search_credits_used::integer AS used
    FROM crewcast.user_credits
    WHERE user_id = ${fixture.accountId}
  `;
  assert.equal(credits[0].used, 1, 'Safe pre-dispatch retry must not reserve a second credit.');
  await failWeeklyScanLocation(fixtureSql, second, {
    outcome: 'failed',
    code: 'synthetic_before_dispatch_failure',
    message: 'Synthetic pre-dispatch failure.',
  });
  const after = await fixtureSql<{
    used: number;
    credit_status: string;
    same_period: boolean;
    current_period: string;
    reserved_period: string;
  }[]>`
    SELECT
      credits.topic_search_credits_used::integer AS used,
      batches.credit_status,
      credits.period_start = batches.credit_period_start AS same_period,
      credits.period_start::text AS current_period,
      batches.credit_period_start::text AS reserved_period
    FROM crewcast.user_credits AS credits
    JOIN crewcast.weekly_auto_scan_batches AS batches ON batches.user_id = credits.user_id
    WHERE credits.user_id = ${fixture.accountId}
  `;
  assert.equal(after[0].same_period, true, JSON.stringify(after[0]));
  assert.equal(after[0].credit_status, 'released');
  assert.equal(after[0].used, 0, JSON.stringify(after[0]));
}

async function verifyExpiredPostDispatchFailsClosed(fixture: Fixture): Promise<void> {
  const first = claimed(await claimConcurrently(fixture.accountId, new Date(), 1))[0].work;
  const launch = providerLaunch(first, 'google');
  await prepareWeeklyScanPrimaryProvider(fixtureSql, first, {
    now: new Date(), searchId: 100003, launch,
  });
  await expireLease(fixture, first.claimToken);
  const next = await claimConcurrently(fixture.accountId, new Date(), 1);
  assert.equal(claimed(next).length, 0, 'Ambiguous provider work must never be replayed.');
  const rows = await fixtureSql<{
    batch_status: string;
    location_status: string;
    credit_status: string;
    used: number;
  }[]>`
    SELECT
      batches.status AS batch_status,
      work.status AS location_status,
      batches.credit_status,
      credits.topic_search_credits_used::integer AS used
    FROM crewcast.weekly_auto_scan_batches AS batches
    JOIN crewcast.weekly_auto_scan_locations AS work ON work.batch_id = batches.id
    JOIN crewcast.user_credits AS credits ON credits.user_id = batches.user_id
    WHERE batches.user_id = ${fixture.accountId}
  `;
  assert.deepEqual(rows[0], {
    batch_status: 'uncertain',
    location_status: 'uncertain',
    credit_status: 'consumed',
    used: 1,
  });
}

async function cleanup(fixtures: readonly Fixture[]): Promise<void> {
  const accountIds = fixtures.map(({ accountId }) => accountId);
  if (accountIds.length === 0) return;
  await fixtureSql.begin(async (transaction) => {
    // Delete the synthetic child rows explicitly before their referenced
    // locations. The production foreign key intentionally protects location
    // history, so test cleanup must not depend on an indirect cascade being
    // observed before the next statement on pooled staging connections.
    await transaction`
      DELETE FROM crewcast.weekly_auto_scan_locations
      WHERE user_id = ANY(${accountIds}::integer[])
    `;
    await transaction`
      DELETE FROM crewcast.weekly_auto_scan_batches
      WHERE user_id = ANY(${accountIds}::integer[])
    `;
    await transaction`
      DELETE FROM crewcast.brand_locations
      WHERE user_id = ANY(${accountIds}::integer[])
    `;
    await transaction`
      DELETE FROM crewcast.brands
      WHERE user_id = ANY(${accountIds}::integer[])
    `;
    await transaction`
      DELETE FROM crewcast.subscriptions
      WHERE user_id = ANY(${accountIds}::integer[])
    `;
    await transaction`
      DELETE FROM crewcast.users
      WHERE id = ANY(${accountIds}::integer[])
        AND email LIKE ${SYNTHETIC_EMAIL_PATTERN}
    `;
  });
}

async function cleanupSyntheticResidue(): Promise<void> {
  const rows = await fixtureSql<{ id: number }[]>`
    SELECT id
    FROM crewcast.users
    WHERE email LIKE ${SYNTHETIC_EMAIL_PATTERN}
  `;
  if (rows.length === 0) return;
  await cleanup(rows.map(({ id }) => ({ accountId: id, brandCount: 0, locationIds: [] })));
}

async function main(): Promise<void> {
  await assertMigrations();
  // Failed test processes may be interrupted before finally runs. The pattern
  // uses the non-routable example.invalid domain and is exclusive to this file.
  await cleanupSyntheticResidue();
  // This remains a useful operator warning, while every synthetic claim is also
  // hard-scoped to its own fixture account inside the scheduler transaction.
  await assertNoRealWeeklyWorkInProgress();
  const before = await globalState();
  assert.equal(before.syntheticUsers, 0, 'A previous weekly scan test left synthetic users.');
  const fixtures: Fixture[] = [];
  try {
    const multi = await createFixture({
      label: 'multi', brandCount: 2,
      searchableLocations: 2, emptyLocations: 1, totalCredits: 1,
    });
    fixtures.push(multi);
    await verifyOneCreditMultiLocationBatch(multi);

    const insufficient = await createFixture({
      label: 'insufficient', searchableLocations: 2, totalCredits: 0,
    });
    fixtures.push(insufficient);
    await verifyInsufficientCreditSwitchOff(insufficient);

    const noWork = await createFixture({
      label: 'no-work', searchableLocations: 0, emptyLocations: 2, totalCredits: 1,
    });
    fixtures.push(noWork);
    await verifyNoWorkNoCharge(noWork);

    const retry = await createFixture({
      label: 'retry', searchableLocations: 1, totalCredits: 1,
    });
    fixtures.push(retry);
    await verifyLeaseRecovery(retry);

    const uncertain = await createFixture({
      label: 'uncertain', searchableLocations: 1, totalCredits: 1,
    });
    fixtures.push(uncertain);
    await verifyExpiredPostDispatchFailsClosed(uncertain);
  } finally {
    try {
      await cleanup(fixtures);
    } finally {
      await fixtureSql.end({ timeout: 10 });
    }
  }
  const afterSql = postgres(databaseUrl, { max: 1, prepare: false });
  try {
    const after = await (async () => {
      const rows = await afterSql<GlobalState[]>`
        SELECT
          (SELECT count(*) FROM crewcast.users)::integer AS users,
          (SELECT count(*) FROM crewcast.weekly_auto_scan_batches)::integer AS batches,
          (SELECT count(*) FROM crewcast.weekly_auto_scan_locations)::integer AS "batchLocations",
          (SELECT count(*) FROM crewcast.weekly_auto_scan_provider_runs)::integer AS "providerRuns",
          (
            SELECT count(*) FROM crewcast.users
            WHERE email LIKE ${SYNTHETIC_EMAIL_PATTERN}
          )::integer AS "syntheticUsers"
      `;
      return rows[0];
    })();
    assert.deepEqual(after, before, 'Staging global counts changed after synthetic cleanup.');
  } finally {
    await afterSql.end({ timeout: 10 });
  }
  console.log('Weekly auto-scan staging verification passed with exact cleanup.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
