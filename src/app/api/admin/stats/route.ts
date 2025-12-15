/**
 * Admin Stats API
 * 
 * GET /api/admin/stats - Get platform-wide statistics
 * 
 * Returns:
 * - Total users
 * - Active trials
 * - Paid subscriptions
 * - Total API cost (this month)
 * - API calls today
 * - Cost trend (last 30 days)
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { sql } from '@/lib/db';

// Get secret as Uint8Array for jose
function getJwtSecret(): Uint8Array {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) {
    throw new Error('ADMIN_JWT_SECRET is not configured');
  }
  return new TextEncoder().encode(secret);
}

async function verifyAdminSession(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_session')?.value;

    if (!token) {
      return false;
    }

    await jwtVerify(token, getJwtSecret());
    return true;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  // Verify admin session
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get date range from query params
  const searchParams = request.nextUrl.searchParams;
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  
  // Default to last 30 days if no dates provided
  const defaultStart = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const defaultEnd = new Date().toISOString().split('T')[0];
  
  const rangeStart = startDate || defaultStart;
  const rangeEnd = endDate || defaultEnd;

  try {
    // Run all queries in parallel
    const [
      usersResult,
      trialsResult,
      paidResult,
      periodCostResult,
      todayCallsResult,
      costTrendResult,
      serviceBreakdownResult,
    ] = await Promise.all([
      // Total users
      sql`SELECT COUNT(*)::int as count FROM users`,
      
      // Active trials
      sql`SELECT COUNT(*)::int as count FROM subscriptions WHERE status = 'trialing'`,
      
      // Paid subscriptions
      sql`SELECT COUNT(*)::int as count FROM subscriptions WHERE status = 'active'`,
      
      // Total API cost for selected period
      sql`
        SELECT COALESCE(SUM(estimated_cost), 0)::float as cost 
        FROM api_calls 
        WHERE created_at >= ${rangeStart}::date
          AND created_at < ${rangeEnd}::date + INTERVAL '1 day'
      `,
      
      // API calls today
      sql`
        SELECT COUNT(*)::int as count 
        FROM api_calls 
        WHERE created_at >= DATE_TRUNC('day', NOW())
      `,
      
      // Cost trend for selected period
      sql`
        SELECT 
          DATE(created_at) as date,
          COALESCE(SUM(estimated_cost), 0)::float as cost,
          COUNT(*)::int as calls
        FROM api_calls
        WHERE created_at >= ${rangeStart}::date
          AND created_at < ${rangeEnd}::date + INTERVAL '1 day'
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `,
      
      // Service breakdown for selected period
      sql`
        SELECT 
          service,
          COUNT(*)::int as calls,
          COALESCE(SUM(estimated_cost), 0)::float as cost
        FROM api_calls
        WHERE created_at >= ${rangeStart}::date
          AND created_at < ${rangeEnd}::date + INTERVAL '1 day'
        GROUP BY service
        ORDER BY cost DESC
      `,
    ]);

    return NextResponse.json({
      stats: {
        totalUsers: usersResult[0]?.count || 0,
        activeTrials: trialsResult[0]?.count || 0,
        paidSubscriptions: paidResult[0]?.count || 0,
        monthlyCost: periodCostResult[0]?.cost || 0,
        todayCalls: todayCallsResult[0]?.count || 0,
      },
      costTrend: costTrendResult,
      serviceBreakdown: serviceBreakdownResult,
      period: {
        startDate: rangeStart,
        endDate: rangeEnd,
      },
    });

  } catch (error) {
    console.error('[Admin Stats] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
