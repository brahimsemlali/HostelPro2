-- Migration 020: drop the insecure "token_read" policy on staff_invitations.
--
-- The policy from 003_staff_auth.sql allowed ANY holder of the public anon key
-- to SELECT every pending invitation (token, email, name, role, property_id)
-- across all tenants:
--
--   CREATE POLICY "token_read" ON staff_invitations FOR SELECT USING (
--     accepted_at IS NULL AND expires_at > NOW()
--   );
--
-- With a stolen token, an attacker could accept the invite and join any
-- property as staff. The accept-invite page and API now use the service-role
-- client, so this policy is no longer needed by any flow.

DROP POLICY IF EXISTS "token_read" ON staff_invitations;
