import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { config as loadEnvironment } from 'dotenv';
import postgres from 'postgres';
import { buildEnrichmentDispatchInputs } from '../src/lib/search/enrichment-dispatch';
import { scopedSearchProviderCorrelationId } from '../src/lib/search/provider-input';
import {
  markSearchLaunchAttempted,
  markSearchUncertain,
  promoteStaleSearchLaunches,
  reserveSearchCredit,
} from '../src/lib/search/credit-reservations-postgres';
import type { SearchStartSqlExecutor } from '../src/lib/search/start-postgres';
import type {
  ReconciliationAction,
  ResolveReconciliationInput,
} from '../src/lib/search/reconciliation';

type ResolveSearchReconciliationCase = typeof import(
  '../src/lib/search/reconciliation-postgres'
)['resolveSearchReconciliationCase'];

let resolveSearchReconciliationCase: ResolveSearchReconciliationCase;

const stagingProjectRef = 'jxerxreqezhdsisdwddw';
const rollbackMarker = 'EXPECTED_SEARCH_RECONCILIATION_TEST_ROLLBACK';

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
  if (candidates.size !== 1) throw new Error('Could not prove one Supabase project reference.');
  return [...candidates][0];
}

assert.equal(
  extractProjectRef(databaseUrl),
  stagingProjectRef,
  'Refusing to test against anything except Terminal-Backup.',
);

const sql = postgres(databaseUrl, {
  max: 8,
  prepare: false,
  connect_timeout: 10,
  idle_timeout: 5,
});

type SqlClient = postgres.Sql;

interface Foundation {
  accountId: number;
  email: string;
  brandId: string;
  locationId: string;
}

interface Counts {
  users: number;
  jobs: number;
  dispatches: number;
  entitlements: number;
  operators: number;
  cases: number;
  events: number;
}

async function counts(executor: SqlClient): Promise<Counts> {
  const rows = await executor<Counts[]>`
    SELECT
      (SELECT count(*) FROM crewcast.users)::integer AS users,
      (SELECT count(*) FROM crewcast.search_jobs)::integer AS jobs,
      (SELECT count(*) FROM crewcast.search_enrichment_dispatches)::integer AS dispatches,
      (SELECT count(*) FROM crewcast.onboarding_search_entitlements)::integer AS entitlements,
      (SELECT count(*) FROM crewcast.search_reconciliation_operators)::integer AS operators,
      (SELECT count(*) FROM crewcast.search_reconciliation_cases)::integer AS cases,
      (SELECT count(*) FROM crewcast.search_reconciliation_case_events)::integer AS events
  `;
  return rows[0];
}

async function createFoundation(
  executor: SqlClient,
  label: string,
): Promise<Foundation> {
  const token = randomUUID().replaceAll('-', '');
  const email = `codex-reconciliation-${label}-${token}@example.invalid`;
  const users = await executor<{ id: number }[]>`
    INSERT INTO crewcast.users (
      email, name, is_onboarded, onboarding_step, has_subscription, plan
    ) VALUES (${email}, 'Reconciliation verification', true, 8, false, 'free_trial')
    RETURNING id
  `;
  const accountId = users[0].id;
  const brands = await executor<{ id: string }[]>`
    INSERT INTO crewcast.brands (user_id, name, normalized_domain, is_default)
    VALUES (${accountId}, 'Reconciliation verification', ${`reconciliation-${token}.example`}, true)
    RETURNING id::text AS id
  `;
  const locations = await executor<{ id: string }[]>`
    INSERT INTO crewcast.brand_locations (
      user_id, brand_id, country_code, language_code, topics, competitors, is_default
    ) VALUES (
      ${accountId}, ${brands[0].id}::bigint, 'gb', 'en',
      ARRAY['affiliate software'], ARRAY['competitor.example'], true
    )
    RETURNING id::text AS id
  `;
  return {
    accountId,
    email,
    brandId: brands[0].id,
    locationId: locations[0].id,
  };
}

function snapshot(foundation: Foundation, requestId: string, onboarding = false) {
  return {
    version: 1,
    brand: {
      id: foundation.brandId,
      name: 'Reconciliation verification',
      normalizedDomain: 'reconciliation.example',
    },
    location: {
      id: foundation.locationId,
      countryCode: 'gb',
      countryName: 'United Kingdom',
      languageCode: 'en',
      languageName: 'English',
    },
    search: {
      keywords: ['affiliate software'],
      competitors: ['competitor.example'],
      sources: ['Web', 'YouTube', 'Instagram', 'TikTok'],
      requestId,
      providerCorrelationId: scopedSearchProviderCorrelationId({
        accountId: foundation.accountId,
        brandId: foundation.brandId,
        brandLocationId: foundation.locationId,
        requestId,
      }),
      ...(onboarding ? { isOnboarding: true } : {}),
    },
  };
}

