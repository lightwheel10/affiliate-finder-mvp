ALTER TABLE crewcast.brand_locations
  ADD CONSTRAINT brand_locations_id_brand_id_user_id_key
  UNIQUE (id, brand_id, user_id);

ALTER TABLE crewcast.search_jobs
  ADD COLUMN brand_id bigint,
  ADD COLUMN brand_location_id bigint,
  ADD COLUMN settings_snapshot jsonb,
  ADD CONSTRAINT search_jobs_brand_location_pair_check
    CHECK ((brand_id IS NULL) = (brand_location_id IS NULL)),
  ADD CONSTRAINT search_jobs_settings_snapshot_object_check
    CHECK (
      settings_snapshot IS NULL
      OR jsonb_typeof(settings_snapshot) = 'object'
    ),
  ADD CONSTRAINT search_jobs_brand_location_owner_fkey
    FOREIGN KEY (brand_location_id, brand_id, user_id)
    REFERENCES crewcast.brand_locations (id, brand_id, user_id)
    ON UPDATE RESTRICT
    ON DELETE NO ACTION
    DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT search_jobs_id_user_id_key UNIQUE (id, user_id);

ALTER TABLE crewcast.searches
  ADD COLUMN brand_id bigint,
  ADD COLUMN brand_location_id bigint,
  ADD CONSTRAINT searches_brand_location_pair_check
    CHECK ((brand_id IS NULL) = (brand_location_id IS NULL)),
  ADD CONSTRAINT searches_brand_location_owner_fkey
    FOREIGN KEY (brand_location_id, brand_id, user_id)
    REFERENCES crewcast.brand_locations (id, brand_id, user_id)
    ON UPDATE RESTRICT
    ON DELETE NO ACTION
    DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE crewcast.discovered_affiliates
  ADD COLUMN brand_id bigint,
  ADD COLUMN brand_location_id bigint,
  ADD CONSTRAINT discovered_affiliates_brand_location_pair_check
    CHECK ((brand_id IS NULL) = (brand_location_id IS NULL)),
  ADD CONSTRAINT discovered_affiliates_brand_location_owner_fkey
    FOREIGN KEY (brand_location_id, brand_id, user_id)
    REFERENCES crewcast.brand_locations (id, brand_id, user_id)
    ON UPDATE RESTRICT
    ON DELETE NO ACTION
    DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT discovered_affiliates_id_user_id_key UNIQUE (id, user_id);

ALTER TABLE crewcast.saved_affiliates
  ADD COLUMN brand_id bigint,
  ADD COLUMN brand_location_id bigint,
  ADD CONSTRAINT saved_affiliates_brand_location_pair_check
    CHECK ((brand_id IS NULL) = (brand_location_id IS NULL)),
  ADD CONSTRAINT saved_affiliates_brand_location_owner_fkey
    FOREIGN KEY (brand_location_id, brand_id, user_id)
    REFERENCES crewcast.brand_locations (id, brand_id, user_id)
    ON UPDATE RESTRICT
    ON DELETE NO ACTION
    DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE crewcast.api_calls
  ADD COLUMN brand_id bigint,
  ADD COLUMN brand_location_id bigint,
  ADD CONSTRAINT api_calls_brand_location_context_check
    CHECK (
      (
        brand_id IS NULL
        AND brand_location_id IS NULL
      )
      OR (
        user_id IS NOT NULL
        AND brand_id IS NOT NULL
        AND brand_location_id IS NOT NULL
      )
    ),
  ADD CONSTRAINT api_calls_brand_location_owner_fkey
    FOREIGN KEY (brand_location_id, brand_id, user_id)
    REFERENCES crewcast.brand_locations (id, brand_id, user_id)
    ON UPDATE RESTRICT
    ON DELETE NO ACTION
    DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE crewcast.credit_transactions
  ADD COLUMN brand_id bigint,
  ADD COLUMN brand_location_id bigint,
  ADD CONSTRAINT credit_transactions_brand_location_pair_check
    CHECK ((brand_id IS NULL) = (brand_location_id IS NULL)),
  ADD CONSTRAINT credit_transactions_brand_location_owner_fkey
    FOREIGN KEY (brand_location_id, brand_id, user_id)
    REFERENCES crewcast.brand_locations (id, brand_id, user_id)
    ON UPDATE RESTRICT
    ON DELETE NO ACTION
    DEFERRABLE INITIALLY DEFERRED;

