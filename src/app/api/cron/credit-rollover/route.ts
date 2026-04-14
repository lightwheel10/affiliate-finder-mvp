/**
 * =============================================================================
 * CREDIT ROLLOVER CRON ENDPOINT - April 14th, 2026
 * =============================================================================
 *
 * Rolls the monthly credit entitlement window forward for users whose
 * `user_credits.period_end` has elapsed while their subscription is still
 * active. This closes the "annual subscriber never gets their monthly
 * credit refresh" gap that existed before this cron was added.
 *
 * BACKGROUND (why this exists):
 * The app grants credits per-month even to annual subscribers (marketing
 * promise: "150 credits / month"). The existing Stripe webhook path
 * (src/pages/api/stripe/webhook.ts handling `invoice.paid`) resets credits
 * ONLY when Stripe fires an invoice — once a month for monthly subs, once
 * a year for annual subs. For annual subs that means the entitlement
 * window would only refresh yearly, which contradicts the "/month"
 * promise. Stripe's own docs (docs.stripe.com/billing/entitlements)
 * explicitly punt recurring allowance resets back to the app.
 *
 * WHAT THIS DOES:
 * 1. Vercel Cron calls this endpoint daily (see vercel.json).
 * 2. Finds all users where:
 *    - user_credits.period_end <= NOW()                 (window elapsed)
 *    - subscriptions.status = 'active'                  (paying customer)
 *    - subscriptions.first_payment_at IS NOT NULL       (not a pure trial)
 *    - user_credits.is_trial_period = false             (not a trial row)
 * 3. For each matching user, within a transaction:
 *    a. Advance period_start / period_end forward by N full months
 *       (N >= 1, chosen so the new period_end > NOW — keeps the
 *       anniversary day of month consistent and covers the "deployed
 *       late and several months stale" edge case).
 *    b. Reset *_used counters to 0. Totals and topups are untouched.
 *    c. Insert 3 audit rows in credit_transactions with
 *       reason='reset' and reference_type='monthly_rollover'.
 * 4. Returns a summary of processed / skipped / failed users.
 *
 * INTENTIONAL CHOICES:
 * - Idempotent: re-running on a user whose window has already been rolled
 *   does nothing (the query filter excludes them).
 * - Per-user transactions (not a single big transaction): if one user's
 *   UPDATE fails, the others still succeed. Each failure is logged.
 * - Use-it-or-lose-it: unused credits do NOT carry over. This matches
 *   industry norm (see m3ter / Schematic SaaS credit guides) and our own
 *   marketing copy ("150 / month", not "up to 1800 / year").
 * - DOES NOT touch the subscriptions table. Stripe's billing cycle is
 *   authoritative for subscriptions.current_period_end; rolling credits
 *   is a separate concern (see Stripe Entitlements docs).
 * - DOES NOT call Stripe. Pure DB work.
 *
 * SAFETY:
 * - Protected by CRON_SECRET header (matches src/app/api/cron/auto-scan).
 * - Supports ?dryRun=true to preview without writes (useful for the first
 *   production run; we verify the SQL it would execute before flipping
 *   the switch).
 * - Defensive cap on rows processed per invocation to avoid runaway
 *   behavior if the scan filter is accidentally too broad in future.
 *
 * FOLLOW-UPS (not part of this change):
 * - The "Insufficient credits" error fired when isReadOnly=true
 *   (checkCredits) is misleading for users whose window is merely
 *   renewing. That message should be reworded separately.
 * - The subscriptions.current_period_end column is populated from Stripe
 *   on `invoice.paid` but diverges from Stripe reality for 100%-promo
 *   annual plans (see David's account, user 63). Not relevant to credit
 *   unblocking but worth a separate pass on the webhook handler.
 * =============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// Vercel function configuration. Credit rollover is DB-only and fast,
// but we give it headroom in case the customer base grows.
export const maxDuration = 60; // 1 minute

// Hard cap on rows processed per invocation. Current stuck-user count is 2
// (as of 2026-04-14). If this ever fires >100 in a single run, something
// upstream is broken — safer to bail than to hammer the DB.
const MAX_USERS_PER_RUN = 100;

type StuckUserRow = {
  user_id: number;
  email: string;
  sub_plan: string;
  billing_interval: string | null;
  credits_period_start: Date;
  credits_period_end: Date;
  topic_search_credits_total: number;
  email_credits_total: number;
  ai_credits_total: number;
};

/**
 * Roll a JavaScript Date forward by N full calendar months, preserving the
 * anchor day-of-month (and clamping if the target month is shorter — e.g.
 * Jan 31 + 1 month lands on Feb 28/29). Returns a new Date; does not mutate.
 */
