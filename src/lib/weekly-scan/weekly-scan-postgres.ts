import {
  readWeeklyScanSettingsSnapshot,
  resolveWeeklyScanBatch,
  WEEKLY_SCAN_INTERVAL_DAYS,
  WEEKLY_SCAN_LEASE_MINUTES,
  type WeeklyScanLocationStatus,
  type WeeklyScanSourceCounts,
  type WeeklyScanWorkItem,
} from '@/lib/weekly-scan/weekly-scan';
import type { SearchStartSqlExecutor } from '@/lib/search/start-postgres';
import {
  WEEKLY_SCAN_PROVIDERS,
  sumExactWeeklyProviderCosts,
  type WeeklyProviderLaunchInput,
  type WeeklyProviderResumeState,
  type WeeklyProviderSettlement,
  type WeeklyScanProvider,
} from '@/lib/weekly-scan/provider-runs';

export type WeeklyScanClaimResult =
  | { outcome: 'claimed'; work: WeeklyScanWorkItem }
  | { outcome: 'disabled_insufficient'; accountId: number }
  | { outcome: 'no_work'; accountId: number; batchId: string }
  | { outcome: 'idle' };

export interface WeeklyScanCompletion {
  batchFinished: boolean;
  batchStatus: 'completed' | 'partial' | 'failed' | 'uncertain' | null;
  totalResults: number;
  sourceCounts: WeeklyScanSourceCounts;
}

interface DueAccountRow {
  subscription_id: unknown;
  user_id: unknown;
  due_at: unknown;
}

interface ActiveLocationRow {
  id: unknown;
  searchable: unknown;
}

interface CreditRow {
  id: unknown;
  topic_search_credits_total: unknown;
  topic_search_credits_used: unknown;
  topic_search_credits_topup: unknown;
  period_start: unknown;
  period_end: unknown;
}

interface WorkRow {
  batch_id: unknown;
  user_id: unknown;
  brand_id: unknown;
  brand_location_id: unknown;
  due_at: unknown;
  settings_snapshot: unknown;
  status: unknown;
  search_id: unknown;
}

interface ExpiredWorkRow {
  batch_id: unknown;
  user_id: unknown;
  brand_id: unknown;
  brand_location_id: unknown;
  claim_token: unknown;
  status: unknown;
  launch_attempted_at: unknown;
}

interface BatchRow {
  user_id: unknown;
  status: unknown;
  credit_status: unknown;
  credit_period_start: unknown;
  subscription_credits_consumed: unknown;
  topup_credits_consumed: unknown;
  provider_launch_attempted_at: unknown;
}

interface AggregateRow {
  statuses: unknown;
  total_results: unknown;
  youtube: unknown;
  instagram: unknown;
  tiktok: unknown;
  web: unknown;
}

interface ProviderReceiptRow {
  platform: unknown;
  status: unknown;
  provider_run_id: unknown;
  exact_cost_usd: unknown;
  dispatched_at: unknown;
  input_fingerprint: unknown;
  correlation_id: unknown;
}

function withTransaction<T>(
  executor: SearchStartSqlExecutor,
  callback: (transaction: SearchStartSqlExecutor) => Promise<T>,
): Promise<T> {
  if (typeof executor.begin === 'function') return executor.begin(callback);
  if (typeof executor.savepoint === 'function') return executor.savepoint(callback);
  throw new Error('Weekly scan work requires a transaction-capable SQL executor.');
}

function readSafeInteger(value: unknown, field: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`${field} is not a safe integer.`);
  return parsed;
}

function readPositiveInteger(value: unknown, field: string): number {
  const parsed = readSafeInteger(value, field);
  if (parsed <= 0) throw new Error(`${field} is not positive.`);
  return parsed;
}

function readBigint(value: unknown, field: string): string {
  const parsed = typeof value === 'number' ? String(value) : value;
  if (typeof parsed !== 'string' || !/^[1-9][0-9]*$/.test(parsed)) {
    throw new Error(`${field} is not a positive PostgreSQL bigint.`);
  }
  return parsed;
}

function readUuid(value: unknown, field: string): string {
  if (
    typeof value !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw new Error(`${field} is not a UUID.`);
  }
  return value;
}

function readTimestamp(value: unknown, field: string): Date {
  const parsed = value instanceof Date ? value : new Date(String(value));
  if (!Number.isFinite(parsed.getTime())) throw new Error(`${field} is invalid.`);
  return parsed;
}

function readLocationStatus(value: unknown): WeeklyScanLocationStatus {
  if (
    value !== 'pending'
    && value !== 'waiting'
    && value !== 'claimed'
    && value !== 'dispatching'
    && value !== 'running'
    && value !== 'succeeded'
    && value !== 'skipped'
    && value !== 'failed'
    && value !== 'uncertain'
  ) {
    throw new Error('Weekly scan location status is invalid.');
  }
  return value;
}

function readNullablePositiveInteger(value: unknown, field: string): number | null {
  if (value === null || value === undefined) return null;
  return readPositiveInteger(value, field);
}

function readProvider(value: unknown): WeeklyScanProvider {
  if (
    typeof value !== 'string'
    || !WEEKLY_SCAN_PROVIDERS.includes(value as WeeklyScanProvider)
  ) {
    throw new Error('Weekly scan provider is invalid.');
  }
  return value as WeeklyScanProvider;
}

function readProviderReceiptStatus(value: unknown): WeeklyProviderResumeState['status'] {
  if (
    value !== 'dispatching'
    && value !== 'running'
    && value !== 'succeeded'
    && value !== 'failed'
    && value !== 'uncertain'
  ) {
    throw new Error('Weekly scan provider receipt status is invalid.');
  }
  return value;
}

function readNullableProviderCost(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('Weekly scan provider cost is invalid.');
  }
  return Number(parsed.toFixed(6));
}

function validateProviderLaunchInput(input: WeeklyProviderLaunchInput): void {
  readProvider(input.provider);
  if (!/^[0-9a-f]{64}$/.test(input.inputFingerprint)) {
    throw new Error('Weekly provider input fingerprint is invalid.');
  }
  if (
    input.correlationId.length === 0
    || input.correlationId.length > 255
    || /[\u0000-\u001f\u007f]/.test(input.correlationId)
  ) {
    throw new Error('Weekly provider correlation ID is invalid.');
  }
}

function readProviderRunId(value: string): string {
  if (
    value.trim() === ''
    || value.length > 255
    || /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new Error('Weekly scan provider run ID is invalid.');
  }
  return value;
}

