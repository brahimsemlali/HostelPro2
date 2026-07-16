-- 026_role_aware_staff_rls.sql
-- SECURITY FIX — make staff RLS role-aware.
--
-- Problem (exploitable on live prod, migration 007): the staff_* RLS policies
-- scope only to the tenant via get_my_property_id() with NO role predicate. So
-- ANY active staff member — including 'housekeeping', whose only real permission
-- is update_bed_status — could open the browser console and run
--   supabase.from('payments').select('*')   // full revenue
--   supabase.from('guests').update({ is_flagged: false })  // un-blacklist
--   supabase.from('payments').insert({...})  // fabricate cash, break audit
-- Role limits lived only in the client UI (useCanDo / Sidebar) and were fully
-- bypassable. This closes it at the database layer.
--
-- Role ranks: owner(4) > manager(3) > receptionist(2) > housekeeping(1).
-- Property OWNERS are not in the staff table (they own via properties.owner_id)
-- and are governed by the separate owner_all / property_access policies, so
-- get_my_property_id() / get_my_role_rank() return NULL for them and these
-- staff_* policies simply never apply to owners. No owner impact.
--
-- What each role keeps (matches the app PERMISSIONS map):
--   housekeeping: read rooms/beds/bookings/guests (names for the cleaning list),
--                 update bed status, full housekeeping_tasks. NO payments, NO
--                 guest/booking writes, NO night audit, NO whatsapp.
--   receptionist+: guest & booking writes, payments, whatsapp (check-in / cash).
--   manager+: night audit.
--
-- KNOWN RESIDUALS (need app-layer follow-up, tracked separately — NOT fixed here):
--   1. RLS is row-level: housekeeping still SELECTs the guests row (needs the
--      name), which exposes passport/CIN/DOB columns too. Fully closing this
--      needs a column-restricted view or column GRANTs for housekeeping.
--   2. Receptionist can still SELECT all payments (needed to compute booking
--      balances client-side), so aggregate revenue is reachable via the console
--      even though the UI hides it. Gating revenue to manager+ requires moving
--      balance computation server-side. Both are smaller than the closed hole
--      (a cleaner reading/fabricating the whole cash book).
--
-- Pre-flight (optional): confirm the helper resolves your own role —
--   SELECT get_my_role_rank();   -- run as a staff user; owner returns NULL

-- ── Role-rank helper (mirrors get_my_property_id: SECURITY DEFINER + STABLE) ──
CREATE OR REPLACE FUNCTION get_my_role_rank()
RETURNS INT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT CASE role
           WHEN 'owner'        THEN 4
           WHEN 'manager'      THEN 3
           WHEN 'receptionist' THEN 2
           WHEN 'housekeeping' THEN 1
           ELSE 0
         END
  FROM staff
  WHERE user_id = auth.uid() AND is_active = TRUE
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_my_role_rank() TO authenticated;

-- ── payments: receptionist+ only (housekeeping fully removed) ────────────────
ALTER POLICY "staff_read_payments" ON payments
  USING (property_id = (SELECT get_my_property_id()) AND (SELECT get_my_role_rank()) >= 2);
ALTER POLICY "staff_insert_payments" ON payments
  WITH CHECK (property_id = (SELECT get_my_property_id()) AND (SELECT get_my_role_rank()) >= 2);

-- ── guests: all staff may READ (cleaning list needs the name), but only
--            receptionist+ may INSERT / UPDATE (stops housekeeping tampering
--            with PII or un-flagging a blacklisted guest) ────────────────────
ALTER POLICY "staff_insert_guests" ON guests
  WITH CHECK (property_id = (SELECT get_my_property_id()) AND (SELECT get_my_role_rank()) >= 2);
ALTER POLICY "staff_update_guests" ON guests
  USING (property_id = (SELECT get_my_property_id()) AND (SELECT get_my_role_rank()) >= 2);

-- ── bookings: all staff may READ (checkout/arrivals lists), but only
--            receptionist+ may INSERT / UPDATE (stops housekeeping altering
--            prices / dates / status / bed / guest) ──────────────────────────
ALTER POLICY "staff_insert_bookings" ON bookings
  WITH CHECK (property_id = (SELECT get_my_property_id()) AND (SELECT get_my_role_rank()) >= 2);
ALTER POLICY "staff_update_bookings" ON bookings
  USING (property_id = (SELECT get_my_property_id()) AND (SELECT get_my_role_rank()) >= 2);

-- ── whatsapp_messages: receptionist+ only ────────────────────────────────────
ALTER POLICY "staff_read_whatsapp" ON whatsapp_messages
  USING (property_id = (SELECT get_my_property_id()) AND (SELECT get_my_role_rank()) >= 2);
ALTER POLICY "staff_insert_whatsapp" ON whatsapp_messages
  WITH CHECK (property_id = (SELECT get_my_property_id()) AND (SELECT get_my_role_rank()) >= 2);

-- ── night_audits: manager+ only (matches view_night_audit permission) ────────
ALTER POLICY "staff_read_audits" ON night_audits
  USING (property_id = (SELECT get_my_property_id()) AND (SELECT get_my_role_rank()) >= 3);
ALTER POLICY "staff_insert_audits" ON night_audits
  WITH CHECK (property_id = (SELECT get_my_property_id()) AND (SELECT get_my_role_rank()) >= 3);

-- Unchanged (intentionally available to all staff, incl. housekeeping):
--   rooms(read), beds(read+update status), maintenance, housekeeping_tasks,
--   properties(read), staff(read), activity_log, extra_catalog, booking_extras.
