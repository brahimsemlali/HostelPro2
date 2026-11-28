-- 037_channel_sync_queue.sql — channel-manager plumbing (Channex), INERT by default.
--
-- Requires 036. Adds:
--   channel_connections        one row per property linked to Channex. Nothing
--                              is queued for a property until its status is 'active'.
--   channel_ari_queue          dirty (room type, date range) slices waiting to be
--                              pushed. Written ONLY by triggers; drained by the
--                              server worker (service role), which coalesces
--                              slices per property to respect Channex rate limits.
--   channel_booking_revisions  every inbound booking revision, stored once
--                              (unique revision id) before it is applied + acked.
--   channel_sync_log           what was sent / received, for support.
--
-- Change capture uses triggers, so none of the existing client write paths
-- (check-in, calendar drag, bed map, housekeeping…) need to know about it.
-- The platform API key lives in the server env (CHANNEX_API_KEY), never here.

CREATE TABLE IF NOT EXISTS channel_connections (
  property_id           UUID PRIMARY KEY REFERENCES properties(id) ON DELETE CASCADE,
  provider              TEXT NOT NULL DEFAULT 'channex' CHECK (provider IN ('channex')),
  channex_property_id   TEXT UNIQUE,
  status                TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'active', 'paused', 'error')),
  last_full_sync_at     TIMESTAMPTZ,
  last_error            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS channel_ari_queue (
  id                    BIGSERIAL PRIMARY KEY,
  property_id           UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  room_type_id          UUID NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
  kind                  TEXT NOT NULL CHECK (kind IN ('availability', 'rates')),
  date_from             DATE NOT NULL,
  date_to               DATE NOT NULL,          -- exclusive
  reason                TEXT,
  attempts              INT NOT NULL DEFAULT 0,
  next_attempt_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at          TIMESTAMPTZ,
  last_error            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (date_to > date_from)
);
CREATE INDEX IF NOT EXISTS channel_ari_queue_pending_idx
  ON channel_ari_queue (next_attempt_at, property_id) WHERE processed_at IS NULL;

CREATE TABLE IF NOT EXISTS channel_booking_revisions (
  id                    BIGSERIAL PRIMARY KEY,
  property_id           UUID REFERENCES properties(id) ON DELETE CASCADE,
  revision_id           TEXT NOT NULL UNIQUE,
  channel_booking_id    TEXT,
  ota_name              TEXT,
  status                TEXT,                    -- new | modified | cancelled
  payload               JSONB NOT NULL,
  received_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at          TIMESTAMPTZ,
  acked_at              TIMESTAMPTZ,
  attempts              INT NOT NULL DEFAULT 0,
  error                 TEXT
);
CREATE INDEX IF NOT EXISTS channel_booking_revisions_pending_idx
  ON channel_booking_revisions (received_at) WHERE processed_at IS NULL;

