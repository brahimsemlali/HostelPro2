-- 036_room_types_inventory.sql — sellable inventory model (channel-manager ready).
--
-- Why: channel managers (Channex) sell ROOM TYPES with a unit count and RATE
-- PLANS with prices per date, while this app tracks physical beds. This adds
-- the inventory layer between the two without changing any existing write path:
--
--   room_types      what is sold ("Dortoir mixte 6 lits", "Chambre double").
--                   sell_unit = 'bed' (dorms: each bed is a unit) or 'room'
--                   (private rooms: the whole room is one unit).
--   rooms.room_type_id   every physical room belongs to one type. A BEFORE
--                   INSERT trigger creates a 1:1 type for rooms inserted by
--                   old code (RoomsClient, onboarding RPC 027), so nothing breaks.
--   rate_plans      one default "Standard" plan per type (auto-created).
--   rate_calendar   optional per-date rate + restrictions per plan.
--   bookings.room_type_id   derived by trigger from bed → room → type, so the
--                   ~12 client write paths need no change. A booking with NO
--                   bed (OTA "1 dorm bed") keeps its type and still counts.
--   room_type_availability()   ONE source of truth: units, taken, blocked,
--                   available per night.
--   bookings_room_type_capacity   DEFERRED constraint trigger: a room type can
--                   never be sold beyond its units on any night, assigned and
--                   unassigned bookings together (the bed-level exclusion
--                   constraint from 022 cannot see bed-less bookings).
--
-- Compatibility: safe with the currently deployed app. beds.base_price stays
-- the live price; room_types.default_rate is informational until the sync uses
-- it. Untyped bed-less bookings (current iCal imports) are not guarded.
--
-- Pre-flight (must return 0 rows; the status CHECK below is NOT VALID, so old
-- rows are not rechecked, but any later UPDATE of such a row would fail):
--   SELECT status, COUNT(*) FROM bookings
--   WHERE status NOT IN ('pending','confirmed','checked_in','checked_out','cancelled','no_show')
--   GROUP BY status;

