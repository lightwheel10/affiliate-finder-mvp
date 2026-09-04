/**
 * =============================================================================
 * AUTO-SCAN CRON ENDPOINT - January 29th, 2026
 * =============================================================================
 * 
 * MAJOR REFACTOR: January 29th, 2026 - Apify Polling Architecture
 * 
 * This endpoint is triggered by Vercel Cron to automatically scan for new
 * affiliates for paid users.
 * 
 * HOW IT WORKS:
 * 1. Vercel Cron calls this endpoint hourly (configured in vercel.json).
 * 2. With multi-brand locations disabled, the existing single-default-location
 *    scheduler remains unchanged.
 * 3. With multi-brand locations enabled, one durable account batch captures
 *    every active, searchable location due in the same weekly occurrence.
 * 4. The batch reserves exactly one account topic-search credit. Each cron
 *    invocation claims and processes one captured location so provider polling
 *    remains inside Vercel's 300-second function limit.
 * 5. Provider launch intent, run ID, result counts and terminal outcome are
 *    stored durably. Ambiguous paid work is never replayed or refunded.
 * 6. When the account has no topic-search credit, auto-scan is switched off for
 *    the account and all active locations until the user enables it again.
 * 
 * PROVIDER ARCHITECTURE (January 29th, 2026):
 * - Changed from 10 users/run (Serper) to 1 user/run (Apify)
 * - Apify runs take 40-95s vs Serper's 2-3s
 * - Single user per run stays within Vercel 300s limit
 * - Hourly cron ensures accounts and their captured locations are processed
 *   over time
 * 
 * SECURITY:
 * - Protected by CRON_SECRET header (Vercel auto-sends this)
 * - Only runs on Vercel (checks for Vercel environment)
 * - Rate limited by cron schedule (max 1 execution per hour)
 * 
 * SCAN INTERVAL: 7 days for all plans (Pro, Business, Enterprise)
 * 
 * =============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { sql } from '@/lib/db';
import { checkCredits, consumeCredits } from '@/lib/credits';
import { 
  SearchResult,
  Platform,
  filterWebResults,
  filterSocialResults,
} from '@/app/services/search';
import {
  enrichYouTubeByUrls,
  enrichInstagramByUrls,
  enrichTikTokByUrls,
  abortEnrichmentRun,
  fetchInstagramEnrichmentResults,
  fetchRunCostUsd,
  fetchRunCostsUsd,
  fetchTikTokEnrichmentResults,
  fetchYouTubeEnrichmentResults,
  getEnrichmentRunStatusStrict,
  startEnrichmentPlatform,
} from '@/app/services/apify';
import {
  abortGoogleSearchRun,
  startGoogleSearchRun,
  getRunStatus,
  fetchAndProcessResults,
  type GoogleScraperStatus,
} from '@/app/services/apify-google-scraper';
import { trackSearch, completeSearch, API_COSTS } from '@/app/services/tracking';
// 2026-05-04: Resend transactional email — last of 6 email wirings.
// See also src/pages/api/stripe/webhook.ts and src/app/api/users/route.ts.
import { waitUntil } from '@vercel/functions';
import { sendEmail } from '@/lib/email';
import { getAppUrl } from '@/lib/app-url';
import { ScanSummaryEmail, scanSummaryEmailSubject } from '@/emails/scan-summary';
import { resolveServerBrandLocationContext } from '@/lib/brand-locations/server';
import type { BrandLocationContext } from '@/lib/brand-locations/context';
import { isMultiBrandLocationsEnabled } from '@/lib/feature-flags';
import type { SearchStartSqlExecutor } from '@/lib/search/start-postgres';
import {
  claimNextWeeklyScanWork,
  completeWeeklyScanLocation,
  deferWeeklyScanLocation,
  failWeeklyScanLocation,
  getWeeklyScanProviderRun,
  prepareWeeklyScanEnrichmentProvider,
  prepareWeeklyScanPrimaryProvider,
  recordWeeklyScanProviderRun,
  settleWeeklyScanProviderRun,
  type WeeklyScanCompletion,
} from '@/lib/weekly-scan/weekly-scan-postgres';
import {
  classifyWeeklyScanWorkerFailure,
  normalizeWeeklyScanRunError,
  WeeklyScanDeferredError,
  WeeklyScanExecutionError,
} from '@/lib/weekly-scan/weekly-scan';
import { saveWeeklyDiscoveredAffiliates } from '@/lib/weekly-scan/affiliate-persistence';
import { truncateProviderText } from '@/lib/search/status';
import {
  buildEnrichmentDispatchInputs,
  type EnrichmentDispatchInput,
} from '@/lib/search/enrichment-dispatch';
import { buildGoogleProviderInput } from '@/lib/search/provider-input';
import {
  executeWeeklyProvider,
  sumExactWeeklyProviderCosts,
  weeklyProviderCorrelationId,
  weeklyProviderInputFingerprint,
  type WeeklyProviderExecution,
  type WeeklyProviderLaunchInput,
  type WeeklyProviderResumeState,
  type WeeklyProviderSettlement,
  type WeeklyScanProvider,
} from '@/lib/weekly-scan/provider-runs';

const WEEKLY_PROVIDER_MAX_AGE_MS = 30 * 60 * 1_000;
const WEEKLY_PROVIDER_COST_STABILIZATION_MS = 10_000;

// =============================================================================
// VERCEL FUNCTION CONFIGURATION
// January 29th, 2026: Single user per run with Apify polling
// =============================================================================
export const maxDuration = 300; // 5 minutes - Vercel Pro plan limit

// =============================================================================
// CONSTANTS - January 29th, 2026
// =============================================================================
const SCAN_INTERVAL_DAYS = 7; // All plans get 7-day scan interval
const MAX_USERS_PER_RUN = 1; // Changed from 10 to 1 for Apify polling (40-95s per user)

/**
 * GET /api/cron/auto-scan
 * 
 * Triggered by Vercel Cron. Finds users due for auto-scan and processes them.
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  // ==========================================================================
  // SECURITY: Verify request is from Vercel Cron
  // ==========================================================================
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  // In development, allow without secret for testing
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (!isDevelopment) {
    if (!cronSecret) {
      console.error('[AutoScan] CRON_SECRET not configured');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('[AutoScan] Unauthorized: Invalid or missing CRON_SECRET');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }
  
  console.log('[AutoScan] ========================================');
  console.log('[AutoScan] Starting auto-scan cron job (Apify Polling)...');
  console.log(`[AutoScan] Time: ${new Date().toISOString()}`);
  console.log(`[AutoScan] Max users per run: ${MAX_USERS_PER_RUN}`);
  
  try {
    // ========================================================================
    // STEP 0: Sweep search jobs frozen at 'enriching' — 2026-07-29 10:33 IST (Paras)
    //
    // WHY: a job's status only advances while a browser polls
    // /api/search/status. If the user walks away before the last enrichment
    // actor finishes (or the final poll dies at maxDuration mid-save), the job
    // stays 'enriching' forever even though its results were already saved
    // incrementally. Verified against Apify on 2026-07-29 for jobs 4/7/14/53:
    // every actor run SUCCEEDED, only the 'done' stamp was missing.
    //
    // SAFETY: This compatibility sweep is restricted to legacy jobs. Jobs
    // using durable credit reservations or per-platform launch intents must
    // finish through the transactional finalizer; force-stamping them done
    // would bypass billing and could hide an uncertain paid actor launch.
    // results_count mirrors the onboarding fast path in search/status
    // (count of the user's discovered_affiliates). Failure here must never
    // block the actual scan below, hence its own try/catch.
    // ========================================================================
    try {
      const sweptJobs = await sql`
        UPDATE crewcast.search_jobs j
        SET status = 'done',
            enrichment_status = 'succeeded',
            completed_at = NOW(),
            results_count = COALESCE(j.results_count, (
              SELECT COUNT(*)::int FROM crewcast.discovered_affiliates d
              WHERE d.user_id = j.user_id
                AND d.brand_id = j.brand_id
                AND d.brand_location_id = j.brand_location_id
            ))
        WHERE j.status = 'enriching'
          AND j.created_at < NOW() - INTERVAL '24 hours'
          AND NOT EXISTS (
            SELECT 1
            FROM crewcast.search_credit_reservations AS reservations
            WHERE reservations.search_job_id = j.id
              AND reservations.user_id = j.user_id
          )
          AND NOT EXISTS (
            SELECT 1
            FROM crewcast.search_enrichment_dispatches AS dispatches
            WHERE dispatches.search_job_id = j.id
              AND dispatches.user_id = j.user_id
          )
        RETURNING j.id, j.user_id, j.keyword, j.apify_run_id, j.enrichment_run_ids
      `;
      if (sweptJobs.length > 0) {
        console.log(`[AutoScan] Swept ${sweptJobs.length} stale 'enriching' job(s) to 'done': ${sweptJobs.map((j: { id: number; user_id: number }) => `#${j.id} (user ${j.user_id})`).join(', ')}`);

        // 2026-07-29 11:15 IST (Paras): swept jobs never reached the normal
        // done-stamp, so they also never captured their real Apify bill (see
        // fetchRunCostsUsd in services/apify.ts). Do it here while Apify still
        // remembers the runs — swept jobs are 1-7 days old, well inside the
        // retention window. NULL result (expired/failed) just keeps the
        // estimate-based fallback in cost reporting.
        for (const j of sweptJobs as Array<{ id: number; apify_run_id: string | null; enrichment_run_ids: unknown }>) {
          const runIds = typeof j.enrichment_run_ids === 'string'
            ? JSON.parse(j.enrichment_run_ids)
            : (j.enrichment_run_ids as Record<string, string> | null);
          const realCostUsd = await fetchRunCostsUsd([
            j.apify_run_id,
            runIds?.youtube, runIds?.instagram, runIds?.tiktok, runIds?.similarweb,
          ]);
          if (realCostUsd !== null) {
            await sql`
              UPDATE crewcast.search_jobs SET estimated_cost = ${realCostUsd}
              WHERE id = ${j.id} AND estimated_cost IS NULL
            `;
            console.log(`[AutoScan] Job #${j.id}: real Apify cost captured $${realCostUsd.toFixed(4)}`);
          }
        }
      }

      // TODO 2026-07-29 (Paras): this cron's OWN scans still record estimated
      // costs only (via API_COSTS in completeSearch below). Exact capture here
      // needs enrichYouTubeByUrls/enrichInstagramByUrls/enrichTikTokByUrls to
      // return their Apify run ids — a signature change touching all callers.
      // Deferred while auto-scan only serves team accounts (0 paying customers
      // on 2026-07-29); do it before real customers accumulate cron scans.
    } catch (sweepError) {
      console.error('[AutoScan] Stale-job sweep failed (scan continues):', sweepError);
    }

    // The feature-flag boundary is also the scheduler cutover boundary. With
    // the flag off, the legacy one-default-location path below remains intact.
    // With it on, only the durable account-batch scheduler can create work.
    if (isMultiBrandLocationsEnabled()) {
      return processWeeklyBatchCron(startTime);
    }

    // ========================================================================
    // STEP 1: Find users due for auto-scan
    // ========================================================================
    const dueUsers = await sql`
      SELECT 
        s.user_id,
        s.next_auto_scan_at,
        s.first_payment_at,
        u.email,
        u.name
      FROM crewcast.subscriptions s
      JOIN crewcast.users u ON s.user_id = u.id
      WHERE
        s.status = 'active'
        AND s.first_payment_at IS NOT NULL
        AND s.next_auto_scan_at IS NOT NULL
        AND s.next_auto_scan_at <= NOW()
        -- 2026-08-03 (Paras): per-user opt-out (Settings -> Profile -> Weekly
        -- Auto-Scan). Each scan costs 1 topic_search credit; David asked for a
        -- way to stop it. COALESCE keeps pre-migration rows scanning (NULL =
        -- enabled). Filtering here (in SQL, not by skipping in JS) means a
        -- disabled user can never pin the queue head — see the May 1 starvation
        -- incident comment below. Their next_auto_scan_at freezes while off;
        -- the PATCH in api/users/route.ts resets stale schedules on re-enable.
        AND COALESCE(u.auto_scan_enabled, TRUE)
      ORDER BY s.next_auto_scan_at ASC
      LIMIT ${MAX_USERS_PER_RUN}
    `;
    
    console.log(`[AutoScan] Found ${dueUsers.length} users due for auto-scan`);
    
    if (dueUsers.length === 0) {
      console.log('[AutoScan] No users due for scan. Exiting.');
      return NextResponse.json({
        success: true,
        message: 'No users due for auto-scan',
        usersProcessed: 0,
        duration: Date.now() - startTime,
      });
    }
    
    // ========================================================================
    // STEP 2: Process each user
    // ========================================================================
    const results: Array<{
      userId: number;
      email: string;
      status: 'success' | 'no_credits' | 'no_keywords' | 'error';
      resultsFound?: number;
      error?: string;
    }> = [];
    
    for (const user of dueUsers) {
      const userId = user.user_id as number;
      const userEmail = user.email as string;
      const userName = (user.name as string | null) ?? null; // 2026-05-04: scan-summary email
      let locationContext: BrandLocationContext | null = null;
      
      console.log(`[AutoScan] Processing user ${userId} (${userEmail})`);
      
      try {
        // Compatibility behavior is explicit: until the per-location scheduler
        // is activated, the existing account-level schedule scans only the
        // account's active default location. It never reads mutable profile
        // fields or writes results without immutable location ownership.
        locationContext = await resolveServerBrandLocationContext({ accountId: userId });
        const topics = locationContext.location.topics;
        const competitors = locationContext.location.competitors;

        // Check if user has topic_search credits
        const creditCheck = await checkCredits(userId, 'topic_search', 1);
        
        if (!creditCheck.allowed) {
          console.log(`[AutoScan] User ${userId}: No credits available (${creditCheck.remaining} remaining)`);
          results.push({ userId, email: userEmail, status: 'no_credits' });

          // ===================================================================
          // QUEUE SELF-HEAL — May 1, 2026 (incident fix)
          //
          // Previous behaviour was `continue` WITHOUT advancing the schedule.
          // Combined with the `LIMIT 1 ORDER BY next_auto_scan_at ASC` query
          // above, that pinned any out-of-credits user at the head of the
          // queue forever — every hour the cron re-fetched the same user,
          // re-skipped, exited, and starved every other paying user behind
          // them. We hit exactly that: a single trial-spend user (id=24,
          // 5/5 used) blocked all other paying customers' weekly scans for
          // ~3 months. Their countdown UI stayed stuck on "Scanning..."
          // because next_auto_scan_at never advanced.
          //
          // Fix: still advance the schedule by SCAN_INTERVAL_DAYS (same as
          // the success / no_keywords / error branches already do — see
          // line 188 + 228) so the queue moves on. The user is re-attempted
          // on their next natural slot. If they buy credits sooner, the
          // manual "Find Affiliates" button still works — only the auto-scan
          // is delayed up to 7 days.
          // ===================================================================
          await updateScanSchedule(
            userId,
            locationContext.brand.id,
            locationContext.location.id,
          );
          continue;
        }
        
        // Check if user has keywords to search
        if (topics.length === 0 && competitors.length === 0) {
          console.log(`[AutoScan] User ${userId}: No topics or competitors configured`);
          results.push({ userId, email: userEmail, status: 'no_keywords' });
          
          // Still update the schedule - they can add keywords later
          await updateScanSchedule(
            userId,
            locationContext.brand.id,
            locationContext.location.id,
          );
          continue;
        }
        
        // Get user's target settings
        const targetCountry = locationContext.location.countryCode;
        const targetLanguage = locationContext.location.languageCode;
        const userBrand = locationContext.brand.name;
        const userDomain = locationContext.brand.normalizedDomain;
        
        console.log(`[AutoScan] User ${userId}: Scanning ${topics.length} topics + ${competitors.length} competitors`);
        
        // Run the scan with Apify polling
        // January 29, 2026: Pass topics and competitors directly (no more buildSearchKeywords)
        // January 29, 2026: Pass userBrand for social filtering (exclude own accounts)
        const scanResult = await runAutoScan(
          userId,
          locationContext.brand.id,
          locationContext.location.id,
          topics,
          competitors,
          userBrand,
          userDomain,
          targetCountry,
          targetLanguage,
        );
        
        // Consume credit (only if we found results or attempted search)
        const consumeResult = await consumeCredits(userId, 'topic_search', 1, 'auto_scan', 'cron');
        if (consumeResult.success) {
          console.log(`[AutoScan] User ${userId}: Consumed 1 credit. New balance: ${consumeResult.newBalance}`);
        } else {
          // 2026-05-09 (paras): consumeCredits returned success: false but we
          // still ran Apify and saved affiliates to the user's discovered list.
          // Most likely cause: race between the upstream checkCredits (above)
          // and this deduct — user spent their last credit manually during the
          // 40-95s Apify window. Other causes: missing user_credits row, DB
          // exception, UPDATE affected 0 rows (see src/lib/credits.ts).
          //
          // We DON'T skip the email or roll back the scan — the user already
          // got the value (affiliates are in the DB). This is purely an
          // internal accounting hiccup we eat the Apify cost on (~$0.02-0.10).
          // The loud log is so we can detect it in Vercel logs / alerting if
          // it ever starts happening at scale.
          console.error(
            `[AutoScan] User ${userId}: consumeCredits FAILED for topic_search (amount=1, source=cron). Apify scan already ran and ${scanResult.totalResults} affiliates were saved — we ate the cost. Investigate user_credits row state.`
          );
        }
        
        // Update scan schedule
        await updateScanSchedule(
          userId,
          locationContext.brand.id,
          locationContext.location.id,
        );
        
        results.push({
          userId,
          email: userEmail,
          status: 'success',
          resultsFound: scanResult.totalResults,
        });
        
        console.log(`[AutoScan] User ${userId}: Scan complete. Found ${scanResult.totalResults} affiliates.`);

        // SCAN-SUMMARY EMAIL — added 2026-05-04
        // Skip when 0 affiliates (avoid sending a "0 found" filler email).
        // Locale/name trade-offs: same as the payment-success block in webhook.ts.
        if (scanResult.totalResults > 0 && userEmail) {
          const summaryEmailLocale = 'de' as const;
          const summaryName = userName ?? 'there';

          waitUntil(
            sendEmail({
              to: userEmail,
              subject: scanSummaryEmailSubject(summaryEmailLocale, scanResult.totalResults),
              react: ScanSummaryEmail({
                name: summaryName,
                locale: summaryEmailLocale,
                affiliatesFound: scanResult.totalResults,
                sources: scanResult.sourceCounts,
                appUrl: getAppUrl(),
              }),
            })
          );

          console.log(`[AutoScan] ✅ Scan-summary email queued for user ${userId}`);
        }

      } catch (userError) {
        const errorMessage = userError instanceof Error ? userError.message : 'Unknown error';
        console.error(`[AutoScan] User ${userId}: Error - ${errorMessage}`);
        results.push({ userId, email: userEmail, status: 'error', error: errorMessage });
        
        // Still update schedule to prevent stuck users
        await updateScanSchedule(
          userId,
          locationContext?.brand.id,
          locationContext?.location.id,
        );
      }
    }
    
    // ========================================================================
    // STEP 3: Summary
    // ========================================================================
    const successCount = results.filter(r => r.status === 'success').length;
    const noCreditsCount = results.filter(r => r.status === 'no_credits').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    const duration = Date.now() - startTime;
    
    console.log('[AutoScan] ========================================');
    console.log(`[AutoScan] Cron job complete!`);
    console.log(`[AutoScan] - Users processed: ${results.length}`);
    console.log(`[AutoScan] - Successful scans: ${successCount}`);
    console.log(`[AutoScan] - No credits: ${noCreditsCount}`);
    console.log(`[AutoScan] - Errors: ${errorCount}`);
    console.log(`[AutoScan] - Duration: ${duration}ms`);
    console.log('[AutoScan] ========================================');
    
    return NextResponse.json({
      success: true,
      usersProcessed: results.length,
      successCount,
      noCreditsCount,
      errorCount,
      duration,
      results,
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AutoScan] Fatal error:', errorMessage);
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      duration: Date.now() - startTime,
    }, { status: 500 });
  }
}

/**
 * Notifications are deliberately best-effort and outside the scan state
 * machine. A transient user lookup or email-provider failure must never turn
 * already-completed paid work into a failed/uncertain weekly-scan location.
 */
