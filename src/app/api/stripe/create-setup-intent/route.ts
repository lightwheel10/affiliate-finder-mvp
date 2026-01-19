import { NextRequest, NextResponse } from 'next/server';
import { stripe, TRIAL_DAYS } from '@/lib/stripe';
import { sql } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/supabase/server'; // January 19th, 2026: Migrated from Stack Auth

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
    const authUser = await getAuthenticatedUser();
    
    if (!authUser) {
      console.error('[Stripe] Unauthorized: No authenticated user');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const { userId, email } = body;

    // ==========================================================================
    // INPUT VALIDATION
    // ==========================================================================
    if (!userId || typeof userId !== 'number') {
      return NextResponse.json(
        { error: 'Valid user ID is required' },
        { status: 400 }
      );
    }

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

    // ==========================================================================
    // AUTHORIZATION CHECK
    // Verify the authenticated user matches the requested user
    // This prevents users from creating SetupIntents for other users
    // ==========================================================================
    if (authUser.email !== user.email) {
      console.error(`[Stripe] Authorization failed: ${authUser.email} tried to access user ${userId} (${user.email})`);
      return NextResponse.json(
        { error: 'Not authorized to access this resource' },
        { status: 403 }
      );
    }

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
      
      const customer = await stripe.customers.create({
        email: email,
        name: user.name || undefined,
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
      customerId: stripeCustomerId,
      setupIntentId: setupIntent.id,
    });

  } catch (error) {
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
