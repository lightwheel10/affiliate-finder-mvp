import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isPublicIpAddress,
  probePublicWebsite,
  PublicWebsiteRequestError,
  type PublicAddress,
  type PublicWebsiteProbeDependencies,
} from '../../src/lib/network/public-website';

const PUBLIC_V4: PublicAddress = { address: '93.184.216.34', family: 4 };
const PUBLIC_V4_ALTERNATE: PublicAddress = { address: '1.1.1.1', family: 4 };
const PUBLIC_V6: PublicAddress = { address: '2606:4700:4700::1111', family: 6 };

function assertRequestError(
  error: unknown,
  code: PublicWebsiteRequestError['code'],
): boolean {
  assert.ok(error instanceof PublicWebsiteRequestError);
  assert.equal(error.code, code);
  return true;
}

test('public IP classification rejects private, local, translated, and reserved forms', () => {
  for (const address of [PUBLIC_V4.address, PUBLIC_V6.address]) {
    assert.equal(isPublicIpAddress(address), true, address);
  }

  for (const address of [
    '0.0.0.0',
    '10.0.0.1',
    '100.64.0.1',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '192.168.0.1',
    '192.0.2.1',
    '198.18.0.1',
    '224.0.0.1',
    '::',
    '::1',
    '::ffff:127.0.0.1',
    '64:ff9b::7f00:1',
    'fc00::1',
    'fe80::1',
    'ff00::1',
    '2001:db8::1',
  ]) {
    assert.equal(isPublicIpAddress(address), false, address);
  }
});

test('a private DNS result is rejected before any network request', async () => {
  let requestCount = 0;
  await assert.rejects(
    probePublicWebsite('https://brand.example.test', {}, {
      resolve: async () => [{ address: '127.0.0.1', family: 4 }],
      request: async () => {
        requestCount += 1;
        return { headers: {}, status: 200 };
      },
    }),
    (error) => assertRequestError(error, 'UNSAFE_DESTINATION'),
  );
  assert.equal(requestCount, 0);
});

test('mixed public and private DNS answers fail closed before connecting', async () => {
  let requestCount = 0;
  await assert.rejects(
    probePublicWebsite('https://brand.example.test', {}, {
      resolve: async () => [PUBLIC_V4, { address: '10.0.0.7', family: 4 }],
      request: async () => {
        requestCount += 1;
        return { headers: {}, status: 200 };
      },
    }),
    (error) => assertRequestError(error, 'UNSAFE_DESTINATION'),
  );
  assert.equal(requestCount, 0);
});

test('public-to-private redirects are rejected without contacting the private host', async () => {
  const requestedHosts: string[] = [];
  await assert.rejects(
    probePublicWebsite('https://brand.example.test', {}, {
      resolve: async (hostname) => hostname === 'brand.example.test'
        ? [PUBLIC_V4]
        : [{ address: '169.254.169.254', family: 4 }],
      request: async (url) => {
        requestedHosts.push(url.hostname);
        return {
          headers: { location: 'http://metadata.example.test/latest' },
          status: 302,
        };
      },
    }),
    (error) => assertRequestError(error, 'UNSAFE_DESTINATION'),
  );
  assert.deepEqual(requestedHosts, ['brand.example.test']);
});

test('a same-host DNS rebind on redirect is rejected before the second request', async () => {
  let resolutionCount = 0;
  let requestCount = 0;
  await assert.rejects(
    probePublicWebsite('https://brand.example.test/start', {}, {
      resolve: async () => {
        resolutionCount += 1;
        return resolutionCount === 1
          ? [PUBLIC_V4]
          : [{ address: '192.168.1.50', family: 4 }];
      },
      request: async () => {
        requestCount += 1;
        return {
          headers: { location: '/next' },
          status: 302,
        };
      },
    }),
    (error) => assertRequestError(error, 'UNSAFE_DESTINATION'),
  );
  assert.equal(resolutionCount, 2);
  assert.equal(requestCount, 1);
});

