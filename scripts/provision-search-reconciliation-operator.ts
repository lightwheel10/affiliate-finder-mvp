import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { parse as parseEnvironment } from 'dotenv';
import postgres from 'postgres';

interface Arguments {
  email: string;
  displayName: string | null;
  environmentFile: string;
  expectedProjectRef: string;
}

function parseArguments(values: readonly string[]): Arguments {
  const options = new Map<string, string>();
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index];
    const value = values[index + 1];
    if (!key?.startsWith('--') || !value) {
      throw new Error('Every operator-provisioning option requires one value.');
    }
    if (options.has(key)) throw new Error(`Duplicate option: ${key}`);
    options.set(key, value);
  }
  const allowed = new Set([
    '--email',
    '--display-name',
    '--env-file',
    '--expected-project-ref',
  ]);
  const unknown = [...options.keys()].find((key) => !allowed.has(key));
  if (unknown) throw new Error(`Unknown option: ${unknown}`);

  const email = options.get('--email')?.trim().toLowerCase();
  const expectedProjectRef = options.get('--expected-project-ref')?.trim();
  const environmentFile = options.get('--env-file')?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
    throw new Error('A valid --email is required.');
  }
  if (!expectedProjectRef || !/^[a-z0-9]{20}$/.test(expectedProjectRef)) {
    throw new Error('A canonical --expected-project-ref is required.');
  }
  if (!environmentFile) throw new Error('--env-file is required.');

  return {
    email,
    displayName: options.get('--display-name')?.trim() || null,
    environmentFile: path.resolve(process.cwd(), environmentFile),
    expectedProjectRef,
  };
}

function extractProjectRef(connectionUrl: string): string {
  const parsed = new URL(connectionUrl);
  const candidates = new Set<string>();
  const direct = parsed.hostname.match(/^db\.([a-z0-9]{20})\.supabase\.co$/);
  if (direct) candidates.add(direct[1]);
  const pooler = decodeURIComponent(parsed.username).match(/^postgres\.([a-z0-9]{20})$/);
  if (pooler && parsed.hostname.endsWith('.pooler.supabase.com')) {
    candidates.add(pooler[1]);
  }
  if (candidates.size !== 1) {
    throw new Error('Could not prove one Supabase project from the database URL.');
  }
  return [...candidates][0];
}

async function main(): Promise<void> {
  const options = parseArguments(process.argv.slice(2));
  const environment = parseEnvironment(fs.readFileSync(options.environmentFile));
  const databaseUrl = environment.SUPABASE_DATABASE_URL;
  if (!databaseUrl) throw new Error('SUPABASE_DATABASE_URL is missing from the environment file.');
  const actualProjectRef = extractProjectRef(databaseUrl);
  if (actualProjectRef !== options.expectedProjectRef) {
    throw new Error(
      `Refusing operator provisioning: expected ${options.expectedProjectRef}, received ${actualProjectRef}.`,
    );
  }

  const database = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 5,
  });
  try {
    const result = await database.begin(async (transaction) => {
      const users = await transaction<{ id: string; email: string }[]>`
        SELECT id::text AS id, email
        FROM auth.users
        WHERE lower(email) = ${options.email}
        LIMIT 2
      `;
      if (users.length !== 1) {
        throw new Error('Expected exactly one matching Supabase Auth user.');
      }

      await transaction`
        INSERT INTO crewcast.search_reconciliation_operators (
          auth_user_id,
          email,
          display_name,
          is_active
        ) VALUES (
          ${users[0].id}::uuid,
          ${users[0].email},
          ${options.displayName},
          true
        )
        ON CONFLICT (auth_user_id) DO UPDATE SET
          email = EXCLUDED.email,
          display_name = EXCLUDED.display_name,
          is_active = true
      `;

      const active = await transaction<{ count: number }[]>`
        SELECT count(*)::integer AS count
        FROM crewcast.search_reconciliation_operators
        WHERE auth_user_id = ${users[0].id}::uuid
          AND is_active
      `;
      return active[0]?.count === 1;
    });
    if (!result) throw new Error('The operator row was not active after provisioning.');
    console.log(JSON.stringify({
      projectRef: actualProjectRef,
      authUserMatched: true,
      operatorActive: true,
    }));
  } finally {
    await database.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(
    'Search-reconciliation operator provisioning failed:',
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});
