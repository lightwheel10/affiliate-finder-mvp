import {
  completeAccountOnboarding,
  OnboardingError,
  type DefaultBrandWrite,
  type DefaultLocationWrite,
  type LockedOnboardingAccount,
  type OnboardingBrand,
  type OnboardingLocation,
  type OnboardingStore,
  type OnboardingSubscription,
  type OnboardingSubscriptionStatus,
  type OnboardingTimestamp,
  type OnboardingTransaction,
} from '@/lib/brand-locations/onboarding';
import type { DbUser } from '@/lib/db';
import type { CompleteOnboardingInput } from '@/lib/users/profile-input';

export interface OnboardingSqlExecutor {
  <T extends object = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<readonly T[]>;
}

export interface OnboardingDatabase extends OnboardingSqlExecutor {
  begin<T>(
    operation: (transaction: OnboardingSqlExecutor) => Promise<T>,
  ): Promise<T>;
}

interface AccountRow {
  id: unknown;
  bio: unknown;
  auto_scan_enabled: unknown;
}

interface IdRow {
  id: unknown;
}

interface ScheduleRow {
  stripe_subscription_id: unknown;
  status: unknown;
  last_auto_scan_at: unknown;
  next_auto_scan_at: unknown;
}

interface EntitlementRow {
  user_id: unknown;
  brand_id: unknown;
  brand_location_id: unknown;
}

function integrityError(message: string): OnboardingError {
  return new OnboardingError('ONBOARDING_INTEGRITY_ERROR', 500, message);
}

function oneOrNull<T>(rows: readonly T[], label: string): T | null {
  if (rows.length > 1) {
    throw integrityError(`${label} returned more than one row.`);
  }
  return rows[0] ?? null;
}

function readAccountId(value: unknown): number {
  const accountId =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^[1-9][0-9]*$/.test(value)
        ? Number(value)
        : Number.NaN;
  if (!Number.isSafeInteger(accountId) || accountId <= 0) {
    throw integrityError('Locked account ID is not a positive safe integer.');
  }
  return accountId;
}

function readDatabaseId(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value)) {
    throw integrityError(`${label} is not a positive PostgreSQL bigint.`);
  }
  return value;
}

function readNullableString(value: unknown, label: string): string | null {
  if (value === null || typeof value === 'string') return value;
  throw integrityError(`${label} is not a nullable string.`);
}

function readSubscriptionStatus(value: unknown): OnboardingSubscriptionStatus {
  if (
    value !== 'trialing'
    && value !== 'active'
    && value !== 'canceled'
    && value !== 'past_due'
    && value !== 'incomplete'
  ) {
    throw integrityError('Subscription status is invalid.');
  }
  return value;
}

function readBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') {
    throw integrityError(`${label} is not a boolean.`);
  }
  return value;
}

function readTimestamp(value: unknown, label: string): OnboardingTimestamp | null {
  if (value === null || typeof value === 'string' || value instanceof Date) {
    return value;
  }
  throw integrityError(`${label} is not a nullable timestamp.`);
}

function readIdRow(row: IdRow | null, label: string): string {
  if (!row) throw integrityError(`${label} did not return a row.`);
  return readDatabaseId(row.id, `${label} ID`);
}

