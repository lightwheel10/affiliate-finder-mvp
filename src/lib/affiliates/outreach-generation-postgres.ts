import 'server-only';

import { sql } from '@/lib/db';
import {
  consumeCreditsInTransaction,
  type CreditSqlExecutor,
} from '@/lib/credits';

// Longer than the route's 60-second execution ceiling, so a live request can
// never have its lease stolen while its provider call is still running.
const ACTIVE_LEASE_SECONDS = 120;

export interface OutreachGenerationDatabase extends CreditSqlExecutor {
  begin<T>(
    operation: (transaction: CreditSqlExecutor) => Promise<T>,
  ): Promise<T>;
}

export interface OutreachGenerationInput {
  accountId: number;
  brandId: string;
  brandLocationId: string;
  affiliateId: number;
  enforceCredits: boolean;
}

export interface OutreachGenerationLease {
  startedAt: string;
  creditsConsumed: boolean;
  creditsRemaining: number;
  creditPeriodStartToken: string | null;
  subscriptionCreditsConsumed: 0 | 1;
  topupCreditsConsumed: 0 | 1;
}

interface InsufficientCreditResult {
  outcome: 'insufficient_credits';
  message: string;
  remaining: number;
  isReadOnly: boolean;
}

export type ReserveOutreachGenerationResult =
  | { outcome: 'affiliate_not_found' }
  | { outcome: 'in_progress'; startedSecondsAgo: number }
  | InsufficientCreditResult
  | { outcome: 'reserved'; lease: OutreachGenerationLease };

interface IdRow {
  id: unknown;
}

interface CreditRow {
  ai_credits_total: unknown;
  ai_credits_used: unknown;
  ai_credits_topup: unknown;
  period_start_token: unknown;
  period_is_active: unknown;
}

interface AffiliateLeaseRow {
  lease_is_active: unknown;
  started_seconds_ago: unknown;
}

interface StartedLeaseRow {
  lease_started_at: unknown;
}

interface RestoredCreditRow {
  total: unknown;
  used: unknown;
  topup: unknown;
  period_matches: unknown;
}

function oneOrNull<T>(rows: readonly T[], label: string): T | null {
  if (rows.length > 1) throw new Error(`${label} returned more than one row.`);
  return rows[0] ?? null;
}

function readInteger(value: unknown, label: string): number {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^-?[0-9]+$/.test(value)
      ? Number(value)
      : Number.NaN;
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${label} is not a safe integer.`);
  }
  return parsed;
}

function readNumber(value: unknown, label: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} is not finite.`);
  return parsed;
}

function readBoolean(value: unknown, label: string): boolean {
  if (value !== true && value !== false) throw new Error(`${label} is not boolean.`);
  return value;
}

function readTimestamp(value: unknown, label: string): string {
  if (typeof value !== 'string' || !Number.isFinite(new Date(value).getTime())) {
    throw new Error(`${label} is not a timestamp.`);
  }
  return value;
}

function readIntegerToken(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^-?[0-9]+$/.test(value)) {
    throw new Error(`${label} is not an integer token.`);
  }
  return value;
}

function creditRejection(credit: CreditRow | null): InsufficientCreditResult | null {
  if (!credit) {
    return {
      outcome: 'insufficient_credits',
      message: 'No active subscription. Please subscribe to continue.',
      remaining: 0,
      isReadOnly: true,
    };
  }
  if (!readBoolean(credit.period_is_active, 'Credit period state')) {
    return {
      outcome: 'insufficient_credits',
      message: 'Subscription period has ended. Please renew to continue.',
      remaining: 0,
      isReadOnly: true,
    };
  }

  const total = readInteger(credit.ai_credits_total, 'AI credit total');
  const used = readInteger(credit.ai_credits_used, 'Used AI credits');
  const topup = readInteger(credit.ai_credits_topup ?? 0, 'AI top-up credits');
  if (total < -1 || used < 0 || topup < 0) {
    throw new Error('Stored AI credit balance is invalid.');
  }
  if (total === -1) return null;

  const remaining = Math.max(0, total - used) + topup;
  if (remaining >= 1) return null;
  return {
    outcome: 'insufficient_credits',
    message: `Insufficient AI credits. You have ${remaining} remaining.`,
    remaining,
    isReadOnly: false,
  };
}

async function lockAccount(
  transaction: CreditSqlExecutor,
  accountId: number,
): Promise<boolean> {
  const rows = await transaction<IdRow>`
    SELECT id
    FROM crewcast.users
    WHERE id = ${accountId}
    FOR KEY SHARE
  `;
  if (rows.length > 1) throw new Error('Account lock returned more than one row.');
  return rows.length === 1;
}

