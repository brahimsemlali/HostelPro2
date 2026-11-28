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
--   • modified: same rooms + dates → details updated in place (bed kept);
--     otherwise the old rows are cancelled and new rows created
--   • cancelled: every active row of the booking is cancelled

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

  PERFORM pg_advisory_xact_lock(hashtextextended('room_type:' || v_type::TEXT, 0));

  SELECT a.night INTO v_night
  FROM room_type_availability(v_type, v_in, v_out) a
  WHERE a.taken > a.units
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

CREATE OR REPLACE FUNCTION apply_channel_revision(p_revision_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rev        channel_booking_revisions%ROWTYPE;
  a          JSONB;           -- revision attributes
  v_prop     UUID;
  v_status   TEXT;
  v_chbk     TEXT;
  v_group    UUID;
  v_guest    UUID;
  v_room     JSONB;
  v_type     room_types%ROWTYPE;
  v_plan     UUID;
  v_units    INT;
  v_amount   NUMERIC;
  v_created  INT := 0;
  v_updated  INT := 0;
  v_cancel   INT := 0;
  v_same     BOOLEAN;
  v_new_sig  TEXT;
  v_old_sig  TEXT;
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

  -- ── cancelled ────────────────────────────────────────────────────────
  IF v_status = 'cancelled' THEN
    UPDATE bookings SET status = 'cancelled', channel_revision_id = p_revision_id
    WHERE property_id = v_prop AND channel_booking_id = v_chbk
      AND status IN ('pending', 'confirmed');
    GET DIAGNOSTICS v_cancel = ROW_COUNT;
  ELSE
    -- Signature of what is sold: sorted list of (channex room type, in, out, units).
    SELECT string_agg(sig, ',' ORDER BY sig) INTO v_new_sig FROM (
      SELECT concat_ws('|', COALESCE(t.id::TEXT, '-'), r->>'checkin_date', r->>'checkout_date') AS sig
      FROM jsonb_array_elements(COALESCE(a->'rooms', '[]'::JSONB)) r
      LEFT JOIN room_types t ON t.property_id = v_prop AND t.channex_room_type_id = r->>'room_type_id'
      CROSS JOIN LATERAL generate_series(1, channel_units_for_room(COALESCE(t.sell_unit, 'room'), r))
    ) s;

    SELECT string_agg(sig, ',' ORDER BY sig) INTO v_old_sig FROM (
      SELECT concat_ws('|', COALESCE(room_type_id::TEXT, '-'), check_in_date::TEXT, check_out_date::TEXT) AS sig
      FROM bookings
      WHERE property_id = v_prop AND channel_booking_id = v_chbk
        AND status IN ('pending', 'confirmed', 'checked_in')
    ) s;

    v_same := v_old_sig IS NOT NULL AND v_old_sig = v_new_sig;

    -- Guest: reuse the one already attached to this OTA booking.
    SELECT guest_id INTO v_guest FROM bookings
    WHERE property_id = v_prop AND channel_booking_id = v_chbk AND guest_id IS NOT NULL
    ORDER BY created_at LIMIT 1;

    IF v_guest IS NULL THEN
      INSERT INTO guests (property_id, first_name, last_name, email, phone, whatsapp, nationality, country_of_residence)
      VALUES (
        v_prop,
        COALESCE(NULLIF(trim(a #>> '{customer,name}'), ''), 'Client'),
        COALESCE(NULLIF(trim(a #>> '{customer,surname}'), ''), initcap(channel_source(a->>'ota_name'))),
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

    IF v_same THEN
      -- Same rooms and dates: refresh price/details, keep bed assignments.
      UPDATE bookings b SET
        total_price = COALESCE(x.unit_amount, b.total_price),
        channel_revision_id = p_revision_id,
        ota_payload = x.room
      FROM (
        SELECT bk.id,
               r AS room,
               ROUND((r->>'amount')::NUMERIC / NULLIF(channel_units_for_room(COALESCE(t.sell_unit, 'room'), r), 0), 2) AS unit_amount
        FROM bookings bk
        JOIN LATERAL jsonb_array_elements(a->'rooms') r ON TRUE
        LEFT JOIN room_types t ON t.property_id = v_prop AND t.channex_room_type_id = r->>'room_type_id'
        WHERE bk.property_id = v_prop AND bk.channel_booking_id = v_chbk
          AND bk.status IN ('pending', 'confirmed', 'checked_in')
          AND bk.room_type_id IS NOT DISTINCT FROM t.id
          AND bk.check_in_date = (r->>'checkin_date')::DATE
          AND bk.check_out_date = (r->>'checkout_date')::DATE
      ) x
      WHERE b.id = x.id;
      GET DIAGNOSTICS v_updated = ROW_COUNT;
    ELSE
      -- Different rooms or dates: replace (staff re-assign beds).
      UPDATE bookings SET status = 'cancelled', channel_revision_id = p_revision_id
      WHERE property_id = v_prop AND channel_booking_id = v_chbk
        AND status IN ('pending', 'confirmed');
      GET DIAGNOSTICS v_cancel = ROW_COUNT;

      FOR v_room IN SELECT * FROM jsonb_array_elements(COALESCE(a->'rooms', '[]'::JSONB))
      LOOP
        v_type := NULL;
        SELECT * INTO v_type FROM room_types
        WHERE property_id = v_prop AND channex_room_type_id = v_room->>'room_type_id';
        v_plan := NULL;
        IF v_type.id IS NOT NULL THEN
          SELECT id INTO v_plan FROM rate_plans
          WHERE room_type_id = v_type.id AND channex_rate_plan_id = v_room->>'rate_plan_id';
        END IF;
        v_units  := channel_units_for_room(COALESCE(v_type.sell_unit, 'room'), v_room);
        v_amount := ROUND(COALESCE((v_room->>'amount')::NUMERIC, 0) / v_units, 2);

        FOR i IN 1..v_units LOOP
          INSERT INTO bookings (
            property_id, guest_id, bed_id, room_type_id, rate_plan_id, reservation_group_id,
            source, external_booking_id, channel_booking_id, channel_revision_id, ota_payload,
            status, check_in_date, check_out_date, adults, total_price, special_requests
          ) VALUES (
            v_prop, v_guest, NULL, v_type.id, v_plan, v_group,
            channel_source(a->>'ota_name'),
            COALESCE(a->>'ota_reservation_code', a->>'unique_id'),
            v_chbk, p_revision_id, v_room,
            'confirmed',
            (v_room->>'checkin_date')::DATE, (v_room->>'checkout_date')::DATE,
            1, v_amount, NULLIF(a->>'notes', '')
          ) RETURNING id INTO v_bk;
          v_created := v_created + 1;

          IF v_type.id IS NULL THEN
            INSERT INTO channel_alerts (property_id, kind, booking_id, message)
            VALUES (v_prop, 'unmapped_room', v_bk,
                    'Réservation ' || COALESCE(a->>'ota_name', 'en ligne') || ' pour un type de chambre non relié : placez-la à la main.');
          END IF;
        END LOOP;
      END LOOP;
    END IF;
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
REVOKE ALL ON FUNCTION trg_bookings_capacity_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON channel_alerts FROM anon;
REVOKE ALL ON SEQUENCE channel_alerts_id_seq FROM anon, authenticated;
