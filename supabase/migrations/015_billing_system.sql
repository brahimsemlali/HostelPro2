-- ============================================================
-- Migration 015: SaaS Billing & Subscriptions
-- ============================================================

-- Subscription Status Enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
        CREATE TYPE subscription_status AS ENUM ('active', 'past_due', 'trialing', 'expired', 'cancelled');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'billing_provider') THEN
        CREATE TYPE billing_provider AS ENUM ('lemonsqueezy', 'manual_wire', 'free_trial');
    END IF;
END $$;

-- Subscriptions Table
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    status subscription_status NOT NULL DEFAULT 'trialing',
    provider billing_provider NOT NULL DEFAULT 'free_trial',
    
    -- LemonSqueezy specifics
    ls_subscription_id TEXT UNIQUE,
    ls_customer_id TEXT,
    ls_variant_id TEXT,
    
    -- Dates
    current_period_end TIMESTAMPTZ NOT NULL,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(property_id)
);

-- RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their own subscription"
    ON subscriptions FOR SELECT
    USING (property_id IN (SELECT id FROM properties WHERE owner_id = auth.uid()));

-- Security Function to check access
CREATE OR REPLACE FUNCTION has_active_subscription(target_property_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM subscriptions
        WHERE property_id = target_property_id
        AND status IN ('active', 'trialing')
        AND current_period_end > now()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
