-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Properties (one per subscription account)
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT DEFAULT 'Agadir',
  phone TEXT,
  email TEXT,
  wifi_password TEXT,
  check_in_time TIME DEFAULT '14:00',
  check_out_time TIME DEFAULT '11:00',
  currency TEXT DEFAULT 'MAD',
  default_language TEXT DEFAULT 'fr',
  police_prefecture TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rooms
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,           -- 'dorm' | 'private'
  floor INTEGER DEFAULT 1,
  gender_policy TEXT DEFAULT 'mixed', -- 'mixed' | 'female' | 'male'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Beds
CREATE TABLE beds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  bunk_position TEXT,           -- 'top' | 'bottom' | null
  base_price DECIMAL(10,2) NOT NULL DEFAULT 120.00,
  status TEXT DEFAULT 'available', -- 'available' | 'occupied' | 'dirty' | 'maintenance' | 'blocked'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Guests
CREATE TABLE guests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  whatsapp TEXT,
  nationality TEXT,
  document_type TEXT DEFAULT 'passport',
  document_number TEXT,
  date_of_birth DATE,
  gender TEXT,
  country_of_residence TEXT,
  profession TEXT,
  address_in_morocco TEXT,
  next_destination TEXT,
  total_stays INTEGER DEFAULT 1,
  total_spent DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bookings
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES guests(id),
  bed_id UUID REFERENCES beds(id),
  source TEXT DEFAULT 'direct',
  external_booking_id TEXT,
  status TEXT DEFAULT 'confirmed',
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  nights INTEGER GENERATED ALWAYS AS (check_out_date - check_in_date) STORED,
  adults INTEGER DEFAULT 1,
  total_price DECIMAL(10,2) NOT NULL,
  commission_rate DECIMAL(5,2) DEFAULT 0,
  net_revenue DECIMAL(10,2) GENERATED ALWAYS AS (total_price * (1 - commission_rate/100)) STORED,
  special_requests TEXT,
  internal_notes TEXT,
  check_in_time TIMESTAMPTZ,
  check_out_time TIMESTAMPTZ,
  police_fiche_generated BOOLEAN DEFAULT FALSE,
  police_fiche_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id),
  guest_id UUID REFERENCES guests(id),
  amount DECIMAL(10,2) NOT NULL,
  method TEXT NOT NULL,         -- 'cash' | 'virement' | 'cmi' | 'wave' | 'other'
  type TEXT DEFAULT 'payment',  -- 'payment' | 'deposit' | 'refund'
  status TEXT DEFAULT 'completed',
  reference TEXT,
  recorded_by UUID REFERENCES auth.users(id),
  notes TEXT,
  payment_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Maintenance requests
CREATE TABLE maintenance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  room_id UUID REFERENCES rooms(id),
  bed_id UUID REFERENCES beds(id),
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'open',
  reported_by UUID REFERENCES auth.users(id),
  assigned_to TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- WhatsApp messages log
CREATE TABLE whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES guests(id),
  booking_id UUID REFERENCES bookings(id),
  template_key TEXT,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'sent',
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- Staff accounts
CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  role TEXT DEFAULT 'receptionist',
  phone TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Night audit log
CREATE TABLE night_audits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  audit_date DATE NOT NULL,
  performed_by UUID REFERENCES auth.users(id),
  expected_cash DECIMAL(10,2),
  actual_cash DECIMAL(10,2),
  difference DECIMAL(10,2) GENERATED ALWAYS AS (actual_cash - expected_cash) STORED,
  total_revenue DECIMAL(10,2),
  occupancy_rate DECIMAL(5,2),
  notes TEXT,
  police_report_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- ROW LEVEL SECURITY
-- ==========================================

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE night_audits ENABLE ROW LEVEL SECURITY;

-- Properties: owner only
CREATE POLICY "owner_all" ON properties FOR ALL USING (owner_id = auth.uid());

-- All other tables: restrict to property owner's data
CREATE POLICY "property_access" ON rooms FOR ALL USING (
  property_id IN (SELECT id FROM properties WHERE owner_id = auth.uid())
);
CREATE POLICY "property_access" ON beds FOR ALL USING (
  property_id IN (SELECT id FROM properties WHERE owner_id = auth.uid())
);
CREATE POLICY "property_access" ON guests FOR ALL USING (
  property_id IN (SELECT id FROM properties WHERE owner_id = auth.uid())
);
CREATE POLICY "property_access" ON bookings FOR ALL USING (
  property_id IN (SELECT id FROM properties WHERE owner_id = auth.uid())
);
CREATE POLICY "property_access" ON payments FOR ALL USING (
  property_id IN (SELECT id FROM properties WHERE owner_id = auth.uid())
);
CREATE POLICY "property_access" ON maintenance FOR ALL USING (
  property_id IN (SELECT id FROM properties WHERE owner_id = auth.uid())
);
CREATE POLICY "property_access" ON whatsapp_messages FOR ALL USING (
  property_id IN (SELECT id FROM properties WHERE owner_id = auth.uid())
);
CREATE POLICY "property_access" ON staff FOR ALL USING (
  property_id IN (SELECT id FROM properties WHERE owner_id = auth.uid())
);
CREATE POLICY "property_access" ON night_audits FOR ALL USING (
  property_id IN (SELECT id FROM properties WHERE owner_id = auth.uid())
);

-- ==========================================
-- USEFUL VIEWS
-- ==========================================

CREATE VIEW current_occupancy AS
SELECT
  b.id as bed_id,
  b.name as bed_name,
  b.status,
  r.id as room_id,
  r.name as room_name,
  r.type as room_type,
  bk.id as booking_id,
  bk.check_in_date,
  bk.check_out_date,
  g.id as guest_id,
  g.first_name || ' ' || g.last_name as guest_name,
  g.nationality,
  g.phone,
  b.property_id
FROM beds b
LEFT JOIN rooms r ON b.room_id = r.id
LEFT JOIN bookings bk ON bk.bed_id = b.id
  AND bk.status = 'checked_in'
  AND bk.check_out_date > CURRENT_DATE
LEFT JOIN guests g ON bk.guest_id = g.id;

CREATE VIEW daily_revenue AS
SELECT
  DATE(payment_date) as day,
  property_id,
  SUM(CASE WHEN type = 'payment' OR type = 'deposit' THEN amount ELSE 0 END) as revenue,
  SUM(CASE WHEN method = 'cash' THEN amount ELSE 0 END) as cash,
  SUM(CASE WHEN method = 'virement' THEN amount ELSE 0 END) as virement,
  SUM(CASE WHEN method = 'cmi' THEN amount ELSE 0 END) as cmi,
  COUNT(*) as transactions
FROM payments
WHERE status = 'completed'
GROUP BY DATE(payment_date), property_id;
