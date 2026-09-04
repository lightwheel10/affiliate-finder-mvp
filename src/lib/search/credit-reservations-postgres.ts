import type {
  ReserveSearchCreditInput,
  ReserveSearchCreditResult,
  SearchCreditReservationStatus,
  SearchSettingsSnapshot,
} from '@/lib/search/start';
import {
  withSearchStartTransaction,
  type SearchStartSqlExecutor,
} from '@/lib/search/start-postgres';

interface CreditRow {
  id: unknown;
  topic_search_credits_total: unknown;
  topic_search_credits_used: unknown;
  topic_search_credits_topup: unknown;
  period_start: unknown;
  period_end: unknown;
}

interface ReservationRow {
  status: unknown;
  search_job_id: unknown;
  settings_snapshot: unknown;
}

function readInteger(value: unknown, field: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${field} is not a safe integer.`);
  }
  return parsed;
}

function readDate(value: unknown, field: string): Date {
  const parsed = value instanceof Date ? value : new Date(String(value));
  if (!Number.isFinite(parsed.getTime())) {
    throw new Error(`${field} is not a valid timestamp.`);
  }
  return parsed;
}

function readStatus(value: unknown): SearchCreditReservationStatus {
  if (
    value !== 'reserved'
    && value !== 'uncertain'
    && value !== 'consumed'
    && value !== 'released'
  ) {
    throw new Error('Search-credit reservation status is invalid.');
  }
  return value;
}

function readOptionalJobId(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = readInteger(value, 'search_credit_reservations.search_job_id');
  if (parsed <= 0) {
    throw new Error('search_credit_reservations.search_job_id is not positive.');
  }
  return parsed;
}

function readSnapshot(value: unknown): SearchSettingsSnapshot {
  let parsed = value;
  if (typeof parsed === 'string') parsed = JSON.parse(parsed) as unknown;
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Search-credit reservation settings snapshot is invalid.');
  }
  return parsed as SearchSettingsSnapshot;
}

function mapExistingReservation(row: ReservationRow): ReserveSearchCreditResult {
  return {
    outcome: 'existing',
    status: readStatus(row.status),
    searchJobId: readOptionalJobId(row.search_job_id),
    settingsSnapshot: readSnapshot(row.settings_snapshot),
  };
}

async function loadExistingReservation(
  transaction: SearchStartSqlExecutor,
  accountId: number,
  requestId: string,
): Promise<ReserveSearchCreditResult | null> {
  // A process can disappear after recording launch intent but before it records
  // the provider run. Never retry or refund that ambiguous launch automatically.
  await transaction`
    UPDATE crewcast.search_credit_reservations
    SET
      status = 'uncertain',
      uncertain_at = NOW(),
      error_message = COALESCE(
        error_message,
        'Provider launch intent became stale without a recorded search job.'
      ),
      updated_at = NOW()
    WHERE user_id = ${accountId}
      AND request_id = ${requestId}::uuid
      AND status = 'reserved'
      AND search_job_id IS NULL
      AND launch_attempted_at < NOW() - INTERVAL '3 minutes'
  `;

  const rows = await transaction<ReservationRow>`
    SELECT status, search_job_id, settings_snapshot
    FROM crewcast.search_credit_reservations
    WHERE user_id = ${accountId}
      AND request_id = ${requestId}::uuid
    LIMIT 2
    FOR UPDATE
  `;
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error('A search request matched more than one credit reservation.');
  }
  return mapExistingReservation(rows[0]);
}

/**
 * Commits provider-launch intent before the external request. If this process
 * disappears afterwards, the held credit can be reconciled without launching
 * the same paid work a second time.
 */
export async function markSearchLaunchAttempted(
  executor: SearchStartSqlExecutor,
  accountId: number,
  requestId: string,
): Promise<void> {
  const rows = await executor<{ id: unknown }>`
    UPDATE crewcast.search_credit_reservations
    SET
      launch_attempted_at = NOW(),
      updated_at = NOW()
    WHERE user_id = ${accountId}
      AND request_id = ${requestId}::uuid
      AND status = 'reserved'
      AND search_job_id IS NULL
      AND launch_attempted_at IS NULL
    RETURNING id
  `;
  if (rows.length !== 1) {
    throw new Error('The search-credit launch intent was not recorded exactly once.');
  }
}

/** Marks an ambiguous paid-provider start for operator-only reconciliation. */
export async function markSearchUncertain(
  executor: SearchStartSqlExecutor,
  accountId: number,
  requestId: string,
  message: string,
): Promise<void> {
  await withSearchStartTransaction(executor, async (transaction) => {
    const rows = await transaction<{ id: unknown }>`
      UPDATE crewcast.search_credit_reservations
      SET
        status = 'uncertain',
        uncertain_at = NOW(),
        error_message = ${message.slice(0, 2_000)},
        updated_at = NOW()
      WHERE user_id = ${accountId}
        AND request_id = ${requestId}::uuid
        AND status = 'reserved'
        AND search_job_id IS NULL
        AND launch_attempted_at IS NOT NULL
      RETURNING id
    `;
    if (rows.length === 1) return;

    const existing = await transaction<{ status: unknown }>`
      SELECT status
      FROM crewcast.search_credit_reservations
      WHERE user_id = ${accountId}
        AND request_id = ${requestId}::uuid
      LIMIT 2
      FOR UPDATE
    `;
    if (existing.length === 1 && readStatus(existing[0].status) === 'uncertain') {
      return;
    }
    throw new Error('The ambiguous search launch was not recorded exactly once.');
  });
}

/**
 * Converts abandoned launch intents into durable review cases. Time passing
 * cannot fire a database trigger, so operator listing calls this bounded sweep.
 */
export async function promoteStaleSearchLaunches(
  executor: SearchStartSqlExecutor,
  accountId: number | null = null,
): Promise<number> {
  const rows = await executor<{ id: unknown }>`
    UPDATE crewcast.search_credit_reservations
    SET
      status = 'uncertain',
      uncertain_at = NOW(),
      error_message = COALESCE(
        error_message,
        'Provider launch intent became stale without a recorded search job.'
      ),
      updated_at = NOW()
    WHERE status = 'reserved'
      AND search_job_id IS NULL
      AND launch_attempted_at < NOW() - INTERVAL '3 minutes'
      AND (${accountId}::integer IS NULL OR user_id = ${accountId})
    RETURNING id
  `;
  return rows.length;
}

/**
 * Atomically claims one topic-search credit before any paid provider launch.
 * The account credit row is the serialization lock for both distinct and
 * duplicate requests, so concurrent calls cannot spend the same balance.
 */
export async function reserveSearchCredit(
  executor: SearchStartSqlExecutor,
  input: ReserveSearchCreditInput,
): Promise<ReserveSearchCreditResult> {
  return withSearchStartTransaction(executor, async (transaction) => {
    // Management archival takes an UPDATE lock on these same rows before it
    // checks for active reservations. Holding KEY SHARE here makes archival
    // and reservation serialize: either the reservation commits first and
    // archival sees it, or archival commits first and this lookup returns no
    // active context. A paid provider is never launched into that race.
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
      throw new Error('The selected brand location is no longer active.');
    }

    const creditRows = await transaction<CreditRow>`
      SELECT
        id,
        topic_search_credits_total,
        topic_search_credits_used,
        topic_search_credits_topup,
        period_start::text AS period_start,
        period_end
      FROM crewcast.user_credits
      WHERE user_id = ${input.accountId}
      LIMIT 2
      FOR UPDATE
    `;
    if (creditRows.length === 0) {
      return {
        outcome: 'insufficient',
        message: 'No active subscription. Please subscribe to continue.',
      };
    }
    if (creditRows.length !== 1) {
      throw new Error('An account matched more than one credit balance row.');
    }

    const existing = await loadExistingReservation(
      transaction,
      input.accountId,
      input.requestId,
    );
    if (existing) return existing;

    const credits = creditRows[0];
    const creditRowId = readInteger(credits.id, 'user_credits.id');
    readDate(credits.period_start, 'user_credits.period_start');
    const periodEnd = readDate(credits.period_end, 'user_credits.period_end');
    if (periodEnd.getTime() <= Date.now()) {
      return {
        outcome: 'insufficient',
        message: 'Subscription period has ended. Please renew to continue.',
      };
    }

    const total = readInteger(
      credits.topic_search_credits_total,
      'user_credits.topic_search_credits_total',
    );
    const used = readInteger(
      credits.topic_search_credits_used,
      'user_credits.topic_search_credits_used',
    );
    const topup = readInteger(
      credits.topic_search_credits_topup,
      'user_credits.topic_search_credits_topup',
    );
    if (used < 0 || topup < 0 || total < -1) {
      throw new Error('The topic-search credit balance is internally inconsistent.');
    }

    const subscriptionRemaining = total === -1 ? 1 : Math.max(0, total - used);
    const subscriptionCreditsConsumed = Math.min(1, subscriptionRemaining);
    const topupCreditsConsumed = 1 - subscriptionCreditsConsumed;
    if (total !== -1 && subscriptionRemaining + topup < 1) {
      return {
        outcome: 'insufficient',
        message: 'Insufficient topic search credits. You have 0 remaining.',
      };
    }

    await transaction`
      INSERT INTO crewcast.search_credit_reservations (
        user_id,
        request_id,
        brand_id,
        brand_location_id,
        settings_snapshot,
        credit_period_start,
        subscription_credits_consumed,
        topup_credits_consumed
      )
      SELECT
        ${input.accountId},
        ${input.requestId}::uuid,
        ${input.brandId}::bigint,
        ${input.brandLocationId}::bigint,
        ${input.settingsSnapshot}::jsonb,
        credits.period_start,
        ${subscriptionCreditsConsumed},
        ${topupCreditsConsumed}
      FROM crewcast.user_credits AS credits
      WHERE credits.id = ${creditRowId}
        AND credits.user_id = ${input.accountId}
    `;

    const updated = await transaction<{ id: unknown }>`
      UPDATE crewcast.user_credits
      SET
        topic_search_credits_used = topic_search_credits_used
          + ${subscriptionCreditsConsumed},
        topic_search_credits_topup = topic_search_credits_topup
          - ${topupCreditsConsumed},
        updated_at = NOW()
      WHERE id = ${creditRowId}
        AND user_id = ${input.accountId}
        AND period_end > NOW()
        AND topic_search_credits_topup >= ${topupCreditsConsumed}
      RETURNING id
    `;
    if (updated.length !== 1) {
      throw new Error('The locked topic-search credit balance changed unexpectedly.');
    }

    return { outcome: 'reserved' };
  });
}

/** Release a reservation when no billable search job can complete. */
export async function releaseSearchCredit(
  executor: SearchStartSqlExecutor,
  accountId: number,
  requestId: string,
): Promise<void> {
  await withSearchStartTransaction(executor, async (transaction) => {
    const creditRows = await transaction<{ id: unknown }>`
      SELECT id
      FROM crewcast.user_credits
      WHERE user_id = ${accountId}
      LIMIT 2
      FOR UPDATE
    `;
    if (creditRows.length !== 1) {
      throw new Error('The search-credit reservation owner has no unique credit balance.');
    }

    const reservations = await transaction<{
      id: unknown;
      status: unknown;
      subscription_credits_consumed: unknown;
      topup_credits_consumed: unknown;
    }>`
      SELECT
        id,
        status,
        subscription_credits_consumed,
        topup_credits_consumed
      FROM crewcast.search_credit_reservations
      WHERE user_id = ${accountId}
        AND request_id = ${requestId}::uuid
      LIMIT 2
      FOR UPDATE
    `;
    if (reservations.length !== 1) {
      throw new Error('The search request has no unique credit reservation to release.');
    }
    const reservation = reservations[0];
    if (readStatus(reservation.status) !== 'reserved') return;

    const subscriptionCredits = readInteger(
      reservation.subscription_credits_consumed,
      'search_credit_reservations.subscription_credits_consumed',
    );
    const topupCredits = readInteger(
      reservation.topup_credits_consumed,
      'search_credit_reservations.topup_credits_consumed',
    );
    const reservationId = readInteger(
      reservation.id,
      'search_credit_reservations.id',
    );

    const restored = await transaction<{ id: unknown }>`
      UPDATE crewcast.user_credits
      SET
        topic_search_credits_used = CASE
          WHEN period_start = (
            SELECT credit_period_start
            FROM crewcast.search_credit_reservations
            WHERE id = ${reservationId}
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
      throw new Error('The search-credit reservation balance could not be restored.');
    }

    const released = await transaction<{ id: unknown }>`
      UPDATE crewcast.search_credit_reservations
      SET
        status = 'released',
        released_at = NOW(),
        updated_at = NOW()
      WHERE user_id = ${accountId}
        AND request_id = ${requestId}::uuid
        AND status = 'reserved'
      RETURNING id
    `;
    if (released.length !== 1) {
      throw new Error('The search-credit reservation was not released exactly once.');
    }
  });
}