async function createJob(
  executor: SqlClient,
  foundation: Foundation,
  label: string,
): Promise<{ jobId: number; requestId: string }> {
  const requestId = randomUUID();
  const rows = await executor<{ id: number }[]>`
    INSERT INTO crewcast.search_jobs (
      user_id, keyword, sources, apify_run_id, status, enrichment_status,
      enrichment_run_ids, raw_results, user_settings, brand_id,
      brand_location_id, settings_snapshot, request_id
    ) VALUES (
      ${foundation.accountId}, ${label},
      ARRAY['Web', 'YouTube', 'Instagram', 'TikTok']::text[],
      ${`synthetic-google-${label}-${randomUUID()}`}, 'enriching', 'dispatching',
      '{}'::jsonb, '[{"link":"https://example.com","source":"Web"}]'::jsonb,
      ${executor.json({
        targetCountry: 'United Kingdom',
        targetLanguage: 'English',
        userBrand: 'reconciliation.example',
        topics: ['affiliate software'],
        competitors: ['competitor.example'],
      })},
      ${foundation.brandId}::bigint, ${foundation.locationId}::bigint,
      ${executor.json(snapshot(foundation, requestId))}, ${requestId}::uuid
    )
    RETURNING id
  `;
  return { jobId: rows[0].id, requestId };
}

async function createBlockedDispatch(
  executor: SqlClient,
  foundation: Foundation,
  jobId: number,
  status: 'uncertain' | 'dispatching' = 'uncertain',
): Promise<{ caseId: string; dispatchId: string }> {
  const input = buildEnrichmentDispatchInputs({
    youtube: ['https://www.youtube.com/watch?v=reconciliation'],
    instagram: [],
    tiktok: [],
    similarweb: [],
  })[0];
  const dispatches = await executor<{ id: string }[]>`
    INSERT INTO crewcast.search_enrichment_dispatches (
      user_id, search_job_id, brand_id, brand_location_id, platform,
      input_urls, input_fingerprint, status, claim_token, claimed_at,
      launch_attempted_at, error_message
    ) VALUES (
      ${foundation.accountId}, ${jobId}, ${foundation.brandId}::bigint,
      ${foundation.locationId}::bigint, ${input.platform},
      ${executor.json(input.urls)}, ${input.inputFingerprint}, ${status},
      ${randomUUID()}::uuid, NOW() - INTERVAL '10 minutes',
      NOW() - INTERVAL '10 minutes',
      ${status === 'uncertain' ? 'Synthetic ambiguous launch' : null}
    )
    RETURNING id::text AS id
  `;
  if (status === 'dispatching') {
    await executor`
      UPDATE crewcast.search_jobs
      SET enrichment_status = 'dispatch_blocked'
      WHERE id = ${jobId}
    `;
  } else {
    await executor`
      UPDATE crewcast.search_jobs
      SET enrichment_status = 'dispatch_blocked'
      WHERE id = ${jobId}
    `;
  }
  const cases = await executor<{ id: string }[]>`
    SELECT id::text AS id
    FROM crewcast.search_reconciliation_cases
    WHERE enrichment_dispatch_id = ${dispatches[0].id}::bigint
  `;
  assert.equal(cases.length, 1, 'The database trigger must create one alert case.');
  return { caseId: cases[0].id, dispatchId: dispatches[0].id };
}

function resolution(
  action: ReconciliationAction,
  providerRunId?: string,
): ResolveReconciliationInput {
  const confirmations: Record<ReconciliationAction, string> = {
    attach_provider_run: 'ATTACH VERIFIED RUN',
    confirm_no_run: 'CONFIRM NO RUN',
    cancel_and_refund: 'CANCEL AND REFUND',
  };
  return {
    action,
    expectedVersion: 1,
    note: `Synthetic staging verification for ${action}.`,
    confirmation: confirmations[action],
    ...(providerRunId ? { providerRunId } : {}),
  };
}