async function queueWeeklyBatchSummary(
  accountId: number,
  completion: WeeklyScanCompletion,
): Promise<void> {
  if (
    !completion.batchFinished
    || completion.totalResults <= 0
    || completion.batchStatus === 'uncertain'
  ) {
    return;
  }
  try {
    const users = await sql<{ email: string | null; name: string | null }[]>`
      SELECT email, name
      FROM crewcast.users
      WHERE id = ${accountId}
      LIMIT 2
    `;
    if (users.length !== 1 || !users[0].email) return;
    const locale = 'de' as const;
    waitUntil(
      sendEmail({
        to: users[0].email,
        subject: scanSummaryEmailSubject(locale, completion.totalResults),
        react: ScanSummaryEmail({
          name: users[0].name ?? 'there',
          locale,
          affiliatesFound: completion.totalResults,
          sources: completion.sourceCounts,
          appUrl: getAppUrl(),
        }),
      }).catch((error: unknown) => {
        console.error(
          `[AutoScan] Account ${accountId}: weekly summary email failed after scan finalization:`,
          errorMessage(error),
        );
      }),
    );
  } catch (error: unknown) {
    console.error(
      `[AutoScan] Account ${accountId}: weekly summary could not be queued after scan finalization:`,
      errorMessage(error),
    );
  }
}

