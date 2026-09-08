import { NextRequest, NextResponse } from 'next/server';
import {
  stripe,
  STRIPE_BASE_PRICE_CONFIGURATION,
  STRIPE_CAPACITY_PRICE_CONFIGURATION,
} from '@/lib/stripe';
import { sql } from '@/lib/db';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import {
  legacyAccountIdMatches,
  resolveAuthenticatedAccount,
} from '@/lib/auth/account';
import { deletePostgresAccountData } from '@/lib/users/delete-account-postgres';
import { deleteOnboardingSuggestionIdentityGuard } from '@/lib/suggestions/analysis-postgres';
import { selectAuthoritativeCustomerSubscription } from '@/lib/stripe/subscription-creation';
import { extractStripeId, snapshotStripeSubscription } from '@/lib/stripe/subscription-state';
import { cancelCapacityAfterBaseEnded } from '@/lib/stripe/capacity-lifecycle-server';

const TERMINAL_SUBSCRIPTION_STATUSES = new Set([
  'incomplete_expired',
  'canceled',
  'unpaid',
]);

// =============================================================================
// DELETE /api/users/delete
// 
// Created: January 13th, 2026
// Updated: January 19th, 2026 - Migrated from Stack Auth to Supabase
// 
// Permanently deletes a user account. This action is IRREVERSIBLE.
// 
// What gets deleted:
// 1. Stripe base and paid-capacity subscriptions (canceled immediately, no refund)
// 2. All saved_affiliates for this user
// 3. All discovered_affiliates for this user
// 4. All searches for this user
// 5. All api_calls for this user
// 6. The subscription record
// 7. The user record from database
// 8. The user from Supabase Auth
//
// SECURITY:
// - Requires authenticated Supabase session
// - Resolves the database user from the authenticated Supabase identity
// - Accepts a legacy userId only for compatibility and never as authority
// - Validates user must type "DELETE" to confirm
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    // ==========================================================================
    // AUTHENTICATION AND ACCOUNT RESOLUTION
    // ==========================================================================
    const context = await resolveAuthenticatedAccount();
    
    if (!context) {
      console.error('[DeleteAccount] Unauthorized: No authenticated user');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!context.account) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const authUser = context.authUser;

    let body: unknown;
    let authIdentityDeleted = false;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { userId: legacyUserId, confirmText } = body as {
      userId?: unknown;
      confirmText?: unknown;
    };

    // ==========================================================================
    // INPUT VALIDATION
    // ==========================================================================
    if (
      legacyUserId !== undefined &&
      (typeof legacyUserId !== 'number' || !Number.isInteger(legacyUserId) || legacyUserId <= 0)
    ) {
      return NextResponse.json(
        { error: 'Invalid legacy user ID' },
        { status: 400 }
      );
    }

    if (
      !legacyAccountIdMatches(
        legacyUserId as number | undefined,
        context.account.id,
      )
    ) {
      return NextResponse.json(
        { error: 'Not authorized to delete this account' },
        { status: 403 },
      );
    }

    // January 13th, 2026: Require user to type "DELETE" to confirm
    if (!confirmText || confirmText !== 'DELETE') {
      return NextResponse.json(
        { error: 'You must type DELETE to confirm account deletion' },
        { status: 400 }
      );
    }

    const userId = context.account.id;

    // ==========================================================================
    // GET USER FROM DATABASE
    // January 13th, 2026: Only select id and email (stack_auth_id doesn't exist in schema)
    // ==========================================================================
    const users = await sql`
      SELECT id, email, auth_user_id::text AS auth_user_id
      FROM crewcast.users
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
    // DEFENCE IN DEPTH
    // The resolver already bound this row to the immutable Auth UUID. Recheck
    // the fetched row before performing the irreversible workflow.
    // ==========================================================================
    if (authUser.id !== userData.auth_user_id) {
      console.error(`[DeleteAccount] Immutable Auth identity mismatch for user ${userId}`);
      return NextResponse.json(
        { error: 'Not authorized to delete this account' },
        { status: 403 }
      );
    }

    console.log(`[DeleteAccount] Starting account deletion for user ${userId} (${userData.email})`);

    // ==========================================================================
    // STEP 1: CANCEL EVERY APPLICATION STRIPE SUBSCRIPTION (if any)
    // Do not erase ownership records unless Stripe proves recurring billing is
    // already terminal. Otherwise a failed provider call could orphan a charge.
    // ==========================================================================
    const subscriptions = await sql<{
      stripe_subscription_id: string | null;
      stripe_customer_id: string | null;
    }[]>`
      SELECT stripe_subscription_id, stripe_customer_id
      FROM crewcast.subscriptions
      WHERE user_id = ${userId}
      LIMIT 2
    `;
    if (subscriptions.length > 1) {
      throw new Error('Account has more than one application subscription record.');
    }

    if (subscriptions.length === 1) {
      const storedSubscriptionId = subscriptions[0].stripe_subscription_id;
      const customerId = subscriptions[0].stripe_customer_id;
      let baseSubscriptionId = storedSubscriptionId;

      if (customerId) {
        const customerSubscriptions = await stripe.subscriptions.list({
          customer: customerId,
          status: 'all',
          limit: 100,
        });
        const authoritativeBase = selectAuthoritativeCustomerSubscription(
          customerSubscriptions.data,
          customerSubscriptions.has_more,
          STRIPE_BASE_PRICE_CONFIGURATION,
        );
        baseSubscriptionId = authoritativeBase?.id ?? baseSubscriptionId;

        if (baseSubscriptionId) {
          await cancelCapacityAfterBaseEnded(
            stripe,
            {
              userId,
              stripeCustomerId: customerId,
              stripeBaseSubscriptionId: baseSubscriptionId,
            },
            STRIPE_CAPACITY_PRICE_CONFIGURATION,
          );
        }
      }

      if (baseSubscriptionId) {
        const currentBase = await stripe.subscriptions.retrieve(baseSubscriptionId);
        const currentBaseSnapshot = snapshotStripeSubscription(
          currentBase,
          STRIPE_BASE_PRICE_CONFIGURATION,
        );
        if (
          currentBaseSnapshot.subscriptionId !== baseSubscriptionId
          || (customerId && currentBaseSnapshot.customerId !== customerId)
          || !currentBaseSnapshot.plan
        ) {
          throw new Error('The account base subscription failed Stripe ownership validation.');
        }
        if (!TERMINAL_SUBSCRIPTION_STATUSES.has(currentBaseSnapshot.status)) {
          console.log(`[DeleteAccount] Canceling Stripe base subscription ${baseSubscriptionId}`);
          const canceledBase = await stripe.subscriptions.cancel(baseSubscriptionId);
          if (
            canceledBase.status !== 'canceled'
            || extractStripeId(canceledBase.customer) !== currentBaseSnapshot.customerId
          ) {
            throw new Error('Stripe did not cancel the account base subscription.');
          }
          console.log('[DeleteAccount] Stripe base subscription canceled successfully');
        }
      }
    }

    // ==========================================================================
    // STEP 2: DELETE ALL USER DATA FROM NEON DB
    // Order matters due to foreign key constraints
    // January 13th, 2026: Delete all related records before deleting user
    // ==========================================================================
    
    // Lock the account and delete every database row in one transaction. The
    // onboarding and search-claim paths lock this same account row first, so
    // they either finish before deletion or observe that the account is gone;
    // they cannot recreate a restrictive child row halfway through deletion.
    const deletedData = await deletePostgresAccountData(userId, sql);

    console.log('[DeleteAccount] Database deletion committed', deletedData);

    // ==========================================================================
    // STEP 3: DELETE FROM SUPABASE AUTH
    // January 19th, 2026: Migrated from Stack Auth to Supabase
    // Note: We use the service role client to delete the auth user
    // ==========================================================================
    try {
      // Get the Supabase admin client and delete the auth user
      const supabaseAdmin = getSupabaseServerClient();
      const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(authUser.id);
      
      if (deleteAuthError) {
        console.error('[DeleteAccount] Error deleting Supabase Auth user:', deleteAuthError);
      } else {
        authIdentityDeleted = true;
        console.log(`[DeleteAccount] Deleted Supabase Auth user`);
      }
    } catch (supabaseError) {
      // Log but don't fail - user might already be deleted
      console.error('[DeleteAccount] Error deleting Supabase Auth user:', supabaseError);
    }

    if (authIdentityDeleted) {
      try {
        await deleteOnboardingSuggestionIdentityGuard(authUser.id);
      } catch (guardCleanupError) {
        // The UUID-only row is intentionally safer to retain than to remove
        // before Auth deletion is proven. Existing cross-system cleanup work
        // will reconcile this rare post-Auth database failure.
        console.error('[DeleteAccount] Error deleting suggestion identity guard:', guardCleanupError);
      }
    }

    console.log(`[DeleteAccount] Account deletion completed for user ${userId}`);

    return NextResponse.json({
      success: true,
      message: 'Account deleted successfully',
      deletedData,
    });

  } catch (error) {
    console.error('[DeleteAccount] Error deleting account:', error);
    
    return NextResponse.json(
      { error: 'Failed to delete account. Please try again or contact support.' },
      { status: 500 }
    );
  }
}
