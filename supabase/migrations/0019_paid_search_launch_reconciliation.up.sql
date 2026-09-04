ALTER TABLE crewcast.search_credit_reservations
  ADD COLUMN launch_attempted_at timestamptz,
  ADD COLUMN uncertain_at timestamptz,
  ADD COLUMN error_message text;

ALTER TABLE crewcast.search_credit_reservations
  DROP CONSTRAINT search_credit_reservations_status_check,
  DROP CONSTRAINT search_credit_reservations_lifecycle_check;

ALTER TABLE crewcast.search_credit_reservations
  ADD CONSTRAINT search_credit_reservations_status_check
    CHECK (status IN ('reserved', 'uncertain', 'consumed', 'released')),
  ADD CONSTRAINT search_credit_reservations_error_check
    CHECK (
      error_message IS NULL
      OR (
        btrim(error_message) <> ''
        AND length(error_message) <= 2000
        AND error_message !~ '[[:cntrl:]]'
      )
    ),
  ADD CONSTRAINT search_credit_reservations_lifecycle_check
    CHECK (
      (
        status = 'reserved'
        AND consumed_at IS NULL
        AND released_at IS NULL
        AND uncertain_at IS NULL
        AND error_message IS NULL
      )
      OR (
        status = 'uncertain'
        AND search_job_id IS NULL
        AND launch_attempted_at IS NOT NULL
        AND uncertain_at IS NOT NULL
        AND error_message IS NOT NULL
        AND consumed_at IS NULL
        AND released_at IS NULL
      )
      OR (
        status = 'consumed'
        AND search_job_id IS NOT NULL
        AND consumed_at IS NOT NULL
        AND released_at IS NULL
      )
      OR (
        status = 'released'
        AND consumed_at IS NULL
        AND released_at IS NOT NULL
      )
    );

CREATE OR REPLACE FUNCTION crewcast.enforce_search_credit_reservation_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF ROW(
    NEW.user_id,
    NEW.request_id,
    NEW.brand_id,
    NEW.brand_location_id,
    NEW.settings_snapshot,
    NEW.credit_period_start,
    NEW.subscription_credits_consumed,
    NEW.topup_credits_consumed,
    NEW.created_at
  ) IS DISTINCT FROM ROW(
    OLD.user_id,
    OLD.request_id,
    OLD.brand_id,
    OLD.brand_location_id,
    OLD.settings_snapshot,
    OLD.credit_period_start,
    OLD.subscription_credits_consumed,
    OLD.topup_credits_consumed,
    OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Search-credit reservation provenance is immutable.';
  END IF;

  IF OLD.search_job_id IS NOT NULL
     AND NEW.search_job_id IS DISTINCT FROM OLD.search_job_id THEN
    RAISE EXCEPTION 'A search-credit reservation cannot be reassigned to another job.';
  END IF;

  IF OLD.launch_attempted_at IS NOT NULL
     AND NEW.launch_attempted_at IS DISTINCT FROM OLD.launch_attempted_at THEN
    RAISE EXCEPTION 'Search-credit launch evidence is immutable.';
  END IF;

  IF OLD.status IN ('consumed', 'released')
     AND ROW(
       NEW.status,
       NEW.search_job_id,
       NEW.launch_attempted_at,
       NEW.uncertain_at,
       NEW.error_message,
       NEW.consumed_at,
       NEW.released_at
     ) IS DISTINCT FROM ROW(
       OLD.status,
       OLD.search_job_id,
       OLD.launch_attempted_at,
       OLD.uncertain_at,
       OLD.error_message,
       OLD.consumed_at,
       OLD.released_at
     ) THEN
    RAISE EXCEPTION 'A terminal search-credit reservation is immutable.';
  ELSIF OLD.status = 'uncertain' THEN
    IF NEW.status NOT IN ('reserved', 'released') THEN
      RAISE EXCEPTION 'An uncertain paid search requires operator reconciliation.';
    END IF;
    PERFORM crewcast.require_active_search_reconciliation_operator();
    IF NOT EXISTS (
      SELECT 1
      FROM crewcast.search_reconciliation_cases AS cases
      WHERE cases.case_type = 'paid_search'
        AND cases.user_id = OLD.user_id
        AND cases.brand_id = OLD.brand_id
        AND cases.brand_location_id = OLD.brand_location_id
        AND cases.source_request_id = OLD.request_id
        AND cases.status = 'open'
    ) THEN
      RAISE EXCEPTION 'The paid search has no open reconciliation case.';
    END IF;
  ELSIF OLD.status = 'reserved'
        AND NEW.status NOT IN ('reserved', 'uncertain', 'consumed', 'released') THEN
    RAISE EXCEPTION 'A reserved search credit has an invalid transition.';
  END IF;

  RETURN NEW;
END;
$function$;

ALTER TABLE crewcast.search_reconciliation_cases
  DROP CONSTRAINT search_reconciliation_cases_type_check,
  DROP CONSTRAINT search_reconciliation_cases_source_shape_check;

ALTER TABLE crewcast.search_reconciliation_cases
  ADD CONSTRAINT search_reconciliation_cases_type_check
    CHECK (case_type IN ('enrichment_dispatch', 'onboarding_search', 'paid_search')),
  ADD CONSTRAINT search_reconciliation_cases_source_shape_check
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
        case_type IN ('onboarding_search', 'paid_search')
        AND search_job_id IS NULL
        AND enrichment_dispatch_id IS NULL
        AND platform IS NULL
        AND source_request_id IS NOT NULL
        AND input_urls IS NULL
        AND input_fingerprint IS NULL
        AND jsonb_typeof(settings_snapshot) = 'object'
      )
    );

CREATE UNIQUE INDEX search_reconciliation_cases_paid_request_key
  ON crewcast.search_reconciliation_cases (user_id, source_request_id)
  WHERE case_type = 'paid_search';

CREATE FUNCTION crewcast.alert_uncertain_paid_search()
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
      'paid_search',
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

CREATE TRIGGER search_credit_reservations_reconciliation_alert
AFTER INSERT OR UPDATE OF status ON crewcast.search_credit_reservations
FOR EACH ROW
EXECUTE FUNCTION crewcast.alert_uncertain_paid_search();

-- A pre-0019 process may already have reserved a credit without a job. There
-- is no reliable way to prove whether its external launch happened, so migrate
-- it fail-closed into the same operator workflow instead of stranding it.
UPDATE crewcast.search_credit_reservations
SET
  launch_attempted_at = created_at,
  status = 'uncertain',
  uncertain_at = statement_timestamp(),
  error_message = 'Pre-migration reservation had no job; provider launch requires review.',
  updated_at = statement_timestamp()
WHERE status = 'reserved'
  AND search_job_id IS NULL
  AND launch_attempted_at IS NULL;

COMMENT ON COLUMN crewcast.search_credit_reservations.launch_attempted_at IS
  'Committed before an ordinary paid provider launch; prevents unsafe automatic retries after process or network ambiguity.';
COMMENT ON COLUMN crewcast.search_credit_reservations.uncertain_at IS
  'Time an ambiguous ordinary paid provider launch entered operator-only reconciliation.';
COMMENT ON COLUMN crewcast.search_credit_reservations.error_message IS
  'Bounded failure evidence for an ambiguous ordinary paid provider launch.';