test('bounded public redirects preserve the original hostname and pin each checked address', async () => {
  const connections: Array<{ address: PublicAddress; hostname: string }> = [];
  const result = await probePublicWebsite('https://brand.example.test/start', {}, {
    resolve: async (hostname) => hostname === 'brand.example.test'
      ? [PUBLIC_V4]
      : [PUBLIC_V6],
    request: async (url, address) => {
      connections.push({ address, hostname: url.hostname });
      if (url.hostname === 'brand.example.test') {
        return {
          headers: { location: 'https://www.brand.example.test/landing' },
          status: 301,
        };
      }
      return { headers: {}, status: 200 };
    },
  });

  assert.deepEqual(connections, [
    { address: PUBLIC_V4, hostname: 'brand.example.test' },
    { address: PUBLIC_V6, hostname: 'www.brand.example.test' },
  ]);
  assert.deepEqual(result, {
    finalUrl: 'https://www.brand.example.test/landing',
    redirects: 1,
    status: 200,
  });
});

test('all public DNS answers are available for bounded connection fallback', async () => {
  const attemptedAddresses: string[] = [];
  const dependencies: PublicWebsiteProbeDependencies = {
    resolve: async () => [PUBLIC_V4, PUBLIC_V4_ALTERNATE],
    request: async (_url, address) => {
      attemptedAddresses.push(address.address);
      if (address.address === PUBLIC_V4.address) throw new Error('first address unavailable');
      return { headers: {}, status: 404 };
    },
  };

  const result = await probePublicWebsite('https://brand.example.test', {}, dependencies);
  assert.deepEqual(attemptedAddresses, [PUBLIC_V4.address, PUBLIC_V4_ALTERNATE.address]);
  assert.equal(result.status, 404);
});

test('redirect loops and excessive redirects are bounded', async () => {
  await assert.rejects(
    probePublicWebsite('https://brand.example.test/a', {}, {
      resolve: async () => [PUBLIC_V4],
      request: async (url) => ({
        headers: { location: url.pathname === '/a' ? '/b' : '/a' },
        status: 302,
      }),
    }),
    (error) => assertRequestError(error, 'TOO_MANY_REDIRECTS'),
  );

  await assert.rejects(
    probePublicWebsite('https://brand.example.test/0', { maxRedirects: 2 }, {
      resolve: async () => [PUBLIC_V4],
      request: async (url) => ({
        headers: { location: `/${Number(url.pathname.slice(1)) + 1}` },
        status: 302,
      }),
    }),
    (error) => assertRequestError(error, 'TOO_MANY_REDIRECTS'),
  );
});

test('encoded loopback, credentials, non-web schemes, and non-standard ports are rejected', async () => {
  let requestCount = 0;
  const request: NonNullable<PublicWebsiteProbeDependencies['request']> = async () => {
    requestCount += 1;
    return { headers: {}, status: 200 };
  };

  for (const url of [
    'http://2130706433/',
    'http://0177.0.0.1/',
    'http://0x7f000001/',
    'http://[::ffff:127.0.0.1]/',
  ]) {
    await assert.rejects(
      probePublicWebsite(url, {}, { request }),
      (error) => assertRequestError(error, 'UNSAFE_DESTINATION'),
    );
  }

  for (const url of [
    'file:///etc/passwd',
    'https://user:password@brand.example.test/',
    'https://brand.example.test:8443/',
  ]) {
    await assert.rejects(
      probePublicWebsite(url, {}, { request }),
      (error) => assertRequestError(error, 'INVALID_DESTINATION'),
    );
  }
  assert.equal(requestCount, 0);
});

test('DNS lookup time is included in the total deadline', async () => {
  await assert.rejects(
    probePublicWebsite('https://brand.example.test', { timeoutMs: 20 }, {
      resolve: async () => new Promise<PublicAddress[]>(() => undefined),
      request: async () => ({ headers: {}, status: 200 }),
    }),
    (error) => assertRequestError(error, 'TIMEOUT'),
  );
});
