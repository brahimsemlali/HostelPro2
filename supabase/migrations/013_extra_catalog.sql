-- Extra catalog: property-owned list of reusable extras with custom pricing
CREATE TABLE extra_catalog (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  emoji TEXT DEFAULT '➕',
  default_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE extra_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "property_access" ON extra_catalog FOR ALL USING (
  property_id IN (SELECT id FROM properties WHERE owner_id = auth.uid())
);

-- Allow staff members to read/write catalog items too
CREATE POLICY "staff_access" ON extra_catalog FOR ALL USING (
  property_id IN (
    SELECT property_id FROM staff WHERE user_id = auth.uid() AND is_active = TRUE
  )
);
