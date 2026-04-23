-- Fix extra_catalog RLS: staff should read-only, not full CRUD
-- Owners keep full access via the existing property_access policy

-- Drop the overly permissive staff policy that allowed DELETE/INSERT/UPDATE
DROP POLICY IF EXISTS "staff_access" ON extra_catalog;

-- Replace with read-only for active staff members
CREATE POLICY "staff_read" ON extra_catalog FOR SELECT USING (
  property_id IN (
    SELECT property_id FROM staff WHERE user_id = auth.uid() AND is_active = TRUE
  )
);
