/**
 * Credit System Service
 * 
 * Manages user credits for topic searches, email lookups, and AI outreach.
 * 
 * Created: December 2025
 */

import { sql } from './db';

// =============================================================================
// CREDIT CONFIGURATION
// =============================================================================

export const PLAN_CREDITS = {
  // Trial allocations (3 days, same for ALL users regardless of plan)
  trial: {
    topicSearches: 1,
    email: 30,
    ai: 30,
  },
  
  // Pro plan (€99/month)
  pro: {
    topicSearches: 5,
    email: 150,
    ai: 200,
  },
  
  // Business plan (€249/month) - 2x Pro
  business: {
    topicSearches: 10,
    email: 300,
    ai: 400,
  },
  
  // Enterprise (custom pricing) - unlimited
  enterprise: {
    topicSearches: -1,  // -1 = unlimited
    email: -1,
    ai: -1,
  },
} as const;

// What counts as 1 topic search
export const SEARCH_LIMITS = {
  maxKeywords: 5,
  maxCompetitors: 3,
  maxBrands: 1,
} as const;

// Credit types
export type CreditType = 'topic_search' | 'email' | 'ai';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface UserCredits {
  topicSearches: {
    total: number;
    used: number;
    remaining: number;
    unlimited: boolean;
    topup: number;
  };
  email: {
    total: number;
    used: number;
    remaining: number;
    unlimited: boolean;
    topup: number;
  };
  ai: {
    total: number;
    used: number;
    remaining: number;
    unlimited: boolean;
    topup: number;
  };
  period: {
    start: string;
    end: string;
    daysRemaining: number;
  };
  isTrialPeriod: boolean;
}

export interface CreditCheckResult {
  allowed: boolean;
  remaining: number;
  isUnlimited: boolean;
  isReadOnly: boolean;
  message?: string;
}

