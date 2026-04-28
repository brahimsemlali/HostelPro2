-- Composite index for the 90-day payments reconciliation query on /payments
-- and the 7-day revenue chart query on the dashboard.
-- Both filter on property_id + status + type and order/filter by payment_date.
CREATE INDEX IF NOT EXISTS payments_property_status_type_date_idx
  ON payments(property_id, status, type, payment_date DESC);
