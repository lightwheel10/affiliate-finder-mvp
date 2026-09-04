ALTER TABLE crewcast.search_job_results
  ADD COLUMN result_snapshot jsonb,
  ADD CONSTRAINT search_job_results_snapshot_object_check
    CHECK (
      result_snapshot IS NULL
      OR jsonb_typeof(result_snapshot) = 'object'
    );

CREATE FUNCTION crewcast.prevent_search_result_provenance_update()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF ROW(
    NEW.search_job_id,
    NEW.user_id,
    NEW.result_link,
    NEW.affiliate_was_new,
    NEW.result_snapshot
  ) IS DISTINCT FROM ROW(
    OLD.search_job_id,
    OLD.user_id,
    OLD.result_link,
    OLD.affiliate_was_new,
    OLD.result_snapshot
  ) THEN
    RAISE EXCEPTION 'Search result provenance is immutable once recorded.';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER search_job_results_provenance_immutable
BEFORE UPDATE ON crewcast.search_job_results
FOR EACH ROW
EXECUTE FUNCTION crewcast.prevent_search_result_provenance_update();

ALTER TABLE crewcast.api_calls
  ADD COLUMN search_job_id integer,
  ADD CONSTRAINT api_calls_search_job_owner_fkey
    FOREIGN KEY (search_job_id, user_id)
    REFERENCES crewcast.search_jobs (id, user_id)
    ON UPDATE RESTRICT
    ON DELETE SET NULL (search_job_id);

ALTER TABLE crewcast.credit_transactions
  ADD COLUMN search_job_id integer,
  ADD CONSTRAINT credit_transactions_search_job_owner_fkey
    FOREIGN KEY (search_job_id, user_id)
    REFERENCES crewcast.search_jobs (id, user_id)
    ON UPDATE RESTRICT
    ON DELETE SET NULL (search_job_id);

CREATE UNIQUE INDEX credit_transactions_search_job_usage_key
  ON crewcast.credit_transactions (search_job_id)
  WHERE search_job_id IS NOT NULL
    AND credit_type = 'topic_search'
    AND reason = 'usage';

CREATE UNIQUE INDEX api_calls_search_job_status_key
  ON crewcast.api_calls (search_job_id)
  WHERE search_job_id IS NOT NULL
    AND service = 'apify_google_scraper'
    AND endpoint = 'status';

COMMENT ON COLUMN crewcast.search_job_results.result_snapshot IS
  'Immutable JSON result returned by this search. Nullable only for rolling compatibility; current status writers always supply an object.';
COMMENT ON COLUMN crewcast.api_calls.search_job_id IS
  'Exact search job that incurred this API-cost audit row. Null only for legacy and non-search activity.';
COMMENT ON COLUMN crewcast.credit_transactions.search_job_id IS
  'Exact search job charged or refunded by this credit audit row. The partial unique index makes topic-search usage exactly once per job.';
