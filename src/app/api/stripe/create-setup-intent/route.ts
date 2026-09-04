import { NextRequest, NextResponse } from 'next/server';
import { stripe, TRIAL_DAYS } from '@/lib/stripe';
import { sql } from '@/lib/db';
import {
  AccountAccessError,
  assertLegacyAccountId,
  requireAuthenticatedAccount,
} from '@/lib/auth/account';

// =============================================================================
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

    // Parse and validate request body
    const body = await request.json();
    // 2026-05-20 (paras): papCookie is the optional PostAffiliatePro tracking
    // value (account ID + visitor ID concatenated) sent by the client when an
    // affiliate referred this signup. If absent, the signup is treated as
    // organic and no affiliate attribution happens.
    const { userId: legacyUserId, email, papCookie } = body;

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
    const existingSubscriptions = await sql`
      SELECT stripe_customer_id FROM crewcast.subscriptions WHERE user_id = ${userId}
    `;

    let stripeCustomerId: string | null = null;

    if (existingSubscriptions.length > 0 && existingSubscriptions[0].stripe_customer_id) {
      stripeCustomerId = existingSubscriptions[0].stripe_customer_id;
      console.log(`[Stripe] Using existing customer: ${stripeCustomerId} for user ${userId}`);
    }

    // ==========================================================================
    // CREATE STRIPE CUSTOMER IF NEEDED
    // ==========================================================================
    if (!stripeCustomerId) {
      console.log(`[Stripe] Creating new customer for user ${userId}`);
      
      // 2026-05-20 (paras): set Stripe customer.description to the PAP cookie
      // value when an affiliate referred this signup. PAP's Stripe plugin
      // (configured by David at work.selecdoo.com/plugins/Stripe/stripe.php)
      // reads this exact field to attribute charges to the right affiliate.
      // Setting it once at customer creation means every future subscription
      // / charge tied to this customer inherits the attribution automatically.
      const customer = await stripe.customers.create({
        email: email,
        name: user.name || undefined,
        description: typeof papCookie === 'string' && papCookie ? papCookie : undefined,
        metadata: {
          neon_user_id: userId.toString(),
          created_from: 'setup_intent',
        },
      });

      stripeCustomerId = customer.id;
      console.log(`[Stripe] Created customer: ${stripeCustomerId}`);

      // Save customer ID to database immediately
      // Check if subscription record exists
      const subExists = await sql`
        SELECT id FROM crewcast.subscriptions WHERE user_id = ${userId}
      `;

      if (subExists.length > 0) {
        await sql`
          UPDATE crewcast.subscriptions 
          SET stripe_customer_id = ${stripeCustomerId}, updated_at = NOW()
          WHERE user_id = ${userId}
        `;
      } else {
        // Create a placeholder subscription record with just the customer ID
        await sql`
          INSERT INTO crewcast.subscriptions (user_id, stripe_customer_id, plan, status, cancel_at_period_end)
          VALUES (${userId}, ${stripeCustomerId}, 'free_trial', 'incomplete', false)
        `;
      }
    }

    // ==========================================================================
    // CREATE SETUP INTENT
    // This allows secure card collection without immediate payment
    // ==========================================================================
    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      metadata: {
        neon_user_id: userId.toString(),
        trial_days: TRIAL_DAYS.toString(),
      },
      // Enable automatic payment methods for better conversion
      usage: 'off_session', // Allow future charges without customer present
    });

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
