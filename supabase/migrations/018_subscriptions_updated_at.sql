-- Migration 018: add updated_at to subscriptions (needed by LemonSqueezy webhook upsert)
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Allow service-role to upsert subscriptions from webhook
-- (RLS is bypassed by service-role, but add explicit policy for safety)
CREATE POLICY IF NOT EXISTS "Service role can manage subscriptions"
  ON subscriptions FOR ALL
  USING (true)
  WITH CHECK (true);
