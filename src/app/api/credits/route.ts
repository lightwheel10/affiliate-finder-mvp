import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { getUserCredits } from '@/lib/credits';

// =============================================================================
// GET /api/credits?userId=xxx
//
// Fetches credit balances for a user.
// 
// SECURITY:
// - Requires authenticated Supabase session (via cookies)
// - Verifies authenticated user matches the requested userId
//
// Created: December 2025
// Updated: January 19th, 2026 - Migrated from Stack Auth to Supabase Auth
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    // ==========================================================================
    // AUTHENTICATION CHECK (January 19th, 2026: Supabase Auth)
    // ==========================================================================
    const authUser = await getAuthenticatedUser();
    
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const userIdNum = parseInt(userId);
    if (isNaN(userIdNum)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    // ==========================================================================
    // AUTHORIZATION CHECK
    // Verify the authenticated user matches the requested user
    // ==========================================================================
    const users = await sql`
      SELECT email, plan FROM users WHERE id = ${userIdNum}
    `;

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (authUser.email !== users[0].email) {
      console.error(`[Credits] Authorization failed: ${authUser.email} tried to access credits for user ${userIdNum}`);
      return NextResponse.json(
        { error: 'Not authorized to access this resource' },
        { status: 403 }
      );
    }

    // ==========================================================================
    // FETCH CREDITS
    // ==========================================================================
    const credits = await getUserCredits(userIdNum);

    if (!credits) {
      // User has no credit record yet (might be before trial starts)
      return NextResponse.json({
        credits: null,
        plan: users[0].plan,
        message: 'No credit record found. Credits will be initialized when subscription starts.',
      });
    }

    // ==========================================================================
    // RETURN RESPONSE
    // ==========================================================================
    return NextResponse.json({
      credits: {
        topicSearches: credits.topicSearches,
        email: credits.email,
        ai: credits.ai,
      },
      period: credits.period,
      plan: users[0].plan,
      isTrialing: credits.isTrialPeriod,
    });
    
  } catch (error) {
    console.error('[Credits] Error fetching credits:', error);
    return NextResponse.json({ error: 'Failed to fetch credits' }, { status: 500 });
  }
}