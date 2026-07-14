-- ============================================================
-- 020 — Allow NULL current_period_end on subscriptions
-- ============================================================
-- The LemonSqueezy webhook (app/api/webhooks/lemonsqueezy/route.ts)
-- intentionally writes NULL when the LS payload carries neither
-- renews_at nor ends_at ("don't fabricate"). Migration 015 declared
-- the column NOT NULL, so that upsert fails with a constraint
-- violation and the webhook returns 500 — LemonSqueezy retries then
-- gives up, leaving the local subscription state stale (a paying
-- customer can stay blocked, or a cancelled one keep access).
--
-- Everything that reads this column already handles NULL:
-- lib/billing.isSubscriptionBlocked(), getUserSession()
-- (subscriptionPeriodEnd: string | null) and the admin UI.

ALTER TABLE subscriptions ALTER COLUMN current_period_end DROP NOT NULL;