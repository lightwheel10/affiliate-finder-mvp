ALTER TABLE crewcast.weekly_auto_scan_locations
  ALTER COLUMN estimated_cost DROP DEFAULT,
  ALTER COLUMN estimated_cost DROP NOT NULL;

COMMENT ON COLUMN crewcast.weekly_auto_scan_locations.estimated_cost IS
  'Exact settled USD total for every recorded provider run, or NULL when any provider cost is unavailable. The legacy column name is retained for rolling-deployment compatibility.';

CREATE TABLE crewcast.weekly_auto_scan_provider_runs (
  batch_id uuid NOT NULL,
  user_id integer NOT NULL,
  brand_id bigint NOT NULL,
  brand_location_id bigint NOT NULL,
  platform text NOT NULL,
  input_fingerprint text NOT NULL,
  correlation_id text NOT NULL,
  status text NOT NULL,
  launch_attempted_at timestamptz NOT NULL,
  provider_run_id text,
  dispatched_at timestamptz,
  exact_cost_usd numeric(12, 6),
  error_message text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT weekly_auto_scan_provider_runs_pkey
    PRIMARY KEY (batch_id, brand_location_id, platform),
  CONSTRAINT weekly_auto_scan_provider_runs_batch_owner_fkey
    FOREIGN KEY (batch_id, user_id)
    REFERENCES crewcast.weekly_auto_scan_batches (id, user_id)
    ON UPDATE RESTRICT
    ON DELETE CASCADE,
  CONSTRAINT weekly_auto_scan_provider_runs_work_fkey
    FOREIGN KEY (batch_id, brand_location_id)
    REFERENCES crewcast.weekly_auto_scan_locations (batch_id, brand_location_id)
    ON UPDATE RESTRICT
    ON DELETE CASCADE,
  CONSTRAINT weekly_auto_scan_provider_runs_location_owner_fkey
    FOREIGN KEY (brand_location_id, brand_id, user_id)
    REFERENCES crewcast.brand_locations (id, brand_id, user_id)
    ON UPDATE RESTRICT
    ON DELETE NO ACTION,
  CONSTRAINT weekly_auto_scan_provider_runs_platform_check
    CHECK (platform IN ('google', 'youtube', 'instagram', 'tiktok')),
  CONSTRAINT weekly_auto_scan_provider_runs_fingerprint_check
    CHECK (input_fingerprint ~ '^[0-9a-f]{64}$'),
  CONSTRAINT weekly_auto_scan_provider_runs_correlation_check
    CHECK (
      btrim(correlation_id) <> ''
      AND length(correlation_id) <= 255
      AND correlation_id !~ '[[:cntrl:]]'
    ),
  CONSTRAINT weekly_auto_scan_provider_runs_correlation_key
    UNIQUE (correlation_id),
  CONSTRAINT weekly_auto_scan_provider_runs_provider_run_check
    CHECK (
      provider_run_id IS NULL
      OR (
        btrim(provider_run_id) <> ''
        AND length(provider_run_id) <= 255
        AND provider_run_id !~ '[[:cntrl:]]'
      )
    ),
  CONSTRAINT weekly_auto_scan_provider_runs_provider_run_key
    UNIQUE (provider_run_id),
  CONSTRAINT weekly_auto_scan_provider_runs_cost_check
    CHECK (exact_cost_usd IS NULL OR exact_cost_usd >= 0),
  CONSTRAINT weekly_auto_scan_provider_runs_error_check
    CHECK (error_message IS NULL OR char_length(error_message) <= 2000),
  CONSTRAINT weekly_auto_scan_provider_runs_status_check
    CHECK (status IN ('dispatching', 'running', 'succeeded', 'failed', 'uncertain')),
  CONSTRAINT weekly_auto_scan_provider_runs_lifecycle_check
    CHECK (
      (
        status = 'dispatching'
        AND provider_run_id IS NULL
        AND dispatched_at IS NULL
        AND exact_cost_usd IS NULL
        AND error_message IS NULL
        AND completed_at IS NULL
      )
      OR (
        status = 'running'
        AND provider_run_id IS NOT NULL
        AND dispatched_at IS NOT NULL
        AND exact_cost_usd IS NULL
        AND error_message IS NULL
        AND completed_at IS NULL
      )
      OR (
        status = 'succeeded'
        AND provider_run_id IS NOT NULL
        AND dispatched_at IS NOT NULL
        AND error_message IS NULL
        AND completed_at IS NOT NULL
      )
      OR (
        status IN ('failed', 'uncertain')
        AND (
          (provider_run_id IS NULL AND dispatched_at IS NULL AND exact_cost_usd IS NULL)
          OR (provider_run_id IS NOT NULL AND dispatched_at IS NOT NULL)
        )
        AND error_message IS NOT NULL
        AND completed_at IS NOT NULL
      )
    )
);

