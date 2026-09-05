import type postgres from 'postgres';
import { initialTrialDaysForAccount } from './subscription-creation';

export type InitialTrialSql = postgres.Sql;

interface TrialHistoryRow {
  has_credit_record: unknown;
  has_trial_grant: unknown;
}

/**
 * Reads the durable account-level trial history used by both checkout display
 * and subscription creation. Keeping one query here prevents the browser and
 * the billing mutation from silently applying different trial rules.
 */
export async function readInitialTrialDays(
  sql: InitialTrialSql,
  userId: number,
  configuredTrialDays: number,
): Promise<number | undefined> {
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new Error('Application account ID is invalid.');
  }

  const rows = await sql<TrialHistoryRow[]>`
    SELECT
      EXISTS (
        SELECT 1 FROM crewcast.user_credits WHERE user_id = ${userId}
      ) AS has_credit_record,
      EXISTS (
        SELECT 1
        FROM crewcast.credit_transactions
        WHERE user_id = ${userId}
          AND reason IN ('trial_start', 'trial_restart')
      ) AS has_trial_grant
  `;

  if (
    rows.length !== 1
    || typeof rows[0].has_credit_record !== 'boolean'
    || typeof rows[0].has_trial_grant !== 'boolean'
  ) {
    throw new Error(`Could not determine trial history for user ${userId}.`);
  }

  return initialTrialDaysForAccount({
    configuredTrialDays,
    hasCreditRecord: rows[0].has_credit_record,
    hasTrialGrant: rows[0].has_trial_grant,
  });
}
