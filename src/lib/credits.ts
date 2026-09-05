/**
 * Credit System Service
 * 
 * Manages user credits for topic searches, email lookups, and AI outreach.
 * 
 * Created: December 2025
 */

import { sql } from './db';
import { PLAN_CATALOG, SEARCH_INPUT_LIMITS } from './plans/catalog';

// =============================================================================
// CREDIT CONFIGURATION
// =============================================================================

export const PLAN_CREDITS = {
  trial: PLAN_CATALOG.free_trial.credits,
  pro: PLAN_CATALOG.pro.credits,
  business: PLAN_CATALOG.business.credits,
  enterprise: PLAN_CATALOG.enterprise.credits,
} as const;

// What counts as 1 topic search
export const SEARCH_LIMITS = SEARCH_INPUT_LIMITS;

// Credit types
export type CreditType = 'topic_search' | 'email' | 'ai';

export interface CreditSqlExecutor {
  <T extends object = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<readonly T[]>;
}

interface CreditDatabase extends CreditSqlExecutor {
  begin<T>(operation: (transaction: CreditSqlExecutor) => Promise<T>): Promise<T>;
}

export interface CreditResetOptions {
  executor?: CreditSqlExecutor;
  stripeInvoiceId?: string;
}

export type CreditResetOutcome = 'applied' | 'duplicate_invoice' | 'stale_period';

function runCreditTransaction<T>(
  executor: CreditSqlExecutor | undefined,
  operation: (transaction: CreditSqlExecutor) => Promise<T>,
): Promise<T> {
  if (executor) return operation(executor);
  return (sql as CreditDatabase).begin(operation);
}

function assertStripeInvoiceId(value: string): void {
  if (
    value.length < 1
    || value.length > 255
    || /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new Error('Stripe invoice ID is invalid.');
  }
}

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface UserCredits {
  topicSearches: {
    total: number;
    used: number;
    remaining: number;
    unlimited: boolean;
    topup: number;
  };
  email: {
    total: number;
    used: number;
    remaining: number;
    unlimited: boolean;
    topup: number;
  };
  ai: {
    total: number;
    used: number;
    remaining: number;
    unlimited: boolean;
    topup: number;
  };
  period: {
    start: string;
    end: string;
    daysRemaining: number;
  };
  isTrialPeriod: boolean;
}

export interface CreditCheckResult {
  allowed: boolean;
  remaining: number;
  isUnlimited: boolean;
  isReadOnly: boolean;
  message?: string;
}

