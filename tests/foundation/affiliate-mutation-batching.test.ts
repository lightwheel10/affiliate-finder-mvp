import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AFFILIATE_BATCH_BODY_MAX_BYTES,
  AFFILIATE_DELETE_BATCH_MAX_ITEMS,
  chunkAffiliateMutationItems,
  DISCOVERED_AFFILIATE_BATCH_MAX_ITEMS,
  SAVED_AFFILIATE_BATCH_MAX_ITEMS,
} from '../../src/lib/affiliates/mutation-limits';

test('large affiliate selections are split without losing or reordering items', () => {
  const items = Array.from({ length: 1_090 }, (_, index) => index);

  for (const maxItems of [
    SAVED_AFFILIATE_BATCH_MAX_ITEMS,
    DISCOVERED_AFFILIATE_BATCH_MAX_ITEMS,
    AFFILIATE_DELETE_BATCH_MAX_ITEMS,
  ]) {
    const chunks = chunkAffiliateMutationItems(
      items,
      maxItems,
      AFFILIATE_BATCH_BODY_MAX_BYTES,
      (chunk) => JSON.stringify({ items: chunk }),
    );
    assert.deepEqual(chunks.flatMap((chunk) => chunk.items), items);
    assert.ok(chunks.every((chunk) => chunk.items.length > 0 && chunk.items.length <= maxItems));
    assert.ok(chunks.every(
      (chunk) => new TextEncoder().encode(chunk.body).byteLength <= AFFILIATE_BATCH_BODY_MAX_BYTES,
    ));
  }
});

test('empty selections stay empty and invalid batch sizes fail closed', () => {
  const serialize = (items: readonly number[]) => JSON.stringify({ items });
  assert.deepEqual(chunkAffiliateMutationItems([], 10, 100, serialize), []);
  assert.throws(() => chunkAffiliateMutationItems([1], 0, 100, serialize), TypeError);
  assert.throws(() => chunkAffiliateMutationItems([1], 1.5, 100, serialize), TypeError);
  assert.throws(() => chunkAffiliateMutationItems([1], 1, 0, serialize), TypeError);
});

test('encoded body size creates another chunk before the server byte limit', () => {
  const items = ['é'.repeat(20), 'é'.repeat(20), 'é'.repeat(20)];
  const maxBytes = new TextEncoder().encode(JSON.stringify({ items: items.slice(0, 2) })).byteLength;
  const chunks = chunkAffiliateMutationItems(
    items,
    100,
    maxBytes,
    (chunk) => JSON.stringify({ items: chunk }),
  );

  assert.deepEqual(chunks.map((chunk) => chunk.items.length), [2, 1]);
  assert.deepEqual(chunks.flatMap((chunk) => chunk.items), items);
  assert.ok(chunks.every((chunk) => new TextEncoder().encode(chunk.body).byteLength <= maxBytes));
  assert.throws(
    () => chunkAffiliateMutationItems(
      ['x'.repeat(100)],
      100,
      20,
      (chunk) => JSON.stringify({ items: chunk }),
    ),
    RangeError,
  );
});
