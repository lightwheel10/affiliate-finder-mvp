ALTER TABLE crewcast.search_jobs
  ADD COLUMN request_id uuid;

CREATE UNIQUE INDEX search_jobs_user_request_id_key
  ON crewcast.search_jobs (user_id, request_id)
  WHERE request_id IS NOT NULL;

COMMENT ON COLUMN crewcast.search_jobs.request_id IS
  'Client-generated idempotency key for one logical search-start request. Null only for legacy clients and historical jobs.';
