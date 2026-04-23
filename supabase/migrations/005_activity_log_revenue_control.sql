-- ============================================================
-- Migration 005: Activity Log + Revenue Visibility Control
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Activity log table
CREATE TABLE IF NOT EXISTS activity_log (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id  UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  staff_name   TEXT,                        -- snapshot of name at time of action
  action_type  TEXT NOT NULL,               -- 'check_in' | 'check_out' | 'payment' | 'maintenance_open' | 'maintenance_resolved' | 'booking_created' | 'booking_cancelled' | 'bed_status'
  entity_type  TEXT,                        -- 'booking' | 'payment' | 'maintenance' | 'bed'
  entity_id    UUID,
  description  TEXT NOT NULL,               -- human-readable, in French
  meta         JSONB DEFAULT '{}',          -- extra data (amount, method, guest name, etc.)
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS activity_log_property_created ON activity_log(property_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_log_user ON activity_log(user_id);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Owner sees all
CREATE POLICY "owner_activity" ON activity_log FOR ALL USING (
  property_id IN (SELECT id FROM properties WHERE owner_id = auth.uid())
);

-- Staff can read + insert their own property's log
CREATE POLICY "staff_read_activity" ON activity_log FOR SELECT USING (
  property_id IN (
    SELECT property_id FROM staff WHERE user_id = auth.uid() AND is_active = TRUE
  )
);
CREATE POLICY "staff_insert_activity" ON activity_log FOR INSERT WITH CHECK (
  property_id IN (
    SELECT property_id FROM staff WHERE user_id = auth.uid() AND is_active = TRUE
  )
);

-- 2. Revenue visibility control — add hide_revenue to staff table
ALTER TABLE staff ADD COLUMN IF NOT EXISTS hide_revenue BOOLEAN NOT NULL DEFAULT FALSE;
