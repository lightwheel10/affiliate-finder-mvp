import assert from 'node:assert/strict';
import test from 'node:test';
import type { ResultItem } from '../../src/app/types';
import {
  affiliateGroupItems,
  affiliateIdentityKey,
  groupAffiliates,
  groupKeyOf,
  summarizeAffiliateGroupSelection,
} from '../../src/app/utils/affiliate-grouping';

function affiliate(overrides: Partial<ResultItem> = {}): ResultItem {
  return {
    brandLocationId: '10',
    title: 'Example',
    link: 'https://example.com/post',
    domain: 'example.com',
    snippet: '',
    source: 'Web',
    ...overrides,
  };
}

test('identical affiliate links remain distinct across locations', () => {
  const germany = affiliate({ brandLocationId: '10' });
  const unitedKingdom = affiliate({ brandLocationId: '11' });

  assert.notEqual(affiliateIdentityKey(germany), affiliateIdentityKey(unitedKingdom));
  assert.equal(groupAffiliates([germany, unitedKingdom]).length, 2);
});

test('postings still group normally inside the same location', () => {
  const first = affiliate({ link: 'https://example.com/one' });
  const second = affiliate({ link: 'https://example.com/two' });

  const groups = groupAffiliates([first, second]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].main, first);
  assert.deepEqual(groups[0].subItems, [second]);
  assert.deepEqual(affiliateGroupItems(groups[0]), [first, second]);
});

test('selection counts visible affiliates while preserving every underlying posting', () => {
  const postings = Array.from({ length: 69 }, (_, index) =>
    affiliate({
      link: `https://affiliate-${index}.example/post-1`,
      domain: `affiliate-${index}.example`,
    }),
  );

  // Nine affiliates have a second relevant page: 78 records, 69 visible rows.
  for (let index = 0; index < 9; index += 1) {
    postings.push(affiliate({
      link: `https://affiliate-${index}.example/post-2`,
      domain: `affiliate-${index}.example`,
    }));
  }

  const groups = groupAffiliates(postings);
  const selectedGroupKeys = new Set(groups.map(group => groupKeyOf(group.main)));
  const summary = summarizeAffiliateGroupSelection(groups, selectedGroupKeys, () => false);

  assert.equal(summary.selectedGroupCount, 69);
  assert.equal(summary.actionableGroupCount, 69);
  assert.equal(summary.selectedItems.length, 78);
  assert.equal(summary.actionableItems.length, 78);
});

test('partially saved affiliates count once and send only unsaved postings', () => {
  const saved = affiliate({ id: 1, link: 'https://example.com/saved' });
  const unsaved = affiliate({ id: 2, link: 'https://example.com/unsaved' });
  const complete = affiliate({ id: 3, link: 'https://complete.example/post', domain: 'complete.example' });
  const groups = groupAffiliates([saved, unsaved, complete]);
  const selectedGroupKeys = new Set(groups.map(group => groupKeyOf(group.main)));
  const summary = summarizeAffiliateGroupSelection(
    groups,
    selectedGroupKeys,
    item => item.id === 1 || item.id === 3,
  );

  assert.equal(summary.selectedGroupCount, 2);
  assert.equal(summary.completeGroupCount, 1);
  assert.equal(summary.actionableGroupCount, 1);
  assert.deepEqual(summary.actionableItems, [unsaved]);
});
