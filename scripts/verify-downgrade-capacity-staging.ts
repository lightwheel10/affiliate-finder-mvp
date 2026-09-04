import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { config as loadEnvironment } from 'dotenv';
import postgres from 'postgres';
import {
  archiveManagedBrand,
  archiveManagedLocation,
} from '../src/lib/brand-locations/management-postgres';
import { BrandLocationManagementError } from '../src/lib/brand-locations/management';
import { DowngradeCapacityError } from '../src/lib/plans/downgrade-capacity';
import { prepareDowngradeCapacitySelection } from '../src/lib/stripe/downgrade-capacity-postgres';
import { restoreDowngradeArchivedCapacity } from '../src/lib/stripe/upgrade-capacity-postgres';
import {
  readPendingSubscriptionPlanChange,
  recordDeferredPlanChange,
  synchronizePendingSubscriptionPlanChange,
} from '../src/lib/stripe/subscription-plan-changes-postgres';

const STAGING_PROJECT_REF = 'jxerxreqezhdsisdwddw';
const SYNTHETIC_EMAIL_PREFIX = 'codex-downgrade-capacity-';

loadEnvironment({
  path: path.resolve(process.cwd(), '.env.staging.local'),
  override: true,
  quiet: true,
});

const databaseUrl = process.env.SUPABASE_DATABASE_URL;
if (!databaseUrl) throw new Error('SUPABASE_DATABASE_URL is missing.');

function projectRef(connectionUrl: string): string {
  const parsed = new URL(connectionUrl);
  const direct = parsed.hostname.match(/^db\.([a-z0-9]{20})\.supabase\.co$/);
  const pooler = decodeURIComponent(parsed.username).match(/^postgres\.([a-z0-9]{20})$/);
  if (direct) return direct[1];
  if (pooler && parsed.hostname.endsWith('.pooler.supabase.com')) return pooler[1];
  throw new Error('Could not prove the Supabase project reference.');
}

assert.equal(
  projectRef(databaseUrl),
  STAGING_PROJECT_REF,
  'Refusing to test downgrade capacity outside Terminal-Backup.',
);

const sql = postgres(databaseUrl, {
  max: 4,
  prepare: false,
  connect_timeout: 10,
  idle_timeout: 10,
});
const token = randomUUID().replaceAll('-', '');
let accountId: number | null = null;

async function removeInterruptedSyntheticFixtures(): Promise<void> {
  await sql`
    DELETE FROM crewcast.users
    WHERE email LIKE ${`${SYNTHETIC_EMAIL_PREFIX}%@example.invalid`}
  `;
}

async function verifyMigration(): Promise<void> {
  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/0020_downgrade_capacity_selection.up.sql',
  );
  const checksum = createHash('sha256').update(readFileSync(migrationPath)).digest('hex');
  const rows = await sql<{
    checksum: string;
    selection_columns: number;
    archive_columns: number;
    constraints: number;
  }[]>`
    SELECT
      migrations.checksum_sha256 AS checksum,
      (SELECT count(*) FROM information_schema.columns
        WHERE table_schema = 'crewcast'
          AND table_name = 'subscription_plan_changes'
          AND column_name IN (
            'capacity_selection_version',
            'retained_brand_ids',
            'retained_location_ids',
            'capacity_reconciled_at'
          ))::integer AS selection_columns,
      (SELECT count(*) FROM information_schema.columns
        WHERE table_schema = 'crewcast'
          AND table_name IN ('brands', 'brand_locations')
          AND column_name = 'capacity_archived_by_plan_change_id')::integer AS archive_columns,
      (SELECT count(*) FROM pg_constraint
        WHERE conname IN (
          'subscription_plan_changes_capacity_selection_check',
          'brands_capacity_archive_state_check',
          'brands_capacity_archive_change_fkey',
          'brand_locations_capacity_archive_state_check',
          'brand_locations_capacity_archive_change_fkey'
        ))::integer AS constraints
    FROM crewcast.schema_migrations AS migrations
    WHERE migrations.version = '0020'
      AND migrations.name = 'downgrade_capacity_selection'
  `;
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    checksum,
    selection_columns: 4,
    archive_columns: 2,
    constraints: 5,
  });
}

