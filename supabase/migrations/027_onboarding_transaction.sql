-- 027_onboarding_transaction.sql
-- Make onboarding atomic + idempotent, and fix the silently-failing trial.
--
-- Problems this fixes:
--  1. Onboarding created property → rooms → beds → staff → subscription as 5+
--     separate un-transactioned client inserts. A failure mid-way (e.g. bed
--     insert on room 3) left a half-built property with no rollback, and a
--     retry created a SECOND property (getUserSession then silently picks the
--     oldest, so the new data appears to "vanish").
--  2. There is no owner INSERT policy on `subscriptions` (015 grants SELECT
--     only — deliberately, so clients can't grant themselves 'active'). The
--     onboarding client upsert of the 14-day trial was therefore blocked by
--     RLS and failed silently → new signups could land with NO subscription
--     row and get paywalled immediately.
--
-- Fix: one SECURITY DEFINER function that does the whole setup in a single
-- transaction. SECURITY DEFINER (not INVOKER) because it must write the trial
-- row that clients are correctly forbidden from writing directly. It is safe
-- because it can ONLY ever create a property owned by the caller (auth.uid())
-- and its children, and it hard-refuses if the caller already owns a property
-- (anti-duplicate guard, also covers a concurrent double-submit).
--
-- Rooms/beds are passed as JSONB so the bed-naming logic stays in one place
-- (the client), and this function is purely transactional insertion.
--
-- Pre-flight: none required.

CREATE OR REPLACE FUNCTION create_property_with_setup(
  p_name        TEXT,
  p_city        TEXT,
  p_phone       TEXT,
  p_wifi        TEXT,
  p_lang        TEXT,
  p_owner_name  TEXT,
  p_trial_end   TIMESTAMPTZ,
  p_rooms       JSONB          -- [{name,type,gender_policy,beds:[{name,bunk_position,base_price,status}]}]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_prop UUID;
  v_room UUID;
  r      JSONB;
  b      JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Anti-duplicate / idempotency: one property per owner via this flow.
  IF EXISTS (SELECT 1 FROM properties WHERE owner_id = v_uid) THEN
    RAISE EXCEPTION 'property_exists';
  END IF;

  INSERT INTO properties (owner_id, name, city, phone, wifi_password,
                          check_in_time, check_out_time, default_language)
  VALUES (v_uid, p_name, p_city, NULLIF(p_phone, ''), NULLIF(p_wifi, ''),
          '14:00', '11:00', COALESCE(NULLIF(p_lang, ''), 'fr'))
  RETURNING id INTO v_prop;

  FOR r IN SELECT * FROM jsonb_array_elements(p_rooms)
  LOOP
    INSERT INTO rooms (property_id, name, type, gender_policy)
    VALUES (v_prop, r->>'name', r->>'type', COALESCE(r->>'gender_policy', 'mixed'))
    RETURNING id INTO v_room;

    FOR b IN SELECT * FROM jsonb_array_elements(r->'beds')
    LOOP
      INSERT INTO beds (property_id, room_id, name, bunk_position, base_price, status)
      VALUES (v_prop, v_room, b->>'name',
              NULLIF(b->>'bunk_position', ''),
              (b->>'base_price')::NUMERIC,
              COALESCE(NULLIF(b->>'status', ''), 'available'));
    END LOOP;
  END LOOP;

  INSERT INTO staff (property_id, user_id, name, role, is_active)
  VALUES (v_prop, v_uid, COALESCE(NULLIF(p_owner_name, ''), 'Admin'), 'owner', TRUE);

  -- 14-day free trial (clients cannot write subscriptions directly, by design).
  INSERT INTO subscriptions (property_id, status, provider, ls_subscription_id,
                             ls_variant_id, current_period_end, cancel_at_period_end, updated_at)
  VALUES (v_prop, 'trialing', 'free_trial', NULL, NULL, p_trial_end, FALSE, now())
  ON CONFLICT (property_id) DO NOTHING;

  RETURN v_prop;
END;
$$;

GRANT EXECUTE ON FUNCTION create_property_with_setup(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, JSONB
) TO authenticated;
