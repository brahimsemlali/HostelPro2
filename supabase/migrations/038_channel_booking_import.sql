-- 038_channel_booking_import.sql — apply Channex booking revisions (requires 036 + 037).
--
-- An OTA booking already exists at the OTA: the PMS must RECORD it, never
-- refuse it. If it oversells a room type (race between two channels, or a
-- walk-in sold the last bed), the booking is kept and an alert is raised for
-- the owner instead of the 036 guard raising SR409 (which would leave the
-- revision unacked and the booking missing from the app).
--
-- The bypass is a transaction-local setting that only apply_channel_revision()
-- sets. PostgREST does not expose set_config, and the RPC is service-role only,
-- so no browser session can switch the guard off.
--
-- Mapping (kept in one place, see channel_units_for_room):
--   • one booking row per sold UNIT, all rows of one OTA booking share
--     reservation_group_id; beds are assigned later by staff (bed_id NULL)
--   • bed-sold types (dorms): one unit per guest in the room entry
--   • room-sold types (private): one unit per room entry
--   • unmapped Channex room type: the booking is still recorded (untyped) and
--     an 'unmapped_room' alert is raised
--   • modified: each sold unit takes over an existing row of the booking
--     (bed, check-in status and payments stay attached); units no longer
--     sold are cancelled, new ones are created bed-less
--   • cancelled: every not-yet-arrived row is cancelled; a checked-in
--     guest is flagged for staff instead
--   • commission: the OTA's figure when sent, else the app defaults

-- The iCal dedupe index from 023 (one bed-less row per OTA reference) would
-- block a multi-bed channel booking (N bed-less rows, one reference) and its
-- re-creation after a date change. Channel rows dedupe on their revision
-- instead, so scope the index to iCal imports.
DROP INDEX IF EXISTS bookings_external_import_unique;
CREATE UNIQUE INDEX IF NOT EXISTS bookings_external_import_unique
  ON bookings (property_id, external_booking_id)
  WHERE external_booking_id IS NOT NULL AND bed_id IS NULL AND channel_booking_id IS NULL;

CREATE TABLE IF NOT EXISTS channel_alerts (
  id            BIGSERIAL PRIMARY KEY,
  property_id   UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL CHECK (kind IN ('overbooking', 'unmapped_room', 'sync_error')),
  room_type_id  UUID REFERENCES room_types(id) ON DELETE SET NULL,
  booking_id    UUID REFERENCES bookings(id) ON DELETE CASCADE,
  night         DATE,
  message       TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS channel_alerts_open_idx
  ON channel_alerts (property_id, created_at DESC) WHERE resolved_at IS NULL;

ALTER TABLE channel_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner_all" ON channel_alerts;
CREATE POLICY "owner_all" ON channel_alerts FOR ALL
  USING (property_id IN (SELECT id FROM properties WHERE owner_id = (SELECT auth.uid())))
  WITH CHECK (property_id IN (SELECT id FROM properties WHERE owner_id = (SELECT auth.uid())));
DROP POLICY IF EXISTS "staff_read" ON channel_alerts;
CREATE POLICY "staff_read" ON channel_alerts FOR SELECT
  USING (property_id = (SELECT get_my_property_id()) AND (SELECT get_my_role_rank()) >= 2);
DROP POLICY IF EXISTS "manager_resolve" ON channel_alerts;
CREATE POLICY "manager_resolve" ON channel_alerts FOR UPDATE
  USING (property_id = (SELECT get_my_property_id()) AND (SELECT get_my_role_rank()) >= 3)
  WITH CHECK (property_id = (SELECT get_my_property_id()) AND (SELECT get_my_role_rank()) >= 3);
REVOKE INSERT, DELETE ON channel_alerts FROM anon, authenticated;

-- ══════════════════════════════════════════════════════════════════════
-- Guard: during a channel import, record an overbooking instead of refusing
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION trg_bookings_capacity_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type  UUID;
  v_prop  UUID;
  v_in    DATE;
  v_out   DATE;
  v_night DATE;
BEGIN
  SELECT room_type_id, property_id, check_in_date, check_out_date
    INTO v_type, v_prop, v_in, v_out
  FROM bookings
  WHERE id = NEW.id AND status IN ('pending', 'confirmed', 'checked_in');

  IF v_type IS NULL OR v_out <= v_in THEN
    RETURN NULL;
  END IF;

  -- Only a change that can ADD occupancy is judged: a new booking, a type
  -- change, longer dates, or a reactivation. A check-in, a shortened stay or a
  -- bed move inside a per-bed type never makes things worse, so it passes even
  -- when the type is already over capacity (e.g. after a channel overbooking).
  IF TG_OP = 'UPDATE'
     AND OLD.status IN ('pending', 'confirmed', 'checked_in')
     AND OLD.room_type_id IS NOT DISTINCT FROM v_type
     AND v_in >= OLD.check_in_date AND v_out <= OLD.check_out_date
     AND (OLD.bed_id IS NOT DISTINCT FROM NEW.bed_id
          OR (SELECT sell_unit FROM room_types WHERE id = v_type) = 'bed')
  THEN
    RETURN NULL;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('room_type:' || v_type::TEXT, 0));

  SELECT a.night INTO v_night
  FROM room_type_availability(v_type, v_in, v_out) a
  WHERE a.taken > a.units
    -- same type, already active: only the nights it newly occupies count
    AND NOT (TG_OP = 'UPDATE'
             AND OLD.status IN ('pending', 'confirmed', 'checked_in')
             AND OLD.room_type_id IS NOT DISTINCT FROM v_type
             AND (OLD.bed_id IS NOT DISTINCT FROM NEW.bed_id
                  OR (SELECT sell_unit FROM room_types WHERE id = v_type) = 'bed')
             AND a.night >= OLD.check_in_date AND a.night < OLD.check_out_date)
  ORDER BY a.night
  LIMIT 1;

  IF v_night IS NULL THEN
    RETURN NULL;
  END IF;

  IF current_setting('app.channel_import', TRUE) = 'on' THEN
    INSERT INTO channel_alerts (property_id, kind, room_type_id, booking_id, night, message)
    VALUES (v_prop, 'overbooking', v_type, NEW.id, v_night,
            'Surréservation : une réservation en ligne dépasse la capacité de ce type la nuit du '
            || to_char(v_night, 'DD/MM/YYYY') || '.');
    RETURN NULL;
  END IF;

  RAISE EXCEPTION 'ROOM_TYPE_FULL: no unit left in this room type on %', v_night
    USING ERRCODE = 'SR409',
          HINT = 'Another booking already holds the last bed or room for that night.';
