LOCK TABLE crewcast.brands, crewcast.brand_locations
  IN SHARE ROW EXCLUSIVE MODE;

-- Migration 0003 used these checks to prove that every imported account had
-- one reachable compatibility default immediately after backfill. Keeping the
-- checks forever would prevent a real customer from replacing or archiving the
-- imported default. The immutable marker triggers remain in place, so relaxing
-- the lifecycle check does not erase or rewrite historical provenance.
ALTER TABLE crewcast.brands
  DROP CONSTRAINT brands_legacy_import_default_check;

ALTER TABLE crewcast.brand_locations
  DROP CONSTRAINT brand_locations_legacy_import_default_check;

COMMENT ON COLUMN crewcast.brands.legacy_imported_at IS
  'Immutable marker for the brand created from the legacy account profile by migration 0003; later lifecycle changes do not alter this provenance.';

COMMENT ON COLUMN crewcast.brand_locations.legacy_imported_at IS
  'Immutable marker for the location created from legacy profile and subscription settings by migration 0003; later lifecycle changes do not alter this provenance.';

DO $postflight$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE connamespace = 'crewcast'::regnamespace
      AND conname IN (
        'brands_legacy_import_default_check',
        'brand_locations_legacy_import_default_check'
      )
  ) THEN
    RAISE EXCEPTION '0012 postflight failed: legacy lifecycle checks remain.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'crewcast.brands'::regclass
      AND tgname = 'brands_legacy_import_marker_immutable'
      AND NOT tgisinternal
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'crewcast.brand_locations'::regclass
      AND tgname = 'brand_locations_legacy_import_marker_immutable'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION '0012 postflight failed: immutable marker protection is missing.';
  END IF;
END;
$postflight$;
