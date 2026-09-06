import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import {
  affiliateRequestErrorResponse,
  AffiliateRequestGuardError,
  assertAffiliateLinkBatch,
  assertAffiliateObjectBatch,
  MAX_AFFILIATE_BATCH_BODY_BYTES,
  MAX_AFFILIATE_MUTATION_BODY_BYTES,
  MAX_OUTREACH_MUTATION_BODY_BYTES,
  readAffiliateMutationJson,
} from '../../src/lib/affiliates/server';
import {
  AFFILIATE_DELETE_BATCH_MAX_ITEMS,
  DISCOVERED_AFFILIATE_BATCH_MAX_ITEMS,
  SAVED_AFFILIATE_BATCH_MAX_ITEMS,
} from '../../src/lib/affiliates/mutation-limits';
import {
  DELETE as deleteSavedBatch,
  POST as saveBatch,
} from '../../src/app/api/affiliates/saved/batch/route';
import {
  DELETE as deleteDiscoveredBatch,
  POST as discoverBatch,
} from '../../src/app/api/affiliates/discovered/batch/route';
import {
  PATCH as updateSavedAffiliate,
  POST as saveAffiliate,
} from '../../src/app/api/affiliates/saved/route';
import {
  PATCH as updateDiscoveredAffiliate,
  POST as saveDiscoveredAffiliate,
} from '../../src/app/api/affiliates/discovered/route';
import { POST as enrichAffiliateEmail } from '../../src/app/api/enrich/email/route';
import {
  PATCH as editOutreach,
  POST as generateOutreach,
  resolveStoredOutreachContact,
} from '../../src/app/api/ai/outreach/route';

function request(
  url: string,
  body: BodyInit,
  contentLength?: number,
  method = 'POST',
): NextRequest {
  return new NextRequest(url, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(contentLength === undefined ? {} : { 'content-length': String(contentLength) }),
    },
    body,
  });
}

async function expectGuardError(
  operation: Promise<unknown>,
  code: string,
  status: number,
): Promise<void> {
  await assert.rejects(operation, (error: unknown) => {
    assert.ok(error instanceof AffiliateRequestGuardError);
    assert.equal(error.code, code);
    assert.equal(error.status, status);
    return true;
  });
}

test('affiliate JSON accepts an ordinary request', async () => {
  const body = { userId: 7, affiliates: [{ title: 'Normal result' }] };
  const candidate = request('https://preview.example/api/affiliates/saved/batch', JSON.stringify(body));
  assert.deepEqual(
    await readAffiliateMutationJson(candidate, MAX_AFFILIATE_BATCH_BODY_BYTES),
    body,
  );
});

test('declared, streamed, and false-small body lengths cannot bypass the byte limit', async () => {
  const exactLimitBody = `{}`.padEnd(MAX_AFFILIATE_MUTATION_BODY_BYTES, ' ');
  assert.deepEqual(
    await readAffiliateMutationJson(
      request('https://preview.example/api/affiliates/saved', exactLimitBody),
      MAX_AFFILIATE_MUTATION_BODY_BYTES,
    ),
    {},
  );

  await expectGuardError(
    readAffiliateMutationJson(
      request('https://preview.example/api/affiliates/saved', '{}', MAX_AFFILIATE_MUTATION_BODY_BYTES + 1),
      MAX_AFFILIATE_MUTATION_BODY_BYTES,
    ),
    'REQUEST_TOO_LARGE',
    413,
  );

  const oversized = JSON.stringify({ padding: 'x'.repeat(MAX_AFFILIATE_MUTATION_BODY_BYTES) });
  await expectGuardError(
    readAffiliateMutationJson(
      request('https://preview.example/api/affiliates/saved', oversized),
      MAX_AFFILIATE_MUTATION_BODY_BYTES,
    ),
    'REQUEST_TOO_LARGE',
    413,
  );
  await expectGuardError(
    readAffiliateMutationJson(
      request('https://preview.example/api/affiliates/saved', oversized, 2),
      MAX_AFFILIATE_MUTATION_BODY_BYTES,
    ),
    'REQUEST_TOO_LARGE',
    413,
  );
});