function truncateError(message: string): string {
  return message.length <= 2000 ? message : message.slice(0, 2000);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function mapWorkRow(row: WorkRow, claimToken: string): WeeklyScanWorkItem {
  return {
    batchId: readUuid(row.batch_id, 'Weekly scan batch ID'),
    accountId: readPositiveInteger(row.user_id, 'Weekly scan account ID'),
    brandId: readBigint(row.brand_id, 'Weekly scan brand ID'),
    brandLocationId: readBigint(row.brand_location_id, 'Weekly scan location ID'),
    claimToken,
    searchId: readNullablePositiveInteger(row.search_id, 'Weekly scan search ID'),
    dueAt: readTimestamp(row.due_at, 'Weekly scan due time').toISOString(),
    settings: readWeeklyScanSettingsSnapshot(row.settings_snapshot),
  };
}

async function clearLocationClaim(
  transaction: SearchStartSqlExecutor,
  row: Pick<ExpiredWorkRow, 'user_id' | 'brand_id' | 'brand_location_id' | 'claim_token'>,
): Promise<void> {
  await transaction`
    UPDATE crewcast.brand_locations
    SET
      scan_claim_token = NULL,
      scan_claimed_at = NULL,
      scan_lease_expires_at = NULL
    WHERE id = ${readBigint(row.brand_location_id, 'Expired location ID')}::bigint
      AND brand_id = ${readBigint(row.brand_id, 'Expired brand ID')}::bigint
      AND user_id = ${readPositiveInteger(row.user_id, 'Expired account ID')}
      AND scan_claim_token = ${readUuid(row.claim_token, 'Expired claim token')}::uuid
  `;
}

async function finalizeBatch(
  transaction: SearchStartSqlExecutor,
  batchId: string,
): Promise<WeeklyScanCompletion> {
  const batches = await transaction<BatchRow>`
    SELECT
      user_id,
      status,
      credit_status,
      credit_period_start::text AS credit_period_start,
      subscription_credits_consumed,
      topup_credits_consumed,
      provider_launch_attempted_at
    FROM crewcast.weekly_auto_scan_batches
    WHERE id = ${batchId}::uuid
    LIMIT 2
    FOR UPDATE
  `;
  if (batches.length !== 1) throw new Error('Weekly scan batch is not unique.');
  const batch = batches[0];
  if (batch.status !== 'pending' && batch.status !== 'running') {
    return {
      batchFinished: true,
      batchStatus: batch.status === 'completed'
        || batch.status === 'partial'
        || batch.status === 'failed'
        || batch.status === 'uncertain'
        ? batch.status
        : null,
      totalResults: 0,
      sourceCounts: { youtube: 0, instagram: 0, tiktok: 0, web: 0 },
    };
  }

  const aggregates = await transaction<AggregateRow>`
    SELECT
      array_agg(status ORDER BY position) AS statuses,
      COALESCE(sum(results_count), 0)::integer AS total_results,
      COALESCE(sum((source_counts->>'youtube')::integer), 0)::integer AS youtube,
      COALESCE(sum((source_counts->>'instagram')::integer), 0)::integer AS instagram,
      COALESCE(sum((source_counts->>'tiktok')::integer), 0)::integer AS tiktok,
      COALESCE(sum((source_counts->>'web')::integer), 0)::integer AS web
    FROM crewcast.weekly_auto_scan_locations
    WHERE batch_id = ${batchId}::uuid
  `;
  if (aggregates.length !== 1) {
    throw new Error('Weekly scan batch aggregate is invalid.');
  }
  const aggregate = aggregates[0];
  const rawStatuses = aggregate.statuses;
  if (!Array.isArray(rawStatuses)) {
    throw new Error('Weekly scan batch statuses are invalid.');
  }
  const statuses = rawStatuses.map(readLocationStatus);
  const resolution = resolveWeeklyScanBatch(
    statuses,
    batch.provider_launch_attempted_at !== null,
  );
  const totals = {
    totalResults: readSafeInteger(aggregate.total_results, 'Weekly scan total results'),
    sourceCounts: {
      youtube: readSafeInteger(aggregate.youtube, 'Weekly YouTube results'),
      instagram: readSafeInteger(aggregate.instagram, 'Weekly Instagram results'),
      tiktok: readSafeInteger(aggregate.tiktok, 'Weekly TikTok results'),
      web: readSafeInteger(aggregate.web, 'Weekly web results'),
    },
  };
  if (!resolution) {
    return { batchFinished: false, batchStatus: null, ...totals };
  }

  const accountId = readPositiveInteger(batch.user_id, 'Weekly scan batch account ID');
  if (resolution.creditStatus === 'released') {
    if (batch.credit_status !== 'reserved') {
      throw new Error('Only a reserved weekly scan credit can be released.');
    }
    const subscriptionCredits = readSafeInteger(
      batch.subscription_credits_consumed,
      'Weekly scan subscription credit split',
    );
    const topupCredits = readSafeInteger(
      batch.topup_credits_consumed,
      'Weekly scan top-up credit split',
    );
    readTimestamp(batch.credit_period_start, 'Weekly scan credit period start');
    const restored = await transaction<{ id: unknown }>`
      UPDATE crewcast.user_credits
      SET
        topic_search_credits_used = CASE
          WHEN period_start = (
            SELECT credit_period_start
            FROM crewcast.weekly_auto_scan_batches
            WHERE id = ${batchId}::uuid
          )
            THEN GREATEST(0, topic_search_credits_used - ${subscriptionCredits})
          ELSE topic_search_credits_used
        END,
        topic_search_credits_topup = topic_search_credits_topup + ${topupCredits},
        updated_at = NOW()
      WHERE user_id = ${accountId}
      RETURNING id
    `;
    if (restored.length !== 1) {
      throw new Error('Weekly scan credit could not be released exactly once.');
    }
  }

  const updated = await transaction<{ id: unknown }>`
    UPDATE crewcast.weekly_auto_scan_batches
    SET
      status = ${resolution.status},
      credit_status = ${resolution.creditStatus},
      completed_at = NOW()
    WHERE id = ${batchId}::uuid
      AND status IN ('pending', 'running')
    RETURNING id
  `;
  if (updated.length !== 1) {
    throw new Error('Weekly scan batch was not finalized exactly once.');
  }
  return { batchFinished: true, batchStatus: resolution.status, ...totals };
}

async function recoverExpiredClaims(
  transaction: SearchStartSqlExecutor,
  now: Date,
  accountId: number | null,
): Promise<void> {
  const expiredRows = await transaction<ExpiredWorkRow>`
    SELECT
      work.batch_id::text AS batch_id,
      work.user_id,
      work.brand_id::text AS brand_id,
      work.brand_location_id::text AS brand_location_id,
      work.claim_token::text AS claim_token,
      work.status,
      work.launch_attempted_at
    FROM crewcast.weekly_auto_scan_locations AS work
    JOIN crewcast.weekly_auto_scan_batches AS batches
      ON batches.id = work.batch_id
     AND batches.user_id = work.user_id
    WHERE work.status IN ('claimed', 'dispatching', 'running')
      AND work.lease_expires_at <= ${now.toISOString()}::timestamptz
      AND batches.status IN ('pending', 'running')
      AND (${accountId}::integer IS NULL OR work.user_id = ${accountId}::integer)
    ORDER BY work.lease_expires_at, work.batch_id, work.position
    LIMIT 100
    FOR UPDATE OF work SKIP LOCKED
  `;

  const uncertainBatches = new Set<string>();
  for (const row of expiredRows) {
    const batchId = readUuid(row.batch_id, 'Expired batch ID');
    const status = readLocationStatus(row.status);
    const safeToRetry = status === 'claimed' && row.launch_attempted_at === null;
    const providerRows = status === 'running'
      ? await transaction<ProviderReceiptRow>`
          SELECT platform, status, provider_run_id, exact_cost_usd, dispatched_at
          FROM crewcast.weekly_auto_scan_provider_runs
          WHERE batch_id = ${batchId}::uuid
            AND user_id = ${readPositiveInteger(row.user_id, 'Expired account ID')}
            AND brand_id = ${readBigint(row.brand_id, 'Expired brand ID')}::bigint
            AND brand_location_id = ${readBigint(row.brand_location_id, 'Expired location ID')}::bigint
          ORDER BY platform
          FOR UPDATE
        `
      : [];
    const safeToResume = status === 'running'
      && providerRows.some((receipt) => receipt.platform === 'google')
      && providerRows.every((receipt) =>
        (receipt.status === 'running'
          && receipt.provider_run_id !== null
          && receipt.dispatched_at !== null
          && receipt.exact_cost_usd === null)
        || receipt.status === 'succeeded'
        || receipt.status === 'failed');
    await clearLocationClaim(transaction, row);
    if (safeToRetry) {
      await transaction`
        UPDATE crewcast.weekly_auto_scan_locations
        SET
          status = 'pending',
          claim_token = NULL,
          claimed_at = NULL,
          lease_expires_at = NULL,
          error_code = 'lease_expired_before_dispatch',
          error_message = 'Worker lease expired before a provider launch was attempted.'
        WHERE batch_id = ${batchId}::uuid
          AND brand_location_id = ${readBigint(row.brand_location_id, 'Expired location ID')}::bigint
          AND claim_token = ${readUuid(row.claim_token, 'Expired claim token')}::uuid
      `;
    } else if (safeToResume) {
      // The provider identity is durable, so an expired web request is not a
      // reason to discard paid work. Release only the lease; the next cron
      // invocation will inspect these exact run IDs and never launch again.
      await transaction`
        UPDATE crewcast.weekly_auto_scan_locations
        SET
          status = 'waiting',
          claim_token = NULL,
          claimed_at = NULL,
          lease_expires_at = NULL,
          error_code = 'provider_continuation_pending',
          error_message = 'Known provider work will continue on the next scheduler invocation.'
        WHERE batch_id = ${batchId}::uuid
          AND brand_location_id = ${readBigint(row.brand_location_id, 'Expired location ID')}::bigint
          AND claim_token = ${readUuid(row.claim_token, 'Expired claim token')}::uuid
          AND status = 'running'
      `;
    } else {
      // A provider may still be running after the worker disappears. Preserve
      // that ambiguity on every per-provider receipt before closing the child;
      // no later scheduler cycle is then allowed to invent a safe replay.
      await transaction`
        UPDATE crewcast.weekly_auto_scan_provider_runs
        SET
          status = 'uncertain',
          error_message = 'Worker lease expired before provider completion could be verified.',
          completed_at = NOW()
        WHERE batch_id = ${batchId}::uuid
          AND brand_location_id = ${readBigint(row.brand_location_id, 'Expired location ID')}::bigint
          AND status IN ('dispatching', 'running')
      `;
      await transaction`
        UPDATE crewcast.weekly_auto_scan_locations
        SET
          status = 'uncertain',
          claim_token = NULL,
          claimed_at = NULL,
          lease_expires_at = NULL,
          error_code = 'lease_expired_after_dispatch',
          error_message = 'Worker lease expired after provider dispatch; automatic replay is blocked.',
          completed_at = NOW()
        WHERE batch_id = ${batchId}::uuid
          AND brand_location_id = ${readBigint(row.brand_location_id, 'Expired location ID')}::bigint
          AND claim_token = ${readUuid(row.claim_token, 'Expired claim token')}::uuid
      `;
      uncertainBatches.add(batchId);
    }
  }
  for (const batchId of uncertainBatches) await finalizeBatch(transaction, batchId);
}

async function skipInactivePendingWork(
  transaction: SearchStartSqlExecutor,
  accountId: number | null,
): Promise<void> {
  const rows = await transaction<{
    batch_id: unknown;
    brand_location_id: unknown;
  }>`
    SELECT
      work.batch_id::text AS batch_id,
      work.brand_location_id::text AS brand_location_id
    FROM crewcast.weekly_auto_scan_locations AS work
    JOIN crewcast.weekly_auto_scan_batches AS batches
      ON batches.id = work.batch_id
     AND batches.user_id = work.user_id
    JOIN crewcast.users AS users ON users.id = work.user_id
    JOIN crewcast.brands AS brands
      ON brands.id = work.brand_id
     AND brands.user_id = work.user_id
    JOIN crewcast.brand_locations AS locations
      ON locations.id = work.brand_location_id
     AND locations.brand_id = work.brand_id
     AND locations.user_id = work.user_id
    WHERE work.status = 'pending'
      AND batches.status IN ('pending', 'running')
      AND (${accountId}::integer IS NULL OR work.user_id = ${accountId}::integer)
      AND (
        NOT COALESCE(users.auto_scan_enabled, TRUE)
        OR brands.archived_at IS NOT NULL
        OR locations.archived_at IS NOT NULL
      )
    ORDER BY work.batch_id, work.position
    LIMIT 500
    FOR UPDATE OF work SKIP LOCKED
  `;
  const batchIds = new Set<string>();
  for (const row of rows) {
    const batchId = readUuid(row.batch_id, 'Skipped batch ID');
    await transaction`
      UPDATE crewcast.weekly_auto_scan_locations
      SET
        status = 'skipped',
        error_code = 'context_inactive',
        error_message = 'The account, brand, or location was disabled before provider dispatch.',
        completed_at = NOW()
      WHERE batch_id = ${batchId}::uuid
        AND brand_location_id = ${readBigint(row.brand_location_id, 'Skipped location ID')}::bigint
        AND status = 'pending'
    `;
    batchIds.add(batchId);
  }
  for (const batchId of batchIds) await finalizeBatch(transaction, batchId);
}

async function claimPendingWork(
  transaction: SearchStartSqlExecutor,
  now: Date,
  claimToken: string,
  accountId: number | null,
): Promise<WeeklyScanWorkItem | null> {
  // Serialize workers at the batch boundary before selecting a child. Locking
  // only the child/location rows is insufficient because two workers can pick
  // two different pending children from the same batch at the same instant.
  // The preliminary read keeps unrelated account batches independent; the
  // second SELECT runs after the batch lock is acquired and therefore sees any
  // claim committed by the worker that held the lock immediately before us.
  const candidateBatches = await transaction<{ batch_id: unknown }>`
    SELECT work.batch_id::text AS batch_id
    FROM crewcast.weekly_auto_scan_locations AS work
    JOIN crewcast.weekly_auto_scan_batches AS batches
      ON batches.id = work.batch_id
     AND batches.user_id = work.user_id
    JOIN crewcast.users AS users ON users.id = work.user_id
    JOIN crewcast.brands AS brands
      ON brands.id = work.brand_id
     AND brands.user_id = work.user_id
    JOIN crewcast.brand_locations AS locations
      ON locations.id = work.brand_location_id
     AND locations.brand_id = work.brand_id
     AND locations.user_id = work.user_id
    WHERE work.status IN ('pending', 'waiting')
      AND batches.status IN ('pending', 'running')
      AND (${accountId}::integer IS NULL OR work.user_id = ${accountId}::integer)
      AND (
        work.status = 'waiting'
        OR (
          COALESCE(users.auto_scan_enabled, TRUE)
          AND brands.archived_at IS NULL
          AND locations.archived_at IS NULL
        )
      )
      AND (
        locations.scan_claim_token IS NULL
        OR locations.scan_lease_expires_at <= ${now.toISOString()}::timestamptz
      )
      AND NOT EXISTS (
        SELECT 1
        FROM crewcast.weekly_auto_scan_locations AS active_work
        WHERE active_work.batch_id = work.batch_id
          AND active_work.status IN ('claimed', 'dispatching', 'running')
      )
    ORDER BY
      CASE WHEN work.status = 'waiting' THEN 0 ELSE 1 END,
      batches.created_at,
      work.position
    LIMIT 1
  `;
  if (candidateBatches.length === 0) return null;
  if (candidateBatches.length !== 1) {
    throw new Error('Weekly scan batch candidate lookup returned multiple rows.');
  }
  const candidateBatchId = readUuid(
    candidateBatches[0].batch_id,
    'Weekly scan candidate batch ID',
  );
  const lockedBatches = await transaction<{ id: unknown }>`
    SELECT id
    FROM crewcast.weekly_auto_scan_batches
    WHERE id = ${candidateBatchId}::uuid
      AND status IN ('pending', 'running')
    LIMIT 2
    FOR UPDATE
  `;
  if (lockedBatches.length === 0) return null;
  if (lockedBatches.length !== 1) {
    throw new Error('Weekly scan batch lock did not resolve exactly one batch.');
  }

  const candidates = await transaction<WorkRow>`
    SELECT
      work.batch_id::text AS batch_id,
      work.user_id,
      work.brand_id::text AS brand_id,
      work.brand_location_id::text AS brand_location_id,
      batches.due_at,
      work.settings_snapshot,
      work.status,
      work.search_id
    FROM crewcast.weekly_auto_scan_locations AS work
    JOIN crewcast.weekly_auto_scan_batches AS batches
      ON batches.id = work.batch_id
     AND batches.user_id = work.user_id
    JOIN crewcast.users AS users ON users.id = work.user_id
    JOIN crewcast.brands AS brands
      ON brands.id = work.brand_id
     AND brands.user_id = work.user_id
    JOIN crewcast.brand_locations AS locations
      ON locations.id = work.brand_location_id
     AND locations.brand_id = work.brand_id
     AND locations.user_id = work.user_id
    WHERE work.status IN ('pending', 'waiting')
      AND work.batch_id = ${candidateBatchId}::uuid
      AND batches.status IN ('pending', 'running')
      AND (${accountId}::integer IS NULL OR work.user_id = ${accountId}::integer)
      AND (
        work.status = 'waiting'
        OR (
          COALESCE(users.auto_scan_enabled, TRUE)
          AND brands.archived_at IS NULL
          AND locations.archived_at IS NULL
        )
      )
      AND (
        locations.scan_claim_token IS NULL
        OR locations.scan_lease_expires_at <= ${now.toISOString()}::timestamptz
      )
      AND NOT EXISTS (
        SELECT 1
        FROM crewcast.weekly_auto_scan_locations AS active_work
        WHERE active_work.batch_id = work.batch_id
          AND active_work.status IN ('claimed', 'dispatching', 'running')
      )
    ORDER BY
      CASE WHEN work.status = 'waiting' THEN 0 ELSE 1 END,
      batches.created_at,
      work.position
    LIMIT 1
    FOR UPDATE OF users, work, locations SKIP LOCKED
  `;
  if (candidates.length === 0) return null;
  if (candidates.length !== 1) throw new Error('Weekly scan claim returned multiple rows.');
  const row = candidates[0];
  const previousStatus = readLocationStatus(row.status);
  if (previousStatus !== 'pending' && previousStatus !== 'waiting') {
    throw new Error('Weekly scan claim candidate is not claimable.');
  }
  const work = mapWorkRow(row, claimToken);
  const leaseExpiresAt = addMinutes(now, WEEKLY_SCAN_LEASE_MINUTES).toISOString();

  const claimed = await transaction<{ batch_id: unknown }>`
    UPDATE crewcast.weekly_auto_scan_locations
    SET
      status = CASE WHEN status = 'waiting' THEN 'running' ELSE 'claimed' END,
      claim_token = ${claimToken}::uuid,
      claimed_at = ${now.toISOString()}::timestamptz,
      lease_expires_at = ${leaseExpiresAt}::timestamptz,
      error_code = NULL,
      error_message = NULL
    WHERE batch_id = ${work.batchId}::uuid
      AND brand_location_id = ${work.brandLocationId}::bigint
      AND status IN ('pending', 'waiting')
    RETURNING batch_id
  `;
  if (claimed.length !== 1) throw new Error('Weekly scan child was not claimed exactly once.');

  const locationClaims = await transaction<{ id: unknown }>`
    UPDATE crewcast.brand_locations
    SET
      scan_claim_token = ${claimToken}::uuid,
      scan_claimed_at = ${now.toISOString()}::timestamptz,
      scan_lease_expires_at = ${leaseExpiresAt}::timestamptz
    WHERE id = ${work.brandLocationId}::bigint
      AND brand_id = ${work.brandId}::bigint
      AND user_id = ${work.accountId}
      AND (${previousStatus === 'waiting'} OR archived_at IS NULL)
      AND (
        scan_claim_token IS NULL
        OR scan_lease_expires_at <= ${now.toISOString()}::timestamptz
      )
    RETURNING id
  `;
  if (locationClaims.length !== 1) {
    throw new Error('Weekly scan location lease was not acquired exactly once.');
  }
  await transaction`
    UPDATE crewcast.weekly_auto_scan_batches
    SET status = 'running'
    WHERE id = ${work.batchId}::uuid
      AND status = 'pending'
  `;
  return work;
}

async function disableForInsufficientCredit(
  transaction: SearchStartSqlExecutor,
  accountId: number,
): Promise<void> {
  const disabled = await transaction<{ id: unknown }>`
    UPDATE crewcast.users
    SET auto_scan_enabled = false, updated_at = NOW()
    WHERE id = ${accountId}
    RETURNING id
  `;
  if (disabled.length !== 1) throw new Error('Auto-scan account could not be disabled.');
  await transaction`
    UPDATE crewcast.brand_locations
    SET
      auto_scan_enabled = false,
      next_auto_scan_at = NULL,
      scan_claim_token = NULL,
      scan_claimed_at = NULL,
      scan_lease_expires_at = NULL
    WHERE user_id = ${accountId}
      AND archived_at IS NULL
  `;
}

async function createDueBatch(
  transaction: SearchStartSqlExecutor,
  now: Date,
  batchId: string,
  scopedAccountId: number | null,
): Promise<Exclude<WeeklyScanClaimResult, { outcome: 'claimed' | 'idle' }> | null> {
  // Lock the account root before its subscription. Billing, onboarding,
  // profile changes and deletion all use this same order. Two weekly workers
  // still skip an account already claimed by another worker, but a Stripe
  // webhook can no longer deadlock this transaction by taking the rows in the
  // opposite order.
  const dueAccounts = await transaction<{ user_id: unknown }>`
    SELECT
      users.id AS user_id
    FROM crewcast.users AS users
    JOIN crewcast.subscriptions AS subscriptions ON subscriptions.user_id = users.id
    WHERE subscriptions.status = 'active'
      AND subscriptions.first_payment_at IS NOT NULL
      AND subscriptions.next_auto_scan_at IS NOT NULL
      AND subscriptions.next_auto_scan_at <= ${now.toISOString()}::timestamptz
      AND COALESCE(users.auto_scan_enabled, TRUE)
      AND (
        ${scopedAccountId}::integer IS NULL
        OR subscriptions.user_id = ${scopedAccountId}::integer
      )
      AND NOT EXISTS (
        SELECT 1
        FROM crewcast.weekly_auto_scan_batches AS batches
        WHERE batches.user_id = subscriptions.user_id
          AND batches.status IN ('pending', 'running')
    )
    ORDER BY subscriptions.next_auto_scan_at, subscriptions.user_id
    LIMIT 1
    FOR UPDATE OF users SKIP LOCKED
  `;
  if (dueAccounts.length === 0) return null;
  if (dueAccounts.length !== 1) throw new Error('Due weekly scan account is not unique.');
  const accountId = readPositiveInteger(dueAccounts[0].user_id, 'Due weekly scan account');

  const dueRows = await transaction<DueAccountRow>`
    SELECT
      id AS subscription_id,
      user_id,
      next_auto_scan_at::text AS due_at
    FROM crewcast.subscriptions
    WHERE user_id = ${accountId}
      AND status = 'active'
      AND first_payment_at IS NOT NULL
      AND next_auto_scan_at IS NOT NULL
      AND next_auto_scan_at <= ${now.toISOString()}::timestamptz
    ORDER BY id
    LIMIT 2
    FOR UPDATE
  `;
  if (dueRows.length === 0) {
    throw new Error('Due weekly scan subscription changed after its account was locked.');
  }
  if (dueRows.length !== 1) throw new Error('Due weekly scan account is not unique.');
  if (readPositiveInteger(dueRows[0].user_id, 'Due weekly scan account') !== accountId) {
    throw new Error('Due weekly scan subscription belongs to a different account.');
  }
  const subscriptionId = readPositiveInteger(
    dueRows[0].subscription_id,
    'Due weekly scan subscription',
  );
  const dueAtText = String(dueRows[0].due_at);
  readTimestamp(dueAtText, 'Due weekly scan timestamp');
  const nextDueAt = addDays(now, WEEKLY_SCAN_INTERVAL_DAYS);

  const activeLocations = await transaction<ActiveLocationRow>`
    SELECT
      locations.id::text AS id,
      (
        cardinality(locations.topics) > 0
        OR cardinality(locations.competitors) > 0
      ) AS searchable
    FROM crewcast.brand_locations AS locations
    JOIN crewcast.brands AS brands
      ON brands.id = locations.brand_id
     AND brands.user_id = locations.user_id
    WHERE locations.user_id = ${accountId}
      AND locations.archived_at IS NULL
      AND brands.archived_at IS NULL
    ORDER BY brands.created_at, brands.id, locations.created_at, locations.id
    FOR UPDATE OF locations, brands
  `;
  const locationCount = activeLocations.length;
  if (locationCount === 0) throw new Error('A due account has no active brand location.');
  for (const location of activeLocations) {
    readBigint(location.id, 'Weekly active location ID');
    if (typeof location.searchable !== 'boolean') {
      throw new Error('Weekly active location searchability is invalid.');
    }
  }
  const searchableCount = activeLocations.filter(({ searchable }) => searchable).length;
  if (searchableCount < 0 || searchableCount > locationCount) {
    throw new Error('Weekly searchable location count is inconsistent.');
  }

  let creditStatus: 'not_required' | 'reserved' = 'not_required';
  let subscriptionCreditsConsumed = 0;
  let topupCreditsConsumed = 0;
  let creditRowId: number | null = null;

  if (searchableCount > 0) {
    const creditRows = await transaction<CreditRow>`
      SELECT
        id,
        topic_search_credits_total,
        topic_search_credits_used,
        topic_search_credits_topup,
        period_start::text AS period_start,
        period_end
      FROM crewcast.user_credits
      WHERE user_id = ${accountId}
      LIMIT 2
      FOR UPDATE
    `;
    if (creditRows.length === 0) {
      await disableForInsufficientCredit(transaction, accountId);
      return { outcome: 'disabled_insufficient', accountId };
    }
    if (creditRows.length !== 1) throw new Error('Weekly scan credit row is not unique.');
    const credit = creditRows[0];
    const periodEnd = readTimestamp(credit.period_end, 'Weekly credit period end');
    const total = readSafeInteger(credit.topic_search_credits_total, 'Weekly total credits');
    const used = readSafeInteger(credit.topic_search_credits_used, 'Weekly used credits');
    const topup = readSafeInteger(credit.topic_search_credits_topup, 'Weekly top-up credits');
    if (total < -1 || used < 0 || topup < 0 || periodEnd.getTime() <= now.getTime()) {
      await disableForInsufficientCredit(transaction, accountId);
      return { outcome: 'disabled_insufficient', accountId };
    }
    const subscriptionRemaining = total === -1 ? 1 : Math.max(0, total - used);
    if (total !== -1 && subscriptionRemaining + topup < 1) {
      await disableForInsufficientCredit(transaction, accountId);
      return { outcome: 'disabled_insufficient', accountId };
    }
    creditRowId = readPositiveInteger(credit.id, 'Weekly credit row ID');
    readTimestamp(credit.period_start, 'Weekly credit period start');
    subscriptionCreditsConsumed = Math.min(1, subscriptionRemaining);
    topupCreditsConsumed = 1 - subscriptionCreditsConsumed;
    creditStatus = 'reserved';
  }

  const batchStatus = searchableCount === 0 ? 'no_work' : 'pending';
  const insertedBatches = await transaction<{ id: unknown }>`
    INSERT INTO crewcast.weekly_auto_scan_batches (
      id,
      user_id,
      due_at,
      next_due_at,
      status,
      credit_status,
      credit_period_start,
      subscription_credits_consumed,
      topup_credits_consumed,
      location_count,
      searchable_location_count,
      completed_at
    ) VALUES (
      ${batchId}::uuid,
      ${accountId},
      ${dueAtText}::timestamptz,
      ${nextDueAt.toISOString()}::timestamptz,
      ${batchStatus},
      ${creditStatus},
      (
        SELECT period_start
        FROM crewcast.user_credits
        WHERE id = ${creditRowId}::integer
          AND user_id = ${accountId}
      ),
      ${subscriptionCreditsConsumed},
      ${topupCreditsConsumed},
      ${locationCount},
      ${searchableCount},
      ${searchableCount === 0 ? now.toISOString() : null}::timestamptz
    )
    RETURNING id
  `;
  if (insertedBatches.length !== 1) throw new Error('Weekly scan batch was not inserted.');

  const insertedLocations = await transaction<{ brand_location_id: unknown }>`
    INSERT INTO crewcast.weekly_auto_scan_locations (
      batch_id,
      user_id,
      brand_id,
      brand_location_id,
      position,
      settings_snapshot,
      status,
      error_code,
      error_message,
      completed_at
    )
    SELECT
      ${batchId}::uuid,
      locations.user_id,
      locations.brand_id,
      locations.id,
      row_number() OVER (
        ORDER BY brands.is_default DESC, brands.created_at, brands.id,
                 locations.is_default DESC, locations.created_at, locations.id
      )::integer,
      jsonb_build_object(
        'brandName', brands.name,
        'normalizedDomain', brands.normalized_domain,
        'countryCode', locations.country_code,
        'languageCode', locations.language_code,
        'topics', locations.topics,
        'competitors', locations.competitors
      ),
      CASE
        WHEN cardinality(locations.topics) > 0 OR cardinality(locations.competitors) > 0
          THEN 'pending'
        ELSE 'skipped'
      END,
      CASE
        WHEN cardinality(locations.topics) > 0 OR cardinality(locations.competitors) > 0
          THEN NULL
        ELSE 'no_search_terms'
      END,
      CASE
        WHEN cardinality(locations.topics) > 0 OR cardinality(locations.competitors) > 0
          THEN NULL
        ELSE 'No topics or competitors were configured at batch claim time.'
      END,
      CASE
        WHEN cardinality(locations.topics) > 0 OR cardinality(locations.competitors) > 0
          THEN NULL
        ELSE ${now.toISOString()}::timestamptz
      END
    FROM crewcast.brand_locations AS locations
    JOIN crewcast.brands AS brands
      ON brands.id = locations.brand_id
     AND brands.user_id = locations.user_id
    WHERE locations.user_id = ${accountId}
      AND locations.archived_at IS NULL
      AND brands.archived_at IS NULL
    RETURNING brand_location_id
  `;
  if (insertedLocations.length !== locationCount) {
    throw new Error('Weekly scan batch did not capture every locked active location.');
  }

  if (creditRowId !== null) {
    const debited = await transaction<{ id: unknown }>`
      UPDATE crewcast.user_credits
      SET
        topic_search_credits_used = topic_search_credits_used
          + ${subscriptionCreditsConsumed},
        topic_search_credits_topup = topic_search_credits_topup
          - ${topupCreditsConsumed},
        updated_at = NOW()
      WHERE id = ${creditRowId}
        AND user_id = ${accountId}
        AND period_end > ${now.toISOString()}::timestamptz
        AND topic_search_credits_topup >= ${topupCreditsConsumed}
      RETURNING id
    `;
    if (debited.length !== 1) throw new Error('Weekly scan credit debit was not atomic.');
  }

  const schedules = await transaction<{ user_id: unknown }>`
    UPDATE crewcast.subscriptions
    SET
      next_auto_scan_at = ${nextDueAt.toISOString()}::timestamptz,
      last_auto_scan_at = CASE
        WHEN ${searchableCount === 0} THEN ${now.toISOString()}::timestamptz
        ELSE last_auto_scan_at
      END,
      updated_at = NOW()
    WHERE id = ${subscriptionId}
      AND user_id = ${accountId}
      AND next_auto_scan_at <= ${now.toISOString()}::timestamptz
    RETURNING user_id
  `;
  if (schedules.length !== 1) {
    throw new Error('Weekly scan subscription occurrence changed during claim.');
  }
  await transaction`
    UPDATE crewcast.brand_locations
    SET
      auto_scan_enabled = true,
      next_auto_scan_at = ${nextDueAt.toISOString()}::timestamptz,
      last_auto_scan_at = CASE
        WHEN ${searchableCount === 0} THEN ${now.toISOString()}::timestamptz
        ELSE last_auto_scan_at
      END
    WHERE user_id = ${accountId}
      AND archived_at IS NULL
  `;

  return searchableCount === 0
    ? { outcome: 'no_work', accountId, batchId }
    : null;
}

export async function claimNextWeeklyScanWork(
  executor: SearchStartSqlExecutor,
  input: {
    now: Date;
    batchId: string;
    claimToken: string;
    /** Restricts an internal claim cycle to one account; omitted by the production cron. */
    accountId?: number;
  },
): Promise<WeeklyScanClaimResult> {
  readUuid(input.batchId, 'New weekly scan batch ID');
  readUuid(input.claimToken, 'Weekly scan claim token');
  const accountId = input.accountId === undefined
    ? null
    : readPositiveInteger(input.accountId, 'Weekly scan claim account scope');
  return withTransaction(executor, async (transaction) => {
    await recoverExpiredClaims(transaction, input.now, accountId);
    await skipInactivePendingWork(transaction, accountId);

    const existing = await claimPendingWork(
      transaction,
      input.now,
      input.claimToken,
      accountId,
    );
    if (existing) return { outcome: 'claimed', work: existing };

    const creation = await createDueBatch(
      transaction,
      input.now,
      input.batchId,
      accountId,
    );
    if (creation) return creation;

    const created = await claimPendingWork(
      transaction,
      input.now,
      input.claimToken,
      accountId,
    );
    return created ? { outcome: 'claimed', work: created } : { outcome: 'idle' };
  });
}

async function lockClaimedWork(
  transaction: SearchStartSqlExecutor,
  work: WeeklyScanWorkItem,
  allowedStatuses: readonly WeeklyScanLocationStatus[],
): Promise<void> {
  const rows = await transaction<{ status: unknown }>`
    SELECT status
    FROM crewcast.weekly_auto_scan_locations
    WHERE batch_id = ${work.batchId}::uuid
      AND user_id = ${work.accountId}
      AND brand_id = ${work.brandId}::bigint
      AND brand_location_id = ${work.brandLocationId}::bigint
      AND claim_token = ${work.claimToken}::uuid
    LIMIT 2
    FOR UPDATE
  `;
  if (rows.length !== 1 || !allowedStatuses.includes(readLocationStatus(rows[0].status))) {
    throw new Error('Weekly scan work lease is missing or in an unexpected state.');
  }
}

export async function getWeeklyScanProviderRun(
  executor: SearchStartSqlExecutor,
  work: WeeklyScanWorkItem,
  launch: WeeklyProviderLaunchInput,
): Promise<WeeklyProviderResumeState | null> {
  validateProviderLaunchInput(launch);
  return withTransaction(executor, async (transaction) => {
    await lockClaimedWork(transaction, work, ['claimed', 'running']);
    const rows = await transaction<ProviderReceiptRow>`
      SELECT
        platform,
        status,
        provider_run_id,
        exact_cost_usd,
        dispatched_at,
        input_fingerprint,
        correlation_id
      FROM crewcast.weekly_auto_scan_provider_runs
      WHERE batch_id = ${work.batchId}::uuid
        AND user_id = ${work.accountId}
        AND brand_id = ${work.brandId}::bigint
        AND brand_location_id = ${work.brandLocationId}::bigint
        AND platform = ${launch.provider}
      LIMIT 2
      FOR UPDATE
    `;
    if (rows.length === 0) return null;
    if (rows.length !== 1) throw new Error('Weekly provider receipt is not unique.');
    const row = rows[0];
    if (
      row.input_fingerprint !== launch.inputFingerprint
      || row.correlation_id !== launch.correlationId
    ) {
      throw new Error('Weekly provider receipt does not match the immutable provider input.');
    }
    const providerRunId = row.provider_run_id === null
      ? null
      : readProviderRunId(String(row.provider_run_id));
    return {
      status: readProviderReceiptStatus(row.status),
      providerRunId,
      exactCostUsd: readNullableProviderCost(row.exact_cost_usd),
      dispatchedAt: row.dispatched_at === null
        ? null
        : readTimestamp(row.dispatched_at, 'Weekly provider dispatch time').toISOString(),
    };
  });
}

export async function prepareWeeklyScanPrimaryProvider(
  executor: SearchStartSqlExecutor,
  work: WeeklyScanWorkItem,
  input: {
    now: Date;
    searchId: number | null;
    launch: WeeklyProviderLaunchInput;
  },
): Promise<void> {
  validateProviderLaunchInput(input.launch);
  if (input.launch.provider !== 'google') {
    throw new Error('The primary weekly provider must be Google.');
  }
  if (
    input.searchId !== null
    && (!Number.isSafeInteger(input.searchId) || input.searchId <= 0)
  ) {
    throw new Error('Weekly scan tracking search ID is invalid.');
  }
  await withTransaction(executor, async (transaction) => {
    await lockClaimedWork(transaction, work, ['claimed']);
    await transaction`
      INSERT INTO crewcast.weekly_auto_scan_provider_runs (
        batch_id,
        user_id,
        brand_id,
        brand_location_id,
        platform,
        input_fingerprint,
        correlation_id,
        status,
        launch_attempted_at
      ) VALUES (
        ${work.batchId}::uuid,
        ${work.accountId},
        ${work.brandId}::bigint,
        ${work.brandLocationId}::bigint,
        ${input.launch.provider},
        ${input.launch.inputFingerprint},
        ${input.launch.correlationId},
        'dispatching',
        ${input.now.toISOString()}::timestamptz
      )
    `;
    const updated = await transaction<{ batch_id: unknown }>`
      UPDATE crewcast.weekly_auto_scan_locations
      SET
        status = 'dispatching',
        launch_attempted_at = ${input.now.toISOString()}::timestamptz,
        search_id = ${input.searchId}
      WHERE batch_id = ${work.batchId}::uuid
        AND brand_location_id = ${work.brandLocationId}::bigint
        AND claim_token = ${work.claimToken}::uuid
        AND status = 'claimed'
      RETURNING batch_id
    `;
    if (updated.length !== 1) throw new Error('Weekly scan dispatch was not recorded.');
    const batches = await transaction<{ id: unknown }>`
      UPDATE crewcast.weekly_auto_scan_batches
      SET
        credit_status = 'consumed',
        provider_launch_attempted_at = COALESCE(
          provider_launch_attempted_at,
          ${input.now.toISOString()}::timestamptz
        )
      WHERE id = ${work.batchId}::uuid
        AND status IN ('pending', 'running')
        AND credit_status IN ('reserved', 'consumed')
      RETURNING id
    `;
    if (batches.length !== 1) throw new Error('Weekly scan credit was not committed before dispatch.');
  });
}

export async function prepareWeeklyScanEnrichmentProvider(
  executor: SearchStartSqlExecutor,
  work: WeeklyScanWorkItem,
  input: { now: Date; launch: WeeklyProviderLaunchInput },
): Promise<void> {
  validateProviderLaunchInput(input.launch);
  if (input.launch.provider === 'google') {
    throw new Error('Google must use the primary weekly provider preparation.');
  }
  await withTransaction(executor, async (transaction) => {
    await lockClaimedWork(transaction, work, ['running']);
    await transaction`
      INSERT INTO crewcast.weekly_auto_scan_provider_runs (
        batch_id,
        user_id,
        brand_id,
        brand_location_id,
        platform,
        input_fingerprint,
        correlation_id,
        status,
        launch_attempted_at
      ) VALUES (
        ${work.batchId}::uuid,
        ${work.accountId},
        ${work.brandId}::bigint,
        ${work.brandLocationId}::bigint,
        ${input.launch.provider},
        ${input.launch.inputFingerprint},
        ${input.launch.correlationId},
        'dispatching',
        ${input.now.toISOString()}::timestamptz
      )
    `;
  });
}

export async function recordWeeklyScanProviderRun(
  executor: SearchStartSqlExecutor,
  work: WeeklyScanWorkItem,
  launch: WeeklyProviderLaunchInput,
  providerRunId: string,
): Promise<void> {
  validateProviderLaunchInput(launch);
  const validatedRunId = readProviderRunId(providerRunId);
  await withTransaction(executor, async (transaction) => {
    await lockClaimedWork(
      transaction,
      work,
      launch.provider === 'google' ? ['dispatching'] : ['running'],
    );
    const receipts = await transaction<{ batch_id: unknown }>`
      UPDATE crewcast.weekly_auto_scan_provider_runs
      SET
        status = 'running',
        provider_run_id = ${validatedRunId},
        dispatched_at = NOW()
      WHERE batch_id = ${work.batchId}::uuid
        AND user_id = ${work.accountId}
        AND brand_id = ${work.brandId}::bigint
        AND brand_location_id = ${work.brandLocationId}::bigint
        AND platform = ${launch.provider}
        AND input_fingerprint = ${launch.inputFingerprint}
        AND correlation_id = ${launch.correlationId}
        AND status = 'dispatching'
        AND provider_run_id IS NULL
      RETURNING batch_id
    `;
    if (receipts.length !== 1) {
      throw new Error('Weekly scan provider receipt was not recorded exactly once.');
    }
    if (launch.provider !== 'google') return;
    const rows = await transaction<{ batch_id: unknown }>`
      UPDATE crewcast.weekly_auto_scan_locations
      SET status = 'running', provider_run_id = ${validatedRunId}
      WHERE batch_id = ${work.batchId}::uuid
        AND brand_location_id = ${work.brandLocationId}::bigint
        AND claim_token = ${work.claimToken}::uuid
        AND status = 'dispatching'
      RETURNING batch_id
    `;
    if (rows.length !== 1) throw new Error('Weekly scan provider run was not recorded.');
  });
}

export async function settleWeeklyScanProviderRun(
  executor: SearchStartSqlExecutor,
  work: WeeklyScanWorkItem,
  launch: WeeklyProviderLaunchInput,
  settlement: WeeklyProviderSettlement,
): Promise<void> {
  validateProviderLaunchInput(launch);
  const providerRunId = settlement.providerRunId === undefined
    ? null
    : readProviderRunId(settlement.providerRunId);
  const exactCostUsd = readNullableProviderCost(settlement.exactCostUsd);
  const errorMessage = settlement.errorMessage === undefined
    ? null
    : truncateError(settlement.errorMessage.trim() || 'Unknown weekly provider failure');
  if (settlement.outcome === 'succeeded' && (providerRunId === null || errorMessage !== null)) {
    throw new Error('A successful weekly provider settlement requires a run and no error.');
  }
  if (settlement.outcome !== 'succeeded' && errorMessage === null) {
    throw new Error('A failed or uncertain weekly provider settlement requires an error.');
  }
  if (providerRunId === null && exactCostUsd !== null) {
    throw new Error('A weekly provider cost requires a provider run ID.');
  }

  await withTransaction(executor, async (transaction) => {
    await lockClaimedWork(transaction, work, ['dispatching', 'running']);
    const rows = await transaction<{ batch_id: unknown }>`
      UPDATE crewcast.weekly_auto_scan_provider_runs
      SET
        status = ${settlement.outcome},
        provider_run_id = COALESCE(provider_run_id, ${providerRunId}),
        dispatched_at = CASE
          WHEN COALESCE(provider_run_id, ${providerRunId}) IS NOT NULL
            THEN COALESCE(dispatched_at, NOW())
          ELSE NULL
        END,
        exact_cost_usd = ${exactCostUsd},
        error_message = ${errorMessage},
        completed_at = NOW()
      WHERE batch_id = ${work.batchId}::uuid
        AND user_id = ${work.accountId}
        AND brand_id = ${work.brandId}::bigint
        AND brand_location_id = ${work.brandLocationId}::bigint
        AND platform = ${launch.provider}
        AND input_fingerprint = ${launch.inputFingerprint}
        AND correlation_id = ${launch.correlationId}
        AND status = ANY(
          CASE
            WHEN ${settlement.outcome} = 'succeeded'
              THEN ARRAY['running']::text[]
            ELSE ARRAY['dispatching', 'running']::text[]
          END
        )
        AND (
          provider_run_id IS NULL
          OR provider_run_id = ${providerRunId}
        )
      RETURNING batch_id
    `;
    if (rows.length !== 1) {
      throw new Error('Weekly scan provider settlement was not recorded exactly once.');
    }
  });
}

export async function deferWeeklyScanLocation(
  executor: SearchStartSqlExecutor,
  work: WeeklyScanWorkItem,
): Promise<void> {
  await withTransaction(executor, async (transaction) => {
    await lockClaimedWork(transaction, work, ['running']);
    const receipts = await transaction<ProviderReceiptRow>`
      SELECT
        platform,
        status,
        provider_run_id,
        exact_cost_usd,
        dispatched_at,
        input_fingerprint,
        correlation_id
      FROM crewcast.weekly_auto_scan_provider_runs
      WHERE batch_id = ${work.batchId}::uuid
        AND user_id = ${work.accountId}
        AND brand_id = ${work.brandId}::bigint
        AND brand_location_id = ${work.brandLocationId}::bigint
      ORDER BY platform
      FOR UPDATE
    `;
    const hasKnownRunningProvider = receipts.some((receipt) =>
      receipt.status === 'running'
      && receipt.provider_run_id !== null
      && receipt.dispatched_at !== null);
    const hasUnsafeReceipt = receipts.some((receipt) =>
      receipt.status === 'dispatching' || receipt.status === 'uncertain');
    if (!hasKnownRunningProvider || hasUnsafeReceipt) {
      throw new Error('Weekly scan continuation requires a known running provider receipt.');
    }

    const rows = await transaction<{ batch_id: unknown }>`
      UPDATE crewcast.weekly_auto_scan_locations
      SET
        status = 'waiting',
        claim_token = NULL,
        claimed_at = NULL,
        lease_expires_at = NULL,
        error_code = 'provider_continuation_pending',
        error_message = 'Known provider work will continue on the next scheduler invocation.'
      WHERE batch_id = ${work.batchId}::uuid
        AND brand_location_id = ${work.brandLocationId}::bigint
        AND claim_token = ${work.claimToken}::uuid
        AND status = 'running'
      RETURNING batch_id
    `;
    if (rows.length !== 1) throw new Error('Weekly scan continuation was not recorded.');
    await transaction`
      UPDATE crewcast.brand_locations
      SET
        scan_claim_token = NULL,
        scan_claimed_at = NULL,
        scan_lease_expires_at = NULL
      WHERE id = ${work.brandLocationId}::bigint
        AND brand_id = ${work.brandId}::bigint
        AND user_id = ${work.accountId}
        AND scan_claim_token = ${work.claimToken}::uuid
    `;
  });
}

export async function completeWeeklyScanLocation(
  executor: SearchStartSqlExecutor,
  work: WeeklyScanWorkItem,
  result: {
    resultsCount: number;
    sourceCounts: WeeklyScanSourceCounts;
  },
): Promise<WeeklyScanCompletion> {
  if (!Number.isSafeInteger(result.resultsCount) || result.resultsCount < 0) {
    throw new Error('Weekly scan result count is invalid.');
  }
  for (const [source, count] of Object.entries(result.sourceCounts)) {
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new Error(`Weekly scan ${source} result count is invalid.`);
    }
  }
  return withTransaction(executor, async (transaction) => {
    await lockClaimedWork(transaction, work, ['running']);
    const providerRows = await transaction<ProviderReceiptRow>`
      SELECT platform, status, provider_run_id, exact_cost_usd
      FROM crewcast.weekly_auto_scan_provider_runs
      WHERE batch_id = ${work.batchId}::uuid
        AND user_id = ${work.accountId}
        AND brand_id = ${work.brandId}::bigint
        AND brand_location_id = ${work.brandLocationId}::bigint
      ORDER BY platform
      FOR UPDATE
    `;
    const providers = providerRows.map((row) => ({
      provider: readProvider(row.platform),
      status: String(row.status),
      launched: row.provider_run_id !== null,
      exactCostUsd: readNullableProviderCost(row.exact_cost_usd),
    }));
    const primary = providers.filter(({ provider }) => provider === 'google');
    if (primary.length !== 1 || primary[0].status !== 'succeeded') {
      throw new Error('Weekly scan completion requires one successful Google receipt.');
    }
    if (providers.some(({ status }) =>
      status !== 'succeeded' && status !== 'failed')) {
      throw new Error('Weekly scan completion requires every provider receipt to be terminal.');
    }
    const exactProviderCostUsd = sumExactWeeklyProviderCosts(providers);
    const rows = await transaction<{ batch_id: unknown }>`
      UPDATE crewcast.weekly_auto_scan_locations
      SET
        status = 'succeeded',
        claim_token = NULL,
        claimed_at = NULL,
        lease_expires_at = NULL,
        results_count = ${result.resultsCount},
        source_counts = jsonb_build_object(
          'youtube', ${result.sourceCounts.youtube}::integer,
          'instagram', ${result.sourceCounts.instagram}::integer,
          'tiktok', ${result.sourceCounts.tiktok}::integer,
          'web', ${result.sourceCounts.web}::integer
        ),
        estimated_cost = ${exactProviderCostUsd},
        completed_at = NOW()
      WHERE batch_id = ${work.batchId}::uuid
        AND brand_location_id = ${work.brandLocationId}::bigint
        AND claim_token = ${work.claimToken}::uuid
        AND status = 'running'
      RETURNING batch_id
    `;
    if (rows.length !== 1) throw new Error('Weekly scan location was not completed.');
    await transaction`
      UPDATE crewcast.brand_locations
      SET
        scan_claim_token = NULL,
        scan_claimed_at = NULL,
        scan_lease_expires_at = NULL,
        last_auto_scan_at = NOW()
      WHERE id = ${work.brandLocationId}::bigint
        AND brand_id = ${work.brandId}::bigint
        AND user_id = ${work.accountId}
        AND scan_claim_token = ${work.claimToken}::uuid
    `;
    return finalizeBatch(transaction, work.batchId);
  });
}

