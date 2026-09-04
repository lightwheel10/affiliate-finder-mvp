CREATE TABLE crewcast.weekly_auto_scan_batches (
  id uuid PRIMARY KEY,
  user_id integer NOT NULL,
  due_at timestamptz NOT NULL,
  next_due_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  credit_status text NOT NULL,
  credit_period_start timestamptz,
  subscription_credits_consumed integer NOT NULL DEFAULT 0,
  topup_credits_consumed integer NOT NULL DEFAULT 0,
  location_count integer NOT NULL,
  searchable_location_count integer NOT NULL,
  provider_launch_attempted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT weekly_auto_scan_batches_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES crewcast.users (id)
    ON UPDATE RESTRICT
    ON DELETE CASCADE,
  CONSTRAINT weekly_auto_scan_batches_id_user_id_key
    UNIQUE (id, user_id),
  CONSTRAINT weekly_auto_scan_batches_user_due_key
    UNIQUE (user_id, due_at),
  CONSTRAINT weekly_auto_scan_batches_status_check
    CHECK (status IN (
      'pending', 'running', 'completed', 'partial', 'failed', 'uncertain', 'no_work'
    )),
  CONSTRAINT weekly_auto_scan_batches_credit_status_check
    CHECK (credit_status IN ('not_required', 'reserved', 'consumed', 'released')),
  CONSTRAINT weekly_auto_scan_batches_location_count_check
    CHECK (
      location_count > 0
      AND searchable_location_count >= 0
      AND searchable_location_count <= location_count
    ),
  CONSTRAINT weekly_auto_scan_batches_credit_provenance_check
    CHECK (
      (
        credit_status = 'not_required'
        AND credit_period_start IS NULL
        AND subscription_credits_consumed = 0
        AND topup_credits_consumed = 0
      )
      OR (
        credit_status IN ('reserved', 'consumed', 'released')
        AND credit_period_start IS NOT NULL
        AND subscription_credits_consumed IN (0, 1)
        AND topup_credits_consumed IN (0, 1)
        AND subscription_credits_consumed + topup_credits_consumed = 1
      )
    ),
  CONSTRAINT weekly_auto_scan_batches_lifecycle_check
    CHECK (
      (
        status IN ('pending', 'running')
        AND completed_at IS NULL
        AND credit_status IN ('reserved', 'consumed')
      )
      OR (
        status = 'no_work'
        AND completed_at IS NOT NULL
        AND credit_status = 'not_required'
        AND searchable_location_count = 0
      )
      OR (
        status IN ('completed', 'partial', 'failed', 'uncertain')
        AND completed_at IS NOT NULL
        AND credit_status IN ('consumed', 'released')
      )
    )
);

CREATE UNIQUE INDEX weekly_auto_scan_batches_one_active_per_user_key
  ON crewcast.weekly_auto_scan_batches (user_id)
  WHERE status IN ('pending', 'running');

CREATE INDEX weekly_auto_scan_batches_status_created_idx
  ON crewcast.weekly_auto_scan_batches (status, created_at, id);

