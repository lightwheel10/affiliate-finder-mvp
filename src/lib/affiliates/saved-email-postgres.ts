import 'server-only';

import { sql } from '@/lib/db';
import {
  consumeCreditsInTransaction,
  type CreditSqlExecutor,
} from '@/lib/credits';

export interface SavedAffiliateEmailDatabase extends CreditSqlExecutor {
  begin<T>(
    operation: (transaction: CreditSqlExecutor) => Promise<T>,
  ): Promise<T>;
}

export interface FinalizeSavedAffiliateEmailInput {
  accountId: number;
  brandId: string;
  brandLocationId: string;
  affiliateId: number;
  emailStatus: 'found' | 'not_found';
  email: string | null;
  provider: string;
  enforceCredits: boolean;
}

export interface ReserveSavedAffiliateEmailLookupInput {
  accountId: number;
  brandId: string;
  brandLocationId: string;
  affiliateId: number;
  enforceCredits: boolean;
}

interface InsufficientEmailCreditResult {
  outcome: 'insufficient_credits';
  message: string;
  remaining: number;
  isUnlimited: false;
  isReadOnly: boolean;
}

export type FinalizeSavedAffiliateEmailResult =
  | { outcome: 'affiliate_not_found' }
  | {
      outcome: 'already_processed';
      email: string | null;
    }
  | { outcome: 'in_progress' }
  | InsufficientEmailCreditResult
  | {
      outcome: 'updated';
      email: string | null;
      status: 'found' | 'not_found';
      creditsConsumed: boolean;
      creditsRemaining: number;
    };

export type ReserveSavedAffiliateEmailLookupResult =
  | { outcome: 'affiliate_not_found' }
  | { outcome: 'already_processed'; email: string | null }
  | { outcome: 'in_progress' }
  | InsufficientEmailCreditResult
  | {
      outcome: 'reserved';
      creditsConsumed: boolean;
      creditsRemaining: number;
    };

interface IdRow {
  id: unknown;
}

interface AffiliateEmailRow {
  email_status: unknown;
  email: unknown;
}

interface EmailCreditRow {
  email_credits_total: unknown;
  email_credits_used: unknown;
  email_credits_topup: unknown;
  period_is_active: unknown;
}

