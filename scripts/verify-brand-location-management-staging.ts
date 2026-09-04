import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { config as loadEnvironment } from 'dotenv';
import postgres from 'postgres';

const STAGING_PROJECT_REF = 'jxerxreqezhdsisdwddw';
const SYNTHETIC_EMAIL_PATTERN = 'codex-management-%@example.invalid';

loadEnvironment({
  path: path.resolve(process.cwd(), '.env.staging.local'),
  override: true,
  quiet: true,
});

const databaseUrl = process.env.SUPABASE_DATABASE_URL;
if (!databaseUrl) throw new Error('SUPABASE_DATABASE_URL is missing.');

function extractProjectRef(connectionUrl: string): string {
  const parsed = new URL(connectionUrl);
  const candidates = new Set<string>();
  const direct = parsed.hostname.match(/^db\.([a-z0-9]{20})\.supabase\.co$/);
  if (direct) candidates.add(direct[1]);
  const pooler = decodeURIComponent(parsed.username).match(/^postgres\.([a-z0-9]{20})$/);
  if (pooler && parsed.hostname.endsWith('.pooler.supabase.com')) candidates.add(pooler[1]);
  if (candidates.size !== 1) throw new Error('Could not prove exactly one Supabase project ref.');
  return [...candidates][0];
}

assert.equal(
  extractProjectRef(databaseUrl),
  STAGING_PROJECT_REF,
  'Refusing to run management tests against anything except the isolated staging project.',
);

type SqlClient = postgres.Sql;
type Plan = 'pro' | 'business';
type SubscriptionStatus = 'active' | 'trialing' | 'canceled';

interface Fixture {
  accountId: number;
  email: string;
  plan: Plan;
  brandId: string;
  locationId: string;
}

interface GlobalState {
  users: number;
  subscriptions: number;
  brands: number;
  locations: number;
  jobs: number;
  syntheticUsers: number;
}

interface ManagementErrorShape {
  code?: unknown;
  status?: unknown;
}

const fixtureSql = postgres(databaseUrl, {
  // Terminal-Backup's session pool currently permits 15 clients. Keep this
  // verifier below that external ceiling so its 15 logical contenders are
  // queued locally and exercise the application lock instead of testing the
  // pooler's connection rejection.
  max: 10,
  prepare: false,
  connect_timeout: 10,
  idle_timeout: 10,
});

async function globalState(executor: SqlClient): Promise<GlobalState> {
  const rows = await executor<GlobalState[]>`
    SELECT
      (SELECT count(*) FROM crewcast.users)::integer AS users,
      (SELECT count(*) FROM crewcast.subscriptions)::integer AS subscriptions,
      (SELECT count(*) FROM crewcast.brands)::integer AS brands,
      (SELECT count(*) FROM crewcast.brand_locations)::integer AS locations,
      (SELECT count(*) FROM crewcast.search_jobs)::integer AS jobs,
      (
        SELECT count(*)
        FROM crewcast.users
        WHERE email LIKE ${SYNTHETIC_EMAIL_PATTERN}
      )::integer AS "syntheticUsers"
  `;
  assert.equal(rows.length, 1);
  return rows[0];
}

async function assertMigration(): Promise<void> {
  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/0012_brand_location_management_lifecycle.up.sql',
  );
  const expectedChecksum = createHash('sha256')
    .update(readFileSync(migrationPath))
    .digest('hex');
  const rows = await fixtureSql<{ checksum: string; constraints: number; triggers: number }[]>`
    SELECT
      migrations.checksum_sha256 AS checksum,
      (
        SELECT count(*)
        FROM pg_constraint
        WHERE connamespace = 'crewcast'::regnamespace
          AND conname = ANY(ARRAY[
            'brands_legacy_import_default_check',
            'brand_locations_legacy_import_default_check'
          ]::text[])
      )::integer AS constraints,
      (
        SELECT count(*)
        FROM pg_trigger
        WHERE tgrelid = ANY(ARRAY[
          'crewcast.brands'::regclass,
          'crewcast.brand_locations'::regclass
        ])
          AND tgname = ANY(ARRAY[
            'brands_legacy_import_marker_immutable',
            'brand_locations_legacy_import_marker_immutable'
          ]::text[])
          AND NOT tgisinternal
      )::integer AS triggers
    FROM crewcast.schema_migrations AS migrations
    WHERE migrations.version = '0012'
  `;
  assert.equal(rows.length, 1, 'Migration 0012 must be applied exactly once.');
  assert.equal(rows[0].checksum, expectedChecksum, 'Migration 0012 checksum drifted.');
  assert.equal(rows[0].constraints, 0, 'Legacy lifecycle checks still block management.');
  assert.equal(rows[0].triggers, 2, 'Immutable import markers are not fully protected.');
}

