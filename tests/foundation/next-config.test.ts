import assert from 'node:assert/strict';
import test from 'node:test';

import nextConfig from '../../next.config';

test('Pages API server-only markers are bundled for the Stripe webhook', () => {
  assert.ok(
    nextConfig.transpilePackages?.includes('server-only'),
    'Next must bundle server-only so Pages API routes do not execute its throwing default entry on Vercel',
  );
});

test('the PostgreSQL driver remains external in serverless functions', () => {
  assert.ok(
    nextConfig.serverExternalPackages?.includes('postgres'),
    'Bundling postgres breaks its TCP/TLS behavior in the Pages Router Stripe webhook',
  );
});
