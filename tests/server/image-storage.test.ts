import assert from 'node:assert/strict';
import test from 'node:test';

import {
  needsRehosting,
  rehostImageIfNeeded,
} from '../../src/lib/image-storage';

test('only approved expiring HTTPS CDN images enter the rehosting path', () => {
  assert.equal(needsRehosting('https://scontent.cdninstagram.com/photo.jpg'), true);
  assert.equal(needsRehosting('https://cdninstagram.com.evil.test/photo.jpg'), false);
  assert.equal(needsRehosting('http://scontent.cdninstagram.com/photo.jpg'), false);
  assert.equal(needsRehosting('https://project.supabase.co/storage/photo.jpg'), false);
  assert.equal(needsRehosting('not a URL'), false);
});

test('ordinary permanent image URLs pass through unchanged without a network request', async () => {
  const url = 'https://i.ytimg.com/vi/example/default.jpg';
  let fetched = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    fetched = true;
    throw new Error('This URL must not be fetched.');
  };
  try {
    assert.equal(await rehostImageIfNeeded(url), url);
    assert.equal(fetched, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a rejected expiring image keeps the original URL instead of breaking the save flow', async () => {
  const url = 'https://scontent.cdninstagram.com/expired.jpg';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 403 });
  try {
    assert.equal(await rehostImageIfNeeded(url), url);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
