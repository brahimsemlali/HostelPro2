-- 032: recompute_guest_totals (025) is SECURITY DEFINER and, like every new
-- function, was executable by PUBLIC — so anyone with the public anon key could
-- call it over /rest/v1/rpc for any guest id. It only rewrites a guest's totals
-- to their correct values (no data is returned), but a DEFINER function should
-- not be reachable from the API at all.
--
-- The two trigger functions call it and run as the invoking user, so revoking
-- EXECUTE alone would make every booking/payment write fail. Make the trigger
-- functions SECURITY DEFINER first (trigger functions cannot be called over the
-- API), then revoke.
--
-- Pre-flight: none. Safe to apply at any time; no app change needed.

BEGIN;

ALTER FUNCTION trg_bookings_guest_totals() SECURITY DEFINER SET search_path = public;
ALTER FUNCTION trg_payments_guest_totals() SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION recompute_guest_totals(UUID) FROM PUBLIC, anon, authenticated;

COMMIT;

-- Check (should return an error "permission denied for function"):
--   curl -X POST "$SUPABASE_URL/rest/v1/rpc/recompute_guest_totals" \
--     -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
--     -d '{"g_id":"00000000-0000-0000-0000-000000000000"}'
