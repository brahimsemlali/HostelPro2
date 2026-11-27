-- 035_staff_subscription_gate.sql — staff accounts were locked out.
--
-- Bug: the only SELECT policy on `subscriptions` (015) is owner-only. For a
-- staff member (manager / receptionist / housekeeping) getUserSession() reads
-- no row, isSubscriptionBlocked(null) returns true, and the dashboard layout
-- redirects every staff page to /settings/billing ("Abonnement suspendu"),
-- even when the property's subscription is active.
--
-- Fix: a narrow SECURITY DEFINER read instead of a staff RLS policy. The table
-- also holds ls_subscription_id / customer_portal_url (the LemonSqueezy portal
-- link can cancel the plan), which staff must not see. This returns only the
-- three fields the access gate needs, and only for a property the caller owns
-- or actively works at.
--
-- Safe to apply at any time; the app falls back to the old behaviour without it.

CREATE OR REPLACE FUNCTION subscription_gate(p_property_id UUID)
RETURNS TABLE (status TEXT, current_period_end TIMESTAMPTZ, provider TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT s.status, s.current_period_end, s.provider
  FROM subscriptions s
  WHERE s.property_id = p_property_id
    AND (
      EXISTS (SELECT 1 FROM properties p WHERE p.id = p_property_id AND p.owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM staff st WHERE st.property_id = p_property_id AND st.user_id = auth.uid() AND st.is_active = TRUE)
    );
$$;

REVOKE ALL ON FUNCTION subscription_gate(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION subscription_gate(UUID) TO authenticated;
