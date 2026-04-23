-- Activities table to record free or paid hostel activities
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  activity_date DATE NOT NULL,
  start_time TIME NOT NULL,
  type TEXT NOT NULL, -- 'free' | 'paid'
  price DECIMAL(10,2),
  whatsapp_message_sent BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Protect table with Row Level Security (RLS)
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "property_access" ON activities 
FOR ALL USING (
  property_id IN (SELECT id FROM properties WHERE owner_id = auth.uid()) OR
  property_id IN (SELECT property_id FROM staff WHERE user_id = auth.uid())
);