CREATE INDEX weekly_auto_scan_provider_runs_account_created_idx
  ON crewcast.weekly_auto_scan_provider_runs (user_id, created_at DESC, batch_id);

CREATE INDEX weekly_auto_scan_provider_runs_status_idx
  ON crewcast.weekly_auto_scan_provider_runs (status, updated_at, batch_id);

CREATE FUNCTION crewcast.enforce_weekly_auto_scan_provider_run_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF ROW(
    NEW.batch_id,
    NEW.user_id,
    NEW.brand_id,
    NEW.brand_location_id,
    NEW.platform,
    NEW.input_fingerprint,
    NEW.correlation_id,
    NEW.launch_attempted_at,
    NEW.created_at
  ) IS DISTINCT FROM ROW(
    OLD.batch_id,
    OLD.user_id,
    OLD.brand_id,
    OLD.brand_location_id,
    OLD.platform,
    OLD.input_fingerprint,
    OLD.correlation_id,
    OLD.launch_attempted_at,
    OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Weekly provider receipt provenance is immutable.';
  END IF;

  IF OLD.provider_run_id IS NOT NULL
     AND NEW.provider_run_id IS DISTINCT FROM OLD.provider_run_id THEN
    RAISE EXCEPTION 'A weekly provider receipt cannot be reassigned to another run.';
  END IF;

  IF OLD.status = 'dispatching'
     AND NEW.status NOT IN ('running', 'failed', 'uncertain') THEN
    RAISE EXCEPTION 'A launch-attempted weekly provider cannot be retried automatically.';
  ELSIF OLD.status = 'running'
        AND NEW.status NOT IN ('succeeded', 'failed', 'uncertain') THEN
    RAISE EXCEPTION 'A running weekly provider must enter one terminal state.';
  ELSIF OLD.status IN ('succeeded', 'failed', 'uncertain')
        AND ROW(
          NEW.status,
          NEW.provider_run_id,
          NEW.dispatched_at,
          NEW.exact_cost_usd,
          NEW.error_message,
          NEW.completed_at
        ) IS DISTINCT FROM ROW(
          OLD.status,
          OLD.provider_run_id,
          OLD.dispatched_at,
          OLD.exact_cost_usd,
          OLD.error_message,
          OLD.completed_at
        ) THEN
    RAISE EXCEPTION 'A terminal weekly provider receipt is immutable.';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER weekly_auto_scan_provider_runs_set_updated_at
BEFORE UPDATE ON crewcast.weekly_auto_scan_provider_runs
FOR EACH ROW
EXECUTE FUNCTION crewcast.set_updated_at();

CREATE TRIGGER weekly_auto_scan_provider_runs_immutable
BEFORE UPDATE ON crewcast.weekly_auto_scan_provider_runs
FOR EACH ROW
EXECUTE FUNCTION crewcast.enforce_weekly_auto_scan_provider_run_immutable();

ALTER TABLE crewcast.weekly_auto_scan_provider_runs ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE crewcast.weekly_auto_scan_provider_runs
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON TABLE crewcast.weekly_auto_scan_provider_runs IS
  'One immutable launch receipt per weekly location and paid provider. It records correlation, provider run identity, terminal state and exact settled cost without exposing rows to browser roles.';
COMMENT ON COLUMN crewcast.weekly_auto_scan_provider_runs.correlation_id IS
  'Deterministic non-personal provider input marker used to investigate an ambiguous launch without guessing.';
COMMENT ON COLUMN crewcast.weekly_auto_scan_provider_runs.launch_attempted_at IS
  'Committed before the external provider call. A receipt without a run ID fails closed and is never automatically relaunched.';
COMMENT ON COLUMN crewcast.weekly_auto_scan_provider_runs.exact_cost_usd IS
  'Provider-reported usageTotalUsd captured at terminal completion; NULL means unavailable and must never be replaced with a guessed value.';