async function verifyAttach(
  executor: SqlClient,
  foundation: Foundation,
  operator: { authUserId: string; email: string; displayName: string },
): Promise<void> {
  const { jobId } = await createJob(executor, foundation, 'attach');
  const { caseId, dispatchId } = await createBlockedDispatch(executor, foundation, jobId);
  const runId = `synthetic-enrichment-${randomUUID()}`;
  const resolved = await resolveSearchReconciliationCase(
    caseId,
    resolution('attach_provider_run', runId),
    operator,
    { id: runId, actorId: 'verified', status: 'RUNNING', startedAt: new Date().toISOString() },
    executor,
  );
  assert.equal(resolved.status, 'resolved');
  assert.equal(resolved.providerRunId, runId);
  const rows = await executor<{
    dispatch_status: string;
    job_status: string;
    run_id: string;
    event_count: number;
  }[]>`
    SELECT
      dispatches.status AS dispatch_status,
      jobs.enrichment_status AS job_status,
      dispatches.provider_run_id AS run_id,
      (
        SELECT count(*)::integer
        FROM crewcast.search_reconciliation_case_events
        WHERE case_id = ${caseId}::bigint
      ) AS event_count
    FROM crewcast.search_enrichment_dispatches AS dispatches
    JOIN crewcast.search_jobs AS jobs ON jobs.id = dispatches.search_job_id
    WHERE dispatches.id = ${dispatchId}::bigint
  `;
  assert.deepEqual(rows[0], {
    dispatch_status: 'running',
    job_status: 'running',
    run_id: runId,
    event_count: 2,
  });
  const savepoint = executor as unknown as {
    savepoint<T>(operation: (transaction: SqlClient) => Promise<T>): Promise<T>;
  };
  await assert.rejects(
    savepoint.savepoint((transaction) => transaction`
      UPDATE crewcast.search_reconciliation_cases
      SET resolution_note = 'tamper attempt'
      WHERE id = ${caseId}::bigint
    `),
    /resolved search-reconciliation case is immutable/i,
  );
  await assert.rejects(
    savepoint.savepoint((transaction) => transaction`
      UPDATE crewcast.search_reconciliation_case_events
      SET event_payload = '{}'::jsonb
      WHERE case_id = ${caseId}::bigint
    `),
    /append-only/i,
  );
}

async function verifyConfirmNoRun(
  executor: SqlClient,
  foundation: Foundation,
  operator: { authUserId: string; email: string; displayName: string },
): Promise<void> {
  const { jobId } = await createJob(executor, foundation, 'confirm-no-run');
  const { caseId, dispatchId } = await createBlockedDispatch(
    executor,
    foundation,
    jobId,
    'dispatching',
  );
  await resolveSearchReconciliationCase(
    caseId,
    resolution('confirm_no_run'),
    operator,
    null,
    executor,
  );
  const rows = await executor<{ dispatch_status: string; job_status: string }[]>`
    SELECT dispatches.status AS dispatch_status, jobs.enrichment_status AS job_status
    FROM crewcast.search_enrichment_dispatches AS dispatches
    JOIN crewcast.search_jobs AS jobs ON jobs.id = dispatches.search_job_id
    WHERE dispatches.id = ${dispatchId}::bigint
  `;
  assert.deepEqual(rows[0], { dispatch_status: 'failed', job_status: 'running' });
}

async function verifyCancelAndRefund(
  executor: SqlClient,
  foundation: Foundation,
  operator: { authUserId: string; email: string; displayName: string },
): Promise<void> {
  await executor`
    INSERT INTO crewcast.user_credits (
      user_id, topic_search_credits_total, topic_search_credits_used,
      topic_search_credits_topup, period_start, period_end, is_trial_period
    ) VALUES (${foundation.accountId}, 1, 1, 0, NOW(), NOW() + INTERVAL '30 days', false)
  `;
  const { jobId, requestId } = await createJob(executor, foundation, 'cancel-refund');
  await executor`
    INSERT INTO crewcast.search_credit_reservations (
      user_id, request_id, brand_id, brand_location_id, search_job_id,
      settings_snapshot, status, credit_period_start,
      subscription_credits_consumed, topup_credits_consumed
    ) VALUES (
      ${foundation.accountId}, ${requestId}::uuid, ${foundation.brandId}::bigint,
      ${foundation.locationId}::bigint, ${jobId},
      ${executor.json(snapshot(foundation, requestId))}, 'reserved',
      (SELECT period_start FROM crewcast.user_credits WHERE user_id = ${foundation.accountId}),
      1, 0
    )
  `;
  const { caseId } = await createBlockedDispatch(executor, foundation, jobId);
  await resolveSearchReconciliationCase(
    caseId,
    resolution('cancel_and_refund'),
    operator,
    null,
    executor,
  );
  const rows = await executor<{
    job_status: string;
    reservation_status: string;
    used: number;
  }[]>`
    SELECT
      jobs.status AS job_status,
      reservations.status AS reservation_status,
      credits.topic_search_credits_used AS used
    FROM crewcast.search_jobs AS jobs
    JOIN crewcast.search_credit_reservations AS reservations
      ON reservations.search_job_id = jobs.id
    JOIN crewcast.user_credits AS credits ON credits.user_id = jobs.user_id
    WHERE jobs.id = ${jobId}
  `;
  assert.deepEqual(rows[0], {
    job_status: 'failed',
    reservation_status: 'released',
    used: 0,
  });
}

