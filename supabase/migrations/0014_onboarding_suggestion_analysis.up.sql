CREATE TABLE crewcast.onboarding_suggestion_analyses (
  user_id integer PRIMARY KEY,
  request_id uuid NOT NULL,
  input_hash text NOT NULL,
  input_snapshot jsonb NOT NULL,
  status text NOT NULL,
  result jsonb,
  claimed_at timestamptz NOT NULL,
  claim_expires_at timestamptz,
  provider_started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT onboarding_suggestion_analyses_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES crewcast.users (id)
    ON UPDATE RESTRICT
    ON DELETE CASCADE,
  CONSTRAINT onboarding_suggestion_analyses_request_id_key
    UNIQUE (request_id),
  CONSTRAINT onboarding_suggestion_analyses_input_hash_check
    CHECK (input_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT onboarding_suggestion_analyses_input_snapshot_check
    CHECK (jsonb_typeof(input_snapshot) = 'object'),
  CONSTRAINT onboarding_suggestion_analyses_result_check
    CHECK (result IS NULL OR jsonb_typeof(result) = 'object'),
  CONSTRAINT onboarding_suggestion_analyses_error_code_check
    CHECK (
      error_code IS NULL
      OR (
        error_code ~ '^[A-Z0-9_]{1,100}$'
        AND error_code !~ '[[:cntrl:]]'
      )
    ),
  CONSTRAINT onboarding_suggestion_analyses_status_check
    CHECK (status IN ('reserved', 'running', 'completed', 'failed')),
  CONSTRAINT onboarding_suggestion_analyses_lifecycle_check
    CHECK (
      (
        status = 'reserved'
        AND result IS NULL
        AND claim_expires_at > claimed_at
        AND provider_started_at IS NULL
        AND completed_at IS NULL
        AND failed_at IS NULL
        AND error_code IS NULL
      )
      OR (
        status = 'running'
        AND result IS NULL
        AND claim_expires_at IS NULL
        AND provider_started_at IS NOT NULL
        AND completed_at IS NULL
        AND failed_at IS NULL
        AND error_code IS NULL
      )
      OR (
        status = 'completed'
        AND result IS NOT NULL
        AND claim_expires_at IS NULL
        AND provider_started_at IS NOT NULL
        AND completed_at IS NOT NULL
        AND failed_at IS NULL
        AND error_code IS NULL
      )
      OR (
        status = 'failed'
        AND result IS NULL
        AND claim_expires_at IS NULL
        AND provider_started_at IS NOT NULL
        AND completed_at IS NULL
        AND failed_at IS NOT NULL
        AND error_code IS NOT NULL
      )
    )
);

CREATE INDEX onboarding_suggestion_analyses_status_updated_idx
  ON crewcast.onboarding_suggestion_analyses (status, updated_at DESC, user_id);

CREATE FUNCTION crewcast.enforce_onboarding_suggestion_analysis_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF ROW(
    NEW.user_id,
    NEW.created_at
  ) IS DISTINCT FROM ROW(
    OLD.user_id,
    OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Onboarding suggestion analysis provenance is immutable.';
  END IF;

  IF OLD.provider_started_at IS NOT NULL
     AND NEW.provider_started_at IS DISTINCT FROM OLD.provider_started_at THEN
    RAISE EXCEPTION 'Onboarding suggestion provider launch time is immutable.';
  END IF;

  IF ROW(
    NEW.request_id,
    NEW.input_hash,
    NEW.input_snapshot,
    NEW.claimed_at
  ) IS DISTINCT FROM ROW(
    OLD.request_id,
    OLD.input_hash,
    OLD.input_snapshot,
    OLD.claimed_at
  ) AND NOT (
    OLD.status = 'reserved'
    AND NEW.status = 'reserved'
    AND OLD.claim_expires_at <= statement_timestamp()
    AND OLD.provider_started_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Onboarding suggestion analysis claim provenance is immutable after launch intent.';
  END IF;

  IF OLD.status IN ('completed', 'failed') AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'A terminal onboarding suggestion analysis is immutable.';
  ELSIF OLD.status = 'reserved' AND NEW.status NOT IN ('reserved', 'running') THEN
    RAISE EXCEPTION 'A reserved onboarding suggestion analysis has an invalid transition.';
  ELSIF OLD.status = 'running' AND NEW.status NOT IN ('completed', 'failed') THEN
    RAISE EXCEPTION 'An onboarding suggestion analysis has an invalid transition.';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER onboarding_suggestion_analyses_lifecycle
BEFORE UPDATE ON crewcast.onboarding_suggestion_analyses
FOR EACH ROW
EXECUTE FUNCTION crewcast.enforce_onboarding_suggestion_analysis_lifecycle();

ALTER TABLE crewcast.onboarding_suggestion_analyses ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE crewcast.onboarding_suggestion_analyses
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON TABLE crewcast.onboarding_suggestion_analyses IS
  'One server-owned paid website analysis attempt per application account during onboarding. Exact completed-input retries reuse the stored result.';
COMMENT ON COLUMN crewcast.onboarding_suggestion_analyses.input_hash IS
  'Server-derived SHA-256 of the normalized website, country and language. It is an idempotency fingerprint, not an authorization token.';
COMMENT ON COLUMN crewcast.onboarding_suggestion_analyses.provider_started_at IS
  'Committed before Firecrawl or Anthropic can run. Running rows are never automatically reclaimed because provider spending may already have occurred.';
COMMENT ON COLUMN crewcast.onboarding_suggestion_analyses.claim_expires_at IS
  'Only a pre-provider crash lease. Expired reserved rows may be reclaimed; the timestamp is cleared before either paid provider runs.';
