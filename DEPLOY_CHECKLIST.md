# Launch checklist

Last verified 2026-10-22 against production (public API probes + LemonSqueezy API with the local key).

## Database: what production has

| Migration | State |
|---|---|
| 001–010, 012–028, 031 | ✅ Live (every column they add exists) |
| 024 | ✅ Live (`staff_invitations` dropped) |
| 011 | ❌ Not applied: `properties.whatsapp_*` columns don't exist. The code no longer needs them (the token lives in `property_secrets`). Don't apply it. |
| 029 | ❓ Can't be detected from the API. Check with the SQL below. **This is the trial self-grant fix: critical.** |
| 030 | ❓ Can't be detected from the API. Check with the SQL below. |
| 032 | ⏳ New. Locks `recompute_guest_totals`, which anonymous visitors can currently call. Safe to apply at any time. |

```sql
-- 029 is applied if has_active_subscription shows a search_path in proconfig
-- and create_property_with_setup shows trial_fixed = true
SELECT proname, proconfig, prosrc LIKE '%14 days%' AS trial_fixed
FROM pg_proc WHERE proname IN ('has_active_subscription', 'create_property_with_setup');

-- 030 is applied if this returns a row instead of an error
SELECT 'enforce_housekeeping_bed_columns'::regproc;
```

After 031: once the pre-flight queries in it return no rows, run its `VALIDATE CONSTRAINT` lines.

## Superadmin console (/admin)

- [ ] Apply `033_admin_console.sql`. Until you do, the console shows a notice and these are disabled: payments ledger, encaisser, notes, suspension, audit log and the usage columns.
- [ ] Set `SUPERADMIN_USER_IDS=11ecbf1b-c0f9-4d85-8243-c94af7e38c60` in Vercel (Production), then redeploy. Without it, these stay greyed out: the password link, log in as owner, the data export and delete.
- Suspension only blocks the dashboard pages. An already-open tab can still call API routes and server actions, or write to Supabase directly, until its session ends.
- MRR counts every active contract, including gifted months and manually set end dates. "Encaissé" counts only real payments.

## Billing: bank transfer and cash (current mode)

Card checkout is **off**. The billing page's plan buttons open WhatsApp with a prefilled request (plan, price, 8-character account reference), and `/api/billing/checkout` returns 503.

When a customer pays:
1. Open `/admin`, find the property, and use search the reference from the WhatsApp message, then click **+1 / +6 / +12 mois**. This sets `status = active`, `provider = manual_wire` and moves `current_period_end` forward.
2. Access stops 7 days (`GRACE_DAYS`) after `current_period_end` unless you extend again. The billing page shows the account as expired from the end date onward.

To turn on card payments later:
- [ ] Finish LemonSqueezy store activation (it likely requires privacy, terms and refund pages).
- [ ] Put the **live** API key in Vercel and create a **live-mode** webhook to `https://www.sweetreservation.com/api/webhooks/lemonsqueezy` with the `LEMONSQUEEZY_WEBHOOK_SECRET` secret.
- [ ] Remove the trials on both LemonSqueezy variants (the in-app trial is 14 days).
- [ ] Set `NEXT_PUBLIC_CARD_PAYMENTS_ENABLED=true` in Vercel and redeploy.
- Production ignores test-mode webhooks unless `LEMONSQUEEZY_ALLOW_TEST_MODE=true`.

## Must have before launch

- [ ] **Custom SMTP in Supabase** (Auth → SMTP). Without it, password-reset emails don't reach customers. Email confirmation is currently off (`autoconfirm`); turn it on only after SMTP works.
- [ ] **Privacy policy, terms (CGU/CGV) and refund policy pages.** The app stores passport data (law 09-08). Also add an information notice on the public pre-check-in form and file the CNDP declaration.
- [ ] **Sentry.** Set `NEXT_PUBLIC_SENTRY_DSN` in Vercel. Production errors are currently invisible.
- [ ] **Supabase plan.** Make sure you're on a plan with daily backups. You store guest ID documents.
- [ ] Set `SUPERADMIN_USER_IDS` in Vercel.

## Product gaps to decide

- **Fiche de police fields.** Missing: place of birth, passport issue date and place, date and point of entry into Morocco, and "coming from". Check them against your préfecture's form.
- **Receipt and invoice.** The PDF is now titled "REÇU". A legal facture needs the property's ICE and sequential numbering.
- **PDF fonts.** Names with characters outside Latin-1 (ł, ş, Arabic) print garbled. Fixing it means embedding a Unicode font.
- **Plan limits.** Starter's "45 beds / 1 staff account" isn't enforced.
- **Multi-property.** It's promised for Enterprise, but onboarding blocks a second property.
- Earlier open items: DB-level paywall, manual_wire expiry, refund events, the housekeeping column split, the platform WhatsApp fallback, and rate limiting in Upstash.
