import { normalizeBrandDomain } from '@/lib/brands/domain';
import {
  getMarketCountry,
  getMarketLanguage,
} from '@/lib/markets/catalog';
import type { CompleteOnboardingInput } from '@/lib/users/profile-input';

export type OnboardingErrorCode =
  | 'INVALID_ACCOUNT_ID'
  | 'INVALID_BRAND_DOMAIN'
  | 'UNSUPPORTED_MARKET'
  | 'ACCOUNT_NOT_FOUND'
  | 'SUBSCRIPTION_REQUIRED'
  | 'ONBOARDING_INTEGRITY_ERROR';

export class OnboardingError extends Error {
  constructor(
    public readonly code: OnboardingErrorCode,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'OnboardingError';
  }
}

export interface PreparedOnboardingInput extends CompleteOnboardingInput {
  normalizedDomain: string;
  countryCode: string;
  languageCode: string;
}

export interface LockedOnboardingAccount {
  id: number;
  bio: string | null;
  autoScanEnabled: boolean;
}

export type OnboardingTimestamp = string | Date;

export type OnboardingSubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'canceled'
  | 'past_due'
  | 'incomplete';

export interface OnboardingSubscription {
  stripeSubscriptionId: string | null;
  status: OnboardingSubscriptionStatus;
  lastAutoScanAt: OnboardingTimestamp | null;
  nextAutoScanAt: OnboardingTimestamp | null;
}

export interface OnboardingBrand {
  id: string;
}

export interface OnboardingLocation {
  id: string;
}

export interface DefaultBrandWrite {
  accountId: number;
  name: string;
  normalizedDomain: string;
  bio: string | null;
  affiliateTypes: readonly string[];
}

export interface DefaultLocationWrite {
  accountId: number;
  brandId: string;
  countryCode: string;
  languageCode: string;
  topics: readonly string[];
  competitors: readonly string[];
  autoScanEnabled: boolean;
  schedule: Pick<
    OnboardingSubscription,
    'lastAutoScanAt' | 'nextAutoScanAt'
  >;
}

export interface OnboardingTransaction<User> {
  lockAccount(accountId: number): Promise<LockedOnboardingAccount | null>;
  readSubscription(
    accountId: number,
  ): Promise<OnboardingSubscription | null>;
  findDefaultBrand(accountId: number): Promise<OnboardingBrand | null>;
  createDefaultBrand(input: DefaultBrandWrite): Promise<OnboardingBrand>;
  updateDefaultBrand(
    brandId: string,
    input: DefaultBrandWrite,
  ): Promise<OnboardingBrand>;
  findDefaultLocation(
    accountId: number,
    brandId: string,
  ): Promise<OnboardingLocation | null>;
  createDefaultLocation(
    input: DefaultLocationWrite,
  ): Promise<OnboardingLocation>;
  updateDefaultLocation(
    locationId: string,
    input: DefaultLocationWrite,
  ): Promise<OnboardingLocation>;
  updateLegacyProfile(
    accountId: number,
    input: PreparedOnboardingInput,
  ): Promise<User | null>;
  grantOnboardingSearchEntitlement(input: {
    accountId: number;
    brandId: string;
    brandLocationId: string;
  }): Promise<void>;
}

export interface OnboardingStore<User> {
  transaction<T>(
    operation: (transaction: OnboardingTransaction<User>) => Promise<T>,
  ): Promise<T>;
}

export interface CompleteOnboardingResult<User> {
  user: User;
  brandId: string;
  brandLocationId: string;
  createdBrand: boolean;
  createdLocation: boolean;
}

function integrityError(message: string): OnboardingError {
  return new OnboardingError('ONBOARDING_INTEGRITY_ERROR', 500, message);
}

function assertAccountId(accountId: number): void {
  if (!Number.isSafeInteger(accountId) || accountId <= 0) {
    throw new OnboardingError(
      'INVALID_ACCOUNT_ID',
      500,
      'Authenticated account ID must be a positive safe integer.',
    );
  }
}

