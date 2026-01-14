import { NextRequest, NextResponse } from 'next/server';
import { stripe, getPriceId, isValidPlan, isValidInterval, PLAN_DETAILS } from '@/lib/stripe';
import { sql } from '@/lib/db';
import { stackServerApp } from '@/stack/server';
import { resetCreditsForNewPeriod, normalizePlan } from '@/lib/credits';

// =============================================================================
// POST /api/stripe/change-subscription
// 
// Created: December 2025
// Author: Development Team
// 
// PURPOSE:
// Allows users to change their subscription plan and/or billing interval.
// This handles upgrades, downgrades, and billing interval changes.
//
// USE CASES:
// 1. Upgrade: Pro → Business (immediate, prorated charge)
// 2. Downgrade: Business → Pro (takes effect at next billing cycle)
// 3. Interval Change: Monthly → Annual or Annual → Monthly
// 4. Trial User: Can upgrade plan OR end trial early and start billing
//
// STRIPE BEHAVIOR:
// - Upgrades: Immediate with proration (user charged difference today)
// - Downgrades: Takes effect at end of current billing period
// - Trial + Upgrade: Option to keep trial or end trial and start billing
//
// SECURITY:
// - Requires authenticated Stack Auth session
// - Verifies authenticated user matches the requested userId
// - Validates all inputs server-side (plan, interval)
// - Verifies user has an existing Stripe subscription
// - Prevents no-op changes (same plan + interval)
// - All changes go through Stripe API (source of truth)
// - Webhook will sync any changes back to our database
//
// IMPORTANT:
// - This route MODIFIES an existing subscription
// - For NEW subscriptions, use /api/stripe/create-subscription
// - Database is updated via webhook (customer.subscription.updated event)
// =============================================================================

interface ChangeSubscriptionBody {
  userId: number;
  newPlan: string;           // 'pro' or 'business'
  newBillingInterval: string; // 'monthly' or 'annual'
  endTrialNow?: boolean;      // If true and user is trialing, end trial immediately
}

