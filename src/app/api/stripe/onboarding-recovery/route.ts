import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { AccountAccessError, requireAuthenticatedAccount } from '@/lib/auth/account';
import { requireServerOwnedStripeCustomerId } from '@/lib/stripe-customer-ownership';
import {
  onboardingRecoveryAction,
  type OnboardingRecoveryAction,
} from '@/lib/stripe/onboarding-recovery';
import { recoverOnboardingSubscription } from '@/lib/stripe/onboarding-recovery-server';
import { readStripeMutationJson, StripeMutationRequestError } from '@/lib/stripe/mutation-request';
import { selectSingleReusableInitialSubscription } from '@/lib/stripe/subscription-creation';

const recoveryRequestSchema = z.object({}).strict();

interface LocalSubscriptionRow {
  stripe_customer_id: string | null;
}

function response(action: OnboardingRecoveryAction) {
  return NextResponse.json(
    { action },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

/**
 * Reconciles an interrupted first subscription from Stripe before the payment
 * step decides whether another card form is safe to show.
 */
export async function POST(request: NextRequest) {
  try {
    const authenticated = await requireAuthenticatedAccount();
    const parsed = recoveryRequestSchema.safeParse(await readStripeMutationJson(request));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request input.', code: 'INVALID_INPUT' },
        { status: 400 },
      );
    }

    const subscriptions = await sql<LocalSubscriptionRow[]>`
      SELECT stripe_customer_id
      FROM crewcast.subscriptions
      WHERE user_id = ${authenticated.account.id}
      ORDER BY id
      LIMIT 2
    `;
    if (subscriptions.length > 1) {
      throw new Error(`Account ${authenticated.account.id} has multiple subscription records.`);
    }
    if (subscriptions.length === 0 || subscriptions[0].stripe_customer_id === null) {
      return response('collect_card');
    }

    const stripeCustomerId = requireServerOwnedStripeCustomerId(
      subscriptions[0].stripe_customer_id,
    );
    const candidates = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'all',
      limit: 100,
    });
    const subscription = selectSingleReusableInitialSubscription(
      candidates.data,
      candidates.has_more,
    );
    if (!subscription) return response('collect_card');

    const action = onboardingRecoveryAction(subscription.status);
    if (action !== 'finish_onboarding') return response(action);

    const recovered = await recoverOnboardingSubscription(sql, stripe, {
      userId: authenticated.account.id,
      stripeCustomerId,
      subscription,
      prices: {
        proMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
        proAnnual: process.env.STRIPE_PRICE_PRO_ANNUAL,
        businessMonthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY,
        businessAnnual: process.env.STRIPE_PRICE_BUSINESS_ANNUAL,
      },
    });
    return NextResponse.json(
      {
        action,
        subscription: {
          status: recovered.status,
          plan: recovered.plan,
          billingInterval: recovered.billingInterval,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof StripeMutationRequestError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    if (error instanceof AccountAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[Stripe] Failed to recover onboarding subscription:', error);
    return NextResponse.json(
      { error: 'Could not safely verify the existing subscription.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