/**
 * Returns a held credit only after an authenticated operator has verified that
 * an ambiguous provider launch did not create a run. Database triggers require
 * the matching open reconciliation case and operator transaction context.
 */
export async function releaseUncertainSearchCredit(
  executor: SearchStartSqlExecutor,
  accountId: number,
  requestId: string,
): Promise<void> {
  await withSearchStartTransaction(executor, async (transaction) => {
    const creditRows = await transaction<{ id: unknown }>`
      SELECT id
      FROM crewcast.user_credits
      WHERE user_id = ${accountId}
      LIMIT 2
      FOR UPDATE
    `;
    if (creditRows.length !== 1) {
      throw new Error('The search-credit reservation owner has no unique credit balance.');
    }

    const reservations = await transaction<{
      id: unknown;
      status: unknown;
      subscription_credits_consumed: unknown;
      topup_credits_consumed: unknown;
    }>`
      SELECT
        id,
        status,
        subscription_credits_consumed,
        topup_credits_consumed
      FROM crewcast.search_credit_reservations
      WHERE user_id = ${accountId}
        AND request_id = ${requestId}::uuid
      LIMIT 2
      FOR UPDATE
    `;
    if (
      reservations.length !== 1
      || readStatus(reservations[0].status) !== 'uncertain'
    ) {
      throw new Error('The search request has no unique uncertain credit reservation.');
    }

    const reservationId = readInteger(
      reservations[0].id,
      'search_credit_reservations.id',
    );
    const subscriptionCredits = readInteger(
      reservations[0].subscription_credits_consumed,
      'search_credit_reservations.subscription_credits_consumed',
    );
    const topupCredits = readInteger(
      reservations[0].topup_credits_consumed,
      'search_credit_reservations.topup_credits_consumed',
    );

    const restored = await transaction<{ id: unknown }>`
      UPDATE crewcast.user_credits
      SET
        topic_search_credits_used = CASE
          WHEN period_start = (
            SELECT credit_period_start
            FROM crewcast.search_credit_reservations
            WHERE id = ${reservationId}
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
      throw new Error('The uncertain search-credit balance could not be restored.');
    }

    const released = await transaction<{ id: unknown }>`
      UPDATE crewcast.search_credit_reservations
      SET
        status = 'released',
        released_at = NOW(),
        updated_at = NOW()
      WHERE id = ${reservationId}
        AND user_id = ${accountId}
        AND request_id = ${requestId}::uuid
        AND status = 'uncertain'
      RETURNING id
    `;
    if (released.length !== 1) {
      throw new Error('The uncertain search-credit reservation was not released exactly once.');
    }
  });
}
