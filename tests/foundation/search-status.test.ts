import assert from 'node:assert/strict';
import test from 'node:test';
import {
  countResultSources,
  dedupeSearchResults,
  normalizeResultSnapshot,
  parseSearchJobRuntimeContext,
  SearchStatusIntegrityError,
  truncateProviderText,
} from '../../src/lib/search/status';

function jobRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 17,
    user_id: 7,
    keyword: 'affiliate software',
    sources: ['Web', 'YouTube'],
    apify_run_id: 'provider-run-1',
    status: 'running',
    created_at: '2026-09-02T00:00:00.000Z',
    user_settings: {},
    results_count: null,
    enrichment_status: null,
    enrichment_run_ids: null,
    raw_results: null,
    brand_id: '11',
    brand_location_id: '21',
    settings_snapshot: {
      version: 1,
      brand: { id: '11', name: 'Selecdoo', normalizedDomain: 'selecdoo.com' },
      location: {
        id: '21',
        countryCode: 'gb',
        countryName: 'United Kingdom',
        languageCode: 'en',
        languageName: 'English',
      },
      search: {
        keywords: ['affiliate software'],
        competitors: ['example.com'],
        sources: ['Web', 'YouTube'],
        requestId: 'c8f5118a-dca1-4a7d-99b5-57f725c5b6c1',
      },
    },
    brand_archived_at: null,
    location_archived_at: null,
    ...overrides,
  };
}

test('runtime context comes from the immutable brand/location snapshot', () => {
  const parsed = parseSearchJobRuntimeContext(jobRow());
  assert.equal(parsed.brandId, '11');
  assert.equal(parsed.brandLocationId, '21');
  assert.equal(parsed.settings.targetCountry, 'United Kingdom');
  assert.equal(parsed.settings.targetLanguage, 'English');
  assert.equal(parsed.settings.userBrand, 'selecdoo.com');
  assert.equal(parsed.settings.isOnboarding, false);
  assert.equal(parsed.isActive, true);
});

test('onboarding mode is read from the immutable search snapshot', () => {
  const row = jobRow();
  const snapshot = row.settings_snapshot as {
    search: Record<string, unknown>;
  };
  snapshot.search.isOnboarding = true;
  const parsed = parseSearchJobRuntimeContext(row);
  assert.equal(parsed.settings.isOnboarding, true);
});

test('mismatched ownership provenance fails closed', () => {
  assert.throws(
    () => parseSearchJobRuntimeContext(jobRow({ brand_location_id: '22' })),
    (error: unknown) => error instanceof SearchStatusIntegrityError
      && /snapshot location does not match/i.test(error.message),
  );
});

test('result deduplication preserves the first exact occurrence and trims links', () => {
  const deduped = dedupeSearchResults([
    { title: 'First', link: ' https://example.com/a ', domain: 'example.com', source: 'Web', snippet: '' },
    { title: 'Second', link: 'https://example.com/a', domain: 'example.com', source: 'Web', snippet: '' },
    { title: 'Video', link: 'https://youtube.com/watch?v=1', domain: 'youtube.com', source: 'YouTube', snippet: '' },
  ]);
  assert.equal(deduped.length, 2);
  assert.equal(deduped[0].title, 'First');
  assert.equal(deduped[0].link, 'https://example.com/a');
  assert.deepEqual(countResultSources(deduped), {
    Web: 1,
    YouTube: 1,
    Instagram: 0,
    TikTok: 0,
  });
});

test('invalid result links and malformed raw snapshots fail closed', () => {
  assert.throws(
    () => dedupeSearchResults([
      { title: 'Missing', link: '', domain: '', source: 'Web', snippet: '' },
    ]),
    SearchStatusIntegrityError,
  );
  assert.throws(
    () => parseSearchJobRuntimeContext(jobRow({ raw_results: '[null]' })),
    SearchStatusIntegrityError,
  );
});

test('result snapshots replace malformed provider Unicode but preserve valid emoji', () => {
  const normalized = normalizeResultSnapshot({
    title: 'Valid emoji \ud83e\uddf5 and broken high \ud83e',
    link: 'https://example.com/unicode',
    domain: 'example.com',
    source: 'Web',
    snippet: 'Broken low \udc00',
    channel: {
      name: 'Creator \ud83d\ude80',
      link: 'https://example.com/creator',
    },
  });

  assert.equal(normalized.title, 'Valid emoji \ud83e\uddf5 and broken high \ufffd');
  assert.equal(normalized.snippet, 'Broken low \ufffd');
  assert.equal(normalized.channel?.name, 'Creator \ud83d\ude80');
});

test('provider text truncation never cuts an emoji in half', () => {
  assert.equal(truncateProviderText(`1234\ud83e\uddf5rest`, 5), `1234\ud83e\uddf5`);
  assert.equal(truncateProviderText(`1234\ud83e\uddf5rest`, 4), '1234');
  assert.equal(truncateProviderText(`broken \ud83e`, 20), 'broken \ufffd');
  assert.equal(truncateProviderText(null, 20), undefined);
  assert.equal(truncateProviderText(123, 20), undefined);
  assert.throws(
    () => truncateProviderText('text', -1),
    SearchStatusIntegrityError,
  );
});
