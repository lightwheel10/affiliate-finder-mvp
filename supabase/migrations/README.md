# Database migration safety scaffold

This directory owns migrations for the existing `crewcast` schema only. Nothing
in this directory runs during `next build`, Vercel deployment or application
startup.

## Rules

- Name each pair `NNNN_description.up.sql` and
  `NNNN_description.down.sql`.
- Add both files and their SHA-256 hashes to `manifest.json`.
- Run `npm run migration:verify` after every SQL or manifest change.
- Keep migrations transactional. Start with additive, backwards-compatible
  changes; do not use `CREATE INDEX CONCURRENTLY` inside this runner.
- Never edit an applied migration. Add a new numbered migration instead.
- Use only `MIGRATION_DATABASE_URL`. The runner intentionally never falls back
  to the application's `SUPABASE_DATABASE_URL` or generic `DATABASE_URL`.
- The URL must use a recognized Supabase direct host or `*.pooler.supabase.com`
  on port 5432/6543; a project-looking username on another host is rejected.
- Never store database credentials in this directory, the tracker or Git.

## Guarded workflow

The runner validates every filename, pair and checksum before opening a database
connection. Database commands also require an explicit target and the exact
Supabase project reference. The known staging and production references are
recorded in `config.json`; no other project is accepted.

PowerShell example for read-only staging status:

```powershell
$env:MIGRATION_DATABASE_URL = '<Terminal-Backup session-pooler URL>'
npm run migration:status -- --target staging --confirm-project jxerxreqezhdsisdwddw
Remove-Item Env:MIGRATION_DATABASE_URL
```

Applying pending migrations requires a second opt-in:

```powershell
$env:MIGRATION_DATABASE_URL = '<Terminal-Backup session-pooler URL>'
$env:MIGRATION_ALLOW_APPLY = 'true'
node scripts/migrations/manage.mjs --apply --target staging --confirm-project jxerxreqezhdsisdwddw
Remove-Item Env:MIGRATION_ALLOW_APPLY
Remove-Item Env:MIGRATION_DATABASE_URL
```

For a rolling deployment, stop at an additive compatibility boundary instead
of applying a later cutover migration in the same transaction:

```powershell
$env:MIGRATION_DATABASE_URL = '<Terminal-Backup session-pooler URL>'
$env:MIGRATION_ALLOW_APPLY = 'true'
node scripts/migrations/manage.mjs --apply --through 0010 --target staging --confirm-project jxerxreqezhdsisdwddw
Remove-Item Env:MIGRATION_ALLOW_APPLY
Remove-Item Env:MIGRATION_DATABASE_URL
```

Rollback is limited to the latest applied migration and uses its paired `.down.sql`
file:

```powershell
$env:MIGRATION_DATABASE_URL = '<Terminal-Backup session-pooler URL>'
$env:MIGRATION_ALLOW_APPLY = 'true'
node scripts/migrations/manage.mjs --rollback 0001 --target staging --confirm-project jxerxreqezhdsisdwddw
Remove-Item Env:MIGRATION_ALLOW_APPLY
Remove-Item Env:MIGRATION_DATABASE_URL
```

Rolling back migration `0000` drops the ledger itself and additionally requires
`--allow-ledger-rollback`.

Production additionally requires `--target production`, the exact production
project reference and `MIGRATION_ALLOW_PRODUCTION=true`. Do not set that variable
until the tracker records the authorized operator, a fresh backup, successful
staging rehearsal and explicit production approval.
