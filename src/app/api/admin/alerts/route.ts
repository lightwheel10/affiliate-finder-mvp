/**
 * Admin Alerts API
 * 
 * GET /api/admin/alerts - Get all alerts with current status
 * POST /api/admin/alerts - Create or update an alert
 * DELETE /api/admin/alerts?id=X - Delete an alert
 * 
 * Alert types: 'daily_cost', 'weekly_cost', 'monthly_cost'
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

// Get current costs for each period
async function getCurrentCosts() {
  const [daily, weekly, monthly] = await Promise.all([
    sql`
      SELECT COALESCE(SUM(estimated_cost), 0)::float as cost
      FROM api_calls
      WHERE created_at >= DATE_TRUNC('day', NOW())
    `,
    sql`
      SELECT COALESCE(SUM(estimated_cost), 0)::float as cost
      FROM api_calls
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `,
    sql`
      SELECT COALESCE(SUM(estimated_cost), 0)::float as cost
      FROM api_calls
      WHERE created_at >= DATE_TRUNC('month', NOW())
    `,
  ]);

  return {
    daily_cost: daily[0]?.cost || 0,
    weekly_cost: weekly[0]?.cost || 0,
    monthly_cost: monthly[0]?.cost || 0,
  };
}

export async function GET() {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Check if table exists, if not create it
    await sql`
      CREATE TABLE IF NOT EXISTS admin_alerts (
        id SERIAL PRIMARY KEY,
        alert_type VARCHAR(50) NOT NULL UNIQUE,
        threshold DECIMAL(10,2) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        last_triggered_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    const alerts = await sql`
      SELECT * FROM admin_alerts ORDER BY alert_type
    `;

    // Get current costs
    const currentCosts = await getCurrentCosts();

    // Check which alerts are triggered
    const alertsWithStatus = alerts.map((alert: Record<string, unknown>) => {
      const alertType = alert.alert_type as string;
      const threshold = Number(alert.threshold);
      const currentCost = currentCosts[alertType as keyof typeof currentCosts] || 0;
      const isTriggered = currentCost >= threshold;

      return {
        ...alert,
        currentCost,
        isTriggered,
        percentUsed: threshold > 0 ? (currentCost / threshold) * 100 : 0,
      };
    });

    // Also return triggered alerts that need attention
    const triggeredAlerts = alertsWithStatus.filter(
      (a: Record<string, unknown>) => a.isTriggered && a.is_active
    );

    return NextResponse.json({
      alerts: alertsWithStatus,
      triggeredAlerts,
      currentCosts,
    });

  } catch (error) {
    console.error('[Admin Alerts] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch alerts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { alertType, threshold, isActive } = await request.json();

    if (!alertType || threshold === undefined) {
      return NextResponse.json(
        { error: 'alertType and threshold are required' },
        { status: 400 }
      );
    }

    const validTypes = ['daily_cost', 'weekly_cost', 'monthly_cost'];
    if (!validTypes.includes(alertType)) {
      return NextResponse.json(
        { error: 'Invalid alert type' },
        { status: 400 }
      );
    }

    // Upsert alert
    const result = await sql`
      INSERT INTO admin_alerts (alert_type, threshold, is_active, updated_at)
      VALUES (${alertType}, ${threshold}, ${isActive !== false}, NOW())
      ON CONFLICT (alert_type) 
      DO UPDATE SET 
        threshold = ${threshold},
        is_active = ${isActive !== false},
        updated_at = NOW()
      RETURNING *
    `;

    // TODO: Send email notification when threshold exceeded
    // const currentCosts = await getCurrentCosts();
    // if (currentCosts[alertType] >= threshold) {
    //   await sendAlertEmail(alertType, currentCosts[alertType], threshold);
    // }

    return NextResponse.json({ alert: result[0] });

  } catch (error) {
    console.error('[Admin Alerts] Error:', error);
    return NextResponse.json(
      { error: 'Failed to save alert' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      );
    }

    await sql`DELETE FROM admin_alerts WHERE id = ${parseInt(id, 10)}`;

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[Admin Alerts] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete alert' },
      { status: 500 }
    );
  }
}
