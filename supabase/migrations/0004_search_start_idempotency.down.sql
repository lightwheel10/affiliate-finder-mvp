DO $guard$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM crewcast.search_jobs
    WHERE request_id IS NOT NULL
    LIMIT 1
  ) THEN
    RAISE EXCEPTION
      'Refusing to remove search-start idempotency after runtime request IDs exist';
  END IF;
END;
$guard$;

DROP INDEX crewcast.search_jobs_user_request_id_key;

ALTER TABLE crewcast.search_jobs
  DROP COLUMN request_id;
