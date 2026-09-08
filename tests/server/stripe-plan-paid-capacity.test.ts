import assert from 'node:assert/strict';
import test from 'node:test';
import type postgres from 'postgres';
import { DowngradeCapacityError } from '../../src/lib/plans/downgrade-capacity';
import {
  prepareDowngradeCapacitySelection,
  reconcileAppliedDowngradeCapacity,
} from '../../src/lib/stripe/downgrade-capacity-postgres';
import { restoreDowngradeArchivedCapacity } from '../../src/lib/stripe/upgrade-capacity-postgres';

function normalizeSql(strings: TemplateStringsArray): string {
  return strings.join('?').replace(/\s+/g, ' ').trim();
}

function downgradeFixture(capacityStatus: 'active' | 'canceled') {
  const transaction = (async (strings: TemplateStringsArray) => {
    const text = normalizeSql(strings);
    if (text.length === 0 || text === 'FOR UPDATE') return [];
    if (text.includes('FROM crewcast.stripe_capacity_subscriptions')) {
      return [{
        stripe_customer_id: 'cus_account',
        status: capacityStatus,
        extra_brand_quantity: 2,
        extra_location_quantity: 1,
      }];
    }
    if (text.includes('FROM crewcast.brands')) {
      return [
        { id: '10', is_default: true },
        { id: '20', is_default: false },
        { id: '30', is_default: false },
      ];
    }
    if (text.includes('FROM crewcast.brand_locations')) {
      return [
        { id: '101', brand_id: '10', is_default: true },
        { id: '201', brand_id: '20', is_default: true },
        { id: '301', brand_id: '30', is_default: true },
      ];
    }
    throw new Error(`Unexpected SQL in downgrade fixture: ${text}`);
  }) as unknown as postgres.Sql;
  return transaction;
}

test('plan downgrade keep-list includes paid brand and location capacity', async () => {
  const result = await prepareDowngradeCapacitySelection(downgradeFixture('active'), {
    userId: 42,
    stripeCustomerId: 'cus_account',
    targetPlan: 'pro',
  });
  assert.deepEqual(result.selection.brandIds, ['10', '20', '30']);
  assert.deepEqual(result.selection.locationIds, ['101', '201', '301']);
});

test('terminal add-on status is not counted during plan downgrade', async () => {
  await assert.rejects(
    prepareDowngradeCapacitySelection(downgradeFixture('canceled'), {
      userId: 42,
      stripeCustomerId: 'cus_account',
      targetPlan: 'pro',
    }),
    (error: unknown) => error instanceof DowngradeCapacityError
      && error.code === 'DOWNGRADE_SELECTION_REQUIRED'
      && error.assessment?.maxBrands === 1
      && error.assessment.maxLocations === 2,
  );
});

function stalePlanSelectionFixture(addonArchived: boolean) {
  const activeBrands = [
    { id: '10', is_default: true },
    { id: '20', is_default: false },
  ];
  const activeLocations = [
    { id: '101', brand_id: '10', is_default: true },
    { id: '201', brand_id: '20', is_default: true },
    { id: '102', brand_id: '10', is_default: false },
  ];
  const transaction = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = normalizeSql(strings);
    if (text.length === 0 || text === 'FOR UPDATE') return [];
    if (text.includes('FROM crewcast.stripe_capacity_subscriptions')) {
      return [{
        stripe_customer_id: 'cus_account',
        status: 'canceled',
        extra_brand_quantity: 2,
        extra_location_quantity: 4,
      }];
    }
    if (text.startsWith('SELECT') && text.includes('FROM crewcast.brands')) {
      return activeBrands;
    }
    if (text.startsWith('SELECT') && text.includes('FROM crewcast.brand_locations')) {
      return activeLocations;
    }
    if (text.includes('FROM unnest') && text.includes('LEFT JOIN crewcast.brands')) {
      return [{
        expected_count: 1,
        found_count: 1,
        active_count: 0,
        addon_archived_count: addonArchived ? 1 : 0,
      }];
    }
    if (text.includes('FROM unnest') && text.includes('LEFT JOIN crewcast.brand_locations')) {
      return [{
        expected_count: 1,
        found_count: 1,
        active_count: 0,
        addon_archived_count: addonArchived ? 1 : 0,
      }];
    }
    if (
      text.startsWith('UPDATE crewcast.brands')
      && text.includes('archived_at = statement_timestamp()')
    ) {
      const keep = values.find(Array.isArray) as string[];
      return activeBrands.filter((brand) => !keep.includes(brand.id));
    }
    if (
      text.startsWith('UPDATE crewcast.brand_locations')
      && text.includes('archived_at = statement_timestamp()')
    ) {
      const keep = values.find(Array.isArray) as string[];
      return activeLocations.filter((location) => !keep.includes(location.id));
    }
    if (
      text.startsWith('UPDATE crewcast.brands')
      || text.startsWith('UPDATE crewcast.brand_locations')
    ) {
      return [];
    }
    throw new Error(`Unexpected SQL in stale selection fixture: ${text}`);
  }) as unknown as postgres.Sql;
  return transaction;
}