export interface DbUserCredits {
  id: number;
  user_id: number;
  topic_search_credits_total: number;
  email_credits_total: number;
  ai_credits_total: number;
  topic_search_credits_used: number;
  email_credits_used: number;
  ai_credits_used: number;
  topic_search_credits_topup?: number;
  email_credits_topup?: number;
  ai_credits_topup?: number;
  period_start: string;
  period_end: string;
  is_trial_period: boolean;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// GET USER CREDITS
// =============================================================================

/**
 * Get a user's current credit balances
 * 
 * @param userId - The user's database ID
 * @returns UserCredits object or null if no credits found
 */
export async function getUserCredits(userId: number): Promise<UserCredits | null> {
  try {
    const result = await sql`
      SELECT * FROM crewcast.user_credits WHERE user_id = ${userId}
    `;

    if (result.length === 0) {
      return null;
    }

    const row = result[0] as DbUserCredits;
    const now = new Date();
    const periodEnd = new Date(row.period_end);
    const daysRemaining = Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    const tsTopup = row.topic_search_credits_topup ?? 0;
    const emailTopup = row.email_credits_topup ?? 0;
    const aiTopup = row.ai_credits_topup ?? 0;

    const isTopicSearchUnlimited = row.topic_search_credits_total === -1;
    const isEmailUnlimited = row.email_credits_total === -1;
    const isAiUnlimited = row.ai_credits_total === -1;

    const tsSubRem = isTopicSearchUnlimited ? -1 : Math.max(0, row.topic_search_credits_total - row.topic_search_credits_used);
    const emailSubRem = isEmailUnlimited ? -1 : Math.max(0, row.email_credits_total - row.email_credits_used);
    const aiSubRem = isAiUnlimited ? -1 : Math.max(0, row.ai_credits_total - row.ai_credits_used);

    return {
      topicSearches: {
        total: isTopicSearchUnlimited ? -1 : row.topic_search_credits_total,
        used: row.topic_search_credits_used,
        remaining: isTopicSearchUnlimited ? -1 : tsSubRem + tsTopup,
        unlimited: isTopicSearchUnlimited,
        topup: tsTopup,
      },
      email: {
        total: isEmailUnlimited ? -1 : row.email_credits_total,
        used: row.email_credits_used,
        remaining: isEmailUnlimited ? -1 : emailSubRem + emailTopup,
        unlimited: isEmailUnlimited,
        topup: emailTopup,
      },
      ai: {
        total: isAiUnlimited ? -1 : row.ai_credits_total,
        used: row.ai_credits_used,
        remaining: isAiUnlimited ? -1 : aiSubRem + aiTopup,
        unlimited: isAiUnlimited,
        topup: aiTopup,
      },
      period: {
        start: row.period_start,
        end: row.period_end,
        daysRemaining,
      },
      isTrialPeriod: row.is_trial_period,
    };
  } catch (error) {
    console.error('[Credits] Error getting user credits:', error);
    return null;
  }
}

// =============================================================================
// CHECK CREDITS
// =============================================================================

/**
 * Check if a user has enough credits for an action
 * 
 * @param userId - The user's database ID
 * @param creditType - Type of credit to check
 * @param amount - Amount of credits needed (default: 1)
 * @returns CreditCheckResult
 */
export async function checkCredits(
  userId: number,
  creditType: CreditType,
  amount: number = 1
): Promise<CreditCheckResult> {
  try {
    const result = await sql`
      SELECT 
        topic_search_credits_total,
        topic_search_credits_used,
        topic_search_credits_topup,
        email_credits_total,
        email_credits_used,
        email_credits_topup,
        ai_credits_total,
        ai_credits_used,
        ai_credits_topup,
        period_end
      FROM crewcast.user_credits 
      WHERE user_id = ${userId}
    `;

    // No credit record found - user might be in read-only mode (canceled)
    if (result.length === 0) {
      return {
        allowed: false,
        remaining: 0,
        isUnlimited: false,
        isReadOnly: true,
        message: 'No active subscription. Please subscribe to continue.',
      };
    }

    const row = result[0];
    
    // Check if period has expired
    const periodEnd = new Date(row.period_end);
    if (new Date() > periodEnd) {
      return {
        allowed: false,
        remaining: 0,
        isUnlimited: false,
        isReadOnly: true,
        message: 'Subscription period has ended. Please renew to continue.',
      };
    }

    // Get the relevant credit values based on type (include topup)
    let total: number;
    let used: number;
    let topup: number;

    switch (creditType) {
      case 'topic_search':
        total = row.topic_search_credits_total;
        used = row.topic_search_credits_used;
        topup = row.topic_search_credits_topup ?? 0;
        break;
      case 'email':
        total = row.email_credits_total;
        used = row.email_credits_used;
        topup = row.email_credits_topup ?? 0;
        break;
      case 'ai':
        total = row.ai_credits_total;
        used = row.ai_credits_used;
        topup = row.ai_credits_topup ?? 0;
        break;
      default:
        return {
          allowed: false,
          remaining: 0,
          isUnlimited: false,
          isReadOnly: false,
          message: 'Invalid credit type',
        };
    }

    // Check if unlimited
    if (total === -1) {
      return {
        allowed: true,
        remaining: -1,
        isUnlimited: true,
        isReadOnly: false,
      };
    }

    const subRemaining = Math.max(0, total - used);
    const remaining = subRemaining + topup;
    const allowed = remaining >= amount;

    return {
      allowed,
      remaining,
      isUnlimited: false,
      isReadOnly: false,
      message: allowed ? undefined : `Insufficient ${creditType.replace('_', ' ')} credits. You have ${remaining} remaining.`,
    };
  } catch (error) {
    console.error('[Credits] Error checking credits:', error);
    return {
      allowed: false,
      remaining: 0,
      isUnlimited: false,
      isReadOnly: false,
      message: 'Error checking credits. Please try again.',
    };
  }
}

// =============================================================================
// CONSUME CREDITS
// =============================================================================

/**
 * Deduct credits after a successful action
 * 
 * @param userId - The user's database ID
 * @param creditType - Type of credit to consume
 * @param amount - Amount to deduct (default: 1)
 * @param referenceId - Optional reference (e.g., affiliate ID)
 * @param referenceType - Optional reference type (e.g., 'search', 'affiliate')
 * @returns Object with success status and new balance
 */
export async function consumeCredits(
  userId: number,
  creditType: CreditType,
  amount: number = 1,
  referenceId?: string,
  referenceType?: string
): Promise<{ success: boolean; newBalance: number }> {
  try {
    if (amount <= 0 || !Number.isInteger(amount)) {
      console.error(`[Credits] SECURITY: Invalid amount ${amount} rejected for user ${userId}`);
      return { success: false, newBalance: 0 };
    }

    const rowResult = await sql`
      SELECT 
        topic_search_credits_total, topic_search_credits_used, topic_search_credits_topup,
        email_credits_total, email_credits_used, email_credits_topup,
        ai_credits_total, ai_credits_used, ai_credits_topup
      FROM crewcast.user_credits
      WHERE user_id = ${userId}
    `;
    if (rowResult.length === 0) {
      return { success: false, newBalance: 0 };
    }

    const r = rowResult[0];
    let total: number; let used: number; let topup: number;
    switch (creditType) {
      case 'topic_search':
        total = r.topic_search_credits_total; used = r.topic_search_credits_used; topup = r.topic_search_credits_topup ?? 0;
        break;
      case 'email':
        total = r.email_credits_total; used = r.email_credits_used; topup = r.email_credits_topup ?? 0;
        break;
      case 'ai':
        total = r.ai_credits_total; used = r.ai_credits_used; topup = r.ai_credits_topup ?? 0;
        break;
      default:
        return { success: false, newBalance: 0 };
    }

    const subRem = total === -1 ? Infinity : Math.max(0, total - used);
    const totalAvailable = (total === -1 ? used + amount : subRem) + topup;
    if (total === -1) {
      // unlimited subscription: just add to used (conceptually we have unlimited so no topup needed)
    } else if (totalAvailable < amount) {
      console.error('[Credits] Failed to consume credits - insufficient or no record');
      return { success: false, newBalance: 0 };
    }

    const fromSub = total === -1 ? amount : Math.min(amount, subRem);
    const fromTopup = amount - fromSub;

    let updateResult;
    switch (creditType) {
      case 'topic_search':
        updateResult = await sql`
          UPDATE crewcast.user_credits
          SET 
            topic_search_credits_used = topic_search_credits_used + ${fromSub},
            topic_search_credits_topup = GREATEST(0, COALESCE(topic_search_credits_topup, 0) - ${fromTopup}),
            updated_at = NOW()
          WHERE user_id = ${userId}
          RETURNING topic_search_credits_total as total, topic_search_credits_used as used, topic_search_credits_topup as topup
        `;
        break;
      case 'email':
        updateResult = await sql`
          UPDATE crewcast.user_credits
          SET 
            email_credits_used = email_credits_used + ${fromSub},
            email_credits_topup = GREATEST(0, COALESCE(email_credits_topup, 0) - ${fromTopup}),
            updated_at = NOW()
          WHERE user_id = ${userId}
          RETURNING email_credits_total as total, email_credits_used as used, email_credits_topup as topup
        `;
        break;
      case 'ai':
        updateResult = await sql`
          UPDATE crewcast.user_credits
          SET 
            ai_credits_used = ai_credits_used + ${fromSub},
            ai_credits_topup = GREATEST(0, COALESCE(ai_credits_topup, 0) - ${fromTopup}),
            updated_at = NOW()
          WHERE user_id = ${userId}
          RETURNING ai_credits_total as total, ai_credits_used as used, ai_credits_topup as topup
        `;
        break;
      default:
        return { success: false, newBalance: 0 };
    }

    if (updateResult.length === 0) {
      return { success: false, newBalance: 0 };
    }

    const u = updateResult[0];
    const newBalance = u.total === -1 ? -1 : Math.max(0, u.total - u.used) + (u.topup ?? 0);

    await sql`
      INSERT INTO crewcast.credit_transactions (
        user_id, credit_type, amount, balance_after, reason, reference_id, reference_type
      ) VALUES (
        ${userId}, ${creditType}, ${-amount}, ${newBalance}, 'usage', ${referenceId || null}, ${referenceType || null}
      )
    `;

    console.log(`[Credits] Consumed ${amount} ${creditType} credit(s) for user ${userId}. New balance: ${newBalance}`);
    return { success: true, newBalance };
  } catch (error) {
    console.error('[Credits] Error consuming credits:', error);
    return { success: false, newBalance: 0 };
  }
}

// =============================================================================
// REFUND CREDITS (January 24th, 2026)
// 
// PURPOSE: Refund credits when an operation fails AFTER credits were consumed.
// 
// USE CASE: AI email generation now consumes credits BEFORE calling n8n.
// If n8n fails or returns empty message, we need to refund the credit.
// 
// This prevents the TOCTOU (Time-of-Check to Time-of-Use) vulnerability where:
// 1. Check: User has 1 credit, 2 requests both pass check
// 2. Use: Both generate emails
// 3. Consume: Only 1 succeeds (atomic UPDATE), but 2 emails were generated!
// 
// By consuming FIRST and refunding on failure, we guarantee 1 credit = 1 email.
// =============================================================================

/**
 * Refund credits that were previously consumed
 * 
 * @param userId - The user's database ID
 * @param creditType - Type of credit to refund
 * @param amount - Number of credits to refund (default: 1)
 * @param referenceId - ID of the related resource (for audit trail)
 * @param referenceType - Type of reference (e.g., 'outreach_refund')
 */
export async function refundCredits(
  userId: number,
  creditType: CreditType,
  amount: number = 1,
  referenceId?: string,
  referenceType?: string
): Promise<{ success: boolean; newBalance: number }> {
  try {
    // SECURITY: Validate amount is positive
    if (amount <= 0 || !Number.isInteger(amount)) {
      console.error(`[Credits] SECURITY: Invalid refund amount ${amount} rejected for user ${userId}`);
      return { success: false, newBalance: 0 };
    }

    let updateResult;
    
    // Refund by DECREMENTING credits_used (opposite of consume)
    switch (creditType) {
      case 'topic_search':
        updateResult = await sql`
          UPDATE crewcast.user_credits
          SET 
            topic_search_credits_used = GREATEST(0, topic_search_credits_used - ${amount}),
            updated_at = NOW()
          WHERE user_id = ${userId}
          RETURNING topic_search_credits_total as total, topic_search_credits_used as used
        `;
        break;
      case 'email':
        updateResult = await sql`
          UPDATE crewcast.user_credits
          SET 
            email_credits_used = GREATEST(0, email_credits_used - ${amount}),
            updated_at = NOW()
          WHERE user_id = ${userId}
          RETURNING email_credits_total as total, email_credits_used as used
        `;
        break;
      case 'ai':
        updateResult = await sql`
          UPDATE crewcast.user_credits
          SET 
            ai_credits_used = GREATEST(0, ai_credits_used - ${amount}),
            updated_at = NOW()
          WHERE user_id = ${userId}
          RETURNING ai_credits_total as total, ai_credits_used as used
        `;
        break;
      default:
        return { success: false, newBalance: 0 };
    }

    if (updateResult.length === 0) {
      console.error('[Credits] Failed to refund credits - no record found');
      return { success: false, newBalance: 0 };
    }

    const { total, used } = updateResult[0];
    const newBalance = total === -1 ? -1 : Math.max(0, total - used);

    // Log the refund transaction (positive amount to show credit returned)
    await sql`
      INSERT INTO crewcast.credit_transactions (
        user_id, credit_type, amount, balance_after, reason, reference_id, reference_type
      ) VALUES (
        ${userId}, ${creditType}, ${amount}, ${newBalance}, 'refund', ${referenceId || null}, ${referenceType || null}
      )
    `;

    console.log(`[Credits] ↩️ Refunded ${amount} ${creditType} credit(s) for user ${userId}. New balance: ${newBalance}`);
    
    return { success: true, newBalance };
  } catch (error) {
    console.error('[Credits] Error refunding credits:', error);
    return { success: false, newBalance: 0 };
  }
}

// =============================================================================
// INITIALIZE CREDITS (For new users starting trial)
// =============================================================================

/**
 * Initialize credits for a new user starting their trial
 * 
 * @param userId - The user's database ID
 * @param periodStart - Trial start date
 * @param periodEnd - Trial end date
 */
export async function initializeTrialCredits(
  userId: number,
  periodStart: Date,
  periodEnd: Date
): Promise<boolean> {
  try {
    // Check if user already has credits
    const existing = await sql`
      SELECT id, period_end, is_trial_period FROM crewcast.user_credits WHERE user_id = ${userId}
    `;

    if (existing.length > 0) {
      const existingCredits = existing[0];
      const existingPeriodEnd = new Date(existingCredits.period_end);
      const now = new Date();
      
      // If existing credits are EXPIRED, the user already used their trial
      // They should NOT get another free trial - they need to subscribe
      if (existingPeriodEnd < now) {
        // User has expired credits = they already used their trial/subscription
        console.log(`[Credits] SECURITY: User ${userId} has expired credits (ended ${existingPeriodEnd.toISOString()}). Blocking new trial - must subscribe.`);
        // Leave their expired credits as-is - they need to subscribe to continue
        return true;
      }
      
      // Credits exist and are not expired - skip (prevent duplicate initialization)
      console.log(`[Credits] User ${userId} already has valid credits (ends ${existingPeriodEnd.toISOString()}), skipping initialization`);
      return true;
    }

    // SECURITY: Check if user already had a trial before by looking at credit transactions
    // NOTE: We can't use trial_start_date from crewcast.users table because it's set DURING signup
    // before this function is called. Instead, check if there's a previous trial_start transaction.
    const previousTrialCheck = await sql`
      SELECT id FROM crewcast.credit_transactions 
      WHERE user_id = ${userId} 
      AND reason IN ('trial_start', 'trial_restart')
      LIMIT 1
    `;
    
    if (previousTrialCheck.length > 0) {
      // User already had a trial before - DO NOT give another trial
      console.log(`[Credits] SECURITY: User ${userId} already used trial (found previous trial transaction). Blocking new trial.`);
      return false;
    }

    // Create credit record with trial credits (same for all users)
    await sql`
      INSERT INTO crewcast.user_credits (
        user_id,
        topic_search_credits_total,
        email_credits_total,
        ai_credits_total,
        topic_search_credits_used,
        email_credits_used,
        ai_credits_used,
        period_start,
        period_end,
        is_trial_period
      ) VALUES (
        ${userId},
        ${PLAN_CREDITS.trial.topicSearches},
        ${PLAN_CREDITS.trial.email},
        ${PLAN_CREDITS.trial.ai},
        0,
        0,
        0,
        ${periodStart.toISOString()},
        ${periodEnd.toISOString()},
        true
      )
    `;

    // Log the transaction
    await sql`
      INSERT INTO crewcast.credit_transactions (user_id, credit_type, amount, balance_after, reason, reference_type)
      VALUES 
        (${userId}, 'topic_search', ${PLAN_CREDITS.trial.topicSearches}, ${PLAN_CREDITS.trial.topicSearches}, 'trial_start', 'subscription'),
        (${userId}, 'email', ${PLAN_CREDITS.trial.email}, ${PLAN_CREDITS.trial.email}, 'trial_start', 'subscription'),
        (${userId}, 'ai', ${PLAN_CREDITS.trial.ai}, ${PLAN_CREDITS.trial.ai}, 'trial_start', 'subscription')
    `;

    console.log(`[Credits] Initialized trial credits for user ${userId}: ${PLAN_CREDITS.trial.topicSearches} searches, ${PLAN_CREDITS.trial.email} email, ${PLAN_CREDITS.trial.ai} AI`);
    
    return true;
  } catch (error) {
    console.error('[Credits] Error initializing trial credits:', error);
    return false;
  }
}

// =============================================================================
// RESET CREDITS (For billing cycle renewal)
// =============================================================================

/**
 * Reset credits for a new billing period
 * 
 * @param userId - The user's database ID
 * @param plan - The user's plan ('pro', 'business', 'enterprise')
 * @param periodStart - New period start date
 * @param periodEnd - New period end date
 */
export async function resetCreditsForNewPeriod(
  userId: number,
  plan: 'pro' | 'business' | 'enterprise',
  periodStart: Date,
  periodEnd: Date
): Promise<boolean> {
  try {
    // SECURITY: Enterprise plan grants unlimited credits (-1)
    // Only allow enterprise if explicitly verified from database
    // This prevents plan injection attacks
    let verifiedPlan = plan;
    if (plan === 'enterprise') {
      const userCheck = await sql`
        SELECT plan FROM crewcast.users WHERE id = ${userId}
      `;
      if (userCheck.length === 0 || userCheck[0].plan !== 'enterprise') {
        console.error(`[Credits] SECURITY: User ${userId} attempted enterprise credits but is not enterprise. Falling back to pro.`);
        verifiedPlan = 'pro';
      }
    }

    const planCredits = PLAN_CREDITS[verifiedPlan];

    // Update or insert credit record
    const existing = await sql`
      SELECT id FROM crewcast.user_credits WHERE user_id = ${userId}
    `;

    if (existing.length > 0) {
      // Update existing record
      await sql`
        UPDATE crewcast.user_credits
        SET
          topic_search_credits_total = ${planCredits.topicSearches},
          email_credits_total = ${planCredits.email},
          ai_credits_total = ${planCredits.ai},
          topic_search_credits_used = 0,
          email_credits_used = 0,
          ai_credits_used = 0,
          period_start = ${periodStart.toISOString()},
          period_end = ${periodEnd.toISOString()},
          is_trial_period = false,
          updated_at = NOW()
        WHERE user_id = ${userId}
      `;
    } else {
      // Insert new record
      await sql`
        INSERT INTO crewcast.user_credits (
          user_id,
          topic_search_credits_total,
          email_credits_total,
          ai_credits_total,
          topic_search_credits_used,
          email_credits_used,
          ai_credits_used,
          period_start,
          period_end,
          is_trial_period
        ) VALUES (
          ${userId},
          ${planCredits.topicSearches},
          ${planCredits.email},
          ${planCredits.ai},
          0,
          0,
          0,
          ${periodStart.toISOString()},
          ${periodEnd.toISOString()},
          false
        )
      `;
    }

    // Log the transactions
    await sql`
      INSERT INTO crewcast.credit_transactions (user_id, credit_type, amount, balance_after, reason, reference_type)
      VALUES 
        (${userId}, 'topic_search', ${planCredits.topicSearches}, ${planCredits.topicSearches}, 'reset', 'invoice'),
        (${userId}, 'email', ${planCredits.email}, ${planCredits.email}, 'reset', 'invoice'),
        (${userId}, 'ai', ${planCredits.ai}, ${planCredits.ai}, 'reset', 'invoice')
    `;

    console.log(`[Credits] Reset credits for user ${userId} to ${plan} plan: ${planCredits.topicSearches} searches, ${planCredits.email} email, ${planCredits.ai} AI`);
    
    return true;
  } catch (error) {
    console.error('[Credits] Error resetting credits:', error);
    return false;
  }
}

// =============================================================================
// ADD TOP-UP CREDITS (One-time purchase from Stripe Checkout)
// Idempotent: checks credit_purchases table before adding.
// =============================================================================

/**
 * Add top-up credits after successful one-time purchase.
 * Called from Stripe webhook checkout.session.completed.
 *
 * @param userId - Database user ID
 * @param creditType - 'email' | 'ai' | 'topic_search'
 * @param amount - Credits to add
 * @param checkoutSessionId - Stripe checkout session ID (for idempotency)
 * @returns true if credits were added or already completed, false on error
 */
export async function addTopupCredits(
  userId: number,
  creditType: CreditType,
  amount: number,
  checkoutSessionId: string
): Promise<boolean> {
  try {
    if (amount <= 0 || !Number.isInteger(amount)) {
      console.error(`[Credits] SECURITY: Invalid topup amount ${amount} rejected`);
      return false;
    }

    const existing = await sql`
      SELECT id, status FROM crewcast.credit_purchases
      WHERE stripe_checkout_session_id = ${checkoutSessionId}
    `;
    if (existing.length === 0) {
      console.error(`[Credits] No credit_purchases row for session ${checkoutSessionId}`);
      return false;
    }
    if (existing[0].status === 'completed') {
      console.log(`[Credits] Idempotency: session ${checkoutSessionId} already completed`);
      return true;
    }

    let updateResult;
    switch (creditType) {
      case 'topic_search':
        updateResult = await sql`
          UPDATE crewcast.user_credits
          SET topic_search_credits_topup = COALESCE(topic_search_credits_topup, 0) + ${amount},
              updated_at = NOW()
          WHERE user_id = ${userId}
          RETURNING topic_search_credits_topup as topup
        `;
        break;
      case 'email':
        updateResult = await sql`
          UPDATE crewcast.user_credits
          SET email_credits_topup = COALESCE(email_credits_topup, 0) + ${amount},
              updated_at = NOW()
          WHERE user_id = ${userId}
          RETURNING email_credits_topup as topup
        `;
        break;
      case 'ai':
        updateResult = await sql`
          UPDATE crewcast.user_credits
          SET ai_credits_topup = COALESCE(ai_credits_topup, 0) + ${amount},
              updated_at = NOW()
          WHERE user_id = ${userId}
          RETURNING ai_credits_topup as topup
        `;
        break;
      default:
        return false;
    }

    if (updateResult.length === 0) {
      console.error(`[Credits] No user_credits row for user ${userId} - cannot add topup`);
      return false;
    }

    const newBalance = updateResult[0].topup ?? amount;

    await sql`
      INSERT INTO crewcast.credit_transactions (user_id, credit_type, amount, balance_after, reason, reference_type)
      VALUES (${userId}, ${creditType}, ${amount}, ${newBalance}, 'topup_purchase', 'credit_purchase')
    `;

    await sql`
      UPDATE crewcast.credit_purchases
      SET status = 'completed', completed_at = NOW()
      WHERE stripe_checkout_session_id = ${checkoutSessionId}
    `;

    console.log(`[Credits] Added ${amount} ${creditType} topup for user ${userId} (session ${checkoutSessionId})`);
    return true;
  } catch (error) {
    console.error('[Credits] Error adding topup credits:', error);
    return false;
  }
}

// =============================================================================
// HELPER: Get plan from subscription
// =============================================================================

/**
 * Map a plan string to valid plan type
 */
export function normalizePlan(plan: string): 'pro' | 'business' | 'enterprise' {
  const normalized = plan.toLowerCase();
  if (normalized === 'business') return 'business';
  if (normalized === 'enterprise') return 'enterprise';
  return 'pro'; // Default to pro
}
