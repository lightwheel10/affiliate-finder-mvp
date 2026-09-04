DO $rollback_guard$
BEGIN
  IF EXISTS (SELECT 1 FROM crewcast.brand_locations LIMIT 1)
     OR EXISTS (SELECT 1 FROM crewcast.brands LIMIT 1) THEN
    RAISE EXCEPTION
      'Refusing to roll back 0001: brand or location data exists. Preserve the tables and use the feature flag instead.';
  END IF;
END;
$rollback_guard$;

DROP TRIGGER brand_locations_set_updated_at ON crewcast.brand_locations;
DROP TRIGGER brands_set_updated_at ON crewcast.brands;
DROP TABLE crewcast.brand_locations;
DROP TABLE crewcast.brands;
DROP FUNCTION crewcast.set_updated_at();
