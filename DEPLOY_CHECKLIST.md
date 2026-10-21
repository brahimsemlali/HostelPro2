# Audit remediation: deploy checklist

Branch: `fix/audit-remediation`, built on `fix/mobile-and-correctness-audit` (f20f6da).
None of the SQL below has been run against production. Do these steps in order.

## 1. Do today (no deploy needed)

- [ ] **Rotate `LEMONSQUEEZY_WEBHOOK_SECRET`.** The old value is committed in git history on `master`. Generate a new alphanumeric-only secret, then set it in both LemonSqueezy (Settings → Webhooks) and Vercel (Production and Preview). Redeploy.
- [ ] **Set `SUPERADMIN_USER_IDS` in Vercel.** It's a comma-separated list of auth user UUIDs. Once it's set, the email list is no longer used to grant admin rights.
- [ ] **Check what production actually has.** Run these in the Supabase SQL editor:
  ```sql
  SELECT tablename, policyname, qual FROM pg_policies WHERE schemaname = 'public' ORDER BY 1, 2;
  SELECT indexname FROM pg_indexes WHERE schemaname = 'public' ORDER BY 1;
  SELECT column_name FROM information_schema.columns WHERE table_name = 'subscriptions';
  SELECT proname FROM pg_proc WHERE proname IN ('get_my_role_rank', 'swap_booking_beds', 'create_property_with_setup');
  ```
  This tells you which of 023, 026 and 028 are already live. CLAUDE.md contradicts itself on this.

## 2. Apply migrations, in order

Each file has pre-flight queries at the top. Run those first.

| Migration | What it fixes |
|---|---|
| `023_scale_hardening.sql` | Indexes, a unique night audit per day, `swap_booking_beds` (bed swap fails without it) |
| `026_role_aware_staff_rls.sql` | Housekeeping can no longer read or write payments and guest personal data **(critical)** |
| `028_subscription_webhook_hardening.sql` | Webhook ordering and the customer portal URL (the code now also works without it) |
| `029_security_fixes_safe.sql` | Blocks the trial self-grant through the onboarding RPC **(critical)** |
| `030_role_gate_extras_beds.sql` | Housekeeping writes to extras, activities and beds |

## 3. Deploy the code

Merge `fix/audit-remediation`. The landing redesign (`feat/landing-redesign`) also edits `proxy.ts`. The matcher change is identical in both branches, so a merge conflict there should be trivial.

## 4. Then apply `031_secrets_guest_scope_amount_checks.sql`

It requires 026. After it is applied:

- [ ] Send a test WhatsApp message to confirm the token is read from `property_secrets`.
- [ ] Run the "Step 2" block at the bottom of 031 to clear `properties.whatsapp_access_token`.
- [ ] Once pre-flight a) and b) return no rows, run the `VALIDATE CONSTRAINT` statements.

## 5. Decisions still open (no code written)

- **Paywall at the database level.** Adding `has_active_subscription` to the RLS write policies would lock out any tenant without a subscription row. Audit `subscriptions` coverage first.
- **Plan limits.** Starter's "45 beds" limit isn't enforced anywhere. Decide what happens to existing Starter accounts that are over the limit, and which plan a trial counts as.
- **Expiry for `manual_wire` subscriptions.** `active` currently ignores `current_period_end`. Enforcing it is the bank-wire customer's renewal path.
- **Refunds.** `order_refunded` and `subscription_payment_refunded` aren't handled. Confirm whether LemonSqueezy cancels the subscription automatically on refund.
- **Housekeeping and guest columns.** Migration 031 limits housekeeping to today's guests (rows only). Hiding passport columns entirely needs a separate table or view.
- **Platform WhatsApp fallback.** If `WHATSAPP_API_TOKEN` is set, tenants who haven't added their own credentials send through the platform number.
- **Compliance.**
  - Privacy policy and terms pages.
  - An information notice on the public pre-check-in form (law 09-08, Art. 5).
  - A data-retention period and a purge job.
  - CNDP declaration and transfer authorisation (Vercel `lhr1` London; Supabase region to be checked).
- **Rate limiting.** It's held in memory per serverless instance. Move it to Upstash or Vercel KV.