test('malformed, invalid UTF-8, oversized text, and excessive nesting fail safely', async () => {
  await expectGuardError(
    readAffiliateMutationJson(request('https://preview.example/api/affiliates/saved', '{')),
    'INVALID_JSON',
    400,
  );
  await expectGuardError(
    readAffiliateMutationJson(request(
      'https://preview.example/api/affiliates/saved',
      new Uint8Array([0xc3, 0x28]),
    )),
    'INVALID_JSON',
    400,
  );
  await expectGuardError(
    readAffiliateMutationJson(request(
      'https://preview.example/api/affiliates/saved',
      JSON.stringify({ title: 'x'.repeat(16 * 1_024 + 1) }),
    )),
    'REQUEST_TOO_LARGE',
    413,
  );

  let nested: unknown = 'value';
  for (let depth = 0; depth < 10; depth += 1) nested = { nested };
  await expectGuardError(
    readAffiliateMutationJson(request(
      'https://preview.example/api/affiliates/saved',
      JSON.stringify(nested),
    )),
    'INVALID_INPUT',
    400,
  );
});

test('server batch ceilings accept the boundary and reject one extra item', () => {
  assert.doesNotThrow(() => assertAffiliateObjectBatch(
    Array.from({ length: SAVED_AFFILIATE_BATCH_MAX_ITEMS }, () => ({})),
    SAVED_AFFILIATE_BATCH_MAX_ITEMS,
  ));
  assert.throws(
    () => assertAffiliateObjectBatch(
      Array.from({ length: SAVED_AFFILIATE_BATCH_MAX_ITEMS + 1 }, () => ({})),
      SAVED_AFFILIATE_BATCH_MAX_ITEMS,
    ),
    (error: unknown) => error instanceof AffiliateRequestGuardError
      && error.code === 'TOO_MANY_ITEMS',
  );
  assert.doesNotThrow(() => assertAffiliateObjectBatch(
    Array.from({ length: DISCOVERED_AFFILIATE_BATCH_MAX_ITEMS }, () => ({})),
    DISCOVERED_AFFILIATE_BATCH_MAX_ITEMS,
  ));
  assert.doesNotThrow(() => assertAffiliateLinkBatch(
    Array.from({ length: AFFILIATE_DELETE_BATCH_MAX_ITEMS }, (_, index) => `https://example.test/${index}`),
    AFFILIATE_DELETE_BATCH_MAX_ITEMS,
  ));
  assert.throws(
    () => assertAffiliateLinkBatch([{}], AFFILIATE_DELETE_BATCH_MAX_ITEMS),
    (error: unknown) => error instanceof AffiliateRequestGuardError
      && error.code === 'INVALID_INPUT',
  );
});

test('target routes return stable 413 JSON before authentication or side effects', async () => {
  const hugeBatchBody = JSON.stringify({ padding: 'x'.repeat(MAX_AFFILIATE_BATCH_BODY_BYTES) });
  const hugeOutreachBody = JSON.stringify({ padding: 'x'.repeat(MAX_OUTREACH_MUTATION_BODY_BYTES) });
  const responses = await Promise.all([
    saveBatch(request('https://preview.example/api/affiliates/saved/batch', hugeBatchBody)),
    discoverBatch(request('https://preview.example/api/affiliates/discovered/batch', hugeBatchBody)),
    deleteSavedBatch(request('https://preview.example/api/affiliates/saved/batch', hugeBatchBody, undefined, 'DELETE')),
    deleteDiscoveredBatch(request('https://preview.example/api/affiliates/discovered/batch', hugeBatchBody, undefined, 'DELETE')),
    saveAffiliate(request('https://preview.example/api/affiliates/saved', hugeOutreachBody)),
    updateSavedAffiliate(request('https://preview.example/api/affiliates/saved', hugeOutreachBody, undefined, 'PATCH')),
    saveDiscoveredAffiliate(request('https://preview.example/api/affiliates/discovered', hugeOutreachBody)),
    updateDiscoveredAffiliate(request('https://preview.example/api/affiliates/discovered', hugeOutreachBody, undefined, 'PATCH')),
    enrichAffiliateEmail(request('https://preview.example/api/enrich/email', hugeOutreachBody)),
    generateOutreach(request('https://preview.example/api/ai/outreach', hugeOutreachBody)),
    editOutreach(request('https://preview.example/api/ai/outreach', hugeOutreachBody, undefined, 'PATCH')),
  ]);

  for (const response of responses) {
    assert.equal(response.status, 413);
    assert.equal((await response.json()).code, 'REQUEST_TOO_LARGE');
  }
});