function oneOrNull<T>(rows: readonly T[], label: string): T | null {
  if (rows.length > 1) {
    throw new Error(`${label} returned more than one row.`);
  }
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

function readNullableString(value: unknown, label: string): string | null {
  if (value === null || typeof value === 'string') return value;
  throw new Error(`${label} is not a nullable string.`);
}

type StoredEmailStatus = 'not_searched' | 'searching' | 'found' | 'not_found' | 'error' | null;

function readEmailStatus(value: unknown): StoredEmailStatus {
  if (
    value === null
    || value === 'not_searched'
    || value === 'searching'
    || value === 'found'
    || value === 'not_found'
    || value === 'error'
  ) {
    return value;
  }
  throw new Error('Saved affiliate email status is invalid.');
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
  if (rows.length > 1) {
    throw new Error('Account lock returned more than one row.');
  }
  return rows.length === 1;
}

async function lockEmailCredit(
  transaction: CreditSqlExecutor,
  accountId: number,
): Promise<EmailCreditRow | null> {
  const rows = await transaction<EmailCreditRow>`
    SELECT
      email_credits_total,
      email_credits_used,
      email_credits_topup,
      period_end >= NOW() AS period_is_active
    FROM crewcast.user_credits
    WHERE user_id = ${accountId}
    LIMIT 2
    FOR UPDATE
  `;
  return oneOrNull(rows, 'Email credit lock');
}

async function lockAffiliate(
  transaction: CreditSqlExecutor,
  input: Pick<
    FinalizeSavedAffiliateEmailInput,
    'accountId' | 'brandId' | 'brandLocationId' | 'affiliateId'
  >,
): Promise<AffiliateEmailRow | null> {
  const rows = await transaction<AffiliateEmailRow>`
    SELECT email_status, email
    FROM crewcast.saved_affiliates
    WHERE id = ${input.affiliateId}
      AND user_id = ${input.accountId}
      AND brand_id = ${input.brandId}::bigint
      AND brand_location_id = ${input.brandLocationId}::bigint
    LIMIT 2
    FOR UPDATE
  `;
  return oneOrNull(rows, 'Saved affiliate lock');
}

function creditRejection(
  creditRow: EmailCreditRow | null,
): InsufficientEmailCreditResult | null {
  if (!creditRow) {
    return {
      outcome: 'insufficient_credits',
      message: 'No active subscription. Please subscribe to continue.',
      remaining: 0,
      isUnlimited: false,
      isReadOnly: true,
    };
  }
  if (creditRow.period_is_active !== true) {
    return {
      outcome: 'insufficient_credits',
      message: 'Subscription period has ended. Please renew to continue.',
      remaining: 0,
      isUnlimited: false,
      isReadOnly: true,
    };
  }

  const total = readInteger(creditRow.email_credits_total, 'Email credit total');
  const used = readInteger(creditRow.email_credits_used, 'Used email credits');
  const topup = readInteger(creditRow.email_credits_topup ?? 0, 'Email top-up credits');
  if (total < -1 || used < 0 || topup < 0) {
    throw new Error('Stored email credit balance is invalid.');
  }
  if (total === -1) return null;

  const remaining = Math.max(0, total - used) + topup;
  if (remaining >= 1) return null;
  return {
    outcome: 'insufficient_credits',
    message: `Insufficient email credits. You have ${remaining} remaining.`,
    remaining,
    isUnlimited: false,
    isReadOnly: false,
  };
}

/**
 * Persists a social-profile email and its charge as one database operation.
 *
 * Lock order is intentionally account -> credit row -> saved affiliate. This
 * matches subscription credit initialization/reset code, serializes retries
 * for the account, and never keeps a transaction open during provider work.
 * Any thrown database error rolls back the email, balance, and ledger together.
 */
export async function finalizeSavedAffiliateEmail(
  input: FinalizeSavedAffiliateEmailInput,
  database: SavedAffiliateEmailDatabase = sql as SavedAffiliateEmailDatabase,
): Promise<FinalizeSavedAffiliateEmailResult> {
  return database.begin(async (transaction) => {
    if (!await lockAccount(transaction, input.accountId)) {
      return { outcome: 'affiliate_not_found' };
    }

    let creditRow: EmailCreditRow | null = null;
    if (input.enforceCredits && input.emailStatus === 'found') {
      creditRow = await lockEmailCredit(transaction, input.accountId);
    }

    const affiliate = await lockAffiliate(transaction, input);
    if (!affiliate) return { outcome: 'affiliate_not_found' };

    const existingStatus = readEmailStatus(affiliate.email_status);
    const existingEmail = readNullableString(affiliate.email, 'Saved affiliate email');
    if (existingStatus === 'found') {
      return {
        outcome: 'already_processed',
        email: existingEmail ?? input.email,
      };
    }
    if (existingStatus === 'searching') return { outcome: 'in_progress' };

    let creditsConsumed = false;
    let creditsRemaining = 0;
    if (input.enforceCredits && input.emailStatus === 'found') {
      const rejection = creditRejection(creditRow);
      if (rejection) return rejection;

      const consumed = await consumeCreditsInTransaction(
        transaction,
        input.accountId,
        'email',
        1,
        String(input.affiliateId),
        'bio_extraction',
      );
      if (!consumed.success) {
        throw new Error('Locked email credit could not be consumed.');
      }
      creditsConsumed = true;
      creditsRemaining = consumed.newBalance;
    }

    const updatedRows = await transaction<IdRow>`
      UPDATE crewcast.saved_affiliates
      SET
        email = COALESCE(${input.email}, email),
        email_status = ${input.emailStatus},
        email_searched_at = NOW(),
        email_provider = ${input.provider}
      WHERE id = ${input.affiliateId}
        AND user_id = ${input.accountId}
        AND brand_id = ${input.brandId}::bigint
        AND brand_location_id = ${input.brandLocationId}::bigint
      RETURNING id
    `;
    if (updatedRows.length !== 1) {
      throw new Error('Saved affiliate email update did not affect exactly one row.');
    }

    return {
      outcome: 'updated',
      email: input.email,
      status: input.emailStatus,
      creditsConsumed,
      creditsRemaining,
    };
  });
}

/**
 * Claims one saved affiliate for a paid provider lookup and reserves its credit
 * in the same transaction. The provider call happens only after this commits.
 */
export async function reserveSavedAffiliateEmailLookup(
  input: ReserveSavedAffiliateEmailLookupInput,
  database: SavedAffiliateEmailDatabase = sql as SavedAffiliateEmailDatabase,
): Promise<ReserveSavedAffiliateEmailLookupResult> {
  return database.begin(async (transaction) => {
    if (!await lockAccount(transaction, input.accountId)) {
      return { outcome: 'affiliate_not_found' };
    }

    const creditRow = input.enforceCredits
      ? await lockEmailCredit(transaction, input.accountId)
      : null;
    const affiliate = await lockAffiliate(transaction, input);
    if (!affiliate) return { outcome: 'affiliate_not_found' };

    const currentStatus = readEmailStatus(affiliate.email_status);
    const currentEmail = readNullableString(affiliate.email, 'Saved affiliate email');
    if (currentStatus === 'found') {
      return { outcome: 'already_processed', email: currentEmail };
    }
    if (currentStatus === 'searching') return { outcome: 'in_progress' };

    let creditsConsumed = false;
    let creditsRemaining = 0;
    if (input.enforceCredits) {
      const rejection = creditRejection(creditRow);
      if (rejection) return rejection;

      const consumed = await consumeCreditsInTransaction(
        transaction,
        input.accountId,
        'email',
        1,
        String(input.affiliateId),
        'affiliate',
      );
      if (!consumed.success) {
        throw new Error('Locked email credit could not be reserved.');
      }
      creditsConsumed = true;
      creditsRemaining = consumed.newBalance;
    }

    const claimed = await transaction<IdRow>`
      UPDATE crewcast.saved_affiliates
      SET email_status = 'searching'
      WHERE id = ${input.affiliateId}
        AND user_id = ${input.accountId}
        AND brand_id = ${input.brandId}::bigint
        AND brand_location_id = ${input.brandLocationId}::bigint
      RETURNING id
    `;
    if (claimed.length !== 1) {
      throw new Error('Saved affiliate email lookup claim did not affect exactly one row.');
    }

    return {
      outcome: 'reserved',
      creditsConsumed,
      creditsRemaining,
    };
  });
}