export async function POST(request: NextRequest) {
  console.log(`[Stripe Change] ========== CHANGE SUBSCRIPTION REQUEST ==========`);
  console.log(`[Stripe Change] Timestamp: ${new Date().toISOString()}`);
  
  try {
    // =========================================================================
    // STEP 1: AUTHENTICATION
    // Verify the user is authenticated via Stack Auth
    // =========================================================================
    const authUser = await stackServerApp.getUser();
    
    if (!authUser) {
      console.error('[Stripe Change] Unauthorized: No authenticated user');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // =========================================================================
    // STEP 2: PARSE AND VALIDATE REQUEST BODY
    // =========================================================================
    const body: ChangeSubscriptionBody = await request.json();
    const { userId, newPlan, newBillingInterval, endTrialNow = false } = body;

    // Validate userId
    if (!userId || typeof userId !== 'number') {
      return NextResponse.json(
        { error: 'Valid user ID is required' },
        { status: 400 }
      );
    }

    // Validate plan
    if (!newPlan || !isValidPlan(newPlan)) {
      return NextResponse.json(
        { error: 'Valid plan is required (pro or business)' },
        { status: 400 }
      );
    }

    // Validate billing interval
    if (!newBillingInterval || !isValidInterval(newBillingInterval)) {
      return NextResponse.json(
        { error: 'Valid billing interval is required (monthly or annual)' },
        { status: 400 }
      );
    }

    // =========================================================================
    // STEP 3: GET USER AND CURRENT SUBSCRIPTION FROM DATABASE
    // =========================================================================
    const userAndSub = await sql`
      SELECT 
        u.id,
        u.email, 
        u.name,
        s.stripe_customer_id, 
        s.stripe_subscription_id, 
        s.plan as current_plan,
        s.billing_interval as current_interval,
        s.status
      FROM users u
      LEFT JOIN subscriptions s ON u.id = s.user_id
      WHERE u.id = ${userId}
    `;

    if (userAndSub.length === 0) {
      console.error(`[Stripe Change] User not found: ${userId}`);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userAndSub[0];

    // =========================================================================
    // STEP 4: AUTHORIZATION CHECK
    // Verify the authenticated user matches the requested user
    // This prevents users from changing other users' subscriptions
    // =========================================================================
    if (authUser.primaryEmail !== userData.email) {
      console.error(`[Stripe Change] Authorization failed: ${authUser.primaryEmail} tried to change subscription for user ${userId} (${userData.email})`);
      return NextResponse.json(
        { error: 'Not authorized to access this resource' },
        { status: 403 }
      );
    }

    // =========================================================================
    // STEP 5: VERIFY USER HAS AN ACTIVE SUBSCRIPTION
    // =========================================================================
    const { stripe_subscription_id, stripe_customer_id, current_plan, current_interval, status } = userData;

    if (!stripe_subscription_id) {
      console.error(`[Stripe Change] No subscription found for user ${userId}`);
      return NextResponse.json(
        { error: 'No active subscription found. Please subscribe first.' },
        { status: 400 }
      );
    }

    if (!stripe_customer_id) {
      console.error(`[Stripe Change] No Stripe customer for user ${userId}`);
      return NextResponse.json(
        { error: 'No Stripe customer found' },
        { status: 400 }
      );
    }

    // Check if subscription is in a valid state for changes
    if (status === 'canceled') {
      return NextResponse.json(
        { error: 'Cannot change a canceled subscription. Please resubscribe.' },
        { status: 400 }
      );
    }

    if (status === 'past_due') {
      return NextResponse.json(
        { error: 'Please update your payment method before changing plans.' },
        { status: 400 }
      );
    }

    // =========================================================================
    // STEP 6: CHECK IF THIS IS A NO-OP (same plan + interval)
    // Prevent unnecessary Stripe API calls
    // 
    // IMPORTANT (December 2025): If user is on trial and wants to end trial
    // (endTrialNow = true), we MUST proceed even if plan/interval are the same.
    // This allows trial users to "Buy Now" their current plan.
    // =========================================================================
    const isSamePlanAndInterval = current_plan === newPlan && current_interval === newBillingInterval;
    const isTrialUser = status === 'trialing';
    
    // Only skip if it's truly a no-op:
    // - Same plan AND interval
    // - AND (not trialing OR not requesting to end trial)
    if (isSamePlanAndInterval && !(isTrialUser && endTrialNow)) {
      console.log(`[Stripe Change] No change needed for user ${userId} - already on ${newPlan} ${newBillingInterval}`);
      return NextResponse.json({
        success: true,
        message: 'You are already on this plan',
        noChange: true,
      });
    }
    
    // Log if trial user is ending trial on same plan
    if (isSamePlanAndInterval && isTrialUser && endTrialNow) {
      console.log(`[Stripe Change] User ${userId} is ending trial early on ${newPlan} ${newBillingInterval}`);
    }

    // =========================================================================
    // STEP 7: GET THE NEW PRICE ID FROM STRIPE
    // =========================================================================
    const newPriceId = getPriceId(newPlan, newBillingInterval);
    
    if (!newPriceId) {
      console.error(`[Stripe Change] Price ID not found for plan: ${newPlan}, interval: ${newBillingInterval}`);
      return NextResponse.json(
        { error: 'Invalid plan configuration' },
        { status: 500 }
      );
    }

    // =========================================================================
    // STEP 8: RETRIEVE CURRENT SUBSCRIPTION FROM STRIPE
    // We need to know the current subscription item ID to update it
    // =========================================================================
    console.log(`[Stripe Change] Retrieving subscription ${stripe_subscription_id} from Stripe`);
    
    let stripeSubscription;
    try {
      stripeSubscription = await stripe.subscriptions.retrieve(stripe_subscription_id);
    } catch (error) {
      console.error(`[Stripe Change] Failed to retrieve subscription from Stripe:`, error);
      return NextResponse.json(
        { error: 'Failed to retrieve subscription from Stripe' },
        { status: 500 }
      );
    }

    // Get the subscription item ID (we need this to update the price)
    // A subscription can have multiple items, but we only have one (the plan)
    const subscriptionItemId = stripeSubscription.items.data[0]?.id;
    
    if (!subscriptionItemId) {
      console.error(`[Stripe Change] No subscription item found for subscription ${stripe_subscription_id}`);
      return NextResponse.json(
        { error: 'Invalid subscription structure' },
        { status: 500 }
      );
    }

    // =========================================================================
    // STEP 9: DETERMINE UPGRADE VS DOWNGRADE
    // This affects proration behavior
    // =========================================================================
    const planHierarchy = { 'pro': 1, 'business': 2 };
    const currentPlanLevel = planHierarchy[current_plan as keyof typeof planHierarchy] || 0;
    const newPlanLevel = planHierarchy[newPlan as keyof typeof planHierarchy] || 0;
    
    const isUpgrade = newPlanLevel > currentPlanLevel;
    const isDowngrade = newPlanLevel < currentPlanLevel;
    const isSamePlanIntervalChange = current_plan === newPlan && current_interval !== newBillingInterval;
    
    // Determine if user is currently on trial
    const isTrialing = status === 'trialing';

    console.log(`[Stripe Change] User ${userId}: ${current_plan}/${current_interval} → ${newPlan}/${newBillingInterval}`);
    console.log(`[Stripe Change] isUpgrade: ${isUpgrade}, isDowngrade: ${isDowngrade}, isSamePlanIntervalChange: ${isSamePlanIntervalChange}, isTrialing: ${isTrialing}`);

    // =========================================================================
    // STEP 10: UPDATE SUBSCRIPTION IN STRIPE
    // 
    // Proration Behavior:
    // - 'create_prorations': Immediate charge/credit for price difference (upgrades)
    // - 'none': No proration, change takes effect at next billing (downgrades)
    // - 'always_invoice': Create and immediately pay invoice for prorations
    //
    // For upgrades: We want immediate effect with proration
    // For downgrades: Change takes effect at period end
    // For interval changes on same plan: Treat like upgrade (immediate)
    // =========================================================================
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateParams: any = {
      items: [{
        id: subscriptionItemId,
        price: newPriceId,
      }],
      metadata: {
        // Update metadata to reflect new plan
        plan: newPlan,
        billing_interval: newBillingInterval,
        changed_at: new Date().toISOString(),
        previous_plan: current_plan,
        previous_interval: current_interval,
      },
    };

    // Set proration behavior based on change type
    if (isUpgrade || isSamePlanIntervalChange) {
      // Upgrades and interval changes: Immediate with proration
      updateParams.proration_behavior = 'create_prorations';
      
      // If switching to annual, this is good for the user (usually cheaper per month)
      // If switching to monthly, they might owe money for the unused annual period
      console.log(`[Stripe Change] Applying immediate change with proration`);
    } else if (isDowngrade) {
      // Downgrades: No proration, change at period end
      updateParams.proration_behavior = 'none';
      
      // The new price will take effect at the next billing cycle
      console.log(`[Stripe Change] Scheduling downgrade for next billing cycle`);
    }

    // Handle trial ending option
    if (isTrialing && endTrialNow) {
      // User wants to end trial and start paying immediately
      updateParams.trial_end = 'now';
      console.log(`[Stripe Change] ⚡ ENDING TRIAL IMMEDIATELY as requested`);
      console.log(`[Stripe Change] -> This will trigger an immediate invoice`);
      console.log(`[Stripe Change] -> Stripe will fire 'invoice.paid' webhook`);
      console.log(`[Stripe Change] -> Webhook should set first_payment_at and unlock clock`);
    }

    // Cancel any pending cancellation if user is changing plans
    // (They clearly want to stay, so remove cancel_at_period_end)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subObj = stripeSubscription as any;
    if (subObj.cancel_at_period_end) {
      updateParams.cancel_at_period_end = false;
      console.log(`[Stripe Change] Removing pending cancellation`);
    }

    // =========================================================================
    // STEP 11: EXECUTE THE UPDATE
    // =========================================================================
    console.log(`[Stripe Change] Updating subscription ${stripe_subscription_id} with new price ${newPriceId}`);
    
    let updatedSubscription;
    try {
      updatedSubscription = await stripe.subscriptions.update(stripe_subscription_id, updateParams);
    } catch (error) {
      console.error(`[Stripe Change] Failed to update subscription in Stripe:`, error);
      
      // Handle specific Stripe errors
      if (error instanceof Error && 'type' in error) {
        const stripeError = error as { type: string; message: string; code?: string };
        
        if (stripeError.code === 'card_declined') {
          return NextResponse.json(
            { error: 'Your card was declined. Please update your payment method.' },
            { status: 400 }
          );
        }
        
        return NextResponse.json(
          { error: stripeError.message },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to update subscription' },
        { status: 500 }
      );
    }

    console.log(`[Stripe Change] Successfully updated subscription to ${newPlan}/${newBillingInterval}`);

    // =========================================================================
    // STEP 12: UPDATE OUR DATABASE
    // Note: The webhook will also update our database, but we do it here
    // for immediate consistency. The webhook acts as a backup/sync.
    // =========================================================================
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatedSubObj = updatedSubscription as any;
    
    const newStatus = updatedSubscription.status === 'trialing' ? 'trialing' : 
                      updatedSubscription.status === 'active' ? 'active' : 
                      updatedSubscription.status;

    const periodEndTimestamp = typeof updatedSubObj.current_period_end === 'number' 
      ? updatedSubObj.current_period_end 
      : null;
    const periodEndIso = periodEndTimestamp 
      ? new Date(periodEndTimestamp * 1000).toISOString() 
      : null;

    const trialEndTimestamp = typeof updatedSubObj.trial_end === 'number'
      ? updatedSubObj.trial_end
      : null;
    const trialEndIso = trialEndTimestamp
      ? new Date(trialEndTimestamp * 1000).toISOString()
      : null;

    await sql`
      UPDATE subscriptions
      SET
        plan = ${newPlan},
        billing_interval = ${newBillingInterval},
        status = ${newStatus},
        current_period_end = ${periodEndIso},
        trial_ends_at = ${trialEndIso},
        cancel_at_period_end = ${!!updatedSubObj.cancel_at_period_end},
        updated_at = NOW()
      WHERE user_id = ${userId}
    `;

    // Also update the users table for quick access
    await sql`
      UPDATE users
      SET
        plan = ${newPlan},
        updated_at = NOW()
      WHERE id = ${userId}
    `;

    console.log(`[Stripe Change] Database updated for user ${userId}`);
    
    // DEBUG: Log the current state after update (but before credits reset)
    const checkSub = await sql`
      SELECT status, plan, first_payment_at, next_auto_scan_at FROM subscriptions WHERE user_id = ${userId}
    `;
    console.log(`[Stripe Change] ========== POST-UPDATE STATE ==========`);
    console.log(`[Stripe Change] Current DB state:`, checkSub.length > 0 ? {
      status: checkSub[0].status,
      plan: checkSub[0].plan,
      first_payment_at: checkSub[0].first_payment_at,
      next_auto_scan_at: checkSub[0].next_auto_scan_at,
    } : 'NOT FOUND');
    console.log(`[Stripe Change] NOTE: first_payment_at is set by invoice.paid webhook, NOT this endpoint`);
    console.log(`[Stripe Change] NOTE: If trial was ended (endTrialNow=true), Stripe will fire invoice.paid shortly`);
    console.log(`[Stripe Change] =======================================`);

    // =========================================================================
    // STEP 12.5: RESET CREDITS IMMEDIATELY FOR UPGRADES AND TRIAL ENDINGS
    // 
    // CRITICAL FIX (Dec 2025): Reset credits immediately when:
    // 1. Trial user ends trial early (endTrialNow=true) - gets paid plan credits
    // 2. Active user UPGRADES (Pro → Business) - gets new plan credits immediately
    // 
    // Why immediate reset is needed:
    // - The invoice.paid webhook may be delayed or only fire at next billing cycle
    // - User sees new plan in UI but would have old credits without this fix
    // - Downgrades should NOT reset immediately (change takes effect at period end)
    // 
    // The webhook still acts as a backup/sync mechanism.
    // =========================================================================
    const shouldResetCredits = 
      (isTrialing && endTrialNow && newStatus === 'active') || // Trial → Paid
      (isUpgrade && newStatus === 'active') || // Pro → Business upgrade
      (isSamePlanIntervalChange && newStatus === 'active'); // Monthly → Annual (or vice versa)
    
    if (shouldResetCredits) {
      const reason = isTrialing && endTrialNow 
        ? 'Trial ended' 
        : isUpgrade 
          ? 'Plan upgraded' 
          : 'Billing interval changed';
      console.log(`[Stripe Change] ${reason} - resetting credits immediately for user ${userId}`);
      
      try {
        const periodStart = new Date();
        const periodEndTimestampNum = typeof updatedSubObj.current_period_end === 'number' 
          ? updatedSubObj.current_period_end 
          : null;
        const periodEnd = periodEndTimestampNum 
          ? new Date(periodEndTimestampNum * 1000)
          : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // Default 1 year for annual
        
        const normalizedPlan = normalizePlan(newPlan);
        
        await resetCreditsForNewPeriod(userId, normalizedPlan, periodStart, periodEnd);
        console.log(`[Stripe Change] ✅ Credits reset for user ${userId} to ${normalizedPlan} plan`);
      } catch (creditError) {
        // Log error but don't fail the request - webhook will retry
        console.error(`[Stripe Change] Failed to reset credits for user ${userId}:`, creditError);
      }
    }

    // =========================================================================
    // STEP 12.6: SET FIRST_PAYMENT_AT FOR AUTO-SCAN ACCESS (January 14th, 2026)
    // 
    // CRITICAL FIX: Set first_payment_at directly when trial ends or user becomes active.
    // This unlocks the auto-scan countdown clock immediately.
    // 
    // SECURITY:
    // - This code ONLY runs AFTER stripe.subscriptions.update() succeeds
    // - If Stripe's API call fails (e.g., card declined), we never reach here
    // - Stripe validates the payment method and charges the user
    // - We verify: user is authenticated, owns this subscription, and Stripe confirmed active
    // 
    // CONDITIONS:
    // - Status is now 'active' (confirmed by Stripe)
    // - User was on trial and ended it (endTrialNow=true), OR
    // - User upgraded and is active
    // - first_payment_at is not already set (prevent duplicate updates)
    // 
    // This is MORE reliable than waiting for webhook because:
    // - No race conditions with frontend refetch
    // - Immediate UI update
    // - Webhook still acts as backup
    // =========================================================================
    const shouldSetFirstPayment = 
      newStatus === 'active' && // Stripe confirmed active status
      (isTrialing && endTrialNow); // Trial was just ended (user clicked "Buy Now")
    
    if (shouldSetFirstPayment) {
      try {
        // Check if first_payment_at is not already set
        const currentSub = await sql`
          SELECT first_payment_at FROM subscriptions WHERE user_id = ${userId}
        `;
        
        if (currentSub.length > 0 && !currentSub[0].first_payment_at) {
          const now = new Date();
          const nextScanAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
          
          await sql`
            UPDATE subscriptions
            SET
              first_payment_at = ${now.toISOString()},
              next_auto_scan_at = ${nextScanAt.toISOString()},
              updated_at = NOW()
            WHERE user_id = ${userId}
          `;
          
          console.log(`[Stripe Change] ✅ AUTO-SCAN UNLOCKED for user ${userId}`);
          console.log(`[Stripe Change]    first_payment_at: ${now.toISOString()}`);
          console.log(`[Stripe Change]    next_auto_scan_at: ${nextScanAt.toISOString()}`);
        } else if (currentSub.length > 0 && currentSub[0].first_payment_at) {
          console.log(`[Stripe Change] first_payment_at already set, skipping`);
        }
      } catch (autoScanError) {
        // Log error but don't fail the request - webhook will retry
        console.error(`[Stripe Change] Failed to set auto-scan schedule for user ${userId}:`, autoScanError);
      }
    }

    // =========================================================================
    // STEP 13: CALCULATE PRORATION AMOUNT FOR RESPONSE
    // This is informational for the frontend
    // =========================================================================
    let prorationMessage = '';
    
    if (isUpgrade) {
      const newPlanDetails = PLAN_DETAILS[newPlan];
      const newPrice = newBillingInterval === 'monthly' 
        ? newPlanDetails.monthly.amount / 100 
        : newPlanDetails.annual.amount / 100;
      prorationMessage = `Your plan has been upgraded. You may see a prorated charge for €${newPrice.toFixed(2)}.`;
    } else if (isDowngrade) {
      prorationMessage = `Your plan will be downgraded at the end of your current billing period.`;
    } else if (isSamePlanIntervalChange) {
      prorationMessage = `Your billing interval has been updated. Any difference will be prorated.`;
    }

    // =========================================================================
    // STEP 14: RETURN SUCCESS RESPONSE
    // =========================================================================
    console.log(`[Stripe Change] ✅ SUCCESS - Subscription changed for user ${userId}`);
    console.log(`[Stripe Change] ========== END CHANGE SUBSCRIPTION ==========`);
    
    return NextResponse.json({
      success: true,
      subscription: {
        id: updatedSubscription.id,
        status: updatedSubscription.status,
        plan: newPlan,
        billingInterval: newBillingInterval,
        currentPeriodEnd: periodEndIso,
        trialEnd: trialEndIso,
        cancelAtPeriodEnd: !!updatedSubObj.cancel_at_period_end,
      },
      change: {
        type: isUpgrade ? 'upgrade' : isDowngrade ? 'downgrade' : 'interval_change',
        from: { plan: current_plan, interval: current_interval },
        to: { plan: newPlan, interval: newBillingInterval },
        effectiveImmediately: isUpgrade || isSamePlanIntervalChange,
        trialEnded: isTrialing && endTrialNow,
      },
      message: prorationMessage,
    });

  } catch (error) {
    // =========================================================================
    // ERROR HANDLING
    // Log error and return generic message to avoid leaking details
    // =========================================================================
    console.error('[Stripe Change] Unexpected error:', error);
    
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
