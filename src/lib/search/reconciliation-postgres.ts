import type postgres from 'postgres';
import { sql } from '@/lib/db';
import {
  refreshReconciledEnrichmentSetup,
} from '@/lib/search/enrichment-dispatch-postgres';
import {
  assertActionAllowed,
  parseReconciliationSettingsSnapshot,
  ReconciliationConflictError,
  ReconciliationInputError,
  type ResolveReconciliationInput,
  type SearchReconciliationCase,
} from '@/lib/search/reconciliation';
import type { SearchReconciliationOperator } from '@/lib/auth/operator';
import type { VerifiedProviderRun } from '@/lib/search/reconciliation-provider';
import {
  promoteStaleSearchLaunches,
  releaseUncertainSearchCredit,
} from '@/lib/search/credit-reservations-postgres';
import {
  persistSearchJobIfActive,
  type SearchStartSqlExecutor,
} from '@/lib/search/start-postgres';
import { releaseTopicSearchCreditReservation } from '@/lib/search/status-postgres';

type SqlClient = postgres.Sql;

async function withReconciliationTransaction<T>(
  database: SqlClient,
  operation: (transaction: SqlClient) => Promise<T>,
): Promise<T> {
  const transactional = database as unknown as {
    begin?: (callback: (transaction: SqlClient) => Promise<T>) => Promise<T>;
    savepoint?: (callback: (transaction: SqlClient) => Promise<T>) => Promise<T>;
  };
  if (typeof transactional.begin === 'function') {
    return transactional.begin((transaction) => operation(transaction));
  }
  if (typeof transactional.savepoint === 'function') {
    return transactional.savepoint((transaction) => operation(transaction));
  }
  throw new Error('Reconciliation requires a transaction-capable database executor.');
}

async function establishOperatorContext(
  transaction: SqlClient,
  operator: SearchReconciliationOperator,
): Promise<void> {
  const rows = await transaction<{ auth_user_id: string }[]>`
    SELECT auth_user_id::text AS auth_user_id
    FROM crewcast.search_reconciliation_operators
    WHERE auth_user_id = ${operator.authUserId}::uuid
      AND is_active
    LIMIT 2
    FOR SHARE
  `;
  if (rows.length !== 1 || rows[0].auth_user_id !== operator.authUserId) {
    throw new ReconciliationConflictError(
      'Operator access changed before this resolution was applied.',
    );
  }
  // Transaction-local identity is independently checked by database triggers.
  // This keeps privileged state changes bound to the active operator even if
  // another server path accidentally reaches the same tables.
  await transaction`
    SELECT
      set_config(
        'crewcast.search_reconciliation_operator_auth_user_id',
        ${operator.authUserId},
        true
      ),
      set_config(
        'crewcast.search_reconciliation_operator_email',
        ${operator.email},
        true
      )
  `;
}

interface CaseRow {
  id: unknown;
  case_type: unknown;
  status: unknown;
  lock_version: unknown;
  user_id: unknown;
  account_email: unknown;
  brand_id: unknown;
  brand_location_id: unknown;
  search_job_id: unknown;
  enrichment_dispatch_id: unknown;
  platform: unknown;
  source_request_id: unknown;
  source_status: unknown;
  source_error_message: unknown;
  source_launch_attempted_at: unknown;
  input_urls: unknown;
  input_fingerprint: unknown;
  can_cancel_and_refund: unknown;
  settings_snapshot: unknown;
  detected_at: unknown;
  resolved_at: unknown;
  resolution: unknown;
  resolution_note: unknown;
  provider_run_id: unknown;
  resolved_by_email: unknown;
}

function positiveInteger(value: unknown, field: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${field} is not a positive safe integer.`);
  }
  return parsed;
}

function bigint(value: unknown, field: string): string {
  const parsed = typeof value === 'number' ? String(value) : value;
  if (typeof parsed !== 'string' || !/^[1-9][0-9]*$/.test(parsed)) {
    throw new Error(`${field} is not a positive bigint.`);
  }
  return parsed;
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${field} is missing.`);
  }
  return value;
}

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function timestamp(value: unknown, field: string): string {
  const date = value instanceof Date ? value : new Date(String(value));
  if (!Number.isFinite(date.getTime())) throw new Error(`${field} is invalid.`);
  return date.toISOString();
}

