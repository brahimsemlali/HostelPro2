-- 023: Scale hardening — indexes, uniqueness constraints, RLS performance,
--      atomic bed swap, staff access to booking_extras.
--
-- Findings source: heavy-use audit (2026-07-14). Groups five classes of fix:
--   A. Missing indexes on hot paths (incl. the public pre-checkin token lookup,
--      which currently seq-scans the multi-tenant bookings table per request)
--   B. Uniqueness the app assumes but the DB never enforced
--      (night audits per day, iCal import dedupe)
--   C. RLS policies re-executing get_my_property_id() per row — wrap in
--      (SELECT ...) so Postgres runs it once per query (InitPlan)
--   D. swap_booking_beds(): the two-UPDATE client swap deadlocks against the
--      bookings_no_bed_overlap exclusion constraint (022) and can persist a
--      half-swap; this RPC does the swap atomically via a NULL hop
--   E. booking_extras had owner-only policies, so every receptionist
--      extras insert/delete silently failed RLS
--
-- ── Pre-flight (run BEFORE applying) ─────────────────────────────────────
-- 1) Duplicate night audits (must return 0 rows — delete the extras,
--    keeping the row with the latest created_at):
--
--   SELECT property_id, audit_date, COUNT(*) FROM night_audits
--   GROUP BY property_id, audit_date HAVING COUNT(*) > 1;
--
-- 2) Duplicate unassigned iCal imports (must return 0 rows — delete the
--    duplicates, keeping one per external ref):
--
--   SELECT property_id, external_booking_id, COUNT(*) FROM bookings
--   WHERE external_booking_id IS NOT NULL AND bed_id IS NULL
--   GROUP BY property_id, external_booking_id HAVING COUNT(*) > 1;
-- ─────────────────────────────────────────────────────────────────────────

-- ══════════════════════════════════════════════════════════════════════
-- A. INDEXES
-- ══════════════════════════════════════════════════════════════════════

-- Public pre-checkin endpoint looks bookings up by token with the
-- service-role client (no property filter possible) — without this index
-- every guest click seq-scans all bookings across all tenants.
CREATE UNIQUE INDEX IF NOT EXISTS bookings_pre_checkin_token_idx
  ON bookings (pre_checkin_token);

-- getUserSession() runs properties.eq('owner_id', uid) on every
-- authenticated request — the hottest query in the app.
CREATE INDEX IF NOT EXISTS properties_owner_idx
  ON properties (owner_id);

-- Departures/housekeeping filter by exact check_out_date; the existing
-- (property_id, check_in_date, check_out_date) index can't serve it and
-- (property_id, status='checked_out') matches all historical bookings.
CREATE INDEX IF NOT EXISTS bookings_property_checkout_idx
  ON bookings (property_id, check_out_date);

-- Date-overlap queries (calendar, forecast) scan the whole booking history
-- through the btree index; a partial index over active statuses keeps the
-- scanned set proportional to current bookings, not lifetime bookings.
CREATE INDEX IF NOT EXISTS bookings_active_dates_idx
  ON bookings (property_id, check_in_date, check_out_date)
  WHERE status IN ('pending', 'confirmed', 'checked_in');

-- PostgREST embeds booking_extras via booking_id = ANY(...) on every
-- dashboard/payments/booking-detail load; no index existed.
CREATE INDEX IF NOT EXISTS booking_extras_booking_idx
  ON booking_extras (booking_id);

-- Guest detail page filters payments by guest_id; no index existed.
CREATE INDEX IF NOT EXISTS payments_guest_idx
  ON payments (guest_id);

-- WhatsApp hub orders the log by sent_at; no index on the table at all.
CREATE INDEX IF NOT EXISTS whatsapp_messages_property_sent_idx
  ON whatsapp_messages (property_id, sent_at DESC);

-- Expenses page filters a 90-day window and orders by date.
CREATE INDEX IF NOT EXISTS expenses_property_date_idx
  ON expenses (property_id, expense_date DESC);

-- Maintenance kanban orders by created_at.
CREATE INDEX IF NOT EXISTS maintenance_property_created_idx
  ON maintenance (property_id, created_at DESC);

