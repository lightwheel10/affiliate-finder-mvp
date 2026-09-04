DO $guard$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM crewcast.search_job_results
    WHERE result_snapshot IS NOT NULL
    LIMIT 1
  )
  OR EXISTS (
    SELECT 1
    FROM crewcast.api_calls
    WHERE search_job_id IS NOT NULL
    LIMIT 1
  )
  OR EXISTS (
    SELECT 1
    FROM crewcast.credit_transactions
    WHERE search_job_id IS NOT NULL
    LIMIT 1
  ) THEN
    RAISE EXCEPTION
      'Refusing 0005 rollback: runtime search finalization provenance exists.';
  END IF;
END;
$guard$;

DROP INDEX crewcast.api_calls_search_job_status_key;
DROP INDEX crewcast.credit_transactions_search_job_usage_key;

DROP TRIGGER search_job_results_provenance_immutable
  ON crewcast.search_job_results;
DROP FUNCTION crewcast.prevent_search_result_provenance_update();

ALTER TABLE crewcast.credit_transactions
  DROP CONSTRAINT credit_transactions_search_job_owner_fkey,
  DROP COLUMN search_job_id;

ALTER TABLE crewcast.api_calls
  DROP CONSTRAINT api_calls_search_job_owner_fkey,
  DROP COLUMN search_job_id;

ALTER TABLE crewcast.search_job_results
  DROP CONSTRAINT search_job_results_snapshot_object_check,
  DROP COLUMN result_snapshot;
