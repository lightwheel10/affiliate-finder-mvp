#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";
import postgres from "postgres";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..", "..");
const migrationsDirectory = path.join(projectRoot, "supabase", "migrations");

function fail(message) {
  throw new Error(message);
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function assertIdentifier(value, label) {
  if (typeof value !== "string" || !/^[a-z_][a-z0-9_]*$/.test(value)) {
    fail(`${label} is not a safe PostgreSQL identifier.`);
  }
}

function assertProjectRef(value, label) {
  if (typeof value !== "string" || !/^[a-z0-9]{20}$/.test(value)) {
    fail(`${label} is not a valid Supabase project reference.`);
  }
}

function verifyRepository(repositoryDirectory = migrationsDirectory) {
  const config = readJson(path.join(repositoryDirectory, "config.json"));
  const manifest = readJson(path.join(repositoryDirectory, "manifest.json"));

  assertIdentifier(config.schema, "config.schema");
  assertIdentifier(config.ledgerTable, "config.ledgerTable");
  assertProjectRef(config.stagingProjectRef, "config.stagingProjectRef");
  assertProjectRef(config.productionProjectRef, "config.productionProjectRef");

  if (
    typeof config.advisoryLockKey !== "string" ||
    config.advisoryLockKey.length < 8
  ) {
    fail("config.advisoryLockKey must be a stable non-empty string.");
  }

  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.migrations)) {
    fail("manifest.json must use schemaVersion 1 and contain a migrations array.");
  }

  if (manifest.migrations.length === 0) {
    fail("manifest.json must contain at least the migration-ledger migration.");
  }

  const expectedSqlFiles = new Set();
  const seenVersions = new Set();
  const verifiedSqlByVersion = new Map();
  let previousVersion = "";

  for (const migration of manifest.migrations) {
    const { version, name, up, down, upSha256, downSha256 } = migration;

    if (typeof version !== "string" || !/^\d{4}$/.test(version)) {
      fail(`Invalid migration version: ${String(version)}.`);
    }
    if (typeof name !== "string" || !/^[a-z0-9_]+$/.test(name)) {
      fail(`Invalid migration name for ${version}.`);
    }
    if (seenVersions.has(version)) {
      fail(`Duplicate migration version: ${version}.`);
    }
    if (previousVersion && version <= previousVersion) {
      fail("Migrations must be listed in strictly increasing version order.");
    }

    const expectedUp = `${version}_${name}.up.sql`;
    const expectedDown = `${version}_${name}.down.sql`;
    if (up !== expectedUp || down !== expectedDown) {
      fail(`${version} filenames must exactly match its version and name.`);
    }
    if (!/^[0-9a-f]{64}$/.test(upSha256 ?? "")) {
      fail(`${version} has an invalid upSha256.`);
    }
    if (!/^[0-9a-f]{64}$/.test(downSha256 ?? "")) {
      fail(`${version} has an invalid downSha256.`);
    }

    const verifiedSql = {};
    for (const [direction, fileName, expectedHash] of [
      ["up", up, upSha256],
      ["down", down, downSha256],
    ]) {
      const filePath = path.join(repositoryDirectory, fileName);
      let fileBytes;
      let actualHash;
      try {
        fileBytes = readFileSync(filePath);
        actualHash = sha256(fileBytes);
      } catch {
        fail(`Missing migration file: ${fileName}.`);
      }
      if (actualHash !== expectedHash) {
        fail(`Checksum mismatch for ${fileName}.`);
      }
      const sqlText = fileBytes.toString("utf8");
      if (!Buffer.from(sqlText, "utf8").equals(fileBytes)) {
        fail(`Migration file is not valid UTF-8: ${fileName}.`);
      }
      if (sqlText.trim().length === 0) {
        fail(`Migration file is empty: ${fileName}.`);
      }
      verifiedSql[direction] = sqlText;
      expectedSqlFiles.add(fileName);
    }

    verifiedSqlByVersion.set(version, Object.freeze(verifiedSql));
    seenVersions.add(version);
    previousVersion = version;
  }

  if (manifest.migrations[0].version !== "0000") {
    fail("The first migration must be 0000_migration_ledger.");
  }

  const actualSqlFiles = readdirSync(repositoryDirectory)
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort();
  const expectedSorted = [...expectedSqlFiles].sort();
  if (JSON.stringify(actualSqlFiles) !== JSON.stringify(expectedSorted)) {
    fail("Every SQL migration file must be listed exactly once in manifest.json.");
  }

  return { config, manifest, verifiedSqlByVersion };
}

