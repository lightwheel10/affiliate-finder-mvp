/**
 * Admin Costs API
 * 
 * GET /api/admin/costs - Get detailed cost breakdown data
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { sql } from '@/lib/db';

// Helper to convert array of objects to CSV
function toCSV(data: Record<string, unknown>[], columns: { key: string; label: string }[]): string {
  const header = columns.map(c => c.label).join(',');
  const rows = data.map(row => 
    columns.map(c => {
      const value = row[c.key];
      const str = String(value ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',')
  );
  return [header, ...rows].join('\n');
}

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

  // Get query params
  const searchParams = request.nextUrl.searchParams;
  const range = searchParams.get('range') || '30'; // days
  const days = parseInt(range, 10);
  const format = searchParams.get('format');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  
  // Use custom dates if provided, otherwise use days
  const useCustomDates = startDate && endDate;

  try {
    const [
      // Service breakdown
      serviceBreakdown,
      // Daily costs
      dailyCosts,
      // Top users by cost
      topUsers,
      // Hourly distribution (today)
      hourlyDistribution,
      // Status breakdown
      statusBreakdown,
      // Total stats
      totalStats,
    ] = await Promise.all([
      // Service breakdown for the period
      sql`
        SELECT 
          service,
          COUNT(*)::int as calls,
          COALESCE(SUM(estimated_cost), 0)::float as cost,
          COALESCE(SUM(results_count), 0)::int as results,
          COALESCE(AVG(duration_ms), 0)::int as avg_duration,
          COUNT(CASE WHEN status = 'success' THEN 1 END)::int as success_count,
          COUNT(CASE WHEN status = 'error' THEN 1 END)::int as error_count
        FROM api_calls
        WHERE created_at >= NOW() - INTERVAL '1 day' * ${days}
        GROUP BY service
        ORDER BY cost DESC
      `,

      // Daily costs for the period
      sql`
        SELECT 
          DATE(created_at) as date,
          COALESCE(SUM(estimated_cost), 0)::float as cost,
          COUNT(*)::int as calls
        FROM api_calls
        WHERE created_at >= NOW() - INTERVAL '1 day' * ${days}
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `,

      // Top 10 users by cost this month
      sql`
        SELECT 
          u.id,
          u.email,
          u.name,
          COALESCE(SUM(ac.estimated_cost), 0)::float as total_cost,
          COUNT(ac.id)::int as total_calls
        FROM users u
        LEFT JOIN api_calls ac ON u.id = ac.user_id
          AND ac.created_at >= NOW() - INTERVAL '1 day' * ${days}
        GROUP BY u.id, u.email, u.name
        HAVING COALESCE(SUM(ac.estimated_cost), 0) > 0
        ORDER BY total_cost DESC
        LIMIT 10
      `,

      // Hourly distribution today
      sql`
        SELECT 
          EXTRACT(HOUR FROM created_at)::int as hour,
          COUNT(*)::int as calls,
          COALESCE(SUM(estimated_cost), 0)::float as cost
        FROM api_calls
        WHERE created_at >= DATE_TRUNC('day', NOW())
        GROUP BY EXTRACT(HOUR FROM created_at)
        ORDER BY hour ASC
      `,

      // Status breakdown
      sql`
        SELECT 
          status,
          COUNT(*)::int as count
        FROM api_calls
        WHERE created_at >= NOW() - INTERVAL '1 day' * ${days}
        GROUP BY status
      `,

      // Total stats for the period
      sql`
        SELECT 
          COUNT(*)::int as total_calls,
          COALESCE(SUM(estimated_cost), 0)::float as total_cost,
          COUNT(DISTINCT user_id)::int as unique_users,
          COALESCE(AVG(duration_ms), 0)::int as avg_duration
        FROM api_calls
        WHERE created_at >= NOW() - INTERVAL '1 day' * ${days}
      `,
    ]);

    // Return CSV if requested
    if (format === 'csv') {
      // Combine service breakdown with daily costs for comprehensive export
      const csvColumns = [
        { key: 'service', label: 'Service' },
        { key: 'calls', label: 'Total Calls' },
        { key: 'cost', label: 'Total Cost ($)' },
        { key: 'success_count', label: 'Success Count' },
        { key: 'error_count', label: 'Error Count' },
        { key: 'avg_duration', label: 'Avg Duration (ms)' },
      ];

      const csv = toCSV(serviceBreakdown as Record<string, unknown>[], csvColumns);
      
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="costs_export_${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    return NextResponse.json({
      serviceBreakdown,
      dailyCosts,
      topUsers,
      hourlyDistribution,
      statusBreakdown,
      totalStats: totalStats[0] || {
        total_calls: 0,
        total_cost: 0,
        unique_users: 0,
        avg_duration: 0,
      },
      period: {
        days,
        start: useCustomDates ? startDate : new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
        end: useCustomDates ? endDate : new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('[Admin Costs] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cost data' },
      { status: 500 }
    );
  }
}