END;
$$;

-- ══════════════════════════════════════════════════════════════════════
-- Import
-- ══════════════════════════════════════════════════════════════════════

-- How many booking rows one Channex room entry becomes. The open question
-- for Channex (how Booking.com sells dorm beds) only changes this function.
CREATE OR REPLACE FUNCTION channel_units_for_room(p_sell_unit TEXT, p_room JSONB)
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_sell_unit = 'bed' THEN GREATEST(1, LEAST(20,
      COALESCE((p_room #>> '{occupancy,adults}')::INT, 0)
      + COALESCE((p_room #>> '{occupancy,children}')::INT, 0)))
    ELSE 1
  END;
$$;

CREATE OR REPLACE FUNCTION channel_source(p_ota TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_ota ILIKE 'booking%' THEN 'booking_com'
    WHEN p_ota ILIKE 'hostelworld%' THEN 'hostelworld'
    WHEN p_ota ILIKE 'airbnb%' THEN 'airbnb'
    WHEN p_ota ILIKE 'expedia%' THEN 'expedia'
    ELSE 'channel'
  END;
$$;

-- Commission % of an OTA booking: the OTA's own figure when Channex sends it,
-- else the app's defaults (lib/constants.ts DEFAULT_COMMISSION_RATES).
CREATE OR REPLACE FUNCTION channel_commission_rate(p_source TEXT, p_amount TEXT, p_commission TEXT)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN NULLIF(p_commission, '') IS NOT NULL AND COALESCE(NULLIF(p_amount, '')::NUMERIC, 0) > 0
      THEN LEAST(100, GREATEST(0, ROUND(p_commission::NUMERIC / p_amount::NUMERIC * 100, 2)))
    WHEN p_source = 'booking_com' THEN 15
    WHEN p_source = 'hostelworld' THEN 12
    ELSE 0
  END;
$$;

-- Apply one stored revision. Matching rule for new / modified: every sold
-- unit of the revision takes over an existing active row of the same OTA
-- booking when one is left (same room type first, checked-in guests first),
-- so beds, check-in status and payments stay attached. A row whose type
-- changes, or whose bed is taken on the new dates, loses its bed (staff
-- re-place it). Leftover rows are cancelled, except a checked-in guest, who
-- is flagged for staff instead. Leftover units become new bed-less rows.
CREATE OR REPLACE FUNCTION apply_channel_revision(p_revision_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rev        channel_booking_revisions%ROWTYPE;
  a          JSONB;
  v_prop     UUID;
  v_status   TEXT;
  v_chbk     TEXT;
  v_group    UUID;
  v_guest    UUID;
  v_source   TEXT;
  v_comm     NUMERIC;
  u          RECORD;
  v_row      bookings%ROWTYPE;
  v_used     UUID[] := '{}';
  v_created  INT := 0;
  v_updated  INT := 0;
  v_cancel   INT := 0;
  v_bk       UUID;
BEGIN
  SELECT * INTO rev FROM channel_booking_revisions WHERE revision_id = p_revision_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'revision_not_found';
  END IF;
  IF rev.processed_at IS NOT NULL THEN
    RETURN jsonb_build_object('skipped', 'already_processed');
  END IF;

  a := rev.payload;
  SELECT cc.property_id INTO v_prop
  FROM channel_connections cc WHERE cc.channex_property_id = a->>'property_id';
  IF v_prop IS NULL THEN
    RAISE EXCEPTION 'unknown_channex_property %', a->>'property_id';
  END IF;

  PERFORM set_config('app.channel_import', 'on', TRUE);

  v_status := a->>'status';
  v_chbk   := a->>'booking_id';
  v_group  := md5('channex:' || v_chbk)::UUID;
  v_source := channel_source(a->>'ota_name');
  v_comm   := channel_commission_rate(v_source, a->>'amount', a->>'ota_commission');

  IF v_status = 'cancelled' THEN
    UPDATE bookings SET status = 'cancelled', channel_revision_id = p_revision_id
    WHERE property_id = v_prop AND channel_booking_id = v_chbk
      AND status IN ('pending', 'confirmed');
    GET DIAGNOSTICS v_cancel = ROW_COUNT;
    -- A guest already in the house: staff decide, the row is not touched.
    INSERT INTO channel_alerts (property_id, kind, booking_id, message)
    SELECT v_prop, 'sync_error', id,
           'Réservation annulée par ' || COALESCE(a->>'ota_name', 'le site') || ' alors que le client est déjà enregistré : à vérifier.'
    FROM bookings WHERE property_id = v_prop AND channel_booking_id = v_chbk AND status = 'checked_in';
  ELSE
    -- Guest: reuse the one already attached to this OTA booking.
    SELECT guest_id INTO v_guest FROM bookings
    WHERE property_id = v_prop AND channel_booking_id = v_chbk AND guest_id IS NOT NULL
    ORDER BY created_at LIMIT 1;

    IF v_guest IS NULL THEN
      INSERT INTO guests (property_id, first_name, last_name, email, phone, whatsapp, nationality, country_of_residence)
      VALUES (
        v_prop,
        COALESCE(NULLIF(trim(a #>> '{customer,name}'), ''), 'Client'),
        COALESCE(NULLIF(trim(a #>> '{customer,surname}'), ''), initcap(v_source)),
        NULLIF(a #>> '{customer,mail}', ''),
        NULLIF(a #>> '{customer,phone}', ''),
        NULLIF(a #>> '{customer,phone}', ''),
        NULLIF(a #>> '{customer,country}', ''),
        NULLIF(a #>> '{customer,country}', '')
      )
      RETURNING id INTO v_guest;
    ELSE
      UPDATE guests SET
        email = COALESCE(NULLIF(a #>> '{customer,mail}', ''), email),
        phone = COALESCE(NULLIF(a #>> '{customer,phone}', ''), phone)
      WHERE id = v_guest;
    END IF;

    -- One record per sold unit.
    FOR u IN
      SELECT t.id AS type_id,
             (SELECT p.id FROM rate_plans p WHERE p.room_type_id = t.id AND p.channex_rate_plan_id = r->>'rate_plan_id') AS plan_id,
             (r->>'checkin_date')::DATE AS ci,
             (r->>'checkout_date')::DATE AS co,
             ROUND(COALESCE((r->>'amount')::NUMERIC, 0)
                   / channel_units_for_room(COALESCE(t.sell_unit, 'room'), r), 2) AS amount,
             r AS room
      FROM jsonb_array_elements(COALESCE(a->'rooms', '[]'::JSONB)) WITH ORDINALITY AS x(r, ord)
      LEFT JOIN room_types t ON t.property_id = v_prop AND t.channex_room_type_id = r->>'room_type_id'
      CROSS JOIN LATERAL generate_series(1, channel_units_for_room(COALESCE(t.sell_unit, 'room'), r)) g
      ORDER BY x.ord, g
    LOOP
      v_row := NULL;
      SELECT * INTO v_row FROM bookings
      WHERE property_id = v_prop AND channel_booking_id = v_chbk
        AND status IN ('pending', 'confirmed', 'checked_in')
        AND NOT (id = ANY (v_used))
      ORDER BY (room_type_id IS NOT DISTINCT FROM u.type_id) DESC,
               (status = 'checked_in') DESC,
               (check_in_date = u.ci AND check_out_date = u.co) DESC,
               created_at, id
      LIMIT 1;

      IF v_row.id IS NOT NULL THEN
        v_used := v_used || v_row.id;
        BEGIN
          UPDATE bookings SET
            -- the type follows the bed: a new type means the bed goes
            bed_id = CASE WHEN room_type_id IS NOT DISTINCT FROM u.type_id THEN bed_id END,
            room_type_id = u.type_id, rate_plan_id = u.plan_id,
            check_in_date = u.ci, check_out_date = u.co,
            total_price = u.amount, commission_rate = v_comm,
            channel_revision_id = p_revision_id, ota_payload = u.room
          WHERE id = v_row.id;
        EXCEPTION WHEN exclusion_violation THEN
          -- The bed is taken on the new dates: keep the booking, free the bed.
          UPDATE bookings SET
            bed_id = NULL, room_type_id = u.type_id, rate_plan_id = u.plan_id,
            check_in_date = u.ci, check_out_date = u.co,
            total_price = u.amount, commission_rate = v_comm,
            channel_revision_id = p_revision_id, ota_payload = u.room
          WHERE id = v_row.id;
        END;
        v_updated := v_updated + 1;
        v_bk := v_row.id;
      ELSE
        INSERT INTO bookings (
          property_id, guest_id, bed_id, room_type_id, rate_plan_id, reservation_group_id,
          source, external_booking_id, channel_booking_id, channel_revision_id, ota_payload,
          status, check_in_date, check_out_date, adults, total_price, commission_rate, special_requests
        ) VALUES (
          v_prop, v_guest, NULL, u.type_id, u.plan_id, v_group,
          v_source, COALESCE(a->>'ota_reservation_code', a->>'unique_id'),
          v_chbk, p_revision_id, u.room,
          'confirmed', u.ci, u.co, 1, u.amount, v_comm, NULLIF(a->>'notes', '')
        ) RETURNING id INTO v_bk;
        v_used := v_used || v_bk;          -- a unit created now is not matched again
        v_created := v_created + 1;
      END IF;

      IF u.type_id IS NULL THEN
        INSERT INTO channel_alerts (property_id, kind, booking_id, message)
        VALUES (v_prop, 'unmapped_room', v_bk,
                'Réservation ' || COALESCE(a->>'ota_name', 'en ligne') || ' pour un type de chambre non relié : placez-la à la main.');
      END IF;
    END LOOP;

    -- Units the OTA no longer sells.
    UPDATE bookings SET status = 'cancelled', channel_revision_id = p_revision_id
    WHERE property_id = v_prop AND channel_booking_id = v_chbk
      AND status IN ('pending', 'confirmed') AND NOT (id = ANY (v_used));
    GET DIAGNOSTICS v_cancel = ROW_COUNT;
    INSERT INTO channel_alerts (property_id, kind, booking_id, message)
    SELECT v_prop, 'sync_error', id,
           'Modification ' || COALESCE(a->>'ota_name', 'en ligne') || ' : un client déjà enregistré ne fait plus partie de la réservation. À vérifier.'
    FROM bookings WHERE property_id = v_prop AND channel_booking_id = v_chbk
      AND status = 'checked_in' AND NOT (id = ANY (v_used));
  END IF;

  -- Guard runs at commit; force it now so alerts and errors land in this call.
  SET CONSTRAINTS bookings_room_type_capacity IMMEDIATE;
  -- The guard has now judged every row of this import: switch the bypass off
  -- for anything else that runs later in the same transaction.
  PERFORM set_config('app.channel_import', 'off', TRUE);

  UPDATE channel_booking_revisions
  SET processed_at = NOW(), error = NULL, attempts = attempts + 1, property_id = v_prop,
      channel_booking_id = v_chbk, ota_name = a->>'ota_name', status = v_status
  WHERE id = rev.id;

  RETURN jsonb_build_object('property_id', v_prop, 'status', v_status,
                            'created', v_created, 'updated', v_updated, 'cancelled', v_cancel);
END;
$$;

REVOKE ALL ON FUNCTION apply_channel_revision(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION apply_channel_revision(TEXT) TO service_role;
REVOKE ALL ON FUNCTION channel_units_for_room(TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION channel_source(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION channel_commission_rate(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION trg_bookings_capacity_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON channel_alerts FROM anon;
REVOKE ALL ON SEQUENCE channel_alerts_id_seq FROM anon, authenticated;