-- ══════════════════════════════════════════════════════════════════════
-- A. TABLES
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS room_types (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id           UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  kind                  TEXT NOT NULL DEFAULT 'dorm' CHECK (kind IN ('dorm', 'private')),
  sell_unit             TEXT NOT NULL DEFAULT 'bed'  CHECK (sell_unit IN ('bed', 'room')),
  gender_policy         TEXT NOT NULL DEFAULT 'mixed' CHECK (gender_policy IN ('mixed', 'female', 'male')),
  max_occupancy         INT  NOT NULL DEFAULT 1 CHECK (max_occupancy BETWEEN 1 AND 50),
  default_rate          NUMERIC(10,2) CHECK (default_rate IS NULL OR default_rate >= 0),
  description           TEXT,
  channex_room_type_id  TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS room_types_property_idx ON room_types (property_id);

CREATE TABLE IF NOT EXISTS rate_plans (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id           UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  room_type_id          UUID NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL DEFAULT 'Standard',
  currency              TEXT NOT NULL DEFAULT 'MAD',
  is_default            BOOLEAN NOT NULL DEFAULT FALSE,
  channex_rate_plan_id  TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS rate_plans_room_type_idx ON rate_plans (room_type_id);
CREATE UNIQUE INDEX IF NOT EXISTS rate_plans_one_default
  ON rate_plans (room_type_id) WHERE is_default;

CREATE TABLE IF NOT EXISTS rate_calendar (
  rate_plan_id          UUID NOT NULL REFERENCES rate_plans(id) ON DELETE CASCADE,
  date                  DATE NOT NULL,
  property_id           UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  rate                  NUMERIC(10,2) CHECK (rate IS NULL OR rate >= 0),
  min_stay_arrival      INT CHECK (min_stay_arrival IS NULL OR min_stay_arrival BETWEEN 1 AND 365),
  min_stay_through      INT CHECK (min_stay_through IS NULL OR min_stay_through BETWEEN 1 AND 365),
  max_stay              INT CHECK (max_stay IS NULL OR max_stay BETWEEN 1 AND 365),
  closed_to_arrival     BOOLEAN NOT NULL DEFAULT FALSE,
  closed_to_departure   BOOLEAN NOT NULL DEFAULT FALSE,
  stop_sell             BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (rate_plan_id, date)
);
CREATE INDEX IF NOT EXISTS rate_calendar_property_date_idx ON rate_calendar (property_id, date);

-- Physical rooms → type. Added without FK first so the backfill can mint ids.
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS room_type_id UUID;

-- Booking inventory columns (all nullable; old code never sends them).
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS room_type_id UUID REFERENCES room_types(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS rate_plan_id UUID REFERENCES rate_plans(id) ON DELETE SET NULL;
-- One OTA reservation for N beds = N booking rows sharing this id.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reservation_group_id UUID;
-- Channel identifiers (Channex booking id + the revision last applied).
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS channel_booking_id TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS channel_revision_id TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS ota_payload JSONB;

CREATE INDEX IF NOT EXISTS bookings_room_type_active_idx
  ON bookings (room_type_id, check_in_date, check_out_date)
  WHERE room_type_id IS NOT NULL AND status IN ('pending', 'confirmed', 'checked_in');
CREATE INDEX IF NOT EXISTS bookings_channel_booking_idx
  ON bookings (property_id, channel_booking_id) WHERE channel_booking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS bookings_unassigned_idx
  ON bookings (property_id, check_in_date)
  WHERE bed_id IS NULL AND status IN ('pending', 'confirmed', 'checked_in');

-- Known statuses only (NOT VALID: existing rows are not rechecked).
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_known;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_known
  CHECK (status IN ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show')) NOT VALID;

-- ══════════════════════════════════════════════════════════════════════
-- B. BACKFILL — one type per existing room (owners merge later in Settings)
-- ══════════════════════════════════════════════════════════════════════

UPDATE rooms SET room_type_id = gen_random_uuid() WHERE room_type_id IS NULL;

INSERT INTO room_types (id, property_id, name, kind, sell_unit, gender_policy, max_occupancy, default_rate)
SELECT
  r.id_type,
  r.property_id,
  r.name,
  r.kind,
  CASE WHEN r.kind = 'private' THEN 'room' ELSE 'bed' END,
  r.gender_policy,
  CASE WHEN r.kind = 'private' THEN GREATEST(1, LEAST(50, r.bed_count)) ELSE 1 END,
  -- Dorm: the usual bed price. Private: the room = sum of its beds.
  CASE WHEN r.kind = 'private' THEN r.sum_price ELSE r.avg_price END
FROM (
  SELECT
    ro.room_type_id AS id_type,
    ro.property_id,
    ro.name,
    CASE WHEN ro.type = 'private' THEN 'private' ELSE 'dorm' END AS kind,
    CASE WHEN ro.gender_policy IN ('female', 'male') THEN ro.gender_policy ELSE 'mixed' END AS gender_policy,
    COUNT(b.id)::INT AS bed_count,
    ROUND(AVG(b.base_price), 2) AS avg_price,
    SUM(b.base_price) AS sum_price
  FROM rooms ro
  LEFT JOIN beds b ON b.room_id = ro.id
  WHERE ro.property_id IS NOT NULL
  GROUP BY ro.id, ro.room_type_id, ro.property_id, ro.name, ro.type, ro.gender_policy
) r
ON CONFLICT (id) DO NOTHING;

-- Rooms without a property (should not exist) cannot get a type.
UPDATE rooms SET room_type_id = NULL
WHERE room_type_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM room_types t WHERE t.id = rooms.room_type_id);

ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_room_type_fk;
ALTER TABLE rooms ADD CONSTRAINT rooms_room_type_fk
  FOREIGN KEY (room_type_id) REFERENCES room_types(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS rooms_room_type_idx ON rooms (room_type_id);

INSERT INTO rate_plans (property_id, room_type_id, name, is_default)
SELECT t.property_id, t.id, 'Standard', TRUE
FROM room_types t
WHERE NOT EXISTS (SELECT 1 FROM rate_plans p WHERE p.room_type_id = t.id AND p.is_default);

-- Existing bookings inherit the type of their bed's room (history included,
-- so reports by type work). Runs before the guard triggers exist.
UPDATE bookings bk
SET room_type_id = ro.room_type_id
FROM beds b
JOIN rooms ro ON ro.id = b.room_id
WHERE bk.bed_id = b.id
  AND bk.room_type_id IS NULL
  AND ro.room_type_id IS NOT NULL;

-- ══════════════════════════════════════════════════════════════════════
-- C. TRIGGERS THAT KEEP OLD WRITE PATHS WORKING
-- ══════════════════════════════════════════════════════════════════════

-- C1. A room inserted without a type gets its own 1:1 type.
CREATE OR REPLACE FUNCTION trg_rooms_default_room_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind TEXT := CASE WHEN NEW.type = 'private' THEN 'private' ELSE 'dorm' END;
BEGIN
  IF NEW.room_type_id IS NULL AND NEW.property_id IS NOT NULL THEN
    INSERT INTO room_types (property_id, name, kind, sell_unit, gender_policy)
    VALUES (
      NEW.property_id,
      NEW.name,
      v_kind,
      CASE WHEN v_kind = 'private' THEN 'room' ELSE 'bed' END,
      CASE WHEN NEW.gender_policy IN ('female', 'male') THEN NEW.gender_policy ELSE 'mixed' END
    )
    RETURNING id INTO NEW.room_type_id;
  ELSIF NEW.room_type_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM room_types t WHERE t.id = NEW.room_type_id AND t.property_id = NEW.property_id
  ) THEN
    RAISE EXCEPTION 'room type belongs to another property' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rooms_default_room_type ON rooms;
CREATE TRIGGER rooms_default_room_type
  BEFORE INSERT OR UPDATE OF room_type_id ON rooms
  FOR EACH ROW EXECUTE FUNCTION trg_rooms_default_room_type();

-- C2. Every new room type gets a default rate plan.
CREATE OR REPLACE FUNCTION trg_room_types_default_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO rate_plans (property_id, room_type_id, name, is_default)
  VALUES (NEW.property_id, NEW.id, 'Standard', TRUE)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS room_types_default_plan ON room_types;
CREATE TRIGGER room_types_default_plan
  AFTER INSERT ON room_types
  FOR EACH ROW EXECUTE FUNCTION trg_room_types_default_plan();

CREATE OR REPLACE FUNCTION trg_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS room_types_touch ON room_types;
CREATE TRIGGER room_types_touch BEFORE UPDATE ON room_types
  FOR EACH ROW EXECUTE FUNCTION trg_touch_updated_at();
DROP TRIGGER IF EXISTS rate_calendar_touch ON rate_calendar;
CREATE TRIGGER rate_calendar_touch BEFORE UPDATE ON rate_calendar
  FOR EACH ROW EXECUTE FUNCTION trg_touch_updated_at();

-- C3. A booking's type follows its bed. When the bed is cleared (swap NULL
-- hop, "unassign"), the type is KEPT so the booking still counts.
CREATE OR REPLACE FUNCTION trg_bookings_room_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type UUID;
BEGIN
  IF NEW.bed_id IS NOT NULL THEN
    SELECT ro.room_type_id INTO v_type
    FROM beds b JOIN rooms ro ON ro.id = b.room_id
    WHERE b.id = NEW.bed_id;
    IF v_type IS NOT NULL THEN
      NEW.room_type_id := v_type;
    END IF;
  END IF;

  IF NEW.room_type_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM room_types t WHERE t.id = NEW.room_type_id AND t.property_id = NEW.property_id
  ) THEN
    RAISE EXCEPTION 'room type belongs to another property' USING ERRCODE = '42501';
  END IF;

  -- Default rate plan of the type when none was given or the type changed.
  IF NEW.room_type_id IS NOT NULL AND (
    NEW.rate_plan_id IS NULL
    OR NOT EXISTS (SELECT 1 FROM rate_plans p WHERE p.id = NEW.rate_plan_id AND p.room_type_id = NEW.room_type_id)
  ) THEN
    SELECT p.id INTO NEW.rate_plan_id
    FROM rate_plans p WHERE p.room_type_id = NEW.room_type_id AND p.is_default;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_room_type ON bookings;
