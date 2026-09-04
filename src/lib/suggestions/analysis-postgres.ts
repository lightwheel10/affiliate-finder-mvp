import 'server-only';

import { sql } from '@/lib/db';
import type {
  SuggestionAnalysisClaim,
  SuggestionAnalysisClaimInput,
} from '@/lib/suggestions/analysis';
import {
  suggestionAnalysisResultSchema,
  type SuggestionAnalysisResult,
} from '@/lib/suggestions/result';

export interface SuggestionAnalysisSqlExecutor {
  <T extends object = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<readonly T[]>;
  begin?<T>(
    callback: (transaction: SuggestionAnalysisSqlExecutor) => Promise<T>,
  ): Promise<T>;
  savepoint?<T>(
    callback: (transaction: SuggestionAnalysisSqlExecutor) => Promise<T>,
  ): Promise<T>;
}

interface AccountRow {
  is_onboarded: unknown;
}

interface AnalysisRow {
  request_id: unknown;
  input_hash: unknown;
  status: unknown;
  result: unknown;
  claim_expired?: unknown;
}

interface IdentityGuardRow {
  auth_user_id: unknown;
}

function withTransaction<T>(
  executor: SuggestionAnalysisSqlExecutor,
  callback: (transaction: SuggestionAnalysisSqlExecutor) => Promise<T>,
): Promise<T> {
  if (typeof executor.begin === 'function') return executor.begin(callback);
  if (typeof executor.savepoint === 'function') return executor.savepoint(callback);
  throw new Error('Suggestion analysis requires a transaction-capable SQL executor.');
}

