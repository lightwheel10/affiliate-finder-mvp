import { waitUntil } from '@vercel/functions';
import { NextRequest, NextResponse } from 'next/server';
import { WelcomeEmail, welcomeEmailSubject } from '@/emails/welcome';
import { getAppUrl } from '@/lib/app-url';
import {
  legacyAccountIdMatches,
  resolveAuthenticatedAccount,
} from '@/lib/auth/account';
import { sql, type DbUser } from '@/lib/db';
import { detectLocale, sendEmail } from '@/lib/email';
import {
  createAccountInputSchema,
  profilePatchInputSchema,
} from '@/lib/users/profile-input';

function invalidInput(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

// The authenticated Supabase identity is the sole account selector. Query
// parameters are deliberately ignored so callers cannot request another row.
export async function GET() {
  try {
    const context = await resolveAuthenticatedAccount();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!context.account) {
      return NextResponse.json({ user: null });
    }

    const users = await sql`
      SELECT * FROM crewcast.users WHERE id = ${context.account.id}
    `;

    return NextResponse.json({ user: (users[0] as DbUser | undefined) ?? null });
  } catch (error) {
    console.error('Error fetching authenticated account:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}

// Create the application account for the authenticated Supabase user. Plan,
// subscription and billing authority always start from server-owned defaults.
export async function POST(request: NextRequest) {
  try {
    const context = await resolveAuthenticatedAccount();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return invalidInput('Invalid JSON body');
    }

    const parsed = createAccountInputSchema.safeParse(body);
    if (!parsed.success) {
      return invalidInput('A valid name is required');
    }

    if (context.account) {
      const existing = await sql`
        SELECT * FROM crewcast.users WHERE id = ${context.account.id}
      `;
      return NextResponse.json({ user: existing[0] as DbUser, created: false });
    }

    const email = context.authUser.email?.trim();
    if (!email) {
      return NextResponse.json({ error: 'Authenticated email is required' }, { status: 400 });
    }

    // Multiple mounted components can create the application account together.
    // Serialize on the immutable Auth UUID so only one row and one welcome
    // email win, regardless of email casing or later email changes.
    const creation = await sql.begin(async (transaction: typeof sql) => {
      await transaction`
        SELECT pg_advisory_xact_lock(hashtextextended(${context.authUser.id}, 0))
      `;

      const existing = await transaction`
        SELECT *
        FROM crewcast.users
        WHERE auth_user_id = ${context.authUser.id}::uuid
        LIMIT 1
        FOR UPDATE
      `;
      if (existing.length === 1) {
        const synchronized = await transaction`
          UPDATE crewcast.users
          SET email = ${email}, updated_at = NOW()
          WHERE id = ${existing[0].id}
            AND auth_user_id = ${context.authUser.id}::uuid
          RETURNING *
        `;
        return { user: synchronized[0] as DbUser, created: false };
      }

      const inserted = await transaction`
        INSERT INTO crewcast.users (
          auth_user_id,
          email,
          name,
          is_onboarded,
          onboarding_step,
          has_subscription,
          plan
        )
        VALUES (
          ${context.authUser.id}::uuid,
          ${email},
          ${parsed.data.name},
          false,
          1,
          false,
          'free_trial'
        )
        ON CONFLICT (auth_user_id) DO NOTHING
        RETURNING *
      `;
      if (inserted.length === 1) {
        return { user: inserted[0] as DbUser, created: true };
      }

      const concurrent = await transaction`
        SELECT *
        FROM crewcast.users
        WHERE auth_user_id = ${context.authUser.id}::uuid
        LIMIT 1
      `;
      if (concurrent.length !== 1) {
        throw new Error('The authenticated application account could not be created exactly once.');
      }
      return { user: concurrent[0] as DbUser, created: false };
    });

    const newUser = creation.user;
    if (!creation.created) {
      return NextResponse.json({ user: newUser, created: false });
    }
    const locale = detectLocale(request.headers.get('accept-language'));
    const appUrl = getAppUrl();
    waitUntil(
      sendEmail({
        to: newUser.email,
        subject: welcomeEmailSubject(locale),
        react: WelcomeEmail({ name: newUser.name, locale, appUrl }),
      }),
    );

    return NextResponse.json({ user: newUser, created: true });
  } catch (error) {
    console.error('Error creating authenticated account:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}

// Update profile-owned fields only. Subscription state, billing identifiers,
// trial dates, the effective plan and onboarding completion are intentionally
// absent from the schema and can only be changed by their server workflows.
export async function PATCH(request: NextRequest) {
  try {
    const context = await resolveAuthenticatedAccount();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!context.account) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return invalidInput('Invalid JSON body');
    }

    const parsed = profilePatchInputSchema.safeParse(body);
    if (!parsed.success) {
      return invalidInput('Invalid or unsupported profile update');
    }

    const updates = parsed.data;
    const accountId = context.account.id;
    if (!legacyAccountIdMatches(updates.id, accountId)) {
      return NextResponse.json(
        { error: 'Not authorized to update this account' },
        { status: 403 },
      );
    }

    const has = (field: keyof typeof updates) =>
      Object.prototype.hasOwnProperty.call(updates, field);

    // Keep the profile update and the auto-scan cadence reset atomic. This
    // prevents a successful toggle from leaving an immediately-due schedule.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatedUsers = await sql.begin(async (tx: any) => {
      const rows = await tx`
        UPDATE crewcast.users
        SET
          name = CASE WHEN ${has('name')} THEN ${updates.name ?? null} ELSE name END,
          onboarding_step = CASE WHEN ${has('onboardingStep')} THEN ${updates.onboardingStep ?? null} ELSE onboarding_step END,
          role = CASE WHEN ${has('role')} THEN ${updates.role ?? null} ELSE role END,
          brand = CASE WHEN ${has('brand')} THEN ${updates.brand ?? null} ELSE brand END,
          bio = CASE WHEN ${has('bio')} THEN ${updates.bio ?? null} ELSE bio END,
          trial_plan = CASE WHEN ${has('trialPlan')} THEN ${updates.trialPlan ?? null} ELSE trial_plan END,
          target_country = CASE WHEN ${has('targetCountry')} THEN ${updates.targetCountry ?? null} ELSE target_country END,
          target_language = CASE WHEN ${has('targetLanguage')} THEN ${updates.targetLanguage ?? null} ELSE target_language END,
          competitors = CASE WHEN ${has('competitors')} THEN ${updates.competitors ?? null} ELSE competitors END,
          topics = CASE WHEN ${has('topics')} THEN ${updates.topics ?? null} ELSE topics END,
          affiliate_types = CASE WHEN ${has('affiliateTypes')} THEN ${updates.affiliateTypes ?? null} ELSE affiliate_types END,
          email_matches = CASE WHEN ${has('emailMatches')} THEN ${updates.emailMatches ?? null} ELSE email_matches END,
          email_reports = CASE WHEN ${has('emailReports')} THEN ${updates.emailReports ?? null} ELSE email_reports END,
          email_updates = CASE WHEN ${has('emailUpdates')} THEN ${updates.emailUpdates ?? null} ELSE email_updates END,
          app_replies = CASE WHEN ${has('appReplies')} THEN ${updates.appReplies ?? null} ELSE app_replies END,
          app_reminders = CASE WHEN ${has('appReminders')} THEN ${updates.appReminders ?? null} ELSE app_reminders END,
          profile_image_url = CASE WHEN ${has('profileImageUrl')} THEN ${updates.profileImageUrl ?? null} ELSE profile_image_url END,
          auto_scan_enabled = CASE WHEN ${has('autoScanEnabled')} THEN ${updates.autoScanEnabled ?? null} ELSE auto_scan_enabled END,
          updated_at = NOW()
        WHERE id = ${accountId}
        RETURNING *
      `;

      if (updates.autoScanEnabled === true) {
        await tx`
          UPDATE crewcast.subscriptions
          SET next_auto_scan_at = NOW() + interval '7 days'
          WHERE user_id = ${accountId} AND next_auto_scan_at < NOW()
        `;
        await tx`
          UPDATE crewcast.brand_locations AS locations
          SET
            auto_scan_enabled = true,
            next_auto_scan_at = (
              SELECT subscriptions.next_auto_scan_at
              FROM crewcast.subscriptions AS subscriptions
              WHERE subscriptions.user_id = ${accountId}
                AND subscriptions.status IN ('active', 'trialing')
              ORDER BY subscriptions.updated_at DESC, subscriptions.id DESC
              LIMIT 1
            )
          WHERE locations.user_id = ${accountId}
            AND locations.archived_at IS NULL
        `;
      } else if (updates.autoScanEnabled === false) {
        // Do not erase a live worker lease: the claimed provider operation must
        // finish or expire fail-closed. Pending locations are skipped by the
        // next cron transaction because the account preference is authoritative.
        await tx`
          UPDATE crewcast.brand_locations
          SET
            auto_scan_enabled = false,
            next_auto_scan_at = NULL
          WHERE user_id = ${accountId}
            AND archived_at IS NULL
        `;
      }

      return rows;
    });

    if (updatedUsers.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user: updatedUsers[0] as DbUser });
  } catch (error) {
    console.error('Error updating authenticated account:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
