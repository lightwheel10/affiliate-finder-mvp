import assert from 'node:assert/strict';
import test from 'node:test';
import type { ResultItem } from '../../src/app/types';
import {
  affiliateIdentityKey,
  groupAffiliates,
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
});