async function lockCredit(
  transaction: CreditSqlExecutor,
  accountId: number,
): Promise<CreditRow | null> {
  const rows = await transaction<CreditRow>`
    SELECT
      ai_credits_total,
      ai_credits_used,
      ai_credits_topup,
      (EXTRACT(EPOCH FROM period_start) * 1000000)::bigint::text AS period_start_token,
      period_end > NOW() AS period_is_active
    FROM crewcast.user_credits
    WHERE user_id = ${accountId}
    LIMIT 2
    FOR UPDATE
  `;
  return oneOrNull(rows, 'AI credit lock');
}

async function lockAffiliate(
  transaction: CreditSqlExecutor,
  input: OutreachGenerationInput,
): Promise<AffiliateLeaseRow | null> {
  const rows = await transaction<AffiliateLeaseRow>`
    SELECT
      (
        ai_generation_started_at IS NOT NULL
        AND ai_generation_started_at > NOW() - (${ACTIVE_LEASE_SECONDS} * INTERVAL '1 second')
        AND (ai_generated_at IS NULL OR ai_generated_at < ai_generation_started_at)
      ) AS lease_is_active,
      GREATEST(
        0,
        EXTRACT(EPOCH FROM (clock_timestamp() - ai_generation_started_at))
      ) AS started_seconds_ago
    FROM crewcast.saved_affiliates
    WHERE id = ${input.affiliateId}
      AND user_id = ${input.accountId}
      AND brand_id = ${input.brandId}::bigint
      AND brand_location_id = ${input.brandLocationId}::bigint
    LIMIT 2
    FOR UPDATE
  `;
  return oneOrNull(rows, 'Outreach affiliate lock');
}

/**
 * Atomically claims one affiliate and, when enabled, one AI credit.
 *
 * The fixed account -> credit -> affiliate lock order matches the existing
 * credit paths. The transaction commits before the slow n8n request starts.
 */
export async function reserveOutreachGeneration(
  input: OutreachGenerationInput,
  database: OutreachGenerationDatabase = sql as OutreachGenerationDatabase,
): Promise<ReserveOutreachGenerationResult> {
  return database.begin(async (transaction) => {
    if (!await lockAccount(transaction, input.accountId)) {
      return { outcome: 'affiliate_not_found' };
    }

    const credit = input.enforceCredits
      ? await lockCredit(transaction, input.accountId)
      : null;
    const affiliate = await lockAffiliate(transaction, input);
    if (!affiliate) return { outcome: 'affiliate_not_found' };

    if (readBoolean(affiliate.lease_is_active, 'Outreach lease state')) {
      return {
        outcome: 'in_progress',
        startedSecondsAgo: Math.max(
          0,
          Math.round(readNumber(affiliate.started_seconds_ago, 'Outreach lease age')),
        ),
      };
    }

    let creditsConsumed = false;
    let creditsRemaining = 0;
    let creditPeriodStartToken: string | null = null;
    let subscriptionCreditsConsumed: 0 | 1 = 0;
    let topupCreditsConsumed: 0 | 1 = 0;
    if (input.enforceCredits) {
      const rejection = creditRejection(credit);
      if (rejection) return rejection;
      if (!credit) throw new Error('The locked AI credit row disappeared.');

      const total = readInteger(credit.ai_credits_total, 'AI credit total');
      const used = readInteger(credit.ai_credits_used, 'Used AI credits');
      const subscriptionRemaining = total === -1 ? 1 : Math.max(0, total - used);
      subscriptionCreditsConsumed = Math.min(1, subscriptionRemaining) as 0 | 1;
      topupCreditsConsumed = (1 - subscriptionCreditsConsumed) as 0 | 1;
      creditPeriodStartToken = readIntegerToken(
        credit.period_start_token,
        'Credit period start token',
      );

      const consumed = await consumeCreditsInTransaction(
        transaction,
        input.accountId,
        'ai',
        1,
        String(input.affiliateId),
        'outreach',
      );
      if (!consumed.success) {
        throw new Error('The locked AI credit could not be reserved.');
      }
      creditsConsumed = true;
      creditsRemaining = consumed.newBalance;
    }

    const claimed = await transaction<StartedLeaseRow>`
      UPDATE crewcast.saved_affiliates
      SET ai_generation_started_at = date_trunc('milliseconds', clock_timestamp())
      WHERE id = ${input.affiliateId}
        AND user_id = ${input.accountId}
        AND brand_id = ${input.brandId}::bigint
        AND brand_location_id = ${input.brandLocationId}::bigint
      RETURNING ai_generation_started_at::text AS lease_started_at
    `;
    if (claimed.length !== 1) {
      throw new Error('The outreach affiliate was not claimed exactly once.');
    }

    return {
      outcome: 'reserved',
      lease: {
        startedAt: readTimestamp(claimed[0].lease_started_at, 'Outreach lease start'),
        creditsConsumed,
        creditsRemaining,
        creditPeriodStartToken,
        subscriptionCreditsConsumed,
        topupCreditsConsumed,
      },
    };
  });
}

