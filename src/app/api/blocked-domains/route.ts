import { NextRequest, NextResponse } from 'next/server';
import { sql, DbUserBlockedDomain } from '@/lib/db';
import {
  AccountAccessError,
  assertLegacyAccountId,
  requireAuthenticatedAccount,
} from '@/lib/auth/account';

const BLOCKED_DOMAINS_CAP = 10;

function normalizeDomain(input: string): string {
  let s = input.trim().toLowerCase();
  try {
    if (!s.includes('://')) s = 'https://' + s;
    const url = new URL(s);
    const host = url.hostname.replace(/^www\./, '');
    return host;
  } catch {
    const match = s.match(/(?:https?:\/\/)?(?:www\.)?([^/\s?#]+)/i);
    return match ? match[1].toLowerCase().replace(/^www\./, '') : s;
  }
}

export async function GET(request: NextRequest) {
  try {
    const authenticated = await requireAuthenticatedAccount();

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    assertLegacyAccountId(userId, authenticated.account.id);
    const userIdNum = authenticated.account.id;

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
    if (error instanceof AccountAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error fetching blocked domains:', error);
    return NextResponse.json({ error: 'Failed to fetch blocked domains' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authenticated = await requireAuthenticatedAccount();

    const body = await request.json();
    const { userId, domain: rawDomain } = body;
    if (!userId || typeof rawDomain !== 'string' || !rawDomain.trim()) {
      return NextResponse.json({ error: 'userId and domain are required' }, { status: 400 });
    }

    const domain = normalizeDomain(rawDomain);
    if (!domain) {
      return NextResponse.json({ error: 'Invalid domain' }, { status: 400 });
    }

    assertLegacyAccountId(userId, authenticated.account.id);
    const userIdNum = authenticated.account.id;

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
    if (error instanceof AccountAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error adding blocked domain:', error);
    return NextResponse.json({ error: 'Failed to add blocked domain' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authenticated = await requireAuthenticatedAccount();

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const domain = searchParams.get('domain');
    if (!userId || !domain) {
      return NextResponse.json({ error: 'userId and domain are required' }, { status: 400 });
    }

    assertLegacyAccountId(userId, authenticated.account.id);
    const userIdNum = authenticated.account.id;

    const normalized = normalizeDomain(domain);
    await sql`
      DELETE FROM crewcast.user_blocked_domains
      WHERE user_id = ${userIdNum} AND domain = ${normalized}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AccountAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error removing blocked domain:', error);
    return NextResponse.json({ error: 'Failed to remove blocked domain' }, { status: 500 });
  }
}