async function processWeeklyBatchCron(startTime: number) {
  const executor = sql as SearchStartSqlExecutor;
  const claim = await claimNextWeeklyScanWork(executor, {
    now: new Date(),
    batchId: randomUUID(),
    claimToken: randomUUID(),
  });

  if (claim.outcome === 'idle') {
    return NextResponse.json({
      success: true,
      message: 'No weekly scan work is currently claimable.',
      workProcessed: 0,
      duration: Date.now() - startTime,
    });
  }
  if (claim.outcome === 'disabled_insufficient') {
    console.warn(
      `[AutoScan] Account ${claim.accountId}: weekly scan switched off because no topic-search credit was available.`,
    );
    return NextResponse.json({
      success: true,
      outcome: claim.outcome,
      accountId: claim.accountId,
      workProcessed: 0,
      duration: Date.now() - startTime,
    });
  }
  if (claim.outcome === 'no_work') {
    return NextResponse.json({
      success: true,
      outcome: claim.outcome,
      accountId: claim.accountId,
      batchId: claim.batchId,
      workProcessed: 0,
      duration: Date.now() - startTime,
    });
  }

  const { work } = claim;
  let providerRunRecorded = false;
  try {
    const scanResult = await runAutoScan(
      work.accountId,
      work.brandId,
      work.brandLocationId,
      work.settings.topics,
      work.settings.competitors,
      work.settings.brandName,
      work.settings.normalizedDomain,
      work.settings.countryCode,
      work.settings.languageCode,
      {
        existingSearchId: work.searchId,
        providerCorrelationId: (provider) => weeklyProviderCorrelationId({
          batchId: work.batchId,
          brandLocationId: work.brandLocationId,
          provider,
        }),
        loadProviderState: async (launch) => {
          const state = await getWeeklyScanProviderRun(executor, work, launch);
          if (state?.providerRunId) providerRunRecorded = true;
          return state;
        },
        prepareProviderLaunch: (launch, searchId) => launch.provider === 'google'
          ? prepareWeeklyScanPrimaryProvider(executor, work, {
            now: new Date(),
            searchId,
            launch,
          })
          : prepareWeeklyScanEnrichmentProvider(executor, work, {
            now: new Date(),
            launch,
          }),
        providerStarted: async (launch, providerRunId) => {
          await recordWeeklyScanProviderRun(executor, work, launch, providerRunId);
          providerRunRecorded = true;
        },
        providerFinished: (launch, settlement) =>
          settleWeeklyScanProviderRun(executor, work, launch, settlement),
      },
    );
    const completion = await completeWeeklyScanLocation(executor, work, {
      resultsCount: scanResult.totalResults,
      sourceCounts: scanResult.sourceCounts,
    });
    await queueWeeklyBatchSummary(work.accountId, completion);
    return NextResponse.json({
      success: true,
      outcome: 'location_succeeded',
      accountId: work.accountId,
      batchId: work.batchId,
      brandLocationId: work.brandLocationId,
      resultsFound: scanResult.totalResults,
      batchFinished: completion.batchFinished,
      batchStatus: completion.batchStatus,
      workProcessed: 1,
      duration: Date.now() - startTime,
    });
  } catch (error) {
    if (error instanceof WeeklyScanDeferredError) {
      await deferWeeklyScanLocation(executor, work);
      return NextResponse.json({
        success: true,
        outcome: 'location_deferred',
        accountId: work.accountId,
        batchId: work.batchId,
        brandLocationId: work.brandLocationId,
        batchFinished: false,
        batchStatus: null,
        workProcessed: 1,
        duration: Date.now() - startTime,
      });
    }
    const failure = classifyWeeklyScanWorkerFailure(error, providerRunRecorded);
    const completion = await failWeeklyScanLocation(executor, work, failure);
    await queueWeeklyBatchSummary(work.accountId, completion);
    console.error(
      `[AutoScan] Batch ${work.batchId}, location ${work.brandLocationId}: ${failure.code}`,
    );
    return NextResponse.json({
      success: true,
      outcome: failure.outcome,
      accountId: work.accountId,
      batchId: work.batchId,
      brandLocationId: work.brandLocationId,
      batchFinished: completion.batchFinished,
      batchStatus: completion.batchStatus,
      workProcessed: 1,
      duration: Date.now() - startTime,
    });
  }
}

