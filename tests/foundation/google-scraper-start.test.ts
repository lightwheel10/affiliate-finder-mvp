import assert from 'node:assert/strict';
import test from 'node:test';
import { SearchProviderStartError } from '../../src/lib/search/start';

test('real Google adapter classifies missing configuration as definitely pre-provider', async () => {
  const previousToken = process.env.APIFY_API_TOKEN;
  delete process.env.APIFY_API_TOKEN;

  try {
    const { startGoogleSearchRun } = await import(
      '../../src/app/services/apify-google-scraper'
    );
    await assert.rejects(
      startGoogleSearchRun({
        keywords: ['affiliate software'],
        competitors: [],
        sources: ['Web'],
        targetCountry: 'United Kingdom',
        targetLanguage: 'English',
      }),
      (error: unknown) => error instanceof SearchProviderStartError
        && error.externalStartMayHaveSucceeded === false
        && /missing APIFY_API_TOKEN/.test(error.message),
    );
  } finally {
    if (previousToken === undefined) {
      delete process.env.APIFY_API_TOKEN;
    } else {
      process.env.APIFY_API_TOKEN = previousToken;
    }
  }
});