/**
 * Releases only the exact lease owned by this request. A second cleanup call,
 * or cleanup from an older request, cannot restore the credit again.
 */
export async function releaseOutreachGeneration(
  input: OutreachGenerationInput,
  lease: OutreachGenerationLease,
  database: OutreachGenerationDatabase = sql as OutreachGenerationDatabase,
): Promise<boolean> {
  return database.begin(async (transaction) => {
    if (!await lockAccount(transaction, input.accountId)) return false;

    const credit = lease.creditsConsumed
      ? await lockCredit(transaction, input.accountId)
      : null;
    const ownedLeases = await transaction<IdRow>`
      SELECT id
      FROM crewcast.saved_affiliates
      WHERE id = ${input.affiliateId}
        AND user_id = ${input.accountId}
        AND brand_id = ${input.brandId}::bigint
        AND brand_location_id = ${input.brandLocationId}::bigint
        AND ai_generation_started_at = ${lease.startedAt}::timestamptz
        AND (ai_generated_at IS NULL OR ai_generated_at < ai_generation_started_at)
      LIMIT 2
      FOR UPDATE
    `;
    if (ownedLeases.length === 0) return false;
    if (ownedLeases.length !== 1) {
      throw new Error('Outreach lease lookup returned more than one row.');
    }

    if (lease.creditsConsumed) {
      if (!credit || !lease.creditPeriodStartToken) {
        throw new Error('The outreach credit reservation cannot be restored.');
      }
      if (lease.subscriptionCreditsConsumed + lease.topupCreditsConsumed !== 1) {
        throw new Error('The outreach credit reservation split is invalid.');
      }

      const restored = await transaction<RestoredCreditRow>`
        UPDATE crewcast.user_credits
        SET
          ai_credits_used = CASE
            WHEN (EXTRACT(EPOCH FROM period_start) * 1000000)::bigint::text
              = ${lease.creditPeriodStartToken}
              THEN GREATEST(0, ai_credits_used - ${lease.subscriptionCreditsConsumed})
            ELSE ai_credits_used
          END,
          ai_credits_topup = ai_credits_topup + ${lease.topupCreditsConsumed},
          updated_at = NOW()
        WHERE user_id = ${input.accountId}
        RETURNING
          ai_credits_total AS total,
          ai_credits_used AS used,
          ai_credits_topup AS topup,
          (EXTRACT(EPOCH FROM period_start) * 1000000)::bigint::text
            = ${lease.creditPeriodStartToken} AS period_matches
      `;
      if (restored.length !== 1) {
        throw new Error('The outreach credit balance was not restored exactly once.');
      }

      const row = restored[0];
      const total = readInteger(row.total, 'Restored AI credit total');
      const used = readInteger(row.used, 'Restored used AI credits');
      const topup = readInteger(row.topup ?? 0, 'Restored AI top-up credits');
      const periodMatches = readBoolean(row.period_matches, 'Restored credit period state');
      const restoredAmount = lease.topupCreditsConsumed
        + (periodMatches ? lease.subscriptionCreditsConsumed : 0);
      const balanceAfter = total === -1 ? -1 : Math.max(0, total - used) + topup;

      if (restoredAmount > 0) {
        await transaction`
          INSERT INTO crewcast.credit_transactions (
            user_id, credit_type, amount, balance_after, reason, reference_id, reference_type
          ) VALUES (
            ${input.accountId}, 'ai', ${restoredAmount}, ${balanceAfter}, 'refund',
            ${String(input.affiliateId)}, 'outreach_refund'
          )
        `;
      }
    }

    const released = await transaction<IdRow>`
      UPDATE crewcast.saved_affiliates
      SET ai_generation_started_at = NULL
      WHERE id = ${input.affiliateId}
        AND user_id = ${input.accountId}
        AND brand_id = ${input.brandId}::bigint
        AND brand_location_id = ${input.brandLocationId}::bigint
        AND ai_generation_started_at = ${lease.startedAt}::timestamptz
        AND (ai_generated_at IS NULL OR ai_generated_at < ai_generation_started_at)
      RETURNING id
    `;
    if (released.length !== 1) {
      throw new Error('The outreach lease was not released exactly once.');
    }
    return true;
  });
}
