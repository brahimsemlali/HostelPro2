-- Tests for 038_channel_booking_import.sql (inside BEGIN … ROLLBACK).
\set ON_ERROR_STOP 1
BEGIN;
DO $$
DECLARE
  v_prop UUID; v_dorm UUID; v_plan UUID; v_bed UUID; n INT; ok BOOLEAN; res JSONB;
  d0 DATE := channel_today() + 90;
  rev JSONB;
BEGIN
  SELECT id INTO v_prop FROM properties LIMIT 1;
  SELECT id INTO v_dorm FROM room_types WHERE property_id = v_prop AND name = 'Dortoir A';
  SELECT id INTO v_plan FROM rate_plans WHERE room_type_id = v_dorm AND is_default;
  UPDATE room_types SET channex_room_type_id = 'CX-DORM' WHERE id = v_dorm;
  UPDATE rate_plans SET channex_rate_plan_id = 'CX-PLAN' WHERE id = v_plan;
  INSERT INTO channel_connections (property_id, channex_property_id, status) VALUES (v_prop, 'CX-PROP', 'active');

  -- I1 new booking, 2 guests in a dorm → 2 bed-less rows, one group, one guest
  rev := jsonb_build_object('property_id','CX-PROP','booking_id','BK-1','unique_id','BDC-1','ota_reservation_code','111',
    'ota_name','Booking.com','status','new',
    'customer', jsonb_build_object('name','Lea','surname','Martin','mail','lea@example.test','phone','+33600000000','country','FR'),
    'rooms', jsonb_build_array(jsonb_build_object('room_type_id','CX-DORM','rate_plan_id','CX-PLAN',
      'checkin_date', d0::TEXT, 'checkout_date', (d0 + 2)::TEXT, 'amount','480.00',
      'occupancy', jsonb_build_object('adults',2,'children',0))));
  INSERT INTO channel_booking_revisions (revision_id, payload) VALUES ('REV-1', rev);
  res := apply_channel_revision('REV-1');
  SELECT count(*) INTO n FROM bookings WHERE channel_booking_id = 'BK-1' AND status = 'confirmed' AND bed_id IS NULL
    AND room_type_id = v_dorm AND rate_plan_id = v_plan AND total_price = 240 AND source = 'booking_com';
  ASSERT n = 2, format('I1 expected 2 rows got %s (%s)', n, res);
  ASSERT (SELECT count(DISTINCT reservation_group_id) FROM bookings WHERE channel_booking_id = 'BK-1') = 1, 'I1 group';
  ASSERT (SELECT count(DISTINCT guest_id) FROM bookings WHERE channel_booking_id = 'BK-1') = 1, 'I1 one guest';
  ASSERT (SELECT available FROM room_type_availability(v_dorm, d0, d0 + 1)) = 2, 'I1 availability';

  -- I2 idempotent
  res := apply_channel_revision('REV-1');
  ASSERT res->>'skipped' = 'already_processed', 'I2 not idempotent';

  -- I3 modified, same rooms/dates → updated in place, bed assignment kept
  SELECT b.id INTO v_bed FROM beds b JOIN rooms r ON r.id = b.room_id WHERE r.room_type_id = v_dorm ORDER BY b.name LIMIT 1;
  UPDATE bookings SET bed_id = v_bed WHERE id = (SELECT id FROM bookings WHERE channel_booking_id = 'BK-1' ORDER BY id LIMIT 1);
  INSERT INTO channel_booking_revisions (revision_id, payload)
  VALUES ('REV-2', jsonb_set(jsonb_set(rev, '{status}', '"modified"'), '{rooms,0,amount}', '"500.00"'));
  PERFORM apply_channel_revision('REV-2');
  ASSERT (SELECT count(*) FROM bookings WHERE channel_booking_id = 'BK-1' AND status = 'confirmed' AND total_price = 250) = 2, 'I3 price not updated';
  ASSERT EXISTS (SELECT 1 FROM bookings WHERE channel_booking_id = 'BK-1' AND bed_id = v_bed AND status = 'confirmed'), 'I3 bed lost';

  -- I4 modified, new dates → the same rows move (no duplicates), the free bed stays
  INSERT INTO channel_booking_revisions (revision_id, payload)
  VALUES ('REV-3', jsonb_set(jsonb_set(jsonb_set(rev, '{status}', '"modified"'),
    '{rooms,0,checkin_date}', to_jsonb((d0 + 1)::TEXT)), '{rooms,0,checkout_date}', to_jsonb((d0 + 3)::TEXT)));
  PERFORM apply_channel_revision('REV-3');
  ASSERT (SELECT count(*) FROM bookings WHERE channel_booking_id = 'BK-1') = 2, 'I4 duplicated rows';
  ASSERT (SELECT count(*) FROM bookings WHERE channel_booking_id = 'BK-1' AND status = 'confirmed' AND check_in_date = d0 + 1) = 2, 'I4 dates not moved';
  ASSERT EXISTS (SELECT 1 FROM bookings WHERE channel_booking_id = 'BK-1' AND bed_id = v_bed), 'I4 bed lost';

  -- I4b the guest is in the house and extends by a night on the OTA: same row, still checked in
  UPDATE bookings SET status = 'checked_in' WHERE channel_booking_id = 'BK-1' AND bed_id = v_bed;
  INSERT INTO channel_booking_revisions (revision_id, payload)
  VALUES ('REV-3b', jsonb_set(jsonb_set(jsonb_set(rev, '{status}', '"modified"'),
    '{rooms,0,checkin_date}', to_jsonb((d0 + 1)::TEXT)), '{rooms,0,checkout_date}', to_jsonb((d0 + 4)::TEXT)));
  PERFORM apply_channel_revision('REV-3b');
  ASSERT (SELECT count(*) FROM bookings WHERE channel_booking_id = 'BK-1') = 2, 'I4b duplicated rows';
  ASSERT EXISTS (SELECT 1 FROM bookings WHERE channel_booking_id = 'BK-1' AND bed_id = v_bed
                 AND status = 'checked_in' AND check_out_date = d0 + 4), 'I4b checked-in row not extended';
  UPDATE bookings SET status = 'confirmed' WHERE channel_booking_id = 'BK-1' AND status = 'checked_in';

  -- I4c the bed is taken on the new dates → booking kept, bed freed (no import failure)
  INSERT INTO bookings (property_id, bed_id, source, status, check_in_date, check_out_date, total_price)
  VALUES (v_prop, v_bed, 'walkin', 'confirmed', d0 + 6, d0 + 7, 0);
  INSERT INTO channel_booking_revisions (revision_id, payload)
  VALUES ('REV-3c', jsonb_set(jsonb_set(jsonb_set(rev, '{status}', '"modified"'),
    '{rooms,0,checkin_date}', to_jsonb((d0 + 5)::TEXT)), '{rooms,0,checkout_date}', to_jsonb((d0 + 7)::TEXT)));
  PERFORM apply_channel_revision('REV-3c');
  ASSERT (SELECT count(*) FROM bookings WHERE channel_booking_id = 'BK-1' AND status = 'confirmed' AND check_in_date = d0 + 5 AND bed_id IS NULL) = 2,
    'I4c bed not freed on conflict';
  DELETE FROM bookings WHERE source = 'walkin' AND bed_id = v_bed AND check_in_date = d0 + 6;
  -- back to the I5 dates
  INSERT INTO channel_booking_revisions (revision_id, payload)
  VALUES ('REV-3d', jsonb_set(jsonb_set(jsonb_set(rev, '{status}', '"modified"'),
    '{rooms,0,checkin_date}', to_jsonb((d0 + 1)::TEXT)), '{rooms,0,checkout_date}', to_jsonb((d0 + 3)::TEXT)));
  PERFORM apply_channel_revision('REV-3d');

  -- I5 overbooking from a channel is RECORDED with an alert, never refused
  INSERT INTO bookings (property_id, room_type_id, source, status, check_in_date, check_out_date, total_price)
  SELECT v_prop, v_dorm, 'direct', 'confirmed', d0 + 1, d0 + 2, 0 FROM generate_series(1, 2);   -- pool now full that night
  INSERT INTO channel_booking_revisions (revision_id, payload)
  VALUES ('REV-4', jsonb_set(jsonb_set(jsonb_set(rev, '{booking_id}', '"BK-2"'),
    '{rooms,0,checkin_date}', to_jsonb((d0 + 1)::TEXT)), '{rooms,0,checkout_date}', to_jsonb((d0 + 2)::TEXT)));
  PERFORM apply_channel_revision('REV-4');
  ASSERT (SELECT count(*) FROM bookings WHERE channel_booking_id = 'BK-2' AND status = 'confirmed') = 2, 'I5 overbooking refused';
  ASSERT EXISTS (SELECT 1 FROM channel_alerts WHERE kind = 'overbooking' AND room_type_id = v_dorm AND night = d0 + 1), 'I5 no alert';

  -- I6 the bypass does not leak: a staff walk-in in the same transaction is still refused
  SET CONSTRAINTS bookings_room_type_capacity IMMEDIATE;
  ok := FALSE;
  BEGIN
    INSERT INTO bookings (property_id, room_type_id, source, status, check_in_date, check_out_date, total_price)
    VALUES (v_prop, v_dorm, 'walkin', 'confirmed', d0 + 1, d0 + 2, 0);
  EXCEPTION WHEN SQLSTATE 'SR409' THEN ok := TRUE;
  END;
  ASSERT ok, 'I6 bypass leaked outside the import';

  -- I7 cancellation: arrivals cancelled, a checked-in guest kept and flagged
  UPDATE bookings SET status = 'checked_in'
  WHERE id = (SELECT id FROM bookings WHERE channel_booking_id = 'BK-1' AND status = 'confirmed' ORDER BY id LIMIT 1);
  INSERT INTO channel_booking_revisions (revision_id, payload) VALUES ('REV-5', jsonb_set(rev, '{status}', '"cancelled"'));
  PERFORM apply_channel_revision('REV-5');
  ASSERT NOT EXISTS (SELECT 1 FROM bookings WHERE channel_booking_id = 'BK-1' AND status = 'confirmed'), 'I7 not cancelled';
  ASSERT EXISTS (SELECT 1 FROM bookings WHERE channel_booking_id = 'BK-1' AND status = 'checked_in'), 'I7 checked-in guest cancelled';
  ASSERT EXISTS (SELECT 1 FROM channel_alerts a JOIN bookings b ON b.id = a.booking_id
                 WHERE b.channel_booking_id = 'BK-1' AND a.kind = 'sync_error'), 'I7 checked-in guest not flagged';

  -- I8 unmapped room type → recorded untyped + alert
  INSERT INTO channel_booking_revisions (revision_id, payload)
  VALUES ('REV-6', jsonb_set(jsonb_set(rev, '{booking_id}', '"BK-3"'), '{rooms,0,room_type_id}', '"CX-UNKNOWN"'));
  PERFORM apply_channel_revision('REV-6');
  ASSERT EXISTS (SELECT 1 FROM bookings WHERE channel_booking_id = 'BK-3' AND room_type_id IS NULL AND status = 'confirmed'), 'I8 not recorded';
  ASSERT EXISTS (SELECT 1 FROM channel_alerts WHERE kind = 'unmapped_room'), 'I8 no alert';

  -- I9 unknown Channex property is an error (revision stays unprocessed for retry)
  INSERT INTO channel_booking_revisions (revision_id, payload) VALUES ('REV-7', jsonb_set(rev, '{property_id}', '"CX-OTHER"'));
  ok := FALSE;
  BEGIN PERFORM apply_channel_revision('REV-7'); EXCEPTION WHEN OTHERS THEN ok := SQLERRM LIKE 'unknown_channex_property%'; END;
  ASSERT ok, 'I9 unknown property accepted';

  -- I10 commission: the OTA figure when sent (36/240 = 15 %), else defaults
  ASSERT (SELECT commission_rate FROM bookings WHERE channel_booking_id = 'BK-2' LIMIT 1) = 15, 'I10 booking.com default';
  INSERT INTO channel_booking_revisions (revision_id, payload)
  VALUES ('REV-8', jsonb_set(jsonb_set(jsonb_set(jsonb_set(rev, '{booking_id}', '"BK-4"'), '{ota_name}', '"Hostelworld"'),
    '{amount}', '"200.00"'), '{ota_commission}', '"30.00"'));
  PERFORM apply_channel_revision('REV-8');
  ASSERT (SELECT bool_and(commission_rate = 15 AND source = 'hostelworld') FROM bookings WHERE channel_booking_id = 'BK-4'), 'I10 OTA commission not used';

  RAISE NOTICE '038 channel import: all 13 tests passed';
END $$;
ROLLBACK;
