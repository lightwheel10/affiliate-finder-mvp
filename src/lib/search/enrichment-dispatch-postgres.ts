import { randomUUID } from 'node:crypto';
import type postgres from 'postgres';
import {
  ENRICHMENT_PLATFORMS,
  type ClaimedEnrichmentDispatch,
  type ClaimEnrichmentDispatchResult,
  type EnrichmentDispatchContext,
  type EnrichmentDispatchInput,
  type EnrichmentDispatchSetupResult,
  type EnrichmentPlatform,
} from '@/lib/search/enrichment-dispatch';

type SqlClient = postgres.Sql;

interface DispatchRow {
  id: unknown;
  platform: unknown;
  input_urls: unknown;
  input_fingerprint: unknown;
  status: unknown;
  claim_token?: unknown;
  provider_run_id?: unknown;
  launch_is_stale?: unknown;
}

export type InitializeEnrichmentDispatchResult =
  | { outcome: 'initialized' | 'existing' }
  | { outcome: 'inactive_location' | 'missing_job' };

function readBigint(value: unknown, field: string): string {
  const normalized = typeof value === 'number' ? String(value) : value;
  if (typeof normalized !== 'string' || !/^[1-9][0-9]*$/.test(normalized)) {
    throw new Error(`${field} is not a positive PostgreSQL bigint.`);
  }
  return normalized;
}

function readPlatform(value: unknown): EnrichmentPlatform {
  if (
    typeof value !== 'string'
    || !ENRICHMENT_PLATFORMS.includes(value as EnrichmentPlatform)
  ) {
    throw new Error('Enrichment dispatch platform is invalid.');
  }
  return value as EnrichmentPlatform;
}

function readUrls(value: unknown): string[] {
  let parsed = value;
  if (typeof parsed === 'string') parsed = JSON.parse(parsed) as unknown;
  if (
    !Array.isArray(parsed)
    || parsed.length === 0
    || parsed.some((item) => typeof item !== 'string' || item.length === 0)
  ) {
    throw new Error('Enrichment dispatch URL payload is invalid.');
  }
  return [...parsed] as string[];
}

function readFingerprint(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) {
    throw new Error('Enrichment dispatch fingerprint is invalid.');
  }
  return value;
}

function readClaimToken(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f-]{36}$/.test(value)) {
    throw new Error('Enrichment dispatch claim token is invalid.');
  }
  return value;
}

function readRunId(value: unknown): string {
  if (
    typeof value !== 'string'
    || value.trim() === ''
    || value.length > 255
    || /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new Error('Enrichment provider run ID is invalid.');
  }
  return value;
}

function normalizeJson(value: unknown, field: string): postgres.JSONValue {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new Error(`${field} is not JSON serializable.`);
  }
  return JSON.parse(serialized) as postgres.JSONValue;
}

function mapClaimed(row: DispatchRow): ClaimedEnrichmentDispatch {
  return {
    id: readBigint(row.id, 'search_enrichment_dispatches.id'),
    platform: readPlatform(row.platform),
    urls: readUrls(row.input_urls),
    inputFingerprint: readFingerprint(row.input_fingerprint),
    claimToken: readClaimToken(row.claim_token),
  };
}

