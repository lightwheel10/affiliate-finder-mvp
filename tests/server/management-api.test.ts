import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import {
  assertSafeManagementMutation,
  managementErrorResponse,
  readManagementJson,
} from '../../src/lib/brand-locations/management-api';

const url = 'https://staging.example.test/api/brands';

async function errorPayload(error: unknown) {
  const response = managementErrorResponse(error, 'Management request test');
  return {
    status: response.status,
    body: await response.json() as { code: string },
  };
}

test('management JSON accepts a same-origin bounded request', async () => {
  const request = new NextRequest(url, {
    method: 'POST',
    headers: {
      origin: 'https://staging.example.test',
      'content-type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({ name: 'Selecdoo' }),
  });
  assert.doesNotThrow(() => assertSafeManagementMutation(request, true));
  assert.deepEqual(await readManagementJson(request), { name: 'Selecdoo' });
});

test('management mutations fail closed for missing or foreign origins', async () => {
  for (const origin of [undefined, 'https://attacker.example.test']) {
    const request = new NextRequest(url, {
      method: 'POST',
      headers: {
        ...(origin ? { origin } : {}),
        'content-type': 'application/json',
      },
      body: '{}',
    });
    let thrown: unknown;
    try {
      assertSafeManagementMutation(request, true);
    } catch (error) {
      thrown = error;
    }
    const result = await errorPayload(thrown);
    assert.equal(result.status, 403);
    assert.equal(result.body.code, 'INVALID_REQUEST_ORIGIN');
  }
});

test('management JSON requires the JSON media type', async () => {
  const request = new NextRequest(url, {
    method: 'POST',
    headers: {
      origin: 'https://staging.example.test',
      'content-type': 'text/plain',
    },
    body: '{}',
  });
  let thrown: unknown;
  try {
    assertSafeManagementMutation(request, true);
  } catch (error) {
    thrown = error;
  }
  const result = await errorPayload(thrown);
  assert.equal(result.status, 415);
  assert.equal(result.body.code, 'UNSUPPORTED_MEDIA_TYPE');
});

test('management JSON enforces its real streamed byte limit without Content-Length', async () => {
  const request = new NextRequest(url, {
    method: 'POST',
    headers: {
      origin: 'https://staging.example.test',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ value: 'x'.repeat(70 * 1_024) }),
  });
  assert.equal(request.headers.get('content-length'), null);
  assertSafeManagementMutation(request, true);
  let thrown: unknown;
  try {
    await readManagementJson(request);
  } catch (error) {
    thrown = error;
  }
  const result = await errorPayload(thrown);
  assert.equal(result.status, 413);
  assert.equal(result.body.code, 'REQUEST_TOO_LARGE');
});

test('management JSON reports malformed bodies without exposing internals', async () => {
  const request = new NextRequest(url, {
    method: 'POST',
    headers: {
      origin: 'https://staging.example.test',
      'content-type': 'application/json',
    },
    body: '{',
  });
  assertSafeManagementMutation(request, true);
  let thrown: unknown;
  try {
    await readManagementJson(request);
  } catch (error) {
    thrown = error;
  }
  const result = await errorPayload(thrown);
  assert.equal(result.status, 400);
  assert.equal(result.body.code, 'INVALID_JSON');
});