// =============================================================================
// HELPER: Format number for display (e.g., 5700 -> "5.7K")
// January 29th, 2026
// =============================================================================
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toString();
}

// =============================================================================
// HELPER: Sleep for polling
// January 29th, 2026
// =============================================================================
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

// =============================================================================
// HELPER: Build search keywords from topics and competitors
// 
// January 29, 2026 - DEPRECATED
// This function is no longer used. Topics and competitors are now passed
// directly to startGoogleSearchRun() which uses the shared localized-search
// utility to build fully localized queries.
// 
// OLD BEHAVIOR (buggy):
// - Created English queries like "bedrop alternative" and "bedrop competitor"
// - Didn't use localized terms for non-English targets
// 
// NEW BEHAVIOR:
// - Topics are passed as keywords[] to startGoogleSearchRun
// - Competitors are passed as competitors[] (brand name is extracted automatically)
// - Queries are fully localized (German: "bedrop erfahrung", not "bedrop alternative")
// =============================================================================
// function buildSearchKeywords - REMOVED

// =============================================================================
// HELPER: Enrich YouTube results with Apify metadata
// January 29th, 2026
// =============================================================================
async function enrichYouTubeResults(
  results: SearchResult[],
  providedEnrichment?: YouTubeEnrichmentMap,
): Promise<SearchResult[]> {
  if (results.length === 0) return results;
  
  try {
    const urls = results.map(r => r.link).filter(Boolean);
    console.log(`[AutoScan] Enriching ${urls.length} YouTube URLs...`);
    
    const enrichmentMap = providedEnrichment ?? await enrichYouTubeByUrls(urls);
    
    return results.map(result => {
      const apifyData = enrichmentMap.get(result.link);
      if (apifyData) {
        return {
          ...result,
          channel: {
            name: apifyData.channelName || 'Unknown Channel',
            link: apifyData.channelUrl || `https://www.youtube.com/@${apifyData.channelUsername || 'unknown'}`,
            verified: apifyData.isVerified,
            subscribers: apifyData.numberOfSubscribers ? formatNumber(apifyData.numberOfSubscribers) : undefined,
          },
          views: apifyData.viewCount ? formatNumber(apifyData.viewCount) : undefined,
          youtubeVideoLikes: apifyData.likes,
          youtubeVideoComments: apifyData.commentsCount,
          duration: apifyData.duration,
          thumbnail: apifyData.thumbnailUrl,
          title: apifyData.title || result.title,
          snippet: truncateProviderText(apifyData.text, 300) || result.snippet,
          date: apifyData.date || apifyData.uploadDate || result.date,
        };
      }
      return result;
    });
  } catch (error: unknown) {
    console.warn(`[AutoScan] YouTube enrichment failed:`, errorMessage(error));
    return results;
  }
}