export async function initializeEnrichmentDispatches(
  sql: SqlClient,
  context: EnrichmentDispatchContext,
  inputs: readonly EnrichmentDispatchInput[],
  rawResults: unknown,
): Promise<InitializeEnrichmentDispatchResult> {
  if (inputs.length === 0) {
    throw new Error('Cannot initialize enrichment dispatch without platform inputs.');
  }
  const expectedByPlatform = new Map(inputs.map((input) => [input.platform, input]));
  if (expectedByPlatform.size !== inputs.length) {
    throw new Error('Enrichment dispatch inputs contain duplicate platforms.');
  }

  return sql.begin(async (transactionValue) => {
    const transaction = transactionValue as unknown as SqlClient;
    const jobs = await transaction<{
      status: string;
      enrichment_status: string | null;
      brand_archived_at: Date | null;
      location_archived_at: Date | null;
    }[]>`
      SELECT
        jobs.status,
        jobs.enrichment_status,
        brands.archived_at AS brand_archived_at,
        locations.archived_at AS location_archived_at
      FROM crewcast.search_jobs AS jobs
      JOIN crewcast.brands AS brands
        ON brands.id = jobs.brand_id
       AND brands.user_id = jobs.user_id
      JOIN crewcast.brand_locations AS locations
        ON locations.id = jobs.brand_location_id
       AND locations.brand_id = jobs.brand_id
       AND locations.user_id = jobs.user_id
      WHERE jobs.id = ${context.jobId}
        AND jobs.user_id = ${context.accountId}
        AND jobs.brand_id = ${context.brandId}::bigint
        AND jobs.brand_location_id = ${context.brandLocationId}::bigint
      LIMIT 2
      FOR UPDATE OF jobs
    `;
    if (jobs.length === 0) return { outcome: 'missing_job' };
    if (jobs.length !== 1) throw new Error('Enrichment dispatch matched multiple jobs.');
    if (jobs[0].brand_archived_at !== null || jobs[0].location_archived_at !== null) {
      return { outcome: 'inactive_location' };
    }

    const existing = await transaction<DispatchRow[]>`
      SELECT id, platform, input_urls, input_fingerprint, status
      FROM crewcast.search_enrichment_dispatches
      WHERE user_id = ${context.accountId}
        AND search_job_id = ${context.jobId}
      ORDER BY platform
      FOR UPDATE
    `;
    if (existing.length > 0) {
      if (existing.length !== expectedByPlatform.size) {
        throw new Error('Existing enrichment dispatch platform count conflicts with the retry.');
      }
      for (const row of existing) {
        const platform = readPlatform(row.platform);
        const expected = expectedByPlatform.get(platform);
        if (
          !expected
          || readFingerprint(row.input_fingerprint) !== expected.inputFingerprint
          || JSON.stringify(readUrls(row.input_urls)) !== JSON.stringify(expected.urls)
        ) {
          throw new Error('Existing enrichment dispatch input conflicts with the retry.');
        }
      }
      return { outcome: 'existing' };
    }

    if (jobs[0].status !== 'processing') {
      throw new Error('A new enrichment dispatch can only be initialized from processing state.');
    }

    for (const input of inputs) {
      await transaction`
        INSERT INTO crewcast.search_enrichment_dispatches (
          user_id,
          search_job_id,
          brand_id,
          brand_location_id,
          platform,
          input_urls,
          input_fingerprint
        )
        VALUES (
          ${context.accountId},
          ${context.jobId},
          ${context.brandId}::bigint,
          ${context.brandLocationId}::bigint,
          ${input.platform},
          ${transaction.json(input.urls)},
          ${input.inputFingerprint}
        )
      `;
    }

    const updated = await transaction<{ id: number }[]>`
      UPDATE crewcast.search_jobs
      SET
        status = 'enriching',
        enrichment_status = 'dispatching',
        enrichment_run_ids = '{}'::jsonb,
        raw_results = ${transaction.json(normalizeJson(rawResults, 'raw_results'))}
      WHERE id = ${context.jobId}
        AND user_id = ${context.accountId}
        AND brand_id = ${context.brandId}::bigint
        AND brand_location_id = ${context.brandLocationId}::bigint
        AND status = 'processing'
      RETURNING id
    `;
    if (updated.length !== 1) {
      throw new Error('Search job did not enter durable enrichment dispatch state.');
    }
    return { outcome: 'initialized' };
  });
}

