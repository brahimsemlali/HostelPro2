-- Tests for 036_room_types_inventory.sql. Run: scripts/local-test/sql/run.sh
-- Everything runs inside BEGIN … ROLLBACK, so the seeded stack is left untouched.
\set ON_ERROR_STOP 1
BEGIN;
SET CONSTRAINTS bookings_room_type_capacity IMMEDIATE;

CREATE TEMP TABLE ctx AS
SELECT p.id AS prop,
       (SELECT id FROM room_types WHERE property_id = p.id AND name = 'Dortoir A') AS dorm,
       (SELECT id FROM room_types WHERE property_id = p.id AND sell_unit = 'room' LIMIT 1) AS priv,
       (SELECT id FROM guests WHERE property_id = p.id LIMIT 1) AS guest
FROM properties p LIMIT 1;

DO $$
DECLARE
  c ctx%ROWTYPE;
  d0 DATE := DATE '2027-03-01';
  v INT; ok BOOLEAN; b1 UUID; b2 UUID; bed_a UUID; bed_b UUID; room1 UUID;
BEGIN
  SELECT * INTO c FROM ctx;

  -- T1 backfill / triggers: every room has a type, every bed-booking has a type + plan
  ASSERT NOT EXISTS (SELECT 1 FROM rooms WHERE room_type_id IS NULL), 'T1 room without type';
  ASSERT NOT EXISTS (SELECT 1 FROM bookings WHERE bed_id IS NOT NULL AND (room_type_id IS NULL OR rate_plan_id IS NULL)), 'T1 booking without type/plan';
  ASSERT (SELECT count(*) FROM rate_plans WHERE is_default) = (SELECT count(*) FROM room_types), 'T1 default plans';

  -- T2 availability on an empty future night = all 4 dorm beds
  SELECT available INTO v FROM room_type_availability(c.dorm, d0, d0 + 1);
  ASSERT v = 4, format('T2 expected 4 got %s', v);

  -- T3 four unassigned dorm bookings fill the pool, the fifth is refused
  FOR i IN 1..4 LOOP
    INSERT INTO bookings (property_id, guest_id, bed_id, room_type_id, source, status, check_in_date, check_out_date, total_price)
    VALUES (c.prop, c.guest, NULL, c.dorm, 'booking_com', 'confirmed', d0, d0 + 2, 100);
  END LOOP;
  SELECT available INTO v FROM room_type_availability(c.dorm, d0, d0 + 1);
  ASSERT v = 0, format('T3 expected 0 got %s', v);
  ok := FALSE;
  BEGIN
    INSERT INTO bookings (property_id, guest_id, bed_id, room_type_id, source, status, check_in_date, check_out_date, total_price)
    VALUES (c.prop, c.guest, NULL, c.dorm, 'hostelworld', 'confirmed', d0 + 1, d0 + 3, 100);
  EXCEPTION WHEN SQLSTATE 'SR409' THEN ok := TRUE;
  END;
  ASSERT ok, 'T3 fifth unassigned booking was not refused';

  -- T4 a walk-in on a specific dorm bed is refused while the pool is full
  SELECT b.id INTO bed_a FROM beds b JOIN rooms r ON r.id = b.room_id WHERE r.room_type_id = c.dorm ORDER BY b.name LIMIT 1;
  ok := FALSE;
  BEGIN
    INSERT INTO bookings (property_id, guest_id, bed_id, source, status, check_in_date, check_out_date, total_price)
    VALUES (c.prop, c.guest, bed_a, 'walkin', 'confirmed', d0, d0 + 1, 100);
  EXCEPTION WHEN SQLSTATE 'SR409' THEN ok := TRUE;
  END;
  ASSERT ok, 'T4 assigned booking over a full pool was not refused';

  -- T5 assigning a bed to an unassigned booking keeps the count; cancelling frees a unit
  SELECT id INTO b1 FROM bookings WHERE room_type_id = c.dorm AND bed_id IS NULL AND check_in_date = d0 LIMIT 1;
  UPDATE bookings SET bed_id = bed_a WHERE id = b1;
  ASSERT (SELECT room_type_id FROM bookings WHERE id = b1) = c.dorm, 'T5 type lost on assignment';
  UPDATE bookings SET status = 'cancelled' WHERE id = b1;
  SELECT available INTO v FROM room_type_availability(c.dorm, d0, d0 + 1);
  ASSERT v = 1, format('T5 expected 1 got %s', v);

  -- T6 clearing the bed keeps the type (swap NULL hop / unassign)
  UPDATE bookings SET status = 'confirmed', bed_id = NULL WHERE id = b1;
  ASSERT (SELECT room_type_id FROM bookings WHERE id = b1) = c.dorm, 'T6 type cleared with bed';

  -- T7 untyped bed-less import (current iCal flow) is accepted and unguarded
  INSERT INTO bookings (property_id, guest_id, bed_id, source, external_booking_id, status, check_in_date, check_out_date, total_price)
  VALUES (c.prop, c.guest, NULL, 'booking_com', 'ICAL-T7', 'confirmed', d0, d0 + 1, 0);

  -- T8 swap RPC across two room types still works
  SELECT b.id INTO bed_b FROM beds b JOIN rooms r ON r.id = b.room_id WHERE r.room_type_id <> c.dorm AND r.room_type_id <> c.priv ORDER BY b.name LIMIT 1;
  INSERT INTO bookings (property_id, guest_id, bed_id, source, status, check_in_date, check_out_date, total_price)
  VALUES (c.prop, c.guest, bed_a, 'walkin', 'confirmed', d0 + 10, d0 + 12, 100) RETURNING id INTO b1;
  INSERT INTO bookings (property_id, guest_id, bed_id, source, status, check_in_date, check_out_date, total_price)
  VALUES (c.prop, c.guest, bed_b, 'walkin', 'confirmed', d0 + 10, d0 + 12, 100) RETURNING id INTO b2;
  PERFORM swap_booking_beds(b1, b2);
  ASSERT (SELECT bed_id FROM bookings WHERE id = b1) = bed_b, 'T8 swap failed';
  ASSERT (SELECT room_type_id FROM bookings WHERE id = b1) <> c.dorm, 'T8 type did not follow bed';
  ASSERT (SELECT room_type_id FROM bookings WHERE id = b2) = c.dorm, 'T8 type did not follow bed (b2)';

  -- T9 private room sold by the room: two beds of one room = one unit
  SELECT r.id INTO room1 FROM rooms r WHERE r.room_type_id = c.priv LIMIT 1;
  INSERT INTO bookings (property_id, guest_id, bed_id, source, status, check_in_date, check_out_date, total_price)
  SELECT c.prop, c.guest, b.id, 'direct', 'confirmed', d0 + 20, d0 + 21, 100 FROM beds b WHERE b.room_id = room1;
  SELECT taken INTO v FROM room_type_availability(c.priv, d0 + 20, d0 + 21);
  ASSERT v = 1, format('T9 expected 1 room taken got %s', v);
  ok := FALSE;
  BEGIN
    INSERT INTO bookings (property_id, guest_id, bed_id, room_type_id, source, status, check_in_date, check_out_date, total_price)
    VALUES (c.prop, c.guest, NULL, c.priv, 'airbnb', 'confirmed', d0 + 20, d0 + 21, 300);
  EXCEPTION WHEN SQLSTATE 'SR409' THEN ok := TRUE;
  END;
  ASSERT ok, 'T9 second sale of the only private room was not refused';

  -- T10 a blocked bed reduces availability, not capacity
  UPDATE beds SET status = 'blocked' WHERE id = bed_a;
  SELECT available INTO v FROM room_type_availability(c.dorm, d0 + 30, d0 + 31);
  ASSERT v = 3, format('T10 expected 3 got %s', v);

  -- T11 a new room gets its own type + default plan; retyping moves bookings and drops the empty type
  INSERT INTO rooms (property_id, name, type) VALUES (c.prop, 'Dortoir T', 'dorm') RETURNING id INTO room1;
  ASSERT (SELECT room_type_id FROM rooms WHERE id = room1) IS NOT NULL, 'T11 no type on insert';
  SELECT room_type_id INTO b2 FROM rooms WHERE id = room1;
  UPDATE rooms SET room_type_id = c.dorm WHERE id = room1;
  ASSERT NOT EXISTS (SELECT 1 FROM room_types WHERE id = b2), 'T11 empty type not removed';

  -- T12 type from another property is refused
  ok := FALSE;
  BEGIN
    INSERT INTO properties (id, name) VALUES ('00000000-0000-0000-0000-0000000000aa', 'Other');
    INSERT INTO bookings (property_id, guest_id, bed_id, room_type_id, source, status, check_in_date, check_out_date, total_price)
    VALUES ('00000000-0000-0000-0000-0000000000aa', NULL, NULL, c.dorm, 'direct', 'confirmed', d0, d0 + 1, 0);
  EXCEPTION WHEN SQLSTATE '42501' THEN ok := TRUE;
  END;
  ASSERT ok, 'T12 cross-tenant room type accepted';

  RAISE NOTICE '036 inventory: all 12 tests passed';
END $$;
ROLLBACK;