async function createFixture() {
  const users = await sql<{ id: number }[]>`
    INSERT INTO crewcast.users (
      email, name, is_onboarded, onboarding_step, has_subscription, plan
    ) VALUES (
      ${`${SYNTHETIC_EMAIL_PREFIX}${token}@example.invalid`},
      'Downgrade capacity verifier',
      true,
      8,
      true,
      'business'
    )
    RETURNING id
  `;
  assert.equal(users.length, 1);
  accountId = users[0].id;
  await sql`
    INSERT INTO crewcast.subscriptions (
      user_id,
      stripe_customer_id,
      stripe_subscription_id,
      plan,
      status,
      billing_interval,
      current_period_end,
      first_payment_at,
      next_auto_scan_at
    ) VALUES (
      ${accountId},
      ${`cus_codex_${token}`},
      ${`sub_codex_${token}`},
      'business',
      'active',
      'monthly',
      NOW() + INTERVAL '30 days',
      NOW() - INTERVAL '30 days',
      NOW() + INTERVAL '7 days'
    )
  `;

  const brands = await sql<{ id: string }[]>`
    INSERT INTO crewcast.brands (user_id, name, normalized_domain, is_default)
    VALUES
      (${accountId}, 'Default brand', ${`default-${token}.example.com`}, true),
      (${accountId}, 'Chosen brand', ${`chosen-${token}.example.com`}, false),
      (${accountId}, 'Excess brand', ${`excess-${token}.example.com`}, false)
    RETURNING id::text AS id
  `;
  assert.equal(brands.length, 3);
  const locations = await sql<{ id: string; brand_id: string }[]>`
    INSERT INTO crewcast.brand_locations (
      user_id, brand_id, country_code, language_code, is_default,
      auto_scan_enabled, next_auto_scan_at
    ) VALUES
      (${accountId}, ${brands[0].id}::bigint, 'de', 'de', true, true, NOW() + INTERVAL '7 days'),
      (${accountId}, ${brands[0].id}::bigint, 'gb', 'en', false, true, NOW() + INTERVAL '7 days'),
      (${accountId}, ${brands[1].id}::bigint, 'us', 'en', true, true, NOW() + INTERVAL '7 days'),
      (${accountId}, ${brands[2].id}::bigint, 'fr', 'fr', true, true, NOW() + INTERVAL '7 days')
    RETURNING id::text AS id, brand_id::text AS brand_id
  `;
  assert.equal(locations.length, 4);
  return { brands, locations };
}

