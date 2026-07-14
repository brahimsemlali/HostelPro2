-- ============================================================
-- 019 — Pre-check-in security fix
-- ============================================================
-- Migration 004 created public RLS policies on bookings gated on
-- "pre_checkin_token IS NOT NULL". Since pre_checkin_token has a
-- DEFAULT of gen_random_uuid(), EVERY booking matches — meaning any
-- client holding the anon key could SELECT and UPDATE every booking
-- in the database.
--
-- The pre-check-in flow (/checkin/[token]) runs entirely server-side
-- with the service-role client, so no anon access is needed at all.

DROP POLICY IF EXISTS "public_pre_checkin" ON bookings;
DROP POLICY IF EXISTS "public_pre_checkin_update" ON bookings;