async function createFixture(
  label: string,
  plan: Plan,
  status: SubscriptionStatus = 'active',
): Promise<Fixture> {
  const token = randomUUID().replaceAll('-', '');
  const email = `codex-management-${label}-${token}@example.invalid`;
  return fixtureSql.begin(async (transaction) => {
    const users = await transaction<{ id: number }[]>`
      INSERT INTO crewcast.users (
        email,
        name,
        is_onboarded,
        onboarding_step,
        has_subscription,
        plan,
        auto_scan_enabled
      ) VALUES (
        ${email},
        'Management staging verification',
        true,
        8,
        true,
        ${plan},
        true
      )
      RETURNING id
    `;
    assert.equal(users.length, 1);
    const accountId = users[0].id;
    await transaction`
      INSERT INTO crewcast.subscriptions (
        user_id,
        stripe_subscription_id,
        plan,
        status,
        billing_interval,
        first_payment_at,
        next_auto_scan_at
      ) VALUES (
        ${accountId},
        ${`sub_codex_management_${accountId}`},
        ${plan},
        ${status},
        'monthly',
        statement_timestamp(),
        statement_timestamp() + INTERVAL '3 days'
      )
    `;
    const brands = await transaction<{ id: string }[]>`
      INSERT INTO crewcast.brands (
        user_id, name, normalized_domain, affiliate_types, is_default
      ) VALUES (
        ${accountId},
        ${`Management ${label}`},
        ${`management-${label}-${token}.example`},
        ARRAY['Web']::text[],
        true
      )
      RETURNING id::text AS id
    `;
    const brandId = brands[0].id;
    const locations = await transaction<{ id: string }[]>`
      INSERT INTO crewcast.brand_locations (
        user_id,
        brand_id,
        country_code,
        language_code,
        topics,
        competitors,
        is_default,
        auto_scan_enabled,
        next_auto_scan_at
      ) VALUES (
        ${accountId},
        ${brandId}::bigint,
        'gb',
        'en',
        ARRAY['affiliate software']::text[],
        ARRAY[]::text[],
        true,
        true,
        statement_timestamp() + INTERVAL '3 days'
      )
      RETURNING id::text AS id
    `;
    return {
      accountId,
      email,
      plan,
      brandId,
      locationId: locations[0].id,
    };
  });
}

function errorCode(error: unknown): string | null {
  const candidate = error as ManagementErrorShape;
  return typeof candidate?.code === 'string' ? candidate.code : null;
}

async function expectManagementError(
  operation: () => Promise<unknown>,
  code: string,
  status: number,
): Promise<void> {
  await assert.rejects(operation, (error: unknown) => {
    const candidate = error as ManagementErrorShape;
    assert.equal(candidate.code, code);
    assert.equal(candidate.status, status);
    return true;
  });
}

async function createActiveJob(fixture: Fixture, locationId: string): Promise<number> {
  const requestId = randomUUID();
  const rows = await fixtureSql<{ id: number }[]>`
    INSERT INTO crewcast.search_jobs (
      user_id,
      keyword,
      sources,
      apify_run_id,
      status,
      enrichment_status,
      enrichment_run_ids,
      raw_results,
      user_settings,
      brand_id,
      brand_location_id,
      settings_snapshot,
      request_id
    ) VALUES (
      ${fixture.accountId},
      'management archive lock',
      ARRAY['Web']::text[],
      ${`synthetic-management-${requestId}`},
      'running',
      NULL,
      '{}'::jsonb,
      NULL,
      ${{
        targetCountry: 'United Kingdom',
        targetLanguage: 'English',
        userBrand: 'management.example',
      }}::jsonb,
      ${fixture.brandId}::bigint,
      ${locationId}::bigint,
      ${{
        version: 1,
        brand: { id: fixture.brandId, name: 'Management', normalizedDomain: 'management.example' },
        location: {
          id: locationId,
          countryCode: 'gb',
          countryName: 'United Kingdom',
          languageCode: 'en',
          languageName: 'English',
        },
        search: {
          keywords: ['management archive lock'],
          competitors: [],
          sources: ['Web'],
          requestId,
        },
      }}::jsonb,
      ${requestId}::uuid
    )
    RETURNING id
  `;
  return rows[0].id;
}

