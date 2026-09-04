ALTER TABLE crewcast.search_jobs
  ADD CONSTRAINT search_jobs_exact_provenance_key
  UNIQUE (id, user_id, brand_id, brand_location_id);

CREATE TABLE crewcast.search_enrichment_dispatches (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id integer NOT NULL,
  search_job_id integer NOT NULL,
  brand_id bigint NOT NULL,
  brand_location_id bigint NOT NULL,
  platform text NOT NULL,
  input_urls jsonb NOT NULL,
  input_fingerprint text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  claim_token uuid,
  claimed_at timestamptz,
  launch_attempted_at timestamptz,
  provider_run_id text,
  dispatched_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT search_enrichment_dispatches_job_platform_key
    UNIQUE (search_job_id, platform),
  CONSTRAINT search_enrichment_dispatches_provider_run_key
    UNIQUE (provider_run_id),
  CONSTRAINT search_enrichment_dispatches_exact_job_fkey
    FOREIGN KEY (search_job_id, user_id, brand_id, brand_location_id)
    REFERENCES crewcast.search_jobs (id, user_id, brand_id, brand_location_id)
    ON UPDATE RESTRICT
    ON DELETE CASCADE,
  CONSTRAINT search_enrichment_dispatches_platform_check
    CHECK (platform IN ('youtube', 'instagram', 'tiktok', 'similarweb')),
  CONSTRAINT search_enrichment_dispatches_input_urls_check
    CHECK (
      jsonb_typeof(input_urls) = 'array'
      AND jsonb_array_length(input_urls) > 0
      AND jsonb_array_length(input_urls) <= 500
    ),
  CONSTRAINT search_enrichment_dispatches_fingerprint_check
    CHECK (input_fingerprint ~ '^[0-9a-f]{64}$'),
  CONSTRAINT search_enrichment_dispatches_provider_run_check
    CHECK (
      provider_run_id IS NULL
      OR (
        btrim(provider_run_id) <> ''
        AND length(provider_run_id) <= 255
        AND provider_run_id !~ '[[:cntrl:]]'
      )
    ),
  CONSTRAINT search_enrichment_dispatches_status_check
    CHECK (status IN ('pending', 'claimed', 'dispatching', 'running', 'failed', 'uncertain')),
  CONSTRAINT search_enrichment_dispatches_lifecycle_check
    CHECK (
      (
        status = 'pending'
        AND claim_token IS NULL
        AND claimed_at IS NULL
        AND launch_attempted_at IS NULL
        AND provider_run_id IS NULL
        AND dispatched_at IS NULL
        AND error_message IS NULL
      )
      OR (
        status = 'claimed'
        AND claim_token IS NOT NULL
        AND claimed_at IS NOT NULL
        AND launch_attempted_at IS NULL
        AND provider_run_id IS NULL
        AND dispatched_at IS NULL
        AND error_message IS NULL
      )
      OR (
        status = 'dispatching'
        AND claim_token IS NOT NULL
        AND claimed_at IS NOT NULL
        AND launch_attempted_at IS NOT NULL
        AND provider_run_id IS NULL
        AND dispatched_at IS NULL
        AND error_message IS NULL
      )
      OR (
        status = 'running'
        AND claim_token IS NOT NULL
        AND claimed_at IS NOT NULL
        AND launch_attempted_at IS NOT NULL
        AND provider_run_id IS NOT NULL
        AND dispatched_at IS NOT NULL
        AND error_message IS NULL
      )
      OR (
        status IN ('failed', 'uncertain')
        AND claim_token IS NOT NULL
        AND claimed_at IS NOT NULL
        AND launch_attempted_at IS NOT NULL
        AND dispatched_at IS NULL
        AND error_message IS NOT NULL
      )
    )
);

CREATE INDEX search_enrichment_dispatches_job_status_idx
  ON crewcast.search_enrichment_dispatches (search_job_id, status, platform);

CREATE INDEX search_enrichment_dispatches_user_created_at_idx
  ON crewcast.search_enrichment_dispatches (user_id, created_at DESC, id DESC);

CREATE FUNCTION crewcast.enforce_search_enrichment_dispatch_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF ROW(
    NEW.user_id,
    NEW.search_job_id,
    NEW.brand_id,
    NEW.brand_location_id,
    NEW.platform,
    NEW.input_urls,
    NEW.input_fingerprint,
    NEW.created_at
  ) IS DISTINCT FROM ROW(
    OLD.user_id,
    OLD.search_job_id,
    OLD.brand_id,
    OLD.brand_location_id,
    OLD.platform,
    OLD.input_urls,
    OLD.input_fingerprint,
    OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Enrichment dispatch provenance is immutable.';
  END IF;

  IF OLD.provider_run_id IS NOT NULL
     AND NEW.provider_run_id IS DISTINCT FROM OLD.provider_run_id THEN
    RAISE EXCEPTION 'An enrichment dispatch cannot be reassigned to another provider run.';
  END IF;

  IF OLD.status = 'pending' AND NEW.status <> 'claimed' THEN
    RAISE EXCEPTION 'A pending enrichment dispatch must be claimed before launch.';
  ELSIF OLD.status = 'claimed' AND NEW.status NOT IN ('claimed', 'dispatching') THEN
    RAISE EXCEPTION 'A claimed enrichment dispatch must record launch intent before completion.';
  ELSIF OLD.status = 'dispatching'
        AND NEW.status NOT IN ('running', 'failed', 'uncertain') THEN
    RAISE EXCEPTION 'A launch-attempted enrichment dispatch cannot be retried automatically.';
  ELSIF OLD.status IN ('running', 'failed', 'uncertain')
        AND ROW(
          NEW.status,
          NEW.claim_token,
          NEW.claimed_at,
          NEW.launch_attempted_at,
          NEW.provider_run_id,
          NEW.dispatched_at,
          NEW.error_message
        ) IS DISTINCT FROM ROW(
          OLD.status,
          OLD.claim_token,
          OLD.claimed_at,
          OLD.launch_attempted_at,
          OLD.provider_run_id,
          OLD.dispatched_at,
          OLD.error_message
        ) THEN
    RAISE EXCEPTION 'A terminal enrichment dispatch is immutable.';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER search_enrichment_dispatches_lifecycle
BEFORE UPDATE ON crewcast.search_enrichment_dispatches
FOR EACH ROW
EXECUTE FUNCTION crewcast.enforce_search_enrichment_dispatch_lifecycle();

ALTER TABLE crewcast.search_enrichment_dispatches ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE crewcast.search_enrichment_dispatches
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON SEQUENCE crewcast.search_enrichment_dispatches_id_seq
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON TABLE crewcast.search_enrichment_dispatches IS
  'Durable per-search/per-platform launch intents. A launch-attempted row is never automatically retried without a recorded provider run or manual reconciliation.';
COMMENT ON COLUMN crewcast.search_enrichment_dispatches.input_fingerprint IS
  'SHA-256 of the canonical platform and URL list used to reject conflicting retries.';
COMMENT ON COLUMN crewcast.search_enrichment_dispatches.launch_attempted_at IS
  'Set and committed before the external Actor start call. Rows with this value and no run ID fail closed instead of relaunching.';