// =============================================================================
// HELPER: Enrich Instagram results with Apify metadata
// January 29th, 2026
// =============================================================================
async function enrichInstagramResults(
  results: SearchResult[],
  providedEnrichment?: InstagramEnrichmentMap,
): Promise<SearchResult[]> {
  if (results.length === 0) return results;
  
  try {
    const urls = results.map(r => r.link).filter(Boolean);
    console.log(`[AutoScan] Enriching ${urls.length} Instagram URLs...`);
    
    const enrichmentMap = providedEnrichment ?? await enrichInstagramByUrls(urls);
    
    return results.map(result => {
      const apifyData = enrichmentMap.get(result.link);
      if (apifyData && (apifyData.username || apifyData.ownerUsername)) {
        // January 30, 2026: Fixed to handle both POST URLs and PROFILE URLs
        // POST URLs: displayUrl, caption, likesCount at root level
        // PROFILE URLs: profilePicUrl at root, post data in latestPosts[0]
        const isPostUrl = !!apifyData.displayUrl && !apifyData.latestPosts;
        const firstPost = apifyData.latestPosts?.[0];
        
        // Post data for RELEVANT CONTENT column
        const postThumbnail = isPostUrl ? apifyData.displayUrl : firstPost?.displayUrl;
        const postCaption = isPostUrl ? apifyData.caption : firstPost?.caption;
        const postLikes = isPostUrl ? apifyData.likesCount : firstPost?.likesCount;
        const postComments = isPostUrl ? apifyData.commentsCount : firstPost?.commentsCount;
        const postViews = isPostUrl ? apifyData.videoViewCount : firstPost?.videoViewCount;
        
        // Profile pic for AFFILIATE column
        const profilePic = apifyData.profilePicUrlHD || apifyData.profilePicUrl;
        
        return {
          ...result,
          // AFFILIATE column: profile pic + username + followers
          channel: {
            name: apifyData.ownerFullName || apifyData.fullName || apifyData.ownerUsername || apifyData.username,
            link: apifyData.url || `https://www.instagram.com/${apifyData.ownerUsername || apifyData.username}/`,
            thumbnail: profilePic,
            verified: apifyData.verified,
            subscribers: apifyData.followersCount ? formatNumber(apifyData.followersCount) : undefined,
          },
          instagramUsername: apifyData.ownerUsername || apifyData.username,
          instagramFullName: apifyData.ownerFullName || apifyData.fullName,
          instagramBio: apifyData.biography,
          instagramFollowers: apifyData.followersCount,
          instagramFollowing: apifyData.followsCount,
          instagramPostsCount: apifyData.postsCount,
          instagramIsBusiness: apifyData.isBusinessAccount,
          instagramIsVerified: apifyData.verified,
          // Post engagement stats
          instagramPostLikes: postLikes,
          instagramPostComments: postComments,
          instagramPostViews: postViews,
          // RELEVANT CONTENT: post thumbnail + caption
          thumbnail: postThumbnail || profilePic,
          personName: apifyData.ownerFullName || apifyData.fullName || apifyData.ownerUsername || apifyData.username,
          title: truncateProviderText(postCaption, 100) || result.title,
          snippet: truncateProviderText(postCaption, 300)
            || truncateProviderText(apifyData.biography, 300)
            || result.snippet,
        };
      }
      return result;
    });
  } catch (error: unknown) {
    console.warn(`[AutoScan] Instagram enrichment failed:`, errorMessage(error));
    return results;
  }
}

