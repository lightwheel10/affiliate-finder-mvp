/**
 * =============================================================================
 * ENRICHMENT STATUS API - Check active enrichment jobs for a user
 * =============================================================================
 * 
 * Created: January 30, 2026
 * 
 * PURPOSE:
 * Returns any active 'enriching' jobs for the current user.
 * Used by Discovery page to show status banner and trigger background polling.
 * 
 * RESPONSE:
 * - hasActiveJobs: boolean - true if user has jobs in 'enriching' status
 * - jobs: Array of job status info (completedActors, totalActors, etc.)
 * =============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveAuthenticatedAccount } from '@/lib/auth/account';
import { BrandLocationContextError } from '@/lib/brand-locations/context';
import { resolveServerBrandLocationContext } from '@/lib/brand-locations/server';
import { sql } from '@/lib/db';
import { checkAllEnrichmentStatus, EnrichmentRunIds } from '@/app/services/apify';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const authenticated = await resolveAuthenticatedAccount();
    
    if (!authenticated) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    if (!authenticated.account) {
      return NextResponse.json({ hasActiveJobs: false, jobs: [] });
    }
    
    const userId = authenticated.account.id;
    const locationContext = await resolveServerBrandLocationContext({
      accountId: userId,
      requestedBrandLocationId: request.nextUrl.searchParams.get('brandLocationId'),
    });
    
    // ==========================================================================
    // 2026-07-15 07:40 IST (Paras): Also report jobs still in the 'running'
    // (Google-search) phase, not only 'enriching' ones.
    //
    // WHY: The Discovered page's poller calls /api/search/status for whatever this
    // endpoint reports as active, which is what actually drives a job to completion
    // and SAVES its results. Previously we only reported 'enriching' jobs, so a job
    // that stalled in the earlier 'running' phase — because the Find page stopped
    // polling before Google finished — was invisible here and its results were
    // never saved. Reporting 'running' jobs too lets the Discovered page recover
    // ANY in-flight job.
    //
    // SAFETY (protection-level code — do not widen this): the enriching branch is
    // left EXACTLY as before (status='enriching' AND enrichment_status='running').
    // The new 'running' branch is bounded to jobs created in the last 30 minutes so
    // we never resurrect an old, dead 'running' row (re-polling one could re-trigger
    // paid enrichment actors). Real searches finish in well under 30 minutes.
    // ==========================================================================
    const enrichingJobs = await sql`
      SELECT
        jobs.id,
        jobs.keyword,
        jobs.enrichment_status,
        jobs.enrichment_run_ids,
        jobs.created_at
      FROM crewcast.search_jobs AS jobs
      JOIN crewcast.brands AS brands
        ON brands.id = jobs.brand_id
       AND brands.user_id = jobs.user_id
      JOIN crewcast.brand_locations AS locations
        ON locations.id = jobs.brand_location_id
       AND locations.brand_id = jobs.brand_id
       AND locations.user_id = jobs.user_id
      WHERE jobs.user_id = ${userId}
        AND jobs.brand_location_id = ${locationContext.location.id}::bigint
        AND (
          -- 2026-08-04 (Paras): also report 'finalizing' jobs. search/status now
          -- claims completion via enrichment_status 'running' -> 'finalizing'
          -- (single-winner guard, audit H3). If the claiming invocation dies,
          -- the job sits in 'finalizing' — without this line the Discovered
          -- page's recovery poller would never see it and it would stay stuck
          -- until the 24h sweep. Re-polling a 'finalizing' job is safe: the
          -- claim guard in search/status bounces extra polls until the
          -- 5-minute reclaim window opens.
          (jobs.status = 'enriching' AND jobs.enrichment_status IN (
            'dispatching',
            'dispatch_blocked',
            'running',
            'finalizing'
          ))
          OR (jobs.status = 'running' AND jobs.created_at > now() - interval '30 minutes')
        )
      ORDER BY jobs.created_at DESC
      LIMIT 5
    `;
    
    if (enrichingJobs.length === 0) {
      return NextResponse.json({ hasActiveJobs: false, jobs: [] });
    }
    
    // Check status of each job's enrichment actors
    const jobStatuses = await Promise.all(
      enrichingJobs.map(async (job: {
        id: number;
        keyword: string;
        enrichment_status: string | null;
        enrichment_run_ids: unknown;
      }) => {
        let enrichmentRunIds: EnrichmentRunIds | null = null;
        
        // Parse JSONB if needed
        if (job.enrichment_run_ids) {
          enrichmentRunIds = typeof job.enrichment_run_ids === 'string'
            ? JSON.parse(job.enrichment_run_ids)
            : job.enrichment_run_ids;
        }
        
        if (
          job.enrichment_status === 'dispatching'
          || job.enrichment_status === 'dispatch_blocked'
          || !enrichmentRunIds
        ) {
          return {
            jobId: job.id,
            keyword: job.keyword,
            completedActors: 0,
            totalActors: 0,
            platforms: {},
            dispatchStatus: job.enrichment_status,
          };
        }
        
        // Check enrichment status
        const { statuses } = await checkAllEnrichmentStatus(enrichmentRunIds);
        
        const completedActors = Object.values(statuses).filter(
          s => s.status === 'SUCCEEDED' || s.status === 'FAILED' || s.status === 'ABORTED'
        ).length;
        const totalActors = Object.keys(statuses).length;
        
        // Build platform status map
        const platforms: Record<string, string> = {};
        for (const [platform, status] of Object.entries(statuses)) {
          platforms[platform] = status.status;
        }
        
        return {
          jobId: job.id,
          keyword: job.keyword,
          completedActors,
          totalActors,
          platforms,
        };
      })
    );
    
    return NextResponse.json({
      hasActiveJobs: true,
      jobs: jobStatuses,
    });
    
  } catch (error: unknown) {
    console.error('[Enrichment Status] Error:', error);

    if (error instanceof BrandLocationContextError) {
      return NextResponse.json(
        {
          error: error.status >= 500
            ? 'Unable to resolve the brand location.'
            : error.message,
          code: error.code,
        },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
