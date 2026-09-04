import type {
  PersistSearchJobInput,
  PersistedSearchJob,
  SearchSettingsSnapshot,
} from '@/lib/search/start';

export interface SearchStartSqlExecutor {
  <T extends object = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<readonly T[]>;
  begin?<T>(
    callback: (transaction: SearchStartSqlExecutor) => Promise<T>,
  ): Promise<T>;
  savepoint?<T>(
    callback: (transaction: SearchStartSqlExecutor) => Promise<T>,
  ): Promise<T>;
}

export function withSearchStartTransaction<T>(
  executor: SearchStartSqlExecutor,
  callback: (transaction: SearchStartSqlExecutor) => Promise<T>,
): Promise<T> {
  if (typeof executor.begin === 'function') return executor.begin(callback);
  if (typeof executor.savepoint === 'function') return executor.savepoint(callback);
  throw new Error('Search persistence requires a transaction-capable SQL executor.');
}

interface SearchJobRow {
  id: unknown;
  apify_run_id: unknown;
  brand_id: unknown;
  brand_location_id: unknown;
  settings_snapshot: unknown;
  created: unknown;
}

function readJobId(value: unknown): number {
  const id = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error('Inserted search job ID is not a positive safe integer.');
  }
  return id;
}

function readBigint(value: unknown, field: string): string {
  const normalized = typeof value === 'number' ? String(value) : value;
  if (typeof normalized !== 'string' || !/^[1-9][0-9]*$/.test(normalized)) {
    throw new Error(`${field} is not a positive PostgreSQL bigint.`);
  }
  return normalized;
}

function readRunId(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('Search job run ID is invalid.');
  }
  return value;
}

function readSnapshot(value: unknown): SearchSettingsSnapshot {
  let parsed = value;
  if (typeof parsed === 'string') {
    parsed = JSON.parse(parsed) as unknown;
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Search job settings snapshot is invalid.');
  }
  return parsed as SearchSettingsSnapshot;
}

function readBoolean(value: unknown): boolean {
  if (typeof value !== 'boolean') {
    throw new Error('Search job creation state is invalid.');
  }
  return value;
}

function mapJob(row: SearchJobRow): PersistedSearchJob {
  return {
    id: readJobId(row.id),
    runId: readRunId(row.apify_run_id),
    brandId: readBigint(row.brand_id, 'brand_id'),
    brandLocationId: readBigint(row.brand_location_id, 'brand_location_id'),
    settingsSnapshot: readSnapshot(row.settings_snapshot),
    created: readBoolean(row.created),
  };
}

export async function findSearchJobByRequestId(
  executor: SearchStartSqlExecutor,
  accountId: number,
  requestId: string,
): Promise<PersistedSearchJob | null> {
  const rows = await executor<SearchJobRow>`
    SELECT
      id,
      apify_run_id,
      brand_id::text AS brand_id,
      brand_location_id::text AS brand_location_id,
      settings_snapshot,
      false AS created
    FROM crewcast.search_jobs
    WHERE user_id = ${accountId}
      AND request_id = ${requestId}::uuid
    ORDER BY id
    LIMIT 2
  `;

  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error('A search request identifier matched more than one job.');
  }
  return mapJob(rows[0]);
}

export async function findSearchJobById(
  executor: SearchStartSqlExecutor,
  accountId: number,
  jobId: number,
): Promise<PersistedSearchJob | null> {
  const rows = await executor<SearchJobRow>`
    SELECT
      id,
      apify_run_id,
      brand_id::text AS brand_id,
      brand_location_id::text AS brand_location_id,
      settings_snapshot,
      false AS created
    FROM crewcast.search_jobs
    WHERE user_id = ${accountId}
      AND id = ${jobId}
    LIMIT 2
  `;
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error('A search job identifier matched more than one job.');
  }
  return mapJob(rows[0]);
}

/**
 * Revalidates active ownership and inserts the attributed job in one SQL
 * statement. A default switch does not invalidate an already selected active
 * location; archival or ownership loss does.
 */