async function verifyProLocationLimitAndLifecycle(
  fixture: Fixture,
  management: typeof import('../src/lib/brand-locations/management-postgres'),
  domain: typeof import('../src/lib/brand-locations/management'),
  schemas: typeof import('../src/lib/brand-locations/management-input'),
): Promise<void> {
  const markets = [
    ['de', 'de'], ['us', 'en'], ['fr', 'fr'], ['nl', 'nl'], ['es', 'es'],
    ['it', 'it'], ['pt', 'pt'], ['se', 'sv'], ['dk', 'da'], ['no', 'no'],
    ['fi', 'fi'], ['pl', 'pl'], ['cz', 'cs'], ['jp', 'ja'], ['kr', 'ko'],
  ] as const;
  const attempts = await Promise.all(markets.map(async ([countryCode, languageCode]) => {
    try {
      const input = schemas.createLocationSchema.parse({
        countryCode,
        languageCode,
        topics: [`topic-${countryCode}`],
        competitors: [],
      });
      return await management.createManagedLocation(
        fixture.accountId,
        fixture.brandId,
        domain.prepareLocationWrite(input),
        fixtureSql,
      );
    } catch (error) {
      return error;
    }
  }));
  const created = attempts.filter(
    (result): result is Awaited<ReturnType<typeof management.createManagedLocation>> =>
      typeof result === 'object' && result !== null && 'id' in result,
  );
  assert.equal(created.length, 1, 'Concurrent Pro writes must create exactly one extra location.');
  const rejectedCodes = attempts
    .filter((result) => !created.includes(result as typeof created[number]))
    .map((result) => {
      const code = errorCode(result) ?? 'NO_MANAGEMENT_ERROR_CODE';
      const message = result instanceof Error ? result.message : 'non-Error rejection';
      return `${code}:${message}`;
    });
  assert.ok(
    rejectedCodes.every((rejection) => rejection.startsWith('PLAN_LIMIT_REACHED:')),
    `Every losing concurrent Pro write must fail as a plan-limit response. Received: ${rejectedCodes.join(', ')}`,
  );

  const extra = created[0];
  assert.equal(extra.autoScanEnabled, true, 'A new active location must inherit account auto-scan.');
  assert.ok(extra.nextAutoScanAt, 'A paid scheduled account must schedule its new location.');

  const portfolio = await management.listManagedPortfolio(fixture.accountId, false, fixtureSql);
  assert.equal(portfolio.capacity?.plan, 'pro');
  assert.equal(portfolio.capacity?.maxLocationsPerAccount, 2);
  assert.equal(portfolio.capacity?.activeLocations, 2);

  const locationPatch = schemas.updateLocationSchema.parse({
    countryCode: 'ca',
    languageCode: 'en',
    topics: ['updated topic'],
    competitors: ['updated.example'],
  });
  const updated = await management.updateManagedLocation(
    fixture.accountId,
    extra.id,
    domain.prepareLocationPatch(locationPatch),
    fixtureSql,
  );
  assert.deepEqual(updated.topics, ['updated topic']);
  assert.equal(updated.countryCode, 'ca');

  const archived = await management.archiveManagedLocation(
    fixture.accountId,
    extra.id,
    fixtureSql,
  );
  assert.ok(archived.archivedAt);
  assert.equal(archived.autoScanEnabled, false);
  assert.equal(archived.nextAutoScanAt, null);
  const restored = await management.restoreManagedLocation(
    fixture.accountId,
    extra.id,
    fixtureSql,
  );
  assert.equal(restored.archivedAt, null);
  assert.equal(restored.autoScanEnabled, true);

  await fixtureSql`
    UPDATE crewcast.subscriptions
    SET status = 'canceled'
    WHERE user_id = ${fixture.accountId}
  `;
  await management.archiveManagedLocation(fixture.accountId, extra.id, fixtureSql);
  await expectManagementError(
    () => management.restoreManagedLocation(fixture.accountId, extra.id, fixtureSql),
    'SUBSCRIPTION_REQUIRED',
    402,
  );
  await expectManagementError(
    () => management.createManagedLocation(
      fixture.accountId,
      fixture.brandId,
      domain.prepareLocationWrite(schemas.createLocationSchema.parse({
        countryCode: 'au',
        languageCode: 'en',
      })),
      fixtureSql,
    ),
    'SUBSCRIPTION_REQUIRED',
    402,
  );
  const canceledPortfolio = await management.listManagedPortfolio(
    fixture.accountId,
    true,
    fixtureSql,
  );
  assert.equal(canceledPortfolio.capacity, null);
  await fixtureSql`
    UPDATE crewcast.subscriptions
    SET status = 'active'
    WHERE user_id = ${fixture.accountId}
  `;
  await management.restoreManagedLocation(fixture.accountId, extra.id, fixtureSql);

  const oldDefault = await management.archiveManagedLocation(
    fixture.accountId,
    fixture.locationId,
    fixtureSql,
  );
  assert.equal(oldDefault.isDefault, false);
  const afterReplacement = await management.listManagedPortfolio(
    fixture.accountId,
    true,
    fixtureSql,
  );
  const activeLocations = afterReplacement.brands
    .flatMap((brand) => brand.locations)
    .filter((location) => location.archivedAt === null);
  assert.equal(activeLocations.length, 1);
  assert.equal(activeLocations[0].id, extra.id);
  assert.equal(activeLocations[0].isDefault, true);

  const reactivatedOld = await management.restoreManagedLocation(
    fixture.accountId,
    fixture.locationId,
    fixtureSql,
  );
  assert.equal(reactivatedOld.isDefault, false);
  const activeJobId = await createActiveJob(fixture, fixture.locationId);
  await expectManagementError(
    () => management.archiveManagedLocation(fixture.accountId, fixture.locationId, fixtureSql),
    'ACTIVE_SEARCH_CONFLICT',
    409,
  );
  await fixtureSql`
    UPDATE crewcast.search_jobs
    SET status = 'done', completed_at = statement_timestamp()
    WHERE id = ${activeJobId} AND user_id = ${fixture.accountId}
  `;
  await management.archiveManagedLocation(fixture.accountId, fixture.locationId, fixtureSql);
  await expectManagementError(
    () => management.archiveManagedLocation(fixture.accountId, extra.id, fixtureSql),
    'DEFAULT_CONTEXT_REQUIRED',
    409,
  );
}

