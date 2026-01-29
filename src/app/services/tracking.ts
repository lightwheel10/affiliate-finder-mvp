/**
 * API Call Tracking Service
 * Logs every external API call for cost monitoring and analytics
 * Also tracks user searches
 */

import { sql } from '@/lib/db';

// Cost estimates per API call (USD)
export const API_COSTS = {
  serper: 0.001,           // $0.001 per search
  apify_youtube: 0.005,    // $0.005 per video (~$5/1000)
  apify_instagram: 0.0016, // $0.0016 per profile (~$1.60/1000)
  apify_tiktok: 0.0002,    // $0.0002 per video
  apify_similarweb: 0.05,  // $0.05 per domain
  apollo_email: 0.03,      // $0.03 per email lookup
  lusha_email: 0.05,       // $0.05 per email lookup (estimate)
  website_scraper: 0,      // $0 - FREE, just HTTP requests (January 16, 2026)
  // January 29, 2026: Added for polling-based search
  apify_google_scraper: 0.002, // ~$0.02 per 10 results (pay per compute)
} as const;

// ============================================================================
// SEARCH TRACKING
// ============================================================================

export interface SearchLog {
  userId: number;
  keyword: string;
  sources: string[];
}

/**
 * Log a search to the database and return the search ID
 */
export async function trackSearch(log: SearchLog): Promise<number | null> {
  try {
    const result = await sql`
      INSERT INTO crewcast.searches (user_id, keyword, sources, results_count, searched_at)
      VALUES (${log.userId}, ${log.keyword}, ${log.sources}, 0, NOW())
      RETURNING id
    `;
    return result[0]?.id || null;
  } catch (error) {
    console.error('Failed to track search:', error);
    return null;
  }
}

/**
 * Update a search with results count and completion time
 */
export async function completeSearch(
  searchId: number, 
  resultsCount: number, 
  totalCost: number
): Promise<void> {
  try {
    await sql`
      UPDATE crewcast.searches 
      SET results_count = ${resultsCount}, 
          total_cost = ${totalCost},
          completed_at = NOW()
      WHERE id = ${searchId}
    `;
  } catch (error) {
    console.error('Failed to complete search:', error);
  }
}

/**
 * Get user's recent searches
 */
export async function getUserRecentSearches(userId: number, limit: number = 10) {
  const result = await sql`
    SELECT id, keyword, sources, results_count, total_cost, searched_at, completed_at
    FROM crewcast.searches
    WHERE user_id = ${userId}
    ORDER BY searched_at DESC
    LIMIT ${limit}
  `;
  return result;
}

// ============================================================================
// API CALL TRACKING
// ============================================================================

export type ApiService = keyof typeof API_COSTS;

export interface ApiCallLog {
  userId: number;
  service: ApiService;
  endpoint?: string;
  keyword?: string;
  domain?: string;
  status: 'success' | 'error' | 'timeout' | 'rate_limited';
  resultsCount?: number;
  errorMessage?: string;
  estimatedCost?: number;
  apifyRunId?: string;
  durationMs?: number;
}

/**
 * Log an API call to the database
 */
export async function trackApiCall(log: ApiCallLog): Promise<void> {
  try {
    // Calculate cost if not provided
    const cost = log.estimatedCost ?? 
      (log.resultsCount ? log.resultsCount * API_COSTS[log.service] : API_COSTS[log.service]);

    await sql`
      INSERT INTO crewcast.api_calls (
        user_id, service, endpoint, keyword, domain,
        status, results_count, error_message, estimated_cost,
        apify_run_id, duration_ms
      ) VALUES (
        ${log.userId}, 
        ${log.service}, 
        ${log.endpoint || null},
        ${log.keyword || null}, 
        ${log.domain || null},
        ${log.status}, 
        ${log.resultsCount || 0}, 
        ${log.errorMessage || null},
        ${cost}, 
        ${log.apifyRunId || null},
        ${log.durationMs || null}
      )
    `;
  } catch (error) {
    // Don't fail the main operation if tracking fails
    console.error('Failed to track API call:', error);
  }
}

/**
 * Get user's API usage for the current month
 */
export async function getUserMonthlyUsage(userId: number) {
  const result = await sql`
    SELECT 
      service,
      COUNT(*)::int as call_count,
      COALESCE(SUM(results_count), 0)::int as total_results,
      COALESCE(SUM(estimated_cost), 0)::float as total_cost,
      COUNT(CASE WHEN status = 'success' THEN 1 END)::int as success_count,
      COUNT(CASE WHEN status = 'error' THEN 1 END)::int as error_count
    FROM crewcast.api_calls
    WHERE user_id = ${userId}
      AND created_at >= DATE_TRUNC('month', NOW())
    GROUP BY service
  `;
  
  return result;
}

/**
 * Get total cost for a user this month
 */
export async function getUserMonthlyCost(userId: number): Promise<number> {
  const result = await sql`
    SELECT COALESCE(SUM(estimated_cost), 0)::float as total_cost
    FROM crewcast.api_calls
    WHERE user_id = ${userId}
      AND created_at >= DATE_TRUNC('month', NOW())
  `;
  
  return result[0]?.total_cost || 0;
}

/**
 * Get user's search count for the current month
 */
export async function getUserMonthlySearchCount(userId: number): Promise<number> {
  const result = await sql`
    SELECT COUNT(*)::int as search_count
    FROM crewcast.searches
    WHERE user_id = ${userId}
      AND searched_at >= DATE_TRUNC('month', NOW())
  `;
  
  return result[0]?.search_count || 0;
}

/**
 * Check if user has exceeded their monthly cost limit
 */
export async function hasExceededCostLimit(userId: number, limitUsd: number = 10): Promise<boolean> {
  const cost = await getUserMonthlyCost(userId);
  return cost >= limitUsd;
}

/**
 * Get daily cost breakdown for the last N days
 */
export async function getDailyCostBreakdown(userId: number, days: number = 30) {
  const result = await sql`
    SELECT 
      DATE(created_at) as date,
      service,
      COUNT(*)::int as calls,
      COALESCE(SUM(estimated_cost), 0)::float as cost,
      COALESCE(AVG(duration_ms), 0)::int as avg_duration_ms
    FROM crewcast.api_calls
    WHERE user_id = ${userId}
      AND created_at >= NOW() - INTERVAL '1 day' * ${days}
    GROUP BY DATE(created_at), service
    ORDER BY date DESC, cost DESC
  `;
  
  return result;
}

