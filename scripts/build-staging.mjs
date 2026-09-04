import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { config as loadEnvironment } from 'dotenv';

const stagingProjectRef = 'jxerxreqezhdsisdwddw';
const productionProjectRef = 'mbhvufgafhpqmyaidgho';
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const args = new Set(process.argv.slice(2));
const supportedArgs = new Set(['--feature-on']);
for (const argument of args) {
  if (!supportedArgs.has(argument)) {
    throw new Error(`Unknown staging build argument: ${argument}`);
  }
}
const enableMultiBrandLocations = args.has('--feature-on');

const loaded = loadEnvironment({
  path: path.join(projectRoot, '.env.staging.local'),
  override: true,
  quiet: true,
});
if (loaded.error) throw loaded.error;

const publicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!publicSupabaseUrl) throw new Error('Staging Supabase URL is missing.');
const publicHost = new URL(publicSupabaseUrl).hostname;
if (publicHost !== `${stagingProjectRef}.supabase.co`) {
  throw new Error('Refusing to build: public Supabase URL is not Terminal-Backup.');
}

const parsedValues = Object.values(loaded.parsed ?? {});
if (parsedValues.some((value) => value.includes(productionProjectRef))) {
  throw new Error('Refusing to build: staging environment contains the production project reference.');
}
if (enableMultiBrandLocations) {
  process.env.NEXT_PUBLIC_MULTI_BRAND_LOCATIONS_ENABLED = 'true';
} else if (process.env.NEXT_PUBLIC_MULTI_BRAND_LOCATIONS_ENABLED === 'true') {
  throw new Error(
    'Refusing to build with the feature enabled unless --feature-on is explicit.',
  );
}
if (process.env.NEXT_PUBLIC_PAP_TRACKING_ENABLED !== 'false') {
  throw new Error('Refusing to build: affiliate tracking must be disabled in staging.');
}

const nextCli = path.join(projectRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
const result = spawnSync(process.execPath, [nextCli, 'build'], {
  cwd: projectRoot,
  env: process.env,
  stdio: 'inherit',
});
if (result.error) throw result.error;
if (result.status !== 0) {
  throw new Error(`Staging build failed with exit code ${String(result.status)}.`);
}