// =============================================================================
// HELPER: Enrich TikTok results with Apify metadata
// January 29th, 2026
// =============================================================================
async function enrichTikTokResults(
  results: SearchResult[],
  providedEnrichment?: TikTokEnrichmentMap,
): Promise<SearchResult[]> {
  if (results.length === 0) return results;
  
  try {
    const urls = results.map(r => r.link).filter(Boolean);
    console.log(`[AutoScan] Enriching ${urls.length} TikTok URLs...`);
    
    const enrichmentMap = providedEnrichment ?? await enrichTikTokByUrls(urls);
    
    return results.map(result => {
      const apifyData = enrichmentMap.get(result.link);
      if (apifyData && apifyData.authorMeta) {
        const author = apifyData.authorMeta;
        
        return {
          ...result,
          channel: {
            name: author.nickName || author.name || result.tiktokUsername || 'Unknown',
            link: author.profileUrl || `https://www.tiktok.com/@${author.name}`,
            thumbnail: author.avatar,
            verified: author.verified,
            subscribers: author.fans ? formatNumber(author.fans) : undefined,
          },
          tiktokUsername: author.name || result.tiktokUsername,
          tiktokDisplayName: author.nickName,
          tiktokBio: author.signature,
          tiktokFollowers: author.fans,
          tiktokLikes: author.heart,
          tiktokVideosCount: author.video,
          tiktokIsVerified: author.verified,
          tiktokVideoPlays: apifyData.playCount,
          tiktokVideoLikes: apifyData.diggCount,
          tiktokVideoComments: apifyData.commentCount,
          tiktokVideoShares: apifyData.shareCount,
          thumbnail: apifyData.videoMeta?.coverUrl || author.avatar,
          date: apifyData.createTimeISO || result.date,
        };
      }
      return result;
    });
  } catch (error: unknown) {
    console.warn(`[AutoScan] TikTok enrichment failed:`, errorMessage(error));
    return results;
  }
}

// =============================================================================
// HELPER: Run auto-scan for a user using Apify polling
// January 29th, 2026 - Migrated from Serper to Apify
// January 29th, 2026 - FIX: Now uses keywords[] + competitors[] properly
// January 29th, 2026 - Added userBrand for social filtering
// =============================================================================
interface AutoScanLifecycleCallbacks {
  existingSearchId: number | null;
  providerCorrelationId: (provider: WeeklyScanProvider) => string;
  loadProviderState: (
    launch: WeeklyProviderLaunchInput,
  ) => Promise<WeeklyProviderResumeState | null>;
  prepareProviderLaunch: (
    launch: WeeklyProviderLaunchInput,
    searchId: number | null,
  ) => Promise<void>;
  providerStarted: (
    launch: WeeklyProviderLaunchInput,
    providerRunId: string,
  ) => Promise<void>;
  providerFinished: (
    launch: WeeklyProviderLaunchInput,
    settlement: WeeklyProviderSettlement,
  ) => Promise<void>;
}

type YouTubeEnrichmentMap = Awaited<ReturnType<typeof fetchYouTubeEnrichmentResults>>;
type InstagramEnrichmentMap = Awaited<ReturnType<typeof fetchInstagramEnrichmentResults>>;
type TikTokEnrichmentMap = Awaited<ReturnType<typeof fetchTikTokEnrichmentResults>>;

async function executeWeeklyEnrichmentProvider<TData>(
  input: EnrichmentDispatchInput | undefined,
  lifecycle: AutoScanLifecycleCallbacks,
  fetchResults: (providerRunId: string) => Promise<TData>,
): Promise<WeeklyProviderExecution<TData> | null> {
  if (!input || input.platform === 'similarweb') return null;
  const launch: WeeklyProviderLaunchInput = {
    provider: input.platform,
    inputFingerprint: input.inputFingerprint,
    correlationId: lifecycle.providerCorrelationId(input.platform),
  };
  return executeWeeklyProvider(launch, {
    loadExisting: lifecycle.loadProviderState,
    prepare: (prepared) => lifecycle.prepareProviderLaunch(prepared, null),
    start: (prepared) => startEnrichmentPlatform(
      input.platform,
      input.urls,
      prepared.correlationId,
    ),
    recordRun: (prepared, providerRunId) =>
      lifecycle.providerStarted(prepared, providerRunId),
    inspect: (providerRunId) => getEnrichmentRunStatusStrict(providerRunId),
    fetchExactCost: fetchRunCostUsd,
    settle: (prepared, settlement) => lifecycle.providerFinished(prepared, settlement),
    fetchResults,
    abort: abortEnrichmentRun,
    sleep,
    pollIntervalMs: 2_500,
    maxPollDurationMs: 90_000,
    maxProviderAgeMs: WEEKLY_PROVIDER_MAX_AGE_MS,
    costStabilizationDelayMs: WEEKLY_PROVIDER_COST_STABILIZATION_MS,
  });
}