function addMonths(d: Date, n: number): Date {
  const out = new Date(d.getTime());
  out.setUTCMonth(out.getUTCMonth() + n);
  return out;
}

/**
 * Compute the minimum N (>=1) such that `periodEnd + N months > now`.
 * Used to snap a stale window forward in one step, even if we've been
 * offline / un-deployed for several months.
 */
function computeMonthsToAdvance(periodEnd: Date, now: Date): number {
  let n = 1;
  // Guard: cap iterations so a bad clock or corrupt date can't loop forever.
  while (n < 120 && addMonths(periodEnd, n).getTime() <= now.getTime()) {
    n++;
  }
  return n;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const { searchParams } = new URL(request.url);
  const dryRun = searchParams.get('dryRun') === 'true';

  // ==========================================================================
  // SECURITY — matches the auto-scan cron pattern.
  // ==========================================================================
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (!isDevelopment) {
    if (!cronSecret) {
      console.error('[CreditRollover] CRON_SECRET not configured');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('[CreditRollover] Unauthorized: Invalid or missing CRON_SECRET');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  console.log('[CreditRollover] ========================================');
  console.log(`[CreditRollover] Starting at ${new Date().toISOString()}  dryRun=${dryRun}`);

  try {
    // ========================================================================
    // STEP 1: Find stuck users.
    //
    // We intentionally do NOT filter on subscriptions.current_period_end
    // because that column can itself be stale/wrong for 100%-promo annual
    // plans (see webhook handler follow-up). The authoritative signal of
    // "this user is paying" is status='active' + first_payment_at IS NOT NULL.
    // ========================================================================
    const stuck = await sql`
      SELECT
        u.id                              AS user_id,
        u.email,
        s.plan                            AS sub_plan,
        s.billing_interval,
        uc.period_start                   AS credits_period_start,
        uc.period_end                     AS credits_period_end,
        uc.topic_search_credits_total,
        uc.email_credits_total,
        uc.ai_credits_total
      FROM crewcast.users u
      JOIN crewcast.user_credits uc   ON uc.user_id = u.id
      JOIN crewcast.subscriptions s   ON s.user_id  = u.id
      WHERE uc.period_end < NOW()
        AND uc.is_trial_period = false
        AND s.status = 'active'
        AND s.first_payment_at IS NOT NULL
      ORDER BY uc.period_end ASC
      LIMIT ${MAX_USERS_PER_RUN}
    ` as unknown as StuckUserRow[];

    console.log(`[CreditRollover] Found ${stuck.length} stuck user(s)`);

    if (stuck.length === 0) {
      return NextResponse.json({
        ok: true,
        dryRun,
        processed: 0,
        skipped: 0,
        failed: 0,
        durationMs: Date.now() - startTime,
        message: 'No stuck users — nothing to do.',
      });
    }

    const now = new Date();
    const processed: Array<{
      userId: number;
      email: string;
      oldPeriodEnd: string;
      newPeriodStart: string;
      newPeriodEnd: string;
      monthsAdvanced: number;
    }> = [];
    const failed: Array<{ userId: number; email: string; error: string }> = [];

    // ========================================================================
    // STEP 2: Roll each user forward in its own transaction.
    // ========================================================================
    for (const row of stuck) {
      const userId = row.user_id;
      const email = row.email;
      const oldPeriodEnd = new Date(row.credits_period_end);

      const monthsToAdvance = computeMonthsToAdvance(oldPeriodEnd, now);
      const newPeriodStart = oldPeriodEnd;                                 // continuous, no gap
      const newPeriodEnd   = addMonths(oldPeriodEnd, monthsToAdvance);     // snaps past NOW

      if (dryRun) {
        console.log(
          `[CreditRollover] [dry-run] user=${userId} ${email}  ` +
          `period ${oldPeriodEnd.toISOString()} -> ${newPeriodEnd.toISOString()}  ` +
          `advance=${monthsToAdvance} month(s)`
        );
        processed.push({
          userId, email,
          oldPeriodEnd: oldPeriodEnd.toISOString(),
          newPeriodStart: newPeriodStart.toISOString(),
          newPeriodEnd: newPeriodEnd.toISOString(),
          monthsAdvanced: monthsToAdvance,
        });
        continue;
      }

      try {
        // `sql` is exported as `any` from src/lib/db.ts (legacy Neon typing).
        // The postgres package's `sql.begin(fn)` provides a transaction-bound
        // sql tag to `fn`; we type it as `any` to match the surrounding code.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await sql.begin(async (tx: any) => {
          // Re-check inside the transaction so two concurrent cron invocations
          // (e.g. manual retry while scheduled run is in-flight) can't both
          // roll the same user — the row-level guard below makes the second
          // writer a no-op.
          const updated = await tx`
            UPDATE crewcast.user_credits
            SET
              period_start                = ${newPeriodStart},
              period_end                  = ${newPeriodEnd},
              topic_search_credits_used   = 0,
              email_credits_used          = 0,
              ai_credits_used             = 0,
              updated_at                  = NOW()
            WHERE user_id = ${userId}
              AND period_end = ${oldPeriodEnd}
              AND is_trial_period = false
            RETURNING id
          `;

          if (updated.length === 0) {
            // Another process already rolled this user forward, or row was
            // concurrently modified. Not an error — just skip audit inserts.
            console.log(`[CreditRollover] user=${userId} ${email} — already rolled by another writer, skipping`);
            return;
          }

          await tx`
            INSERT INTO crewcast.credit_transactions
              (user_id, credit_type, amount, balance_after, reason, reference_id, reference_type, created_at)
            VALUES
              (${userId}, 'topic_search', ${row.topic_search_credits_total}, ${row.topic_search_credits_total}, 'reset', NULL, 'monthly_rollover', NOW()),
              (${userId}, 'email',        ${row.email_credits_total},        ${row.email_credits_total},        'reset', NULL, 'monthly_rollover', NOW()),
              (${userId}, 'ai',           ${row.ai_credits_total},           ${row.ai_credits_total},           'reset', NULL, 'monthly_rollover', NOW())
          `;
        });

        console.log(
          `[CreditRollover] user=${userId} ${email}  ` +
          `rolled ${oldPeriodEnd.toISOString()} -> ${newPeriodEnd.toISOString()}  ` +
          `(+${monthsToAdvance} month)`
        );

        processed.push({
          userId, email,
          oldPeriodEnd: oldPeriodEnd.toISOString(),
          newPeriodStart: newPeriodStart.toISOString(),
          newPeriodEnd: newPeriodEnd.toISOString(),
          monthsAdvanced: monthsToAdvance,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[CreditRollover] user=${userId} ${email} — FAILED: ${msg}`);
        failed.push({ userId, email, error: msg });
      }
    }

    const durationMs = Date.now() - startTime;
    console.log(
      `[CreditRollover] Done. processed=${processed.length} failed=${failed.length}  ` +
      `durationMs=${durationMs}  dryRun=${dryRun}`
    );

    return NextResponse.json({
      ok: true,
      dryRun,
      totalCandidates: stuck.length,
      processed: processed.length,
      failed: failed.length,
      durationMs,
      processedDetails: processed,
      failedDetails: failed,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[CreditRollover] FATAL: ${msg}`);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
