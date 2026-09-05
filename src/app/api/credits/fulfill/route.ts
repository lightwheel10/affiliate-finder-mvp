import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import {
  AccountAccessError,
  assertLegacyAccountId,
  requireAuthenticatedAccount,
} from '@/lib/auth/account';
import {
  CreditCheckoutValidationError,
  fulfillPaidCreditCheckoutSession,
} from '@/lib/stripe/credit-fulfillment';
import {
  readStripeMutationJson,
  StripeMutationRequestError,
} from '@/lib/stripe/mutation-request';

// Customer-return safety net. Stripe's signed webhook remains the primary path,
// but the exact paid Checkout Session can also be fulfilled immediately after
// redirect. Both paths call the same validation and idempotent grant service.
export const dynamic = 'force-dynamic';

const fulfillCreditsSchema = z.object({
  userId: z.number().int().positive(),
  sessionId: z.string().max(255).regex(/^cs_(?:test_|live_)?[A-Za-z0-9]+$/).optional(),
}).strict();

export async function POST(request: NextRequest) {
  try {
    const authenticated = await requireAuthenticatedAccount();
    const parsedBody = fulfillCreditsSchema.safeParse(await readStripeMutationJson(request));
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Invalid request input.', code: 'INVALID_INPUT' },
        { status: 400 },
      );
    }
    assertLegacyAccountId(parsedBody.data.userId, authenticated.account.id);
    const accountId = authenticated.account.id;

    const sessionIds = parsedBody.data.sessionId
      ? [parsedBody.data.sessionId]
      : (await sql<{ stripe_checkout_session_id: string }[]>`
          SELECT stripe_checkout_session_id
          FROM crewcast.credit_purchases
          WHERE user_id = ${accountId}
            AND status = 'pending'
            AND stripe_checkout_session_id IS NOT NULL
          ORDER BY created_at DESC
          LIMIT 20
        `).map((purchase: { stripe_checkout_session_id: string }) => purchase.stripe_checkout_session_id);

    if (sessionIds.length === 0) {
      return NextResponse.json({
        fulfilled: 0,
        alreadyApplied: 0,
        awaitingPayment: 0,
        message: 'No pending purchases were found.',
      });
    }

    let fulfilled = 0;
    let alreadyApplied = 0;
    let awaitingPayment = 0;
    let operationalFailures = 0;
    const results: Array<{ sessionId: string; status: string }> = [];
    for (const sessionId of sessionIds) {
      try {
        const result = await fulfillPaidCreditCheckoutSession(sessionId, accountId);
        if (result.status === 'applied') fulfilled++;
        if (result.status === 'already_applied') alreadyApplied++;
        if (result.status === 'awaiting_payment') awaitingPayment++;
        results.push({ sessionId, status: result.status });
      } catch (error) {
        if (error instanceof CreditCheckoutValidationError) {
          console.error(`[Credits Fulfill] Rejected Stripe Session ${sessionId}:`, error.message);
          results.push({ sessionId, status: 'rejected' });
          continue;
        }
        operationalFailures++;
        console.error(`[Credits Fulfill] Temporary failure for Stripe Session ${sessionId}:`, error);
        results.push({ sessionId, status: 'temporary_failure' });
      }
    }

    return NextResponse.json(
      {
        fulfilled,
        alreadyApplied,
        awaitingPayment,
        results,
        message: operationalFailures > 0
          ? 'Stripe confirmed the request, but one or more purchases still need automatic retry.'
          : 'Purchase verification completed.',
      },
      { status: operationalFailures > 0 ? 503 : 200 },
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
    console.error('[Credits Fulfill] Error:', error);
    return NextResponse.json(
      { error: 'Failed to verify pending purchases.' },
      { status: 500 },
    );
  }
}