export interface DbUserCredits {
  id: number;
  user_id: number;
  topic_search_credits_total: number;
  email_credits_total: number;
  ai_credits_total: number;
  topic_search_credits_used: number;
  email_credits_used: number;
  ai_credits_used: number;
  topic_search_credits_topup?: number;
  email_credits_topup?: number;
  ai_credits_topup?: number;
  period_start: string;
  period_end: string;
  is_trial_period: boolean;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// GET USER CREDITS
// =============================================================================

/**
 * Get a user's current credit balances
 * 
 * @param userId - The user's database ID
 * @returns UserCredits object or null if no credits found
 */
export async function getUserCredits(userId: number): Promise<UserCredits | null> {
  try {
    const result = await sql`
      SELECT * FROM crewcast.user_credits WHERE user_id = ${userId}
    `;

    if (result.length === 0) {
      return null;
    }

    const row = result[0] as DbUserCredits;
    const now = new Date();
    const periodEnd = new Date(row.period_end);
    const daysRemaining = Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    const tsTopup = row.topic_search_credits_topup ?? 0;
    const emailTopup = row.email_credits_topup ?? 0;
    const aiTopup = row.ai_credits_topup ?? 0;

    const isTopicSearchUnlimited = row.topic_search_credits_total === -1;
    const isEmailUnlimited = row.email_credits_total === -1;
    const isAiUnlimited = row.ai_credits_total === -1;

    const tsSubRem = isTopicSearchUnlimited ? -1 : Math.max(0, row.topic_search_credits_total - row.topic_search_credits_used);
    const emailSubRem = isEmailUnlimited ? -1 : Math.max(0, row.email_credits_total - row.email_credits_used);
    const aiSubRem = isAiUnlimited ? -1 : Math.max(0, row.ai_credits_total - row.ai_credits_used);

    return {
      topicSearches: {
        total: isTopicSearchUnlimited ? -1 : row.topic_search_credits_total,
        used: row.topic_search_credits_used,
        remaining: isTopicSearchUnlimited ? -1 : tsSubRem + tsTopup,
        unlimited: isTopicSearchUnlimited,
        topup: tsTopup,
      },
      email: {
        total: isEmailUnlimited ? -1 : row.email_credits_total,
        used: row.email_credits_used,
        remaining: isEmailUnlimited ? -1 : emailSubRem + emailTopup,
        unlimited: isEmailUnlimited,
        topup: emailTopup,
      },
      ai: {
        total: isAiUnlimited ? -1 : row.ai_credits_total,
        used: row.ai_credits_used,
        remaining: isAiUnlimited ? -1 : aiSubRem + aiTopup,
        unlimited: isAiUnlimited,
        topup: aiTopup,
      },
      period: {
        start: row.period_start,
        end: row.period_end,
        daysRemaining,
      },
      isTrialPeriod: row.is_trial_period,
    };
  } catch (error) {
    console.error('[Credits] Error getting user credits:', error);
    return null;
  }
}

// =============================================================================
// CHECK CREDITS
// =============================================================================

/**
 * Check if a user has enough credits for an action
 *
 * 2026-08-04 (Paras): ADVISORY ONLY. This read is not atomic and can race
 * with concurrent requests — use it for fast-fail UX (nice 402 messages),
 * never as a reservation. The atomic enforcement point is consumeCredits()
 * below, whose UPDATE carries the availability check in its WHERE clause.
 *
 * @param userId - The user's database ID
 * @param creditType - Type of credit to check
 * @param amount - Amount of credits needed (default: 1)
 * @returns CreditCheckResult
 */
export async function checkCredits(
  userId: number,
  creditType: CreditType,
  amount: number = 1
): Promise<CreditCheckResult> {
  try {
    const result = await sql`
      SELECT 
        topic_search_credits_total,
        topic_search_credits_used,
        topic_search_credits_topup,
        email_credits_total,
        email_credits_used,
        email_credits_topup,
        ai_credits_total,
        ai_credits_used,
        ai_credits_topup,
        period_end
      FROM crewcast.user_credits 
      WHERE user_id = ${userId}
    `;

    // No credit record found - user might be in read-only mode (canceled)
    if (result.length === 0) {
      return {
        allowed: false,
        remaining: 0,
        isUnlimited: false,
        isReadOnly: true,
        message: 'No active subscription. Please subscribe to continue.',
      };
    }

    const row = result[0];
    
    // Check if period has expired
    const periodEnd = new Date(row.period_end);
    if (new Date() > periodEnd) {
      return {
        allowed: false,
        remaining: 0,
        isUnlimited: false,
        isReadOnly: true,
        message: 'Subscription period has ended. Please renew to continue.',
      };
    }

    // Get the relevant credit values based on type (include topup)
    let total: number;
    let used: number;
    let topup: number;

    switch (creditType) {
      case 'topic_search':
        total = row.topic_search_credits_total;
        used = row.topic_search_credits_used;
        topup = row.topic_search_credits_topup ?? 0;
        break;
      case 'email':
        total = row.email_credits_total;
        used = row.email_credits_used;
        topup = row.email_credits_topup ?? 0;
        break;
      case 'ai':
        total = row.ai_credits_total;
        used = row.ai_credits_used;
        topup = row.ai_credits_topup ?? 0;
        break;
      default:
        return {
          allowed: false,
          remaining: 0,
          isUnlimited: false,
          isReadOnly: false,
          message: 'Invalid credit type',
        };
    }

    // Check if unlimited
    if (total === -1) {
      return {
        allowed: true,
        remaining: -1,
        isUnlimited: true,
        isReadOnly: false,
      };
    }

    const subRemaining = Math.max(0, total - used);
    const remaining = subRemaining + topup;
    const allowed = remaining >= amount;

    return {
      allowed,
      remaining,
      isUnlimited: false,
      isReadOnly: false,
      message: allowed ? undefined : `Insufficient ${creditType.replace('_', ' ')} credits. You have ${remaining} remaining.`,
    };
  } catch (error) {
    console.error('[Credits] Error checking credits:', error);
    return {
      allowed: false,
      remaining: 0,
      isUnlimited: false,
      isReadOnly: false,
      message: 'Error checking credits. Please try again.',
    };
  }
}

// =============================================================================
// CONSUME CREDITS
// =============================================================================

/**
 * Deduct credits after a successful action
 *
 * ===========================================================================
 * 2026-08-04 (Paras): REWRITTEN TO BE ATOMIC — fixes security audit finding
 * H3 (credit-consumption TOCTOU race).
 *
 * WHY: The old implementation was check-then-act: SELECT the balance, verify
 * availability in JavaScript, then UPDATE with an unconditional
 * `used = used + N`. Two concurrent requests (double-click, two open tabs,
 * parallel API calls — no attacker needed) could both read the same balance,
 * both pass the JS check, and both increment. Result: more credits consumed
 * than the user had, and each over-spend was a real paid Apollo/Lusha/Apify
 * call the business ate.
 *
 * HOW: The availability check now lives INSIDE the UPDATE's WHERE clause, so
 * check + deduct are one indivisible statement. Postgres row-locks the row
 * during UPDATE: concurrent requests serialize, each re-evaluates the guard
 * against the committed balance, and a request that no longer fits matches
 * 0 rows → we return { success: false, newBalance: 0 }. The subscription /
 * topup split is computed in SQL from that same locked row (SET expressions
 * always see the PRE-update values), so it can never use a stale read.
 *
 * DO NOT "simplify" this back to SELECT → check in JS → UPDATE, and do not
 * treat a passing checkCredits() as a reservation — checkCredits() is
 * advisory UX only; THIS function is the enforcement point.
 * ===========================================================================
 *
 * @param userId - The user's database ID
 * @param creditType - Type of credit to consume
 * @param amount - Amount to deduct (default: 1)
 * @param referenceId - Optional reference (e.g., affiliate ID)
 * @param referenceType - Optional reference type (e.g., 'search', 'affiliate')
 * @returns Object with success status and new balance
 */
export async function consumeCredits(
  userId: number,
  creditType: CreditType,
  amount: number = 1,
  referenceId?: string,
  referenceType?: string
): Promise<{ success: boolean; newBalance: number }> {
  try {
    if (amount <= 0 || !Number.isInteger(amount)) {
      console.error(`[Credits] SECURITY: Invalid amount ${amount} rejected for user ${userId}`);
      return { success: false, newBalance: 0 };
    }

    // 2026-08-04 (Paras): One guarded UPDATE per credit type — the WHERE
    // clause IS the availability check (atomic; see function doc above).
    // 0 rows updated = no credit row OR insufficient balance; either way
    // nothing was deducted.
    //
    // The CASE expressions split the charge: subscription pool first
    // (LEAST(amount, remaining sub)), overflow drains topup. Topup can never
    // go negative — the WHERE guard proves sub-remaining + topup >= amount
    // before any write happens. Unlimited plans (total = -1) always pass and
    // only increment `used`; their topup is left untouched (COALESCE'd to 0,
    // matching the old behavior for NULL topup columns).
    let updateResult;
    switch (creditType) {
      case 'topic_search':
        updateResult = await sql`
          UPDATE crewcast.user_credits
          SET
            topic_search_credits_used = topic_search_credits_used + (CASE
              WHEN topic_search_credits_total = -1 THEN ${amount}
              ELSE LEAST(${amount}, GREATEST(0, topic_search_credits_total - topic_search_credits_used))
            END),
            topic_search_credits_topup = (CASE
              WHEN topic_search_credits_total = -1 THEN COALESCE(topic_search_credits_topup, 0)
              ELSE COALESCE(topic_search_credits_topup, 0)
                - (${amount} - LEAST(${amount}, GREATEST(0, topic_search_credits_total - topic_search_credits_used)))
            END),
            updated_at = NOW()
          WHERE user_id = ${userId}
            AND (
              topic_search_credits_total = -1
              OR GREATEST(0, topic_search_credits_total - topic_search_credits_used) + COALESCE(topic_search_credits_topup, 0) >= ${amount}
            )
          RETURNING topic_search_credits_total as total, topic_search_credits_used as used, topic_search_credits_topup as topup
        `;
        break;
      case 'email':
        updateResult = await sql`
          UPDATE crewcast.user_credits
          SET
            email_credits_used = email_credits_used + (CASE
              WHEN email_credits_total = -1 THEN ${amount}
              ELSE LEAST(${amount}, GREATEST(0, email_credits_total - email_credits_used))
            END),
            email_credits_topup = (CASE
              WHEN email_credits_total = -1 THEN COALESCE(email_credits_topup, 0)
              ELSE COALESCE(email_credits_topup, 0)
                - (${amount} - LEAST(${amount}, GREATEST(0, email_credits_total - email_credits_used)))
            END),
            updated_at = NOW()
          WHERE user_id = ${userId}
            AND (
              email_credits_total = -1
              OR GREATEST(0, email_credits_total - email_credits_used) + COALESCE(email_credits_topup, 0) >= ${amount}
            )
          RETURNING email_credits_total as total, email_credits_used as used, email_credits_topup as topup
        `;
        break;
      case 'ai':
        updateResult = await sql`
          UPDATE crewcast.user_credits
          SET
            ai_credits_used = ai_credits_used + (CASE
              WHEN ai_credits_total = -1 THEN ${amount}
              ELSE LEAST(${amount}, GREATEST(0, ai_credits_total - ai_credits_used))
            END),
            ai_credits_topup = (CASE
              WHEN ai_credits_total = -1 THEN COALESCE(ai_credits_topup, 0)
              ELSE COALESCE(ai_credits_topup, 0)
                - (${amount} - LEAST(${amount}, GREATEST(0, ai_credits_total - ai_credits_used)))
            END),
            updated_at = NOW()
          WHERE user_id = ${userId}
            AND (
              ai_credits_total = -1
              OR GREATEST(0, ai_credits_total - ai_credits_used) + COALESCE(ai_credits_topup, 0) >= ${amount}
            )
          RETURNING ai_credits_total as total, ai_credits_used as used, ai_credits_topup as topup
        `;
        break;
      default:
        return { success: false, newBalance: 0 };
    }

    if (updateResult.length === 0) {
      // Atomic guard rejected the deduction: insufficient credits, or the
      // user has no credit row at all. Nothing was written.
      console.error(`[Credits] Consume rejected for user ${userId}: insufficient ${creditType} credits or no credit record`);
      return { success: false, newBalance: 0 };
    }

    const u = updateResult[0];
    const newBalance = u.total === -1 ? -1 : Math.max(0, u.total - u.used) + (u.topup ?? 0);

    await sql`
      INSERT INTO crewcast.credit_transactions (
        user_id, credit_type, amount, balance_after, reason, reference_id, reference_type
      ) VALUES (
        ${userId}, ${creditType}, ${-amount}, ${newBalance}, 'usage', ${referenceId || null}, ${referenceType || null}
      )
    `;

    console.log(`[Credits] Consumed ${amount} ${creditType} credit(s) for user ${userId}. New balance: ${newBalance}`);
    return { success: true, newBalance };
  } catch (error) {
    console.error('[Credits] Error consuming credits:', error);
    return { success: false, newBalance: 0 };
  }
}

// =============================================================================
// REFUND CREDITS (January 24th, 2026)
// 
// PURPOSE: Refund credits when an operation fails AFTER credits were consumed.
// 
// USE CASE: AI email generation now consumes credits BEFORE calling n8n.
// If n8n fails or returns empty message, we need to refund the credit.
// 
// This prevents the TOCTOU (Time-of-Check to Time-of-Use) vulnerability where:
// 1. Check: User has 1 credit, 2 requests both pass check
// 2. Use: Both generate emails
// 3. Consume: Only 1 succeeds (atomic UPDATE), but 2 emails were generated!
// 
// By consuming FIRST and refunding on failure, we guarantee 1 credit = 1 email.
// =============================================================================

/**
 * Refund credits that were previously consumed
 * 
 * @param userId - The user's database ID
 * @param creditType - Type of credit to refund
 * @param amount - Number of credits to refund (default: 1)
 * @param referenceId - ID of the related resource (for audit trail)
 * @param referenceType - Type of reference (e.g., 'outreach_refund')
 */
export async function refundCredits(
  userId: number,
  creditType: CreditType,
  amount: number = 1,
  referenceId?: string,
  referenceType?: string
): Promise<{ success: boolean; newBalance: number }> {
  try {
    // SECURITY: Validate amount is positive
    if (amount <= 0 || !Number.isInteger(amount)) {
      console.error(`[Credits] SECURITY: Invalid refund amount ${amount} rejected for user ${userId}`);
      return { success: false, newBalance: 0 };
    }

    let updateResult;
    
    // Refund by DECREMENTING credits_used (opposite of consume)
    switch (creditType) {
      case 'topic_search':
        updateResult = await sql`
          UPDATE crewcast.user_credits
          SET 
            topic_search_credits_used = GREATEST(0, topic_search_credits_used - ${amount}),
            updated_at = NOW()
          WHERE user_id = ${userId}
          RETURNING topic_search_credits_total as total, topic_search_credits_used as used
        `;
        break;
      case 'email':
        updateResult = await sql`
          UPDATE crewcast.user_credits
          SET 
            email_credits_used = GREATEST(0, email_credits_used - ${amount}),
            updated_at = NOW()
          WHERE user_id = ${userId}
          RETURNING email_credits_total as total, email_credits_used as used
        `;
        break;
      case 'ai':
        updateResult = await sql`
          UPDATE crewcast.user_credits
          SET 
            ai_credits_used = GREATEST(0, ai_credits_used - ${amount}),
            updated_at = NOW()
          WHERE user_id = ${userId}
          RETURNING ai_credits_total as total, ai_credits_used as used
        `;
        break;
      default:
        return { success: false, newBalance: 0 };
    }

    if (updateResult.length === 0) {
      console.error('[Credits] Failed to refund credits - no record found');
      return { success: false, newBalance: 0 };
    }

    const { total, used } = updateResult[0];
    const newBalance = total === -1 ? -1 : Math.max(0, total - used);

    // Log the refund transaction (positive amount to show credit returned)
    await sql`
      INSERT INTO crewcast.credit_transactions (
        user_id, credit_type, amount, balance_after, reason, reference_id, reference_type
      ) VALUES (
        ${userId}, ${creditType}, ${amount}, ${newBalance}, 'refund', ${referenceId || null}, ${referenceType || null}
      )
    `;

    console.log(`[Credits] ↩️ Refunded ${amount} ${creditType} credit(s) for user ${userId}. New balance: ${newBalance}`);
    
    return { success: true, newBalance };
  } catch (error) {
    console.error('[Credits] Error refunding credits:', error);
    return { success: false, newBalance: 0 };
  }
}

// =============================================================================
// INITIALIZE CREDITS (For new users starting trial)
// =============================================================================

/**
 * Initialize credits for a new user starting their trial
 * 
 * @param userId - The user's database ID
 * @param periodStart - Trial start date
 * @param periodEnd - Trial end date
 */
export async function initializeTrialCredits(
  userId: number,
  periodStart: Date,
  periodEnd: Date,
  executor?: CreditSqlExecutor,
): Promise<boolean> {
  return runCreditTransaction(executor, async (transaction) => {
    // Serialize the direct subscription route and webhook backup path. This
    // prevents both workers from independently deciding that no trial exists.
    const lockedUsers = await transaction<{ id: number }>`
      SELECT id FROM crewcast.users WHERE id = ${userId} FOR UPDATE
    `;
    if (lockedUsers.length !== 1) {
      throw new Error(`Cannot initialize trial credits for missing user ${userId}.`);
    }

    // Check if user already has credits
    const existing = await transaction<{
      id: number;
      period_end: string | Date;
      is_trial_period: boolean;
    }>`
      SELECT id, period_end, is_trial_period FROM crewcast.user_credits WHERE user_id = ${userId}
    `;

    if (existing.length > 0) {
      const existingCredits = existing[0];
      const existingPeriodEnd = new Date(existingCredits.period_end);
      const now = new Date();
      
      // If existing credits are EXPIRED, the user already used their trial
      // They should NOT get another free trial - they need to subscribe
      if (existingPeriodEnd < now) {
        // User has expired credits = they already used their trial/subscription
        console.log(`[Credits] SECURITY: User ${userId} has expired credits (ended ${existingPeriodEnd.toISOString()}). Blocking new trial - must subscribe.`);
        // Leave their expired credits as-is - they need to subscribe to continue
        return true;
      }
      
      // Credits exist and are not expired - skip (prevent duplicate initialization)
      console.log(`[Credits] User ${userId} already has valid credits (ends ${existingPeriodEnd.toISOString()}), skipping initialization`);
      return true;
    }

    // SECURITY: Check if user already had a trial before by looking at credit transactions
    // NOTE: We can't use trial_start_date from crewcast.users table because it's set DURING signup
    // before this function is called. Instead, check if there's a previous trial_start transaction.
    const previousTrialCheck = await transaction`
      SELECT id FROM crewcast.credit_transactions 
      WHERE user_id = ${userId} 
      AND reason IN ('trial_start', 'trial_restart')
      LIMIT 1
    `;
    
    if (previousTrialCheck.length > 0) {
      // User already had a trial before - DO NOT give another trial
      console.log(`[Credits] SECURITY: User ${userId} already used trial (found previous trial transaction). Blocking new trial.`);
      return false;
    }

    // Create credit record with trial credits (same for all users)
    await transaction`
      INSERT INTO crewcast.user_credits (
        user_id,
        topic_search_credits_total,
        email_credits_total,
        ai_credits_total,
        topic_search_credits_used,
        email_credits_used,
        ai_credits_used,
        period_start,
        period_end,
        is_trial_period
      ) VALUES (
        ${userId},
        ${PLAN_CREDITS.trial.topicSearches},
        ${PLAN_CREDITS.trial.email},
        ${PLAN_CREDITS.trial.ai},
        0,
        0,
        0,
        ${periodStart.toISOString()},
        ${periodEnd.toISOString()},
        true
      )
    `;

    // Log the transaction
    await transaction`
      INSERT INTO crewcast.credit_transactions (user_id, credit_type, amount, balance_after, reason, reference_type)
      VALUES 
        (${userId}, 'topic_search', ${PLAN_CREDITS.trial.topicSearches}, ${PLAN_CREDITS.trial.topicSearches}, 'trial_start', 'subscription'),
        (${userId}, 'email', ${PLAN_CREDITS.trial.email}, ${PLAN_CREDITS.trial.email}, 'trial_start', 'subscription'),
        (${userId}, 'ai', ${PLAN_CREDITS.trial.ai}, ${PLAN_CREDITS.trial.ai}, 'trial_start', 'subscription')
    `;

    console.log(`[Credits] Initialized trial credits for user ${userId}: ${PLAN_CREDITS.trial.topicSearches} searches, ${PLAN_CREDITS.trial.email} email, ${PLAN_CREDITS.trial.ai} AI`);
    
    return true;
  });
}

// =============================================================================
// RESET CREDITS (For billing cycle renewal)
// =============================================================================

/**
 * Reset credits for a new MONTHLY entitlement period.
 *
 * IMPORTANT POLICY (April 20th, 2026):
 * ------------------------------------
 * CrewCast's marketing promise is "N credits / month" on every plan, including
 * annual plans. We therefore enforce a MONTHLY entitlement cycle regardless of
 * how Stripe bills the customer.
 *
 * The `periodEnd` argument is INTENTIONALLY IGNORED by this function: callers
 * (the Stripe invoice.paid webhook and the change-subscription route) were
 * previously forwarding Stripe's `subscription.current_period_end`, which for
 * annual subscribers is ~365 days in the future. Using that as the credit
 * window made `checkCredits()` treat the entire year as one window — so once
 * the user exhausted the monthly allowance (e.g. 150 AI credits) they'd be
 * blocked for the rest of the year with a misleading "Insufficient credits"
 * error, while Stripe sat happily not charging them again until the annual
 * renewal. Two paying @selecdoo.com users hit this before the bug was found
 * (see scripts/temp-fix-david.ts, scripts/temp-fix-thomas.ts).
 *
 * The fix here is to derive `period_end = period_start + 1 month` locally,
 * matching the cadence expected by the rolling job at
 * `src/app/api/cron/credit-rollover/route.ts` (which uses the same
 * setUTCMonth(+1) arithmetic for subsequent monthly rolls). This aligns with
 * Stripe's own architectural guidance — keep billing in Stripe, manage
 * recurring entitlement resets in the app — see
 * https://docs.stripe.com/billing/subscriptions/usage-based/advanced/about
 * (service interval vs billing interval).
 *
 * The `periodEnd` parameter is preserved in the signature for backward
 * compatibility with existing callers that still compute it for logging /
 * other purposes. If a future refactor cleans up those callers, the argument
 * can be removed.
 *
 * @param userId - The user's database ID
 * @param plan - The user's plan ('pro', 'business', 'enterprise')
 * @param periodStart - New period start date (authoritative — used as-is)
 * @param periodEnd - IGNORED as of April 20th, 2026. See policy block above.
 */
export async function resetCreditsForNewPeriod(
  userId: number,
  plan: 'pro' | 'business' | 'enterprise',
  periodStart: Date,
  periodEnd: Date,
  options: CreditResetOptions = {},
): Promise<CreditResetOutcome> {
  const stripeInvoiceId = options.stripeInvoiceId;
  if (stripeInvoiceId) assertStripeInvoiceId(stripeInvoiceId);
  if (!Number.isFinite(periodStart.getTime())) throw new Error('Credit period start is invalid.');

  return runCreditTransaction(options.executor, async (transaction) => {
    const lockedUsers = await transaction<{ id: number }>`
      SELECT id FROM crewcast.users WHERE id = ${userId} FOR UPDATE
    `;
    if (lockedUsers.length !== 1) {
      throw new Error(`Cannot reset credits for missing user ${userId}.`);
    }

    if (stripeInvoiceId) {
      const priorReset = await transaction<{ id: number }>`
        SELECT id
        FROM crewcast.credit_transactions
        WHERE user_id = ${userId}
          AND reason = 'reset'
          AND reference_type = 'stripe_invoice'
          AND reference_id = ${stripeInvoiceId}
        LIMIT 1
      `;
      if (priorReset.length > 0) {
        console.log(`[Credits] Stripe invoice ${stripeInvoiceId} already reset credits for user ${userId}`);
        return 'duplicate_invoice';
      }

      const currentPeriods = await transaction<{
        period_start: string | Date;
        is_trial_period: boolean;
      }>`
        SELECT period_start, is_trial_period
        FROM crewcast.user_credits
        WHERE user_id = ${userId}
        LIMIT 1
      `;
      if (currentPeriods.length === 1 && currentPeriods[0].is_trial_period === false) {
        const currentPeriodStart = new Date(currentPeriods[0].period_start);
        if (!Number.isFinite(currentPeriodStart.getTime())) {
          throw new Error(`Stored credit period is invalid for user ${userId}.`);
        }
        if (periodStart.getTime() <= currentPeriodStart.getTime()) {
          console.log(
            `[Credits] Ignored stale Stripe invoice ${stripeInvoiceId} for user ${userId}: `
            + `${periodStart.toISOString()} <= ${currentPeriodStart.toISOString()}`,
          );
          return 'stale_period';
        }
      }
    }

    // SECURITY: Enterprise plan grants unlimited credits (-1)
    // Only allow enterprise if explicitly verified from database
    // This prevents plan injection attacks
    let verifiedPlan = plan;
    if (plan === 'enterprise') {
      const userCheck = await transaction`
        SELECT plan FROM crewcast.users WHERE id = ${userId}
      `;
      if (userCheck.length === 0 || userCheck[0].plan !== 'enterprise') {
        console.error(`[Credits] SECURITY: User ${userId} attempted enterprise credits but is not enterprise. Falling back to pro.`);
        verifiedPlan = 'pro';
      }
    }

    const planCredits = PLAN_CREDITS[verifiedPlan];

    // April 20th, 2026: Always use a 1-month entitlement window regardless of
    // what the caller passed for periodEnd. Using setUTCMonth(+1) preserves
    // the day-of-month anchor for ordinary dates (e.g. the 6th -> 6th next
    // month).
    //
    // Edge case: end-of-month dates OVERFLOW rather than clamp. Jan 31 +1
    // month is not "Feb 28" — setUTCMonth sets the date to Feb 31, which JS
    // then normalises to Mar 3 (non-leap) or Mar 2 (leap). The resulting
    // window is still ~30-31 days and the anniversary day subsequently
    // stabilises on the new value (Mar 3 -> Apr 3 -> May 3 -> ...), so it's
    // functionally correct — just don't expect a Jan-31 anchor to land on
    // the 31st of every later month. This is the IDENTICAL arithmetic used
    // by the credit-rollover cron's addMonths() helper, so the two paths
    // stay in lockstep regardless of which one sets the initial anchor.
    const effectivePeriodEnd = new Date(periodStart.getTime());
    effectivePeriodEnd.setUTCMonth(effectivePeriodEnd.getUTCMonth() + 1);

    // One statement covers both first paid period and renewal. The user lock
    // above serializes competing resets for this account.
    await transaction`
      INSERT INTO crewcast.user_credits (
        user_id,
        topic_search_credits_total,
        email_credits_total,
        ai_credits_total,
        topic_search_credits_used,
        email_credits_used,
        ai_credits_used,
        period_start,
        period_end,
        is_trial_period
      ) VALUES (
        ${userId},
        ${planCredits.topicSearches},
        ${planCredits.email},
        ${planCredits.ai},
        0,
        0,
        0,
        ${periodStart.toISOString()},
        ${effectivePeriodEnd.toISOString()},
        false
      )
      ON CONFLICT (user_id) DO UPDATE
      SET
        topic_search_credits_total = EXCLUDED.topic_search_credits_total,
        email_credits_total = EXCLUDED.email_credits_total,
        ai_credits_total = EXCLUDED.ai_credits_total,
        topic_search_credits_used = 0,
        email_credits_used = 0,
        ai_credits_used = 0,
        period_start = EXCLUDED.period_start,
        period_end = EXCLUDED.period_end,
        is_trial_period = false,
        updated_at = NOW()
    `;

    // Log the transactions
    await transaction`
      INSERT INTO crewcast.credit_transactions (
        user_id,
        credit_type,
        amount,
        balance_after,
        reason,
        reference_id,
        reference_type
      )
      VALUES
        (${userId}, 'topic_search', ${planCredits.topicSearches}, ${planCredits.topicSearches}, 'reset', ${stripeInvoiceId ?? null}, ${stripeInvoiceId ? 'stripe_invoice' : 'invoice'}),
        (${userId}, 'email', ${planCredits.email}, ${planCredits.email}, 'reset', ${stripeInvoiceId ?? null}, ${stripeInvoiceId ? 'stripe_invoice' : 'invoice'}),
        (${userId}, 'ai', ${planCredits.ai}, ${planCredits.ai}, 'reset', ${stripeInvoiceId ?? null}, ${stripeInvoiceId ? 'stripe_invoice' : 'invoice'})
    `;

    console.log(
      `[Credits] Reset credits for user ${userId} to ${plan} plan: ` +
      `${planCredits.topicSearches} searches, ${planCredits.email} email, ${planCredits.ai} AI. ` +
      `Monthly entitlement window ${periodStart.toISOString()} -> ${effectivePeriodEnd.toISOString()}`
    );

    return 'applied';
  });
}

// =============================================================================
// ADD TOP-UP CREDITS (One-time purchase from Stripe Checkout)
// Idempotent: checks credit_purchases table before adding.
// =============================================================================

/**
 * Add top-up credits after successful one-time purchase.
 * Called from Stripe webhook checkout.session.completed.
 *
 * @param userId - Database user ID
 * @param creditType - 'email' | 'ai' | 'topic_search'
 * @param amount - Credits to add
 * @param checkoutSessionId - Stripe checkout session ID (for idempotency)
 * @returns true if credits were added or already completed, false on error
 */
export async function addTopupCredits(
  userId: number,
  creditType: CreditType,
  amount: number,
  checkoutSessionId: string,
  operationId?: string | null,
): Promise<'applied' | 'already_applied' | 'failed'> {
  try {
    if (amount <= 0 || !Number.isInteger(amount)) {
      console.error(`[Credits] SECURITY: Invalid topup amount ${amount} rejected`);
      return 'failed';
    }
    if (
      operationId
      && !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operationId)
    ) {
      console.error('[Credits] SECURITY: Invalid checkout operation ID rejected');
      return 'failed';
    }

    // ==========================================================================
    // ATOMIC FULFILLMENT (M2 fix): The purchase row is CLAIMED first
    // (pending -> completed) and the credit grant happens in the SAME DB
    // transaction. Two concurrent callers (e.g. webhook + fallback fulfill
    // endpoint) can no longer both grant: only one claim succeeds, and if
    // anything fails after the claim, the transaction rolls back and the row
    // returns to 'pending'.
    // ==========================================================================
    // The transaction-scoped client shadows the module-level `sql` so every
    // query below runs inside the transaction.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const granted = await sql.begin(async (sql: any): Promise<'applied' | 'already_applied'> => {
      const completeDurableOperation = async (): Promise<void> => {
        if (!operationId) return;
        const completed = await sql`
          UPDATE crewcast.stripe_credit_checkout_operations
          SET status = 'completed', completed_at = NOW(), updated_at = NOW()
          WHERE operation_id = ${operationId}::uuid
            AND user_id = ${userId}
            AND stripe_checkout_session_id = ${checkoutSessionId}
            AND credit_type = ${creditType}
            AND credits_amount = ${amount}
            AND status = 'session_created'
          RETURNING operation_id
        `;
        if (completed.length === 1) return;
        const existingOperation = await sql`
          SELECT operation_id
          FROM crewcast.stripe_credit_checkout_operations
          WHERE operation_id = ${operationId}::uuid
            AND user_id = ${userId}
            AND stripe_checkout_session_id = ${checkoutSessionId}
            AND credit_type = ${creditType}
            AND credits_amount = ${amount}
            AND status = 'completed'
          LIMIT 2
        `;
        if (existingOperation.length !== 1) {
          throw new Error('[Credits] Durable checkout operation did not complete exactly once');
        }
      };

      // Step 1: Atomically claim the pending purchase.
      const claimed = await sql`
        UPDATE crewcast.credit_purchases
        SET status = 'completed', completed_at = NOW()
        WHERE stripe_checkout_session_id = ${checkoutSessionId}
          AND user_id = ${userId}
          AND credit_type = ${creditType}
          AND credits_amount = ${amount}
          AND status = 'pending'
        RETURNING id
      `;

      if (claimed.length === 0) {
        // Either already completed (idempotent) or the row doesn't exist.
        const existing = await sql`
          SELECT id, user_id, credit_type, credits_amount, status
          FROM crewcast.credit_purchases
          WHERE stripe_checkout_session_id = ${checkoutSessionId}
          LIMIT 2
        `;
        if (existing.length === 0) {
          console.error(`[Credits] No credit_purchases row for session ${checkoutSessionId}`);
          throw new Error(`[Credits] No credit_purchases row for session ${checkoutSessionId}`);
        }
        if (
          existing.length === 1
          && existing[0].user_id === userId
          && existing[0].credit_type === creditType
          && existing[0].credits_amount === amount
          && existing[0].status === 'completed'
        ) {
          await completeDurableOperation();
          console.log(`[Credits] Idempotency: session ${checkoutSessionId} already completed`);
          return 'already_applied';
        }
        throw new Error(`[Credits] Purchase for session ${checkoutSessionId} has mismatched identity or status`);
      }

      // Step 2: Grant the credits (same transaction as the claim).
      let updateResult;
      switch (creditType) {
        case 'topic_search':
          updateResult = await sql`
            UPDATE crewcast.user_credits
            SET topic_search_credits_topup = COALESCE(topic_search_credits_topup, 0) + ${amount},
                updated_at = NOW()
            WHERE user_id = ${userId}
            RETURNING topic_search_credits_topup as topup
          `;
          break;
        case 'email':
          updateResult = await sql`
            UPDATE crewcast.user_credits
            SET email_credits_topup = COALESCE(email_credits_topup, 0) + ${amount},
                updated_at = NOW()
            WHERE user_id = ${userId}
            RETURNING email_credits_topup as topup
          `;
          break;
        case 'ai':
          updateResult = await sql`
            UPDATE crewcast.user_credits
            SET ai_credits_topup = COALESCE(ai_credits_topup, 0) + ${amount},
                updated_at = NOW()
            WHERE user_id = ${userId}
            RETURNING ai_credits_topup as topup
          `;
          break;
        default:
          // Throw (not return) so the claim above rolls back.
          throw new Error(`[Credits] Invalid credit type '${creditType}' for topup`);
      }

      if (updateResult.length === 0) {
        // Throw so the transaction rolls back — never leave the purchase marked
        // 'completed' when no credits were actually granted.
        throw new Error(`[Credits] No user_credits row for user ${userId} - cannot add topup`);
      }

      const newBalance = updateResult[0].topup ?? amount;

      await sql`
        INSERT INTO crewcast.credit_transactions (user_id, credit_type, amount, balance_after, reason, reference_type)
        VALUES (${userId}, ${creditType}, ${amount}, ${newBalance}, 'topup_purchase', 'credit_purchase')
      `;

      // Keep the durable Stripe operation and the actual credit grant in the
      // same transaction. A crash cannot leave one committed without the other.
      await completeDurableOperation();

      console.log(`[Credits] Added ${amount} ${creditType} topup for user ${userId} (session ${checkoutSessionId})`);
      return 'applied';
    });

    return granted;
  } catch (error) {
    // CRITICAL: Log full error details so we can diagnose failures in Vercel logs
    const err = error as Error;
    console.error('[Credits] ❌ TOPUP CREDITS FAILED:', {
      userId,
      creditType,
      amount,
      checkoutSessionId,
      errorName: err?.name,
      errorMessage: err?.message,
      errorStack: err?.stack,
      // Log full error object in case it has non-standard properties (e.g., DB errors)
      fullError: JSON.stringify(error, Object.getOwnPropertyNames(error || {})),
    });
    return 'failed';
  }
}

// =============================================================================
// HELPER: Get plan from subscription
// =============================================================================

/**
 * Map a plan string to valid plan type
 */
export function normalizePlan(plan: string): 'pro' | 'business' | 'enterprise' {
  const normalized = plan.toLowerCase();
  if (normalized === 'business') return 'business';
  if (normalized === 'enterprise') return 'enterprise';
  return 'pro'; // Default to pro
}
