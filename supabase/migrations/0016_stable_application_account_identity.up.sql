-- Add the immutable Supabase Auth identity without breaking an older
-- application instance during a rolling deployment. Email remains a mutable
-- contact field and is used only to backfill pre-migration rows.

ALTER TABLE crewcast.users
  ADD COLUMN auth_user_id uuid;

DO $preflight$
BEGIN
  IF EXISTS (
    SELECT lower(btrim(email))
    FROM crewcast.users
    GROUP BY lower(btrim(email))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot bind Auth identities: duplicate normalized application emails exist.';
  END IF;

  IF EXISTS (
    SELECT lower(btrim(email))
    FROM auth.users
    WHERE email IS NOT NULL
    GROUP BY lower(btrim(email))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot bind Auth identities: duplicate normalized Supabase emails exist.';
  END IF;

  IF EXISTS (
    SELECT application_users.id
    FROM crewcast.users AS application_users
    LEFT JOIN auth.users AS auth_users
      ON lower(btrim(auth_users.email)) = lower(btrim(application_users.email))
    GROUP BY application_users.id
    HAVING count(auth_users.id) <> 1
  ) THEN
    RAISE EXCEPTION 'Cannot bind Auth identities: every application account must have exactly one Auth match.';
  END IF;
END;
$preflight$;

UPDATE crewcast.users AS application_users
SET auth_user_id = auth_users.id
FROM auth.users AS auth_users
WHERE lower(btrim(auth_users.email)) = lower(btrim(application_users.email));

DO $verification$
BEGIN
  IF EXISTS (SELECT 1 FROM crewcast.users WHERE auth_user_id IS NULL) THEN
    RAISE EXCEPTION 'Auth identity backfill left one or more application accounts unbound.';
  END IF;

  IF EXISTS (
    SELECT auth_user_id
    FROM crewcast.users
    GROUP BY auth_user_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Auth identity backfill assigned one identity to multiple application accounts.';
  END IF;
END;
$verification$;

ALTER TABLE crewcast.users
  ADD CONSTRAINT users_auth_user_id_key UNIQUE (auth_user_id),
  ADD CONSTRAINT users_auth_user_id_fkey
    FOREIGN KEY (auth_user_id)
    REFERENCES auth.users (id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT;

CREATE FUNCTION crewcast.protect_application_account_auth_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF OLD.auth_user_id IS NOT NULL
     AND NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id THEN
    RAISE EXCEPTION 'Application account Auth identity is immutable once assigned.';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER users_auth_user_id_immutable
BEFORE UPDATE OF auth_user_id ON crewcast.users
FOR EACH ROW
EXECUTE FUNCTION crewcast.protect_application_account_auth_identity();

-- Older application instances do not yet send auth_user_id. During the short
-- schema-first rollout window, assign it from the same unique Auth/email match
-- that was validated above. The trigger is compatibility-only; new code writes
-- the UUID explicitly and never uses email as ownership authority.
CREATE FUNCTION crewcast.assign_application_account_auth_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
  matching_ids uuid[];
  existing_account_id integer;
BEGIN
  IF NEW.auth_user_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT array_agg(auth_users.id ORDER BY auth_users.id)
  INTO matching_ids
  FROM auth.users AS auth_users
  WHERE lower(btrim(auth_users.email)) = lower(btrim(NEW.email));

  IF cardinality(matching_ids) > 1 THEN
    RAISE EXCEPTION 'Cannot assign Auth identity: email matches multiple Auth users.';
  END IF;
  IF cardinality(matching_ids) = 1 THEN
    -- An old server still inserts by email. If this Auth UUID already owns an
    -- application account (for example after a confirmed email change), turn
    -- that legacy insert into an email synchronization and suppress the new
    -- row. The old route then performs its existing SELECT-by-email fallback
    -- and receives the same account instead of a UUID uniqueness error.
    SELECT application_users.id
    INTO existing_account_id
    FROM crewcast.users AS application_users
    WHERE application_users.auth_user_id = matching_ids[1]
    FOR UPDATE;

    IF existing_account_id IS NOT NULL THEN
      UPDATE crewcast.users
      SET email = NEW.email, updated_at = NOW()
      WHERE id = existing_account_id
        AND auth_user_id = matching_ids[1];
      RETURN NULL;
    END IF;

    NEW.auth_user_id := matching_ids[1];
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER users_assign_auth_user_id_compatibility
BEFORE INSERT ON crewcast.users
FOR EACH ROW
EXECUTE FUNCTION crewcast.assign_application_account_auth_identity();

COMMENT ON COLUMN crewcast.users.auth_user_id IS
  'Immutable Supabase auth.users primary key that owns this application account. Nullable only during the rolling compatibility window.';
COMMENT ON CONSTRAINT users_auth_user_id_fkey ON crewcast.users IS
  'Restricts direct Auth deletion so Stripe and application cleanup cannot be bypassed by a database cascade.';
