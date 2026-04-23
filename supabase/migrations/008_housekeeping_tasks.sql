-- ============================================================
-- Migration 008 — Housekeeping task assignment system
-- DEPENDS ON: 007_fix_rls_recursion.sql (get_my_property_id function)
-- ============================================================

CREATE TABLE IF NOT EXISTS housekeeping_tasks (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id     UUID        NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  title           TEXT        NOT NULL,
  description     TEXT,
  room_id         UUID        REFERENCES rooms(id) ON DELETE SET NULL,
  bed_id          UUID        REFERENCES beds(id) ON DELETE SET NULL,
  priority        TEXT        NOT NULL DEFAULT 'normal',   -- 'low' | 'normal' | 'high' | 'urgent'
  status          TEXT        NOT NULL DEFAULT 'pending',  -- 'pending' | 'in_progress' | 'done'
  assigned_to_staff_id UUID   REFERENCES staff(id) ON DELETE SET NULL,
  created_by      UUID        REFERENCES auth.users(id),
  due_date        DATE,
  notes           TEXT,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE housekeeping_tasks ENABLE ROW LEVEL SECURITY;

-- All authenticated staff/owners for this property have full access.
-- Fine-grained role enforcement is handled at the application layer.
DO $$ BEGIN
  CREATE POLICY "hk_tasks_property_access" ON housekeeping_tasks
    FOR ALL
    USING  (property_id = get_my_property_id())
    WITH CHECK (property_id = get_my_property_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Index for the most common query (tasks for a property, filtered by assignee)
CREATE INDEX IF NOT EXISTS housekeeping_tasks_property_idx
  ON housekeeping_tasks (property_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS housekeeping_tasks_assignee_idx
  ON housekeeping_tasks (assigned_to_staff_id, status);
