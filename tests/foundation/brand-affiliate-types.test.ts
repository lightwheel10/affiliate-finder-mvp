import assert from 'node:assert/strict';
import test from 'node:test';
import {
  readBrandAffiliateTypeIds,
  writeBrandAffiliateTypes,
} from '../../src/lib/brand-locations/affiliate-types';

test('brand affiliate types normalize onboarding and legacy labels', () => {
  assert.deepEqual(
    readBrandAffiliateTypeIds(['Publishers/Bloggers', 'Instagram', 'TikTok', 'YouTube']),
    ['web', 'instagram', 'tiktok', 'youtube'],
  );
  assert.deepEqual(
    readBrandAffiliateTypeIds(['Publisher/Blogger', 'INSTAGRAM', 'Unknown custom value']),
    ['web', 'instagram'],
  );
});

test('brand affiliate types write stable metadata in product order', () => {
  assert.deepEqual(
    writeBrandAffiliateTypes(['youtube', 'web', 'youtube']),
    ['Web', 'YouTube'],
  );
});
