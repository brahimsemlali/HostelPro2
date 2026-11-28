#!/bin/zsh
# Two transactions race for the LAST dorm bed on the same night (deferred guard
# + advisory lock). Exactly one must commit. Cleans up after itself.
set -uo pipefail
PSQL=(docker exec -i supabase_db_hostelpro-test psql -U postgres -d postgres -qAt -v ON_ERROR_STOP=1)
NIGHT=2027-06-01
"${PSQL[@]}" <<SQL
DELETE FROM bookings WHERE external_booking_id LIKE 'RACE-%';
INSERT INTO bookings (property_id, room_type_id, source, external_booking_id, status, check_in_date, check_out_date, total_price)
SELECT t.property_id, t.id, 'booking_com', 'RACE-fill-' || g, 'confirmed', DATE '$NIGHT', DATE '$NIGHT' + 1, 0
FROM room_types t, generate_series(1, 3) g WHERE t.name = 'Dortoir A';
SQL
racer() {
  "${PSQL[@]}" <<SQL 2>&1
BEGIN;
INSERT INTO bookings (property_id, room_type_id, source, external_booking_id, status, check_in_date, check_out_date, total_price)
SELECT property_id, id, 'hostelworld', 'RACE-$1', 'confirmed', DATE '$NIGHT', DATE '$NIGHT' + 1, 0
FROM room_types WHERE name = 'Dortoir A';
SELECT pg_sleep(1);
COMMIT;
SQL
}
A=$(mktemp); B=$(mktemp)
racer a > $A & racer b > $B & wait
won=$("${PSQL[@]}" -c "SELECT count(*) FROM bookings WHERE external_booking_id IN ('RACE-a','RACE-b')")
full=$(grep -l ROOM_TYPE_FULL $A $B | wc -l | tr -d ' ')
"${PSQL[@]}" -c "DELETE FROM bookings WHERE external_booking_id LIKE 'RACE-%'" >/dev/null
rm -f $A $B
if [[ $won == 1 && $full == 1 ]]; then echo "── race: one winner, one ROOM_TYPE_FULL — passed"; else echo "── race FAILED (committed=$won refused=$full)"; exit 1; fi