function requireVerifiedSql(verifiedSqlByVersion, version, direction) {
  const sqlText = verifiedSqlByVersion.get(version)?.[direction];
  if (typeof sqlText !== "string") {
    fail(`Verified ${direction} SQL is unavailable for migration ${version}.`);
  }
  return sqlText;
}

function parseArguments(argv) {
  const result = {
    mode: "verify",
    rollbackVersion: null,
    target: null,
    confirmProject: null,
    allowLedgerRollback: false,
    throughVersion: null,
  };
  let explicitMode = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (["--verify", "--status", "--apply"].includes(argument)) {
      if (explicitMode) fail("Choose exactly one migration mode.");
      result.mode = argument.slice(2);
      explicitMode = true;
    } else if (argument === "--rollback") {
      if (explicitMode) fail("Choose exactly one migration mode.");
      result.mode = "rollback";
      result.rollbackVersion = argv[index + 1] ?? null;
      explicitMode = true;
      index += 1;
    } else if (argument === "--target") {
      result.target = argv[index + 1] ?? null;
      index += 1;
    } else if (argument === "--confirm-project") {
      result.confirmProject = argv[index + 1] ?? null;
      index += 1;
    } else if (argument === "--allow-ledger-rollback") {
      result.allowLedgerRollback = true;
    } else if (argument === "--through") {
      result.throughVersion = argv[index + 1] ?? null;
      index += 1;
    } else {
      fail(`Unknown argument: ${argument}`);
    }
  }

  if (result.rollbackVersion && !/^\d{4}$/.test(result.rollbackVersion)) {
    fail("--rollback requires a four-digit migration version.");
  }
  if (result.throughVersion && !/^\d{4}$/.test(result.throughVersion)) {
    fail("--through requires a four-digit migration version.");
  }
  if (result.throughVersion && result.mode !== "apply") {
    fail("--through is valid only with --apply.");
  }

  return result;
}

function extractProjectRef(databaseUrl) {
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    fail("MIGRATION_DATABASE_URL is not a valid URL.");
  }

  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    fail("MIGRATION_DATABASE_URL must use the postgres or postgresql protocol.");
  }

  const candidates = new Set();
  const directHostMatch = parsed.hostname.match(
    /^db\.([a-z0-9]{20})\.supabase\.co$/,
  );
  const poolerHostMatch = parsed.hostname.match(
    /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+pooler\.supabase\.com$/,
  );
  if (!directHostMatch && !poolerHostMatch) {
    fail("MIGRATION_DATABASE_URL must use a Supabase-owned database host.");
  }
  const port = parsed.port || "5432";
  if (
    (directHostMatch && port !== "5432")
    || (poolerHostMatch && !["5432", "6543"].includes(port))
  ) {
    fail("MIGRATION_DATABASE_URL uses an unexpected Supabase database port.");
  }
  if (directHostMatch) candidates.add(directHostMatch[1]);

  let username;
  try {
    username = decodeURIComponent(parsed.username);
  } catch {
    fail("MIGRATION_DATABASE_URL contains an invalid encoded username.");
  }
  const poolerUserMatch = username.match(/^postgres\.([a-z0-9]{20})$/);
  if (poolerUserMatch) {
    if (!poolerHostMatch) {
      fail("A Supabase pooler username must be used with a Supabase pooler host.");
    }
    candidates.add(poolerUserMatch[1]);
  }

  if (candidates.size !== 1) {
    fail(
      "Could not prove exactly one Supabase project reference from MIGRATION_DATABASE_URL.",
    );
  }

  return [...candidates][0];
}