CREATE TRIGGER bookings_room_type
  BEFORE INSERT OR UPDATE OF bed_id, room_type_id, rate_plan_id ON bookings
  FOR EACH ROW EXECUTE FUNCTION trg_bookings_room_type();

-- C4. Moving a room to another type moves its active bookings with it, and
-- removes the old type when it is left empty and not mapped to a channel.
CREATE OR REPLACE FUNCTION trg_rooms_retype()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old UUID := OLD.room_type_id;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.room_type_id IS DISTINCT FROM OLD.room_type_id THEN
    UPDATE bookings SET room_type_id = NEW.room_type_id
    WHERE bed_id IN (SELECT id FROM beds WHERE room_id = NEW.id)
      AND status IN ('pending', 'confirmed', 'checked_in');
  END IF;

  IF v_old IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM rooms WHERE room_type_id = v_old)
     AND NOT EXISTS (
       SELECT 1 FROM bookings WHERE room_type_id = v_old
         AND status IN ('pending', 'confirmed', 'checked_in'))
  THEN
    DELETE FROM room_types WHERE id = v_old AND channex_room_type_id IS NULL;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS rooms_retype ON rooms;
CREATE TRIGGER rooms_retype
  AFTER UPDATE OF room_type_id OR DELETE ON rooms
  FOR EACH ROW EXECUTE FUNCTION trg_rooms_retype();

