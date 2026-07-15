-- 025_guest_totals_triggers.sql
-- Keep guests.total_stays / total_spent accurate at all times.
--
-- Problem: these two columns were only ever written from the booking-detail
-- screen (on a manual status change). Every other path — the check-in wizard,
-- iCal imports, payments recorded on the payments page — left them untouched,
-- so the guest list showed "1 séjour / 0 MAD" for everyone. The "loyal guest"
-- filter (total_stays >= 3) and the stays sort were therefore meaningless.
--
-- Definition (matches the existing app logic in BookingDetailClient):
--   total_stays  = count of the guest's bookings NOT cancelled / no_show
--   total_spent  = sum of the guest's completed payments (refunds subtracted)
--
-- Pre-flight (optional sanity check — should return rows that are currently wrong):
--   SELECT g.id, g.total_stays,
--     (SELECT count(*) FROM bookings b
--        WHERE b.guest_id = g.id AND b.status NOT IN ('cancelled','no_show')) AS real_stays
--   FROM guests g
--   WHERE g.total_stays <> (SELECT count(*) FROM bookings b
--        WHERE b.guest_id = g.id AND b.status NOT IN ('cancelled','no_show'));

-- ── Recompute helper ──────────────────────────────────────────────────────
-- SECURITY DEFINER so the recompute always sees the full picture regardless of
-- which staff member triggered it; it only ever touches the single guest whose
-- booking/payment changed (and that row already passed RLS on the way in).
CREATE OR REPLACE FUNCTION recompute_guest_totals(g_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF g_id IS NULL THEN
    RETURN;
  END IF;
  UPDATE guests SET
    total_stays = (
      SELECT count(*) FROM bookings
      WHERE guest_id = g_id AND status NOT IN ('cancelled', 'no_show')
    ),
    total_spent = (
      SELECT COALESCE(SUM(CASE WHEN type = 'refund' THEN -amount ELSE amount END), 0)
      FROM payments
      WHERE guest_id = g_id AND status = 'completed'
    )
  WHERE id = g_id;
END;
$$;

-- ── Trigger function for bookings ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_bookings_guest_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recompute_guest_totals(OLD.guest_id);
    RETURN OLD;
  END IF;
  -- Reassigned to a different guest: refresh both.
  IF TG_OP = 'UPDATE' AND NEW.guest_id IS DISTINCT FROM OLD.guest_id THEN
    PERFORM recompute_guest_totals(OLD.guest_id);
  END IF;
  PERFORM recompute_guest_totals(NEW.guest_id);
  RETURN NEW;
END;
$$;

-- ── Trigger function for payments ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_payments_guest_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recompute_guest_totals(OLD.guest_id);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.guest_id IS DISTINCT FROM OLD.guest_id THEN
    PERFORM recompute_guest_totals(OLD.guest_id);
  END IF;
  PERFORM recompute_guest_totals(NEW.guest_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_guest_totals ON bookings;
CREATE TRIGGER bookings_guest_totals
  AFTER INSERT OR UPDATE OF status, guest_id OR DELETE ON bookings
  FOR EACH ROW EXECUTE FUNCTION trg_bookings_guest_totals();

DROP TRIGGER IF EXISTS payments_guest_totals ON payments;
CREATE TRIGGER payments_guest_totals
  AFTER INSERT OR UPDATE OF amount, type, status, guest_id OR DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION trg_payments_guest_totals();

-- ── One-time backfill for existing rows ───────────────────────────────────
UPDATE guests g SET
  total_stays = (
    SELECT count(*) FROM bookings b
    WHERE b.guest_id = g.id AND b.status NOT IN ('cancelled', 'no_show')
  ),
  total_spent = (
    SELECT COALESCE(SUM(CASE WHEN p.type = 'refund' THEN -p.amount ELSE p.amount END), 0)
    FROM payments p
    WHERE p.guest_id = g.id AND p.status = 'completed'
  );