export async function failWeeklyScanLocation(
  executor: SearchStartSqlExecutor,
  work: WeeklyScanWorkItem,
  failure: {
    outcome: 'failed' | 'uncertain';
    code: string;
    message: string;
  },
): Promise<WeeklyScanCompletion> {
  if (!/^[a-z0-9_]{1,100}$/.test(failure.code)) {
    throw new Error('Weekly scan failure code is invalid.');
  }
  return withTransaction(executor, async (transaction) => {
    await lockClaimedWork(transaction, work, ['claimed', 'dispatching', 'running']);
    await transaction`
      UPDATE crewcast.weekly_auto_scan_provider_runs
      SET
        status = 'uncertain',
        error_message = ${truncateError(failure.message)},
        completed_at = NOW()
      WHERE batch_id = ${work.batchId}::uuid
        AND user_id = ${work.accountId}
        AND brand_id = ${work.brandId}::bigint
        AND brand_location_id = ${work.brandLocationId}::bigint
        AND status IN ('dispatching', 'running')
    `;
    const rows = await transaction<{ batch_id: unknown }>`
      UPDATE crewcast.weekly_auto_scan_locations
      SET
        status = ${failure.outcome},
        claim_token = NULL,
        claimed_at = NULL,
        lease_expires_at = NULL,
        error_code = ${failure.code},
        error_message = ${truncateError(failure.message)},
        completed_at = NOW()
      WHERE batch_id = ${work.batchId}::uuid
        AND brand_location_id = ${work.brandLocationId}::bigint
        AND claim_token = ${work.claimToken}::uuid
        AND status IN ('claimed', 'dispatching', 'running')
      RETURNING batch_id
    `;
    if (rows.length !== 1) throw new Error('Weekly scan failure was not recorded.');
    await transaction`
      UPDATE crewcast.brand_locations
      SET
        scan_claim_token = NULL,
        scan_claimed_at = NULL,
        scan_lease_expires_at = NULL
      WHERE id = ${work.brandLocationId}::bigint
        AND brand_id = ${work.brandId}::bigint
        AND user_id = ${work.accountId}
        AND scan_claim_token = ${work.claimToken}::uuid
    `;
    return finalizeBatch(transaction, work.batchId);
  });
}