async function verifyCancelFailsWithoutRefundProof(
  executor: SqlClient,
  foundation: Foundation,
  operator: { authUserId: string; email: string; displayName: string },
): Promise<void> {
  const { jobId } = await createJob(executor, foundation, 'missing-refund-proof');
  const { caseId, dispatchId } = await createBlockedDispatch(executor, foundation, jobId);
  const savepoint = executor as unknown as {
    savepoint<T>(operation: (transaction: SqlClient) => Promise<T>): Promise<T>;
  };
  await assert.rejects(
    savepoint.savepoint((transaction) => resolveSearchReconciliationCase(
      caseId,
      resolution('cancel_and_refund'),
      operator,
      null,
      transaction,
    )),
    /no reserved topic-search credit|could not be proven and refunded exactly once/i,
  );
  const rows = await executor<{
    case_status: string;
    job_status: string;
    dispatch_status: string;
  }[]>`
    SELECT
      cases.status AS case_status,
      jobs.status AS job_status,
      dispatches.status AS dispatch_status
    FROM crewcast.search_reconciliation_cases AS cases
    JOIN crewcast.search_jobs AS jobs ON jobs.id = cases.search_job_id
    JOIN crewcast.search_enrichment_dispatches AS dispatches
      ON dispatches.id = ${dispatchId}::bigint
    WHERE cases.id = ${caseId}::bigint
  `;
  assert.deepEqual(rows[0], {
    case_status: 'open',
    job_status: 'enriching',
    dispatch_status: 'uncertain',
  });
}

async function verifyAttachRejectsReusedRun(
  executor: SqlClient,
  foundation: Foundation,
  operator: { authUserId: string; email: string; displayName: string },
): Promise<void> {
  const existing = await createJob(executor, foundation, 'existing-provider-attribution');
  const existingRuns = await executor<{ apify_run_id: string }[]>`
    SELECT apify_run_id
    FROM crewcast.search_jobs
    WHERE id = ${existing.jobId}
  `;
  const runId = existingRuns[0].apify_run_id;
  const target = await createJob(executor, foundation, 'reused-provider-attribution');
  const { caseId, dispatchId } = await createBlockedDispatch(
    executor,
    foundation,
    target.jobId,
  );
  const savepoint = executor as unknown as {
    savepoint<T>(operation: (transaction: SqlClient) => Promise<T>): Promise<T>;
  };
  await assert.rejects(
    savepoint.savepoint((transaction) => resolveSearchReconciliationCase(
      caseId,
      resolution('attach_provider_run', runId),
      operator,
      { id: runId, actorId: 'verified', status: 'RUNNING', startedAt: new Date().toISOString() },
      transaction,
    )),
    /already attributed to another search/i,
  );
  const rows = await executor<{
    case_status: string;
    dispatch_status: string;
    provider_run_id: string | null;
  }[]>`
    SELECT
      cases.status AS case_status,
      dispatches.status AS dispatch_status,
      dispatches.provider_run_id
    FROM crewcast.search_reconciliation_cases AS cases
    JOIN crewcast.search_enrichment_dispatches AS dispatches
      ON dispatches.id = ${dispatchId}::bigint
    WHERE cases.id = ${caseId}::bigint
  `;
  assert.deepEqual(rows[0], {
    case_status: 'open',
    dispatch_status: 'uncertain',
    provider_run_id: null,
  });
}

