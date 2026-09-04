import type {
  OnboardingSearchEntitlementStatus,
  ReserveOnboardingSearchInput,
  ReserveOnboardingSearchResult,
  SearchSettingsSnapshot,
} from '@/lib/search/start';
import {
  withSearchStartTransaction,
  type SearchStartSqlExecutor,
} from '@/lib/search/start-postgres';

interface AccountRow {
  is_onboarded: unknown;
}

interface SubscriptionRow {
  stripe_subscription_id: unknown;
  status: unknown;
}

interface EntitlementRow {
  status: unknown;
  request_id: unknown;
  search_job_id: unknown;
  settings_snapshot: unknown;
  brand_id: unknown;
  brand_location_id: unknown;
  claim_expired: unknown;
}

function readStatus(value: unknown): OnboardingSearchEntitlementStatus {
  if (
    value !== 'available'
    && value !== 'reserved'
    && value !== 'dispatching'
    && value !== 'consumed'
    && value !== 'uncertain'
  ) {
    throw new Error('Onboarding-search entitlement status is invalid.');
  }
  return value;
}

function readBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${field} is not a boolean.`);
  return value;
}

function readBigint(value: unknown, field: string): string {
  const normalized = typeof value === 'number' ? String(value) : value;
  if (typeof normalized !== 'string' || !/^[1-9][0-9]*$/.test(normalized)) {
    throw new Error(`${field} is not a positive PostgreSQL bigint.`);
  }
  return normalized;
}

function readOptionalRequestId(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (
    typeof value !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw new Error('Onboarding-search request ID is invalid.');
  }
  return value.toLowerCase();
}

function readOptionalJobId(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error('Onboarding-search job ID is invalid.');
  }
  return parsed;
}

function readOptionalSnapshot(value: unknown): SearchSettingsSnapshot | null {
  if (value === null || value === undefined) return null;
  let parsed: unknown = value;
  if (typeof parsed === 'string') parsed = JSON.parse(parsed) as unknown;
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Onboarding-search settings snapshot is invalid.');
  }
  return parsed as SearchSettingsSnapshot;
}

function mapExisting(row: EntitlementRow): ReserveOnboardingSearchResult {
  return {
    outcome: 'existing',
    status: readStatus(row.status),
    requestId: readOptionalRequestId(row.request_id),
    searchJobId: readOptionalJobId(row.search_job_id),
    settingsSnapshot: readOptionalSnapshot(row.settings_snapshot),
  };
}

async function loadEntitlement(
  transaction: SearchStartSqlExecutor,
  accountId: number,
): Promise<EntitlementRow | null> {
  const rows = await transaction<EntitlementRow>`
    SELECT
      status,
      request_id::text AS request_id,
      search_job_id,
      settings_snapshot,
      brand_id::text AS brand_id,
      brand_location_id::text AS brand_location_id,
      COALESCE(claim_expires_at <= NOW(), false) AS claim_expired
    FROM crewcast.onboarding_search_entitlements
    WHERE user_id = ${accountId}
    LIMIT 2
    FOR UPDATE
  `;
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error('An account matched more than one onboarding-search entitlement.');
  }
  return rows[0];
}

/**
 * Claims the one account-level free onboarding search before any paid provider
 * call. Account, subscription and entitlement locks use the same order as the
 * onboarding transaction, closing cancellation and retry races.
 */
export async function reserveOnboardingSearch(
  executor: SearchStartSqlExecutor,
  input: ReserveOnboardingSearchInput,
): Promise<ReserveOnboardingSearchResult> {
  return withSearchStartTransaction(executor, async (transaction) => {
    const accounts = await transaction<AccountRow>`
      SELECT is_onboarded
      FROM crewcast.users
      WHERE id = ${input.accountId}
      LIMIT 2
      FOR UPDATE
    `;
    if (accounts.length !== 1 || accounts[0].is_onboarded !== true) {
      return {
        outcome: 'unavailable',
        code: 'ACCOUNT_ONBOARDING_REQUIRED',
        status: 409,
        message: 'Complete onboarding before starting the free onboarding search.',
      };
    }

    const subscriptions = await transaction<SubscriptionRow>`
      SELECT stripe_subscription_id, status
      FROM crewcast.subscriptions
      WHERE user_id = ${input.accountId}
      ORDER BY id
      LIMIT 2
      FOR UPDATE
    `;
    if (
      subscriptions.length !== 1
      || typeof subscriptions[0].stripe_subscription_id !== 'string'
      || subscriptions[0].stripe_subscription_id.trim() === ''
      || !['active', 'trialing'].includes(String(subscriptions[0].status))
    ) {
      return {
        outcome: 'unavailable',
        code: 'SUBSCRIPTION_REQUIRED',
        status: 402,
        message: 'An active or trialing subscription is required for the onboarding search.',
      };
    }

    // The account lock above is also the first management-operation lock. The
    // row locks below close the remaining lifecycle race so an archive cannot
    // pass while this entitlement is being reserved for paid provider work.
    const contexts = await transaction<{ brand_id: unknown }>`
      SELECT brands.id AS brand_id
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
      LIMIT 2
      FOR KEY SHARE OF brands, locations
    `;
    if (contexts.length !== 1) {
      return {
        outcome: 'unavailable',
        code: 'ONBOARDING_SEARCH_UNAVAILABLE',
        status: 409,
        message: 'The onboarding brand location is no longer active.',
      };
    }

    const entitlement = await loadEntitlement(transaction, input.accountId);
    if (!entitlement) {
      return {
        outcome: 'unavailable',
        code: 'ONBOARDING_SEARCH_UNAVAILABLE',
        status: 409,
        message: 'No free onboarding search is available for this account.',
      };
    }

    const status = readStatus(entitlement.status);
    const reclaimable = status === 'reserved'
      && readBoolean(entitlement.claim_expired, 'claim_expired');
    if (status === 'available' || reclaimable) {
      if (
        readBigint(entitlement.brand_id, 'entitlement.brand_id') !== input.brandId
        || readBigint(
          entitlement.brand_location_id,
          'entitlement.brand_location_id',
        ) !== input.brandLocationId
      ) {
        return {
          outcome: 'unavailable',
          code: 'ONBOARDING_SEARCH_UNAVAILABLE',
          status: 409,
          message: 'The free onboarding search belongs to a different brand location.',
        };
      }

      const claimed = await transaction<{ user_id: unknown }>`
        UPDATE crewcast.onboarding_search_entitlements
        SET
          request_id = ${input.requestId}::uuid,
          settings_snapshot = ${input.settingsSnapshot}::jsonb,
          status = 'reserved',
          claimed_at = NOW(),
          claim_expires_at = NOW() + INTERVAL '5 minutes',
          launch_attempted_at = NULL,
          provider_run_id = NULL,
          consumed_at = NULL,
          uncertain_at = NULL,
          error_message = NULL,
          updated_at = NOW()
        WHERE user_id = ${input.accountId}
          AND brand_id = ${input.brandId}::bigint
          AND brand_location_id = ${input.brandLocationId}::bigint
          AND (
            status = 'available'
            OR (
              status = 'reserved'
              AND claim_expires_at <= NOW()
              AND launch_attempted_at IS NULL
            )
          )
        RETURNING user_id
      `;
      if (claimed.length !== 1) {
        throw new Error('The onboarding-search entitlement was not reserved exactly once.');
      }
      return { outcome: 'reserved' };
    }

    return mapExisting(entitlement);
  });
}

export async function markOnboardingLaunchAttempted(
  executor: SearchStartSqlExecutor,
  accountId: number,
  requestId: string,
): Promise<void> {
  const rows = await executor<{ user_id: unknown }>`
    UPDATE crewcast.onboarding_search_entitlements
    SET
      status = 'dispatching',
      claim_expires_at = NULL,
      launch_attempted_at = NOW(),
      updated_at = NOW()
    WHERE user_id = ${accountId}
      AND request_id = ${requestId}::uuid
      AND status = 'reserved'
      AND claim_expires_at > NOW()
      AND launch_attempted_at IS NULL
    RETURNING user_id
  `;
  if (rows.length !== 1) {
    throw new Error('The onboarding-search launch intent was not recorded exactly once.');
  }
}

export async function releaseOnboardingSearch(
  executor: SearchStartSqlExecutor,
  accountId: number,
  requestId: string,
): Promise<void> {
  const rows = await executor<{ user_id: unknown }>`
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
    WHERE user_id = ${accountId}
      AND request_id = ${requestId}::uuid
      AND status IN ('reserved', 'dispatching')
      AND search_job_id IS NULL
    RETURNING user_id
  `;
  if (rows.length === 1) return;

  const current = await executor<{ status: unknown; request_id: unknown }>`
    SELECT status, request_id::text AS request_id
    FROM crewcast.onboarding_search_entitlements
    WHERE user_id = ${accountId}
    LIMIT 2
  `;
  if (
    current.length === 1
    && current[0].status === 'available'
    && current[0].request_id === null
  ) {
    return;
  }
  throw new Error('The onboarding-search entitlement could not be released safely.');
}

export async function markOnboardingSearchUncertain(
  executor: SearchStartSqlExecutor,
  accountId: number,
  requestId: string,
  rawMessage: string,
): Promise<void> {
  const message = rawMessage.trim().slice(0, 2_000)
    || 'Unknown onboarding-search launch failure';
  const rows = await executor<{ user_id: unknown }>`
    UPDATE crewcast.onboarding_search_entitlements
    SET
      status = 'uncertain',
      uncertain_at = NOW(),
      error_message = ${message},
      updated_at = NOW()
    WHERE user_id = ${accountId}
      AND request_id = ${requestId}::uuid
      AND status = 'dispatching'
      AND launch_attempted_at IS NOT NULL
    RETURNING user_id
  `;
  if (rows.length === 1) return;

  const current = await executor<{ status: unknown; request_id: unknown }>`
    SELECT status, request_id::text AS request_id
    FROM crewcast.onboarding_search_entitlements
    WHERE user_id = ${accountId}
    LIMIT 2
  `;
  if (
    current.length === 1
    && current[0].status === 'uncertain'
    && current[0].request_id === requestId
  ) {
    return;
  }
  throw new Error('The onboarding-search entitlement could not be marked uncertain.');
}
