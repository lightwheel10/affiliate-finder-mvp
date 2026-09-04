LOCK TABLE crewcast.brands, crewcast.brand_locations
  IN SHARE ROW EXCLUSIVE MODE;

DO $rollback_guard$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM crewcast.brands
    WHERE legacy_imported_at IS NOT NULL
      AND (NOT is_default OR archived_at IS NOT NULL)
  ) OR EXISTS (
    SELECT 1
    FROM crewcast.brand_locations
    WHERE legacy_imported_at IS NOT NULL
      AND (NOT is_default OR archived_at IS NOT NULL)
  ) THEN
    RAISE EXCEPTION
      'Refusing to roll back 0012: an imported brand or location has entered its runtime lifecycle.';
  END IF;
END;
$rollback_guard$;

ALTER TABLE crewcast.brands
  ADD CONSTRAINT brands_legacy_import_default_check
    CHECK (
      legacy_imported_at IS NULL
      OR (is_default AND archived_at IS NULL)
    );

ALTER TABLE crewcast.brand_locations
  ADD CONSTRAINT brand_locations_legacy_import_default_check
    CHECK (
      legacy_imported_at IS NULL
      OR (is_default AND archived_at IS NULL)
    );

COMMENT ON COLUMN crewcast.brands.legacy_imported_at IS
  'Set only on the default brand created by migration 0003 from the legacy account profile.';

COMMENT ON COLUMN crewcast.brand_locations.legacy_imported_at IS
  'Set only on the default location created by migration 0003 from legacy profile and subscription settings.';
