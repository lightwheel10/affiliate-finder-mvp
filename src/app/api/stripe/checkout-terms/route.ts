import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { TRIAL_DAYS } from '@/lib/stripe';
import {
  AccountAccessError,
  requireAuthenticatedAccount,
} from '@/lib/auth/account';
import {
  readInitialTrialDays,
  type InitialTrialSql,
} from '@/lib/stripe/initial-trial-postgres';

/**
 * Returns billing terms immediately before card entry. This is deliberately
 * server-owned: browser state and profile fields cannot grant another trial.
 */
export async function GET() {
  try {
    const authenticated = await requireAuthenticatedAccount();
    const trialDays = await readInitialTrialDays(
      sql as unknown as InitialTrialSql,
      authenticated.account.id,
      TRIAL_DAYS,
    );

    return NextResponse.json(
      {
        trialDays: trialDays ?? 0,
        chargeTiming: trialDays === undefined ? 'now' : 'after_trial',
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    if (error instanceof AccountAccessError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    console.error('[Stripe Checkout Terms] Failed to read checkout terms:', error);
    return NextResponse.json(
      { error: 'Could not confirm billing terms.', code: 'CHECKOUT_TERMS_UNAVAILABLE' },
      { status: 500 },
    );
  }
}
