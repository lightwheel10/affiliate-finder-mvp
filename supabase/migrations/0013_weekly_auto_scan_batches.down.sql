DO $rollback_guard$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM crewcast.weekly_auto_scan_batches
    WHERE provider_launch_attempted_at IS NOT NULL
       OR status NOT IN ('pending', 'no_work')
  ) THEN
    RAISE EXCEPTION
      'Refusing to roll back 0013: a weekly auto-scan batch has begun runtime processing.';
  END IF;
END;
$rollback_guard$;

DROP TRIGGER weekly_auto_scan_locations_immutable
  ON crewcast.weekly_auto_scan_locations;
DROP TRIGGER weekly_auto_scan_locations_set_updated_at
  ON crewcast.weekly_auto_scan_locations;
DROP TRIGGER weekly_auto_scan_batches_immutable
  ON crewcast.weekly_auto_scan_batches;
DROP TRIGGER weekly_auto_scan_batches_set_updated_at
  ON crewcast.weekly_auto_scan_batches;

DROP FUNCTION crewcast.enforce_weekly_auto_scan_location_immutable();
DROP FUNCTION crewcast.enforce_weekly_auto_scan_batch_immutable();

DROP TABLE crewcast.weekly_auto_scan_locations;
DROP TABLE crewcast.weekly_auto_scan_batches;
