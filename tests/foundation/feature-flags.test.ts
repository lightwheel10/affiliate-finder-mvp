import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isMultiBrandLocationsEnabled,
  isPaidCapacityEnabled,
} from '../../src/lib/feature-flags';

test('paid capacity requires both its own switch and brand/location management', () => {
  const originalManagement = process.env.NEXT_PUBLIC_MULTI_BRAND_LOCATIONS_ENABLED;
  const originalPaidCapacity = process.env.PAID_CAPACITY_ENABLED;

  try {
    process.env.NEXT_PUBLIC_MULTI_BRAND_LOCATIONS_ENABLED = 'false';
    process.env.PAID_CAPACITY_ENABLED = 'true';
    assert.equal(isMultiBrandLocationsEnabled(), false);
    assert.equal(isPaidCapacityEnabled(), false);

    process.env.NEXT_PUBLIC_MULTI_BRAND_LOCATIONS_ENABLED = 'true';
    process.env.PAID_CAPACITY_ENABLED = 'false';
    assert.equal(isMultiBrandLocationsEnabled(), true);
    assert.equal(isPaidCapacityEnabled(), false);

    process.env.PAID_CAPACITY_ENABLED = 'true';
    assert.equal(isPaidCapacityEnabled(), true);
  } finally {
    if (originalManagement === undefined) {
      delete process.env.NEXT_PUBLIC_MULTI_BRAND_LOCATIONS_ENABLED;
    } else {
      process.env.NEXT_PUBLIC_MULTI_BRAND_LOCATIONS_ENABLED = originalManagement;
    }
    if (originalPaidCapacity === undefined) {
      delete process.env.PAID_CAPACITY_ENABLED;
    } else {
      process.env.PAID_CAPACITY_ENABLED = originalPaidCapacity;
    }
  }
});
