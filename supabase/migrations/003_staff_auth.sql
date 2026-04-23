-- ============================================================
-- Migration 003: Staff Authentication Foundation
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Staff invitations table
CREATE TABLE IF NOT EXISTS staff_invitations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  invited_by  UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  email       TEXT NOT NULL,
  name        TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'receptionist',
  token       UUID NOT NULL DEFAULT uuid_generate_v4() UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick token lookups
CREATE INDEX IF NOT EXISTS staff_invitations_token_idx ON staff_invitations(token);

-- RLS on invitations
ALTER TABLE staff_invitations ENABLE ROW LEVEL SECURITY;

-- Only owner of the property can manage invitations
CREATE POLICY "owner_invitations" ON staff_invitations FOR ALL USING (
  property_id IN (SELECT id FROM properties WHERE owner_id = auth.uid())
);

-- Anyone with a valid token can read their own invitation (for the accept page)
CREATE POLICY "token_read" ON staff_invitations FOR SELECT USING (
  accepted_at IS NULL AND expires_at > NOW()
);

-- 2. Add RLS policies so staff members can access their property data

-- Helper: returns property_id for the current authenticated staff user
-- (Used in policies below)

-- ROOMS — staff can read
CREATE POLICY "staff_read_rooms" ON rooms FOR SELECT USING (
  property_id IN (
    SELECT property_id FROM staff
    WHERE user_id = auth.uid() AND is_active = TRUE
  )
);

-- BEDS — staff can read + update status (for housekeeping)
CREATE POLICY "staff_read_beds" ON beds FOR SELECT USING (
  property_id IN (
    SELECT property_id FROM staff
    WHERE user_id = auth.uid() AND is_active = TRUE
  )
);
CREATE POLICY "staff_update_beds" ON beds FOR UPDATE USING (
  property_id IN (
    SELECT property_id FROM staff
    WHERE user_id = auth.uid() AND is_active = TRUE
  )
);

-- GUESTS — staff can read + insert + update
CREATE POLICY "staff_read_guests" ON guests FOR SELECT USING (
  property_id IN (
    SELECT property_id FROM staff
    WHERE user_id = auth.uid() AND is_active = TRUE
  )
);
CREATE POLICY "staff_insert_guests" ON guests FOR INSERT WITH CHECK (
  property_id IN (
    SELECT property_id FROM staff
    WHERE user_id = auth.uid() AND is_active = TRUE
  )
);
CREATE POLICY "staff_update_guests" ON guests FOR UPDATE USING (
  property_id IN (
    SELECT property_id FROM staff
    WHERE user_id = auth.uid() AND is_active = TRUE
  )
);

-- BOOKINGS — staff can read + insert + update (not delete)
CREATE POLICY "staff_read_bookings" ON bookings FOR SELECT USING (
  property_id IN (
    SELECT property_id FROM staff
    WHERE user_id = auth.uid() AND is_active = TRUE
  )
);
CREATE POLICY "staff_insert_bookings" ON bookings FOR INSERT WITH CHECK (
  property_id IN (
    SELECT property_id FROM staff
    WHERE user_id = auth.uid() AND is_active = TRUE
  )
);
CREATE POLICY "staff_update_bookings" ON bookings FOR UPDATE USING (
  property_id IN (
    SELECT property_id FROM staff
    WHERE user_id = auth.uid() AND is_active = TRUE
  )
);

-- PAYMENTS — staff can read + insert (not update/delete)
CREATE POLICY "staff_read_payments" ON payments FOR SELECT USING (
  property_id IN (
    SELECT property_id FROM staff
    WHERE user_id = auth.uid() AND is_active = TRUE
  )
);
CREATE POLICY "staff_insert_payments" ON payments FOR INSERT WITH CHECK (
  property_id IN (
    SELECT property_id FROM staff
    WHERE user_id = auth.uid() AND is_active = TRUE
  )
);

-- MAINTENANCE — staff can read + insert + update
CREATE POLICY "staff_read_maintenance" ON maintenance FOR SELECT USING (
  property_id IN (
    SELECT property_id FROM staff
    WHERE user_id = auth.uid() AND is_active = TRUE
  )
);
CREATE POLICY "staff_insert_maintenance" ON maintenance FOR INSERT WITH CHECK (
  property_id IN (
    SELECT property_id FROM staff
    WHERE user_id = auth.uid() AND is_active = TRUE
  )
);
CREATE POLICY "staff_update_maintenance" ON maintenance FOR UPDATE USING (
  property_id IN (
    SELECT property_id FROM staff
    WHERE user_id = auth.uid() AND is_active = TRUE
  )
);

-- WHATSAPP MESSAGES — staff can read + insert
CREATE POLICY "staff_read_whatsapp" ON whatsapp_messages FOR SELECT USING (
  property_id IN (
    SELECT property_id FROM staff
    WHERE user_id = auth.uid() AND is_active = TRUE
  )
);
CREATE POLICY "staff_insert_whatsapp" ON whatsapp_messages FOR INSERT WITH CHECK (
  property_id IN (
    SELECT property_id FROM staff
    WHERE user_id = auth.uid() AND is_active = TRUE
  )
);

-- PROPERTIES — staff can READ their property (need wifi_password, check_in_time, etc.)
CREATE POLICY "staff_read_property" ON properties FOR SELECT USING (
  id IN (
    SELECT property_id FROM staff
    WHERE user_id = auth.uid() AND is_active = TRUE
  )
);

-- STAFF table — staff can read other members of their property
CREATE POLICY "staff_read_staff" ON staff FOR SELECT USING (
  property_id IN (
    SELECT property_id FROM staff s2
    WHERE s2.user_id = auth.uid() AND s2.is_active = TRUE
  )
);