async function createUncertainOnboarding(
  executor: SqlClient,
  foundation: Foundation,
): Promise<{ caseId: string; requestId: string }> {
  const requestId = randomUUID();
  await executor`
    INSERT INTO crewcast.onboarding_search_entitlements (
      user_id, brand_id, brand_location_id, request_id, settings_snapshot,
      status, claimed_at, launch_attempted_at, uncertain_at, error_message
    ) VALUES (
      ${foundation.accountId}, ${foundation.brandId}::bigint,
      ${foundation.locationId}::bigint, ${requestId}::uuid,
      ${executor.json(snapshot(foundation, requestId, true))}, 'uncertain',
      NOW() - INTERVAL '2 minutes', NOW() - INTERVAL '90 seconds',
      NOW() - INTERVAL '1 minute', 'Synthetic ambiguous onboarding launch'
    )
  `;
  const cases = await executor<{ id: string }[]>`
    SELECT id::text AS id
    FROM crewcast.search_reconciliation_cases
    WHERE user_id = ${foundation.accountId}
      AND source_request_id = ${requestId}::uuid
  `;
  assert.equal(cases.length, 1);
  return { caseId: cases[0].id, requestId };
}

async function verifyOnboardingOutcomes(
  executor: SqlClient,
  resetFoundation: Foundation,
  attachFoundation: Foundation,
  operator: { authUserId: string; email: string; displayName: string },
): Promise<void> {
  const reset = await createUncertainOnboarding(executor, resetFoundation);
  await resolveSearchReconciliationCase(
    reset.caseId,
    resolution('confirm_no_run'),
    operator,
    null,
    executor,
  );
  const available = await executor<{ status: string; request_id: string | null }[]>`
    SELECT status, request_id::text AS request_id
    FROM crewcast.onboarding_search_entitlements
    WHERE user_id = ${resetFoundation.accountId}
  `;
  assert.deepEqual(available[0], { status: 'available', request_id: null });

  const attached = await createUncertainOnboarding(executor, attachFoundation);
  const runId = `synthetic-onboarding-${randomUUID()}`;
  await resolveSearchReconciliationCase(
    attached.caseId,
    resolution('attach_provider_run', runId),
    operator,
    { id: runId, actorId: 'verified', status: 'SUCCEEDED', startedAt: new Date().toISOString() },
    executor,
  );
  const consumed = await executor<{
    status: string;
    provider_run_id: string;
    search_job_id: number;
    job_run_id: string;
  }[]>`
    SELECT
      entitlements.status,
      entitlements.provider_run_id,
      entitlements.search_job_id,
      jobs.apify_run_id AS job_run_id
    FROM crewcast.onboarding_search_entitlements AS entitlements
    JOIN crewcast.search_jobs AS jobs ON jobs.id = entitlements.search_job_id
    WHERE entitlements.user_id = ${attachFoundation.accountId}
  `;
  assert.equal(consumed[0].status, 'consumed');
  assert.equal(consumed[0].provider_run_id, runId);
  assert.equal(consumed[0].job_run_id, runId);
  assert.ok(consumed[0].search_job_id > 0);
}

async function preparePaidSearchCredit(
  executor: SqlClient,
  foundation: Foundation,
): Promise<void> {
  await executor`
    INSERT INTO crewcast.user_credits (
      user_id, topic_search_credits_total, topic_search_credits_used,
      topic_search_credits_topup, period_start, period_end, is_trial_period
    ) VALUES (${foundation.accountId}, 1, 0, 0, NOW(), NOW() + INTERVAL '30 days', false)
  `;
}

async function createUncertainPaidSearch(
  executor: SqlClient,
  foundation: Foundation,
): Promise<{ caseId: string; requestId: string }> {
  await preparePaidSearchCredit(executor, foundation);
  const requestId = randomUUID();
  const searchExecutor = executor as unknown as SearchStartSqlExecutor;
  const reservation = await reserveSearchCredit(searchExecutor, {
    accountId: foundation.accountId,
    requestId,
    brandId: foundation.brandId,
    brandLocationId: foundation.locationId,
    settingsSnapshot: snapshot(foundation, requestId),
  });
  assert.equal(reservation.outcome, 'reserved');
  await markSearchLaunchAttempted(searchExecutor, foundation.accountId, requestId);
  await markSearchUncertain(
    searchExecutor,
    foundation.accountId,
    requestId,
    'Synthetic ambiguous paid-search launch',
  );
  const cases = await executor<{ id: string }[]>`
    SELECT id::text AS id
    FROM crewcast.search_reconciliation_cases
    WHERE case_type = 'paid_search'
      AND user_id = ${foundation.accountId}
      AND source_request_id = ${requestId}::uuid
  `;
  assert.equal(cases.length, 1, 'The paid-search trigger must create one alert case.');
  return { caseId: cases[0].id, requestId };
}