async function verifyBusinessLimitsIsolationAndBrandLifecycle(
  business: Fixture,
  stranger: Fixture,
  management: typeof import('../src/lib/brand-locations/management-postgres'),
  domain: typeof import('../src/lib/brand-locations/management'),
  schemas: typeof import('../src/lib/brand-locations/management-input'),
): Promise<void> {
  const brandInput = (label: string, domainName: string) => domain.prepareBrandWrite(
    schemas.createBrandSchema.parse({ name: label, domain: domainName }),
  );
  const locationInput = (countryCode: string, languageCode: string) =>
    domain.prepareLocationWrite(schemas.createLocationSchema.parse({
      countryCode,
      languageCode,
      topics: [`business-${countryCode}`],
      competitors: [],
    }));

  const second = await management.createManagedBrand(
    business.accountId,
    brandInput('Second brand', 'second-management.example'),
    fixtureSql,
  );
  await expectManagementError(
    () => management.createManagedBrand(
      business.accountId,
      brandInput('Duplicate brand', 'https://www.second-management.example/path'),
      fixtureSql,
    ),
    'DUPLICATE_BRAND_DOMAIN',
    409,
  );
  const secondLocation = await management.createManagedLocation(
    business.accountId,
    second.id,
    locationInput('us', 'en'),
    fixtureSql,
  );
  await expectManagementError(
    () => management.createManagedLocation(
      business.accountId,
      second.id,
      locationInput('us', 'en'),
      fixtureSql,
    ),
    'DUPLICATE_LOCATION_MARKET',
    409,
  );

  const brandAttempts = await Promise.all(Array.from({ length: 15 }, async (_, index) => {
    try {
      return await management.createManagedBrand(
        business.accountId,
        brandInput(`Concurrent brand ${index}`, `management-brand-${index}.example`),
        fixtureSql,
      );
    } catch (error) {
      return error;
    }
  }));
  const createdBrands = brandAttempts.filter(
    (result): result is Awaited<ReturnType<typeof management.createManagedBrand>> =>
      typeof result === 'object' && result !== null && 'id' in result,
  );
  assert.equal(createdBrands.length, 3, 'Business must stop at five account-wide brands.');
  assert.equal(
    brandAttempts.filter((result) => errorCode(result) === 'PLAN_LIMIT_REACHED').length,
    12,
  );

  const locationAttempts = await Promise.all(createdBrands.map(async (brand, index) => {
    const markets = [['de', 'de'], ['fr', 'fr'], ['nl', 'nl']] as const;
    return management.createManagedLocation(
      business.accountId,
      brand.id,
      locationInput(...markets[index]),
      fixtureSql,
    );
  }));
  assert.equal(locationAttempts.length, 3);
  await expectManagementError(
    () => management.createManagedLocation(
      business.accountId,
      second.id,
      locationInput('ca', 'en'),
      fixtureSql,
    ),
    'PLAN_LIMIT_REACHED',
    403,
  );

  const brandPatch = schemas.updateBrandSchema.parse({
    name: 'Second brand updated',
    bio: 'Updated safely',
    affiliateTypes: ['Web', 'YouTube'],
  });
  const updatedBrand = await management.updateManagedBrand(
    business.accountId,
    second.id,
    domain.prepareBrandPatch(brandPatch),
    fixtureSql,
  );
  assert.equal(updatedBrand.name, 'Second brand updated');
  assert.deepEqual(updatedBrand.affiliateTypes, ['Web', 'YouTube']);

  await expectManagementError(
    () => management.updateManagedBrand(
      business.accountId,
      stranger.brandId,
      { name: 'Stolen brand' },
      fixtureSql,
    ),
    'BRAND_NOT_FOUND',
    404,
  );
  await expectManagementError(
    () => management.updateManagedLocation(
      business.accountId,
      stranger.locationId,
      { topics: ['stolen'] },
      fixtureSql,
    ),
    'LOCATION_NOT_FOUND',
    404,
  );
  await expectManagementError(
    () => management.archiveManagedLocation(
      business.accountId,
      stranger.locationId,
      fixtureSql,
    ),
    'LOCATION_NOT_FOUND',
    404,
  );

  // Simulate a historical import marker. Runtime lifecycle changes may archive
  // the row, but the provenance timestamp itself must remain immutable.
  await fixtureSql.begin(async (transaction) => {
    await transaction`
      UPDATE crewcast.brands
      SET legacy_imported_at = statement_timestamp()
      WHERE id = ${business.brandId}::bigint AND user_id = ${business.accountId}
    `;
    await transaction`
      UPDATE crewcast.brand_locations
      SET legacy_imported_at = statement_timestamp()
      WHERE id = ${business.locationId}::bigint AND user_id = ${business.accountId}
    `;
  });

  const archivedDefaultBrand = await management.archiveManagedBrand(
    business.accountId,
    business.brandId,
    fixtureSql,
  );
  assert.ok(archivedDefaultBrand.archivedAt);
  const archivedChildren = await fixtureSql<{ archived: boolean; enabled: boolean }[]>`
    SELECT archived_at IS NOT NULL AS archived, auto_scan_enabled AS enabled
    FROM crewcast.brand_locations
    WHERE id = ${business.locationId}::bigint AND user_id = ${business.accountId}
  `;
  assert.deepEqual(archivedChildren[0], { archived: true, enabled: false });

  const replacementPortfolio = await management.listManagedPortfolio(
    business.accountId,
    true,
    fixtureSql,
  );
  const replacementDefaults = replacementPortfolio.brands.filter(
    (brand) => brand.archivedAt === null && brand.isDefault,
  );
  assert.equal(replacementDefaults.length, 1);
  assert.notEqual(replacementDefaults[0].id, business.brandId);

  await management.restoreManagedBrand(business.accountId, business.brandId, fixtureSql);
  const brandOnlyRestore = await management.listManagedPortfolio(
    business.accountId,
    true,
    fixtureSql,
  );
  const restoredBrand = brandOnlyRestore.brands.find((brand) => brand.id === business.brandId);
  assert.ok(restoredBrand);
  assert.equal(restoredBrand.archivedAt, null);
  assert.ok(
    restoredBrand.locations.every((location) => location.archivedAt !== null),
    'Restoring a brand must not silently restore child locations or bypass their limit.',
  );
  await management.restoreManagedLocation(business.accountId, business.locationId, fixtureSql);

  await assert.rejects(
    fixtureSql`
      UPDATE crewcast.brands
      SET legacy_imported_at = NULL
      WHERE id = ${business.brandId}::bigint AND user_id = ${business.accountId}
    `,
    /legacy_imported_at cannot be changed after assignment/i,
  );
  await assert.rejects(
    fixtureSql`
      UPDATE crewcast.brand_locations
      SET legacy_imported_at = NULL
      WHERE id = ${business.locationId}::bigint AND user_id = ${business.accountId}
    `,
    /legacy_imported_at cannot be changed after assignment/i,
  );

  const finalPortfolio = await management.listManagedPortfolio(business.accountId, false, fixtureSql);
  assert.equal(finalPortfolio.capacity?.plan, 'business');
  assert.equal(finalPortfolio.capacity?.maxBrands, 5);
  assert.equal(finalPortfolio.capacity?.maxLocationsPerAccount, 5);
  assert.equal(finalPortfolio.capacity?.activeBrands, 5);
  assert.equal(finalPortfolio.capacity?.activeLocations, 5);
  assert.equal(secondLocation.archivedAt, null);
}

