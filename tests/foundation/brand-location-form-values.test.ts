import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatLineValues,
  parseUniqueLineValues,
} from '../../src/lib/brand-locations/form-values';
import { buildLocationExportSlug } from '../../src/lib/brand-locations/export';

test('line-value parser trims, removes blanks, and deduplicates case-insensitively', () => {
  assert.deepEqual(
    parseUniqueLineValues('  Creator  \n\ncreator\r\nPublisher\n PUBLISHER '),
    ['Creator', 'Publisher'],
  );
  assert.equal(formatLineValues(['Creator', 'Publisher']), 'Creator\nPublisher');
});

test('line-value parser does not silently discard values above a UI limit', () => {
  const values = parseUniqueLineValues(Array.from({ length: 7 }, (_, index) => `topic-${index}`).join('\n'));
  assert.equal(values.length, 7);
});

test('location export labels are short and filesystem-safe', () => {
  assert.equal(buildLocationExportSlug('Revenue Works!', 'us'), 'revenue-works-us');
  assert.equal(buildLocationExportSlug('Sélecdoo GmbH', null), 'selecdoo-gmbh-market');
  assert.match(buildLocationExportSlug('***', 'de'), /^brand-de$/);
});
