-- ============================================================
-- Migration 009: Additional performance indexes
-- Run this in your Supabase SQL Editor
-- ============================================================

-- activity_log: used constantly on dashboard
CREATE INDEX IF NOT EXISTS activity_log_property_type
  ON activity_log(property_id, action_type, created_at DESC);

-- bookings: guest lookup (used in guest detail page)
CREATE INDEX IF NOT EXISTS bookings_guest_id_idx
  ON bookings(guest_id);

-- bookings: source reporting
CREATE INDEX IF NOT EXISTS bookings_source_idx
  ON bookings(property_id, source);

-- payments: booking reconciliation (used in payments page)
CREATE INDEX IF NOT EXISTS payments_booking_status_idx
  ON payments(booking_id, status);

-- guests: flagged guests filter
CREATE INDEX IF NOT EXISTS guests_flagged_idx
  ON guests(property_id, is_flagged)
  WHERE is_flagged = TRUE;

-- staff_invitations: token lookup (used during accept-invite flow)
CREATE INDEX IF NOT EXISTS staff_invitations_token_idx
  ON staff_invitations(token);

-- staff_invitations: email + property (used during invite creation)
CREATE INDEX IF NOT EXISTS staff_invitations_email_property_idx
  ON staff_invitations(property_id, email);