export async function persistSearchJobIfActive(
  executor: SearchStartSqlExecutor,
  input: PersistSearchJobInput,
): Promise<PersistedSearchJob | null> {
  if (
    input.reservationKind !== 'credit'
    && input.reservationKind !== 'onboarding_entitlement'
  ) {
    throw new Error('Search persistence requires one recognized reservation kind.');
  }

  return withSearchStartTransaction(executor, async (transaction) => {
    const rows = await transaction<SearchJobRow>`
      WITH active_context AS (
        SELECT brands.id AS brand_id, locations.id AS brand_location_id
        FROM crewcast.brands AS brands
        JOIN crewcast.brand_locations AS locations
          ON locations.brand_id = brands.id
         AND locations.user_id = brands.user_id
        WHERE brands.id = ${input.brandId}::bigint
          AND locations.id = ${input.brandLocationId}::bigint
          AND brands.user_id = ${input.accountId}
          AND locations.user_id = ${input.accountId}
          AND brands.archived_at IS NULL
          AND locations.archived_at IS NULL
      ), inserted AS (
        INSERT INTO crewcast.search_jobs (
          user_id,
          keyword,
          sources,
          apify_run_id,
          status,
          user_settings,
          brand_id,
          brand_location_id,
          settings_snapshot,
          request_id
        )
        SELECT
          ${input.accountId},
          ${input.combinedKeyword},
          ${input.sources},
          ${input.runId},
          'running',
          ${input.userSettings}::jsonb,
          active_context.brand_id,
          active_context.brand_location_id,
          ${input.settingsSnapshot}::jsonb,
          ${input.requestId}::uuid
        FROM active_context
        ON CONFLICT (user_id, request_id) WHERE request_id IS NOT NULL
        DO NOTHING
        RETURNING
          id,
          apify_run_id,
          brand_id,
          brand_location_id,
          settings_snapshot
      )
      SELECT
        id,
        apify_run_id,
        brand_id::text AS brand_id,
        brand_location_id::text AS brand_location_id,
        settings_snapshot,
        true AS created
      FROM inserted
      UNION ALL
      SELECT
        jobs.id,
        jobs.apify_run_id,
        jobs.brand_id::text AS brand_id,
        jobs.brand_location_id::text AS brand_location_id,
        jobs.settings_snapshot,
        false AS created
      FROM crewcast.search_jobs AS jobs
      WHERE jobs.user_id = ${input.accountId}
        AND jobs.request_id = ${input.requestId}::uuid
        AND NOT EXISTS (SELECT 1 FROM inserted)
      ORDER BY id
      LIMIT 2
    `;

    if (rows.length === 0) return null;
    if (rows.length !== 1) {
      throw new Error('Search job insert returned an unexpected row count.');
    }

    const job = mapJob(rows[0]);
    if (job.created && input.reservationKind === 'credit') {
      const linked = await transaction<{ id: unknown }[]>`
        UPDATE crewcast.search_credit_reservations
        SET
          search_job_id = ${job.id},
          launch_attempted_at = COALESCE(launch_attempted_at, NOW()),
          updated_at = NOW()
        WHERE user_id = ${input.accountId}
          AND request_id = ${input.requestId}::uuid
          AND brand_id = ${input.brandId}::bigint
          AND brand_location_id = ${input.brandLocationId}::bigint
          AND status = 'reserved'
          AND search_job_id IS NULL
        RETURNING id
      `;
      if (linked.length !== 1) {
        throw new Error('The search job could not be linked to exactly one credit reservation.');
      }
    }

    if (job.created && input.reservationKind === 'onboarding_entitlement') {
      const linked = await transaction<{ user_id: unknown }>`
        UPDATE crewcast.onboarding_search_entitlements
        SET
          search_job_id = ${job.id},
          provider_run_id = ${job.runId},
          status = 'consumed',
          consumed_at = NOW(),
          updated_at = NOW()
        WHERE user_id = ${input.accountId}
          AND request_id = ${input.requestId}::uuid
          AND brand_id = ${input.brandId}::bigint
          AND brand_location_id = ${input.brandLocationId}::bigint
          AND settings_snapshot = ${input.settingsSnapshot}::jsonb
          AND status = 'dispatching'
          AND launch_attempted_at IS NOT NULL
          AND search_job_id IS NULL
        RETURNING user_id
      `;
      if (linked.length !== 1) {
        throw new Error(
          'The search job could not be linked to exactly one onboarding-search entitlement.',
        );
      }
    }

    return job;
  });
}
