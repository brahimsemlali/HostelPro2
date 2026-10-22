-- 033: superadmin console — platform payment ledger, admin audit log and
-- per-tenant admin state (CEO notes + suspension).
--
-- All three tables have RLS enabled and NO policies, so only the service role
-- (used by /admin and /api/admin/*) can read or write them. They deliberately
-- do not live on `properties`: the owner policy lets owners update their own
-- properties row, so an owner could clear a suspension flag stored there.
--
-- The app degrades gracefully until this is applied (the admin pages show an
-- "apply migration 033" notice; recording payments is disabled).
--
-- Pre-flight: none. Safe to apply at any time.

BEGIN;

-- ── Money received from tenants (bank transfer / cash / card) ───────────────
CREATE TABLE IF NOT EXISTS platform_payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   UUID REFERENCES properties(id) ON DELETE SET NULL,
  property_name TEXT NOT NULL,                       -- snapshot, survives tenant deletion
  amount        NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  method        TEXT NOT NULL CHECK (method IN ('virement', 'cash', 'card', 'other')),
  months        INTEGER NOT NULL DEFAULT 1 CHECK (months BETWEEN 0 AND 60),
  variant_id    TEXT,
  period_end    TIMESTAMPTZ,                         -- subscription end after this payment
  reference     TEXT,
  note          TEXT,
  paid_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_by   TEXT NOT NULL,                       -- superadmin email
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS platform_payments_paid_at ON platform_payments (paid_at DESC);
CREATE INDEX IF NOT EXISTS platform_payments_property ON platform_payments (property_id, paid_at DESC);

-- ── Every superadmin mutation ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id      UUID,
  actor_email   TEXT,
  action        TEXT NOT NULL,
  property_id   UUID,                                -- no FK: the log outlives deleted tenants
  property_name TEXT,
  details       JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS admin_audit_log_created ON admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_property ON admin_audit_log (property_id, created_at DESC);

-- ── Admin-only state per tenant ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_admin (
  property_id      UUID PRIMARY KEY REFERENCES properties(id) ON DELETE CASCADE,
  notes            TEXT,
  suspended_at     TIMESTAMPTZ,
  suspended_reason TEXT,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE platform_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log   ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_admin      ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON platform_payments, admin_audit_log, tenant_admin FROM anon, authenticated;

-- ── Per-tenant usage for the console overview ───────────────────────────────
-- Aggregated in SQL: API responses are capped at 1000 rows, so counting beds,
-- bookings and activity client-side silently goes wrong as tenants grow.
-- Callable by the service role only (not a view: views bypass RLS and are
-- exposed through the API).
CREATE OR REPLACE FUNCTION admin_tenant_usage()
RETURNS TABLE (property_id UUID, beds BIGINT, bookings_30d BIGINT, last_activity TIMESTAMPTZ)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id,
    (SELECT count(*) FROM beds b WHERE b.property_id = p.id),
    (SELECT count(*) FROM bookings k WHERE k.property_id = p.id AND k.created_at >= now() - interval '30 days'),
    (SELECT max(a.created_at) FROM activity_log a WHERE a.property_id = p.id)
  FROM properties p;
$$;

REVOKE EXECUTE ON FUNCTION admin_tenant_usage() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_tenant_usage() TO service_role;

COMMIT;