export async function claimEnrichmentDispatch(
  sql: SqlClient,
  context: EnrichmentDispatchContext,
  platform: EnrichmentPlatform,
): Promise<ClaimEnrichmentDispatchResult> {
  const claimToken = randomUUID();
  const rows = await sql<DispatchRow[]>`
    UPDATE crewcast.search_enrichment_dispatches
    SET
      status = 'claimed',
      claim_token = ${claimToken}::uuid,
      claimed_at = NOW(),
      updated_at = NOW()
    WHERE user_id = ${context.accountId}
      AND search_job_id = ${context.jobId}
      AND brand_id = ${context.brandId}::bigint
      AND brand_location_id = ${context.brandLocationId}::bigint
      AND platform = ${platform}
      AND (
        status = 'pending'
        OR (
          status = 'claimed'
          AND launch_attempted_at IS NULL
          AND claimed_at < NOW() - INTERVAL '3 minutes'
        )
      )
    RETURNING
      id::text AS id,
      platform,
      input_urls,
      input_fingerprint,
      claim_token::text AS claim_token
  `;
  if (rows.length === 0) return { outcome: 'unavailable' };
  if (rows.length !== 1) throw new Error('Claimed more than one enrichment dispatch.');
  return { outcome: 'claimed', dispatch: mapClaimed(rows[0]) };
}

export async function markEnrichmentLaunchAttempted(
  sql: SqlClient,
  dispatch: ClaimedEnrichmentDispatch,
): Promise<void> {
  const rows = await sql<{ id: string }[]>`
    UPDATE crewcast.search_enrichment_dispatches
    SET
      status = 'dispatching',
      launch_attempted_at = NOW(),
      updated_at = NOW()
    WHERE id = ${dispatch.id}::bigint
      AND platform = ${dispatch.platform}
      AND input_fingerprint = ${dispatch.inputFingerprint}
      AND claim_token = ${dispatch.claimToken}::uuid
      AND status = 'claimed'
      AND launch_attempted_at IS NULL
    RETURNING id::text AS id
  `;
  if (rows.length !== 1) {
    throw new Error('Enrichment dispatch launch intent was not recorded exactly once.');
  }
}

export async function recordEnrichmentRun(
  sql: SqlClient,
  dispatch: ClaimedEnrichmentDispatch,
  runId: string,
): Promise<void> {
  const validatedRunId = readRunId(runId);
  const rows = await sql<{ id: string }[]>`
    UPDATE crewcast.search_enrichment_dispatches
    SET
      status = 'running',
      provider_run_id = ${validatedRunId},
      dispatched_at = NOW(),
      updated_at = NOW()
    WHERE id = ${dispatch.id}::bigint
      AND claim_token = ${dispatch.claimToken}::uuid
      AND status = 'dispatching'
      AND provider_run_id IS NULL
    RETURNING id::text AS id
  `;
  if (rows.length !== 1) {
    throw new Error('Enrichment provider run was not recorded exactly once.');
  }
}

async function markTerminalDispatch(
  sql: SqlClient,
  dispatch: ClaimedEnrichmentDispatch,
  status: 'failed' | 'uncertain',
  message: string,
  runId?: string,
): Promise<void> {
  const validatedRunId = runId === undefined ? null : readRunId(runId);
  const boundedMessage = message.trim().slice(0, 2_000) || 'Enrichment dispatch failed';
  const rows = await sql<{ id: string }[]>`
    UPDATE crewcast.search_enrichment_dispatches
    SET
      status = ${status},
      provider_run_id = ${validatedRunId},
      error_message = ${boundedMessage},
      updated_at = NOW()
    WHERE id = ${dispatch.id}::bigint
      AND claim_token = ${dispatch.claimToken}::uuid
      AND status = 'dispatching'
    RETURNING id::text AS id
  `;
  if (rows.length !== 1) {
    throw new Error(`Enrichment dispatch was not marked ${status} exactly once.`);
  }
}

export function markEnrichmentDispatchFailed(
  sql: SqlClient,
  dispatch: ClaimedEnrichmentDispatch,
  message: string,
  runId?: string,
): Promise<void> {
  return markTerminalDispatch(sql, dispatch, 'failed', message, runId);
}