async function verifyRetainedHistorySafety(
  fixture: Fixture,
  management: typeof import('../src/lib/brand-locations/management-postgres'),
  domain: typeof import('../src/lib/brand-locations/management'),
  schemas: typeof import('../src/lib/brand-locations/management-input'),
): Promise<void> {
  const {
    maxRetainedBrandsPerAccount: brandLimit,
    maxRetainedLocationsPerAccount: locationLimit,
  } = domain.MANAGEMENT_RESOURCE_LIMITS;
  const counts = await fixtureSql<{ brands: number; locations: number }[]>`
    SELECT
      (SELECT count(*) FROM crewcast.brands
       WHERE user_id = ${fixture.accountId})::integer AS brands,
      (SELECT count(*) FROM crewcast.brand_locations
       WHERE user_id = ${fixture.accountId})::integer AS locations
  `;
  assert.equal(counts.length, 1);
  const brandsToSeed = brandLimit - 1 - counts[0].brands;
  const locationsToSeed = locationLimit - 1 - counts[0].locations;
  assert.ok(brandsToSeed >= 0 && locationsToSeed >= 0);

  // Seed archived history directly so the verifier can exercise the exact
  // application boundary without performing hundreds of network round trips.
  if (brandsToSeed > 0) {
    await fixtureSql`
      INSERT INTO crewcast.brands (
        user_id, name, normalized_domain, affiliate_types, is_default, archived_at
      )
      SELECT
        ${fixture.accountId},
        'Archived safety brand ' || series,
        NULL,
        ARRAY[]::text[],
        false,
        statement_timestamp()
      FROM generate_series(1, ${brandsToSeed}) AS series
    `;
  }
  if (locationsToSeed > 0) {
    await fixtureSql`
      INSERT INTO crewcast.brand_locations (
        user_id,
        brand_id,
        country_code,
        language_code,
        topics,
        competitors,
        is_default,
        auto_scan_enabled,
        archived_at
      )
      SELECT
        ${fixture.accountId},
        ${fixture.brandId}::bigint,
        'us',
        'en',
        ARRAY[]::text[],
        ARRAY[]::text[],
        false,
        false,
        statement_timestamp()
      FROM generate_series(1, ${locationsToSeed})
    `;
  }

  // Match the existing 15-request staging stress ceiling. A 20-request probe
  // produced five pooler-level XX000 failures before application logic.
  const brandAttempts = await Promise.all(Array.from({ length: 15 }, async (_, index) => {
    try {
      return await management.createManagedBrand(
        fixture.accountId,
        domain.prepareBrandWrite(schemas.createBrandSchema.parse({
          name: `Safety boundary brand ${index}`,
          domain: `safety-boundary-brand-${index}.example`,
        })),
        fixtureSql,
      );
    } catch (error) {
      return error;
    }
  }));
  const createdBrands = brandAttempts.filter(
    (result): result is Awaited<ReturnType<typeof management.createManagedBrand>> =>
      typeof result === 'object' && result !== null && 'id' in result,
  );
  assert.equal(createdBrands.length, 1, 'Exactly one concurrent brand create may fill the cap.');
  assert.deepEqual(
    brandAttempts
      .filter((result) => !(typeof result === 'object' && result !== null && 'id' in result))
      .map(errorCode)
      .sort(),
    Array.from({ length: 14 }, () => 'RETAINED_HISTORY_LIMIT_REACHED'),
    'Every losing brand create must fail at the retained-history boundary.',
  );

  const locationInput = domain.prepareLocationWrite(schemas.createLocationSchema.parse({
    countryCode: 'de',
    languageCode: 'de',
    topics: ['retained safety'],
    competitors: [],
  }));
  const locationAttempts = await Promise.all(Array.from({ length: 15 }, async () => {
    try {
      return await management.createManagedLocation(
        fixture.accountId,
        createdBrands[0].id,
        locationInput,
        fixtureSql,
      );
    } catch (error) {
      return error;
    }
  }));
  const createdLocations = locationAttempts.filter(
    (result): result is Awaited<ReturnType<typeof management.createManagedLocation>> =>
      typeof result === 'object' && result !== null && 'id' in result,
  );
  assert.equal(createdLocations.length, 1, 'Exactly one concurrent location create may fill the cap.');
  assert.deepEqual(
    locationAttempts
      .filter((result) => !(typeof result === 'object' && result !== null && 'id' in result))
      .map(errorCode)
      .sort(),
    Array.from({ length: 14 }, () => 'RETAINED_HISTORY_LIMIT_REACHED'),
    'Every losing location create must fail at the retained-history boundary.',
  );

  const cappedPortfolio = await management.listManagedPortfolio(
    fixture.accountId,
    true,
    fixtureSql,
  );
  assert.equal(cappedPortfolio.brands.length, brandLimit);
  assert.equal(
    cappedPortfolio.brands.flatMap((brand) => brand.locations).length,
    locationLimit,
  );

  // Archiving at the retained cap must remain usable, but it must not reopen
  // an unlimited create/archive cycle. Restore also remains usable because it
  // does not allocate a new retained row.
  await management.archiveManagedBrand(fixture.accountId, createdBrands[0].id, fixtureSql);
  await expectManagementError(
    () => management.createManagedLocation(
      fixture.accountId,
      fixture.brandId,
      locationInput,
      fixtureSql,
    ),
    'RETAINED_HISTORY_LIMIT_REACHED',
    409,
  );
  await management.restoreManagedBrand(fixture.accountId, createdBrands[0].id, fixtureSql);
  await management.restoreManagedLocation(fixture.accountId, createdLocations[0].id, fixtureSql);

  await expectManagementError(
    () => management.createManagedBrand(
      fixture.accountId,
      domain.prepareBrandWrite(schemas.createBrandSchema.parse({
        name: 'Beyond retained brand cap',
        domain: 'beyond-retained-brand-cap.example',
      })),
      fixtureSql,
    ),
    'RETAINED_HISTORY_LIMIT_REACHED',
    409,
  );
  await expectManagementError(
    () => management.createManagedLocation(
      fixture.accountId,
      fixture.brandId,
      locationInput,
      fixtureSql,
    ),
    'RETAINED_HISTORY_LIMIT_REACHED',
    409,
  );

  const overflowLocations = await fixtureSql<{ id: string }[]>`
    INSERT INTO crewcast.brand_locations (
      user_id,
      brand_id,
      country_code,
      language_code,
      topics,
      competitors,
      is_default,
      auto_scan_enabled,
      archived_at
    ) VALUES (
      ${fixture.accountId},
      ${fixture.brandId}::bigint,
      'fr',
      'fr',
      ARRAY[]::text[],
      ARRAY[]::text[],
      false,
      false,
      statement_timestamp()
    )
    RETURNING id::text AS id
  `;
  await expectManagementError(
    () => management.listManagedPortfolio(fixture.accountId, true, fixtureSql),
    'MANAGEMENT_INTEGRITY_ERROR',
    500,
  );
  await fixtureSql`
    DELETE FROM crewcast.brand_locations
    WHERE id = ${overflowLocations[0].id}::bigint AND user_id = ${fixture.accountId}
  `;

  const overflowBrands = await fixtureSql<{ id: string }[]>`
    INSERT INTO crewcast.brands (
      user_id, name, normalized_domain, affiliate_types, is_default, archived_at
    ) VALUES (
      ${fixture.accountId},
      'Overflow archived brand',
      NULL,
      ARRAY[]::text[],
      false,
      statement_timestamp()
    )
    RETURNING id::text AS id
  `;
  await expectManagementError(
    () => management.listManagedPortfolio(fixture.accountId, true, fixtureSql),
    'MANAGEMENT_INTEGRITY_ERROR',
    500,
  );
  await fixtureSql`
    DELETE FROM crewcast.brands
    WHERE id = ${overflowBrands[0].id}::bigint AND user_id = ${fixture.accountId}
  `;

  // Simulate a legacy/manual state that the guarded archive API no longer
  // permits: every brand and location is archived. The customer must still be
  // able to recover an explicit default brand, then its default location.
  await fixtureSql.begin(async (transaction) => {
    await transaction`
      UPDATE crewcast.brand_locations
      SET
        is_default = false,
        auto_scan_enabled = false,
        next_auto_scan_at = NULL,
        scan_claim_token = NULL,
        scan_claimed_at = NULL,
        scan_lease_expires_at = NULL,
        archived_at = COALESCE(archived_at, statement_timestamp())
      WHERE user_id = ${fixture.accountId}
    `;
    await transaction`
      UPDATE crewcast.brands
      SET
        is_default = false,
        archived_at = COALESCE(archived_at, statement_timestamp())
      WHERE user_id = ${fixture.accountId}
    `;
  });
  const recoveredBrand = await management.restoreManagedBrand(
    fixture.accountId,
    fixture.brandId,
    fixtureSql,
  );
  assert.equal(recoveredBrand.isDefault, true);
  const recoveredLocation = await management.restoreManagedLocation(
    fixture.accountId,
    fixture.locationId,
    fixtureSql,
  );
  assert.equal(recoveredLocation.isDefault, true);
  const recoveredPortfolio = await management.listManagedPortfolio(
    fixture.accountId,
    false,
    fixtureSql,
  );
  assert.equal(recoveredPortfolio.brands.length, 1);
  assert.equal(recoveredPortfolio.brands[0].id, fixture.brandId);
  assert.equal(recoveredPortfolio.brands[0].locations.length, 1);
  assert.equal(recoveredPortfolio.brands[0].locations[0].id, fixture.locationId);
}

