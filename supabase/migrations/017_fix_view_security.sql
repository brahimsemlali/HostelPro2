-- Fix SECURITY DEFINER on views — recreate with SECURITY INVOKER
-- so views respect RLS policies of the querying user, not the view creator.

DROP VIEW IF EXISTS public.current_occupancy;

CREATE VIEW public.current_occupancy
WITH (security_invoker = true)
AS
SELECT
  b.id           AS bed_id,
  b.name         AS bed_name,
  b.status,
  r.id           AS room_id,
  r.name         AS room_name,
  r.type         AS room_type,
  bk.id          AS booking_id,
  bk.check_in_date,
  bk.check_out_date,
  g.id           AS guest_id,
  g.first_name || ' ' || g.last_name AS guest_name,
  g.nationality,
  g.phone,
  b.property_id
FROM beds b
LEFT JOIN rooms r  ON b.room_id = r.id
LEFT JOIN bookings bk ON bk.bed_id = b.id
  AND bk.status = 'checked_in'
  AND bk.check_out_date > CURRENT_DATE
LEFT JOIN guests g ON bk.guest_id = g.id;


DROP VIEW IF EXISTS public.daily_revenue;

CREATE VIEW public.daily_revenue
WITH (security_invoker = true)
AS
SELECT
  DATE(payment_date)                                                        AS day,
  property_id,
  SUM(CASE WHEN type IN ('payment', 'deposit') THEN amount ELSE 0 END)     AS revenue,
  SUM(CASE WHEN method = 'cash'     THEN amount ELSE 0 END)                AS cash,
  SUM(CASE WHEN method = 'virement' THEN amount ELSE 0 END)                AS virement,
  SUM(CASE WHEN method = 'cmi'      THEN amount ELSE 0 END)                AS cmi,
  COUNT(*)                                                                  AS transactions
FROM payments
WHERE status = 'completed'
GROUP BY DATE(payment_date), property_id;