CREATE TABLE IF NOT EXISTS channel_sync_log (
  id                    BIGSERIAL PRIMARY KEY,
  property_id           UUID REFERENCES properties(id) ON DELETE CASCADE,
  direction             TEXT NOT NULL CHECK (direction IN ('out', 'in')),
  kind                  TEXT NOT NULL,
  status_code           INT,
  ok                    BOOLEAN NOT NULL,
  summary               TEXT,
  detail                JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS channel_sync_log_property_idx
  ON channel_sync_log (property_id, created_at DESC);

-- ══════════════════════════════════════════════════════════════════════
-- ENQUEUE — no-op unless the property has an ACTIVE connection
-- ══════════════════════════════════════════════════════════════════════

-- Morocco "today" (the DB clock is UTC; Morocco is UTC+0/+1 around Ramadan).
CREATE OR REPLACE FUNCTION channel_today()
RETURNS DATE LANGUAGE sql STABLE AS $$
  SELECT (NOW() AT TIME ZONE 'Africa/Casablanca')::DATE;
$$;

-- How far ahead inventory is published (Channex state_length default = 500).
CREATE OR REPLACE FUNCTION channel_horizon_days()
RETURNS INT LANGUAGE sql IMMUTABLE AS $$ SELECT 500 $$;

CREATE OR REPLACE FUNCTION channel_enqueue(
  p_property_id UUID, p_room_type_id UUID, p_kind TEXT,
  p_from DATE, p_to DATE, p_reason TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from DATE := GREATEST(p_from, channel_today());
  v_to   DATE := LEAST(p_to, channel_today() + channel_horizon_days());
BEGIN
  IF p_room_type_id IS NULL OR v_to <= v_from THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM channel_connections
    WHERE property_id = p_property_id AND status = 'active'
  ) THEN
    RETURN;
  END IF;
  INSERT INTO channel_ari_queue (property_id, room_type_id, kind, date_from, date_to, reason)
  VALUES (p_property_id, p_room_type_id, p_kind, v_from, v_to, p_reason);
END;
$$;

-- Bookings: a change to who holds what, when.
CREATE OR REPLACE FUNCTION trg_bookings_channel_enqueue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.room_type_id IS NOT NULL
     AND OLD.status IN ('pending', 'confirmed', 'checked_in') THEN
    PERFORM channel_enqueue(OLD.property_id, OLD.room_type_id, 'availability',
                            OLD.check_in_date, OLD.check_out_date, 'booking:' || TG_OP);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.room_type_id IS NOT NULL
     AND NEW.status IN ('pending', 'confirmed', 'checked_in') THEN
    -- On UPDATE the old slice above already covers an unchanged range.
    IF TG_OP = 'INSERT'
       OR NEW.room_type_id IS DISTINCT FROM OLD.room_type_id
       OR NEW.check_in_date <> OLD.check_in_date
       OR NEW.check_out_date <> OLD.check_out_date
       OR OLD.status NOT IN ('pending', 'confirmed', 'checked_in')
       OR NEW.bed_id IS DISTINCT FROM OLD.bed_id
    THEN
      PERFORM channel_enqueue(NEW.property_id, NEW.room_type_id, 'availability',
                              NEW.check_in_date, NEW.check_out_date, 'booking:' || TG_OP);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS bookings_channel_enqueue ON bookings;
CREATE TRIGGER bookings_channel_enqueue
  AFTER INSERT OR DELETE OR UPDATE OF room_type_id, bed_id, check_in_date, check_out_date, status ON bookings
  FOR EACH ROW EXECUTE FUNCTION trg_bookings_channel_enqueue();

-- Beds: capacity (insert/delete/move) or 'blocked' changes. Cleaning states
-- (dirty/occupied/available) do NOT change sellable stock.
CREATE OR REPLACE FUNCTION trg_beds_channel_enqueue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old UUID; v_new UUID;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    SELECT room_type_id INTO v_old FROM rooms WHERE id = OLD.room_id;
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    SELECT room_type_id INTO v_new FROM rooms WHERE id = NEW.room_id;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.room_id IS NOT DISTINCT FROM OLD.room_id
     AND (NEW.status = 'blocked') = (OLD.status = 'blocked') THEN
    RETURN NULL;
  END IF;

  IF v_old IS NOT NULL THEN
    PERFORM channel_enqueue(OLD.property_id, v_old, 'availability',
                            channel_today(), channel_today() + channel_horizon_days(), 'bed:' || TG_OP);
  END IF;
  IF v_new IS NOT NULL AND v_new IS DISTINCT FROM v_old THEN
    PERFORM channel_enqueue(NEW.property_id, v_new, 'availability',
                            channel_today(), channel_today() + channel_horizon_days(), 'bed:' || TG_OP);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS beds_channel_enqueue ON beds;
CREATE TRIGGER beds_channel_enqueue
  AFTER INSERT OR DELETE OR UPDATE OF status, room_id ON beds
  FOR EACH ROW EXECUTE FUNCTION trg_beds_channel_enqueue();

-- Rooms moved between types change both types' unit counts.
CREATE OR REPLACE FUNCTION trg_rooms_channel_enqueue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.room_type_id IS NOT NULL AND EXISTS (SELECT 1 FROM room_types WHERE id = OLD.room_type_id) THEN
    PERFORM channel_enqueue(OLD.property_id, OLD.room_type_id, 'availability',
                            channel_today(), channel_today() + channel_horizon_days(), 'room:retype');
  END IF;
  PERFORM channel_enqueue(NEW.property_id, NEW.room_type_id, 'availability',
                          channel_today(), channel_today() + channel_horizon_days(), 'room:retype');
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS rooms_channel_enqueue ON rooms;
CREATE TRIGGER rooms_channel_enqueue
  AFTER UPDATE OF room_type_id ON rooms
  FOR EACH ROW WHEN (NEW.room_type_id IS DISTINCT FROM OLD.room_type_id)
  EXECUTE FUNCTION trg_rooms_channel_enqueue();

-- Rates & restrictions.
CREATE OR REPLACE FUNCTION trg_rate_calendar_channel_enqueue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  IF TG_OP = 'DELETE' THEN r := OLD; ELSE r := NEW; END IF;
  PERFORM channel_enqueue(r.property_id,
    (SELECT room_type_id FROM rate_plans WHERE id = r.rate_plan_id),
    'rates', r.date, r.date + 1, 'rate_calendar:' || TG_OP);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS rate_calendar_channel_enqueue ON rate_calendar;
CREATE TRIGGER rate_calendar_channel_enqueue
  AFTER INSERT OR UPDATE OR DELETE ON rate_calendar
  FOR EACH ROW EXECUTE FUNCTION trg_rate_calendar_channel_enqueue();

CREATE OR REPLACE FUNCTION trg_room_types_channel_enqueue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM channel_enqueue(NEW.property_id, NEW.id, 'rates',
                          channel_today(), channel_today() + channel_horizon_days(), 'room_type:rate');
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS room_types_channel_enqueue ON room_types;
CREATE TRIGGER room_types_channel_enqueue
  AFTER UPDATE OF default_rate ON room_types
  FOR EACH ROW WHEN (NEW.default_rate IS DISTINCT FROM OLD.default_rate)
  EXECUTE FUNCTION trg_room_types_channel_enqueue();

-- ══════════════════════════════════════════════════════════════════════
-- RLS — server-only tables. The owner can read the connection and the log
-- (for a status screen); nobody but the service role touches the queue
-- and the revisions.
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE channel_connections       ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_ari_queue         ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_booking_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_sync_log          ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_read" ON channel_connections;
CREATE POLICY "owner_read" ON channel_connections FOR SELECT
  USING (property_id IN (SELECT id FROM properties WHERE owner_id = (SELECT auth.uid())));
DROP POLICY IF EXISTS "owner_read" ON channel_sync_log;
CREATE POLICY "owner_read" ON channel_sync_log FOR SELECT
  USING (property_id IN (SELECT id FROM properties WHERE owner_id = (SELECT auth.uid())));

REVOKE ALL ON channel_ari_queue, channel_booking_revisions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON channel_connections, channel_sync_log FROM anon, authenticated;
REVOKE ALL ON SEQUENCE channel_ari_queue_id_seq, channel_booking_revisions_id_seq, channel_sync_log_id_seq
  FROM anon, authenticated;

REVOKE ALL ON FUNCTION channel_enqueue(UUID, UUID, TEXT, DATE, DATE, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION trg_bookings_channel_enqueue()      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION trg_beds_channel_enqueue()          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION trg_rooms_channel_enqueue()         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION trg_rate_calendar_channel_enqueue() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION trg_room_types_channel_enqueue()    FROM PUBLIC, anon, authenticated;
