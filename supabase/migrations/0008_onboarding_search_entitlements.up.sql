CREATE TABLE crewcast.onboarding_search_entitlements (
  user_id integer PRIMARY KEY,
  brand_id bigint NOT NULL,
  brand_location_id bigint NOT NULL,
  request_id uuid,
  search_job_id integer,
  settings_snapshot jsonb,
  status text NOT NULL DEFAULT 'available',
  claimed_at timestamptz,
  claim_expires_at timestamptz,
  launch_attempted_at timestamptz,
  provider_run_id text,
  consumed_at timestamptz,
  uncertain_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  legacy_imported_at timestamptz,

  CONSTRAINT onboarding_search_entitlements_location_owner_fkey
    FOREIGN KEY (brand_location_id, brand_id, user_id)
    REFERENCES crewcast.brand_locations (id, brand_id, user_id)
    ON UPDATE RESTRICT
    ON DELETE NO ACTION,
  CONSTRAINT onboarding_search_entitlements_exact_job_fkey
    FOREIGN KEY (search_job_id, user_id, brand_id, brand_location_id)
    REFERENCES crewcast.search_jobs (id, user_id, brand_id, brand_location_id)
    ON UPDATE RESTRICT
    ON DELETE NO ACTION,
  CONSTRAINT onboarding_search_entitlements_search_job_key
    UNIQUE (search_job_id),
  CONSTRAINT onboarding_search_entitlements_provider_run_key
    UNIQUE (provider_run_id),
  CONSTRAINT onboarding_search_entitlements_snapshot_check
    CHECK (
      settings_snapshot IS NULL
      OR jsonb_typeof(settings_snapshot) = 'object'
    ),
  CONSTRAINT onboarding_search_entitlements_provider_run_check
    CHECK (
      provider_run_id IS NULL
      OR (
        btrim(provider_run_id) <> ''
        AND length(provider_run_id) <= 255
        AND provider_run_id !~ '[[:cntrl:]]'
      )
    ),
  CONSTRAINT onboarding_search_entitlements_error_check
    CHECK (error_message IS NULL OR length(error_message) <= 2000),
  CONSTRAINT onboarding_search_entitlements_status_check
    CHECK (status IN ('available', 'reserved', 'dispatching', 'consumed', 'uncertain')),
  CONSTRAINT onboarding_search_entitlements_lifecycle_check
    CHECK (
      (
        status = 'available'
        AND request_id IS NULL
        AND search_job_id IS NULL
        AND settings_snapshot IS NULL
        AND claimed_at IS NULL
        AND claim_expires_at IS NULL
        AND launch_attempted_at IS NULL
        AND provider_run_id IS NULL
        AND consumed_at IS NULL
        AND uncertain_at IS NULL
        AND error_message IS NULL
        AND legacy_imported_at IS NULL
      )
      OR (
        status = 'reserved'
        AND request_id IS NOT NULL
        AND search_job_id IS NULL
        AND settings_snapshot IS NOT NULL
        AND claimed_at IS NOT NULL
        AND claim_expires_at > claimed_at
        AND launch_attempted_at IS NULL
        AND provider_run_id IS NULL
        AND consumed_at IS NULL
        AND uncertain_at IS NULL
        AND error_message IS NULL
        AND legacy_imported_at IS NULL
      )
      OR (
        status = 'dispatching'
        AND request_id IS NOT NULL
        AND search_job_id IS NULL
        AND settings_snapshot IS NOT NULL
        AND claimed_at IS NOT NULL
        AND claim_expires_at IS NULL
        AND launch_attempted_at IS NOT NULL
        AND provider_run_id IS NULL
        AND consumed_at IS NULL
        AND uncertain_at IS NULL
        AND error_message IS NULL
        AND legacy_imported_at IS NULL
      )
      OR (
        status = 'consumed'
        AND request_id IS NOT NULL
        AND settings_snapshot IS NOT NULL
        AND claimed_at IS NOT NULL
        AND claim_expires_at IS NULL
        AND launch_attempted_at IS NOT NULL
        AND consumed_at IS NOT NULL
        AND uncertain_at IS NULL
        AND error_message IS NULL
        AND (
          (
            legacy_imported_at IS NULL
            AND search_job_id IS NOT NULL
            AND provider_run_id IS NOT NULL
          )
          OR (
            legacy_imported_at IS NOT NULL
            AND search_job_id IS NULL
            AND provider_run_id IS NULL
          )
        )
      )
      OR (
        status = 'uncertain'
        AND request_id IS NOT NULL
        AND search_job_id IS NULL
        AND settings_snapshot IS NOT NULL
        AND claimed_at IS NOT NULL
        AND claim_expires_at IS NULL
        AND launch_attempted_at IS NOT NULL
        AND provider_run_id IS NULL
        AND consumed_at IS NULL
        AND uncertain_at IS NOT NULL
        AND error_message IS NOT NULL
        AND legacy_imported_at IS NULL
      )
    )
);