async function verifyPaidSearchOutcomes(
  executor: SqlClient,
  refundFoundation: Foundation,
  attachFoundation: Foundation,
  staleFoundation: Foundation,
  operator: { authUserId: string; email: string; displayName: string },
): Promise<void> {
  const refunded = await createUncertainPaidSearch(executor, refundFoundation);
  await resolveSearchReconciliationCase(
    refunded.caseId,
    resolution('confirm_no_run'),
    operator,
    null,
    executor,
  );
  const refundRows = await executor<{ status: string; used: number }[]>`
    SELECT reservations.status, credits.topic_search_credits_used AS used
    FROM crewcast.search_credit_reservations AS reservations
    JOIN crewcast.user_credits AS credits ON credits.user_id = reservations.user_id
    WHERE reservations.user_id = ${refundFoundation.accountId}
      AND reservations.request_id = ${refunded.requestId}::uuid
  `;
  assert.deepEqual(refundRows[0], { status: 'released', used: 0 });

  const attached = await createUncertainPaidSearch(executor, attachFoundation);
  const runId = `synthetic-paid-search-${randomUUID()}`;
  await resolveSearchReconciliationCase(
    attached.caseId,
    resolution('attach_provider_run', runId),
    operator,
    { id: runId, actorId: 'verified', status: 'RUNNING', startedAt: new Date().toISOString() },
    executor,
  );
  const attachedRows = await executor<{
    status: string;
    used: number;
    search_job_id: number;
    apify_run_id: string;
  }[]>`
    SELECT
      reservations.status,
      credits.topic_search_credits_used AS used,
      reservations.search_job_id,
      jobs.apify_run_id
    FROM crewcast.search_credit_reservations AS reservations
    JOIN crewcast.user_credits AS credits ON credits.user_id = reservations.user_id
    JOIN crewcast.search_jobs AS jobs ON jobs.id = reservations.search_job_id
    WHERE reservations.user_id = ${attachFoundation.accountId}
      AND reservations.request_id = ${attached.requestId}::uuid
  `;
  assert.equal(attachedRows[0].status, 'reserved');
  assert.equal(attachedRows[0].used, 1);
  assert.ok(attachedRows[0].search_job_id > 0);
  assert.equal(attachedRows[0].apify_run_id, runId);

  await preparePaidSearchCredit(executor, staleFoundation);
  const staleRequestId = randomUUID();
  await executor`
    INSERT INTO crewcast.search_credit_reservations (
      user_id, request_id, brand_id, brand_location_id, settings_snapshot,
      status, credit_period_start, subscription_credits_consumed,
      topup_credits_consumed, launch_attempted_at
    ) VALUES (
      ${staleFoundation.accountId}, ${staleRequestId}::uuid,
      ${staleFoundation.brandId}::bigint, ${staleFoundation.locationId}::bigint,
      ${executor.json(snapshot(staleFoundation, staleRequestId))}, 'reserved',
      (SELECT period_start FROM crewcast.user_credits WHERE user_id = ${staleFoundation.accountId}),
      1, 0, NOW() - INTERVAL '10 minutes'
    )
  `;
  await executor`
    UPDATE crewcast.user_credits
    SET topic_search_credits_used = 1
    WHERE user_id = ${staleFoundation.accountId}
  `;
  const promoted = await promoteStaleSearchLaunches(
    executor as unknown as SearchStartSqlExecutor,
    staleFoundation.accountId,
  );
  assert.equal(promoted, 1);
  const staleRows = await executor<{ status: string; case_count: number }[]>`
    SELECT
      reservations.status,
      (
        SELECT count(*)::integer
        FROM crewcast.search_reconciliation_cases AS cases
        WHERE cases.case_type = 'paid_search'
          AND cases.user_id = reservations.user_id
          AND cases.source_request_id = reservations.request_id
      ) AS case_count
    FROM crewcast.search_credit_reservations AS reservations
    WHERE reservations.user_id = ${staleFoundation.accountId}
      AND reservations.request_id = ${staleRequestId}::uuid
  `;
  assert.deepEqual(staleRows[0], { status: 'uncertain', case_count: 1 });
}

