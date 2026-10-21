-- 030_role_gate_extras_beds.sql
-- Extends the role-aware RLS work from 026 to the remaining staff-writable
-- surfaces, and closes the beds column-tampering residual.
--
-- ⚠️ ORDERING: apply ONLY AFTER migrations 023 AND 026 are in production.
--    - It relies on get_my_role_rank() (created in 026).
--    - It replaces the booking_extras staff policies created in 023.
--    Verify first:
--      SELECT proname FROM pg_proc WHERE proname = 'get_my_role_rank';        -- must return 1 row (026 applied)
--      SELECT polname FROM pg_policy WHERE polname = 'staff_insert_extras';   -- must return 1 row (023 applied)
--
-- Fixes:
--   A. booking_extras — 023 granted INSERT/DELETE to ALL staff (any rank) with no
--      role predicate. booking_extras are billable POS line items (unit_price,
--      quantity), so a housekeeping account could add/delete charges on a booking.
--      Gate writes to receptionist+ (rank >= 2), matching the payments gate in 026.
--      Reads stay open (extras appear on the booking/cleaning views).
--   B. activities — the single FOR ALL "property_access" policy (010, patched in
--      023) let any staff create/delete hostel activity events. Split it so staff
--      reads stay open but writes require receptionist+; owners keep full access.
--   C. beds columns — RLS is row-level and cannot restrict which COLUMNS an UPDATE
--      touches, so staff_update_beds (007) lets housekeeping change base_price /
--      name / room_id, not just status. A BEFORE UPDATE trigger reverts every
--      non-status/notes column for housekeeping (rank 1). Owners/receptionists/
--      managers (rank NULL or >= 2) and the service role are unaffected.
--
-- NOT fixed here (documented residuals from 026 — need an app-layer refactor, not
-- a migration; a column GRANT/REVOKE can't discriminate by app-role because every
-- logged-in user shares the Postgres `authenticated` role):
--   * housekeeping can still SELECT guest passport/DOB columns (needs the name for
--     the cleaning list; fully closing it requires routing housekeeping through a
--     column-restricted view/RPC + revoking base-table SELECT + changing the
--     housekeeping pages).
--   * receptionist can still SELECT all payments (needed to compute booking
--     balances client-side; gating requires moving balance math server-side).

-- ── A. booking_extras: writes require receptionist+ ──────────────────────────
DROP POLICY IF EXISTS "staff_insert_extras" ON booking_extras;
DROP POLICY IF EXISTS "staff_delete_extras" ON booking_extras;

CREATE POLICY "staff_insert_extras" ON booking_extras FOR INSERT
  WITH CHECK (property_id = (SELECT get_my_property_id()) AND (SELECT get_my_role_rank()) >= 2);
CREATE POLICY "staff_delete_extras" ON booking_extras FOR DELETE
  USING (property_id = (SELECT get_my_property_id()) AND (SELECT get_my_role_rank()) >= 2);
-- staff_read_extras (023) is left unchanged: all staff may read.

-- ── B. activities: split read (all staff) from write (receptionist+) ─────────
DROP POLICY IF EXISTS "property_access" ON activities;

-- Owners (not in the staff table) keep full access.
CREATE POLICY "activities_owner_all" ON activities FOR ALL
  USING (property_id IN (SELECT id FROM properties WHERE owner_id = (SELECT auth.uid())))
  WITH CHECK (property_id IN (SELECT id FROM properties WHERE owner_id = (SELECT auth.uid())));

-- Staff read (any rank).
CREATE POLICY "activities_staff_read" ON activities FOR SELECT
  USING (property_id = (SELECT get_my_property_id()));

-- Staff writes require receptionist+.
CREATE POLICY "activities_staff_insert" ON activities FOR INSERT
  WITH CHECK (property_id = (SELECT get_my_property_id()) AND (SELECT get_my_role_rank()) >= 2);
CREATE POLICY "activities_staff_update" ON activities FOR UPDATE
  USING (property_id = (SELECT get_my_property_id()) AND (SELECT get_my_role_rank()) >= 2)
  WITH CHECK (property_id = (SELECT get_my_property_id()) AND (SELECT get_my_role_rank()) >= 2);
CREATE POLICY "activities_staff_delete" ON activities FOR DELETE
  USING (property_id = (SELECT get_my_property_id()) AND (SELECT get_my_role_rank()) >= 2);

-- ── C. beds: housekeeping may only change status/notes ───────────────────────
CREATE OR REPLACE FUNCTION enforce_housekeeping_bed_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- get_my_role_rank() returns 1 only for a housekeeping staff member; NULL for
  -- owners (not in staff) and for the service role (auth.uid() IS NULL); >= 2 for
  -- receptionist/manager. Only housekeeping is column-restricted.
  IF get_my_role_rank() = 1 THEN
    NEW.name          := OLD.name;
    NEW.room_id       := OLD.room_id;
    NEW.property_id   := OLD.property_id;
    NEW.bunk_position := OLD.bunk_position;
    NEW.base_price    := OLD.base_price;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_housekeeping_bed_columns ON beds;
CREATE TRIGGER trg_housekeeping_bed_columns
  BEFORE UPDATE ON beds
  FOR EACH ROW
  EXECUTE FUNCTION enforce_housekeeping_bed_columns();
