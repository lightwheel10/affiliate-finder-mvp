import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test, { type TestContext } from 'node:test';
import {
  applyPending,
  extractProjectRef,
  rollbackLatest,
  verifyRepository,
} from '../../scripts/migrations/manage.mjs';

const stagingProjectRef = 'aaaaaaaaaaaaaaaaaaaa';
const productionProjectRef = 'bbbbbbbbbbbbbbbbbbbb';

test('database target extraction accepts only Supabase-owned database hosts', () => {
  assert.equal(
    extractProjectRef(
      `postgresql://postgres.${stagingProjectRef}:secret@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`,
    ),
    stagingProjectRef,
  );
  assert.equal(
    extractProjectRef(
      `postgresql://postgres:secret@db.${stagingProjectRef}.supabase.co:5432/postgres`,
    ),
    stagingProjectRef,
  );
  assert.throws(
    () => extractProjectRef(
      `postgresql://postgres.${stagingProjectRef}:secret@attacker.invalid:5432/postgres`,
    ),
    /Supabase-owned database host/,
  );
  assert.throws(
    () => extractProjectRef(
      `postgresql://postgres.${stagingProjectRef}:secret@aws-0-eu-central-1.pooler.supabase.com:9999/postgres`,
    ),
    /unexpected Supabase database port/,
  );
});

function sha256(content: string | Buffer) {
  return createHash('sha256').update(content).digest('hex');
}

function createMigrationFixture(t: TestContext) {
  const directory = mkdtempSync(
    path.join(tmpdir(), 'affiliate-finder-migrations-'),
  );
  t.after(() => {
    assert.equal(path.dirname(directory), tmpdir());
    assert.match(path.basename(directory), /^affiliate-finder-migrations-/);
    rmSync(directory, { recursive: true, force: true });
  });

  const sql = {
    ledgerUp: 'CREATE TABLE crewcast.schema_migrations (version text);',
    ledgerDown: 'DROP TABLE crewcast.schema_migrations;',
    featureUp: 'CREATE TABLE crewcast.safe_feature (id bigint);',
    featureDown: 'DROP TABLE crewcast.safe_feature;',
  };
  const files = {
    ledgerUp: '0000_migration_ledger.up.sql',
    ledgerDown: '0000_migration_ledger.down.sql',
    featureUp: '0001_safe_feature.up.sql',
    featureDown: '0001_safe_feature.down.sql',
  };

  writeFileSync(
    path.join(directory, 'config.json'),
    JSON.stringify({
      schema: 'crewcast',
      ledgerTable: 'schema_migrations',
      advisoryLockKey: 'affiliate-finder:test:migrations',
      stagingProjectRef,
      productionProjectRef,
    }),
  );
  for (const [key, fileName] of Object.entries(files)) {
    writeFileSync(path.join(directory, fileName), sql[key as keyof typeof sql]);
  }
  writeFileSync(
    path.join(directory, 'manifest.json'),
    JSON.stringify({
      schemaVersion: 1,
      migrations: [
        {
          version: '0000',
          name: 'migration_ledger',
          up: files.ledgerUp,
          down: files.ledgerDown,
          upSha256: sha256(sql.ledgerUp),
          downSha256: sha256(sql.ledgerDown),
        },
        {
          version: '0001',
          name: 'safe_feature',
          up: files.featureUp,
          down: files.featureDown,
          upSha256: sha256(sql.featureUp),
          downSha256: sha256(sql.featureDown),
        },
      ],
    }),
  );

  return { directory, files, sql };
}

type AppliedMigration = {
  version: string;
  name: string;
  checksum_sha256: string;
};

type UnsafeCall = {
  text: string;
  parameters?: readonly unknown[];
};

