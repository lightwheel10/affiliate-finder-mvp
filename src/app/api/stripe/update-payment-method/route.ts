import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { sql } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/supabase/server'; // January 19th, 2026: Migrated from Stack Auth

// =============================================================================
// UPDATE PAYMENT METHOD API
//
// Updates the default payment method for an existing Stripe customer/subscription.
// This is used when a user adds a new card via the AddCardModal.
//
// SECURITY:
// - Server-side authentication via Stack Auth
// - Authorization check: user can only update their own payment method
// - No raw card data touches this server - only PaymentMethod IDs from Stripe
// =============================================================================

export const dynamic = 'force-dynamic';

interface UpdatePaymentMethodBody {
  userId: number;
  paymentMethodId: string;
  customerId?: string;
}

export async function POST(request: NextRequest) {
  try {
    // ==========================================================================
    // AUTHENTICATION: Verify user is logged in
    // ==========================================================================
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in.' },
        { status: 401 }
      );
    }

    const body: UpdatePaymentMethodBody = await request.json();
    const { userId, paymentMethodId, customerId } = body;

    // ==========================================================================
    // INPUT VALIDATION
    // ==========================================================================
    if (!userId || typeof userId !== 'number') {
      return NextResponse.json(
        { error: 'Invalid userId' },
        { status: 400 }
      );
    }

    if (!paymentMethodId || typeof paymentMethodId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid paymentMethodId' },
        { status: 400 }
      );
    }

    // ==========================================================================
    // FETCH USER & SUBSCRIPTION DATA
    // ==========================================================================
    const users = await sql`
      SELECT u.id, u.email, u.name, s.stripe_customer_id, s.stripe_subscription_id
      FROM crewcast.users u
      LEFT JOIN crewcast.subscriptions s ON u.id = s.user_id
      WHERE u.id = ${userId}
    `;

    if (users.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const user = users[0];

    // ==========================================================================
    // AUTHORIZATION: Verify the authenticated user matches the target user
    // ==========================================================================
    if (authUser.email !== user.email) {
      console.error('[UpdatePaymentMethod] Auth mismatch:', {
        authEmail: authUser.email,
        userEmail: user.email,
      });
      return NextResponse.json(
        { error: 'You can only update your own payment method' },
        { status: 403 }
      );
    }

    // ==========================================================================
    // GET STRIPE CUSTOMER ID
    // ==========================================================================
    const stripeCustomerId = user.stripe_customer_id || customerId;

    if (!stripeCustomerId) {
      return NextResponse.json(
        { error: 'No Stripe customer found for this user' },
        { status: 400 }
      );
    }

    // ==========================================================================
    // ATTACH PAYMENT METHOD TO CUSTOMER
    // ==========================================================================
    try {
      // Attach the payment method to the customer (if not already attached)
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: stripeCustomerId,
      });
      console.log(`[UpdatePaymentMethod] Attached payment method ${paymentMethodId} to customer ${stripeCustomerId}`);
    } catch (attachError) {
      // If already attached, that's fine - continue
      const error = attachError as { code?: string; message?: string };
      if (error.code !== 'resource_already_exists') {
        console.error('[UpdatePaymentMethod] Failed to attach payment method:', error);
        throw attachError;
      }
      console.log('[UpdatePaymentMethod] Payment method already attached to customer');
    }

    // ==========================================================================
    // SET AS DEFAULT PAYMENT METHOD ON CUSTOMER
    // ==========================================================================
    await stripe.customers.update(stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });
    console.log(`[UpdatePaymentMethod] Set ${paymentMethodId} as default for customer ${stripeCustomerId}`);

    // ==========================================================================
    // UPDATE SUBSCRIPTION DEFAULT PAYMENT METHOD (if subscription exists)
    // ==========================================================================
    if (user.stripe_subscription_id) {
      try {
        await stripe.subscriptions.update(user.stripe_subscription_id, {
          default_payment_method: paymentMethodId,
        });
        console.log(`[UpdatePaymentMethod] Updated subscription ${user.stripe_subscription_id} default payment method`);
      } catch (subError) {
        // Log but don't fail - customer default is set
        console.warn('[UpdatePaymentMethod] Failed to update subscription payment method:', subError);
      }
    }

    // ==========================================================================
    // UPDATE LOCAL DATABASE with payment method info (for display only)
    // ==========================================================================
    try {
      // Retrieve payment method details from Stripe for display purposes
      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
      
      if (paymentMethod.card) {
        await sql`
          UPDATE crewcast.subscriptions
          SET 
            stripe_payment_method_id = ${paymentMethodId},
            card_last4 = ${paymentMethod.card.last4},
            card_brand = ${paymentMethod.card.brand},
            card_exp_month = ${paymentMethod.card.exp_month},
            card_exp_year = ${paymentMethod.card.exp_year},
            updated_at = NOW()
          WHERE user_id = ${userId}
        `;
        console.log(`[UpdatePaymentMethod] Updated local DB with card info for user ${userId}`);
      }
    } catch (dbError) {
      // Log but don't fail - Stripe is the source of truth
      console.warn('[UpdatePaymentMethod] Failed to update local DB:', dbError);
    }

    // ==========================================================================
    // SUCCESS RESPONSE
    // ==========================================================================
    return NextResponse.json({
      success: true,
      message: 'Payment method updated successfully',
      paymentMethodId,
    });

  } catch (error) {
    console.error('[UpdatePaymentMethod] Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to update payment method';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
