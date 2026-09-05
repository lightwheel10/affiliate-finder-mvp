import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import type postgres from 'postgres';
import { z } from 'zod';
import { stripe, TRIAL_DAYS } from '@/lib/stripe';
import { sql } from '@/lib/db';
import {
  AccountAccessError,
  assertLegacyAccountId,
  requireAuthenticatedAccount,
} from '@/lib/auth/account';
import {
  initialStripeCustomerIdempotencyKey,
  selectSingleApplicationStripeCustomer,
  setupIntentIdempotencyKey,
} from '@/lib/stripe/subscription-creation';
import {
  readStripeMutationJson,
  StripeMutationRequestError,
} from '@/lib/stripe/mutation-request';

// =============================================================================

const setupIntentSchema = z.object({
  userId: z.number().int().positive(),
  email: z.string().email().max(512),
  papCookie: z.string().trim().min(1).max(1_024).optional(),
  // Optional only so an already-open page from the previous deployment keeps
  // working. New clients send this ID; old clients receive a server-generated
  // one and still get an idempotent Stripe request.
  requestId: z.uuid().optional(),
}).strict();
// POST /api/stripe/create-setup-intent
// 
// Creates a Stripe SetupIntent for securely collecting and saving card details.
// This is the first step in the payment flow - it allows Stripe to:
// 1. Securely collect card details via Stripe Elements (card never touches our server)
// 2. Validate the card with the bank
// 3. Handle 3D Secure authentication if required
// 4. Create a reusable PaymentMethod for future charges
//
// SECURITY:
// - Requires authenticated Stack Auth session
// - Verifies authenticated user matches the requested userId
// - Validates that userId exists in our database
// - Creates or retrieves existing Stripe Customer
// - Returns client_secret for frontend to complete card setup
// - Card data NEVER touches our server
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    // ==========================================================================
    // AUTHENTICATION CHECK
    // Verify the user is authenticated via Stack Auth
    // ==========================================================================
    const authenticated = await requireAuthenticatedAccount();

    const parsedBody = setupIntentSchema.safeParse(await readStripeMutationJson(request));
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Invalid request input.', code: 'INVALID_INPUT' },
        { status: 400 },
      );
    }
    // 2026-05-20 (paras): papCookie is the optional PostAffiliatePro tracking
    // value (account ID + visitor ID concatenated) sent by the client when an
    // affiliate referred this signup. If absent, the signup is treated as
    // organic and no affiliate attribution happens.
    const { userId: legacyUserId, email, papCookie, requestId } = parsedBody.data;

    // ==========================================================================
    // INPUT VALIDATION
    // ==========================================================================
    if (!legacyUserId || typeof legacyUserId !== 'number') {
      return NextResponse.json(
        { error: 'Valid user ID is required' },
        { status: 400 }
      );
    }
    assertLegacyAccountId(legacyUserId, authenticated.account.id);
    const userId = authenticated.account.id;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400 }
      );
    }

    // ==========================================================================
    // VERIFY USER EXISTS IN OUR DATABASE
    // This prevents creating Stripe resources for non-existent users
    // ==========================================================================
    const users = await sql`
      SELECT id, email, name FROM crewcast.users WHERE id = ${userId}
    `;

    if (users.length === 0) {
      console.error(`[Stripe] User not found: ${userId}`);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const user = users[0];

    // Verify email in request matches (additional validation)
    if (user.email !== email) {
      console.error(`[Stripe] Email mismatch for user ${userId}: ${email} vs ${user.email}`);
      return NextResponse.json(
        { error: 'Email does not match user account' },
        { status: 403 }
      );
    }

    // ==========================================================================
    // CHECK FOR EXISTING STRIPE CUSTOMER
    // If user already has a Stripe customer, reuse it (idempotency)
    // ==========================================================================
    const stripeCustomerId = await (sql as unknown as {
      begin<T>(callback: (transaction: postgres.Sql) => Promise<T>): Promise<T>;
    }).begin(async (transaction) => {
      // Serialize customer creation for one application account. Stripe's
      // stable key also makes a retry after an uncertain network response
      // return the same Customer instead of creating another one.
      await transaction`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${`stripe-customer:${userId}`}, 0)
        )
      `;
      const existingSubscriptions = await transaction<{
        id: number;
        stripe_customer_id: string | null;
      }[]>`
        SELECT id, stripe_customer_id
        FROM crewcast.subscriptions
        WHERE user_id = ${userId}
        LIMIT 2
        FOR UPDATE
      `;
      if (existingSubscriptions.length > 1) {
        throw new Error(`Account ${userId} has multiple subscription records.`);
      }
      if (existingSubscriptions[0]?.stripe_customer_id) {
        return existingSubscriptions[0].stripe_customer_id;
      }

      // Recover a customer from a prior process failure even after Stripe's
      // idempotency retention window. The email narrows the bounded list; the
      // server-owned application ID in metadata is the actual identity check.
      const customerCandidates = await stripe.customers.list({ email, limit: 100 });
      const recoveredCustomer = selectSingleApplicationStripeCustomer(
        customerCandidates.data,
        customerCandidates.has_more,
        userId,
      );

      console.log(
        recoveredCustomer
          ? `[Stripe] Recovering initial customer for user ${userId}`
          : `[Stripe] Creating initial customer for user ${userId}`,
      );
      // 2026-05-20 (Paras): PAP reads this description for referral
      // attribution. It is bounded and copied only on the first customer.
      const customer = recoveredCustomer ?? await stripe.customers.create(
        {
          email,
          name: user.name || undefined,
          description: papCookie,
          metadata: {
            neon_user_id: userId.toString(),
            created_from: 'setup_intent',
          },
        },
        { idempotencyKey: initialStripeCustomerIdempotencyKey(userId) },
      );

      if (existingSubscriptions.length === 1) {
        const updated = await transaction<{ id: number }[]>`
          UPDATE crewcast.subscriptions
          SET stripe_customer_id = ${customer.id}, updated_at = NOW()
          WHERE id = ${existingSubscriptions[0].id}
            AND user_id = ${userId}
            AND stripe_customer_id IS NULL
          RETURNING id
        `;
        if (updated.length !== 1) {
          throw new Error('Stripe customer was not attached to exactly one subscription record.');
        }
      } else {
        const inserted = await transaction<{ id: number }[]>`
          INSERT INTO crewcast.subscriptions (
            user_id, stripe_customer_id, plan, status, cancel_at_period_end
          ) VALUES (
            ${userId}, ${customer.id}, 'free_trial', 'incomplete', false
          )
          RETURNING id
        `;
        if (inserted.length !== 1) {
          throw new Error('Stripe customer placeholder was not created exactly once.');
        }
      }
      return customer.id;
    });

    // ==========================================================================
    // CREATE SETUP INTENT
    // This allows secure card collection without immediate payment
    // ==========================================================================
    const setupIntentRequestId = requestId ?? randomUUID();
    const setupIntent = await stripe.setupIntents.create(
      {
        customer: stripeCustomerId,
        payment_method_types: ['card'],
        metadata: {
          neon_user_id: userId.toString(),
          trial_days: TRIAL_DAYS.toString(),
        },
        usage: 'off_session',
      },
      {
        idempotencyKey: setupIntentIdempotencyKey(
          userId,
          stripeCustomerId,
          setupIntentRequestId,
        ),
      },
    );

    console.log(`[Stripe] Created SetupIntent: ${setupIntent.id} for customer ${stripeCustomerId}`);

    // ==========================================================================
    // RETURN CLIENT SECRET
    // The frontend uses this to confirm the SetupIntent with Stripe.js
    // ==========================================================================
    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      setupIntentId: setupIntent.id,
    });

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
    console.error('[Stripe] Error creating SetupIntent:', error);
    
    // Handle specific Stripe errors
    if (error instanceof Error && 'type' in error) {
      const stripeError = error as { type: string; message: string };
      return NextResponse.json(
        { error: stripeError.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create setup intent' },
      { status: 500 }
    );
  }
}
