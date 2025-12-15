/**
 * Admin User Detail API
 * 
 * GET /api/admin/users/[id] - Get detailed info for a single user
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Verify admin session
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const userId = parseInt(id, 10);

  if (isNaN(userId)) {
    return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
  }

  try {
    // Get user info with subscription and credits
    const userResult = await sql`
      SELECT 
        u.*,
        s.status as subscription_status,
        s.plan as subscription_plan,
        s.billing_interval,
        s.trial_ends_at,
        s.current_period_start,
        s.current_period_end,
        s.cancel_at_period_end,
        s.card_last4,
        s.card_brand,
        uc.topic_search_credits_total,
        uc.topic_search_credits_used,
        uc.email_credits_total,
        uc.email_credits_used,
        uc.ai_credits_total,
        uc.ai_credits_used,
        uc.period_start as credits_period_start,
        uc.period_end as credits_period_end,
        uc.is_trial_period
      FROM users u
      LEFT JOIN subscriptions s ON u.id = s.user_id
      LEFT JOIN user_credits uc ON u.id = uc.user_id
      WHERE u.id = ${userId}
    `;

    if (userResult.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get user's API calls (last 100)
    const apiCalls = await sql`
      SELECT 
        id,
        service,
        endpoint,
        keyword,
        domain,
        status,
        results_count,
        estimated_cost,
        duration_ms,
        created_at
      FROM api_calls
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 100
    `;

    // Get user's recent searches
    const searches = await sql`
      SELECT 
        id,
        keyword,
        sources,
        results_count,
        total_cost,
        searched_at,
        completed_at
      FROM searches
      WHERE user_id = ${userId}
      ORDER BY searched_at DESC
      LIMIT 50
    `;

    // Get cost breakdown by service
    const costBreakdown = await sql`
      SELECT 
        service,
        COUNT(*)::int as calls,
        COALESCE(SUM(estimated_cost), 0)::float as cost
      FROM api_calls
      WHERE user_id = ${userId}
      AND created_at >= DATE_TRUNC('month', NOW())
      GROUP BY service
      ORDER BY cost DESC
    `;

    // Get credit transactions
    const creditTransactions = await sql`
      SELECT 
        id,
        credit_type,
        amount,
        balance_after,
        reason,
        reference_type,
        created_at
      FROM credit_transactions
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 50
    `;

    return NextResponse.json({
      user: userResult[0],
      apiCalls,
      searches,
      costBreakdown,
      creditTransactions,
    });

  } catch (error) {
    console.error('[Admin User Detail] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user details' },
      { status: 500 }
    );
  }
}