async function runAutoScan(
  userId: number,
  brandId: string,
  brandLocationId: string,
  topics: string[],
  competitors: string[],
  userBrand: string | null,
  userDomain: string | null,
  targetCountry: string | null,
  targetLanguage: string | null,
  lifecycle?: AutoScanLifecycleCallbacks,
): Promise<{
  totalResults: number;
  totalCost: number | null;
  sourceCounts: { youtube: number; instagram: number; tiktok: number; web: number }; // 2026-05-04: scan-summary email (renamed to avoid clash with existing `sources` Platform[] below)
}> {
  let totalResults = 0;
  let totalCost: number | null = lifecycle ? null : 0;
  // 2026-05-04: per-platform breakdown for the scan-summary email.
  // Counters increment INSIDE the save try block below, so the sum equals totalResults exactly.
  const sourceCounts = { youtube: 0, instagram: 0, tiktok: 0, web: 0 };

  const sources: Platform[] = ['Web', 'YouTube', 'Instagram', 'TikTok'];
  
  // Track the search with descriptive label
  const searchLabel = `[AUTO-SCAN] topics=${topics.join(',')} competitors=${competitors.join(',')}`;
  const searchId = lifecycle?.existingSearchId ?? await trackSearch({
      userId,
      keyword: searchLabel.substring(0, 200), // Limit length for DB
      sources,
      brandId,
      brandLocationId,
    });
  
  console.log(`[AutoScan] Starting Apify run:`);
  console.log(`[AutoScan]   Topics (${topics.length}): ${topics.join(', ')}`);
  console.log(`[AutoScan]   Competitors (${competitors.length}): ${competitors.join(', ')}`);
  console.log(`[AutoScan]   Target: ${targetCountry || 'default'} / ${targetLanguage || 'default'}`);
  
  let providerDispatchPrepared = false;
  let providerRunId: string | null = null;
  const providerExecutions: WeeklyProviderExecution<unknown>[] = [];
  try {
    const googleCorrelationId = lifecycle?.providerCorrelationId('google');
    const googleOptions = {
      keywords: topics,
      competitors: competitors,
      sources,
      targetCountry,
      targetLanguage,
      ...(googleCorrelationId ? { correlationId: googleCorrelationId } : {}),
    };
    let rawResults: SearchResult[];

    if (lifecycle && googleCorrelationId) {
      const launch: WeeklyProviderLaunchInput = {
        provider: 'google',
        correlationId: googleCorrelationId,
        inputFingerprint: weeklyProviderInputFingerprint(
          'google',
          buildGoogleProviderInput(googleOptions),
        ),
      };
      const googleExecution = await executeWeeklyProvider(launch, {
        loadExisting: lifecycle.loadProviderState,
        prepare: async (prepared) => {
          await lifecycle.prepareProviderLaunch(prepared, searchId);
          providerDispatchPrepared = true;
        },
        start: async () => {
          const started = await startGoogleSearchRun(googleOptions);
          providerRunId = started.runId;
          return started.runId;
        },
        recordRun: (prepared, runId) => lifecycle.providerStarted(prepared, runId),
        inspect: (runId) => getRunStatus(runId),
        fetchExactCost: fetchRunCostUsd,
        settle: (prepared, settlement) => lifecycle.providerFinished(prepared, settlement),
        fetchResults: (runId) => fetchAndProcessResults(runId, {
          targetCountry,
          targetLanguage,
        }),
        abort: abortGoogleSearchRun,
        sleep,
        pollIntervalMs: 5_000,
        maxPollDurationMs: 180_000,
        maxProviderAgeMs: WEEKLY_PROVIDER_MAX_AGE_MS,
        costStabilizationDelayMs: WEEKLY_PROVIDER_COST_STABILIZATION_MS,
      });
      providerExecutions.push(googleExecution);
      if (googleExecution.outcome === 'deferred') {
        throw new WeeklyScanDeferredError('Google provider work is still running.');
      }
      if (googleExecution.outcome !== 'succeeded' || googleExecution.data === null) {
        throw new WeeklyScanExecutionError(
          googleExecution.outcome === 'failed' ? 'failed' : 'uncertain',
          googleExecution.outcome === 'failed'
            ? 'provider_terminal_failure'
            : 'provider_processing_uncertain',
          `Google provider outcome was ${googleExecution.outcome}.`,
        );
      }
      rawResults = googleExecution.data;
    } else {
      // The feature-off path is intentionally unchanged until the scheduler
      // cutover. It retains the legacy single-location provider behavior.
      const { runId } = await startGoogleSearchRun(googleOptions);
      providerRunId = runId;
      const terminalStates = new Set<GoogleScraperStatus['status']>([
        'SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT',
      ]);
      const pollStartTime = Date.now();
      let status = await getRunStatus(runId);
      while (!terminalStates.has(status.status)) {
        const elapsed = Date.now() - pollStartTime;
        if (elapsed > 180_000) throw new Error(`Apify run timed out after ${elapsed / 1000}s`);
        await sleep(5_000);
        status = await getRunStatus(runId);
      }
      if (status.status !== 'SUCCEEDED') {
        throw new WeeklyScanExecutionError(
          'failed',
          'provider_terminal_failure',
          `Apify run ${status.status}`,
        );
      }
      rawResults = await fetchAndProcessResults(runId, { targetCountry, targetLanguage });
      totalCost = (totalCost ?? 0) + (API_COSTS.apify_google_scraper || 0.02);
    }
    
    console.log(`[AutoScan] Fetched ${rawResults.length} raw results`);
    
    // =========================================================================
    // STEP 4: CATEGORIZE BY PLATFORM
    // =========================================================================
    const youtubeResults = rawResults.filter(r => r.source === 'YouTube');
    const instagramResults = rawResults.filter(r => r.source === 'Instagram');
    const tiktokResults = rawResults.filter(r => r.source === 'TikTok');
    const webResults = rawResults.filter(r => r.source === 'Web');
    
    console.log(`[AutoScan] Raw breakdown: YouTube=${youtubeResults.length}, Instagram=${instagramResults.length}, TikTok=${tiktokResults.length}, Web=${webResults.length}`);
    
    // =========================================================================
    // STEP 5: ENRICH SOCIAL RESULTS (PARALLEL)
    // =========================================================================
    let enrichedYouTube: SearchResult[];
    let enrichedInstagram: SearchResult[];
    let enrichedTikTok: SearchResult[];
    if (lifecycle) {
      const inputs = buildEnrichmentDispatchInputs({
        youtube: youtubeResults.map(({ link }) => link),
        instagram: instagramResults.map(({ link }) => link),
        tiktok: tiktokResults.map(({ link }) => link),
        similarweb: [],
      });
      const byPlatform = new Map(inputs.map((input) => [input.platform, input]));
      // Wait for every started platform even when one fails. Returning early
      // would let background callbacks mutate a child after it was finalized.
      const settled = await Promise.allSettled([
        executeWeeklyEnrichmentProvider(
          byPlatform.get('youtube'),
          lifecycle,
          (runId) => fetchYouTubeEnrichmentResults(runId, { throwOnError: true }),
        ),
        executeWeeklyEnrichmentProvider(
          byPlatform.get('instagram'),
          lifecycle,
          (runId) => fetchInstagramEnrichmentResults(runId, { throwOnError: true }),
        ),
        executeWeeklyEnrichmentProvider(
          byPlatform.get('tiktok'),
          lifecycle,
          (runId) => fetchTikTokEnrichmentResults(runId, { throwOnError: true }),
        ),
      ]);
      const rejected = settled.find(
        (result): result is PromiseRejectedResult => result.status === 'rejected',
      );
      if (rejected) throw rejected.reason;
      const [youtubeExecution, instagramExecution, tiktokExecution] = settled.map(
        (result) => (result as PromiseFulfilledResult<WeeklyProviderExecution<unknown> | null>).value,
      );
      const socialExecutions = [youtubeExecution, instagramExecution, tiktokExecution]
        .filter((execution): execution is WeeklyProviderExecution<unknown> => execution !== null);
      providerExecutions.push(...socialExecutions);
      if (socialExecutions.some(({ outcome }) => outcome === 'uncertain')) {
        throw new WeeklyScanExecutionError(
          'uncertain',
          'enrichment_provider_uncertain',
          'At least one enrichment provider could not be verified safely.',
        );
      }
      if (socialExecutions.some(({ outcome }) => outcome === 'deferred')) {
        throw new WeeklyScanDeferredError('Enrichment provider work is still running.');
      }
      const youtubeMap = (youtubeExecution?.data ?? new Map()) as YouTubeEnrichmentMap;
      const instagramMap = (instagramExecution?.data ?? new Map()) as InstagramEnrichmentMap;
      const tiktokMap = (tiktokExecution?.data ?? new Map()) as TikTokEnrichmentMap;
      [enrichedYouTube, enrichedInstagram, enrichedTikTok] = await Promise.all([
        enrichYouTubeResults(youtubeResults, youtubeMap),
        enrichInstagramResults(instagramResults, instagramMap),
        enrichTikTokResults(tiktokResults, tiktokMap),
      ]);
      totalCost = sumExactWeeklyProviderCosts(providerExecutions);
    } else {
      [enrichedYouTube, enrichedInstagram, enrichedTikTok] = await Promise.all([
        enrichYouTubeResults(youtubeResults),
        enrichInstagramResults(instagramResults),
        enrichTikTokResults(tiktokResults),
      ]);
      if (youtubeResults.length > 0) totalCost = (totalCost ?? 0) + (API_COSTS.apify_youtube || 0.01);
      if (instagramResults.length > 0) totalCost = (totalCost ?? 0) + (API_COSTS.apify_instagram || 0.01);
      if (tiktokResults.length > 0) totalCost = (totalCost ?? 0) + (API_COSTS.apify_tiktok || 0.01);
    }
    
    // =========================================================================
    // STEP 6: APPLY FILTERING
    // =========================================================================
    // Existing blocks remain account-wide. Keeping this query here makes the
    // weekly path match the manual search finalizer without copying mutable UI
    // preferences into the immutable batch snapshot.
    const blockedDomainRows = await sql`
      SELECT domain
      FROM crewcast.user_blocked_domains
      WHERE user_id = ${userId}
      ORDER BY domain ASC
    ` as Array<{ domain: string }>;
    const excludeDomains = blockedDomainRows.map(({ domain }) => domain);
    const filteredWeb = filterWebResults(webResults, {
      userBrand: userDomain || undefined,
      excludeDomains,
      targetCountry: targetCountry || undefined,
      targetLanguage: targetLanguage || undefined,
    });
    
    // January 29, 2026: Added brand exclusion to filter out user's own and competitor accounts
    const filteredYouTube = filterSocialResults(enrichedYouTube, {
      requireEnrichment: true,
      targetLanguage: targetLanguage || undefined,
      userBrand: userBrand || undefined,
      excludeBrands: competitors || undefined,
    });
    
    const filteredInstagram = filterSocialResults(enrichedInstagram, {
      requireEnrichment: true,
      targetLanguage: targetLanguage || undefined,
      userBrand: userBrand || undefined,
      excludeBrands: competitors || undefined,
    });
    
    const filteredTikTok = filterSocialResults(enrichedTikTok, {
      requireEnrichment: true,
      targetLanguage: targetLanguage || undefined,
      userBrand: userBrand || undefined,
      excludeBrands: competitors || undefined,
    });
    
    console.log(`[AutoScan] Filtered: YouTube=${filteredYouTube.length}, Instagram=${filteredInstagram.length}, TikTok=${filteredTikTok.length}, Web=${filteredWeb.length}`);
    
    // =========================================================================
    // STEP 7: SAVE RESULTS TO DATABASE
    // =========================================================================
    const allFilteredResults = [
      ...filteredWeb,
      ...filteredYouTube,
      ...filteredInstagram,
      ...filteredTikTok,
    ];
    
    // Use first topic as primary keyword for DB, or 'auto-scan' if none
    const primaryKeyword = topics[0] || 'auto-scan';
    
    const savedSources = await saveWeeklyDiscoveredAffiliates(
      sql,
      {
        userId,
        brandId,
        brandLocationId,
        searchKeyword: primaryKeyword,
        results: allFilteredResults,
      },
    );
    for (const source of savedSources) {
      totalResults += 1;
      if (source === 'YouTube') sourceCounts.youtube += 1;
      else if (source === 'Instagram') sourceCounts.instagram += 1;
      else if (source === 'TikTok') sourceCounts.tiktok += 1;
      else if (source === 'Web') sourceCounts.web += 1;
    }
    
  } catch (error) {
    console.error(`[AutoScan] Run failed:`, error);
    throw normalizeWeeklyScanRunError(
      error,
      Boolean(lifecycle && providerDispatchPrepared),
      providerRunId,
    );
  }
  
  // Complete the search tracking
  if (searchId) {
    await completeSearch(searchId, totalResults, totalCost);
  }
  
  return { totalResults, totalCost, sourceCounts };
}

