import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';

import { GET } from '../../src/app/api/proxy-image/route';

const PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d,
]);

function requestFor(imageUrl: string): NextRequest {
  return new NextRequest(
    `https://app.example.test/api/proxy-image?url=${encodeURIComponent(imageUrl)}`,
  );
}

test('the image proxy returns a verified allowed image with a canonical type', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(PNG, {
    headers: { 'content-type': 'image/png' },
    status: 200,
  });
  try {
    const response = await GET(requestFor('https://i.ytimg.com/vi/example/default.png'));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/png');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), Buffer.from(PNG));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('the image proxy rejects malformed and unapproved starting destinations', async () => {
  const malformed = await GET(requestFor('not a URL'));
  assert.equal(malformed.status, 400);

  const privateHost = await GET(requestFor('https://127.0.0.1/internal'));
  assert.equal(privateHost.status, 403);

  const suffixConfusion = await GET(requestFor('https://ytimg.com.evil.test/image.png'));
  assert.equal(suffixConfusion.status, 403);
});

test('the image proxy cannot follow an allowed host redirect to a private address', async () => {
  const originalFetch = globalThis.fetch;
  let fetches = 0;
  globalThis.fetch = async () => {
    fetches += 1;
    return new Response(null, {
      headers: { location: 'http://127.0.0.1/latest/meta-data' },
      status: 302,
    });
  };
  try {
    const response = await GET(requestFor('https://i.ytimg.com/redirect'));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/gif');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(fetches, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('the image proxy rejects an oversized declared response and returns its safe fallback', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(PNG, {
    headers: {
      'content-length': String(8 * 1_024 * 1_024 + 1),
      'content-type': 'image/png',
    },
    status: 200,
  });
  try {
    const response = await GET(requestFor('https://i.ytimg.com/oversized.png'));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/gif');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