function createTransaction(
  executor: OnboardingSqlExecutor,
): OnboardingTransaction<DbUser> {
  return {
    async lockAccount(accountId): Promise<LockedOnboardingAccount | null> {
      const rows = await executor<AccountRow>`
        SELECT id, bio, auto_scan_enabled
        FROM crewcast.users
        WHERE id = ${accountId}
        FOR UPDATE
      `;
      const row = oneOrNull(rows, 'Account lock');
      if (!row) return null;
      return {
        id: readAccountId(row.id),
        bio: readNullableString(row.bio, 'Account bio'),
        autoScanEnabled: readBoolean(
          row.auto_scan_enabled,
          'Account auto_scan_enabled',
        ),
      };
    },

    async readSubscription(
      accountId,
    ): Promise<OnboardingSubscription | null> {
      const rows = await executor<ScheduleRow>`
        SELECT
          stripe_subscription_id,
          status,
          last_auto_scan_at,
          next_auto_scan_at
        FROM crewcast.subscriptions
        WHERE user_id = ${accountId}
        ORDER BY id
        LIMIT 2
        FOR UPDATE
      `;
      const row = oneOrNull(rows, 'Subscription schedule lookup');
      if (!row) return null;
      return {
        stripeSubscriptionId: readNullableString(
          row.stripe_subscription_id,
          'Subscription Stripe ID',
        ),
        status: readSubscriptionStatus(row.status),
        lastAutoScanAt: readTimestamp(
          row.last_auto_scan_at,
          'Subscription last_auto_scan_at',
        ),
        nextAutoScanAt: readTimestamp(
          row.next_auto_scan_at,
          'Subscription next_auto_scan_at',
        ),
      };
    },

    async findDefaultBrand(accountId): Promise<OnboardingBrand | null> {
      const rows = await executor<IdRow>`
        SELECT id::text AS id
        FROM crewcast.brands
        WHERE user_id = ${accountId}
          AND archived_at IS NULL
          AND is_default
        ORDER BY id
        LIMIT 2
        FOR UPDATE
      `;
      const row = oneOrNull(rows, 'Default brand lookup');
      return row
        ? { id: readDatabaseId(row.id, 'Default brand ID') }
        : null;
    },

    async createDefaultBrand(input: DefaultBrandWrite): Promise<OnboardingBrand> {
      const rows = await executor<IdRow>`
        INSERT INTO crewcast.brands (
          user_id,
          name,
          normalized_domain,
          bio,
          affiliate_types,
          is_default
        )
        VALUES (
          ${input.accountId},
          ${input.name},
          ${input.normalizedDomain},
          ${input.bio},
          ${input.affiliateTypes},
          true
        )
        RETURNING id::text AS id
      `;
      return { id: readIdRow(oneOrNull(rows, 'Default brand insert'), 'Default brand insert') };
    },

    async updateDefaultBrand(
      brandId: string,
      input: DefaultBrandWrite,
    ): Promise<OnboardingBrand> {
      const rows = await executor<IdRow>`
        UPDATE crewcast.brands
        SET
          name = ${input.name},
          normalized_domain = ${input.normalizedDomain},
          bio = ${input.bio},
          affiliate_types = ${input.affiliateTypes}
        WHERE id = ${brandId}::bigint
          AND user_id = ${input.accountId}
          AND archived_at IS NULL
          AND is_default
          AND (
            name IS DISTINCT FROM ${input.name}
            OR normalized_domain IS DISTINCT FROM ${input.normalizedDomain}
            OR bio IS DISTINCT FROM ${input.bio}
            OR affiliate_types IS DISTINCT FROM ${input.affiliateTypes}
          )
        RETURNING id::text AS id
      `;
      if (rows.length === 1) return { id: readDatabaseId(rows[0].id, 'Default brand ID') };
      if (rows.length > 1) throw integrityError('Default brand update returned more than one row.');

      const unchanged = await executor<IdRow>`
        SELECT id::text AS id
        FROM crewcast.brands
        WHERE id = ${brandId}::bigint
          AND user_id = ${input.accountId}
          AND archived_at IS NULL
          AND is_default
        FOR UPDATE
      `;
      return {
        id: readIdRow(
          oneOrNull(unchanged, 'Unchanged default brand lookup'),
          'Unchanged default brand lookup',
        ),
      };
    },

    async findDefaultLocation(
      accountId,
      brandId,
    ): Promise<OnboardingLocation | null> {
      const rows = await executor<IdRow>`
        SELECT id::text AS id
        FROM crewcast.brand_locations
        WHERE user_id = ${accountId}
          AND brand_id = ${brandId}::bigint
          AND archived_at IS NULL
          AND is_default
        ORDER BY id
        LIMIT 2
        FOR UPDATE
      `;
      const row = oneOrNull(rows, 'Default location lookup');
      return row
        ? { id: readDatabaseId(row.id, 'Default location ID') }
        : null;
    },

    async createDefaultLocation(
      input: DefaultLocationWrite,
    ): Promise<OnboardingLocation> {
      const rows = await executor<IdRow>`
        INSERT INTO crewcast.brand_locations (
          user_id,
          brand_id,
          country_code,
          language_code,
          topics,
          competitors,
          is_default,
          auto_scan_enabled,
          last_auto_scan_at,
          next_auto_scan_at
        )
        VALUES (
          ${input.accountId},
          ${input.brandId}::bigint,
          ${input.countryCode},
          ${input.languageCode},
          ${input.topics},
          ${input.competitors},
          true,
          ${input.autoScanEnabled},
          ${input.schedule.lastAutoScanAt},
          ${input.schedule.nextAutoScanAt}
        )
        RETURNING id::text AS id
      `;
      return {
        id: readIdRow(
          oneOrNull(rows, 'Default location insert'),
          'Default location insert',
        ),
      };
    },

    async updateDefaultLocation(
      locationId: string,
      input: DefaultLocationWrite,
    ): Promise<OnboardingLocation> {
      const rows = await executor<IdRow>`
        UPDATE crewcast.brand_locations
        SET
          country_code = ${input.countryCode},
          language_code = ${input.languageCode},
          topics = ${input.topics},
          competitors = ${input.competitors}
        WHERE id = ${locationId}::bigint
          AND user_id = ${input.accountId}
          AND brand_id = ${input.brandId}::bigint
          AND archived_at IS NULL
          AND is_default
          AND (
            country_code IS DISTINCT FROM ${input.countryCode}
            OR language_code IS DISTINCT FROM ${input.languageCode}
            OR topics IS DISTINCT FROM ${input.topics}
            OR competitors IS DISTINCT FROM ${input.competitors}
          )
        RETURNING id::text AS id
      `;
      if (rows.length === 1) {
        return { id: readDatabaseId(rows[0].id, 'Default location ID') };
      }
      if (rows.length > 1) {
        throw integrityError('Default location update returned more than one row.');
      }

      const unchanged = await executor<IdRow>`
        SELECT id::text AS id
        FROM crewcast.brand_locations
        WHERE id = ${locationId}::bigint
          AND user_id = ${input.accountId}
          AND brand_id = ${input.brandId}::bigint
          AND archived_at IS NULL
          AND is_default
        FOR UPDATE
      `;
      return {
        id: readIdRow(
          oneOrNull(unchanged, 'Unchanged default location lookup'),
          'Unchanged default location lookup',
        ),
      };
    },

    async updateLegacyProfile(accountId, input): Promise<DbUser | null> {
      const rows = await executor<DbUser>`
        UPDATE crewcast.users
        SET
          name = ${input.name},
          role = ${input.role},
          brand = ${input.brand},
          target_country = ${input.targetCountry},
          target_language = ${input.targetLanguage},
          competitors = ${input.competitors},
          topics = ${input.topics},
          affiliate_types = ${input.affiliateTypes},
          is_onboarded = true,
          updated_at = NOW()
        WHERE id = ${accountId}
          AND (
            name IS DISTINCT FROM ${input.name}
            OR role IS DISTINCT FROM ${input.role}
            OR brand IS DISTINCT FROM ${input.brand}
            OR target_country IS DISTINCT FROM ${input.targetCountry}
            OR target_language IS DISTINCT FROM ${input.targetLanguage}
            OR competitors IS DISTINCT FROM ${input.competitors}
            OR topics IS DISTINCT FROM ${input.topics}
            OR affiliate_types IS DISTINCT FROM ${input.affiliateTypes}
            OR NOT is_onboarded
          )
        RETURNING *
      `;
      if (rows.length === 1) return rows[0];
      if (rows.length > 1) throw integrityError('Account update returned more than one row.');

      const unchanged = await executor<DbUser>`
        SELECT *
        FROM crewcast.users
        WHERE id = ${accountId}
        FOR UPDATE
      `;
      return oneOrNull(unchanged, 'Unchanged account lookup');
    },

    async grantOnboardingSearchEntitlement(input): Promise<void> {
      await executor`
        INSERT INTO crewcast.onboarding_search_entitlements (
          user_id,
          brand_id,
          brand_location_id
        )
        VALUES (
          ${input.accountId},
          ${input.brandId}::bigint,
          ${input.brandLocationId}::bigint
        )
        ON CONFLICT (user_id) DO NOTHING
      `;

      const rows = await executor<EntitlementRow>`
        SELECT
          user_id,
          brand_id::text AS brand_id,
          brand_location_id::text AS brand_location_id
        FROM crewcast.onboarding_search_entitlements
        WHERE user_id = ${input.accountId}
        FOR UPDATE
      `;
      const row = oneOrNull(rows, 'Onboarding-search entitlement lookup');
      if (
        !row
        || readAccountId(row.user_id) !== input.accountId
        || readDatabaseId(row.brand_id, 'Entitlement brand ID') !== input.brandId
        || readDatabaseId(
          row.brand_location_id,
          'Entitlement brand location ID',
        ) !== input.brandLocationId
      ) {
        throw integrityError(
          'The onboarding-search entitlement does not match the default brand location.',
        );
      }
    },
  };
}

export function createPostgresOnboardingStore(
  database: OnboardingDatabase,
): OnboardingStore<DbUser> {
  return {
    transaction: (operation) =>
      database.begin((transaction) =>
        operation(createTransaction(transaction)),
      ),
  };
}

export function completePostgresAccountOnboarding(
  accountId: number,
  input: CompleteOnboardingInput,
  database: OnboardingDatabase,
) {
  return completeAccountOnboarding(
    accountId,
    input,
    createPostgresOnboardingStore(database),
  );
}