function assertDatabaseId(value: string, label: string): string {
  if (!/^[1-9][0-9]*$/.test(value)) {
    throw integrityError(`${label} is not a positive PostgreSQL bigint.`);
  }
  return value;
}

export function prepareOnboardingInput(
  input: CompleteOnboardingInput,
): PreparedOnboardingInput {
  const normalizedDomain = normalizeBrandDomain(input.brand);
  if (!normalizedDomain) {
    throw new OnboardingError(
      'INVALID_BRAND_DOMAIN',
      400,
      'Brand must contain a valid public website domain.',
    );
  }

  const country = getMarketCountry(input.targetCountry);
  const language = getMarketLanguage(input.targetLanguage);
  if (!country || !language) {
    throw new OnboardingError(
      'UNSUPPORTED_MARKET',
      400,
      'Country and language must come from the supported market catalogue.',
    );
  }

  return {
    ...input,
    competitors: [...input.competitors],
    topics: [...input.topics],
    affiliateTypes: [...input.affiliateTypes],
    normalizedDomain,
    countryCode: country.isoCode,
    languageCode: language.isoCode,
  };
}

export async function completeAccountOnboarding<User>(
  accountId: number,
  input: CompleteOnboardingInput,
  store: OnboardingStore<User>,
): Promise<CompleteOnboardingResult<User>> {
  assertAccountId(accountId);
  const prepared = prepareOnboardingInput(input);

  return store.transaction(async (transaction) => {
    const account = await transaction.lockAccount(accountId);
    if (!account) {
      throw new OnboardingError(
        'ACCOUNT_NOT_FOUND',
        404,
        'The authenticated application account no longer exists.',
      );
    }
    if (account.id !== accountId) {
      throw integrityError('The locked account does not match the authenticated account.');
    }

    const subscription = await transaction.readSubscription(accountId);
    if (
      !subscription
      || !subscription.stripeSubscriptionId
      || !['active', 'trialing'].includes(subscription.status)
    ) {
      throw new OnboardingError(
        'SUBSCRIPTION_REQUIRED',
        402,
        'An active or trialing subscription is required to complete onboarding.',
      );
    }

    const brandWrite: DefaultBrandWrite = {
      accountId,
      name: prepared.brand,
      normalizedDomain: prepared.normalizedDomain,
      bio: account.bio,
      affiliateTypes: prepared.affiliateTypes,
    };
    const existingBrand = await transaction.findDefaultBrand(accountId);
    const brand = existingBrand
      ? await transaction.updateDefaultBrand(existingBrand.id, brandWrite)
      : await transaction.createDefaultBrand(brandWrite);
    const brandId = assertDatabaseId(brand.id, 'Default brand ID');

    const existingLocation = await transaction.findDefaultLocation(
      accountId,
      brandId,
    );
    const schedule = existingLocation
      ? { lastAutoScanAt: null, nextAutoScanAt: null }
      : {
          lastAutoScanAt: subscription.lastAutoScanAt,
          nextAutoScanAt: subscription.nextAutoScanAt,
        };
    const locationWrite: DefaultLocationWrite = {
      accountId,
      brandId,
      countryCode: prepared.countryCode,
      languageCode: prepared.languageCode,
      topics: prepared.topics,
      competitors: prepared.competitors,
      // The first compatibility location inherits the current account setting.
      // Future additional locations remain disabled by default.
      autoScanEnabled: account.autoScanEnabled,
      schedule,
    };
    const location = existingLocation
      ? await transaction.updateDefaultLocation(
          existingLocation.id,
          locationWrite,
        )
      : await transaction.createDefaultLocation(locationWrite);
    const brandLocationId = assertDatabaseId(
      location.id,
      'Default brand location ID',
    );

    const user = await transaction.updateLegacyProfile(accountId, prepared);
    if (!user) {
      throw integrityError('The locked account disappeared during onboarding.');
    }

    await transaction.grantOnboardingSearchEntitlement({
      accountId,
      brandId,
      brandLocationId,
    });

    return {
      user,
      brandId,
      brandLocationId,
      createdBrand: !existingBrand,
      createdLocation: !existingLocation,
    };
  });
}
