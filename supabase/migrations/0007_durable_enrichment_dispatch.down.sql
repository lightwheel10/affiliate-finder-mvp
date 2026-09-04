DO $guard$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM crewcast.search_enrichment_dispatches
    LIMIT 1
  ) THEN
    RAISE EXCEPTION
      'Refusing 0007 rollback: enrichment dispatch history exists.';
  END IF;
END;
$guard$;

DROP TRIGGER search_enrichment_dispatches_lifecycle
  ON crewcast.search_enrichment_dispatches;
DROP FUNCTION crewcast.enforce_search_enrichment_dispatch_lifecycle();
DROP TABLE crewcast.search_enrichment_dispatches;
ALTER TABLE crewcast.search_jobs
  DROP CONSTRAINT search_jobs_exact_provenance_key;
