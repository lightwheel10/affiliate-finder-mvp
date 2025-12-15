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
  };
  email: {
    total: number;
    used: number;
    remaining: number;
    unlimited: boolean;
  };
  ai: {
    total: number;
    used: number;
    remaining: number;
    unlimited: boolean;
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
      SELECT * FROM user_credits WHERE user_id = ${userId}
    `;

    if (result.length === 0) {
      return null;
    }

    const row = result[0] as DbUserCredits;
    const now = new Date();
    const periodEnd = new Date(row.period_end);
    const daysRemaining = Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    // Check if unlimited (-1 means unlimited)
    const isTopicSearchUnlimited = row.topic_search_credits_total === -1;
    const isEmailUnlimited = row.email_credits_total === -1;
    const isAiUnlimited = row.ai_credits_total === -1;

    return {
      topicSearches: {
        total: isTopicSearchUnlimited ? -1 : row.topic_search_credits_total,
        used: row.topic_search_credits_used,
        remaining: isTopicSearchUnlimited ? -1 : Math.max(0, row.topic_search_credits_total - row.topic_search_credits_used),
        unlimited: isTopicSearchUnlimited,
      },
      email: {
        total: isEmailUnlimited ? -1 : row.email_credits_total,
        used: row.email_credits_used,
        remaining: isEmailUnlimited ? -1 : Math.max(0, row.email_credits_total - row.email_credits_used),
        unlimited: isEmailUnlimited,
      },
      ai: {
        total: isAiUnlimited ? -1 : row.ai_credits_total,
        used: row.ai_credits_used,
        remaining: isAiUnlimited ? -1 : Math.max(0, row.ai_credits_total - row.ai_credits_used),
        unlimited: isAiUnlimited,
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
        email_credits_total,
        email_credits_used,
        ai_credits_total,
        ai_credits_used,
        period_end
      FROM user_credits 
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

    // Get the relevant credit values based on type
    let total: number;
    let used: number;
    
    switch (creditType) {
      case 'topic_search':
        total = row.topic_search_credits_total;
        used = row.topic_search_credits_used;
        break;
      case 'email':
        total = row.email_credits_total;
        used = row.email_credits_used;
        break;
      case 'ai':
        total = row.ai_credits_total;
        used = row.ai_credits_used;
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

    const remaining = Math.max(0, total - used);
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
    let updateResult;
    
    // Use separate queries for each credit type (Neon doesn't support dynamic column names)
    switch (creditType) {
      case 'topic_search':
        updateResult = await sql`
          UPDATE user_credits
          SET 
            topic_search_credits_used = topic_search_credits_used + ${amount},
            updated_at = NOW()
          WHERE user_id = ${userId}
            AND (topic_search_credits_total = -1 OR topic_search_credits_total - topic_search_credits_used >= ${amount})
          RETURNING topic_search_credits_total as total, topic_search_credits_used as used
        `;
        break;
      case 'email':
        updateResult = await sql`
          UPDATE user_credits
          SET 
            email_credits_used = email_credits_used + ${amount},
            updated_at = NOW()
          WHERE user_id = ${userId}
            AND (email_credits_total = -1 OR email_credits_total - email_credits_used >= ${amount})
          RETURNING email_credits_total as total, email_credits_used as used
        `;
        break;
      case 'ai':
        updateResult = await sql`
          UPDATE user_credits
          SET 
            ai_credits_used = ai_credits_used + ${amount},
            updated_at = NOW()
          WHERE user_id = ${userId}
            AND (ai_credits_total = -1 OR ai_credits_total - ai_credits_used >= ${amount})
          RETURNING ai_credits_total as total, ai_credits_used as used
        `;
        break;
      default:
        return { success: false, newBalance: 0 };
    }

    if (updateResult.length === 0) {
      console.error('[Credits] Failed to consume credits - insufficient or no record');
      return { success: false, newBalance: 0 };
    }

    const { total, used } = updateResult[0];
    const newBalance = total === -1 ? -1 : Math.max(0, total - used);

    // Log the transaction
    await sql`
      INSERT INTO credit_transactions (
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
      SELECT id FROM user_credits WHERE user_id = ${userId}
    `;

    if (existing.length > 0) {
      console.log(`[Credits] User ${userId} already has credits, skipping initialization`);
      return true;
    }

    // Create credit record with trial credits (same for all users)
    await sql`
      INSERT INTO user_credits (
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
      INSERT INTO credit_transactions (user_id, credit_type, amount, balance_after, reason, reference_type)
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
    const planCredits = PLAN_CREDITS[plan];

    // Update or insert credit record
    const existing = await sql`
      SELECT id FROM user_credits WHERE user_id = ${userId}
    `;

    if (existing.length > 0) {
      // Update existing record
      await sql`
        UPDATE user_credits
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
        INSERT INTO user_credits (
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
      INSERT INTO credit_transactions (user_id, credit_type, amount, balance_after, reason, reference_type)
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
