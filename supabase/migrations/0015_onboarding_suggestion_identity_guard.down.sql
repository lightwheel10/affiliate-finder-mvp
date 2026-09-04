DO $rollback_guard$
BEGIN
  IF EXISTS (SELECT 1 FROM crewcast.onboarding_suggestion_identity_guards) THEN
    RAISE EXCEPTION
      'Refusing to roll back 0015: onboarding suggestion identity guards exist.';
  END IF;
END;
$rollback_guard$;

DROP TABLE crewcast.onboarding_suggestion_identity_guards;