test('oversized batch counts return 413 before authentication or database work', async () => {
  const savedResponse = await saveBatch(request(
    'https://preview.example/api/affiliates/saved/batch',
    JSON.stringify({
      userId: 1,
      affiliates: Array.from({ length: SAVED_AFFILIATE_BATCH_MAX_ITEMS + 1 }, () => ({})),
    }),
  ));
  assert.equal(savedResponse.status, 413);
  assert.equal((await savedResponse.json()).code, 'TOO_MANY_ITEMS');

  const discoveredResponse = await discoverBatch(request(
    'https://preview.example/api/affiliates/discovered/batch',
    JSON.stringify({
      userId: 1,
      searchKeyword: 'safe limit test',
      affiliates: Array.from({ length: DISCOVERED_AFFILIATE_BATCH_MAX_ITEMS + 1 }, () => ({})),
    }),
  ));
  assert.equal(discoveredResponse.status, 413);
  assert.equal((await discoveredResponse.json()).code, 'TOO_MANY_ITEMS');

  const deleteResponse = await deleteSavedBatch(request(
    'https://preview.example/api/affiliates/saved/batch',
    JSON.stringify({
      userId: 1,
      links: Array.from(
        { length: AFFILIATE_DELETE_BATCH_MAX_ITEMS + 1 },
        (_, index) => `https://example.test/${index}`,
      ),
    }),
    undefined,
    'DELETE',
  ));
  assert.equal(deleteResponse.status, 413);
  assert.equal((await deleteResponse.json()).code, 'TOO_MANY_ITEMS');

  const deleteDiscoveredResponse = await deleteDiscoveredBatch(request(
    'https://preview.example/api/affiliates/discovered/batch',
    JSON.stringify({
      userId: 1,
      links: Array.from(
        { length: AFFILIATE_DELETE_BATCH_MAX_ITEMS + 1 },
        (_, index) => `https://example.test/${index}`,
      ),
    }),
    undefined,
    'DELETE',
  ));
  assert.equal(deleteDiscoveredResponse.status, 413);
  assert.equal((await deleteDiscoveredResponse.json()).code, 'TOO_MANY_ITEMS');
});

test('request guard errors use the shared affiliate JSON response contract', async () => {
  let thrown: unknown;
  try {
    await readAffiliateMutationJson(request('https://preview.example/api/affiliates/saved', '{'));
  } catch (error) {
    thrown = error;
  }
  assert.deepEqual(affiliateRequestErrorResponse(thrown), {
    status: 400,
    body: { error: 'Invalid JSON body.', code: 'INVALID_JSON' },
  });
});

test('outreach contact choices resolve only from stored affiliate enrichment data', () => {
  const stored = {
    emails: ['general@example.test'],
    firstName: 'General',
    contacts: [{
      emails: ['owner@example.test', 'work@example.test'],
      firstName: 'Stored',
      lastName: 'Owner',
      title: 'Partnerships',
    }],
  };

  assert.deepEqual(resolveStoredOutreachContact(stored, ' WORK@example.test '), {
    email: 'work@example.test',
    firstName: 'Stored',
    lastName: 'Owner',
    title: 'Partnerships',
  });
  assert.deepEqual(resolveStoredOutreachContact(JSON.stringify(stored), 'general@example.test'), {
    email: 'general@example.test',
    firstName: 'General',
    lastName: null,
    title: null,
  });
  assert.deepEqual(
    resolveStoredOutreachContact(null, 'primary@example.test', 'PRIMARY@example.test', 'Primary Person'),
    {
      email: 'PRIMARY@example.test',
      firstName: 'Primary Person',
      lastName: null,
      title: null,
    },
  );
  assert.equal(resolveStoredOutreachContact(stored, 'invented@example.test'), null);
  assert.equal(resolveStoredOutreachContact('{', 'owner@example.test'), null);
});
