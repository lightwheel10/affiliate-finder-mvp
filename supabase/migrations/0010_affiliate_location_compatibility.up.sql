-- Add the location-scoped identity before removing the legacy account-wide
-- identity. This migration is intentionally compatible with both old and new
-- application instances during a rolling deployment.

ALTER TABLE crewcast.discovered_affiliates
  ADD CONSTRAINT discovered_affiliates_location_link_key
    UNIQUE (brand_location_id, link),
  ADD CONSTRAINT discovered_affiliates_exact_location_key
    UNIQUE (id, user_id, brand_id, brand_location_id);

ALTER TABLE crewcast.saved_affiliates
  ADD CONSTRAINT saved_affiliates_location_link_key
    UNIQUE (brand_location_id, link),
  ADD CONSTRAINT saved_affiliates_exact_location_key
    UNIQUE (id, user_id, brand_id, brand_location_id);

ALTER TABLE crewcast.search_job_results
  ADD COLUMN brand_id bigint,
  ADD COLUMN brand_location_id bigint;

UPDATE crewcast.search_job_results AS results
SET
  brand_id = jobs.brand_id,
  brand_location_id = jobs.brand_location_id
FROM crewcast.search_jobs AS jobs
WHERE jobs.id = results.search_job_id
  AND jobs.user_id = results.user_id;

DO $block$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM crewcast.search_job_results
    WHERE brand_id IS NULL OR brand_location_id IS NULL
  ) THEN
    RAISE EXCEPTION
      'Cannot establish search-result location provenance: one or more occurrence rows have no owned search job.';
  END IF;
END;
$block$;

ALTER TABLE crewcast.search_job_results
  ADD CONSTRAINT search_job_results_brand_location_pair_check
    CHECK ((brand_id IS NULL) = (brand_location_id IS NULL)),
  ADD CONSTRAINT search_job_results_exact_job_fkey
    FOREIGN KEY (search_job_id, user_id, brand_id, brand_location_id)
    REFERENCES crewcast.search_jobs (id, user_id, brand_id, brand_location_id)
    ON UPDATE RESTRICT
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT search_job_results_exact_affiliate_fkey
    FOREIGN KEY (discovered_affiliate_id, user_id, brand_id, brand_location_id)
    REFERENCES crewcast.discovered_affiliates (id, user_id, brand_id, brand_location_id)
    ON UPDATE RESTRICT
    ON DELETE SET NULL (discovered_affiliate_id)
    DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX search_job_results_location_job_idx
  ON crewcast.search_job_results (brand_location_id, search_job_id, id)
  WHERE brand_location_id IS NOT NULL;

COMMENT ON CONSTRAINT discovered_affiliates_location_link_key
  ON crewcast.discovered_affiliates IS
  'A link is unique inside one brand location; the same link may exist in another location after the account-wide compatibility key is removed.';

COMMENT ON CONSTRAINT saved_affiliates_location_link_key
  ON crewcast.saved_affiliates IS
  'A saved link is unique inside one brand location; the same link may exist in another location after the account-wide compatibility key is removed.';

COMMENT ON COLUMN crewcast.search_job_results.brand_location_id IS
  'Immutable location snapshot inherited from the owning search job. Nullable only during the rolling compatibility window.';
