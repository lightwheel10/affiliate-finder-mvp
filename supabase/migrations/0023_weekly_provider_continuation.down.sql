DO $block$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM crewcast.weekly_auto_scan_locations
    WHERE status = 'waiting'
  ) THEN
    RAISE EXCEPTION
      'Cannot roll back weekly provider continuation while waiting work exists.';
  END IF;
END;
$block$;

DROP INDEX crewcast.weekly_auto_scan_locations_claimable_idx;

ALTER TABLE crewcast.weekly_auto_scan_locations
  DROP CONSTRAINT weekly_auto_scan_locations_status_check,
  DROP CONSTRAINT weekly_auto_scan_locations_claim_check,
  DROP CONSTRAINT weekly_auto_scan_locations_provider_check;

ALTER TABLE crewcast.weekly_auto_scan_locations
  ADD CONSTRAINT weekly_auto_scan_locations_status_check
    CHECK (status IN (
      'pending', 'claimed', 'dispatching', 'running',
      'succeeded', 'skipped', 'failed', 'uncertain'
    )),
  ADD CONSTRAINT weekly_auto_scan_locations_claim_check
    CHECK (
      (
        status = 'pending'
        AND claim_token IS NULL
        AND claimed_at IS NULL
        AND lease_expires_at IS NULL
        AND completed_at IS NULL
      )
      OR (
        status IN ('claimed', 'dispatching', 'running')
        AND claim_token IS NOT NULL
        AND claimed_at IS NOT NULL
        AND lease_expires_at IS NOT NULL
        AND lease_expires_at > claimed_at
        AND completed_at IS NULL
      )
      OR (
        status IN ('succeeded', 'skipped', 'failed', 'uncertain')
        AND claim_token IS NULL
        AND claimed_at IS NULL
        AND lease_expires_at IS NULL
        AND completed_at IS NOT NULL
      )
    ),
  ADD CONSTRAINT weekly_auto_scan_locations_provider_check
    CHECK (
      (
        status IN ('pending', 'claimed', 'skipped')
        AND launch_attempted_at IS NULL
        AND provider_run_id IS NULL
      )
      OR (
        status = 'dispatching'
        AND launch_attempted_at IS NOT NULL
        AND provider_run_id IS NULL
      )
      OR (
        status IN ('running', 'succeeded')
        AND launch_attempted_at IS NOT NULL
        AND provider_run_id IS NOT NULL
      )
      OR status IN ('failed', 'uncertain')
    );

CREATE INDEX weekly_auto_scan_locations_claimable_idx
  ON crewcast.weekly_auto_scan_locations (status, created_at, batch_id, position)
  WHERE status IN ('pending', 'claimed', 'dispatching', 'running');

COMMENT ON COLUMN crewcast.weekly_auto_scan_locations.status IS NULL;
