-- ==========================================
-- Migration 004: Guest Blacklist, Extras, Pricing Rules, Pre-Arrival
-- ==========================================

-- ── Guest Blacklist ───────────────────────────────────────────────────────────
ALTER TABLE guests ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT FALSE;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS flag_reason TEXT;

-- ── Pre-Arrival Digital Check-in ─────────────────────────────────────────────
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pre_checkin_token UUID DEFAULT gen_random_uuid();
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pre_checkin_completed BOOLEAN DEFAULT FALSE;

-- ── Review link on property ───────────────────────────────────────────────────
ALTER TABLE properties ADD COLUMN IF NOT EXISTS review_url TEXT;

-- ── Booking Extras (mini POS) ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS booking_extras (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id  UUID REFERENCES bookings(id) ON DELETE CASCADE NOT NULL,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  name        TEXT NOT NULL,
  quantity    DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit_price  DECIMAL(10,2) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Pricing Rules ─────────────────────────────────────────────────────────────
-- condition_type: 'occupancy_above' | 'day_of_week' | 'days_before_arrival'
-- adjustment_type: 'percentage' | 'fixed'
CREATE TABLE IF NOT EXISTS pricing_rules (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id      UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  name             TEXT NOT NULL,
  condition_type   TEXT NOT NULL,
  threshold        DECIMAL(10,2),    -- occupancy % or days before
  days_of_week     INTEGER[],        -- [0..6] Sunday=0
  adjustment_type  TEXT NOT NULL DEFAULT 'percentage',
  adjustment_value DECIMAL(10,2) NOT NULL,
  is_active        BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE booking_extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_rules  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "property_access" ON booking_extras FOR ALL USING (
  property_id IN (SELECT id FROM properties WHERE owner_id = auth.uid())
);

CREATE POLICY "property_access" ON pricing_rules FOR ALL USING (
  property_id IN (SELECT id FROM properties WHERE owner_id = auth.uid())
);

-- Public read for pre-arrival form (no auth, token-based)
CREATE POLICY "public_pre_checkin" ON bookings
  FOR SELECT USING (pre_checkin_token IS NOT NULL);

CREATE POLICY "public_pre_checkin_update" ON bookings
  FOR UPDATE USING (pre_checkin_token IS NOT NULL)
  WITH CHECK (pre_checkin_token IS NOT NULL);
