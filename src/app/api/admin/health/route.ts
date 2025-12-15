/**
 * Admin Health API
 * 
 * GET /api/admin/health - Get API health metrics
 * 
 * Returns:
 * - Success/error rates per service
 * - Average and P95 response times
 * - Hourly call distribution
 * - Error trend over time
 * - Recent errors
 * - Service status indicators
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
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const range = searchParams.get('range') || '24'; // hours
  const hours = parseInt(range, 10);
  
  // Calculate the start time
  const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  try {
    // Service health summary
    const serviceHealth = await sql`
      SELECT 
        service,
        COUNT(*)::int as total_calls,
        COUNT(CASE WHEN status = 'success' THEN 1 END)::int as success_count,
        COUNT(CASE WHEN status = 'error' THEN 1 END)::int as error_count,
        ROUND(COUNT(CASE WHEN status = 'success' THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100, 2)::float as success_rate,
        COALESCE(ROUND(AVG(duration_ms)), 0)::int as avg_duration,
        COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms), 0)::int as p95_duration,
        COALESCE(ROUND(AVG(CASE WHEN status = 'error' THEN duration_ms END)), 0)::int as avg_error_duration
      FROM api_calls
      WHERE created_at >= ${startTime}::timestamptz
      GROUP BY service
      ORDER BY total_calls DESC
    `;

    // Error trend (hourly for last 24-168 hours depending on range)
    const errorTrend = await sql`
      SELECT 
        DATE_TRUNC('hour', created_at) as hour,
        service,
        COUNT(CASE WHEN status = 'error' THEN 1 END)::int as errors,
        COUNT(*)::int as total
      FROM api_calls
      WHERE created_at >= ${startTime}::timestamptz
      GROUP BY DATE_TRUNC('hour', created_at), service
      ORDER BY hour
    `;

    // Hourly distribution (aggregate)
    const hourlyDistribution = await sql`
      SELECT 
        EXTRACT(HOUR FROM created_at)::int as hour,
        COUNT(*)::int as calls,
        COUNT(CASE WHEN status = 'success' THEN 1 END)::int as success_count,
        COUNT(CASE WHEN status = 'error' THEN 1 END)::int as error_count
      FROM api_calls
      WHERE created_at >= ${startTime}::timestamptz
      GROUP BY EXTRACT(HOUR FROM created_at)
      ORDER BY hour
    `;

    // Recent errors
    const recentErrors = await sql`
      SELECT 
        id,
        service,
        endpoint,
        status,
        error_message,
        duration_ms,
        user_id,
        created_at
      FROM api_calls
      WHERE status = 'error'
        AND created_at >= ${startTime}::timestamptz
      ORDER BY created_at DESC
      LIMIT 20
    `;

    // Overall stats
    const overallStats = await sql`
      SELECT 
        COUNT(*)::int as total_calls,
        COUNT(CASE WHEN status = 'success' THEN 1 END)::int as success_count,
        COUNT(CASE WHEN status = 'error' THEN 1 END)::int as error_count,
        ROUND(COUNT(CASE WHEN status = 'success' THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100, 2)::float as success_rate,
        COALESCE(ROUND(AVG(duration_ms)), 0)::int as avg_duration,
        COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms), 0)::int as p95_duration,
        COUNT(DISTINCT user_id)::int as unique_users
      FROM api_calls
      WHERE created_at >= ${startTime}::timestamptz
    `;

    // Determine service status (green/yellow/red)
    const serviceStatus = serviceHealth.map((service: Record<string, unknown>) => {
      const successRate = Number(service.success_rate || 0);
      const avgDuration = Number(service.avg_duration || 0);
      
      let status: 'healthy' | 'degraded' | 'down' = 'healthy';
      if (successRate < 50) {
        status = 'down';
      } else if (successRate < 90 || avgDuration > 5000) {
        status = 'degraded';
      }
      
      return {
        ...service,
        status,
      };
    });

    // Group error trend by hour for charting
    const errorTrendByHour: Record<string, { hour: string; total: number; errors: number }> = {};
    errorTrend.forEach((item: Record<string, unknown>) => {
      const hour = new Date(item.hour as string).toISOString();
      if (!errorTrendByHour[hour]) {
        errorTrendByHour[hour] = { hour, total: 0, errors: 0 };
      }
      errorTrendByHour[hour].total += Number(item.total || 0);
      errorTrendByHour[hour].errors += Number(item.errors || 0);
    });

    return NextResponse.json({
      serviceHealth: serviceStatus,
      errorTrend: Object.values(errorTrendByHour).sort((a, b) => 
        new Date(a.hour).getTime() - new Date(b.hour).getTime()
      ),
      hourlyDistribution,
      recentErrors,
      overallStats: overallStats[0] || {
        total_calls: 0,
        success_count: 0,
        error_count: 0,
        success_rate: 0,
        avg_duration: 0,
        p95_duration: 0,
        unique_users: 0,
      },
      period: {
        hours,
        start: new Date(Date.now() - hours * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('[Admin Health] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch health metrics' },
      { status: 500 }
    );
  }
}