export function markEnrichmentDispatchUncertain(
  sql: SqlClient,
  dispatch: ClaimedEnrichmentDispatch,
  message: string,
  runId?: string,
): Promise<void> {
  return markTerminalDispatch(sql, dispatch, 'uncertain', message, runId);
}

async function finalizeEnrichmentDispatchSetupTransaction(
  transaction: SqlClient,
  context: EnrichmentDispatchContext,
): Promise<EnrichmentDispatchSetupResult> {
    const jobs = await transaction<{ id: number; enrichment_status: string | null }[]>`
      SELECT id, enrichment_status
      FROM crewcast.search_jobs
      WHERE id = ${context.jobId}
        AND user_id = ${context.accountId}
        AND brand_id = ${context.brandId}::bigint
        AND brand_location_id = ${context.brandLocationId}::bigint
      LIMIT 2
      FOR UPDATE
    `;
    if (jobs.length !== 1) throw new Error('Enrichment setup job is unavailable.');

    const rows = await transaction<DispatchRow[]>`
      SELECT
        id,
        platform,
        input_urls,
        input_fingerprint,
        status,
        provider_run_id,
        (
          status = 'dispatching'
          AND launch_attempted_at < NOW() - INTERVAL '3 minutes'
        ) AS launch_is_stale
      FROM crewcast.search_enrichment_dispatches
      WHERE user_id = ${context.accountId}
        AND search_job_id = ${context.jobId}
      ORDER BY platform
      FOR UPDATE
    `;
    if (rows.length === 0) throw new Error('Enrichment setup has no dispatch rows.');

    const statuses = rows.map((row) => String(row.status));
    const hasStaleLaunch = rows.some((row) => row.launch_is_stale === true);
    if (statuses.includes('uncertain') || hasStaleLaunch) {
      await transaction`
        UPDATE crewcast.search_jobs
        SET enrichment_status = 'dispatch_blocked'
        WHERE id = ${context.jobId}
          AND user_id = ${context.accountId}
          AND enrichment_status IN ('dispatching', 'dispatch_blocked')
      `;
      return { outcome: 'blocked' };
    }
    if (statuses.some((status) =>
      status === 'pending' || status === 'claimed' || status === 'dispatching')) {
      return { outcome: 'in_progress' };
    }
    if (statuses.some((status) => status !== 'running' && status !== 'failed')) {
      throw new Error('Enrichment dispatches contain an unsupported lifecycle state.');
    }

    const runIds: Partial<Record<EnrichmentPlatform, string>> = {};
    for (const row of rows) {
      if (row.status === 'running') {
        runIds[readPlatform(row.platform)] = readRunId(row.provider_run_id);
      }
    }
    const updated = await transaction<{ id: number }[]>`
      UPDATE crewcast.search_jobs
      SET
        status = 'enriching',
        enrichment_status = 'running',
        enrichment_run_ids = ${transaction.json(runIds)}
      WHERE id = ${context.jobId}
        AND user_id = ${context.accountId}
        AND brand_id = ${context.brandId}::bigint
        AND brand_location_id = ${context.brandLocationId}::bigint
        AND status = 'enriching'
        AND enrichment_status IN ('dispatching', 'dispatch_blocked', 'running')
      RETURNING id
    `;
    if (updated.length !== 1) {
      throw new Error('Search job did not enter enrichment polling state.');
    }
    return { outcome: 'ready', runIds };
}

export async function finalizeEnrichmentDispatchSetup(
  sql: SqlClient,
  context: EnrichmentDispatchContext,
): Promise<EnrichmentDispatchSetupResult> {
  return sql.begin(async (transactionValue) => {
    const transaction = transactionValue as unknown as SqlClient;
    return finalizeEnrichmentDispatchSetupTransaction(transaction, context);
  });
}

/** Recomputes the parent job while the reconciliation transaction owns locks. */
export function refreshReconciledEnrichmentSetup(
  transaction: SqlClient,
  context: EnrichmentDispatchContext,
): Promise<EnrichmentDispatchSetupResult> {
  return finalizeEnrichmentDispatchSetupTransaction(transaction, context);
}
