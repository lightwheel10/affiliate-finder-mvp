import { NextRequest, NextResponse } from 'next/server';
import { sql, DbUser } from '@/lib/db';
import { sendEventToN8N } from '@/lib/n8n-webhook';
import { waitUntil } from '@vercel/functions';

// GET /api/users?email=xxx - Get user by email
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const id = searchParams.get('id');

    if (id) {
      const users = await sql`SELECT * FROM crewcast.users WHERE id = ${parseInt(id)}`;
      if (users.length === 0) {
        return NextResponse.json({ user: null });
      }
      return NextResponse.json({ user: users[0] as DbUser });
    }

    if (email) {
      const users = await sql`SELECT * FROM crewcast.users WHERE email = ${email}`;
      if (users.length === 0) {
        return NextResponse.json({ user: null });
      }
      return NextResponse.json({ user: users[0] as DbUser });
    }

    return NextResponse.json({ error: 'Email or ID is required' }, { status: 400 });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}

// POST /api/users - Create or update user (upsert)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, isOnboarded, onboardingStep, hasSubscription, plan } = body;

    if (!email || !name) {
      return NextResponse.json({ error: 'Email and name are required' }, { status: 400 });
    }

    // Use INSERT ... ON CONFLICT to handle race conditions
    // If user exists, just return the existing user without updating
    const result = await sql`
      INSERT INTO crewcast.users (email, name, is_onboarded, onboarding_step, has_subscription, plan)
      VALUES (${email}, ${name}, ${isOnboarded ?? false}, ${onboardingStep ?? 1}, ${hasSubscription ?? false}, ${plan ?? 'free_trial'})
      ON CONFLICT (email) DO NOTHING
      RETURNING *
    `;

    // If INSERT returned nothing, user already exists - fetch them
    if (result.length === 0) {
      const existingUsers = await sql`SELECT * FROM crewcast.users WHERE email = ${email}`;
      return NextResponse.json({ user: existingUsers[0] as DbUser, created: false });
    }

    const newUser = result[0] as DbUser;

    // Send signup event to N8N webhook (background task)
    // Uses same N8N_TRANSACTIONAL_EMAILS_URL as all other transactional emails
    // waitUntil keeps the function alive until the webhook completes
    console.log(`[Users API] 📧 New user created, sending signup email to N8N for: ${newUser.email}`);
    waitUntil(sendEventToN8N({
      event_type: 'signup',
      email: newUser.email,
      name: newUser.name,
      plan: (newUser.plan as 'free_trial' | 'pro' | 'business' | 'enterprise') || 'free_trial',
      onboardingCompleted: newUser.is_onboarded || false,
      signupDate: newUser.created_at,
    }));

    return NextResponse.json({ user: newUser, created: true });
  } catch (error) {
    console.error('Error creating/updating user:', error);
    return NextResponse.json({ error: 'Failed to create/update user' }, { status: 500 });
  }
}

// PATCH /api/users - Update user profile
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Build dynamic update query
    const setClauses: string[] = [];
    const updateValues: Record<string, unknown> = {};

    const fieldMapping: Record<string, string> = {
      name: 'name',
      isOnboarded: 'is_onboarded',
      onboardingStep: 'onboarding_step',
      hasSubscription: 'has_subscription',
      role: 'role',
      brand: 'brand',
      bio: 'bio',
      plan: 'plan',
      trialPlan: 'trial_plan',
      trialStartDate: 'trial_start_date',
      trialEndDate: 'trial_end_date',
      targetCountry: 'target_country',
      targetLanguage: 'target_language',
      competitors: 'competitors',
      topics: 'topics',
      affiliateTypes: 'affiliate_types',
      billingLast4: 'billing_last4',
      billingBrand: 'billing_brand',
      billingExpiry: 'billing_expiry',
      emailMatches: 'email_matches',
      emailReports: 'email_reports',
      emailUpdates: 'email_updates',
      appReplies: 'app_replies',
      appReminders: 'app_reminders',
      profileImageUrl: 'profile_image_url', // January 13th, 2026: Added for Vercel Blob storage
    };

    for (const [jsKey, dbKey] of Object.entries(fieldMapping)) {
      if (updates[jsKey] !== undefined) {
        updateValues[dbKey] = updates[jsKey];
      }
    }

    if (Object.keys(updateValues).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    // For simplicity, we'll update all provided fields
    // Note: This is a simplified version - in production you'd want proper parameterized queries
    const updatedUsers = await sql`
      UPDATE crewcast.users 
      SET 
        name = COALESCE(${updates.name ?? null}, name),
        is_onboarded = COALESCE(${updates.isOnboarded ?? null}, is_onboarded),
        onboarding_step = COALESCE(${updates.onboardingStep ?? null}, onboarding_step),
        has_subscription = COALESCE(${updates.hasSubscription ?? null}, has_subscription),
        role = COALESCE(${updates.role ?? null}, role),
        brand = COALESCE(${updates.brand ?? null}, brand),
        bio = COALESCE(${updates.bio ?? null}, bio),
        plan = COALESCE(${updates.plan ?? null}, plan),
        trial_plan = COALESCE(${updates.trialPlan ?? null}, trial_plan),
        trial_start_date = COALESCE(${updates.trialStartDate ?? null}, trial_start_date),
        trial_end_date = COALESCE(${updates.trialEndDate ?? null}, trial_end_date),
        target_country = COALESCE(${updates.targetCountry ?? null}, target_country),
        target_language = COALESCE(${updates.targetLanguage ?? null}, target_language),
        competitors = COALESCE(${updates.competitors ?? null}, competitors),
        topics = COALESCE(${updates.topics ?? null}, topics),
        affiliate_types = COALESCE(${updates.affiliateTypes ?? null}, affiliate_types),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    if (updatedUsers.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user: updatedUsers[0] as DbUser });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