-- ══════════════════════════════════════════════════════════════════════
-- D. AVAILABILITY — the single source of truth
--    units     beds (sell_unit 'bed') or rooms (sell_unit 'room') of the type
--    taken     active bookings that night. Bed-sold: one unit per booking.
--              Room-sold: distinct rooms with an assigned booking + distinct
--              unassigned reservations (a group = one room).
--    blocked   free units whose beds are 'blocked' today (a current-day
--              status, applied to every night — the owner unblocks to resell)
--    available GREATEST(0, units − taken − blocked)
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION room_type_availability(p_room_type_id UUID, p_from DATE, p_to DATE)
RETURNS TABLE (night DATE, units INT, taken INT, blocked INT, available INT)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH t AS (
    SELECT id, sell_unit FROM room_types WHERE id = p_room_type_id
  ),
  cap AS (
    SELECT
      CASE WHEN t.sell_unit = 'room'
        THEN (SELECT COUNT(*) FROM rooms ro WHERE ro.room_type_id = t.id)
        ELSE (SELECT COUNT(*) FROM beds b JOIN rooms ro ON ro.id = b.room_id WHERE ro.room_type_id = t.id)
      END::INT AS units,
      CASE WHEN t.sell_unit = 'room'
        THEN (SELECT COUNT(*) FROM rooms ro WHERE ro.room_type_id = t.id
                AND EXISTS (SELECT 1 FROM beds b WHERE b.room_id = ro.id)
                AND NOT EXISTS (SELECT 1 FROM beds b WHERE b.room_id = ro.id AND b.status IS DISTINCT FROM 'blocked'))
        ELSE (SELECT COUNT(*) FROM beds b JOIN rooms ro ON ro.id = b.room_id
                WHERE ro.room_type_id = t.id AND b.status = 'blocked')
      END::INT AS blocked_units,
      t.sell_unit
    FROM t
  ),
  nights AS (
    SELECT d::DATE AS night FROM generate_series(p_from, p_to - 1, INTERVAL '1 day') d
  ),
  occ AS (
    SELECT n.night,
      CASE WHEN (SELECT sell_unit FROM cap) = 'room' THEN
        (SELECT COUNT(DISTINCT b.room_id) FROM bookings bk JOIN beds b ON b.id = bk.bed_id
          WHERE bk.room_type_id = p_room_type_id
            AND bk.status IN ('pending', 'confirmed', 'checked_in')
            AND bk.check_in_date <= n.night AND bk.check_out_date > n.night)
        + (SELECT COUNT(DISTINCT COALESCE(bk.reservation_group_id, bk.id)) FROM bookings bk
          WHERE bk.room_type_id = p_room_type_id AND bk.bed_id IS NULL
            AND bk.status IN ('pending', 'confirmed', 'checked_in')
            AND bk.check_in_date <= n.night AND bk.check_out_date > n.night)
      ELSE
        (SELECT COUNT(*) FROM bookings bk
          WHERE bk.room_type_id = p_room_type_id
            AND bk.status IN ('pending', 'confirmed', 'checked_in')
            AND bk.check_in_date <= n.night AND bk.check_out_date > n.night)
      END::INT AS taken
    FROM nights n
  )
  SELECT o.night, c.units, o.taken,
         -- a blocked bed should hold no booking; never count it twice
         LEAST(c.blocked_units, GREATEST(0, c.units - o.taken))::INT,
         GREATEST(0, c.units - o.taken - c.blocked_units)::INT
  FROM occ o CROSS JOIN cap c
  ORDER BY o.night;
$$;

GRANT EXECUTE ON FUNCTION room_type_availability(UUID, DATE, DATE) TO authenticated, service_role;

-- ══════════════════════════════════════════════════════════════════════
-- E. OVERSELL GUARD — deferred to commit so the swap RPC's NULL hop and
--    multi-statement edits are judged on their final state. The advisory
--    lock serialises concurrent sellers of the same type (two OTAs racing
--    for the last bed): the second waits, then counts the first's row.
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION trg_bookings_capacity_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type UUID;
  v_in   DATE;
  v_out  DATE;
  v_night DATE;
