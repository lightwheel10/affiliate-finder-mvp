/**
 * Admin Users API
 * 
 * GET /api/admin/users - Get all users with aggregated stats
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
      // Escape quotes and wrap in quotes if contains comma
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

  const searchParams = request.nextUrl.searchParams;
  const format = searchParams.get('format');

  try {
    // Get all users with subscription and credit info
    const users = await sql`
      SELECT 
        u.id,
        u.email,
        u.name,
        u.plan,
        u.created_at,
        u.is_onboarded,
        s.status as subscription_status,
        s.trial_ends_at,
        s.current_period_end,
        uc.topic_search_credits_total,
        uc.topic_search_credits_used,
        uc.email_credits_total,
        uc.email_credits_used,
        uc.ai_credits_total,
        uc.ai_credits_used,
        uc.is_trial_period,
        COALESCE((
          SELECT SUM(estimated_cost)
          FROM api_calls
          WHERE user_id = u.id
          AND created_at >= DATE_TRUNC('month', NOW())
        ), 0)::float as monthly_cost,
        COALESCE((
          SELECT COUNT(*)
          FROM api_calls
          WHERE user_id = u.id
          AND created_at >= DATE_TRUNC('month', NOW())
        ), 0)::int as monthly_calls
      FROM users u
      LEFT JOIN subscriptions s ON u.id = s.user_id
      LEFT JOIN user_credits uc ON u.id = uc.user_id
      ORDER BY u.created_at DESC
    `;

    // Return CSV if requested
    if (format === 'csv') {
      const csvColumns = [
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'plan', label: 'Plan' },
        { key: 'subscription_status', label: 'Status' },
        { key: 'topic_search_credits_used', label: 'Searches Used' },
        { key: 'topic_search_credits_total', label: 'Searches Total' },
        { key: 'email_credits_used', label: 'Email Credits Used' },
        { key: 'email_credits_total', label: 'Email Credits Total' },
        { key: 'monthly_cost', label: 'Monthly Cost ($)' },
        { key: 'monthly_calls', label: 'Monthly API Calls' },
        { key: 'created_at', label: 'Joined' },
      ];

      const csv = toCSV(users as Record<string, unknown>[], csvColumns);
      
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="users_export_${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    return NextResponse.json({ users });

  } catch (error) {
    console.error('[Admin Users] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