function validateDatabaseTarget(arguments_, config) {
  if (!["staging", "production"].includes(arguments_.target)) {
    fail("Database commands require --target staging or --target production.");
  }

  const expectedProject =
    arguments_.target === "staging"
      ? config.stagingProjectRef
      : config.productionProjectRef;
  if (arguments_.confirmProject !== expectedProject) {
    fail(`--confirm-project must exactly equal ${expectedProject}.`);
  }

  const databaseUrl = process.env.MIGRATION_DATABASE_URL;
  if (!databaseUrl) {
    fail(
      "Set MIGRATION_DATABASE_URL explicitly; application database variables are intentionally ignored.",
    );
  }

  const actualProject = extractProjectRef(databaseUrl);
  if (actualProject !== expectedProject) {
    fail(
      `Connection project ${actualProject} does not match ${arguments_.target} project ${expectedProject}.`,
    );
  }

  return { databaseUrl, expectedProject };
}

function assertWriteAllowed(arguments_) {
  if (process.env.MIGRATION_ALLOW_APPLY !== "true") {
    fail("Writes require MIGRATION_ALLOW_APPLY=true.");
  }
  if (
    arguments_.target === "production" &&
    process.env.MIGRATION_ALLOW_PRODUCTION !== "true"
  ) {
    fail("Production writes additionally require MIGRATION_ALLOW_PRODUCTION=true.");
  }
}

function quotedIdentifier(identifier) {
  assertIdentifier(identifier, "PostgreSQL identifier");
  return `"${identifier}"`;
}

function ledgerSql(config) {
  return `${quotedIdentifier(config.schema)}.${quotedIdentifier(config.ledgerTable)}`;
}

async function ledgerExists(sql, config) {
  const qualifiedName = `${config.schema}.${config.ledgerTable}`;
  const rows = await sql`SELECT to_regclass(${qualifiedName}) AS relation`;
  return Boolean(rows[0]?.relation);
}

async function readApplied(sql, config) {
  if (!(await ledgerExists(sql, config))) return [];
  return sql.unsafe(
    `SELECT version, name, checksum_sha256, applied_at, applied_by, execution_ms
       FROM ${ledgerSql(config)}
      ORDER BY version`,
  );
}

function assertKnownAppliedMigrations(applied, manifest) {
  const manifestByVersion = new Map(
    manifest.migrations.map((migration) => [migration.version, migration]),
  );
  for (const row of applied) {
    const migration = manifestByVersion.get(row.version);
    if (!migration) {
      fail(`Database contains unknown migration ${row.version}.`);
    }
    if (row.checksum_sha256 !== migration.upSha256) {
      fail(`Applied checksum differs from the repository for ${row.version}.`);
    }
  }

  const appliedVersions = applied.map((row) => row.version);
  const expectedPrefix = manifest.migrations
    .slice(0, appliedVersions.length)
    .map((migration) => migration.version);
  if (JSON.stringify(appliedVersions) !== JSON.stringify(expectedPrefix)) {
    fail("Applied migrations are not a contiguous prefix of manifest.json.");
  }
}

async function showStatus(sql, config, manifest, projectRef, target) {
  const applied = await sql.begin("read only", async (transaction) =>
    readApplied(transaction, config),
  );
  assertKnownAppliedMigrations(applied, manifest);

  const appliedByVersion = new Map(applied.map((row) => [row.version, row]));
  console.log(`Target verified: ${target} (${projectRef})`);
  console.log(
    `Migration ledger: ${applied.length === 0 ? "absent or empty" : `${applied.length} applied`}`,
  );
  for (const migration of manifest.migrations) {
    const row = appliedByVersion.get(migration.version);
    console.log(
      `${row ? "applied" : "pending"}  ${migration.version}_${migration.name}`,
    );
  }
}

/**
 * Apply the still-pending migration prefix, optionally stopping at an exact
 * additive compatibility boundary for a rolling deployment.
 *
 * @param {unknown} sql
 * @param {unknown} config
 * @param {unknown} manifest
 * @param {unknown} verifiedSqlByVersion
 * @param {string | null} throughVersion
 */
