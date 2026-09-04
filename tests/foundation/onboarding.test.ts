import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeBrandDomain } from '../../src/lib/brands/domain';
import {
  completeAccountOnboarding,
  OnboardingError,
  prepareOnboardingInput,
  type DefaultBrandWrite,
  type DefaultLocationWrite,
  type OnboardingBrand,
  type OnboardingLocation,
  type OnboardingStore,
  type OnboardingSubscription,
  type OnboardingSubscriptionStatus,
  type OnboardingTransaction,
} from '../../src/lib/brand-locations/onboarding';
import type { CompleteOnboardingInput } from '../../src/lib/users/profile-input';

interface TestUser {
  id: number;
  name: string;
  role: string | null;
  brand: string | null;
  targetCountry: string | null;
  targetLanguage: string | null;
  competitors: string[];
  topics: string[];
  affiliateTypes: string[];
  bio: string | null;
  autoScanEnabled: boolean;
  isOnboarded: boolean;
}

interface TestBrand {
  id: string;
  accountId: number;
  name: string;
  normalizedDomain: string;
  bio: string | null;
  affiliateTypes: string[];
  isDefault: boolean;
  legacyImportedAt: string | null;
}

interface TestLocation {
  id: string;
  accountId: number;
  brandId: string;
  countryCode: string;
  languageCode: string;
  topics: string[];
  competitors: string[];
  isDefault: boolean;
  autoScanEnabled: boolean;
  lastAutoScanAt: string | Date | null;
  nextAutoScanAt: string | Date | null;
  legacyImportedAt: string | null;
}

interface TestState {
  users: TestUser[];
  brands: TestBrand[];
  locations: TestLocation[];
  subscriptions: Array<{
    accountId: number;
    stripeSubscriptionId: string | null;
    status: OnboardingSubscriptionStatus;
    lastAutoScanAt: string | null;
    nextAutoScanAt: string | null;
  }>;
  entitlements: Array<{
    accountId: number;
    brandId: string;
    brandLocationId: string;
  }>;
  nextBrandId: number;
  nextLocationId: number;
}

const onboardingInput: CompleteOnboardingInput = {
  name: 'David',
  role: 'Founder',
  brand: 'https://www.Selecdoo.com/path',
  targetCountry: 'United Kingdom',
  targetLanguage: 'English',
  competitors: ['competitor.example'],
  topics: ['affiliate software'],
  affiliateTypes: ['Web'],
};

function user(overrides: Partial<TestUser> = {}): TestUser {
  return {
    id: 7,
    name: 'Before',
    role: null,
    brand: null,
    targetCountry: null,
    targetLanguage: null,
    competitors: [],
    topics: [],
    affiliateTypes: [],
    bio: 'Existing account bio',
    autoScanEnabled: true,
    isOnboarded: false,
    ...overrides,
  };
}

class InMemoryOnboardingStore implements OnboardingStore<TestUser> {
  state: TestState;
  failAt:
    | 'createBrand'
    | 'createLocation'
    | 'updateProfile'
    | 'grantEntitlement'
    | null = null;
  private transactionQueue: Promise<void> = Promise.resolve();

  constructor(initialState: Partial<TestState> = {}) {
    this.state = {
      users: [user()],
      brands: [],
      locations: [],
      subscriptions: [{
        accountId: 7,
        stripeSubscriptionId: 'sub_test_7',
        status: 'trialing',
        lastAutoScanAt: null,
        nextAutoScanAt: null,
      }],
      entitlements: [],
      nextBrandId: 11,
      nextLocationId: 21,
      ...structuredClone(initialState),
    };
  }

  async transaction<T>(
    operation: (transaction: OnboardingTransaction<TestUser>) => Promise<T>,
  ): Promise<T> {
    let release!: () => void;
    const previous = this.transactionQueue;
    this.transactionQueue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;

    const snapshot = structuredClone(this.state);
    try {
      return await operation(this.createTransaction());
    } catch (error) {
      this.state = snapshot;
      throw error;
    } finally {
      release();
    }
  }