BEGIN
  -- Judge the row as it stands at commit, not as this event saw it.
  SELECT room_type_id, check_in_date, check_out_date
    INTO v_type, v_in, v_out
  FROM bookings
  WHERE id = NEW.id AND status IN ('pending', 'confirmed', 'checked_in');

  IF v_type IS NULL OR v_out <= v_in THEN
    RETURN NULL;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('room_type:' || v_type::TEXT, 0));

  SELECT a.night INTO v_night
  FROM room_type_availability(v_type, v_in, v_out) a
  WHERE a.taken > a.units
  ORDER BY a.night
  LIMIT 1;

  IF v_night IS NOT NULL THEN
    RAISE EXCEPTION 'ROOM_TYPE_FULL: no unit left in this room type on %', v_night
      USING ERRCODE = 'SR409',
            HINT = 'Another booking already holds the last bed or room for that night.';
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS bookings_room_type_capacity ON bookings;
CREATE CONSTRAINT TRIGGER bookings_room_type_capacity
  AFTER INSERT OR UPDATE OF room_type_id, bed_id, check_in_date, check_out_date, status ON bookings
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION trg_bookings_capacity_guard();

-- ══════════════════════════════════════════════════════════════════════
-- F. RLS — owner full; staff read; manager+ edits rates
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE room_types    ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_plans    ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_calendar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "property_access" ON room_types;
CREATE POLICY "property_access" ON room_types FOR ALL
  USING (property_id IN (SELECT id FROM properties WHERE owner_id = (SELECT auth.uid())))
  WITH CHECK (property_id IN (SELECT id FROM properties WHERE owner_id = (SELECT auth.uid())));
DROP POLICY IF EXISTS "staff_read_room_types" ON room_types;
CREATE POLICY "staff_read_room_types" ON room_types FOR SELECT
  USING (property_id = (SELECT get_my_property_id()));

DROP POLICY IF EXISTS "property_access" ON rate_plans;
CREATE POLICY "property_access" ON rate_plans FOR ALL
  USING (property_id IN (SELECT id FROM properties WHERE owner_id = (SELECT auth.uid())))
  WITH CHECK (property_id IN (SELECT id FROM properties WHERE owner_id = (SELECT auth.uid())));
DROP POLICY IF EXISTS "staff_read_rate_plans" ON rate_plans;
CREATE POLICY "staff_read_rate_plans" ON rate_plans FOR SELECT
  USING (property_id = (SELECT get_my_property_id()));

DROP POLICY IF EXISTS "property_access" ON rate_calendar;
CREATE POLICY "property_access" ON rate_calendar FOR ALL
  USING (property_id IN (SELECT id FROM properties WHERE owner_id = (SELECT auth.uid())))
  WITH CHECK (property_id IN (SELECT id FROM properties WHERE owner_id = (SELECT auth.uid())));
DROP POLICY IF EXISTS "staff_read_rate_calendar" ON rate_calendar;
CREATE POLICY "staff_read_rate_calendar" ON rate_calendar FOR SELECT
  USING (property_id = (SELECT get_my_property_id()));
DROP POLICY IF EXISTS "manager_write_rate_calendar" ON rate_calendar;
CREATE POLICY "manager_write_rate_calendar" ON rate_calendar FOR ALL
  USING (property_id = (SELECT get_my_property_id()) AND (SELECT get_my_role_rank()) >= 3)
  WITH CHECK (property_id = (SELECT get_my_property_id()) AND (SELECT get_my_role_rank()) >= 3);

-- rate_calendar.property_id must match its plan (a tenant cannot write
-- restrictions onto another tenant's plan by guessing its id).
CREATE OR REPLACE FUNCTION trg_rate_calendar_property()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM rate_plans p WHERE p.id = NEW.rate_plan_id AND p.property_id = NEW.property_id) THEN
    RAISE EXCEPTION 'rate plan belongs to another property' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rate_calendar_property ON rate_calendar;
CREATE TRIGGER rate_calendar_property
  BEFORE INSERT OR UPDATE OF rate_plan_id, property_id ON rate_calendar
  FOR EACH ROW EXECUTE FUNCTION trg_rate_calendar_property();

-- Same rule for rate_plans → room_types.
CREATE OR REPLACE FUNCTION trg_rate_plans_property()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM room_types t WHERE t.id = NEW.room_type_id AND t.property_id = NEW.property_id) THEN
    RAISE EXCEPTION 'room type belongs to another property' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rate_plans_property ON rate_plans;
CREATE TRIGGER rate_plans_property
  BEFORE INSERT OR UPDATE OF room_type_id, property_id ON rate_plans
  FOR EACH ROW EXECUTE FUNCTION trg_rate_plans_property();

-- Trigger functions are not meant to be called directly.
REVOKE ALL ON FUNCTION trg_rooms_default_room_type()  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION trg_room_types_default_plan() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION trg_bookings_room_type()      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION trg_rooms_retype()            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION trg_bookings_capacity_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION trg_rate_calendar_property()  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION trg_rate_plans_property()     FROM PUBLIC, anon, authenticated;
