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
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { sql } from '@/lib/db';
import { checkAllEnrichmentStatus, EnrichmentRunIds } from '@/app/services/apify';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const authUser = await getAuthenticatedUser();
    
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Get user ID from database
    const users = await sql`
      SELECT id FROM crewcast.users WHERE email = ${authUser.email}
    `;
    
    if (users.length === 0) {
      return NextResponse.json({ hasActiveJobs: false, jobs: [] });
    }
    
    const userId = users[0].id as number;
    
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
      SELECT id, keyword, enrichment_status, enrichment_run_ids, created_at
      FROM crewcast.search_jobs
      WHERE user_id = ${userId}
        AND (
          (status = 'enriching' AND enrichment_status = 'running')
          OR (status = 'running' AND created_at > now() - interval '30 minutes')
        )
      ORDER BY created_at DESC
      LIMIT 5
    `;
    
    if (enrichingJobs.length === 0) {
      return NextResponse.json({ hasActiveJobs: false, jobs: [] });
    }
    
    // Check status of each job's enrichment actors
    const jobStatuses = await Promise.all(
      enrichingJobs.map(async (job: { id: number; keyword: string; enrichment_run_ids: unknown }) => {
        let enrichmentRunIds: EnrichmentRunIds | null = null;
        
        // Parse JSONB if needed
        if (job.enrichment_run_ids) {
          enrichmentRunIds = typeof job.enrichment_run_ids === 'string'
            ? JSON.parse(job.enrichment_run_ids)
            : job.enrichment_run_ids;
        }
        
        if (!enrichmentRunIds) {
          return {
            jobId: job.id,
            keyword: job.keyword,
            completedActors: 0,
            totalActors: 0,
            platforms: {},
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
    
  } catch (error: any) {
    console.error('[Enrichment Status] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
