-- ============================================================
-- Migration 006: Staff RLS gaps + Performance Indexes
-- Run this in your Supabase SQL Editor
-- ============================================================

-- ─── 1. night_audits — allow manager/staff to read + insert ───────────────────
-- (owner policy already exists from migration 001; staff were completely blocked)

DO $$ BEGIN
  CREATE POLICY "staff_read_audits" ON night_audits FOR SELECT USING (
    property_id IN (
      SELECT property_id FROM staff WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "staff_insert_audits" ON night_audits FOR INSERT WITH CHECK (
    property_id IN (
      SELECT property_id FROM staff WHERE user_id = auth.uid() AND is_active = TRUE
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 2. Performance indexes ────────────────────────────────────────────────────

-- bookings: bed availability checks (used heavily in check-in wizard)
CREATE INDEX IF NOT EXISTS bookings_bed_id_idx
  ON bookings(bed_id);

-- bookings: calendar and dashboard range queries
CREATE INDEX IF NOT EXISTS bookings_property_dates_idx
  ON bookings(property_id, check_in_date, check_out_date);

-- bookings: status counts (dashboard metrics)
CREATE INDEX IF NOT EXISTS bookings_property_status_idx
  ON bookings(property_id, status);

-- guests: duplicate detection during check-in
CREATE INDEX IF NOT EXISTS guests_property_email_idx
  ON guests(property_id, email);

-- guests: police fiche / document lookup
CREATE INDEX IF NOT EXISTS guests_property_document_idx
  ON guests(property_id, document_number);

-- payments: daily revenue + reconciliation queries
CREATE INDEX IF NOT EXISTS payments_property_date_idx
  ON payments(property_id, payment_date DESC);

-- staff: RLS subquery used on every authenticated request — critical for performance
CREATE INDEX IF NOT EXISTS staff_property_active_idx
  ON staff(property_id, is_active);

-- staff: user lookup in getUserSession()
CREATE INDEX IF NOT EXISTS staff_user_id_idx
  ON staff(user_id);