  private createTransaction(): OnboardingTransaction<TestUser> {
    return {
      lockAccount: async (accountId) => {
        await Promise.resolve();
        const account = this.state.users.find((item) => item.id === accountId);
        return account
          ? {
              id: account.id,
              bio: account.bio,
              autoScanEnabled: account.autoScanEnabled,
            }
          : null;
      },
      readSubscription: async (
        accountId,
      ): Promise<OnboardingSubscription | null> => {
        const subscription = this.state.subscriptions.find(
          (item) => item.accountId === accountId,
        );
        if (!subscription) return null;
        return {
          stripeSubscriptionId: subscription.stripeSubscriptionId,
          status: subscription.status,
          lastAutoScanAt: subscription.lastAutoScanAt,
          nextAutoScanAt: subscription.nextAutoScanAt,
        };
      },
      findDefaultBrand: async (accountId): Promise<OnboardingBrand | null> => {
        const matches = this.state.brands.filter(
          (brand) => brand.accountId === accountId && brand.isDefault,
        );
        assert.ok(matches.length <= 1);
        return matches[0] ? { id: matches[0].id } : null;
      },
      createDefaultBrand: async (
        input: DefaultBrandWrite,
      ): Promise<OnboardingBrand> => {
        if (this.failAt === 'createBrand') throw new Error('forced brand failure');
        assert.equal(
          this.state.brands.some(
            (brand) => brand.accountId === input.accountId && brand.isDefault,
          ),
          false,
        );
        const brand: TestBrand = {
          id: String(this.state.nextBrandId++),
          accountId: input.accountId,
          name: input.name,
          normalizedDomain: input.normalizedDomain,
          bio: input.bio,
          affiliateTypes: [...input.affiliateTypes],
          isDefault: true,
          legacyImportedAt: null,
        };
        this.state.brands.push(brand);
        return { id: brand.id };
      },
      updateDefaultBrand: async (brandId, input): Promise<OnboardingBrand> => {
        const brand = this.state.brands.find(
          (item) =>
            item.id === brandId
            && item.accountId === input.accountId
            && item.isDefault,
        );
        assert.ok(brand);
        brand.name = input.name;
        brand.normalizedDomain = input.normalizedDomain;
        brand.bio = input.bio;
        brand.affiliateTypes = [...input.affiliateTypes];
        return { id: brand.id };
      },
      findDefaultLocation: async (
        accountId,
        brandId,
      ): Promise<OnboardingLocation | null> => {
        const matches = this.state.locations.filter(
          (location) =>
            location.accountId === accountId
            && location.brandId === brandId
            && location.isDefault,
        );
        assert.ok(matches.length <= 1);
        return matches[0] ? { id: matches[0].id } : null;
      },
      createDefaultLocation: async (
        input: DefaultLocationWrite,
      ): Promise<OnboardingLocation> => {
        if (this.failAt === 'createLocation') {
          throw new Error('forced location failure');
        }
        const location: TestLocation = {
          id: String(this.state.nextLocationId++),
          accountId: input.accountId,
          brandId: input.brandId,
          countryCode: input.countryCode,
          languageCode: input.languageCode,
          topics: [...input.topics],
          competitors: [...input.competitors],
          isDefault: true,
          autoScanEnabled: input.autoScanEnabled,
          lastAutoScanAt: input.schedule.lastAutoScanAt,
          nextAutoScanAt: input.schedule.nextAutoScanAt,
          legacyImportedAt: null,
        };
        this.state.locations.push(location);
        return { id: location.id };
      },
      updateDefaultLocation: async (
        locationId,
        input,
      ): Promise<OnboardingLocation> => {
        const location = this.state.locations.find(
          (item) =>
            item.id === locationId
            && item.accountId === input.accountId
            && item.brandId === input.brandId
            && item.isDefault,
        );
        assert.ok(location);
        location.countryCode = input.countryCode;
        location.languageCode = input.languageCode;
        location.topics = [...input.topics];
        location.competitors = [...input.competitors];
        return { id: location.id };
      },
      updateLegacyProfile: async (accountId, input) => {
        if (this.failAt === 'updateProfile') {
          throw new Error('forced profile failure');
        }
        const account = this.state.users.find((item) => item.id === accountId);
        if (!account) return null;
        account.name = input.name;
        account.role = input.role;
        account.brand = input.brand;
        account.targetCountry = input.targetCountry;
        account.targetLanguage = input.targetLanguage;
        account.competitors = [...input.competitors];
        account.topics = [...input.topics];
        account.affiliateTypes = [...input.affiliateTypes];
        account.isOnboarded = true;
        return structuredClone(account);
      },
      grantOnboardingSearchEntitlement: async (input) => {
        if (this.failAt === 'grantEntitlement') {
          throw new Error('forced entitlement failure');
        }
        const existing = this.state.entitlements.find(
          (item) => item.accountId === input.accountId,
        );
        if (existing) {
          assert.deepEqual(existing, input);
          return;
        }
        this.state.entitlements.push({ ...input });
      },
    };
  }
}