function createSqlHarness(options: {
  applied?: AppliedMigration[];
  ledgerPresent?: boolean;
  ledgerBootstrapSql?: string;
}) {
  const unsafeCalls: UnsafeCall[] = [];
  let ledgerPresent = options.ledgerPresent ?? false;

  const transaction = (async (strings: TemplateStringsArray) => {
    const text = strings.join('');
    if (text.includes('to_regclass')) {
      return [{ relation: ledgerPresent ? 'crewcast.schema_migrations' : null }];
    }
    return [];
  }) as ((strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>) & {
    unsafe: (
      text: string,
      parameters?: readonly unknown[],
    ) => Promise<unknown[]>;
  };

  transaction.unsafe = async (text, parameters) => {
    unsafeCalls.push({ text, parameters });
    if (text.includes('SELECT version, name, checksum_sha256')) {
      return options.applied ?? [];
    }
    if (text === options.ledgerBootstrapSql) {
      ledgerPresent = true;
    }
    return [];
  };

  const sql = {
    begin: async <T>(action: (transaction_: typeof transaction) => Promise<T>) =>
      action(transaction),
  };

  return { sql, unsafeCalls };
}

test('apply executes the verified SQL after the up file is replaced', async (t) => {
  const fixture = createMigrationFixture(t);
  const { config, manifest, verifiedSqlByVersion } = verifyRepository(
    fixture.directory,
  );
  const replacement = 'DROP TABLE crewcast.users;';
  writeFileSync(path.join(fixture.directory, fixture.files.featureUp), replacement);

  const harness = createSqlHarness({
    ledgerBootstrapSql: fixture.sql.ledgerUp,
  });
  await applyPending(
    harness.sql,
    config,
    manifest,
    verifiedSqlByVersion,
  );

  const executedWithoutParameters = harness.unsafeCalls
    .filter((call) => call.parameters === undefined)
    .map((call) => call.text);
  assert.deepEqual(executedWithoutParameters, [
    fixture.sql.ledgerUp,
    fixture.sql.featureUp,
  ]);
  assert.equal(executedWithoutParameters.includes(replacement), false);
});

test('apply can stop at an additive rolling-deployment boundary', async (t) => {
  const fixture = createMigrationFixture(t);
  const { config, manifest, verifiedSqlByVersion } = verifyRepository(
    fixture.directory,
  );
  const harness = createSqlHarness({
    ledgerBootstrapSql: fixture.sql.ledgerUp,
  });

  await applyPending(
    harness.sql,
    config,
    manifest,
    verifiedSqlByVersion,
    '0000',
  );

  const executedWithoutParameters = harness.unsafeCalls
    .filter((call) => call.parameters === undefined)
    .map((call) => call.text);
  assert.deepEqual(executedWithoutParameters, [fixture.sql.ledgerUp]);
  assert.equal(executedWithoutParameters.includes(fixture.sql.featureUp), false);
});

test('rollback executes the verified SQL after the down file is replaced', async (t) => {
  const fixture = createMigrationFixture(t);
  const { config, manifest, verifiedSqlByVersion } = verifyRepository(
    fixture.directory,
  );
  const replacement = 'DROP SCHEMA crewcast CASCADE;';
  writeFileSync(
    path.join(fixture.directory, fixture.files.featureDown),
    replacement,
  );

  const harness = createSqlHarness({
    ledgerPresent: true,
    applied: manifest.migrations.map((migration: {
      version: string;
      name: string;
      upSha256: string;
    }) => ({
      version: migration.version,
      name: migration.name,
      checksum_sha256: migration.upSha256,
    })),
  });
  await rollbackLatest(
    harness.sql,
    config,
    manifest,
    { rollbackVersion: '0001', allowLedgerRollback: false },
    verifiedSqlByVersion,
  );

  assert.equal(harness.unsafeCalls.at(-1)?.text, fixture.sql.featureDown);
  assert.equal(
    harness.unsafeCalls.some((call) => call.text === replacement),
    false,
  );
});

test('verification rejects non-UTF-8 bytes even when their checksum is listed', (t) => {
  const fixture = createMigrationFixture(t);
  const invalidBytes = Buffer.from([0xff, 0xfe, 0xfd]);
  const manifestPath = path.join(fixture.directory, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  writeFileSync(path.join(fixture.directory, fixture.files.featureUp), invalidBytes);
  manifest.migrations[1].upSha256 = sha256(invalidBytes);
  writeFileSync(manifestPath, JSON.stringify(manifest));

  assert.throws(
    () => verifyRepository(fixture.directory),
    /Migration file is not valid UTF-8: 0001_safe_feature\.up\.sql\./,
  );
});
