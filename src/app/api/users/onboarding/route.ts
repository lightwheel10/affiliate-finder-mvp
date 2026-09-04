import { NextRequest, NextResponse } from 'next/server';
import {
  legacyAccountIdMatches,
  resolveAuthenticatedAccount,
} from '@/lib/auth/account';
import { OnboardingError } from '@/lib/brand-locations/onboarding';
import { completeServerAccountOnboarding } from '@/lib/brand-locations/onboarding-server';
import type { DbUser } from '@/lib/db';
import { completeOnboardingInputSchema } from '@/lib/users/profile-input';

// Complete onboarding for the authenticated application account. The optional
// legacy id is accepted only to keep older clients working during rollout; it
// never selects the row that is updated.
export async function POST(request: NextRequest) {
  try {
    const context = await resolveAuthenticatedAccount();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!context.account) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = completeOnboardingInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid or incomplete onboarding data' },
        { status: 400 },
      );
    }

    const input = parsed.data;
    if (!legacyAccountIdMatches(input.id, context.account.id)) {
      return NextResponse.json(
        { error: 'Not authorized to update this account' },
        { status: 403 },
      );
    }

    const result = await completeServerAccountOnboarding(
      context.account.id,
      input,
    );

    return NextResponse.json({ user: result.user as DbUser });
  } catch (error) {
    if (error instanceof OnboardingError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    console.error('Error completing onboarding:', error);
    return NextResponse.json({ error: 'Failed to complete onboarding' }, { status: 500 });
  }
}