async function verifyClientIsolation(): Promise<void> {
  const rows = await sql<{
    table_name: string;
    relrowsecurity: boolean;
    client_grants: number;
  }[]>`
    SELECT
      class.relname AS table_name,
      class.relrowsecurity,
      (
        SELECT count(*)::integer
        FROM information_schema.role_table_grants AS grants
        WHERE grants.table_schema = 'crewcast'
          AND grants.table_name = class.relname
          AND grants.grantee IN ('PUBLIC', 'anon', 'authenticated', 'service_role')
      ) AS client_grants
    FROM pg_class AS class
    JOIN pg_namespace AS namespace ON namespace.oid = class.relnamespace
    WHERE namespace.nspname = 'crewcast'
      AND class.relname IN (
        'search_reconciliation_operators',
        'search_reconciliation_cases',
        'search_reconciliation_case_events'
      )
    ORDER BY class.relname
  `;
  assert.equal(rows.length, 3);
  assert.ok(rows.every((row) => row.relrowsecurity && row.client_grants === 0));
  await assert.rejects(
    sql.begin(async (transaction) => {
      await transaction`SET LOCAL ROLE authenticated`;
      await transaction`SELECT * FROM crewcast.search_reconciliation_cases LIMIT 1`;
    }),
    /permission denied|row-level security/i,
  );
}

async function cleanupCommittedContentionFixture(
  executor: SqlClient,
  accountId: number | null,
  operatorId: string,
): Promise<void> {
  await executor.begin(async (transactionValue) => {
    const transaction = transactionValue as unknown as SqlClient;
    if (accountId !== null) {
      // Audit rows are immutable in application operation. For this staging-only
      // synthetic fixture, the exact trigger is disabled inside one transaction;
      // a crash or any error rolls the DDL and deletes back together.
      await transaction`
        ALTER TABLE crewcast.search_reconciliation_case_events
        DISABLE TRIGGER search_reconciliation_events_immutable
      `;
      await transaction`
        DELETE FROM crewcast.search_reconciliation_case_events AS events
        USING crewcast.search_reconciliation_cases AS cases
        WHERE events.case_id = cases.id
          AND cases.user_id = ${accountId}
      `;
      await transaction`
        ALTER TABLE crewcast.search_reconciliation_case_events
        ENABLE TRIGGER search_reconciliation_events_immutable
      `;
      await transaction`
        DELETE FROM crewcast.search_reconciliation_cases
        WHERE user_id = ${accountId}
      `;
      await transaction`
        DELETE FROM crewcast.search_credit_reservations WHERE user_id = ${accountId}
      `;
      await transaction`
        DELETE FROM crewcast.onboarding_search_entitlements WHERE user_id = ${accountId}
      `;
      await transaction`DELETE FROM crewcast.search_jobs WHERE user_id = ${accountId}`;
      await transaction`DELETE FROM crewcast.user_credits WHERE user_id = ${accountId}`;
      await transaction`DELETE FROM crewcast.brand_locations WHERE user_id = ${accountId}`;
      await transaction`DELETE FROM crewcast.brands WHERE user_id = ${accountId}`;
      await transaction`DELETE FROM crewcast.users WHERE id = ${accountId}`;
    }
    await transaction`
      DELETE FROM crewcast.search_reconciliation_operators
      WHERE auth_user_id = ${operatorId}::uuid
    `;
  });
}