CREATE INDEX onboarding_search_entitlements_status_updated_at_idx
  ON crewcast.onboarding_search_entitlements (status, updated_at DESC, user_id);

CREATE FUNCTION crewcast.enforce_onboarding_search_entitlement_lifecycle()
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
  ELSIF OLD.status IN ('consumed', 'uncertain')
        AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'A terminal onboarding-search entitlement is immutable.';
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

CREATE TRIGGER onboarding_search_entitlements_lifecycle
BEFORE UPDATE ON crewcast.onboarding_search_entitlements
FOR EACH ROW
EXECUTE FUNCTION crewcast.enforce_onboarding_search_entitlement_lifecycle();

DO $guard$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM crewcast.users AS users
    LEFT JOIN crewcast.brands AS brands
      ON brands.user_id = users.id
     AND brands.is_default
     AND brands.archived_at IS NULL
    LEFT JOIN crewcast.brand_locations AS locations
      ON locations.user_id = users.id
     AND locations.brand_id = brands.id
     AND locations.is_default
     AND locations.archived_at IS NULL
    WHERE users.is_onboarded
      AND (brands.id IS NULL OR locations.id IS NULL)
  ) THEN
    RAISE EXCEPTION
      'Refusing onboarding-search entitlement backfill: an onboarded account has no active default brand/location.';
  END IF;
END;
$guard$;

INSERT INTO crewcast.onboarding_search_entitlements (
  user_id,
  brand_id,
  brand_location_id,
  request_id,
  settings_snapshot,
  status,
  claimed_at,
  launch_attempted_at,
  consumed_at,
  created_at,
  updated_at,
  legacy_imported_at
)
SELECT
  users.id,
  brands.id,
  locations.id,
  md5('legacy-onboarding-search:' || users.id::text)::uuid,
  jsonb_build_object(
    'version', 1,
    'brand', jsonb_build_object(
      'id', brands.id::text,
      'name', brands.name,
      'normalizedDomain', brands.normalized_domain
    ),
    'location', jsonb_build_object(
      'id', locations.id::text,
      'countryCode', locations.country_code,
      'countryName', users.target_country,
      'languageCode', locations.language_code,
      'languageName', users.target_language
    ),
    'search', jsonb_build_object(
      'keywords', to_jsonb(locations.topics),
      'competitors', to_jsonb(locations.competitors),
      'sources', to_jsonb(ARRAY['Web', 'YouTube', 'Instagram', 'TikTok']::text[]),
      'requestId', md5('legacy-onboarding-search:' || users.id::text)::uuid::text,
      'isOnboarding', true
    )
  ),
  'consumed',
  transaction_timestamp(),
  transaction_timestamp(),
  transaction_timestamp(),
  transaction_timestamp(),
  transaction_timestamp(),
  transaction_timestamp()
FROM crewcast.users AS users
JOIN crewcast.brands AS brands
  ON brands.user_id = users.id
 AND brands.is_default
 AND brands.archived_at IS NULL
JOIN crewcast.brand_locations AS locations
  ON locations.user_id = users.id
 AND locations.brand_id = brands.id
 AND locations.is_default
 AND locations.archived_at IS NULL
WHERE users.is_onboarded;

ALTER TABLE crewcast.onboarding_search_entitlements ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE crewcast.onboarding_search_entitlements
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON TABLE crewcast.onboarding_search_entitlements IS
  'One server-owned free onboarding-search entitlement per account. Every paid provider launch requires a durable claim tied to one exact brand/location.';
COMMENT ON COLUMN crewcast.onboarding_search_entitlements.claim_expires_at IS
  'Bounds only pre-launch crash recovery. It is cleared before the external provider call, after which automatic retries fail closed.';
COMMENT ON COLUMN crewcast.onboarding_search_entitlements.launch_attempted_at IS
  'Committed before the external provider call. A launch-attempted row is never automatically reclaimed unless a returned provider run is confirmed aborted.';
