CREATE TABLE crewcast.search_reconciliation_operators (
  auth_user_id uuid PRIMARY KEY,
  email text NOT NULL,
  display_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT search_reconciliation_operators_email_check
    CHECK (
      btrim(email) <> ''
      AND length(email) <= 320
      AND email !~ '[[:cntrl:]]'
    ),
  CONSTRAINT search_reconciliation_operators_display_name_check
    CHECK (
      display_name IS NULL
      OR (
        btrim(display_name) <> ''
        AND length(display_name) <= 120
        AND display_name !~ '[[:cntrl:]]'
      )
    )
);

CREATE TABLE crewcast.search_reconciliation_cases (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  case_type text NOT NULL,
  user_id integer NOT NULL,
  account_email text NOT NULL,
  brand_id bigint NOT NULL,
  brand_location_id bigint NOT NULL,
  search_job_id integer,
  enrichment_dispatch_id bigint,
  platform text,
  source_request_id uuid,
  source_status text NOT NULL,
  source_error_message text NOT NULL,
  source_launch_attempted_at timestamptz NOT NULL,
  input_urls jsonb,
  input_fingerprint text,
  settings_snapshot jsonb,
  status text NOT NULL DEFAULT 'open',
  lock_version integer NOT NULL DEFAULT 1,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolution text,
  resolution_note text,
  provider_run_id text,
  resolved_by_auth_user_id uuid,
  resolved_by_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT search_reconciliation_cases_operator_fkey
    FOREIGN KEY (resolved_by_auth_user_id)
    REFERENCES crewcast.search_reconciliation_operators (auth_user_id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT search_reconciliation_cases_type_check
    CHECK (case_type IN ('enrichment_dispatch', 'onboarding_search')),
  CONSTRAINT search_reconciliation_cases_status_check
    CHECK (status IN ('open', 'resolved')),
  CONSTRAINT search_reconciliation_cases_resolution_check
    CHECK (resolution IN ('attach_provider_run', 'confirm_no_run', 'cancel_and_refund')),
  CONSTRAINT search_reconciliation_cases_platform_check
    CHECK (platform IS NULL OR platform IN ('youtube', 'instagram', 'tiktok', 'similarweb')),
  CONSTRAINT search_reconciliation_cases_email_check
    CHECK (
      btrim(account_email) <> ''
      AND length(account_email) <= 320
      AND account_email !~ '[[:cntrl:]]'
      AND (
        resolved_by_email IS NULL
        OR (
          btrim(resolved_by_email) <> ''
          AND length(resolved_by_email) <= 320
          AND resolved_by_email !~ '[[:cntrl:]]'
        )
      )
    ),
  CONSTRAINT search_reconciliation_cases_error_check
    CHECK (
      btrim(source_error_message) <> ''
      AND length(source_error_message) <= 2000
    ),
  CONSTRAINT search_reconciliation_cases_note_check
    CHECK (
      resolution_note IS NULL
      OR (length(btrim(resolution_note)) BETWEEN 10 AND 1000)
    ),
  CONSTRAINT search_reconciliation_cases_run_id_check
    CHECK (
      provider_run_id IS NULL
      OR (
        btrim(provider_run_id) <> ''
        AND length(provider_run_id) <= 255
        AND provider_run_id !~ '[[:cntrl:]]'
      )
    ),
  CONSTRAINT search_reconciliation_cases_fingerprint_check
    CHECK (input_fingerprint IS NULL OR input_fingerprint ~ '^[0-9a-f]{64}$'),
  CONSTRAINT search_reconciliation_cases_version_check
    CHECK (lock_version > 0),
  CONSTRAINT search_reconciliation_cases_source_shape_check
    CHECK (
      (
        case_type = 'enrichment_dispatch'
        AND search_job_id IS NOT NULL
        AND enrichment_dispatch_id IS NOT NULL
        AND platform IS NOT NULL
        AND source_request_id IS NULL
        AND jsonb_typeof(input_urls) = 'array'
        AND jsonb_array_length(input_urls) > 0
        AND input_fingerprint IS NOT NULL
        AND settings_snapshot IS NULL
      )
      OR (
        case_type = 'onboarding_search'
        AND search_job_id IS NULL
        AND enrichment_dispatch_id IS NULL
        AND platform IS NULL
        AND source_request_id IS NOT NULL
        AND input_urls IS NULL
        AND input_fingerprint IS NULL
        AND jsonb_typeof(settings_snapshot) = 'object'
      )
    ),
  CONSTRAINT search_reconciliation_cases_lifecycle_check
    CHECK (
      (
        status = 'open'
        AND resolved_at IS NULL
        AND resolution IS NULL
        AND resolution_note IS NULL
        AND provider_run_id IS NULL
        AND resolved_by_auth_user_id IS NULL
        AND resolved_by_email IS NULL
      )
      OR (
        status = 'resolved'
        AND resolved_at IS NOT NULL
        AND resolution IS NOT NULL
        AND resolution_note IS NOT NULL
        AND resolved_by_auth_user_id IS NOT NULL
        AND resolved_by_email IS NOT NULL
        AND (
          (resolution = 'attach_provider_run' AND provider_run_id IS NOT NULL)
          OR (resolution <> 'attach_provider_run' AND provider_run_id IS NULL)
        )
      )
    )
);

CREATE UNIQUE INDEX search_reconciliation_cases_dispatch_key
  ON crewcast.search_reconciliation_cases (enrichment_dispatch_id)
  WHERE case_type = 'enrichment_dispatch';

CREATE UNIQUE INDEX search_reconciliation_cases_onboarding_request_key
  ON crewcast.search_reconciliation_cases (user_id, source_request_id)
  WHERE case_type = 'onboarding_search';

CREATE INDEX search_reconciliation_cases_open_detected_idx
  ON crewcast.search_reconciliation_cases (detected_at, id)
  WHERE status = 'open';

CREATE TABLE crewcast.search_reconciliation_case_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  case_id bigint NOT NULL,
  event_type text NOT NULL,
  case_version integer NOT NULL,
  operator_auth_user_id uuid,
  operator_email text,
  resolution text,
  resolution_note text,
  provider_run_id text,
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT search_reconciliation_events_case_fkey
    FOREIGN KEY (case_id)
    REFERENCES crewcast.search_reconciliation_cases (id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,
  CONSTRAINT search_reconciliation_events_type_check
    CHECK (event_type IN ('detected', 'resolved')),
  CONSTRAINT search_reconciliation_events_version_check
    CHECK (case_version > 0),
  CONSTRAINT search_reconciliation_events_payload_check
    CHECK (jsonb_typeof(event_payload) = 'object'),
  CONSTRAINT search_reconciliation_events_shape_check
    CHECK (
      (
        event_type = 'detected'
        AND operator_auth_user_id IS NULL
        AND operator_email IS NULL
        AND resolution IS NULL
        AND resolution_note IS NULL
        AND provider_run_id IS NULL
      )
      OR (
        event_type = 'resolved'
        AND operator_auth_user_id IS NOT NULL
        AND operator_email IS NOT NULL
        AND resolution IS NOT NULL
        AND resolution_note IS NOT NULL
      )
    )
);

CREATE UNIQUE INDEX search_reconciliation_events_case_version_key
  ON crewcast.search_reconciliation_case_events (case_id, case_version);

CREATE FUNCTION crewcast.enforce_search_reconciliation_operator_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF ROW(NEW.auth_user_id, NEW.created_at)
     IS DISTINCT FROM ROW(OLD.auth_user_id, OLD.created_at) THEN
    RAISE EXCEPTION 'Search-reconciliation operator identity is immutable.';
  END IF;
  NEW.updated_at := statement_timestamp();
  RETURN NEW;
END;
$function$;

CREATE TRIGGER search_reconciliation_operators_lifecycle
BEFORE UPDATE ON crewcast.search_reconciliation_operators
FOR EACH ROW
EXECUTE FUNCTION crewcast.enforce_search_reconciliation_operator_lifecycle();

CREATE FUNCTION crewcast.require_active_search_reconciliation_operator()
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
  operator_auth_user_id text;
BEGIN
  operator_auth_user_id := current_setting(
    'crewcast.search_reconciliation_operator_auth_user_id',
    true
  );
  IF operator_auth_user_id IS NULL
     OR NOT EXISTS (
       SELECT 1
       FROM crewcast.search_reconciliation_operators AS operators
       WHERE operators.auth_user_id::text = operator_auth_user_id
         AND operators.is_active
     ) THEN
    RAISE EXCEPTION 'An active search-reconciliation operator is required.';
  END IF;
  RETURN operator_auth_user_id::uuid;
END;
$function$;

CREATE FUNCTION crewcast.enforce_search_reconciliation_case_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF ROW(
    NEW.case_type,
    NEW.user_id,
    NEW.account_email,
    NEW.brand_id,
    NEW.brand_location_id,
    NEW.search_job_id,
    NEW.enrichment_dispatch_id,
    NEW.platform,
    NEW.source_request_id,
    NEW.source_status,
    NEW.source_error_message,
    NEW.source_launch_attempted_at,
    NEW.input_urls,
    NEW.input_fingerprint,
    NEW.settings_snapshot,
    NEW.detected_at,
    NEW.created_at
  ) IS DISTINCT FROM ROW(
    OLD.case_type,
    OLD.user_id,
    OLD.account_email,
    OLD.brand_id,
    OLD.brand_location_id,
    OLD.search_job_id,
    OLD.enrichment_dispatch_id,
    OLD.platform,
    OLD.source_request_id,
    OLD.source_status,
    OLD.source_error_message,
    OLD.source_launch_attempted_at,
    OLD.input_urls,
    OLD.input_fingerprint,
    OLD.settings_snapshot,
    OLD.detected_at,
    OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Search-reconciliation case provenance is immutable.';
  END IF;

  IF OLD.status = 'resolved' AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'A resolved search-reconciliation case is immutable.';
  ELSIF OLD.status = 'open' AND NEW.status <> 'resolved' THEN
    RAISE EXCEPTION 'An open search-reconciliation case can only be resolved.';
  ELSIF NEW.lock_version <> OLD.lock_version + 1 THEN
    RAISE EXCEPTION 'Search-reconciliation case version must advance exactly once.';
  END IF;

  IF OLD.status = 'open' AND NEW.status = 'resolved' THEN
    IF NEW.resolved_by_auth_user_id IS DISTINCT FROM
         crewcast.require_active_search_reconciliation_operator()
       OR NEW.resolved_by_email IS DISTINCT FROM current_setting(
         'crewcast.search_reconciliation_operator_email',
         true
       ) THEN
      RAISE EXCEPTION 'Search-reconciliation resolution identity is invalid.';
    END IF;
  END IF;

  NEW.updated_at := statement_timestamp();
  RETURN NEW;
END;
$function$;

CREATE TRIGGER search_reconciliation_cases_lifecycle
BEFORE UPDATE ON crewcast.search_reconciliation_cases
FOR EACH ROW
EXECUTE FUNCTION crewcast.enforce_search_reconciliation_case_lifecycle();

CREATE FUNCTION crewcast.reject_search_reconciliation_event_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  RAISE EXCEPTION 'Search-reconciliation audit events are append-only.';
END;
$function$;

CREATE TRIGGER search_reconciliation_events_immutable
BEFORE UPDATE OR DELETE ON crewcast.search_reconciliation_case_events
FOR EACH ROW
EXECUTE FUNCTION crewcast.reject_search_reconciliation_event_changes();

CREATE FUNCTION crewcast.audit_search_reconciliation_case()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO crewcast.search_reconciliation_case_events (
      case_id,
      event_type,
      case_version,
      event_payload
    ) VALUES (
      NEW.id,
      'detected',
      NEW.lock_version,
      jsonb_build_object(
        'caseType', NEW.case_type,
        'sourceStatus', NEW.source_status,
        'sourceErrorMessage', NEW.source_error_message
      )
    );
  ELSIF OLD.status = 'open' AND NEW.status = 'resolved' THEN
    INSERT INTO crewcast.search_reconciliation_case_events (
      case_id,
      event_type,
      case_version,
      operator_auth_user_id,
      operator_email,
      resolution,
      resolution_note,
      provider_run_id,
      event_payload
    ) VALUES (
      NEW.id,
      'resolved',
      NEW.lock_version,
      NEW.resolved_by_auth_user_id,
      NEW.resolved_by_email,
      NEW.resolution,
      NEW.resolution_note,
      NEW.provider_run_id,
      jsonb_build_object('previousStatus', OLD.status)
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER search_reconciliation_cases_audit
AFTER INSERT OR UPDATE ON crewcast.search_reconciliation_cases
FOR EACH ROW
EXECUTE FUNCTION crewcast.audit_search_reconciliation_case();

CREATE FUNCTION crewcast.alert_uncertain_enrichment_dispatch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF NEW.status = 'uncertain' AND (TG_OP = 'INSERT' OR OLD.status <> 'uncertain') THEN
    INSERT INTO crewcast.search_reconciliation_cases (
      case_type,
      user_id,
      account_email,
      brand_id,
      brand_location_id,
      search_job_id,
      enrichment_dispatch_id,
      platform,
      source_status,
      source_error_message,
      source_launch_attempted_at,
      input_urls,
      input_fingerprint,
      detected_at
    )
    SELECT
      'enrichment_dispatch',
      NEW.user_id,
      users.email,
      NEW.brand_id,
      NEW.brand_location_id,
      NEW.search_job_id,
      NEW.id,
      NEW.platform,
      NEW.status,
      NEW.error_message,
      NEW.launch_attempted_at,
      NEW.input_urls,
      NEW.input_fingerprint,
      statement_timestamp()
    FROM crewcast.users AS users
    WHERE users.id = NEW.user_id
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER search_enrichment_dispatches_reconciliation_alert
AFTER INSERT OR UPDATE OF status ON crewcast.search_enrichment_dispatches
FOR EACH ROW
EXECUTE FUNCTION crewcast.alert_uncertain_enrichment_dispatch();

CREATE FUNCTION crewcast.alert_blocked_enrichment_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF NEW.enrichment_status = 'dispatch_blocked'
     AND OLD.enrichment_status IS DISTINCT FROM 'dispatch_blocked' THEN
    INSERT INTO crewcast.search_reconciliation_cases (
      case_type,
      user_id,
      account_email,
      brand_id,
      brand_location_id,
      search_job_id,
      enrichment_dispatch_id,
      platform,
      source_status,
      source_error_message,
      source_launch_attempted_at,
      input_urls,
      input_fingerprint,
      detected_at
    )
    SELECT
      'enrichment_dispatch',
      dispatches.user_id,
      users.email,
      dispatches.brand_id,
      dispatches.brand_location_id,
      dispatches.search_job_id,
      dispatches.id,
      dispatches.platform,
      dispatches.status,
      COALESCE(dispatches.error_message, 'Provider launch intent became stale without a run ID.'),
      dispatches.launch_attempted_at,
      dispatches.input_urls,
      dispatches.input_fingerprint,
      statement_timestamp()
    FROM crewcast.search_enrichment_dispatches AS dispatches
    JOIN crewcast.users AS users ON users.id = dispatches.user_id
    WHERE dispatches.search_job_id = NEW.id
      AND dispatches.user_id = NEW.user_id
      AND (
        dispatches.status = 'uncertain'
        OR (
          dispatches.status = 'dispatching'
          AND dispatches.launch_attempted_at < statement_timestamp() - INTERVAL '3 minutes'
        )
      )
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER search_jobs_reconciliation_alert
AFTER UPDATE OF enrichment_status ON crewcast.search_jobs
FOR EACH ROW
EXECUTE FUNCTION crewcast.alert_blocked_enrichment_job();

CREATE FUNCTION crewcast.alert_uncertain_onboarding_search()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF NEW.status = 'uncertain' AND (TG_OP = 'INSERT' OR OLD.status <> 'uncertain') THEN
    INSERT INTO crewcast.search_reconciliation_cases (
      case_type,
      user_id,
      account_email,
      brand_id,
      brand_location_id,
      source_request_id,
      source_status,
      source_error_message,
      source_launch_attempted_at,
      settings_snapshot,
      detected_at
    )
    SELECT
      'onboarding_search',
      NEW.user_id,
      users.email,
      NEW.brand_id,
      NEW.brand_location_id,
      NEW.request_id,
      NEW.status,
      NEW.error_message,
      NEW.launch_attempted_at,
      NEW.settings_snapshot,
      statement_timestamp()
    FROM crewcast.users AS users
    WHERE users.id = NEW.user_id
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER onboarding_search_entitlements_reconciliation_alert
AFTER INSERT OR UPDATE OF status ON crewcast.onboarding_search_entitlements
FOR EACH ROW
EXECUTE FUNCTION crewcast.alert_uncertain_onboarding_search();

-- Terminal uncertainty remains immutable to normal automation. These two
-- explicit transitions are used only by the operator-only reconciliation API.
CREATE OR REPLACE FUNCTION crewcast.enforce_search_enrichment_dispatch_lifecycle()
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
  ELSIF OLD.status = 'uncertain'
        AND NEW.status NOT IN ('running', 'failed') THEN
    RAISE EXCEPTION 'An uncertain enrichment dispatch requires operator reconciliation.';
  ELSIF OLD.status IN ('running', 'failed')
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

  IF OLD.status = 'uncertain' AND NEW.status IN ('running', 'failed') THEN
    PERFORM crewcast.require_active_search_reconciliation_operator();
    IF NOT EXISTS (
      SELECT 1
      FROM crewcast.search_reconciliation_cases AS cases
      WHERE cases.enrichment_dispatch_id = OLD.id
        AND cases.user_id = OLD.user_id
        AND cases.search_job_id = OLD.search_job_id
        AND cases.status = 'open'
    ) THEN
      RAISE EXCEPTION 'The enrichment dispatch has no open reconciliation case.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION crewcast.enforce_onboarding_search_entitlement_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF ROW(
    NEW.user_id,
    NEW.brand_id,
    NEW.brand_location_id,
    NEW.created_at,
    NEW.legacy_imported_at
  ) IS DISTINCT FROM ROW(
    OLD.user_id,
    OLD.brand_id,
    OLD.brand_location_id,
    OLD.created_at,
    OLD.legacy_imported_at
  ) THEN
    RAISE EXCEPTION 'Onboarding-search entitlement provenance is immutable.';
  END IF;

  IF OLD.status = 'available' AND NEW.status <> 'reserved' THEN
    RAISE EXCEPTION 'An available onboarding-search entitlement must be reserved before launch.';
  ELSIF OLD.status = 'reserved' THEN
    IF NEW.status = 'reserved' AND OLD.claim_expires_at > statement_timestamp() THEN
      RAISE EXCEPTION 'A live onboarding-search reservation cannot be reassigned.';
    ELSIF NEW.status NOT IN ('available', 'reserved', 'dispatching') THEN
      RAISE EXCEPTION 'A reserved onboarding-search entitlement has an invalid transition.';
    END IF;
  ELSIF OLD.status = 'dispatching'
        AND NEW.status NOT IN ('available', 'consumed', 'uncertain') THEN
    RAISE EXCEPTION 'A launch-attempted onboarding search has an invalid transition.';
  ELSIF OLD.status = 'uncertain'
        AND NEW.status NOT IN ('available', 'consumed') THEN
    RAISE EXCEPTION 'An uncertain onboarding search requires operator reconciliation.';
  ELSIF OLD.status = 'consumed' AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'A consumed onboarding-search entitlement is immutable.';
  END IF;

  IF OLD.status = 'uncertain' AND NEW.status IN ('available', 'consumed') THEN
    PERFORM crewcast.require_active_search_reconciliation_operator();
    IF NOT EXISTS (
      SELECT 1
      FROM crewcast.search_reconciliation_cases AS cases
      WHERE cases.case_type = 'onboarding_search'
        AND cases.user_id = OLD.user_id
        AND cases.brand_id = OLD.brand_id
        AND cases.brand_location_id = OLD.brand_location_id
        AND cases.source_request_id = OLD.request_id
        AND cases.status = 'open'
    ) THEN
      RAISE EXCEPTION 'The onboarding search has no open reconciliation case.';
    END IF;
  END IF;

  IF NEW.status <> 'available'
     AND OLD.status <> 'available'
     AND NEW.status <> 'reserved'
     AND ROW(
       NEW.request_id,
       NEW.settings_snapshot,
       NEW.claimed_at
     ) IS DISTINCT FROM ROW(
       OLD.request_id,
       OLD.settings_snapshot,
       OLD.claimed_at
     ) THEN
    RAISE EXCEPTION 'An onboarding-search claim cannot change after launch intent.';
  END IF;

  RETURN NEW;
END;
$function$;

INSERT INTO crewcast.search_reconciliation_cases (
  case_type,
  user_id,
  account_email,
  brand_id,
  brand_location_id,
  search_job_id,
  enrichment_dispatch_id,
  platform,
  source_status,
  source_error_message,
  source_launch_attempted_at,
  input_urls,
  input_fingerprint,
  detected_at
)
SELECT
  'enrichment_dispatch',
  dispatches.user_id,
  users.email,
  dispatches.brand_id,
  dispatches.brand_location_id,
  dispatches.search_job_id,
  dispatches.id,
  dispatches.platform,
  dispatches.status,
  COALESCE(dispatches.error_message, 'Provider launch intent became stale without a run ID.'),
  dispatches.launch_attempted_at,
  dispatches.input_urls,
  dispatches.input_fingerprint,
  transaction_timestamp()
FROM crewcast.search_enrichment_dispatches AS dispatches
JOIN crewcast.search_jobs AS jobs
  ON jobs.id = dispatches.search_job_id
 AND jobs.user_id = dispatches.user_id
JOIN crewcast.users AS users ON users.id = dispatches.user_id
WHERE dispatches.status = 'uncertain'
   OR (
     jobs.enrichment_status = 'dispatch_blocked'
     AND dispatches.status = 'dispatching'
     AND dispatches.launch_attempted_at < transaction_timestamp() - INTERVAL '3 minutes'
   )
ON CONFLICT DO NOTHING;

INSERT INTO crewcast.search_reconciliation_cases (
  case_type,
  user_id,
  account_email,
  brand_id,
  brand_location_id,
  source_request_id,
  source_status,
  source_error_message,
  source_launch_attempted_at,
  settings_snapshot,
  detected_at
)
SELECT
  'onboarding_search',
  entitlements.user_id,
  users.email,
  entitlements.brand_id,
  entitlements.brand_location_id,
  entitlements.request_id,
  entitlements.status,
  entitlements.error_message,
  entitlements.launch_attempted_at,
  entitlements.settings_snapshot,
  transaction_timestamp()
FROM crewcast.onboarding_search_entitlements AS entitlements
JOIN crewcast.users AS users ON users.id = entitlements.user_id
WHERE entitlements.status = 'uncertain'
ON CONFLICT DO NOTHING;

ALTER TABLE crewcast.search_reconciliation_operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE crewcast.search_reconciliation_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE crewcast.search_reconciliation_case_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE crewcast.search_reconciliation_operators
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE crewcast.search_reconciliation_cases
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE crewcast.search_reconciliation_case_events
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON SEQUENCE crewcast.search_reconciliation_cases_id_seq
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON SEQUENCE crewcast.search_reconciliation_case_events_id_seq
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON FUNCTION crewcast.require_active_search_reconciliation_operator()
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON TABLE crewcast.search_reconciliation_cases IS
  'Server-owned alerts for ambiguous paid-provider launches. Automatic code cannot resolve these cases or launch replacement work.';
COMMENT ON TABLE crewcast.search_reconciliation_case_events IS
  'Append-only audit history for detection and operator resolution of stuck searches.';
COMMENT ON COLUMN crewcast.search_reconciliation_cases.lock_version IS
  'Optimistic-concurrency token. Every successful resolution increments it exactly once.';