async function applyPending(
  sql,
  config,
  manifest,
  verifiedSqlByVersion,
  throughVersion = null,
) {
  if (
    throughVersion !== null
    && !manifest.migrations.some((migration) => migration.version === throughVersion)
  ) {
    fail(`--through references unknown migration ${throughVersion}.`);
  }

  await sql.begin(async (transaction) => {
    await transaction`SELECT pg_advisory_xact_lock(hashtextextended(${config.advisoryLockKey}, 0))`;
    const applied = await readApplied(transaction, config);
    assertKnownAppliedMigrations(applied, manifest);
    const appliedByVersion = new Set(applied.map((row) => row.version));

    for (const migration of manifest.migrations) {
      if (throughVersion !== null && migration.version > throughVersion) {
        console.log(`deferred ${migration.version}_${migration.name}`);
        continue;
      }
      if (appliedByVersion.has(migration.version)) {
        console.log(`skipped  ${migration.version}_${migration.name}`);
        continue;
      }

      const startedAt = Date.now();
      const sqlText = requireVerifiedSql(
        verifiedSqlByVersion,
        migration.version,
        "up",
      );
      await transaction.unsafe(sqlText);

      if (!(await ledgerExists(transaction, config))) {
        fail(`${migration.version} did not leave the migration ledger available.`);
      }

      const executionMs = Date.now() - startedAt;
      await transaction.unsafe(
        `INSERT INTO ${ledgerSql(config)}
          (version, name, checksum_sha256, execution_ms)
         VALUES ($1, $2, $3, $4)`,
        [
          migration.version,
          migration.name,
          migration.upSha256,
          executionMs,
        ],
      );
      console.log(`applied  ${migration.version}_${migration.name}`);
    }
  });
}

async function rollbackLatest(
  sql,
  config,
  manifest,
  arguments_,
  verifiedSqlByVersion,
) {
  await sql.begin(async (transaction) => {
    await transaction`SELECT pg_advisory_xact_lock(hashtextextended(${config.advisoryLockKey}, 0))`;
    const applied = await readApplied(transaction, config);
    assertKnownAppliedMigrations(applied, manifest);
    if (applied.length === 0) fail("No migration is available to roll back.");

    const appliedVersions = new Set(applied.map((row) => row.version));
    const latest = [...manifest.migrations]
      .reverse()
      .find((migration) => appliedVersions.has(migration.version));
    if (!latest || arguments_.rollbackVersion !== latest.version) {
      fail(
        `Only the latest applied migration (${latest?.version ?? "none"}) can be rolled back.`,
      );
    }
    if (latest.version === "0000" && !arguments_.allowLedgerRollback) {
      fail("Rolling back the ledger requires --allow-ledger-rollback.");
    }

    const sqlText = requireVerifiedSql(
      verifiedSqlByVersion,
      latest.version,
      "down",
    );
    await transaction.unsafe(
      `DELETE FROM ${ledgerSql(config)} WHERE version = $1`,
      [latest.version],
    );
    await transaction.unsafe(sqlText);
    console.log(`rolled back  ${latest.version}_${latest.name}`);
  });
}

async function main() {
  const arguments_ = parseArguments(process.argv.slice(2));
  const { config, manifest, verifiedSqlByVersion } = verifyRepository();
  console.log(
    `Repository verification passed: ${manifest.migrations.length} migration pair(s).`,
  );

  if (arguments_.mode === "verify") return;

  const { databaseUrl, expectedProject } = validateDatabaseTarget(
    arguments_,
    config,
  );
  if (["apply", "rollback"].includes(arguments_.mode)) {
    assertWriteAllowed(arguments_);
  }

  const sql = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 2,
  });

  try {
    if (arguments_.mode === "status") {
      await showStatus(
        sql,
        config,
        manifest,
        expectedProject,
        arguments_.target,
      );
    } else if (arguments_.mode === "apply") {
      await applyPending(
        sql,
        config,
        manifest,
        verifiedSqlByVersion,
        arguments_.throughVersion,
      );
    } else {
      await rollbackLatest(
        sql,
        config,
        manifest,
        arguments_,
        verifiedSqlByVersion,
      );
    }
  } finally {
    await sql.end({ timeout: 2 });
  }
}

if (
  process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(`Migration command failed: ${error.message}`);
    process.exitCode = 1;
  });
}

export { applyPending, extractProjectRef, rollbackLatest, verifyRepository };
