DO $rollback_guard$
BEGIN
  IF EXISTS (SELECT 1 FROM crewcast.onboarding_suggestion_analyses) THEN
    RAISE EXCEPTION
      'Refusing to roll back 0014: onboarding suggestion analysis history exists.';
  END IF;
END;
$rollback_guard$;

DROP TRIGGER onboarding_suggestion_analyses_lifecycle
  ON crewcast.onboarding_suggestion_analyses;
DROP FUNCTION crewcast.enforce_onboarding_suggestion_analysis_lifecycle();
DROP TABLE crewcast.onboarding_suggestion_analyses;
