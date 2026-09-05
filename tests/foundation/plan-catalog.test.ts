import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PLAN_CATALOG,
  SEARCH_INPUT_LIMITS,
  isPlanCapacityIncrease,
  isPurchasablePlanId,
} from '../../src/lib/plans/catalog';
import { en } from '../../src/dictionaries/en';
import { de } from '../../src/dictionaries/de';

test('public plan catalogue matches current commercial pricing and brand copy', () => {
  assert.deepEqual(PLAN_CATALOG.pro.pricing, {
    monthlyEur: 99,
    annualMonthlyEquivalentEur: 79,
    annualTotalEur: 948,
  });
  assert.deepEqual(PLAN_CATALOG.business.pricing, {
    monthlyEur: 249,
    annualMonthlyEquivalentEur: 199,
    annualTotalEur: 2388,
  });
  assert.equal(PLAN_CATALOG.pro.entitlements.maxBrands, 1);
  assert.equal(PLAN_CATALOG.business.entitlements.maxBrands, 5);
  assert.equal(PLAN_CATALOG.pro.entitlements.maxLocationsPerAccount, 2);
  assert.equal(PLAN_CATALOG.business.entitlements.maxLocationsPerAccount, 5);
});

test('only implemented Stripe plans are purchasable', () => {
  assert.equal(isPurchasablePlanId('pro'), true);
  assert.equal(isPurchasablePlanId('business'), true);
  assert.equal(isPurchasablePlanId('free_trial'), false);
  assert.equal(isPurchasablePlanId('enterprise'), false);
});

test('capacity increases are derived from central plan limits', () => {
  assert.equal(isPlanCapacityIncrease('pro', 'business'), true);
  assert.equal(isPlanCapacityIncrease('business', 'enterprise'), true);
  assert.equal(isPlanCapacityIncrease('free_trial', 'pro'), true);
  assert.equal(isPlanCapacityIncrease('business', 'pro'), false);
  assert.equal(isPlanCapacityIncrease('pro', 'pro'), false);
});

test('search input limits match the current five-by-five UI', () => {
  assert.deepEqual(SEARCH_INPUT_LIMITS, {
    maxKeywords: 5,
    maxCompetitors: 5,
    maxSources: 4,
  });
});

test('English and German pricing copy stays synchronized with entitlements', () => {
  assert.equal(en.landing.pricing.pro.price, '€99');
  assert.equal(en.landing.pricing.growth.price, '€249');
  assert.ok(en.landing.pricing.pro.features.includes('1 brand project'));
  assert.ok(en.landing.pricing.growth.features.includes('5 brand projects'));

  assert.equal(de.landing.pricing.pro.price, '99 €');
  assert.equal(de.landing.pricing.growth.price, '249 €');
  assert.ok(de.landing.pricing.pro.features.includes('1 Markenprojekt'));
  assert.ok(de.landing.pricing.growth.features.includes('5 Markenprojekte'));
});

test('scheduled plan-change copy preserves every billing fact in both languages', () => {
  for (const dictionary of [en, de]) {
    const description = dictionary.dashboard.settings.plan.scheduledPlanChange.description;
    assert.deepEqual(
      [...description.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]).sort(),
      ['billingInterval', 'currentPlan', 'date', 'nextPlan'],
    );

    const sidebarStatus = dictionary.sidebar.planCard.scheduledChange;
    assert.deepEqual(
      [...sidebarStatus.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]).sort(),
      ['date', 'plan'],
    );
  }
});
