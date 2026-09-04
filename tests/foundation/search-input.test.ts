import assert from 'node:assert/strict';
import test from 'node:test';
import { startSearchInputSchema } from '../../src/lib/search/input';

const requestId = 'a4e38e3d-9d28-4e45-a5b5-409a488585d3';

test('search input normalizes competitors and removes duplicates', () => {
  const result = startSearchInputSchema.parse({
    keywords: [' affiliate software ', 'affiliate software'],
    competitors: ['HTTPS://EXAMPLE.COM/path', 'example.com'],
    requestId,
  });

  assert.deepEqual(result.keywords, ['affiliate software']);
  assert.deepEqual(result.competitors, ['example.com']);
  assert.deepEqual(result.sources, ['Web', 'YouTube', 'Instagram', 'TikTok']);
});

test('search input rejects excessive keywords, competitors, and unknown sources', () => {
  assert.equal(
    startSearchInputSchema.safeParse({ keywords: ['1', '2', '3', '4', '5', '6'], requestId }).success,
    false,
  );
  assert.equal(
    startSearchInputSchema.safeParse({ keyword: 'one', competitors: ['1', '2', '3', '4', '5', '6'], requestId }).success,
    false,
  );
  assert.equal(
    startSearchInputSchema.safeParse({ keyword: 'one', sources: ['Reddit'], requestId }).success,
    false,
  );
});

test('search input accepts canonical location IDs and rejects unsafe values', () => {
  assert.equal(
    startSearchInputSchema.parse({ keyword: 'one', brandLocationId: '00042', requestId }).brandLocationId,
    '00042',
  );
  assert.equal(
    startSearchInputSchema.safeParse({ keyword: 'one', brandLocationId: Number.MAX_SAFE_INTEGER + 1, requestId }).success,
    false,
  );
  assert.equal(
    startSearchInputSchema.safeParse({ keyword: 'one', brandLocationId: '92233720368547758070', requestId }).success,
    false,
  );
});

test('search input normalizes UUID request IDs and rejects arbitrary tokens', () => {
  const parsed = startSearchInputSchema.parse({
    keyword: 'one',
    requestId: 'A4E38E3D-9D28-4E45-A5B5-409A488585D3',
  });
  assert.equal(parsed.requestId, 'a4e38e3d-9d28-4e45-a5b5-409a488585d3');
  assert.equal(
    startSearchInputSchema.safeParse({ keyword: 'one', requestId: 'retry-me' }).success,
    false,
  );
  assert.equal(
    startSearchInputSchema.safeParse({ keyword: 'one' }).success,
    false,
  );
});