CREATE FUNCTION crewcast.enforce_search_job_provenance_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF OLD.settings_snapshot IS NOT NULL
     AND NEW.settings_snapshot IS DISTINCT FROM OLD.settings_snapshot THEN
    RAISE EXCEPTION 'search_jobs.settings_snapshot cannot be changed after assignment';
  END IF;

  IF OLD.brand_id IS NOT NULL
     AND (
       NEW.brand_id IS DISTINCT FROM OLD.brand_id
       OR NEW.brand_location_id IS DISTINCT FROM OLD.brand_location_id
     ) THEN
    RAISE EXCEPTION 'search_jobs brand/location attribution cannot be changed after assignment';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER search_jobs_provenance_immutable
BEFORE UPDATE OF brand_id, brand_location_id, settings_snapshot
ON crewcast.search_jobs
FOR EACH ROW
EXECUTE FUNCTION crewcast.enforce_search_job_provenance_immutable();

CREATE TABLE crewcast.search_job_results (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id integer NOT NULL,
  search_job_id integer NOT NULL,
  discovered_affiliate_id integer,
  result_link text NOT NULL,
  affiliate_was_new boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT search_job_results_search_job_owner_fkey
    FOREIGN KEY (search_job_id, user_id)
    REFERENCES crewcast.search_jobs (id, user_id)
    ON UPDATE RESTRICT
    ON DELETE CASCADE,
  CONSTRAINT search_job_results_affiliate_owner_fkey
    FOREIGN KEY (discovered_affiliate_id, user_id)
    REFERENCES crewcast.discovered_affiliates (id, user_id)
    ON UPDATE RESTRICT
    ON DELETE SET NULL (discovered_affiliate_id),
  CONSTRAINT search_job_results_result_link_check
    CHECK (btrim(result_link) <> ''),
  CONSTRAINT search_job_results_job_link_key
    UNIQUE (search_job_id, result_link)
);

CREATE INDEX search_jobs_brand_location_created_at_idx
  ON crewcast.search_jobs (brand_location_id, created_at DESC NULLS LAST, id DESC)
  WHERE brand_location_id IS NOT NULL;

CREATE INDEX searches_brand_location_searched_at_idx
  ON crewcast.searches (brand_location_id, searched_at DESC NULLS LAST, id DESC)
  WHERE brand_location_id IS NOT NULL;

CREATE INDEX discovered_affiliates_brand_location_discovered_at_idx
  ON crewcast.discovered_affiliates (
    brand_location_id,
    discovered_at DESC NULLS LAST,
    id DESC
  )
  WHERE brand_location_id IS NOT NULL;

CREATE INDEX saved_affiliates_brand_location_saved_at_idx
  ON crewcast.saved_affiliates (
    brand_location_id,
    saved_at DESC NULLS LAST,
    id DESC
  )
  WHERE brand_location_id IS NOT NULL;

CREATE INDEX api_calls_brand_location_created_at_idx
  ON crewcast.api_calls (brand_location_id, created_at DESC NULLS LAST, id DESC)
  WHERE brand_location_id IS NOT NULL;

CREATE INDEX credit_transactions_brand_location_created_at_idx
  ON crewcast.credit_transactions (
    brand_location_id,
    created_at DESC NULLS LAST,
    id DESC
  )
  WHERE brand_location_id IS NOT NULL;

CREATE INDEX search_job_results_user_created_at_idx
  ON crewcast.search_job_results (user_id, created_at DESC, id DESC);

CREATE INDEX search_job_results_affiliate_created_at_idx
  ON crewcast.search_job_results (
    discovered_affiliate_id,
    created_at DESC,
    id DESC
  )
  WHERE discovered_affiliate_id IS NOT NULL;

ALTER TABLE crewcast.search_job_results ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE crewcast.search_job_results
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON SEQUENCE crewcast.search_job_results_id_seq
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON COLUMN crewcast.search_jobs.settings_snapshot IS
  'Immutable, real JSON object captured when a search starts. Legacy user_settings remains untouched during migration.';
COMMENT ON TABLE crewcast.search_job_results IS
  'One durable affiliate occurrence per search job. Repeated discovery across jobs is preserved even when the canonical affiliate already existed.';
COMMENT ON COLUMN crewcast.search_job_results.discovered_affiliate_id IS
  'Optional link to the current canonical discovered-affiliate row. It is cleared if that row is deleted; result_link preserves provenance.';
COMMENT ON COLUMN crewcast.search_job_results.affiliate_was_new IS
  'True only when this job created the canonical discovered-affiliate row; false when it rediscovered an existing row.';
