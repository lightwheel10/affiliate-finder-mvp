import { NextRequest, NextResponse } from 'next/server';
import { sql, DbUser } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/supabase/server';

// POST /api/users/onboarding - Complete onboarding
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      id,
      name,
      role,
      brand,
      targetCountry,
      targetLanguage,
      competitors,
      topics,
      affiliateTypes,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const userCheck = await sql`SELECT email FROM crewcast.users WHERE id = ${id}`;
    if (userCheck.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (authUser.email !== (userCheck[0] as { email: string }).email) {
      return NextResponse.json({ error: 'Not authorized to access this resource' }, { status: 403 });
    }

    const updatedUsers = await sql`
      UPDATE crewcast.users 
      SET 
        name = ${name},
        role = ${role},
        brand = ${brand},
        target_country = ${targetCountry},
        target_language = ${targetLanguage},
        competitors = ${competitors},
        topics = ${topics},
        affiliate_types = ${affiliateTypes},
        is_onboarded = true,
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    if (updatedUsers.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user: updatedUsers[0] as DbUser });
  } catch (error) {
    console.error('Error completing onboarding:', error);
    return NextResponse.json({ error: 'Failed to complete onboarding' }, { status: 500 });
  }
}

