-- 029_security_fixes_safe.sql
-- Security fixes that depend ONLY on already-applied migrations (015, 027).
-- Safe to apply to production immediately, independent of 023/026/028.
--
-- Fixes:
--   A. Billing bypass — create_property_with_setup (027) trusted a client-supplied
--      p_trial_end and wrote it into subscriptions.current_period_end. Since this
--      SECURITY DEFINER function is the ONLY write path clients can reach on the
--      subscriptions table, a fresh signup could call the RPC directly with
--      p_trial_end='2099-01-01' and self-grant a decade-long "trialing" sub that
--      reads as active forever. Fix: ignore the client value; compute the trial
--      length inside the function. The signature is kept IDENTICAL (still 8 args,
--      same names/types) so no client change or deploy-ordering is required — the
--      existing onboarding call keeps working, the param is simply ignored.
--   B. SECURITY DEFINER search-path hardening — has_active_subscription (015) was
--      the one DEFINER function missing `SET search_path`, leaving its unqualified
--      `subscriptions` reference resolvable against the caller's search_path.
--
-- Pre-flight: none. Both replaced objects already exist in prod.

-- ── A. Trial length is server-computed, never client-supplied ────────────────
CREATE OR REPLACE FUNCTION create_property_with_setup(
  p_name        TEXT,
  p_city        TEXT,
  p_phone       TEXT,
  p_wifi        TEXT,
  p_lang        TEXT,
  p_owner_name  TEXT,
  p_trial_end   TIMESTAMPTZ,   -- IGNORED (kept only to preserve the signature)
  p_rooms       JSONB
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

  -- 14-day free trial. Length is fixed server-side — the p_trial_end argument is
  -- deliberately ignored so a caller cannot self-grant an arbitrary expiry.
  INSERT INTO subscriptions (property_id, status, provider, ls_subscription_id,
                             ls_variant_id, current_period_end, cancel_at_period_end, updated_at)
  VALUES (v_prop, 'trialing', 'free_trial', NULL, NULL,
          now() + INTERVAL '14 days', FALSE, now())
  ON CONFLICT (property_id) DO NOTHING;

  RETURN v_prop;
END;
$$;

GRANT EXECUTE ON FUNCTION create_property_with_setup(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, JSONB
) TO authenticated;

-- ── B. Pin search_path on the remaining DEFINER function ─────────────────────
ALTER FUNCTION has_active_subscription(UUID) SET search_path = public;