test('brand domains use one canonical normalization boundary', () => {
  assert.equal(normalizeBrandDomain(' HTTPS://WWW.Example.CO.UK:443/path?q=1#x '), 'example.co.uk');
  for (const invalid of [
    '',
    'localhost',
    'example',
    '-example.com',
    'example..com',
    'https://user@example.com',
  ]) {
    assert.equal(normalizeBrandDomain(invalid), null);
  }
});

test('onboarding preparation converts catalogue names to exact ISO codes', () => {
  const prepared = prepareOnboardingInput(onboardingInput);
  assert.equal(prepared.normalizedDomain, 'selecdoo.com');
  assert.equal(prepared.countryCode, 'gb');
  assert.equal(prepared.languageCode, 'en');
});

test('new account onboarding creates one default brand and location atomically', async () => {
  const store = new InMemoryOnboardingStore({
    subscriptions: [
      {
        accountId: 7,
        stripeSubscriptionId: 'sub_test_7',
        status: 'active',
        lastAutoScanAt: '2026-08-25T00:00:00.000Z',
        nextAutoScanAt: '2026-09-08T00:00:00.000Z',
      },
    ],
  });

  const result = await completeAccountOnboarding(7, onboardingInput, store);

  assert.equal(result.createdBrand, true);
  assert.equal(result.createdLocation, true);
  assert.equal(store.state.users[0].isOnboarded, true);
  assert.equal(store.state.brands.length, 1);
  assert.equal(store.state.brands[0].normalizedDomain, 'selecdoo.com');
  assert.equal(store.state.locations.length, 1);
  assert.deepEqual(store.state.entitlements, [{
    accountId: 7,
    brandId: '11',
    brandLocationId: '21',
  }]);
  assert.equal(store.state.locations[0].countryCode, 'gb');
  assert.equal(store.state.locations[0].languageCode, 'en');
  assert.equal(store.state.locations[0].autoScanEnabled, true);
  assert.equal(
    store.state.locations[0].nextAutoScanAt,
    '2026-09-08T00:00:00.000Z',
  );
});

test('retry updates the same defaults without resetting scan state', async () => {
  const store = new InMemoryOnboardingStore();
  const first = await completeAccountOnboarding(7, onboardingInput, store);
  store.state.locations[0].autoScanEnabled = false;
  store.state.locations[0].nextAutoScanAt = '2026-09-20T00:00:00.000Z';

  const retry = await completeAccountOnboarding(
    7,
    {
      ...onboardingInput,
      targetCountry: 'Germany',
      targetLanguage: 'German',
      topics: ['partner marketing'],
    },
    store,
  );

  assert.equal(first.brandId, retry.brandId);
  assert.equal(first.brandLocationId, retry.brandLocationId);
  assert.equal(retry.createdBrand, false);
  assert.equal(retry.createdLocation, false);
  assert.equal(store.state.brands.length, 1);
  assert.equal(store.state.locations.length, 1);
  assert.equal(store.state.locations[0].countryCode, 'de');
  assert.equal(store.state.locations[0].languageCode, 'de');
  assert.equal(store.state.locations[0].autoScanEnabled, false);
  assert.equal(
    store.state.locations[0].nextAutoScanAt,
    '2026-09-20T00:00:00.000Z',
  );
});

test('backfilled defaults are reused and retain their migration markers', async () => {
  const importedAt = '2026-09-01T00:00:00.000Z';
  const store = new InMemoryOnboardingStore({
    brands: [
      {
        id: '11',
        accountId: 7,
        name: 'Old Brand',
        normalizedDomain: 'old.example',
        bio: 'Existing account bio',
        affiliateTypes: [],
        isDefault: true,
        legacyImportedAt: importedAt,
      },
    ],
    locations: [
      {
        id: '21',
        accountId: 7,
        brandId: '11',
        countryCode: 'de',
        languageCode: 'de',
        topics: [],
        competitors: [],
        isDefault: true,
        autoScanEnabled: true,
        lastAutoScanAt: null,
        nextAutoScanAt: null,
        legacyImportedAt: importedAt,
      },
    ],
  });

  const result = await completeAccountOnboarding(7, onboardingInput, store);

  assert.equal(result.createdBrand, false);
  assert.equal(result.createdLocation, false);
  assert.equal(store.state.brands[0].legacyImportedAt, importedAt);
  assert.equal(store.state.locations[0].legacyImportedAt, importedAt);
});

