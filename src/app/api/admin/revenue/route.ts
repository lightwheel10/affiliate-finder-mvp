/**
 * Admin Revenue API
 * 
 * GET /api/admin/revenue - Get Stripe revenue data with cost comparison
 * 
 * Returns:
 * - MRR (Monthly Recurring Revenue)
 * - Total revenue for period
 * - Active subscribers count
 * - Churn rate
 * - ARPU (Average Revenue Per User)
 * - Profit margin (Revenue - API Costs)
 * - Per-user profit breakdown
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { stripe } from '@/lib/stripe';
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
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  // Default to this month
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const defaultEnd = now;

  const rangeStart = startDate ? new Date(startDate) : defaultStart;
  const rangeEnd = endDate ? new Date(endDate) : defaultEnd;

  const startTimestamp = Math.floor(rangeStart.getTime() / 1000);
  const endTimestamp = Math.floor(rangeEnd.getTime() / 1000);

  try {
    // Fetch Stripe data
    const [subscriptions, balanceTransactions] = await Promise.all([
      stripe.subscriptions.list({
        status: 'active',
        limit: 100,
        expand: ['data.items.data.price'],
      }),
      stripe.balanceTransactions.list({
        created: { gte: startTimestamp, lte: endTimestamp },
        type: 'charge',
        limit: 100,
      }),
    ]);

    // Calculate MRR (normalize yearly to monthly)
    let mrr = 0;
    subscriptions.data.forEach((sub) => {
      const item = sub.items.data[0];
      if (item?.price) {
        const amount = item.price.unit_amount || 0;
        const interval = item.price.recurring?.interval;
        // Convert to monthly if yearly
        mrr += interval === 'year' ? amount / 12 : amount;
      }
    });

    // Total revenue for period (in cents, then convert)
    const totalRevenue = balanceTransactions.data.reduce(
      (sum, txn) => sum + (txn.amount > 0 ? txn.amount : 0),
      0
    );

    // Get canceled subscriptions for churn calculation
    const canceledSubs = await stripe.subscriptions.list({
      status: 'canceled',
      created: { gte: startTimestamp, lte: endTimestamp },
      limit: 100,
    });

    // Active subscribers count
    const activeSubscribers = subscriptions.data.length;

    // Churn rate: canceled / (active + canceled) * 100
    const totalSubs = activeSubscribers + canceledSubs.data.length;
    const churnRate = totalSubs > 0 
      ? (canceledSubs.data.length / totalSubs) * 100 
      : 0;

    // ARPU: MRR / active subscribers
    const arpu = activeSubscribers > 0 ? mrr / activeSubscribers : 0;

    // Get API costs for the period from our database
    const costResult = await sql`
      SELECT 
        COALESCE(SUM(estimated_cost), 0)::float as total_cost
      FROM api_calls
      WHERE created_at >= ${rangeStart.toISOString()}::timestamptz
        AND created_at <= ${rangeEnd.toISOString()}::timestamptz
    `;
    const totalCost = Number(costResult[0]?.total_cost || 0);

    // Profit margin
    const revenueInDollars = totalRevenue / 100; // Convert from cents
    const profitMargin = revenueInDollars - totalCost;
    const profitMarginPercent = revenueInDollars > 0 
      ? (profitMargin / revenueInDollars) * 100 
      : 0;

    // Per-user profit (top 10 users by cost)
    const userProfits = await sql`
      SELECT 
        u.id,
        u.email,
        u.name,
        u.plan,
        s.stripe_subscription_id,
        COALESCE(SUM(ac.estimated_cost), 0)::float as api_cost
      FROM users u
      LEFT JOIN subscriptions s ON u.id = s.user_id AND s.status = 'active'
      LEFT JOIN api_calls ac ON u.id = ac.user_id 
        AND ac.created_at >= ${rangeStart.toISOString()}::timestamptz
        AND ac.created_at <= ${rangeEnd.toISOString()}::timestamptz
      GROUP BY u.id, u.email, u.name, u.plan, s.stripe_subscription_id
      ORDER BY api_cost DESC
      LIMIT 10
    `;

    // Get subscription amounts for each user from Stripe
    const userProfitsWithRevenue = await Promise.all(
      userProfits.map(async (user: Record<string, unknown>) => {
        let monthlyRevenue = 0;
        if (user.stripe_subscription_id) {
          try {
            const sub = await stripe.subscriptions.retrieve(user.stripe_subscription_id as string);
            const item = sub.items.data[0];
            if (item?.price) {
              const amount = item.price.unit_amount || 0;
              const interval = item.price.recurring?.interval;
              monthlyRevenue = interval === 'year' ? amount / 12 : amount;
            }
          } catch {
            // Subscription might not exist
          }
        }
        
        const apiCost = Number(user.api_cost || 0);
        const revenueInDollars = monthlyRevenue / 100;
        const profit = revenueInDollars - apiCost;
        
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          plan: user.plan,
          monthlyRevenue: revenueInDollars,
          apiCost,
          profit,
          profitPercent: revenueInDollars > 0 ? (profit / revenueInDollars) * 100 : 0,
        };
      })
    );

    // Revenue trend (daily) for the period
    const revenueTrend = balanceTransactions.data.reduce((acc, txn) => {
      const date = new Date(txn.created * 1000).toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = { revenue: 0, count: 0 };
      }
      acc[date].revenue += txn.amount > 0 ? txn.amount / 100 : 0;
      acc[date].count += 1;
      return acc;
    }, {} as Record<string, { revenue: number; count: number }>);

    // Cost trend for comparison
    const costTrend = await sql`
      SELECT 
        DATE(created_at) as date,
        COALESCE(SUM(estimated_cost), 0)::float as cost
      FROM api_calls
      WHERE created_at >= ${rangeStart.toISOString()}::timestamptz
        AND created_at <= ${rangeEnd.toISOString()}::timestamptz
      GROUP BY DATE(created_at)
      ORDER BY date
    `;

    // Combine revenue and cost trends
    const combinedTrend: { date: string; revenue: number; cost: number; profit: number }[] = [];
    const allDates = new Set([
      ...Object.keys(revenueTrend),
      ...costTrend.map((c: { date: string }) => c.date),
    ]);

    Array.from(allDates).sort().forEach(date => {
      const revenue = revenueTrend[date]?.revenue || 0;
      const costItem = costTrend.find((c: { date: string }) => c.date === date);
      const cost = costItem ? Number(costItem.cost) : 0;
      combinedTrend.push({
        date,
        revenue,
        cost,
        profit: revenue - cost,
      });
    });

    return NextResponse.json({
      mrr: mrr / 100, // Convert from cents to dollars/euros
      totalRevenue: revenueInDollars,
      totalCost,
      profitMargin,
      profitMarginPercent,
      activeSubscribers,
      churnRate,
      arpu: arpu / 100, // Convert from cents
      canceledCount: canceledSubs.data.length,
      userProfits: userProfitsWithRevenue,
      revenueCostTrend: combinedTrend,
      period: {
        startDate: rangeStart.toISOString(),
        endDate: rangeEnd.toISOString(),
      },
    });

  } catch (error) {
    console.error('[Admin Revenue] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch revenue data' },
      { status: 500 }
    );
  }
}
