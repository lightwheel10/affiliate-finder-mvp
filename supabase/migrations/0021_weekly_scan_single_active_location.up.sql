CREATE UNIQUE INDEX weekly_auto_scan_locations_one_active_per_batch_key
  ON crewcast.weekly_auto_scan_locations (batch_id)
  WHERE status IN ('claimed', 'dispatching', 'running');

COMMENT ON INDEX crewcast.weekly_auto_scan_locations_one_active_per_batch_key IS
  'Database safety net: an account-wide weekly batch processes no more than one location at a time.';