test('a mid-transaction failure rolls back profile, brand and location state', async () => {
  const store = new InMemoryOnboardingStore();
  const before = structuredClone(store.state);
  store.failAt = 'createLocation';

  await assert.rejects(
    () => completeAccountOnboarding(7, onboardingInput, store),
    /forced location failure/,
  );
  assert.deepEqual(store.state, before);
});

test('missing or inactive subscription fails before any onboarding write', async () => {
  const cases: Array<{
    status: OnboardingSubscriptionStatus | null;
    stripeSubscriptionId: string | null;
  }> = [
    { status: null, stripeSubscriptionId: null },
    { status: 'incomplete', stripeSubscriptionId: 'sub_incomplete' },
    { status: 'past_due', stripeSubscriptionId: 'sub_past_due' },
    { status: 'canceled', stripeSubscriptionId: 'sub_canceled' },
    { status: 'active', stripeSubscriptionId: null },
  ];

  for (const current of cases) {
    const subscriptions = current.status === null ? [] : [{
      accountId: 7,
      stripeSubscriptionId: current.stripeSubscriptionId,
      status: current.status,
      lastAutoScanAt: null,
      nextAutoScanAt: null,
    }];
    const store = new InMemoryOnboardingStore({ subscriptions });
    const before = structuredClone(store.state);
    await assert.rejects(
      () => completeAccountOnboarding(7, onboardingInput, store),
      (error: unknown) =>
        error instanceof OnboardingError
        && error.code === 'SUBSCRIPTION_REQUIRED'
        && error.status === 402,
    );
    assert.deepEqual(store.state, before);
  }
});

test('active and trialing subscriptions both grant exactly one entitlement', async () => {
  for (const status of ['active', 'trialing'] as const) {
    const store = new InMemoryOnboardingStore({
      subscriptions: [{
        accountId: 7,
        stripeSubscriptionId: `sub_${status}`,
        status,
        lastAutoScanAt: null,
        nextAutoScanAt: null,
      }],
    });
    await completeAccountOnboarding(7, onboardingInput, store);
    await completeAccountOnboarding(7, onboardingInput, store);
    assert.equal(store.state.entitlements.length, 1);
  }
});

test('entitlement failure rolls back the complete onboarding transaction', async () => {
  const store = new InMemoryOnboardingStore();
  const before = structuredClone(store.state);
  store.failAt = 'grantEntitlement';
  await assert.rejects(
    () => completeAccountOnboarding(7, onboardingInput, store),
    /forced entitlement failure/,
  );
  assert.deepEqual(store.state, before);
});

test('missing and malformed accounts fail closed', async () => {
  const store = new InMemoryOnboardingStore({ users: [] });
  await assert.rejects(
    () => completeAccountOnboarding(7, onboardingInput, store),
    (error: unknown) =>
      error instanceof OnboardingError
      && error.code === 'ACCOUNT_NOT_FOUND'
      && error.status === 404,
  );
  await assert.rejects(
    () => completeAccountOnboarding(Number.MAX_SAFE_INTEGER + 1, onboardingInput, store),
    (error: unknown) =>
      error instanceof OnboardingError
      && error.code === 'INVALID_ACCOUNT_ID',
  );
});

test('fifty concurrent retries still produce one default brand and location', async () => {
  const store = new InMemoryOnboardingStore();
  const results = await Promise.all(
    Array.from({ length: 50 }, () =>
      completeAccountOnboarding(7, onboardingInput, store),
    ),
  );

  assert.equal(store.state.brands.length, 1);
  assert.equal(store.state.locations.length, 1);
  assert.equal(store.state.entitlements.length, 1);
  assert.deepEqual(new Set(results.map((result) => result.brandId)), new Set(['11']));
  assert.deepEqual(
    new Set(results.map((result) => result.brandLocationId)),
    new Set(['21']),
  );
});
