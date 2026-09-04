DROP TRIGGER weekly_auto_scan_provider_runs_immutable
  ON crewcast.weekly_auto_scan_provider_runs;
DROP TRIGGER weekly_auto_scan_provider_runs_set_updated_at
  ON crewcast.weekly_auto_scan_provider_runs;
DROP FUNCTION crewcast.enforce_weekly_auto_scan_provider_run_immutable();
DROP TABLE crewcast.weekly_auto_scan_provider_runs;

UPDATE crewcast.weekly_auto_scan_locations
SET estimated_cost = 0
WHERE estimated_cost IS NULL;

ALTER TABLE crewcast.weekly_auto_scan_locations
  ALTER COLUMN estimated_cost SET DEFAULT 0,
  ALTER COLUMN estimated_cost SET NOT NULL;

COMMENT ON COLUMN crewcast.weekly_auto_scan_locations.estimated_cost IS NULL;