async function verifyResolutionContention(executor: SqlClient): Promise<void> {
  const operator = {
    authUserId: randomUUID(),
    email: 'codex-reconciliation-contention@example.invalid',
    displayName: 'Synthetic contention operator',
  };
  let accountId: number | null = null;
  try {
    const fixture = await createFoundation(executor, 'contention');
    accountId = fixture.accountId;
    await executor`
      INSERT INTO crewcast.search_reconciliation_operators (
        auth_user_id, email, display_name
      ) VALUES (${operator.authUserId}::uuid, ${operator.email}, ${operator.displayName})
    `;
    const { jobId } = await createJob(executor, fixture, 'contention');
    const { caseId } = await createBlockedDispatch(executor, fixture, jobId);
    const outcomes = await Promise.allSettled(
      Array.from({ length: 100 }, () => resolveSearchReconciliationCase(
        caseId,
        resolution('confirm_no_run'),
        operator,
        null,
        executor,
      )),
    );
    assert.equal(
      outcomes.filter((outcome) => outcome.status === 'fulfilled').length,
      1,
      'Exactly one of 100 concurrent resolutions must win.',
    );
    assert.equal(
      outcomes.filter((outcome) => outcome.status === 'rejected').length,
      99,
      'Every losing resolution must fail closed.',
    );
    const state = await executor<{
      case_status: string;
      lock_version: number;
      event_count: number;
      dispatch_status: string;
    }[]>`
      SELECT
        cases.status AS case_status,
        cases.lock_version,
        (
          SELECT count(*)::integer
          FROM crewcast.search_reconciliation_case_events
          WHERE case_id = cases.id
        ) AS event_count,
        dispatches.status AS dispatch_status
      FROM crewcast.search_reconciliation_cases AS cases
      JOIN crewcast.search_enrichment_dispatches AS dispatches
        ON dispatches.id = cases.enrichment_dispatch_id
      WHERE cases.id = ${caseId}::bigint
    `;
    assert.deepEqual(state[0], {
      case_status: 'resolved',
      lock_version: 2,
      event_count: 2,
      dispatch_status: 'failed',
    });
  } finally {
    await cleanupCommittedContentionFixture(executor, accountId, operator.authUserId);
  }

  const trigger = await executor<{ tgenabled: string }[]>`
    SELECT tgenabled
    FROM pg_trigger
    WHERE tgrelid = 'crewcast.search_reconciliation_case_events'::regclass
      AND tgname = 'search_reconciliation_events_immutable'
  `;
  assert.equal(trigger.length, 1);
  assert.equal(trigger[0].tgenabled, 'O');
}

async function main(): Promise<void> {
  ({ resolveSearchReconciliationCase } = await import(
    '../src/lib/search/reconciliation-postgres'
  ));
  const before = await counts(sql);
  await verifyClientIsolation();
  try {
    await sql.begin(async (transactionValue) => {
      const transaction = transactionValue as unknown as SqlClient;
      const operator = {
        authUserId: randomUUID(),
        email: 'codex-reconciliation-operator@example.invalid',
        displayName: 'Synthetic reconciliation operator',
      };
      await transaction`
        INSERT INTO crewcast.search_reconciliation_operators (
          auth_user_id, email, display_name
        ) VALUES (
          ${operator.authUserId}::uuid, ${operator.email}, ${operator.displayName}
        )
      `;
      const attach = await createFoundation(transaction, 'attach');
      const noRun = await createFoundation(transaction, 'no-run');
      const cancel = await createFoundation(transaction, 'cancel');
      const missingRefund = await createFoundation(transaction, 'missing-refund');
      const reusedRun = await createFoundation(transaction, 'reused-run');
      const onboardingReset = await createFoundation(transaction, 'onboarding-reset');
      const onboardingAttach = await createFoundation(transaction, 'onboarding-attach');
      const paidRefund = await createFoundation(transaction, 'paid-refund');
      const paidAttach = await createFoundation(transaction, 'paid-attach');
      const paidStale = await createFoundation(transaction, 'paid-stale');

      await verifyAttach(transaction, attach, operator);
      await verifyConfirmNoRun(transaction, noRun, operator);
      await verifyCancelAndRefund(transaction, cancel, operator);
      await verifyCancelFailsWithoutRefundProof(transaction, missingRefund, operator);
      await verifyAttachRejectsReusedRun(transaction, reusedRun, operator);
      await verifyOnboardingOutcomes(
        transaction,
        onboardingReset,
        onboardingAttach,
        operator,
      );
      await verifyPaidSearchOutcomes(
        transaction,
        paidRefund,
        paidAttach,
        paidStale,
        operator,
      );
      throw new Error(rollbackMarker);
    });
  } catch (error) {
    if (!(error instanceof Error) || error.message !== rollbackMarker) throw error;
  }

  try {
    await verifyResolutionContention(sql);
  } finally {
    await sql.end({ timeout: 10 });
  }

  const verificationSql = postgres(databaseUrl, { max: 1, prepare: false });
  try {
    assert.deepEqual(await counts(verificationSql), before);
  } finally {
    await verificationSql.end({ timeout: 5 });
  }
  console.log(
    'Search-reconciliation staging verification passed: automatic alert creation, exact attach, cross-search run-reuse rejection, no-run recovery, exact cancel/refund, missing-refund-proof rejection, onboarding reset/attach, paid-search hold/refund/attach/stale recovery, 100-way resolution contention, audit immutability, RLS/no-client-grants, exact global counts restored, residue 0. No provider was called.',
  );
}

main().catch((error) => {
  console.error('Search-reconciliation staging verification failed:', error);
  process.exitCode = 1;
});
