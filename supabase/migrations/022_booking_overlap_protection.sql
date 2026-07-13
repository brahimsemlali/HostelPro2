-- 022: Prevent double-booking the same bed for overlapping dates.
--
-- Why: every booking write path (check-in wizard, add-arrival modal,
-- calendar drag-resize, status changes) validates availability on the
-- CLIENT before writing. With two receptionists acting at the same time,
-- both checks pass and both bookings land. This constraint makes the
-- database itself reject the second overlapping booking (error 23P01),
-- which the UI now surfaces as "bed already booked for these dates".
--
-- ── Pre-flight (run BEFORE applying) ─────────────────────────────────────
-- The ALTER TABLE fails if existing data already violates the rule.
-- 1) Find overlapping active bookings (must return 0 rows — otherwise
--    cancel or move one booking of each pair first):
--
--   SELECT a.id AS booking_a, b.id AS booking_b, a.bed_id,
--          a.check_in_date, a.check_out_date,
--          b.check_in_date AS b_check_in, b.check_out_date AS b_check_out
--   FROM bookings a
--   JOIN bookings b
--     ON a.bed_id = b.bed_id
--    AND a.id < b.id
--    AND daterange(a.check_in_date, a.check_out_date, '[)')
--        && daterange(b.check_in_date, b.check_out_date, '[)')
--   WHERE a.bed_id IS NOT NULL
--     AND a.status IN ('pending', 'confirmed', 'checked_in')
--     AND b.status IN ('pending', 'confirmed', 'checked_in');
--
-- 2) Find bookings with reversed dates (daterange() rejects them — fix
--    or cancel any rows returned):
--
--   SELECT id, check_in_date, check_out_date FROM bookings
--   WHERE check_out_date < check_in_date;
-- ─────────────────────────────────────────────────────────────────────────

-- Needed so a GiST index can combine equality (bed_id) with range overlap.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- '[)' = checkout day is exclusive, so a same-day turnover
-- (guest A leaves on the 10th, guest B arrives on the 10th) is allowed.
-- Only "active" statuses hold the bed: cancelled / no_show / checked_out
-- bookings drop out of the constraint automatically on status change.
ALTER TABLE bookings
  ADD CONSTRAINT bookings_no_bed_overlap
  EXCLUDE USING gist (
    bed_id WITH =,
    daterange(check_in_date, check_out_date, '[)') WITH &&
  )
  WHERE (bed_id IS NOT NULL AND status IN ('pending', 'confirmed', 'checked_in'));
