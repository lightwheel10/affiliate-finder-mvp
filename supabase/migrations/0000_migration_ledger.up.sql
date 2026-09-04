CREATE TABLE crewcast.schema_migrations (
  version text PRIMARY KEY,
  name text NOT NULL,
  checksum_sha256 text NOT NULL CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  applied_at timestamptz NOT NULL DEFAULT now(),
  applied_by text NOT NULL DEFAULT current_user,
  execution_ms integer NOT NULL CHECK (execution_ms >= 0)
);
