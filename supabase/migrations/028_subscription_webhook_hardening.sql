-- 028_subscription_webhook_hardening.sql
-- Columns needed to make the LemonSqueezy webhook resilient:
--   customer_portal_url — LS-hosted "manage/cancel subscription" URL, surfaced
--     on the billing page so customers can self-serve cancel (a missing cancel
--     button is what turns churn into chargebacks).
--   ls_updated_at — the LS subscription object's own updated_at, used as an
--     ordering/idempotency guard: a retried or out-of-order webhook (LS retries
--     and does not guarantee ordering) must not re-activate a cancelled account.
--
-- Pre-flight: none.

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS customer_portal_url TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS ls_updated_at TIMESTAMPTZ;
