DO $guard$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM crewcast.onboarding_search_entitlements
    WHERE legacy_imported_at IS NULL
    LIMIT 1
  ) THEN
    RAISE EXCEPTION
      'Refusing 0008 rollback: non-backfilled onboarding-search entitlement history exists.';
  END IF;
END;
$guard$;

DROP TRIGGER onboarding_search_entitlements_lifecycle
  ON crewcast.onboarding_search_entitlements;
DROP FUNCTION crewcast.enforce_onboarding_search_entitlement_lifecycle();
DROP TABLE crewcast.onboarding_search_entitlements;
