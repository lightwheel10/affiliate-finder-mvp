import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { sql } from '@/lib/db';
import { stackServerApp } from '@/stack/server';

// =============================================================================
// DELETE /api/users/delete
// 
// Created: January 13th, 2026
// 
// Permanently deletes a user account. This action is IRREVERSIBLE.
// 
// What gets deleted:
// 1. Stripe subscription (canceled immediately, no refund)
// 2. All saved_affiliates for this user
// 3. All discovered_affiliates for this user
// 4. All searches for this user
// 5. All api_calls for this user
// 6. The subscription record
// 7. The user record from Neon DB
// 8. The user from Stack Auth
//
// SECURITY:
// - Requires authenticated Stack Auth session
// - Verifies authenticated user matches the requested userId
// - Validates user must type "DELETE" to confirm
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    // ==========================================================================
    // AUTHENTICATION CHECK
    // Verify the user is authenticated via Stack Auth
    // ==========================================================================
    const authUser = await stackServerApp.getUser();
    
    if (!authUser) {
      console.error('[DeleteAccount] Unauthorized: No authenticated user');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { userId, confirmText } = body;

    // ==========================================================================
    // INPUT VALIDATION
    // ==========================================================================
    if (!userId || typeof userId !== 'number') {
      return NextResponse.json(
        { error: 'Valid user ID is required' },
        { status: 400 }
      );
    }

    // January 13th, 2026: Require user to type "DELETE" to confirm
    if (!confirmText || confirmText !== 'DELETE') {
      return NextResponse.json(
        { error: 'You must type DELETE to confirm account deletion' },
        { status: 400 }
      );
    }

    // ==========================================================================
    // GET USER FROM DATABASE
    // January 13th, 2026: Only select id and email (stack_auth_id doesn't exist in schema)
    // ==========================================================================
    const users = await sql`
      SELECT id, email
      FROM users
      WHERE id = ${userId}
    `;

    if (users.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = users[0];

    // ==========================================================================
    // AUTHORIZATION CHECK
    // Verify the authenticated user matches the requested user
    // ==========================================================================
    if (authUser.primaryEmail !== userData.email) {
      console.error(`[DeleteAccount] Authorization failed: ${authUser.primaryEmail} tried to delete user ${userId}`);
      return NextResponse.json(
        { error: 'Not authorized to delete this account' },
        { status: 403 }
      );
    }

    console.log(`[DeleteAccount] Starting account deletion for user ${userId} (${userData.email})`);

    // ==========================================================================
    // STEP 1: CANCEL STRIPE SUBSCRIPTION (if exists)
    // January 13th, 2026: Simple approach - cancel immediately, no refund
    // ==========================================================================
    const subscriptions = await sql`
      SELECT stripe_subscription_id, stripe_customer_id
      FROM subscriptions
      WHERE user_id = ${userId}
    `;

    if (subscriptions.length > 0 && subscriptions[0].stripe_subscription_id) {
      const { stripe_subscription_id } = subscriptions[0];
      
      try {
        console.log(`[DeleteAccount] Canceling Stripe subscription ${stripe_subscription_id}`);
        await stripe.subscriptions.cancel(stripe_subscription_id);
        console.log(`[DeleteAccount] Stripe subscription canceled successfully`);
      } catch (stripeError) {
        // Log but don't fail - subscription might already be canceled
        console.error('[DeleteAccount] Error canceling Stripe subscription:', stripeError);
      }
    }

    // ==========================================================================
    // STEP 2: DELETE ALL USER DATA FROM NEON DB
    // Order matters due to foreign key constraints
    // January 13th, 2026: Delete all related records before deleting user
    // ==========================================================================
    
    // Delete saved affiliates
    const deletedSaved = await sql`
      DELETE FROM saved_affiliates WHERE user_id = ${userId}
      RETURNING id
    `;
    console.log(`[DeleteAccount] Deleted ${deletedSaved.length} saved affiliates`);

    // Delete discovered affiliates
    const deletedDiscovered = await sql`
      DELETE FROM discovered_affiliates WHERE user_id = ${userId}
      RETURNING id
    `;
    console.log(`[DeleteAccount] Deleted ${deletedDiscovered.length} discovered affiliates`);

    // Delete searches
    const deletedSearches = await sql`
      DELETE FROM searches WHERE user_id = ${userId}
      RETURNING id
    `;
    console.log(`[DeleteAccount] Deleted ${deletedSearches.length} searches`);

    // Delete API call logs
    const deletedApiCalls = await sql`
      DELETE FROM api_calls WHERE user_id = ${userId}
      RETURNING id
    `;
    console.log(`[DeleteAccount] Deleted ${deletedApiCalls.length} API call logs`);

    // Delete subscription record
    const deletedSubscriptions = await sql`
      DELETE FROM subscriptions WHERE user_id = ${userId}
      RETURNING id
    `;
    console.log(`[DeleteAccount] Deleted ${deletedSubscriptions.length} subscription records`);

    // Delete user record (must be last due to foreign keys)
    await sql`
      DELETE FROM users WHERE id = ${userId}
    `;
    console.log(`[DeleteAccount] Deleted user record`);

    // ==========================================================================
    // STEP 3: DELETE FROM STACK AUTH
    // January 13th, 2026: Delete the authentication account
    // Note: We use authUser.id directly (string) to get the ServerUser
    // ==========================================================================
    try {
      // Get the Stack Auth user by their ID and delete
      // stackServerApp.getUser(id) takes a string ID directly, not an object
      const stackUser = await stackServerApp.getUser(authUser.id);
      if (stackUser) {
        await stackUser.delete();
        console.log(`[DeleteAccount] Deleted Stack Auth user`);
      }
    } catch (stackError) {
      // Log but don't fail - user might already be deleted
      console.error('[DeleteAccount] Error deleting Stack Auth user:', stackError);
    }

    console.log(`[DeleteAccount] Account deletion completed for user ${userId}`);

    return NextResponse.json({
      success: true,
      message: 'Account deleted successfully',
      deletedData: {
        savedAffiliates: deletedSaved.length,
        discoveredAffiliates: deletedDiscovered.length,
        searches: deletedSearches.length,
        apiCalls: deletedApiCalls.length,
        subscriptions: deletedSubscriptions.length,
      },
    });

  } catch (error) {
    console.error('[DeleteAccount] Error deleting account:', error);
    
    return NextResponse.json(
      { error: 'Failed to delete account. Please try again or contact support.' },
      { status: 500 }
    );
  }
}