function optionalTimestamp(value: unknown, field: string): string | null {
  return value === null || value === undefined ? null : timestamp(value, field);
}

function requiredBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${field} is not a boolean.`);
  return value;
}

function jsonValue(value: unknown, field: string): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new Error(`${field} is invalid JSON.`);
  }
}

function postgresJson(value: unknown): postgres.JSONValue {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new Error('Value is not JSON serializable.');
  return JSON.parse(serialized) as postgres.JSONValue;
}

function mapCase(row: CaseRow): SearchReconciliationCase {
  const caseType = requiredText(row.case_type, 'case_type');
  if (
    caseType !== 'enrichment_dispatch'
    && caseType !== 'onboarding_search'
    && caseType !== 'paid_search'
  ) {
    throw new Error('The reconciliation case type is invalid.');
  }
  const status = requiredText(row.status, 'status');
  if (status !== 'open' && status !== 'resolved') {
    throw new Error('The reconciliation case status is invalid.');
  }
  const rawPlatform = optionalText(row.platform);
  const platform = rawPlatform as SearchReconciliationCase['platform'];
  if (
    platform !== null
    && !['youtube', 'instagram', 'tiktok', 'similarweb'].includes(platform)
  ) {
    throw new Error('The reconciliation platform is invalid.');
  }
  const rawInputUrls = jsonValue(row.input_urls, 'input_urls');
  if (
    rawInputUrls !== null
    && (!Array.isArray(rawInputUrls) || rawInputUrls.some((item) => typeof item !== 'string'))
  ) {
    throw new Error('The reconciliation input URLs are invalid.');
  }
  const rawSnapshot = jsonValue(row.settings_snapshot, 'settings_snapshot');
  const settingsSnapshot = rawSnapshot === null
    ? null
    : parseReconciliationSettingsSnapshot(
      rawSnapshot,
      caseType === 'paid_search' ? 'paid_search' : 'onboarding_search',
    );

  return {
    id: bigint(row.id, 'id'),
    caseType,
    status,
    version: positiveInteger(row.lock_version, 'lock_version'),
    accountId: positiveInteger(row.user_id, 'user_id'),
    accountEmail: requiredText(row.account_email, 'account_email'),
    brandId: bigint(row.brand_id, 'brand_id'),
    brandLocationId: bigint(row.brand_location_id, 'brand_location_id'),
    searchJobId: row.search_job_id === null
      ? null
      : positiveInteger(row.search_job_id, 'search_job_id'),
    dispatchId: row.enrichment_dispatch_id === null
      ? null
      : bigint(row.enrichment_dispatch_id, 'enrichment_dispatch_id'),
    platform,
    requestId: optionalText(row.source_request_id),
    sourceStatus: requiredText(row.source_status, 'source_status'),
    sourceErrorMessage: requiredText(row.source_error_message, 'source_error_message'),
    sourceLaunchAttemptedAt: timestamp(
      row.source_launch_attempted_at,
      'source_launch_attempted_at',
    ),
    inputUrls: rawInputUrls === null ? null : [...rawInputUrls] as string[],
    inputFingerprint: optionalText(row.input_fingerprint),
    canAttachProviderRun: caseType !== 'paid_search'
      || settingsSnapshot?.search.providerCorrelationId !== undefined,
    canCancelAndRefund: requiredBoolean(
      row.can_cancel_and_refund,
      'can_cancel_and_refund',
    ),
    settingsSnapshot,
    detectedAt: timestamp(row.detected_at, 'detected_at'),
    resolvedAt: optionalTimestamp(row.resolved_at, 'resolved_at'),
    resolution: optionalText(row.resolution) as SearchReconciliationCase['resolution'],
    resolutionNote: optionalText(row.resolution_note),
    providerRunId: optionalText(row.provider_run_id),
    resolvedByEmail: optionalText(row.resolved_by_email),
  };
}

const CASE_COLUMNS = sql`
  id::text AS id,
  case_type,
  status,
  lock_version,
  user_id,
  account_email,
  brand_id::text AS brand_id,
  brand_location_id::text AS brand_location_id,
  search_job_id,
  enrichment_dispatch_id::text AS enrichment_dispatch_id,
  platform,
  source_request_id::text AS source_request_id,
  source_status,
  source_error_message,
  source_launch_attempted_at,
  input_urls,
  input_fingerprint,
  EXISTS (
    SELECT 1
    FROM crewcast.search_credit_reservations AS reservations
    WHERE reservations.user_id = search_reconciliation_cases.user_id
      AND reservations.search_job_id = search_reconciliation_cases.search_job_id
      AND reservations.status = 'reserved'
  ) AS can_cancel_and_refund,
  settings_snapshot,
  detected_at,
  resolved_at,
  resolution,
  resolution_note,
  provider_run_id,
  resolved_by_email
