DROP INDEX crewcast.search_job_results_location_job_idx;

ALTER TABLE crewcast.search_job_results
  DROP CONSTRAINT search_job_results_exact_affiliate_fkey,
  DROP CONSTRAINT search_job_results_exact_job_fkey,
  DROP CONSTRAINT search_job_results_brand_location_pair_check,
  DROP COLUMN brand_location_id,
  DROP COLUMN brand_id;

ALTER TABLE crewcast.saved_affiliates
  DROP CONSTRAINT saved_affiliates_exact_location_key,
  DROP CONSTRAINT saved_affiliates_location_link_key;

ALTER TABLE crewcast.discovered_affiliates
  DROP CONSTRAINT discovered_affiliates_exact_location_key,
  DROP CONSTRAINT discovered_affiliates_location_link_key;