async function verifySelectionAndReconciliation(
  fixture: Awaited<ReturnType<typeof createFixture>>,
): Promise<void> {
  assert(accountId !== null);
  await assert.rejects(
    sql.begin((transaction) => prepareDowngradeCapacitySelection(transaction, {
      userId: accountId!,
      targetPlan: 'pro',
    })),
    (error: unknown) => error instanceof DowngradeCapacityError
      && error.code === 'DOWNGRADE_SELECTION_REQUIRED'
      && error.status === 409,
  );
  const beforeMissingChoice = await sql<{ count: number }[]>`
    SELECT count(*)::integer AS count
    FROM crewcast.subscription_plan_changes
    WHERE user_id = ${accountId}
  `;
  assert.equal(beforeMissingChoice[0].count, 0);

  const selectedBrandId = fixture.brands[1].id;
  const selectedLocationId = fixture.locations.find(
    (location) => location.brand_id === selectedBrandId,
  )?.id;
  assert(selectedLocationId);
  const effectiveAt = '2099-01-01T00:00:00.000Z';
  const scheduleId = `sub_sched_codex_${token}`;
  const pending = await sql.begin(async (transaction) => {
    const capacity = await prepareDowngradeCapacitySelection(transaction, {
      userId: accountId!,
      targetPlan: 'pro',
      requestedSelection: {
        brandIds: [selectedBrandId],
        locationIds: [selectedLocationId],
      },
    });
    return recordDeferredPlanChange(transaction, {
      userId: accountId!,
      stripeSubscriptionId: `sub_codex_${token}`,
      stripeScheduleId: scheduleId,
      fromPlan: 'business',
      fromBillingInterval: 'monthly',
      toPlan: 'pro',
      toBillingInterval: 'monthly',
      effectiveAt,
      capacitySelectionVersion: capacity.selectionVersion,
      retainedBrandIds: capacity.selection.brandIds,
      retainedLocationIds: capacity.selection.locationIds,
    });
  });
  assert.deepEqual(pending.retainedBrandIds, [selectedBrandId]);
  assert.deepEqual(pending.retainedLocationIds, [selectedLocationId]);

  await assert.rejects(
    archiveManagedBrand(accountId, selectedBrandId, sql),
    (error: unknown) => error instanceof BrandLocationManagementError
      && error.code === 'PENDING_DOWNGRADE_CONFLICT'
      && error.status === 409,
  );
  await assert.rejects(
    archiveManagedLocation(accountId, selectedLocationId, sql),
    (error: unknown) => error instanceof BrandLocationManagementError
      && error.code === 'PENDING_DOWNGRADE_CONFLICT'
      && error.status === 409,
  );

  // Capacity can change while the higher paid plan remains active. Anything
  // added after the choice must still be archived at the plan boundary.
  const addedBrand = await sql<{ id: string }[]>`
    INSERT INTO crewcast.brands (user_id, name, normalized_domain, is_default)
    VALUES (${accountId}, 'Added later', ${`later-${token}.example.com`}, false)
    RETURNING id::text AS id
  `;
  await sql`
    INSERT INTO crewcast.brand_locations (
      user_id, brand_id, country_code, language_code, is_default, auto_scan_enabled
    ) VALUES (${accountId}, ${addedBrand[0].id}::bigint, 'ca', 'en', true, true)
  `;

  const waiting = await synchronizePendingSubscriptionPlanChange(sql, {
    userId: accountId,
    stripeSubscriptionId: `sub_codex_${token}`,
    stripeScheduleId: scheduleId,
    currentPlan: 'business',
    currentBillingInterval: 'monthly',
  });
  assert.equal(waiting, 'pending');

  const applied = await sql.begin(async (transaction) => {
    await transaction`
      UPDATE crewcast.subscriptions
      SET plan = 'pro', updated_at = NOW()
      WHERE user_id = ${accountId}
    `;
    await transaction`
      UPDATE crewcast.users
      SET plan = 'pro', updated_at = NOW()
      WHERE id = ${accountId}
    `;
    return synchronizePendingSubscriptionPlanChange(transaction, {
      userId: accountId!,
      stripeSubscriptionId: `sub_codex_${token}`,
      stripeScheduleId: scheduleId,
      currentPlan: 'pro',
      currentBillingInterval: 'monthly',
    });
  });
  assert.equal(applied, 'applied');

  const [brandState, locationState, changeState] = await Promise.all([
    sql<{
      id: string;
      is_default: boolean;
      archived: boolean;
      archive_change_id: string | null;
    }[]>`
      SELECT
        id::text AS id,
        is_default,
        archived_at IS NOT NULL AS archived,
        capacity_archived_by_plan_change_id::text AS archive_change_id
      FROM crewcast.brands
      WHERE user_id = ${accountId}
      ORDER BY id
    `,
    sql<{
      id: string;
      is_default: boolean;
      auto_scan_enabled: boolean;
      archived: boolean;
      archive_change_id: string | null;
    }[]>`
      SELECT
        id::text AS id,
        is_default,
        auto_scan_enabled,
        archived_at IS NOT NULL AS archived,
        capacity_archived_by_plan_change_id::text AS archive_change_id
      FROM crewcast.brand_locations
      WHERE user_id = ${accountId}
      ORDER BY id
    `,
    sql<{
      status: string;
      capacity_reconciled_at: Date | null;
    }[]>`
      SELECT status, capacity_reconciled_at
      FROM crewcast.subscription_plan_changes
      WHERE id = ${pending.id}::bigint
    `,
  ]);
  assert.equal(brandState.length, 4, 'Downgrade must not delete any brand row.');
  assert.equal(locationState.length, 5, 'Downgrade must not delete any location row.');
  assert.deepEqual(
    brandState.filter((brand) => !brand.archived).map((brand) => ({
      id: brand.id,
      isDefault: brand.is_default,
    })),
    [{ id: selectedBrandId, isDefault: true }],
  );
  assert.deepEqual(
    locationState.filter((location) => !location.archived).map((location) => ({
      id: location.id,
      isDefault: location.is_default,
    })),
    [{ id: selectedLocationId, isDefault: true }],
  );
  for (const brand of brandState.filter((candidate) => candidate.archived)) {
    assert.equal(brand.archive_change_id, pending.id);
  }
  for (const location of locationState.filter((candidate) => candidate.archived)) {
    assert.equal(location.auto_scan_enabled, false);
    assert.equal(location.archive_change_id, pending.id);
  }
  assert.equal(changeState[0].status, 'applied');
  assert(changeState[0].capacity_reconciled_at instanceof Date);

  const tooSmall = await sql.begin((transaction) => restoreDowngradeArchivedCapacity(
    transaction,
    {
      userId: accountId!,
      targetPlan: 'pro',
      stripeSubscriptionId: `sub_codex_${token}`,
    },
  ));
  assert.deepEqual(tooSmall, {
    status: 'selection_required',
    restoredBrands: 0,
    restoredLocations: 0,
    candidateBrands: 3,
    candidateLocations: 4,
    reason: 'capacity',
  });
  const unchangedAfterRefusal = await sql<{ active_brands: number; active_locations: number }[]>`
    SELECT
      (SELECT count(*) FROM crewcast.brands
        WHERE user_id = ${accountId} AND archived_at IS NULL)::integer AS active_brands,
      (SELECT count(*) FROM crewcast.brand_locations
        WHERE user_id = ${accountId} AND archived_at IS NULL)::integer AS active_locations
  `;
  assert.deepEqual(unchangedAfterRefusal[0], { active_brands: 1, active_locations: 1 });

  // A stale or spoofed Stripe subscription must fail before restoration.
  await assert.rejects(
    sql.begin((transaction) => restoreDowngradeArchivedCapacity(transaction, {
      userId: accountId!,
      targetPlan: 'pro',
      stripeSubscriptionId: `sub_wrong_${token}`,
    })),
    /stale Stripe subscription/,
  );

  await sql.begin(async (transaction) => {
    await transaction`
      UPDATE crewcast.subscriptions SET plan = 'business', updated_at = NOW()
      WHERE user_id = ${accountId}
    `;
    await transaction`
      UPDATE crewcast.users SET plan = 'business', updated_at = NOW()
      WHERE id = ${accountId}
    `;
  });

  // Vercel and Stripe can deliver the route response and webhook concurrently.
  // The account row lock must make that race exactly-once and idempotent.
  const concurrentAttemptCount = 24;
  const restorationOutcomes = await Promise.all(
    Array.from({ length: concurrentAttemptCount }, () => sql.begin(
      (transaction) => restoreDowngradeArchivedCapacity(transaction, {
        userId: accountId!,
        targetPlan: 'business',
        stripeSubscriptionId: `sub_codex_${token}`,
      }),
    )),
  );
  assert.deepEqual(
    restorationOutcomes.filter((outcome) => outcome.status === 'restored'),
    [{ status: 'restored', restoredBrands: 3, restoredLocations: 4 }],
  );
  assert.equal(
    restorationOutcomes.filter((outcome) => outcome.status === 'none').length,
    concurrentAttemptCount - 1,
  );
  assert.equal(
    restorationOutcomes.filter((outcome) => outcome.status === 'selection_required').length,
    0,
  );

  const restoredState = await sql<{
    active_brands: number;
    active_locations: number;
    marked_brands: number;
    marked_locations: number;
    enabled_locations: number;
    scheduled_locations: number;
    default_brands: number;
    brands_without_default_location: number;
  }[]>`
    SELECT
      (SELECT count(*) FROM crewcast.brands
        WHERE user_id = ${accountId} AND archived_at IS NULL)::integer AS active_brands,
      (SELECT count(*) FROM crewcast.brand_locations
        WHERE user_id = ${accountId} AND archived_at IS NULL)::integer AS active_locations,
      (SELECT count(*) FROM crewcast.brands
        WHERE user_id = ${accountId}
          AND capacity_archived_by_plan_change_id IS NOT NULL)::integer AS marked_brands,
      (SELECT count(*) FROM crewcast.brand_locations
        WHERE user_id = ${accountId}
          AND capacity_archived_by_plan_change_id IS NOT NULL)::integer AS marked_locations,
      (SELECT count(*) FROM crewcast.brand_locations
        WHERE user_id = ${accountId}
          AND archived_at IS NULL
          AND auto_scan_enabled)::integer AS enabled_locations,
      (SELECT count(*) FROM crewcast.brand_locations
        WHERE user_id = ${accountId}
          AND archived_at IS NULL
          AND next_auto_scan_at IS NOT NULL)::integer AS scheduled_locations,
      (SELECT count(*) FROM crewcast.brands
        WHERE user_id = ${accountId}
          AND archived_at IS NULL
          AND is_default)::integer AS default_brands,
      (SELECT count(*) FROM crewcast.brands AS brands
        WHERE brands.user_id = ${accountId}
          AND brands.archived_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM crewcast.brand_locations AS locations
            WHERE locations.user_id = brands.user_id
              AND locations.brand_id = brands.id
              AND locations.archived_at IS NULL
              AND locations.is_default
          ))::integer AS brands_without_default_location
  `;
  assert.deepEqual(restoredState[0], {
    active_brands: 4,
    active_locations: 5,
    marked_brands: 0,
    marked_locations: 0,
    enabled_locations: 5,
    scheduled_locations: 5,
    default_brands: 1,
    brands_without_default_location: 0,
  });

  const restorationReplay = await sql.begin((transaction) => restoreDowngradeArchivedCapacity(
    transaction,
    {
      userId: accountId!,
      targetPlan: 'business',
      stripeSubscriptionId: `sub_codex_${token}`,
    },
  ));
  assert.deepEqual(restorationReplay, {
    status: 'none',
    restoredBrands: 0,
    restoredLocations: 0,
  });

  // A later manual archive clears downgrade provenance. Replaying automatic
  // restoration must therefore leave that deliberate customer choice alone.
  const manuallyArchivedLocationId = fixture.locations[1].id;
  await archiveManagedLocation(accountId, manuallyArchivedLocationId, sql);
  const afterManualArchive = await sql.begin((transaction) => restoreDowngradeArchivedCapacity(
    transaction,
    {
      userId: accountId!,
      targetPlan: 'business',
      stripeSubscriptionId: `sub_codex_${token}`,
    },
  ));
  assert.equal(afterManualArchive.status, 'none');
  const manualArchiveState = await sql<{
    archived: boolean;
    archive_change_id: string | null;
  }[]>`
    SELECT
      archived_at IS NOT NULL AS archived,
      capacity_archived_by_plan_change_id::text AS archive_change_id
    FROM crewcast.brand_locations
    WHERE id = ${manuallyArchivedLocationId}::bigint
      AND user_id = ${accountId}
  `;
  assert.deepEqual(manualArchiveState[0], { archived: true, archive_change_id: null });

  const replay = await synchronizePendingSubscriptionPlanChange(sql, {
    userId: accountId,
    stripeSubscriptionId: `sub_codex_${token}`,
    stripeScheduleId: scheduleId,
    currentPlan: 'pro',
    currentBillingInterval: 'monthly',
  });
  assert.equal(replay, 'none');
  assert.equal(await readPendingSubscriptionPlanChange(sql, accountId), null);
}

async function cleanup(): Promise<void> {
  if (accountId !== null) await sql`DELETE FROM crewcast.users WHERE id = ${accountId}`;
  const residue = await sql<{ users: number; changes: number }[]>`
    SELECT
      (SELECT count(*) FROM crewcast.users
        WHERE email LIKE ${`${SYNTHETIC_EMAIL_PREFIX}%`})::integer AS users,
      (SELECT count(*) FROM crewcast.subscription_plan_changes AS changes
        JOIN crewcast.users AS users ON users.id = changes.user_id
        WHERE users.email LIKE ${`${SYNTHETIC_EMAIL_PREFIX}%`})::integer AS changes
  `;
  assert.deepEqual(residue[0], { users: 0, changes: 0 });
}

async function main(): Promise<void> {
  try {
    await verifyMigration();
    await removeInterruptedSyntheticFixtures();
    const fixture = await createFixture();
    await verifySelectionAndReconciliation(fixture);
    console.log('Downgrade capacity staging verification passed.');
  } finally {
    await cleanup();
    await sql.end();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