CREATE TABLE crewcast.weekly_auto_scan_locations (
  batch_id uuid NOT NULL,
  user_id integer NOT NULL,
  brand_id bigint NOT NULL,
  brand_location_id bigint NOT NULL,
  position integer NOT NULL,
  settings_snapshot jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  claim_token uuid,
  claimed_at timestamptz,
  lease_expires_at timestamptz,
  launch_attempted_at timestamptz,
  provider_run_id text,
  search_id integer,
  results_count integer NOT NULL DEFAULT 0,
  source_counts jsonb NOT NULL DEFAULT '{"youtube":0,"instagram":0,"tiktok":0,"web":0}'::jsonb,
  estimated_cost numeric(12, 6) NOT NULL DEFAULT 0,
  error_code text,
  error_message text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT weekly_auto_scan_locations_pkey
    PRIMARY KEY (batch_id, brand_location_id),
  CONSTRAINT weekly_auto_scan_locations_batch_owner_fkey
    FOREIGN KEY (batch_id, user_id)
    REFERENCES crewcast.weekly_auto_scan_batches (id, user_id)
    ON UPDATE RESTRICT
    ON DELETE CASCADE,
  CONSTRAINT weekly_auto_scan_locations_location_owner_fkey
    FOREIGN KEY (brand_location_id, brand_id, user_id)
    REFERENCES crewcast.brand_locations (id, brand_id, user_id)
    ON UPDATE RESTRICT
    ON DELETE NO ACTION,
  CONSTRAINT weekly_auto_scan_locations_position_key
    UNIQUE (batch_id, position),
  CONSTRAINT weekly_auto_scan_locations_status_check
    CHECK (status IN (
      'pending', 'claimed', 'dispatching', 'running',
      'succeeded', 'skipped', 'failed', 'uncertain'
    )),
  CONSTRAINT weekly_auto_scan_locations_snapshot_check
    CHECK (jsonb_typeof(settings_snapshot) = 'object'),
  CONSTRAINT weekly_auto_scan_locations_result_check
    CHECK (
      results_count >= 0
      AND estimated_cost >= 0
      AND jsonb_typeof(source_counts) = 'object'
    ),
  CONSTRAINT weekly_auto_scan_locations_error_length_check
    CHECK (
      (error_code IS NULL OR char_length(error_code) <= 100)
      AND (error_message IS NULL OR char_length(error_message) <= 2000)
    ),
  CONSTRAINT weekly_auto_scan_locations_claim_check
    CHECK (
      (
        status = 'pending'
        AND claim_token IS NULL
        AND claimed_at IS NULL
        AND lease_expires_at IS NULL
        AND completed_at IS NULL
      )
      OR (
        status IN ('claimed', 'dispatching', 'running')
        AND claim_token IS NOT NULL
        AND claimed_at IS NOT NULL
        AND lease_expires_at IS NOT NULL
        AND lease_expires_at > claimed_at
        AND completed_at IS NULL
      )
      OR (
        status IN ('succeeded', 'skipped', 'failed', 'uncertain')
        AND claim_token IS NULL
        AND claimed_at IS NULL
        AND lease_expires_at IS NULL
        AND completed_at IS NOT NULL
      )
    ),
  CONSTRAINT weekly_auto_scan_locations_provider_check
    CHECK (
      (
        status IN ('pending', 'claimed', 'skipped')
        AND launch_attempted_at IS NULL
        AND provider_run_id IS NULL
      )
      OR (
        status = 'dispatching'
        AND launch_attempted_at IS NOT NULL
        AND provider_run_id IS NULL
      )
      OR (
        status IN ('running', 'succeeded')
        AND launch_attempted_at IS NOT NULL
        AND provider_run_id IS NOT NULL
      )
      OR status IN ('failed', 'uncertain')
    )
);

CREATE INDEX weekly_auto_scan_locations_claimable_idx
  ON crewcast.weekly_auto_scan_locations (status, created_at, batch_id, position)
  WHERE status IN ('pending', 'claimed', 'dispatching', 'running');

CREATE INDEX weekly_auto_scan_locations_account_status_idx
  ON crewcast.weekly_auto_scan_locations (user_id, status, created_at);

