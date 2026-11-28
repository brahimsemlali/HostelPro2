-- 039_channel_worker.sql — server-side helpers for the channel sync worker (requires 036–038).
-- All service-role only: the worker route (/api/channel/worker) calls them.

-- Claim pending queue slices with a 2-minute lease, so two overlapping worker
-- runs never push the same slice twice (FOR UPDATE SKIP LOCKED).
CREATE OR REPLACE FUNCTION channel_claim_queue(p_limit INT DEFAULT 500)
RETURNS SETOF channel_ari_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE channel_ari_queue q
  SET next_attempt_at = NOW() + INTERVAL '2 minutes'
  WHERE q.id IN (
    SELECT id FROM channel_ari_queue
    WHERE processed_at IS NULL AND next_attempt_at <= NOW()
    ORDER BY id
    LIMIT GREATEST(1, LEAST(p_limit, 2000))
    FOR UPDATE SKIP LOCKED
  )
  RETURNING q.*;
END;
$$;

-- Effective rate + restrictions per night for a room type's default plan:
-- calendar override, else the type's default rate, else today's average bed
-- price (dorm) or the room's beds together (private).
CREATE OR REPLACE FUNCTION channel_rate_nights(p_room_type_id UUID, p_from DATE, p_to DATE)
RETURNS TABLE (
  night DATE, rate NUMERIC, min_stay_arrival INT, min_stay_through INT, max_stay INT,
  closed_to_arrival BOOLEAN, closed_to_departure BOOLEAN, stop_sell BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH t AS (
    SELECT rt.id, rt.sell_unit, rt.default_rate,
           (SELECT p.id FROM rate_plans p WHERE p.room_type_id = rt.id AND p.is_default) AS plan_id
    FROM room_types rt WHERE rt.id = p_room_type_id
  ),
  fallback AS (
    SELECT CASE WHEN t.sell_unit = 'room'
      THEN (SELECT ROUND(SUM(b.base_price) / NULLIF(COUNT(DISTINCT b.room_id), 0), 2)
            FROM beds b JOIN rooms ro ON ro.id = b.room_id WHERE ro.room_type_id = t.id)
      ELSE (SELECT ROUND(AVG(b.base_price), 2)
            FROM beds b JOIN rooms ro ON ro.id = b.room_id WHERE ro.room_type_id = t.id)
    END AS rate
    FROM t
  )
  SELECT d::DATE,
         COALESCE(c.rate, t.default_rate, f.rate),
         c.min_stay_arrival, c.min_stay_through, c.max_stay,
         COALESCE(c.closed_to_arrival, FALSE), COALESCE(c.closed_to_departure, FALSE), COALESCE(c.stop_sell, FALSE)
  FROM t CROSS JOIN fallback f
  CROSS JOIN generate_series(p_from, p_to - 1, INTERVAL '1 day') d
  LEFT JOIN rate_calendar c ON c.rate_plan_id = t.plan_id AND c.date = d::DATE
  ORDER BY 1;
$$;

-- Full sync when a property connects (or after a mapping change): queue the
-- whole horizon once. Channex allows at most one full sync per 24 h and fails
-- certification for timed full syncs, so this is never scheduled.
CREATE OR REPLACE FUNCTION channel_enqueue_full(p_property_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n INT := 0;
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM room_types WHERE property_id = p_property_id AND channex_room_type_id IS NOT NULL
  LOOP
    PERFORM channel_enqueue(p_property_id, r.id, 'availability', channel_today(), channel_today() + channel_horizon_days(), 'full_sync');
    PERFORM channel_enqueue(p_property_id, r.id, 'rates',        channel_today(), channel_today() + channel_horizon_days(), 'full_sync');
    n := n + 1;
  END LOOP;
  UPDATE channel_connections SET last_full_sync_at = NOW() WHERE property_id = p_property_id;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION channel_claim_queue(INT)             FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION channel_rate_nights(UUID, DATE, DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION channel_enqueue_full(UUID)            FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION channel_claim_queue(INT), channel_rate_nights(UUID, DATE, DATE),
  channel_enqueue_full(UUID) TO service_role;
