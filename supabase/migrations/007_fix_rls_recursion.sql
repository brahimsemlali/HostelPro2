-- ============================================================
-- Migration 007: Fix infinite recursion in staff RLS policies
-- ============================================================
--
-- ROOT CAUSE: Every staff policy does:
--   property_id IN (SELECT property_id FROM staff WHERE user_id = auth.uid())
-- When PostgreSQL evaluates this subquery on the `staff` table, it triggers
-- the `staff` table's OWN RLS policies, which run the same subquery again →
-- infinite recursion.
--
-- FIX: Create a SECURITY DEFINER function that reads from `staff` as the
-- postgres superuser (bypasses RLS entirely). Replace ALL staff subquery
-- patterns with a call to this function.
-- ============================================================

-- 1. Create the security definer helper function
CREATE OR REPLACE FUNCTION get_my_property_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT property_id
  FROM staff
  WHERE user_id = auth.uid() AND is_active = TRUE
  LIMIT 1;
$$;

-- Grant execute to all authenticated users
GRANT EXECUTE ON FUNCTION get_my_property_id() TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_property_id() TO anon;

-- ============================================================
-- 2. Rebuild all staff RLS policies using get_my_property_id()
-- (Drop old ones first so this migration is idempotent)
-- ============================================================

-- ── ROOMS ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "staff_read_rooms" ON rooms;
CREATE POLICY "staff_read_rooms" ON rooms FOR SELECT USING (
  property_id = get_my_property_id()
);

-- ── BEDS ──────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "staff_read_beds" ON beds;
DROP POLICY IF EXISTS "staff_update_beds" ON beds;
CREATE POLICY "staff_read_beds" ON beds FOR SELECT USING (
  property_id = get_my_property_id()
);
CREATE POLICY "staff_update_beds" ON beds FOR UPDATE USING (
  property_id = get_my_property_id()
);

-- ── GUESTS ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "staff_read_guests" ON guests;
DROP POLICY IF EXISTS "staff_insert_guests" ON guests;
DROP POLICY IF EXISTS "staff_update_guests" ON guests;
CREATE POLICY "staff_read_guests" ON guests FOR SELECT USING (
  property_id = get_my_property_id()
);
CREATE POLICY "staff_insert_guests" ON guests FOR INSERT WITH CHECK (
  property_id = get_my_property_id()
);
CREATE POLICY "staff_update_guests" ON guests FOR UPDATE USING (
  property_id = get_my_property_id()
);

-- ── BOOKINGS ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "staff_read_bookings" ON bookings;
DROP POLICY IF EXISTS "staff_insert_bookings" ON bookings;
DROP POLICY IF EXISTS "staff_update_bookings" ON bookings;
CREATE POLICY "staff_read_bookings" ON bookings FOR SELECT USING (
  property_id = get_my_property_id()
);
CREATE POLICY "staff_insert_bookings" ON bookings FOR INSERT WITH CHECK (
  property_id = get_my_property_id()
);
CREATE POLICY "staff_update_bookings" ON bookings FOR UPDATE USING (
  property_id = get_my_property_id()
);

-- ── PAYMENTS ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "staff_read_payments" ON payments;
DROP POLICY IF EXISTS "staff_insert_payments" ON payments;
CREATE POLICY "staff_read_payments" ON payments FOR SELECT USING (
  property_id = get_my_property_id()
);
CREATE POLICY "staff_insert_payments" ON payments FOR INSERT WITH CHECK (
  property_id = get_my_property_id()
);

-- ── MAINTENANCE ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "staff_read_maintenance" ON maintenance;
DROP POLICY IF EXISTS "staff_insert_maintenance" ON maintenance;
DROP POLICY IF EXISTS "staff_update_maintenance" ON maintenance;
CREATE POLICY "staff_read_maintenance" ON maintenance FOR SELECT USING (
  property_id = get_my_property_id()
);
CREATE POLICY "staff_insert_maintenance" ON maintenance FOR INSERT WITH CHECK (
  property_id = get_my_property_id()
);
CREATE POLICY "staff_update_maintenance" ON maintenance FOR UPDATE USING (
  property_id = get_my_property_id()
);

-- ── WHATSAPP MESSAGES ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "staff_read_whatsapp" ON whatsapp_messages;
DROP POLICY IF EXISTS "staff_insert_whatsapp" ON whatsapp_messages;
CREATE POLICY "staff_read_whatsapp" ON whatsapp_messages FOR SELECT USING (
  property_id = get_my_property_id()
);
CREATE POLICY "staff_insert_whatsapp" ON whatsapp_messages FOR INSERT WITH CHECK (
  property_id = get_my_property_id()
);

-- ── PROPERTIES ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "staff_read_property" ON properties;
CREATE POLICY "staff_read_property" ON properties FOR SELECT USING (
  id = get_my_property_id()
);

-- ── STAFF (THE KEY FIX — was the self-referencing recursive policy) ────────────
DROP POLICY IF EXISTS "staff_read_staff" ON staff;
CREATE POLICY "staff_read_staff" ON staff FOR SELECT USING (
  property_id = get_my_property_id()
);

-- ── NIGHT AUDITS (from migration 006) ────────────────────────────────────────
DROP POLICY IF EXISTS "staff_read_audits" ON night_audits;
DROP POLICY IF EXISTS "staff_insert_audits" ON night_audits;
CREATE POLICY "staff_read_audits" ON night_audits FOR SELECT USING (
  property_id = get_my_property_id()
);
CREATE POLICY "staff_insert_audits" ON night_audits FOR INSERT WITH CHECK (
  property_id = get_my_property_id()
);

-- ── ACTIVITY LOG (from migration 005) ────────────────────────────────────────
DROP POLICY IF EXISTS "staff_read_activity" ON activity_log;
DROP POLICY IF EXISTS "staff_insert_activity" ON activity_log;
CREATE POLICY "staff_read_activity" ON activity_log FOR SELECT USING (
  property_id = get_my_property_id()
);
CREATE POLICY "staff_insert_activity" ON activity_log FOR INSERT WITH CHECK (
  property_id = get_my_property_id()
);
