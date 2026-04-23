-- ==========================================
-- Expenses & Inventory Management
-- ==========================================

-- Expenses: track all spending
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'autre',
  -- 'alimentation' | 'menage' | 'maintenance' | 'toiletries' | 'utilities' | 'personnel' | 'autre'
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT DEFAULT 'cash', -- 'cash' | 'virement' | 'card'
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory: track stock levels
CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'autre',
  unit TEXT DEFAULT 'pièce', -- 'pièce' | 'litre' | 'kg' | 'paquet' | 'rouleau'
  current_stock DECIMAL(10,2) NOT NULL DEFAULT 0,
  reorder_level DECIMAL(10,2) NOT NULL DEFAULT 5,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- ROW LEVEL SECURITY
-- ==========================================

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "property_access" ON expenses FOR ALL USING (
  property_id IN (SELECT id FROM properties WHERE owner_id = auth.uid())
);

CREATE POLICY "property_access" ON inventory_items FOR ALL USING (
  property_id IN (SELECT id FROM properties WHERE owner_id = auth.uid())
);

-- ==========================================
-- SAMPLE SEED DATA (run after schema)
-- ==========================================
-- Replace 'YOUR_PROPERTY_ID' with real property id when seeding.
-- INSERT INTO expenses (property_id, category, description, amount, payment_method, expense_date)
-- VALUES
--   ('YOUR_PROPERTY_ID', 'alimentation', 'Courses marché', 450.00, 'cash', CURRENT_DATE - 1),
--   ('YOUR_PROPERTY_ID', 'menage', 'Produits ménagers', 180.00, 'cash', CURRENT_DATE - 2),
--   ('YOUR_PROPERTY_ID', 'toiletries', 'Savon + shampoing', 120.00, 'cash', CURRENT_DATE - 3);
-- INSERT INTO inventory_items (property_id, name, category, unit, current_stock, reorder_level)
-- VALUES
--   ('YOUR_PROPERTY_ID', 'Savon liquide', 'toiletries', 'litre', 3, 5),
--   ('YOUR_PROPERTY_ID', 'Papier toilette', 'menage', 'rouleau', 24, 20),
--   ('YOUR_PROPERTY_ID', 'Lessive', 'menage', 'kg', 2, 3),
--   ('YOUR_PROPERTY_ID', 'Café', 'alimentation', 'kg', 1.5, 2);
