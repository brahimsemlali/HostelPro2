-- 031: Move the WhatsApp Meta token out of `properties`, narrow what
-- housekeeping can read from `guests`, and reject non-positive money amounts.
--
-- Requires: 007 (get_my_property_id) and 026 (get_my_role_rank). Apply 023,
-- 026, 028, 029 and 030 first. NOT TESTED against production — run the
-- pre-flight queries, then apply in a transaction from the SQL editor.
--
-- ── Deploy order ─────────────────────────────────────────────────────────────
-- 1. Deploy the app code from fix/audit-remediation (it reads the token from
--    property_secrets, falling back to properties.whatsapp_access_token).
-- 2. Apply this migration.
-- 3. After confirming WhatsApp sends still work, run the "Step 2" block at the
--    bottom to clear the legacy column.
--
-- ── Pre-flight ───────────────────────────────────────────────────────────────
-- a) Non-positive payments (the CHECK below is NOT VALID, so existing rows are
--    tolerated, but fix them before running the VALIDATE statements):
--      SELECT id, property_id, amount, type FROM payments WHERE amount <= 0;
-- b) Negative or zero extras / negative booking prices:
--      SELECT id, quantity, unit_price FROM booking_extras WHERE quantity <= 0 OR unit_price < 0;
--      SELECT id, total_price FROM bookings WHERE total_price < 0;
-- c) Helpers exist (both rows must come back — 026 provides get_my_role_rank;
--    if it is missing, apply 026 first or section 2 below will fail):
--      SELECT proname FROM pg_proc WHERE proname IN ('get_my_property_id', 'get_my_role_rank');

BEGIN;

-- ── 1. property_secrets: owner-only, never readable by staff ────────────────
-- Row-level RLS on `properties` lets every active staff member (housekeeping
-- included) read every column, so the Meta token could be read from the
-- browser console. Secrets get their own table with no staff policy at all;
-- the server reads it with the service role after its own role checks.
CREATE TABLE IF NOT EXISTS property_secrets (
  property_id UUID PRIMARY KEY REFERENCES properties(id) ON DELETE CASCADE,
  whatsapp_access_token TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE property_secrets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_all_secrets" ON property_secrets;
CREATE POLICY "owner_all_secrets" ON property_secrets FOR ALL
  USING (property_id IN (SELECT id FROM properties WHERE owner_id = (SELECT auth.uid())))
  WITH CHECK (property_id IN (SELECT id FROM properties WHERE owner_id = (SELECT auth.uid())));

-- Copy existing tokens — only if the legacy column exists (migration 011 may
-- never have been applied, in which case there is nothing to move).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'whatsapp_access_token'
  ) THEN
    EXECUTE $copy$
      INSERT INTO property_secrets (property_id, whatsapp_access_token)
      SELECT id, whatsapp_access_token
      FROM properties
      WHERE whatsapp_access_token IS NOT NULL AND whatsapp_access_token <> ''
      ON CONFLICT (property_id) DO UPDATE
        SET whatsapp_access_token = EXCLUDED.whatsapp_access_token,
            updated_at = NOW()
    $copy$;
  END IF;
END $$;

-- ── 2. guests: housekeeping only sees today's guests ────────────────────────
-- Housekeeping needs guest names for today's departures/arrivals and the beds
-- in use — not the property's whole guest history. Receptionist+ keep full
-- read access. (Row-level RLS cannot hide columns; the app no longer selects
-- identity columns for housekeeping screens. A full column split is a
-- separate decision.)
ALTER POLICY "staff_read_guests" ON guests
  USING (
    property_id = (SELECT get_my_property_id())
    AND (
      (SELECT get_my_role_rank()) >= 2
      OR EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.guest_id = guests.id
          AND b.property_id = guests.property_id
          AND b.status IN ('confirmed', 'checked_in', 'checked_out')
          AND b.check_in_date <= CURRENT_DATE + 1
          AND b.check_out_date >= CURRENT_DATE - 1
      )
    )
  );

-- ── 3. Money sanity at the database level ───────────────────────────────────
-- A negative "payment" lowers a guest's balance and the night audit's expected
-- cash. Refunds are stored as positive amounts with type = 'refund'.
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_amount_positive;
ALTER TABLE payments ADD CONSTRAINT payments_amount_positive CHECK (amount > 0) NOT VALID;

ALTER TABLE booking_extras DROP CONSTRAINT IF EXISTS booking_extras_amounts_valid;
ALTER TABLE booking_extras ADD CONSTRAINT booking_extras_amounts_valid
  CHECK (quantity > 0 AND unit_price >= 0) NOT VALID;

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_total_price_nonneg;
ALTER TABLE bookings ADD CONSTRAINT bookings_total_price_nonneg CHECK (total_price >= 0) NOT VALID;

COMMIT;

-- ── After pre-flight a) and b) return no rows, validate existing data ───────
--   ALTER TABLE payments VALIDATE CONSTRAINT payments_amount_positive;
--   ALTER TABLE booking_extras VALIDATE CONSTRAINT booking_extras_amounts_valid;
--   ALTER TABLE bookings VALIDATE CONSTRAINT bookings_total_price_nonneg;

-- ── Step 2 (after the new code is live and WhatsApp sends are confirmed) ────
-- Only if properties.whatsapp_access_token exists (skip if 011 was never applied):
--   UPDATE properties SET whatsapp_access_token = NULL WHERE whatsapp_access_token IS NOT NULL;