async function cleanup(fixtures: readonly Fixture[]): Promise<void> {
  if (fixtures.length === 0) return;
  const accountIds = fixtures.map(({ accountId }) => accountId);
  await fixtureSql.begin(async (transaction) => {
    await transaction`
      DELETE FROM crewcast.search_jobs
      WHERE user_id = ANY(${accountIds}::integer[])
    `;
    await transaction`
      DELETE FROM crewcast.brand_locations
      WHERE user_id = ANY(${accountIds}::integer[])
    `;
    await transaction`
      DELETE FROM crewcast.brands
      WHERE user_id = ANY(${accountIds}::integer[])
    `;
    await transaction`
      DELETE FROM crewcast.subscriptions
      WHERE user_id = ANY(${accountIds}::integer[])
    `;
    await transaction`
      DELETE FROM crewcast.users
      WHERE id = ANY(${accountIds}::integer[])
        AND email LIKE ${SYNTHETIC_EMAIL_PATTERN}
    `;
  });
}

async function closeApplicationSql(): Promise<void> {
  const imported = await import('../src/lib/db');
  const exports = (imported.default ?? imported) as unknown as {
    sql: { end(options?: { timeout?: number }): Promise<void> };
  };
  await exports.sql.end({ timeout: 10 });
}

async function main(): Promise<void> {
  await assertMigration();
  const before = await globalState(fixtureSql);
  assert.equal(before.syntheticUsers, 0, 'A previous management test left synthetic users behind.');
  const fixtures: Fixture[] = [];
  try {
    const management = await import('../src/lib/brand-locations/management-postgres');
    const domain = await import('../src/lib/brand-locations/management');
    const schemas = await import('../src/lib/brand-locations/management-input');

    const pro = await createFixture('pro', 'pro');
    fixtures.push(pro);
    const business = await createFixture('business', 'business');
    fixtures.push(business);
    const stranger = await createFixture('stranger', 'business');
    fixtures.push(stranger);
    const retainedSafety = await createFixture('retained-safety', 'business');
    fixtures.push(retainedSafety);

    await verifyProLocationLimitAndLifecycle(pro, management, domain, schemas);
    await verifyBusinessLimitsIsolationAndBrandLifecycle(
      business,
      stranger,
      management,
      domain,
      schemas,
    );
    await verifyRetainedHistorySafety(retainedSafety, management, domain, schemas);
  } finally {
    try {
      await cleanup(fixtures);
    } finally {
      try {
        await closeApplicationSql();
      } finally {
        await fixtureSql.end({ timeout: 10 });
      }
    }
  }

  const verificationSql = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 5,
  });
  try {
    const after = await globalState(verificationSql);
    assert.deepEqual(after, before, 'Management staging verification did not restore exact row counts.');
  } finally {
    await verificationSql.end({ timeout: 5 });
  }

  console.log(
    'Brand/location management staging verification passed: exact migration, Pro 2-location and Business 5-location account limits, Business 5-brand limit, concurrent contention, duplicate rejection, cross-account isolation, retained-history abuse ceilings, bounded consistent-snapshot archive reads, safe archive/restore at the ceiling, all-archived legacy recovery, safe updates, active-search archive blocking, default replacement, subscription downgrade behavior, independent child restore, immutable import provenance, inherited auto-scan state, exact cleanup and zero residue.',
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
