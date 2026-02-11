import { NextRequest, NextResponse } from 'next/server';
import { sql, DbUserBlockedDomain } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/supabase/server';

const BLOCKED_DOMAINS_CAP = 10;

function normalizeDomain(input: string): string {
  let s = input.trim().toLowerCase();
  try {
    if (!s.includes('://')) s = 'https://' + s;
    const url = new URL(s);
    let host = url.hostname.replace(/^www\./, '');
    return host;
  } catch {
    const match = s.match(/(?:https?:\/\/)?(?:www\.)?([^/\s?#]+)/i);
    return match ? match[1].toLowerCase().replace(/^www\./, '') : s;
  }
}

async function assertUserOwnership(authUser: { email?: string | null }, userIdNum: number): Promise<NextResponse | null> {
  const userCheck = await sql`SELECT email FROM crewcast.users WHERE id = ${userIdNum}`;
  if (userCheck.length === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  const ownerEmail = (userCheck[0] as { email: string }).email;
  if (authUser.email !== ownerEmail) {
    return NextResponse.json({ error: 'Not authorized to access this resource' }, { status: 403 });
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const userIdNum = parseInt(userId);
    const err = await assertUserOwnership(authUser, userIdNum);
    if (err) return err;

    const rows = await sql`
      SELECT id, user_id, domain, created_at
      FROM crewcast.user_blocked_domains
      WHERE user_id = ${userIdNum}
      ORDER BY created_at DESC
    `;

    return NextResponse.json({
      blockedDomains: (rows as DbUserBlockedDomain[]).map((r) => ({
        domain: r.domain,
        created_at: r.created_at,
      })),
    });
  } catch (error) {
    console.error('Error fetching blocked domains:', error);
    return NextResponse.json({ error: 'Failed to fetch blocked domains' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { userId, domain: rawDomain } = body;
    if (!userId || typeof rawDomain !== 'string' || !rawDomain.trim()) {
      return NextResponse.json({ error: 'userId and domain are required' }, { status: 400 });
    }

    const domain = normalizeDomain(rawDomain);
    if (!domain) {
      return NextResponse.json({ error: 'Invalid domain' }, { status: 400 });
    }

    const userIdNum = parseInt(String(userId));
    const err = await assertUserOwnership(authUser, userIdNum);
    if (err) return err;

    const countResult = await sql`
      SELECT COUNT(*)::int AS cnt FROM crewcast.user_blocked_domains WHERE user_id = ${userIdNum}
    `;
    const count = (countResult[0] as { cnt: number }).cnt;
    if (count >= BLOCKED_DOMAINS_CAP) {
      return NextResponse.json(
        { error: 'Blocked domains limit reached', limit: BLOCKED_DOMAINS_CAP },
        { status: 400 }
      );
    }

    await sql`
      INSERT INTO crewcast.user_blocked_domains (user_id, domain)
      VALUES (${userIdNum}, ${domain})
      ON CONFLICT (user_id, domain) DO NOTHING
    `;

    return NextResponse.json({ success: true, domain });
  } catch (error) {
    console.error('Error adding blocked domain:', error);
    return NextResponse.json({ error: 'Failed to add blocked domain' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const domain = searchParams.get('domain');
    if (!userId || !domain) {
      return NextResponse.json({ error: 'userId and domain are required' }, { status: 400 });
    }

    const userIdNum = parseInt(userId);
    const err = await assertUserOwnership(authUser, userIdNum);
    if (err) return err;

    const normalized = normalizeDomain(domain);
    await sql`
      DELETE FROM crewcast.user_blocked_domains
      WHERE user_id = ${userIdNum} AND domain = ${normalized}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing blocked domain:', error);
    return NextResponse.json({ error: 'Failed to remove blocked domain' }, { status: 500 });
  }
}