`;

async function readCase(
  executor: SqlClient,
  caseId: string,
  lock = false,
): Promise<SearchReconciliationCase | null> {
  const rows = await executor<CaseRow[]>`
    SELECT ${CASE_COLUMNS}
    FROM crewcast.search_reconciliation_cases
    WHERE id = ${caseId}::bigint
    LIMIT 2
    ${lock ? executor`FOR UPDATE` : executor``}
  `;
  if (rows.length === 0) return null;
  if (rows.length !== 1) throw new Error('A case identifier matched multiple rows.');
  return mapCase(rows[0]);
}

export async function listOpenSearchReconciliationCases(): Promise<SearchReconciliationCase[]> {
  await promoteStaleSearchLaunches(sql);
  const rows = await (sql as SqlClient)<CaseRow[]>`
    SELECT ${CASE_COLUMNS}
    FROM crewcast.search_reconciliation_cases
    WHERE status = 'open'
    ORDER BY detected_at, id
    LIMIT 200
  `;
  return rows.map(mapCase);
}

export function loadSearchReconciliationCase(
  caseId: string,
): Promise<SearchReconciliationCase | null> {
  return readCase(sql as SqlClient, caseId);
}

async function resolveRows(
  transaction: SqlClient,
  caseIds: readonly string[],
  input: ResolveReconciliationInput,
  operator: SearchReconciliationOperator,
): Promise<void> {
  const rows = await transaction<{ id: string }[]>`
    UPDATE crewcast.search_reconciliation_cases
    SET
      status = 'resolved',
      lock_version = lock_version + 1,
      resolved_at = NOW(),
      resolution = ${input.action},
      resolution_note = ${input.note},
      provider_run_id = ${input.providerRunId ?? null},
      resolved_by_auth_user_id = ${operator.authUserId}::uuid,
      resolved_by_email = ${operator.email}
    WHERE id = ANY(${caseIds}::bigint[])
      AND status = 'open'
    RETURNING id::text AS id
  `;
  if (rows.length !== caseIds.length) {
    throw new ReconciliationConflictError('One or more cases changed during resolution.');
  }
}

async function assertProviderRunIsNotAttributedElsewhere(
  transaction: SqlClient,
  reconciliationCase: SearchReconciliationCase,
  providerRunId: string,
): Promise<void> {
  // All operator attachments for one external run serialize on the same
  // transaction-scoped lock. Normal launches receive their run ID from Apify,
  // so the remaining checks bind this manually supplied ID to one search only.
  await transaction`
    SELECT pg_advisory_xact_lock(hashtextextended(${providerRunId}, 902091347))
  `;
  const conflicts = await transaction<{ attribution: string; source_id: string }[]>`
    SELECT attribution, source_id
    FROM (
      SELECT 'search_job'::text AS attribution, jobs.id::text AS source_id
      FROM crewcast.search_jobs AS jobs
      WHERE jobs.apify_run_id = ${providerRunId}

      UNION ALL

      SELECT 'enrichment_dispatch'::text, dispatches.id::text
      FROM crewcast.search_enrichment_dispatches AS dispatches
      WHERE dispatches.provider_run_id = ${providerRunId}
        AND (
          ${reconciliationCase.dispatchId}::bigint IS NULL
          OR dispatches.id <> ${reconciliationCase.dispatchId}::bigint
        )

      UNION ALL

      SELECT 'onboarding_entitlement'::text, entitlements.user_id::text
      FROM crewcast.onboarding_search_entitlements AS entitlements
      WHERE entitlements.provider_run_id = ${providerRunId}

      UNION ALL

      SELECT 'resolved_reconciliation_case'::text, cases.id::text
      FROM crewcast.search_reconciliation_cases AS cases
      WHERE cases.provider_run_id = ${providerRunId}
        AND cases.id <> ${reconciliationCase.id}::bigint
    ) AS existing_attributions
    LIMIT 2
  `;
  if (conflicts.length > 0) {
    throw new ReconciliationConflictError(
      'This provider run is already attributed to another search.',
    );
  }
}

async function repairEnrichmentCase(
  transaction: SqlClient,
  reconciliationCase: SearchReconciliationCase,
  input: ResolveReconciliationInput,
  operator: SearchReconciliationOperator,
): Promise<void> {
  if (!reconciliationCase.searchJobId || !reconciliationCase.dispatchId) {
    throw new ReconciliationInputError('The enrichment case has no source identifiers.');
  }
  const jobs = await transaction<{ status: string; enrichment_status: string | null }[]>`
    SELECT status, enrichment_status
    FROM crewcast.search_jobs
    WHERE id = ${reconciliationCase.searchJobId}
      AND user_id = ${reconciliationCase.accountId}
      AND brand_id = ${reconciliationCase.brandId}::bigint
      AND brand_location_id = ${reconciliationCase.brandLocationId}::bigint
    LIMIT 2
    FOR UPDATE
  `;
  if (jobs.length !== 1) {
    throw new ReconciliationConflictError('The blocked search job is unavailable.');
  }

  if (input.action === 'cancel_and_refund') {
    if (['done', 'failed', 'timeout'].includes(jobs[0].status)) {
      throw new ReconciliationConflictError('The search job is already terminal.');
    }
    const releaseOutcome = await releaseTopicSearchCreditReservation(transaction, {
      accountId: reconciliationCase.accountId,
      id: reconciliationCase.searchJobId,
    });
    if (releaseOutcome !== 'released') {
      throw new ReconciliationConflictError(
        'The reserved topic-search credit could not be proven and refunded exactly once.',
      );
    }
    await transaction`
      UPDATE crewcast.search_jobs
      SET
        status = 'failed',
        enrichment_status = 'failed',
        completed_at = NOW(),
        error_message = 'Cancelled by support after an ambiguous provider launch.'
      WHERE id = ${reconciliationCase.searchJobId}
        AND user_id = ${reconciliationCase.accountId}
    `;
    const openCases = await transaction<{ id: string }[]>`
      SELECT id::text AS id
      FROM crewcast.search_reconciliation_cases
      WHERE search_job_id = ${reconciliationCase.searchJobId}
        AND user_id = ${reconciliationCase.accountId}
        AND status = 'open'
      ORDER BY id
      FOR UPDATE
    `;
    await resolveRows(transaction, openCases.map((row) => row.id), input, operator);
    return;
  }

  const dispatches = await transaction<{
    status: string;
    provider_run_id: string | null;
    launch_attempted_at: Date | null;
  }[]>`
    SELECT status, provider_run_id, launch_attempted_at
    FROM crewcast.search_enrichment_dispatches
    WHERE id = ${reconciliationCase.dispatchId}::bigint
      AND user_id = ${reconciliationCase.accountId}
      AND search_job_id = ${reconciliationCase.searchJobId}
      AND brand_id = ${reconciliationCase.brandId}::bigint
      AND brand_location_id = ${reconciliationCase.brandLocationId}::bigint
    LIMIT 2
    FOR UPDATE
  `;
  if (
    dispatches.length !== 1
    || !['uncertain', 'dispatching'].includes(dispatches[0].status)
    || !dispatches[0].launch_attempted_at
  ) {
    throw new ReconciliationConflictError('The enrichment launch is no longer reconcilable.');
  }

  if (input.action === 'attach_provider_run') {
    if (!input.providerRunId) throw new ReconciliationInputError('A run ID is required.');
    if (
      dispatches[0].provider_run_id
      && dispatches[0].provider_run_id !== input.providerRunId
    ) {
      throw new ReconciliationConflictError('The dispatch already references another run.');
    }
    await assertProviderRunIsNotAttributedElsewhere(
      transaction,
      reconciliationCase,
      input.providerRunId,
    );
    await transaction`
      UPDATE crewcast.search_enrichment_dispatches
      SET
        status = 'running',
        provider_run_id = ${input.providerRunId},
        dispatched_at = COALESCE(dispatched_at, NOW()),
        error_message = NULL,
        updated_at = NOW()
      WHERE id = ${reconciliationCase.dispatchId}::bigint
        AND status IN ('uncertain', 'dispatching')
    `;
  } else {
    if (dispatches[0].provider_run_id) {
      throw new ReconciliationConflictError(
        'A recorded provider run cannot be closed as no-run.',
      );
    }
    await transaction`
      UPDATE crewcast.search_enrichment_dispatches
      SET
        status = 'failed',
        error_message = ${`Operator confirmed no provider run: ${input.note}`.slice(0, 2_000)},
        updated_at = NOW()
      WHERE id = ${reconciliationCase.dispatchId}::bigint
        AND status IN ('uncertain', 'dispatching')
    `;
  }

  await refreshReconciledEnrichmentSetup(transaction, {
    accountId: reconciliationCase.accountId,
    jobId: reconciliationCase.searchJobId,
    brandId: reconciliationCase.brandId,
    brandLocationId: reconciliationCase.brandLocationId,
  });
  await resolveRows(transaction, [reconciliationCase.id], input, operator);
}

async function repairOnboardingCase(
  transaction: SqlClient,
  reconciliationCase: SearchReconciliationCase,
  input: ResolveReconciliationInput,
  operator: SearchReconciliationOperator,
): Promise<void> {
  if (!reconciliationCase.requestId || !reconciliationCase.settingsSnapshot) {
    throw new ReconciliationInputError('The onboarding case has no immutable request.');
  }
  const entitlements = await transaction<{
    status: string;
    request_id: string;
    provider_run_id: string | null;
    settings_snapshot: unknown;
  }[]>`
    SELECT
      status,
      request_id::text AS request_id,
      provider_run_id,
      settings_snapshot
    FROM crewcast.onboarding_search_entitlements
    WHERE user_id = ${reconciliationCase.accountId}
      AND brand_id = ${reconciliationCase.brandId}::bigint
      AND brand_location_id = ${reconciliationCase.brandLocationId}::bigint
    LIMIT 2
    FOR UPDATE
  `;
  if (
    entitlements.length !== 1
    || entitlements[0].status !== 'uncertain'
    || entitlements[0].request_id !== reconciliationCase.requestId
  ) {
    throw new ReconciliationConflictError('The onboarding launch is no longer uncertain.');
  }

  if (input.action === 'confirm_no_run') {
    if (entitlements[0].provider_run_id) {
      throw new ReconciliationConflictError('A recorded provider run cannot be reset.');
    }
    await transaction`
      UPDATE crewcast.onboarding_search_entitlements
      SET
        request_id = NULL,
        search_job_id = NULL,
        settings_snapshot = NULL,
        status = 'available',
        claimed_at = NULL,
        claim_expires_at = NULL,
        launch_attempted_at = NULL,
        provider_run_id = NULL,
        consumed_at = NULL,
        uncertain_at = NULL,
        error_message = NULL,
        updated_at = NOW()
      WHERE user_id = ${reconciliationCase.accountId}
        AND status = 'uncertain'
        AND request_id = ${reconciliationCase.requestId}::uuid
    `;
    await resolveRows(transaction, [reconciliationCase.id], input, operator);
    return;
  }

  if (!input.providerRunId) throw new ReconciliationInputError('A run ID is required.');
  await assertProviderRunIsNotAttributedElsewhere(
    transaction,
    reconciliationCase,
    input.providerRunId,
  );
  const snapshot = parseReconciliationSettingsSnapshot(entitlements[0].settings_snapshot);
  if (
    snapshot.brand.id !== reconciliationCase.brandId
    || snapshot.location.id !== reconciliationCase.brandLocationId
    || snapshot.search.requestId !== reconciliationCase.requestId
  ) {
    throw new ReconciliationConflictError('The onboarding snapshot no longer matches the case.');
  }
  const userSettings = {
    targetCountry: snapshot.location.countryName,
    targetLanguage: snapshot.location.languageName,
    userBrand: snapshot.brand.normalizedDomain ?? snapshot.brand.name,
    topics: snapshot.search.keywords,
    competitors: snapshot.search.competitors,
    isOnboarding: true,
  };
  const inserted = await transaction<{ id: number }[]>`
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
    ) VALUES (
      ${reconciliationCase.accountId},
      ${snapshot.search.keywords.join(' | ')},
      ${snapshot.search.sources},
      ${input.providerRunId},
      'running',
      ${transaction.json(postgresJson(userSettings))},
      ${reconciliationCase.brandId}::bigint,
      ${reconciliationCase.brandLocationId}::bigint,
      ${transaction.json(postgresJson(snapshot))},
      ${reconciliationCase.requestId}::uuid
    )
    ON CONFLICT (user_id, request_id) WHERE request_id IS NOT NULL DO NOTHING
    RETURNING id
  `;
  if (inserted.length !== 1) {
    throw new ReconciliationConflictError('The onboarding job could not be attached exactly once.');
  }
  const consumed = await transaction<{ user_id: number }[]>`
    UPDATE crewcast.onboarding_search_entitlements
    SET
      search_job_id = ${inserted[0].id},
      provider_run_id = ${input.providerRunId},
      status = 'consumed',
      consumed_at = NOW(),
      uncertain_at = NULL,
      error_message = NULL,
      updated_at = NOW()
    WHERE user_id = ${reconciliationCase.accountId}
      AND request_id = ${reconciliationCase.requestId}::uuid
      AND status = 'uncertain'
    RETURNING user_id
  `;
  if (consumed.length !== 1) {
    throw new ReconciliationConflictError('The onboarding entitlement was not consumed once.');
  }
  await resolveRows(transaction, [reconciliationCase.id], input, operator);
}

async function repairPaidSearchCase(
  transaction: SqlClient,
  reconciliationCase: SearchReconciliationCase,
  input: ResolveReconciliationInput,
  operator: SearchReconciliationOperator,
): Promise<void> {
  if (!reconciliationCase.requestId || !reconciliationCase.settingsSnapshot) {
    throw new ReconciliationInputError('The paid-search case has no immutable request.');
  }
  const reservations = await transaction<{
    status: string;
    request_id: string;
    search_job_id: number | null;
    settings_snapshot: unknown;
  }[]>`
    SELECT
      status,
      request_id::text AS request_id,
      search_job_id,
      settings_snapshot
    FROM crewcast.search_credit_reservations
    WHERE user_id = ${reconciliationCase.accountId}
      AND request_id = ${reconciliationCase.requestId}::uuid
      AND brand_id = ${reconciliationCase.brandId}::bigint
      AND brand_location_id = ${reconciliationCase.brandLocationId}::bigint
    LIMIT 2
    FOR UPDATE
  `;
  if (
    reservations.length !== 1
    || reservations[0].status !== 'uncertain'
    || reservations[0].request_id !== reconciliationCase.requestId
    || reservations[0].search_job_id !== null
  ) {
    throw new ReconciliationConflictError('The paid search launch is no longer uncertain.');
  }

  if (input.action === 'confirm_no_run') {
    await releaseUncertainSearchCredit(
      transaction as unknown as SearchStartSqlExecutor,
      reconciliationCase.accountId,
      reconciliationCase.requestId,
    );
    await resolveRows(transaction, [reconciliationCase.id], input, operator);
    return;
  }

  if (!input.providerRunId) throw new ReconciliationInputError('A run ID is required.');
  await assertProviderRunIsNotAttributedElsewhere(
    transaction,
    reconciliationCase,
    input.providerRunId,
  );
  const snapshot = parseReconciliationSettingsSnapshot(
    reservations[0].settings_snapshot,
    'paid_search',
  );
  if (
    snapshot.brand.id !== reconciliationCase.brandId
    || snapshot.location.id !== reconciliationCase.brandLocationId
    || snapshot.search.requestId !== reconciliationCase.requestId
  ) {
    throw new ReconciliationConflictError('The paid-search snapshot no longer matches the case.');
  }

  const restored = await transaction<{ id: unknown }[]>`
    UPDATE crewcast.search_credit_reservations
    SET
      status = 'reserved',
      uncertain_at = NULL,
      error_message = NULL,
      updated_at = NOW()
    WHERE user_id = ${reconciliationCase.accountId}
      AND request_id = ${reconciliationCase.requestId}::uuid
      AND status = 'uncertain'
      AND search_job_id IS NULL
    RETURNING id
  `;
  if (restored.length !== 1) {
    throw new ReconciliationConflictError('The paid-search reservation was not restored once.');
  }

  const job = await persistSearchJobIfActive(
    transaction as unknown as SearchStartSqlExecutor,
    {
      accountId: reconciliationCase.accountId,
      brandId: reconciliationCase.brandId,
      brandLocationId: reconciliationCase.brandLocationId,
      combinedKeyword: snapshot.search.keywords.join(' | '),
      sources: snapshot.search.sources,
      runId: input.providerRunId,
      requestId: reconciliationCase.requestId,
      reservationKind: 'credit',
      userSettings: {
        targetCountry: snapshot.location.countryName,
        targetLanguage: snapshot.location.languageName,
        userBrand: snapshot.brand.normalizedDomain ?? snapshot.brand.name,
        topics: snapshot.search.keywords,
        competitors: snapshot.search.competitors,
      },
      settingsSnapshot: snapshot,
    },
  );
  if (!job || !job.created || job.runId !== input.providerRunId) {
    throw new ReconciliationConflictError('The paid search job could not be attached exactly once.');
  }
  await resolveRows(transaction, [reconciliationCase.id], input, operator);
}

export async function resolveSearchReconciliationCase(
  caseId: string,
  input: ResolveReconciliationInput,
  operator: SearchReconciliationOperator,
  verifiedRun: VerifiedProviderRun | null,
  database: SqlClient = sql as SqlClient,
): Promise<SearchReconciliationCase> {
  if (input.action === 'attach_provider_run') {
    if (!verifiedRun || verifiedRun.id !== input.providerRunId) {
      throw new ReconciliationInputError('The provider run was not verified.');
    }
  } else if (verifiedRun) {
    throw new ReconciliationInputError('A provider run is not valid for this action.');
  }

  return withReconciliationTransaction(database, async (transaction) => {
    await establishOperatorContext(transaction, operator);
    const reconciliationCase = await readCase(transaction, caseId, true);
    if (!reconciliationCase) throw new ReconciliationInputError('Case not found.');
    assertActionAllowed(reconciliationCase, input);

    if (reconciliationCase.caseType === 'enrichment_dispatch') {
      await repairEnrichmentCase(transaction, reconciliationCase, input, operator);
    } else if (reconciliationCase.caseType === 'onboarding_search') {
      await repairOnboardingCase(transaction, reconciliationCase, input, operator);
    } else {
      await repairPaidSearchCase(transaction, reconciliationCase, input, operator);
    }
    const resolved = await readCase(transaction, caseId);
    if (!resolved || resolved.status !== 'resolved') {
      throw new Error('The reconciliation case did not reach a resolved state.');
    }
    return resolved;
  });
}
