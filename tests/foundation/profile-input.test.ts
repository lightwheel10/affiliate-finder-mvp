import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAccountInputSchema,
  completeOnboardingInputSchema,
  profilePatchInputSchema,
} from '../../src/lib/users/profile-input';
import { suggestionRequestInputSchema } from '../../src/lib/suggestions/input';

test('account creation discards legacy client-owned authority fields', () => {
  const parsed = createAccountInputSchema.parse({
    email: 'attacker@example.com',
    name: '  Safe Name  ',
    isOnboarded: true,
    onboardingStep: 7,
    hasSubscription: true,
    plan: 'enterprise',
  });

  assert.deepEqual(parsed, { name: 'Safe Name' });
});

test('profile updates reject subscription and billing authority fields', () => {
  assert.equal(profilePatchInputSchema.safeParse({ plan: 'enterprise' }).success, false);
  assert.equal(profilePatchInputSchema.safeParse({ hasSubscription: true }).success, false);
  assert.equal(profilePatchInputSchema.safeParse({ billingLast4: '4242' }).success, false);
});

test('profile updates normalize and deduplicate safe fields', () => {
  const result = profilePatchInputSchema.parse({
    id: 7,
    name: '  David  ',
    topics: [' affiliates ', 'affiliates'],
    targetCountry: 'United Kingdom',
    targetLanguage: 'English',
  });

  assert.equal(result.name, 'David');
  assert.deepEqual(result.topics, ['affiliates']);
});

test('profile updates reject unsupported markets and oversized search inputs', () => {
  assert.equal(profilePatchInputSchema.safeParse({ targetCountry: 'Atlantis' }).success, false);
  assert.equal(
    profilePatchInputSchema.safeParse({ competitors: ['1', '2', '3', '4', '5', '6'] }).success,
    false,
  );
});

test('onboarding requires a supported canonical market', () => {
  const base = {
    name: 'David',
    role: 'Founder',
    brand: 'selecdoo.com',
    targetCountry: 'United Kingdom',
    targetLanguage: 'English',
    competitors: [],
    topics: ['affiliate software'],
    affiliateTypes: ['Web'],
  };

  assert.equal(completeOnboardingInputSchema.safeParse(base).success, true);
  assert.equal(
    completeOnboardingInputSchema.safeParse({ ...base, targetLanguage: 'Klingon' }).success,
    false,
  );
});

test('suggestions accept only canonical market values', () => {
  assert.equal(suggestionRequestInputSchema.safeParse({
    brandUrl: 'example.co.uk',
    targetCountry: 'United Kingdom',
    targetLanguage: 'English',
  }).success, true);

  assert.equal(suggestionRequestInputSchema.safeParse({
    brandUrl: 'example.co.uk',
    targetCountry: 'UK',
    targetLanguage: 'English',
  }).success, false);
  assert.equal(suggestionRequestInputSchema.safeParse({
    brandUrl: 'example.co.uk',
  }).success, false);
});