test('a future plan downgrade repairs only a keep-list made stale by paid-capacity loss', async () => {
  assert.deepEqual(await reconcileAppliedDowngradeCapacity(
    stalePlanSelectionFixture(true),
    {
      userId: 42,
      stripeCustomerId: 'cus_account',
      planChangeId: '77',
      targetPlan: 'pro',
      selection: { brandIds: ['30'], locationIds: ['301'] },
    },
  ), {
    archivedBrands: 1,
    archivedLocations: 1,
  });
});

test('a stale plan keep-list without paid-capacity provenance still fails closed', async () => {
  await assert.rejects(
    reconcileAppliedDowngradeCapacity(
      stalePlanSelectionFixture(false),
      {
        userId: 42,
        stripeCustomerId: 'cus_account',
        planChangeId: '77',
        targetPlan: 'pro',
        selection: { brandIds: ['30'], locationIds: ['301'] },
      },
    ),
    (error: unknown) => error instanceof DowngradeCapacityError
      && error.code === 'INVALID_DOWNGRADE_SELECTION',
  );
});

function upgradeFixture() {
  const statements: string[] = [];
  const transaction = (async (strings: TemplateStringsArray) => {
    const text = normalizeSql(strings);
    if (text.length === 0 || text === 'FOR UPDATE') return [];
    statements.push(text);
    if (text.includes('FROM crewcast.users')) {
      return [{ id: 42, auto_scan_enabled: false }];
    }
    if (text.includes('FROM crewcast.subscriptions')) {
      return [{
        plan: 'pro',
        status: 'active',
        stripe_customer_id: 'cus_account',
        stripe_subscription_id: 'sub_base',
        first_payment_at: '2035-01-01T00:00:00.000Z',
        next_auto_scan_at: null,
      }];
    }
    if (text.includes('FROM crewcast.stripe_capacity_subscriptions')) {
      return [{
        stripe_customer_id: 'cus_account',
        status: 'active',
        extra_brand_quantity: 1,
        extra_location_quantity: 0,
      }];
    }
    if (text.includes('FROM crewcast.brands AS brands')) {
      return [
        {
          id: '10',
          normalized_domain: 'active.example',
          is_default: true,
          archived_at: null,
          archive_change_id: null,
          archive_change_status: null,
        },
        {
          id: '20',
          normalized_domain: 'restored.example',
          is_default: false,
          archived_at: '2035-01-01T00:00:00.000Z',
          archive_change_id: '77',
          archive_change_status: 'applied',
        },
      ];
    }
    if (text.includes('FROM crewcast.brand_locations AS locations')) {
      return [
        {
          id: '101',
          brand_id: '10',
          country_code: 'DE',
          language_code: 'de',
          is_default: true,
          archived_at: null,
          archive_change_id: null,
          archive_change_status: null,
        },
        {
          id: '201',
          brand_id: '20',
          country_code: 'GB',
          language_code: 'en',
          is_default: false,
          archived_at: '2035-01-01T00:00:00.000Z',
          archive_change_id: '77',
          archive_change_status: 'applied',
        },
      ];
    }
    if (text.startsWith('UPDATE crewcast.brands') && text.includes('RETURNING id')) {
      return [{ id: '20' }];
    }
    if (text.startsWith('UPDATE crewcast.brand_locations') && text.includes('RETURNING id')) {
      return [{ id: '201' }];
    }
    if (text.startsWith('UPDATE crewcast.brands') || text.startsWith('UPDATE crewcast.brand_locations')) {
      return [];
    }
    throw new Error(`Unexpected SQL in upgrade fixture: ${text}`);
  }) as unknown as postgres.Sql;
  return { transaction, statements };
}

test('upgrade restoration counts active paid capacity before restoring rows', async () => {
  const fixture = upgradeFixture();
  const result = await restoreDowngradeArchivedCapacity(fixture.transaction, {
    userId: 42,
    stripeCustomerId: 'cus_account',
    targetPlan: 'pro',
    stripeSubscriptionId: 'sub_base',
  });
  assert.deepEqual(result, {
    status: 'restored',
    restoredBrands: 1,
    restoredLocations: 1,
  });
  assert.equal(fixture.statements.some((statement) =>
    statement.includes('FROM crewcast.stripe_capacity_subscriptions')), true);
});
