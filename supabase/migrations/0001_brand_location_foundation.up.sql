CREATE FUNCTION crewcast.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  NEW.updated_at = statement_timestamp();
  RETURN NEW;
END;
$function$;

CREATE TABLE crewcast.brands (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id integer NOT NULL,
  name varchar(255) NOT NULL,
  normalized_domain varchar(253),
  bio text,
  affiliate_types text[] NOT NULL DEFAULT ARRAY[]::text[],
  is_default boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT brands_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES crewcast.users (id)
    ON UPDATE RESTRICT
    ON DELETE CASCADE,
  CONSTRAINT brands_id_user_id_key UNIQUE (id, user_id),
  CONSTRAINT brands_name_trimmed_check
    CHECK (name = btrim(name) AND name <> ''),
  CONSTRAINT brands_normalized_domain_check
    CHECK (
      normalized_domain IS NULL
      OR (
        normalized_domain = lower(btrim(normalized_domain))
        AND normalized_domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'
      )
    ),
  CONSTRAINT brands_bio_length_check
    CHECK (bio IS NULL OR char_length(bio) <= 5000),
  CONSTRAINT brands_affiliate_types_shape_check
    CHECK (
      cardinality(affiliate_types) <= 20
      AND array_position(affiliate_types, NULL) IS NULL
      AND (array_ndims(affiliate_types) IS NULL OR array_ndims(affiliate_types) = 1)
    ),
  CONSTRAINT brands_archived_default_check
    CHECK (archived_at IS NULL OR NOT is_default)
);

CREATE UNIQUE INDEX brands_active_domain_key
  ON crewcast.brands (user_id, normalized_domain)
  WHERE archived_at IS NULL AND normalized_domain IS NOT NULL;

CREATE UNIQUE INDEX brands_one_active_default_per_user_key
  ON crewcast.brands (user_id)
  WHERE archived_at IS NULL AND is_default;

CREATE INDEX brands_user_created_at_idx
  ON crewcast.brands (user_id, created_at, id);

CREATE TABLE crewcast.brand_locations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id integer NOT NULL,
  brand_id bigint NOT NULL,
  country_code varchar(2),
  language_code varchar(2),
  topics text[] NOT NULL DEFAULT ARRAY[]::text[],
  competitors text[] NOT NULL DEFAULT ARRAY[]::text[],
  is_default boolean NOT NULL DEFAULT false,
  auto_scan_enabled boolean NOT NULL DEFAULT false,
  last_auto_scan_at timestamptz,
  next_auto_scan_at timestamptz,
  scan_claim_token uuid,
  scan_claimed_at timestamptz,
  scan_lease_expires_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT brand_locations_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES crewcast.users (id)
    ON UPDATE RESTRICT
    ON DELETE CASCADE,
  CONSTRAINT brand_locations_brand_owner_fkey
    FOREIGN KEY (brand_id, user_id)
    REFERENCES crewcast.brands (id, user_id)
    ON UPDATE RESTRICT
    ON DELETE NO ACTION
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT brand_locations_market_pair_check
    CHECK ((country_code IS NULL) = (language_code IS NULL)),
  CONSTRAINT brand_locations_country_code_check
    CHECK (country_code IS NULL OR country_code ~ '^[a-z]{2}$'),
  CONSTRAINT brand_locations_language_code_check
    CHECK (language_code IS NULL OR language_code ~ '^[a-z]{2}$'),
  CONSTRAINT brand_locations_topics_shape_check
    CHECK (
      cardinality(topics) <= 5
      AND array_position(topics, NULL) IS NULL
      AND (array_ndims(topics) IS NULL OR array_ndims(topics) = 1)
    ),
  CONSTRAINT brand_locations_competitors_shape_check
    CHECK (
      cardinality(competitors) <= 5
      AND array_position(competitors, NULL) IS NULL
      AND (array_ndims(competitors) IS NULL OR array_ndims(competitors) = 1)
    ),
  CONSTRAINT brand_locations_scan_claim_check
    CHECK (
      (
        scan_claim_token IS NULL
        AND scan_claimed_at IS NULL
        AND scan_lease_expires_at IS NULL
      )
      OR (
        scan_claim_token IS NOT NULL
        AND scan_claimed_at IS NOT NULL
        AND scan_lease_expires_at IS NOT NULL
        AND scan_lease_expires_at > scan_claimed_at
      )
    ),
  CONSTRAINT brand_locations_archived_state_check
    CHECK (
      archived_at IS NULL
      OR (
        NOT is_default
        AND NOT auto_scan_enabled
        AND next_auto_scan_at IS NULL
        AND scan_claim_token IS NULL
        AND scan_claimed_at IS NULL
        AND scan_lease_expires_at IS NULL
      )
    )
);

CREATE UNIQUE INDEX brand_locations_active_market_key
  ON crewcast.brand_locations (brand_id, country_code, language_code)
  NULLS NOT DISTINCT
  WHERE archived_at IS NULL;

CREATE UNIQUE INDEX brand_locations_one_active_default_per_brand_key
  ON crewcast.brand_locations (brand_id)
  WHERE archived_at IS NULL AND is_default;

CREATE INDEX brand_locations_brand_owner_created_at_idx
  ON crewcast.brand_locations (brand_id, user_id, created_at, id);

CREATE INDEX brand_locations_user_id_idx
  ON crewcast.brand_locations (user_id, id);

CREATE INDEX brand_locations_due_auto_scan_idx
  ON crewcast.brand_locations (next_auto_scan_at, id)
  WHERE auto_scan_enabled
    AND archived_at IS NULL
    AND next_auto_scan_at IS NOT NULL;

CREATE TRIGGER brands_set_updated_at
BEFORE UPDATE ON crewcast.brands
FOR EACH ROW
EXECUTE FUNCTION crewcast.set_updated_at();

CREATE TRIGGER brand_locations_set_updated_at
BEFORE UPDATE ON crewcast.brand_locations
FOR EACH ROW
EXECUTE FUNCTION crewcast.set_updated_at();

ALTER TABLE crewcast.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE crewcast.brand_locations ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE crewcast.brands IS
  'Account-owned brand profiles. Product removal uses archived_at; hard deletion is reserved for complete account deletion.';
COMMENT ON COLUMN crewcast.brands.normalized_domain IS
  'Lowercase host without protocol, www prefix, path, query, fragment or port.';
COMMENT ON TABLE crewcast.brand_locations IS
  'Brand-owned market and language contexts. Search, outreach and scan settings are isolated per location.';
COMMENT ON CONSTRAINT brand_locations_brand_owner_fkey ON crewcast.brand_locations IS
  'Composite foreign key prevents a location from referencing a brand owned by another account. Direct brand deletion is blocked while locations remain.';
COMMENT ON COLUMN crewcast.brand_locations.scan_claim_token IS
  'Opaque token used with the claim timestamps to make automatic scan claiming atomic and recoverable.';
