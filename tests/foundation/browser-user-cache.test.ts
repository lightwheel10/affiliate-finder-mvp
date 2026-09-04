import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildBrowserUserCacheKey,
  IdentityBoundAsyncCache,
} from '../../src/lib/auth/browser-user-cache';

test('browser account cache uses Auth UUID and refreshes after an email change', () => {
  const first = buildBrowserUserCacheKey(
    '11111111-1111-4111-8111-111111111111',
    'Owner@Example.com',
  );
  const same = buildBrowserUserCacheKey(
    '11111111-1111-4111-8111-111111111111',
    ' owner@example.com ',
  );
  const changedEmail = buildBrowserUserCacheKey(
    '11111111-1111-4111-8111-111111111111',
    'new@example.com',
  );
  const differentIdentity = buildBrowserUserCacheKey(
    '22222222-2222-4222-8222-222222222222',
    'owner@example.com',
  );

  assert.equal(first, same);
  assert.notEqual(first, changedEmail);
  assert.notEqual(first, differentIdentity);
  assert.equal(buildBrowserUserCacheKey(null, 'owner@example.com'), null);
});

test('simultaneous hook loads share one request for the same identity', async () => {
  const cache = new IdentityBoundAsyncCache<{ accountId: number }>();
  let loads = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const loader = async () => {
    loads += 1;
    await gate;
    return { accountId: 7 };
  };

  const first = cache.load('auth-a:owner@example.com', loader);
  const second = cache.load('auth-a:owner@example.com', loader);
  release();

  assert.deepEqual(await first, { accountId: 7 });
  assert.deepEqual(await second, { accountId: 7 });
  assert.equal(loads, 1);
});

test('a late response cannot publish after a rapid account switch', async () => {
  const cache = new IdentityBoundAsyncCache<{ accountId: number }>();
  const commits: number[] = [];
  let releaseFirst!: (value: { accountId: number }) => void;
  const firstResponse = new Promise<{ accountId: number }>((resolve) => {
    releaseFirst = resolve;
  });

  const first = cache.load(
    'auth-a:a@example.com',
    () => firstResponse,
    { onCommit: (value) => commits.push(value.accountId) },
  );
  const second = cache.load(
    'auth-b:b@example.com',
    async () => ({ accountId: 22 }),
    { onCommit: (value) => commits.push(value.accountId) },
  );

  assert.deepEqual(await second, { accountId: 22 });
  releaseFirst({ accountId: 11 });
  assert.equal(await first, null);
  assert.deepEqual(commits, [22]);
  assert.equal(cache.isCurrent('auth-b:b@example.com'), true);
});