CREATE FUNCTION crewcast.enforce_weekly_auto_scan_batch_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF ROW(
    NEW.id,
    NEW.user_id,
    NEW.due_at,
    NEW.next_due_at,
    NEW.credit_period_start,
    NEW.subscription_credits_consumed,
    NEW.topup_credits_consumed,
    NEW.location_count,
    NEW.searchable_location_count,
    NEW.created_at
  ) IS DISTINCT FROM ROW(
    OLD.id,
    OLD.user_id,
    OLD.due_at,
    OLD.next_due_at,
    OLD.credit_period_start,
    OLD.subscription_credits_consumed,
    OLD.topup_credits_consumed,
    OLD.location_count,
    OLD.searchable_location_count,
    OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Weekly auto-scan batch provenance is immutable.';
  END IF;

  IF OLD.status NOT IN ('pending', 'running')
     AND ROW(NEW.status, NEW.credit_status, NEW.completed_at)
       IS DISTINCT FROM ROW(OLD.status, OLD.credit_status, OLD.completed_at) THEN
    RAISE EXCEPTION 'A terminal weekly auto-scan batch is immutable.';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE FUNCTION crewcast.enforce_weekly_auto_scan_location_immutable()
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
    NEW.position,
    NEW.settings_snapshot,
    NEW.created_at
  ) IS DISTINCT FROM ROW(
    OLD.batch_id,
    OLD.user_id,
    OLD.brand_id,
    OLD.brand_location_id,
    OLD.position,
    OLD.settings_snapshot,
    OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Weekly auto-scan location provenance is immutable.';
  END IF;

  IF OLD.provider_run_id IS NOT NULL
     AND NEW.provider_run_id IS DISTINCT FROM OLD.provider_run_id THEN
    RAISE EXCEPTION 'A weekly auto-scan provider run cannot be reassigned.';
  END IF;

  IF OLD.status IN ('succeeded', 'skipped', 'failed', 'uncertain')
     AND ROW(
       NEW.status,
       NEW.claim_token,
       NEW.claimed_at,
       NEW.lease_expires_at,
       NEW.launch_attempted_at,
       NEW.provider_run_id,
       NEW.search_id,
       NEW.results_count,
       NEW.source_counts,
       NEW.estimated_cost,
       NEW.error_code,
       NEW.error_message,
       NEW.completed_at
     ) IS DISTINCT FROM ROW(
       OLD.status,
       OLD.claim_token,
       OLD.claimed_at,
       OLD.lease_expires_at,
       OLD.launch_attempted_at,
       OLD.provider_run_id,
       OLD.search_id,
       OLD.results_count,
       OLD.source_counts,
       OLD.estimated_cost,
       OLD.error_code,
       OLD.error_message,
       OLD.completed_at
     ) THEN
    RAISE EXCEPTION 'A terminal weekly auto-scan location is immutable.';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER weekly_auto_scan_batches_set_updated_at
BEFORE UPDATE ON crewcast.weekly_auto_scan_batches
FOR EACH ROW
EXECUTE FUNCTION crewcast.set_updated_at();

CREATE TRIGGER weekly_auto_scan_batches_immutable
BEFORE UPDATE ON crewcast.weekly_auto_scan_batches
FOR EACH ROW
EXECUTE FUNCTION crewcast.enforce_weekly_auto_scan_batch_immutable();

CREATE TRIGGER weekly_auto_scan_locations_set_updated_at
BEFORE UPDATE ON crewcast.weekly_auto_scan_locations
FOR EACH ROW
EXECUTE FUNCTION crewcast.set_updated_at();

CREATE TRIGGER weekly_auto_scan_locations_immutable
BEFORE UPDATE ON crewcast.weekly_auto_scan_locations
FOR EACH ROW
EXECUTE FUNCTION crewcast.enforce_weekly_auto_scan_location_immutable();

ALTER TABLE crewcast.weekly_auto_scan_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE crewcast.weekly_auto_scan_locations ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE crewcast.weekly_auto_scan_batches
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE crewcast.weekly_auto_scan_locations
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON TABLE crewcast.weekly_auto_scan_batches IS
  'One durable account-wide weekly scan occurrence. One credit covers every captured active location.';
COMMENT ON TABLE crewcast.weekly_auto_scan_locations IS
  'Immutable location snapshots processed one at a time so a multi-location account does not exceed one serverless execution.';
COMMENT ON COLUMN crewcast.weekly_auto_scan_batches.credit_status IS
  'Reserved before any paid provider call; consumed on first launch attempt or released only when no provider launch occurred.';
COMMENT ON COLUMN crewcast.weekly_auto_scan_locations.lease_expires_at IS
  'Recoverable worker lease. Expiry never authorizes replay after provider launch uncertainty.';
