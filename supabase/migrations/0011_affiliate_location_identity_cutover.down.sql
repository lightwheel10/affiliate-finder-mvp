-- A rollback must never delete or merge customer data. Once the same link has
-- legitimately been stored in multiple locations, account-wide uniqueness
-- cannot be restored until an operator deliberately resolves those rows.

DO $block$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM crewcast.discovered_affiliates
    GROUP BY user_id, link
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot roll back location identity: discovered affiliates contain valid cross-location duplicates.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM crewcast.saved_affiliates
    GROUP BY user_id, link
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot roll back location identity: saved affiliates contain valid cross-location duplicates.';
  END IF;
END;
$block$;

DROP TRIGGER saved_affiliates_location_identity_immutable
  ON crewcast.saved_affiliates;
DROP TRIGGER discovered_affiliates_location_identity_immutable
  ON crewcast.discovered_affiliates;
DROP FUNCTION crewcast.prevent_affiliate_location_identity_update();

-- Restore the exact pre-cutover result-provenance definition from migration
-- 0005. The stronger definition is reinstalled whenever 0011 is applied again.
CREATE OR REPLACE FUNCTION crewcast.prevent_search_result_provenance_update()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF ROW(
    NEW.search_job_id,
    NEW.user_id,
    NEW.result_link,
    NEW.affiliate_was_new,
    NEW.result_snapshot
  ) IS DISTINCT FROM ROW(
    OLD.search_job_id,
    OLD.user_id,
    OLD.result_link,
    OLD.affiliate_was_new,
    OLD.result_snapshot
  ) THEN
    RAISE EXCEPTION 'Search result provenance is immutable once recorded.';
  END IF;
  RETURN NEW;
END;
$function$;

ALTER TABLE crewcast.discovered_affiliates
  ADD CONSTRAINT discovered_affiliates_user_id_link_key UNIQUE (user_id, link),
  ALTER COLUMN brand_location_id DROP NOT NULL,
  ALTER COLUMN brand_id DROP NOT NULL;

ALTER TABLE crewcast.saved_affiliates
  ADD CONSTRAINT saved_affiliates_user_id_link_key UNIQUE (user_id, link),
  ALTER COLUMN brand_location_id DROP NOT NULL,
  ALTER COLUMN brand_id DROP NOT NULL;

ALTER TABLE crewcast.search_job_results
  ALTER COLUMN brand_location_id DROP NOT NULL,
  ALTER COLUMN brand_id DROP NOT NULL;

COMMENT ON COLUMN crewcast.search_job_results.brand_location_id IS
  'Immutable location snapshot inherited from the owning search job. Nullable only during the rolling compatibility window.';
