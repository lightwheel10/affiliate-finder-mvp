import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import {
  assertSafeSuggestionRequest,
  readSuggestionJson,
  SuggestionRequestError,
} from '../../src/lib/suggestions/request';

function request(options: {
  origin?: string;
  contentType?: string;
  body?: string;
  contentLength?: string;
} = {}) {
  const headers = new Headers();
  if (options.origin !== undefined) headers.set('origin', options.origin);
  if (options.contentType !== undefined) headers.set('content-type', options.contentType);
  if (options.contentLength !== undefined) headers.set('content-length', options.contentLength);
  return new NextRequest('https://app.example/api/suggestions/generate', {
    method: 'POST',
    headers,
    body: options.body,
  });
}

test('suggestion JSON accepts a same-origin bounded mutation', async () => {
  const input = { brandUrl: 'selecdoo.com', targetCountry: 'Germany' };
  const candidate = request({
    origin: 'https://app.example',
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(input),
  });
  assert.doesNotThrow(() => assertSafeSuggestionRequest(candidate));
  assert.deepEqual(await readSuggestionJson(candidate), input);
});

test('suggestion mutations reject missing, malformed, and foreign origins', () => {
  for (const origin of [undefined, 'not a url', 'https://attacker.example']) {
    assert.throws(
      () => assertSafeSuggestionRequest(request({
        origin,
        contentType: 'application/json',
        body: '{}',
      })),
      (error: unknown) => {
        assert.ok(error instanceof SuggestionRequestError);
        assert.equal(error.code, 'INVALID_REQUEST_ORIGIN');
        assert.equal(error.status, 403);
        return true;
      },
    );
  }
});

test('suggestion mutations require JSON and reject declared oversized bodies', () => {
  assert.throws(
    () => assertSafeSuggestionRequest(request({
      origin: 'https://app.example',
      contentType: 'text/plain',
      body: '{}',
    })),
    (error: unknown) => {
      assert.ok(error instanceof SuggestionRequestError);
      assert.equal(error.code, 'UNSUPPORTED_MEDIA_TYPE');
      return true;
    },
  );
  assert.throws(
    () => assertSafeSuggestionRequest(request({
      origin: 'https://app.example',
      contentType: 'application/json',
      contentLength: String(4 * 1_024 + 1),
      body: '{}',
    })),
    (error: unknown) => {
      assert.ok(error instanceof SuggestionRequestError);
      assert.equal(error.code, 'REQUEST_TOO_LARGE');
      assert.equal(error.status, 413);
      return true;
    },
  );
});

test('streamed suggestion bodies cannot bypass the byte limit', async () => {
  const candidate = request({
    origin: 'https://app.example',
    contentType: 'application/json',
    body: 'a'.repeat(4 * 1_024 + 1),
  });
  assert.equal(candidate.headers.get('content-length'), null);
  assert.doesNotThrow(() => assertSafeSuggestionRequest(candidate));
  await assert.rejects(readSuggestionJson(candidate), (error: unknown) => {
    assert.ok(error instanceof SuggestionRequestError);
    assert.equal(error.code, 'REQUEST_TOO_LARGE');
    assert.equal(error.status, 413);
    return true;
  });
});

test('malformed suggestion JSON remains a client error', async () => {
  const candidate = request({
    origin: 'https://app.example',
    contentType: 'application/json',
    body: '{',
  });
  assert.doesNotThrow(() => assertSafeSuggestionRequest(candidate));
  await assert.rejects(readSuggestionJson(candidate), SyntaxError);
});