// =============================================================================
// HELPER: Save discovered affiliates to database
// January 29th, 2026 - Updated for Apify enrichment fields
//
// A real 141-result weekly child spent ~85 seconds on persistence because the
// previous helper made a duplicate SELECT and INSERT for every row through a
// serverless database client limited to one connection. This implementation
// keeps the same database-owned uniqueness rule but uses one duplicate query
// and bounded bulk inserts. Social image rehosting remains best-effort and is
// bounded separately so a provider cannot create an unbounded network burst.
// =============================================================================
async function updateScanSchedule(
  userId: number,
  brandId?: string,
  brandLocationId?: string,
): Promise<void> {
  if ((brandId === undefined) !== (brandLocationId === undefined)) {
    throw new Error('Auto-scan schedule brand and location must be supplied together.');
  }
  const now = new Date();
  const nextScanAt = new Date(now.getTime() + SCAN_INTERVAL_DAYS * 24 * 60 * 60 * 1000);

  await sql.begin(async (transactionValue: unknown) => {
    const transaction = transactionValue as unknown as typeof sql;
    await transaction`
      UPDATE crewcast.subscriptions
      SET
        last_auto_scan_at = ${now.toISOString()},
        next_auto_scan_at = ${nextScanAt.toISOString()},
        updated_at = NOW()
      WHERE user_id = ${userId}
    `;

    if (brandId && brandLocationId) {
      const updatedLocations = await transaction`
        UPDATE crewcast.brand_locations
        SET
          last_auto_scan_at = ${now.toISOString()},
          next_auto_scan_at = ${nextScanAt.toISOString()},
          updated_at = NOW()
        WHERE id = ${brandLocationId}::bigint
          AND brand_id = ${brandId}::bigint
          AND user_id = ${userId}
          AND archived_at IS NULL
        RETURNING id
      `;
      if (updatedLocations.length !== 1) {
        throw new Error('The auto-scan location changed before its schedule could be updated.');
      }
    }
  });
  
  console.log(`[AutoScan] User ${userId}: Next scan scheduled for ${nextScanAt.toISOString()}`);
}
