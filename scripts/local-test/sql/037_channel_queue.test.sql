-- Tests for 037_channel_sync_queue.sql (inside BEGIN … ROLLBACK).
\set ON_ERROR_STOP 1
BEGIN;
SET CONSTRAINTS bookings_room_type_capacity IMMEDIATE;
DO $$
DECLARE
  v_prop UUID; v_dorm UUID; v_bed UUID; v_plan UUID; b UUID; n INT;
  d0 DATE := channel_today() + 40;
BEGIN
  SELECT id INTO v_prop FROM properties LIMIT 1;
  SELECT id INTO v_dorm FROM room_types WHERE property_id = v_prop AND name = 'Dortoir A';
  SELECT b2.id INTO v_bed FROM beds b2 JOIN rooms r ON r.id = b2.room_id WHERE r.room_type_id = v_dorm LIMIT 1;
  SELECT id INTO v_plan FROM rate_plans WHERE room_type_id = v_dorm AND is_default;

  -- Q1 inert: no connection → nothing queued
  INSERT INTO bookings (property_id, bed_id, source, status, check_in_date, check_out_date, total_price)
  VALUES (v_prop, v_bed, 'walkin', 'confirmed', d0, d0 + 2, 100) RETURNING id INTO b;
  ASSERT (SELECT count(*) FROM channel_ari_queue) = 0, 'Q1 queued without connection';

  -- Q2 pending connection still inert
  INSERT INTO channel_connections (property_id, status) VALUES (v_prop, 'pending');
  UPDATE bookings SET check_out_date = d0 + 3 WHERE id = b;
  ASSERT (SELECT count(*) FROM channel_ari_queue) = 0, 'Q2 queued while pending';

  -- Q3 active: a date change queues old + new slices
  UPDATE channel_connections SET status = 'active' WHERE property_id = v_prop;
  UPDATE bookings SET check_in_date = d0 + 1 WHERE id = b;
  SELECT count(*) INTO n FROM channel_ari_queue WHERE kind = 'availability' AND room_type_id = v_dorm;
  ASSERT n = 2, format('Q3 expected 2 slices got %s', n);

  -- Q4 cleaning a bed does NOT queue; blocking it does
  DELETE FROM channel_ari_queue;
  UPDATE beds SET status = 'dirty' WHERE id = v_bed;
  ASSERT (SELECT count(*) FROM channel_ari_queue) = 0, 'Q4 dirty queued';
  UPDATE beds SET status = 'blocked' WHERE id = v_bed;
  ASSERT (SELECT count(*) FROM channel_ari_queue) = 1, 'Q4 blocked not queued';

  -- Q5 past dates are clipped to today; a booking fully in the past queues nothing
  DELETE FROM channel_ari_queue;
  INSERT INTO bookings (property_id, room_type_id, source, status, check_in_date, check_out_date, total_price)
  VALUES (v_prop, v_dorm, 'direct', 'confirmed', channel_today() - 5, channel_today() - 2, 0);
  ASSERT (SELECT count(*) FROM channel_ari_queue) = 0, 'Q5 past booking queued';

  -- Q6 rates: calendar row and default rate both queue a 'rates' slice
  INSERT INTO rate_calendar (rate_plan_id, property_id, date, rate) VALUES (v_plan, v_prop, d0, 150);
  UPDATE room_types SET default_rate = 130 WHERE id = v_dorm;
  ASSERT (SELECT count(*) FROM channel_ari_queue WHERE kind = 'rates') = 2, 'Q6 rates not queued';

  -- Q7 cancelling queues the freed nights
  DELETE FROM channel_ari_queue;
  UPDATE bookings SET status = 'cancelled' WHERE id = b;
  ASSERT (SELECT count(*) FROM channel_ari_queue) = 1, 'Q7 cancellation not queued';

  -- Q8 deleting a room of a MAPPED type queues the lower availability
  UPDATE room_types SET channex_room_type_id = 'CX-Q8' WHERE id = v_dorm;
  INSERT INTO rooms (property_id, name, type, room_type_id) VALUES (v_prop, 'Dortoir Q8', 'dorm', v_dorm);
  INSERT INTO beds (property_id, room_id, name, base_price) SELECT v_prop, id, 'Q8-1', 100 FROM rooms WHERE name = 'Dortoir Q8';
  DELETE FROM channel_ari_queue;
  DELETE FROM rooms WHERE name = 'Dortoir Q8';
  ASSERT EXISTS (SELECT 1 FROM channel_ari_queue WHERE room_type_id = v_dorm AND reason = 'room:delete'), 'Q8 room delete not queued';

  RAISE NOTICE '037 channel queue: all 8 tests passed';
END $$;
ROLLBACK;
