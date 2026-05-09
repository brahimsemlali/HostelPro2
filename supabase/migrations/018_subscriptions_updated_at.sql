-- Migration 018: add updated_at to subscriptions (needed by LemonSqueezy webhook upsert)
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