-- Guest search (check-in wizard, Cmd+K) uses leading-wildcard ilike
-- ('%q%'), which no btree can serve. Trigram GIN indexes make those
-- per-keystroke lookups index scans instead of full-table scans.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS guests_first_name_trgm_idx
  ON guests USING gin (first_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS guests_last_name_trgm_idx
  ON guests USING gin (last_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS guests_phone_trgm_idx
  ON guests USING gin (phone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS guests_document_trgm_idx
  ON guests USING gin (document_number gin_trgm_ops);

-- ══════════════════════════════════════════════════════════════════════
-- B. UNIQUENESS
-- ══════════════════════════════════════════════════════════════════════

-- One night audit per property per day. Two staff finalizing concurrently
-- currently insert two audit rows with different cash counts; the client
-- treats a 23505 on this constraint as "already completed by a colleague".
ALTER TABLE night_audits
  ADD CONSTRAINT night_audits_property_date_key
  UNIQUE (property_id, audit_date);

-- iCal import dedupe. Scoped to bed_id IS NULL (the state imports arrive
-- in) so a manual group booking that legitimately reuses one OTA reference
-- across several beds is not blocked. Concurrent/stale-tab imports of the
-- same feed now fail on the second insert instead of duplicating bookings.
CREATE UNIQUE INDEX IF NOT EXISTS bookings_external_import_unique
  ON bookings (property_id, external_booking_id)
  WHERE external_booking_id IS NOT NULL AND bed_id IS NULL;

-- ══════════════════════════════════════════════════════════════════════
-- C. RLS PERFORMANCE — wrap get_my_property_id() in (SELECT ...)
--    The function is SECURITY DEFINER, so Postgres cannot inline it; as a
--    bare call in a policy qual it may re-execute per scanned row (a hidden
--    SELECT FROM staff each time). (SELECT ...) turns it into a one-time
--    InitPlan per query. Semantics are identical.
-- ══════════════════════════════════════════════════════════════════════

ALTER POLICY "staff_read_rooms" ON rooms
  USING (property_id = (SELECT get_my_property_id()));

ALTER POLICY "staff_read_beds" ON beds
  USING (property_id = (SELECT get_my_property_id()));
ALTER POLICY "staff_update_beds" ON beds
  USING (property_id = (SELECT get_my_property_id()));

ALTER POLICY "staff_read_guests" ON guests
  USING (property_id = (SELECT get_my_property_id()));
ALTER POLICY "staff_insert_guests" ON guests
  WITH CHECK (property_id = (SELECT get_my_property_id()));
ALTER POLICY "staff_update_guests" ON guests
  USING (property_id = (SELECT get_my_property_id()));

ALTER POLICY "staff_read_bookings" ON bookings
  USING (property_id = (SELECT get_my_property_id()));
ALTER POLICY "staff_insert_bookings" ON bookings
  WITH CHECK (property_id = (SELECT get_my_property_id()));
ALTER POLICY "staff_update_bookings" ON bookings
  USING (property_id = (SELECT get_my_property_id()));

ALTER POLICY "staff_read_payments" ON payments
  USING (property_id = (SELECT get_my_property_id()));
ALTER POLICY "staff_insert_payments" ON payments
  WITH CHECK (property_id = (SELECT get_my_property_id()));

ALTER POLICY "staff_read_maintenance" ON maintenance
  USING (property_id = (SELECT get_my_property_id()));
ALTER POLICY "staff_insert_maintenance" ON maintenance
  WITH CHECK (property_id = (SELECT get_my_property_id()));
ALTER POLICY "staff_update_maintenance" ON maintenance
  USING (property_id = (SELECT get_my_property_id()));

ALTER POLICY "staff_read_whatsapp" ON whatsapp_messages
  USING (property_id = (SELECT get_my_property_id()));
ALTER POLICY "staff_insert_whatsapp" ON whatsapp_messages
  WITH CHECK (property_id = (SELECT get_my_property_id()));

ALTER POLICY "staff_read_property" ON properties
  USING (id = (SELECT get_my_property_id()));

ALTER POLICY "staff_read_staff" ON staff
  USING (property_id = (SELECT get_my_property_id()));

ALTER POLICY "staff_read_audits" ON night_audits
  USING (property_id = (SELECT get_my_property_id()));
ALTER POLICY "staff_insert_audits" ON night_audits
  WITH CHECK (property_id = (SELECT get_my_property_id()));

ALTER POLICY "staff_read_activity" ON activity_log
  USING (property_id = (SELECT get_my_property_id()));
ALTER POLICY "staff_insert_activity" ON activity_log
  WITH CHECK (property_id = (SELECT get_my_property_id()));

ALTER POLICY "hk_tasks_property_access" ON housekeeping_tasks
  USING (property_id = (SELECT get_my_property_id()))
  WITH CHECK (property_id = (SELECT get_my_property_id()));

-- Stragglers still using the raw staff subquery (010 / 014) — rewrite to
-- the same one-time pattern. Also wrap auth.uid() so the owner arm is an
-- InitPlan too.
ALTER POLICY "property_access" ON activities
  USING (
    property_id IN (SELECT id FROM properties WHERE owner_id = (SELECT auth.uid()))
    OR property_id = (SELECT get_my_property_id())
  );

ALTER POLICY "staff_read" ON extra_catalog
  USING (property_id = (SELECT get_my_property_id()));

-- ══════════════════════════════════════════════════════════════════════
-- D. ATOMIC BED SWAP
--    Swapping two active bookings with two separate UPDATEs violates
--    bookings_no_bed_overlap (022) — each statement moves a booking onto a
--    bed the other still occupies — and can persist a half-swap when one
--    UPDATE succeeds and the other fails. This function does the whole swap
--    in one transaction via a NULL hop, so the constraint is satisfied at
--    every step. SECURITY INVOKER: the caller's RLS policies still gate
--    which bookings can be touched.
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION swap_booking_beds(p_booking_a UUID, p_booking_b UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_bed_a UUID;
  v_bed_b UUID;
BEGIN
  IF p_booking_a = p_booking_b THEN
    RAISE EXCEPTION 'cannot swap a booking with itself';
  END IF;

  -- Lock both rows in deterministic order to avoid deadlocks between
  -- two concurrent swaps of the same pair.
  PERFORM 1 FROM bookings WHERE id = LEAST(p_booking_a, p_booking_b) FOR UPDATE;
  PERFORM 1 FROM bookings WHERE id = GREATEST(p_booking_a, p_booking_b) FOR UPDATE;

  SELECT bed_id INTO v_bed_a FROM bookings WHERE id = p_booking_a;
  SELECT bed_id INTO v_bed_b FROM bookings WHERE id = p_booking_b;

  IF v_bed_a IS NULL OR v_bed_b IS NULL THEN
    RAISE EXCEPTION 'both bookings must exist and have a bed assigned';
  END IF;

  UPDATE bookings SET bed_id = NULL    WHERE id = p_booking_a;
  UPDATE bookings SET bed_id = v_bed_a WHERE id = p_booking_b;
  UPDATE bookings SET bed_id = v_bed_b WHERE id = p_booking_a;
END;
$$;

GRANT EXECUTE ON FUNCTION swap_booking_beds(UUID, UUID) TO authenticated;

-- ══════════════════════════════════════════════════════════════════════
-- E. BOOKING_EXTRAS STAFF ACCESS
--    Only the owner "property_access" policy existed (004), so every
--    receptionist extras insert/delete failed RLS. Staff of the property
--    get read/insert/delete; fine-grained role gating stays in the app
--    layer (same convention as 008).
-- ══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "staff_read_extras" ON booking_extras;
DROP POLICY IF EXISTS "staff_insert_extras" ON booking_extras;
DROP POLICY IF EXISTS "staff_delete_extras" ON booking_extras;

CREATE POLICY "staff_read_extras" ON booking_extras FOR SELECT USING (
  property_id = (SELECT get_my_property_id())
);
CREATE POLICY "staff_insert_extras" ON booking_extras FOR INSERT WITH CHECK (
  property_id = (SELECT get_my_property_id())
);
CREATE POLICY "staff_delete_extras" ON booking_extras FOR DELETE USING (
  property_id = (SELECT get_my_property_id())
);
