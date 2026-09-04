import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DowngradeCapacityError,
  assessDowngradeCapacity,
  resolveDowngradeRetentionSelection,
  validateDowngradeRetentionSelection,
  type ActiveBrandCapacity,
} from '../../src/lib/plans/downgrade-capacity';

const capacity: ActiveBrandCapacity[] = [
  { id: '10', locationIds: ['101', '102'] },
  { id: '20', locationIds: ['201'] },
  { id: '30', locationIds: ['301'] },
];

function expectCapacityError(
  action: () => unknown,
  code: DowngradeCapacityError['code'],
  status: number,
) {
  assert.throws(action, (error: unknown) => {
    assert.ok(error instanceof DowngradeCapacityError);
    assert.equal(error.code, code);
    assert.equal(error.status, status);
    return true;
  });
}

test('detects when target plan capacity requires an explicit customer choice', () => {
  assert.deepEqual(assessDowngradeCapacity(capacity, 'pro'), {
    targetPlan: 'pro',
    maxBrands: 1,
    maxLocations: 2,
    activeBrands: 3,
    activeLocations: 4,
    selectionRequired: true,
  });
  expectCapacityError(
    () => resolveDowngradeRetentionSelection(capacity, 'pro'),
    'DOWNGRADE_SELECTION_REQUIRED',
    409,
  );
});

test('keeps every active row automatically when the account already fits', () => {
  assert.deepEqual(
    resolveDowngradeRetentionSelection([
      { id: '10', locationIds: ['101', '102'] },
    ], 'pro'),
    {
      assessment: {
        targetPlan: 'pro',
        maxBrands: 1,
        maxLocations: 2,
        activeBrands: 1,
        activeLocations: 2,
        selectionRequired: false,
      },
      selection: { brandIds: ['10'], locationIds: ['101', '102'] },
    },
  );
});

test('accepts a valid keep-list and returns deterministic database order', () => {
  assert.deepEqual(
    validateDowngradeRetentionSelection(capacity, 'pro', {
      brandIds: ['10'],
      locationIds: ['102', '101'],
    }),
    { brandIds: ['10'], locationIds: ['101', '102'] },
  );
});

test('rejects duplicate, unknown, cross-brand and over-limit selections', () => {
  expectCapacityError(
    () => validateDowngradeRetentionSelection(capacity, 'pro', {
      brandIds: ['10', '10'],
      locationIds: ['101'],
    }),
    'INVALID_DOWNGRADE_SELECTION',
    400,
  );
  expectCapacityError(
    () => validateDowngradeRetentionSelection(capacity, 'pro', {
      brandIds: ['99'],
      locationIds: ['101'],
    }),
    'INVALID_DOWNGRADE_SELECTION',
    409,
  );
  expectCapacityError(
    () => validateDowngradeRetentionSelection(capacity, 'pro', {
      brandIds: ['10'],
      locationIds: ['201'],
    }),
    'INVALID_DOWNGRADE_SELECTION',
    409,
  );
  expectCapacityError(
    () => validateDowngradeRetentionSelection(capacity, 'pro', {
      brandIds: ['10', '20'],
      locationIds: ['101', '201'],
    }),
    'INVALID_DOWNGRADE_SELECTION',
    400,
  );
});

test('requires at least one retained location for every retained brand', () => {
  expectCapacityError(
    () => validateDowngradeRetentionSelection(capacity, 'business', {
      brandIds: ['10', '20'],
      locationIds: ['101'],
    }),
    'INVALID_DOWNGRADE_SELECTION',
    400,
  );
  expectCapacityError(
    () => validateDowngradeRetentionSelection(capacity, 'business', {
      brandIds: [],
      locationIds: [],
    }),
    'INVALID_DOWNGRADE_SELECTION',
    400,
  );
});

test('fails closed on malformed or cross-brand active capacity input', () => {
  expectCapacityError(
    () => assessDowngradeCapacity([
      { id: '10', locationIds: ['101'] },
      { id: '20', locationIds: ['101'] },
    ], 'pro'),
    'DOWNGRADE_CAPACITY_INTEGRITY_ERROR',
    500,
  );
  expectCapacityError(
    () => assessDowngradeCapacity([{ id: 'not-an-id', locationIds: ['101'] }], 'pro'),
    'DOWNGRADE_CAPACITY_INTEGRITY_ERROR',
    500,
  );
  expectCapacityError(
    () => resolveDowngradeRetentionSelection([], 'pro'),
    'DOWNGRADE_CAPACITY_INTEGRITY_ERROR',
    500,
  );
  expectCapacityError(
    () => resolveDowngradeRetentionSelection([{ id: '10', locationIds: [] }], 'pro'),
    'DOWNGRADE_CAPACITY_INTEGRITY_ERROR',
    500,
  );
});