function readString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Suggestion analysis ${field} is invalid.`);
  }
  return value;
}

function readCachedResult(value: unknown): SuggestionAnalysisResult {
  let candidate = value;
  if (typeof candidate === 'string') candidate = JSON.parse(candidate) as unknown;
  const parsed = suggestionAnalysisResultSchema.safeParse(candidate);
  if (!parsed.success) throw new Error('Cached suggestion analysis result is invalid.');
  return parsed.data;
}

function readBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`Suggestion analysis ${field} is invalid.`);
  }
  return value;
}

function mapExistingAnalysis(
  row: AnalysisRow,
  requestedHash: string,
): SuggestionAnalysisClaim {
  const storedHash = readString(row.input_hash, 'input hash');
  const status = readString(row.status, 'status');
  readString(row.request_id, 'request identifier');

  if (storedHash !== requestedHash) {
    return { outcome: 'blocked', reason: 'already_used' };
  }
  if (status === 'completed') {
    return { outcome: 'cached', result: readCachedResult(row.result) };
  }
  if (status === 'reserved' || status === 'running') {
    return { outcome: 'blocked', reason: 'in_progress' };
  }
  if (status === 'failed') {
    return { outcome: 'blocked', reason: 'already_used' };
  }
  throw new Error('Suggestion analysis status is invalid.');
}

/**
 * Serializes on the application-account row, then creates at most one durable
 * provider-spend record for the account. This is the database enforcement
 * boundary; process-local locks would not protect parallel Vercel instances.
 */
export async function claimOnboardingSuggestionAnalysis(
  input: SuggestionAnalysisClaimInput,
  executor: SuggestionAnalysisSqlExecutor = sql as SuggestionAnalysisSqlExecutor,
): Promise<SuggestionAnalysisClaim> {
  return withTransaction(executor, async (transaction) => {
    const accounts = await transaction<AccountRow>`
      SELECT is_onboarded
      FROM crewcast.users
      WHERE id = ${input.accountId}
      LIMIT 2
      FOR UPDATE
    `;
    if (accounts.length !== 1 || accounts[0].is_onboarded !== false) {
      return { outcome: 'blocked', reason: 'account_not_eligible' };
    }

    const existing = await transaction<AnalysisRow>`
      SELECT
        request_id::text AS request_id,
        input_hash,
        status,
        result,
        COALESCE(claim_expires_at <= NOW(), false) AS claim_expired
      FROM crewcast.onboarding_suggestion_analyses
      WHERE user_id = ${input.accountId}
      LIMIT 2
      FOR UPDATE
    `;
    if (existing.length > 1) {
      throw new Error('An account matched more than one onboarding suggestion analysis.');
    }
    if (existing.length === 1) {
      const guards = await transaction<IdentityGuardRow>`
        SELECT auth_user_id::text AS auth_user_id
        FROM crewcast.onboarding_suggestion_identity_guards
        WHERE auth_user_id = ${input.authUserId}::uuid
        LIMIT 2
        FOR UPDATE
      `;
      if (guards.length !== 1) {
        return { outcome: 'blocked', reason: 'account_not_eligible' };
      }
      if (
        existing[0].status === 'reserved'
        && readBoolean(existing[0].claim_expired, 'claim expiry')
      ) {
        const reclaimed = await transaction<{ user_id: unknown }>`
          UPDATE crewcast.onboarding_suggestion_analyses
          SET
            request_id = ${input.requestId}::uuid,
            input_hash = ${input.inputHash},
            input_snapshot = ${input.inputSnapshot}::jsonb,
            claimed_at = NOW(),
            claim_expires_at = NOW() + INTERVAL '5 minutes',
            updated_at = NOW()
          WHERE user_id = ${input.accountId}
            AND status = 'reserved'
            AND claim_expires_at <= NOW()
            AND provider_started_at IS NULL
          RETURNING user_id
        `;
        if (reclaimed.length !== 1) {
          throw new Error('The expired suggestion analysis claim was not reclaimed exactly once.');
        }
        return { outcome: 'claimed' };
      }
      return mapExistingAnalysis(existing[0], input.inputHash);
    }

    // The immutable Supabase identity owns the spend allowance. This insert is
    // also the cross-account/email-rotation serialization point: if the same
    // auth identity used or is using an analysis under another application
    // account, ON CONFLICT returns no row and paid work is denied.
    const insertedGuards = await transaction<IdentityGuardRow>`
      INSERT INTO crewcast.onboarding_suggestion_identity_guards (auth_user_id)
      VALUES (${input.authUserId}::uuid)
      ON CONFLICT (auth_user_id) DO NOTHING
      RETURNING auth_user_id::text AS auth_user_id
    `;
    if (insertedGuards.length === 0) {
      return { outcome: 'blocked', reason: 'already_used' };
    }
    if (insertedGuards.length !== 1) {
      throw new Error('The suggestion identity guard was not claimed exactly once.');
    }

    const inserted = await transaction<{ user_id: unknown }>`
      INSERT INTO crewcast.onboarding_suggestion_analyses (
        user_id,
        request_id,
        input_hash,
        input_snapshot,
        status,
        claimed_at,
        claim_expires_at
      ) VALUES (
        ${input.accountId},
        ${input.requestId}::uuid,
        ${input.inputHash},
        ${input.inputSnapshot}::jsonb,
        'reserved',
        NOW(),
        NOW() + INTERVAL '5 minutes'
      )
      RETURNING user_id
    `;
    if (inserted.length !== 1) {
      throw new Error('The onboarding suggestion analysis was not claimed exactly once.');
    }
    return { outcome: 'claimed' };
  });
}

/**
 * Removes the minimal anti-replay tombstone only after Supabase confirms that
 * the corresponding auth identity itself was deleted. If Auth deletion fails,
 * callers deliberately leave this row in place so the surviving identity
 * cannot recreate an application account and buy another provider attempt.
 */
export async function deleteOnboardingSuggestionIdentityGuard(
  authUserId: string,
  executor: SuggestionAnalysisSqlExecutor = sql as SuggestionAnalysisSqlExecutor,
): Promise<boolean> {
  const rows = await executor<IdentityGuardRow>`
    DELETE FROM crewcast.onboarding_suggestion_identity_guards
    WHERE auth_user_id = ${authUserId}::uuid
    RETURNING auth_user_id::text AS auth_user_id
  `;
  if (rows.length > 1) {
    throw new Error('More than one suggestion identity guard was deleted.');
  }
  return rows.length === 1;
}

export async function markOnboardingSuggestionProvidersStarted(
  accountId: number,
  requestId: string,
  inputHash: string,
  executor: SuggestionAnalysisSqlExecutor = sql as SuggestionAnalysisSqlExecutor,
): Promise<void> {
  const rows = await executor<{ user_id: unknown }>`
    UPDATE crewcast.onboarding_suggestion_analyses
    SET
      status = 'running',
      claim_expires_at = NULL,
      provider_started_at = NOW(),
      updated_at = NOW()
    WHERE user_id = ${accountId}
      AND request_id = ${requestId}::uuid
      AND input_hash = ${inputHash}
      AND status = 'reserved'
      AND claim_expires_at > NOW()
      AND provider_started_at IS NULL
    RETURNING user_id
  `;
  if (rows.length !== 1) {
    throw new Error('Suggestion provider launch intent was not recorded exactly once.');
  }
}

export async function completeOnboardingSuggestionAnalysis(
  accountId: number,
  requestId: string,
  inputHash: string,
  result: SuggestionAnalysisResult,
  executor: SuggestionAnalysisSqlExecutor = sql as SuggestionAnalysisSqlExecutor,
): Promise<void> {
  const rows = await executor<{ user_id: unknown }>`
    UPDATE crewcast.onboarding_suggestion_analyses
    SET
      status = 'completed',
      result = ${result}::jsonb,
      completed_at = NOW(),
      updated_at = NOW()
    WHERE user_id = ${accountId}
      AND request_id = ${requestId}::uuid
      AND input_hash = ${inputHash}
      AND status = 'running'
    RETURNING user_id
  `;
  if (rows.length === 1) return;

  // A lost database acknowledgement may hide a committed update. Treat the
  // exact completed state as idempotent; every other state fails closed.
  const current = await executor<AnalysisRow & { result_matches: unknown }>`
    SELECT
      request_id::text AS request_id,
      input_hash,
      status,
      result,
      result = ${result}::jsonb AS result_matches
    FROM crewcast.onboarding_suggestion_analyses
    WHERE user_id = ${accountId}
    LIMIT 2
  `;
  if (
    current.length === 1
    && current[0].request_id === requestId
    && current[0].input_hash === inputHash
    && current[0].status === 'completed'
    && current[0].result_matches === true
  ) {
    readCachedResult(current[0].result);
    return;
  }
  throw new Error('The onboarding suggestion analysis could not be completed safely.');
}

export async function failOnboardingSuggestionAnalysis(
  accountId: number,
  requestId: string,
  inputHash: string,
  errorCode: string,
  executor: SuggestionAnalysisSqlExecutor = sql as SuggestionAnalysisSqlExecutor,
): Promise<void> {
  const rows = await executor<{ user_id: unknown }>`
    UPDATE crewcast.onboarding_suggestion_analyses
    SET
      status = 'failed',
      error_code = ${errorCode},
      failed_at = NOW(),
      updated_at = NOW()
    WHERE user_id = ${accountId}
      AND request_id = ${requestId}::uuid
      AND input_hash = ${inputHash}
      AND status = 'running'
    RETURNING user_id
  `;
  if (rows.length === 1) return;

  const current = await executor<AnalysisRow>`
    SELECT request_id::text AS request_id, input_hash, status, result
    FROM crewcast.onboarding_suggestion_analyses
    WHERE user_id = ${accountId}
    LIMIT 2
  `;
  if (
    current.length === 1
    && current[0].request_id === requestId
    && current[0].input_hash === inputHash
    && current[0].status === 'failed'
  ) return;
  throw new Error('The onboarding suggestion analysis failure could not be recorded safely.');
}
