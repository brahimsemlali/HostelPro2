# Launch checklist

Last verified 2026-10-22 against production (public API probes + LemonSqueezy API with the local key). Migrations 033–035 re-probed on 2026-11-27.

## Database: what production has

| Migration | State |
|---|---|
| 001–010, 012–028, 031 | ✅ Live (every column they add exists) |
| 024 | ✅ Live (`staff_invitations` dropped) |
| 011 | ❌ Not applied: `properties.whatsapp_*` columns don't exist. The code no longer needs them (the token lives in `property_secrets`). Don't apply it. |
| 029 | ❓ Can't be detected from the API. Check with the SQL below. **This is the trial self-grant fix: critical.** |
| 030 | ❓ Can't be detected from the API. Check with the SQL below. |
| 032 | ⏳ New. Locks `recompute_guest_totals`, which anonymous visitors can currently call. Safe to apply at any time. (Not probed: calling it anonymously would run it.) |
| 033 | ✅ Live (2026-11-27 probe: `tenant_admin` / `platform_payments` exist and refuse anon) |
| 034 | ✅ Applied by the owner on 2026-11-27 (tables + `issue_invoice` / `issue_credit_note` exist, anon refused) |
| 035 | ✅ Applied by the owner on 2026-11-27 (`subscription_gate` exists, anon refused) |

```sql
-- 029 is applied if has_active_subscription shows a search_path in proconfig
-- and create_property_with_setup shows trial_fixed = true
SELECT proname, proconfig, prosrc LIKE '%14 days%' AS trial_fixed
FROM pg_proc WHERE proname IN ('has_active_subscription', 'create_property_with_setup');

-- 030 is applied if this returns a row instead of an error
SELECT 'enforce_housekeeping_bed_columns'::regproc;
```

After 031: once the pre-flight queries in it return no rows, run its `VALIDATE CONSTRAINT` lines.

## Staff accounts locked out (migration 035)

Found while testing on 2026-11-27 against a local Supabase built from these migrations. The only SELECT policy on `subscriptions` is owner-only (015). A manager/receptionist/housekeeping session therefore reads no subscription, `isSubscriptionBlocked(null)` is true, and every staff page redirects to `/settings/billing` ("Abonnement suspendu"), even on an active plan.

- [x] Apply `035_staff_subscription_gate.sql` (done 2026-11-27).
- [ ] **Merge and deploy PR #6.** Staff stay locked out until the app code that calls `subscription_gate()` is live.
- [ ] After the deploy, log in once with a staff account and check it reaches the dashboard.
- Background: migration 035 It adds `subscription_gate()`, which returns only status/period end/provider to the property's owner or active staff. Staff still can't read the row, which holds the billing-portal link. The app falls back to the old behaviour until 035 exists.

## ⏰ Timezone data (Morocco moved to UTC+0 on 20 Sep 2026)

tzdata 2026f (macOS, Chrome 158) has Morocco on UTC+0 since 2026-09-20. Node 22.14 (bundled tz 2024b) and the local Postgres 17.6 still apply UTC+1. Everything Morocco-time goes through the IANA zone (`lib/dates`, `issue_invoice`'s `issue_date`), so a stale runtime is one hour off: "today" rolls over at 23:00, day ranges shift, and server-rendered times differ from the browser (hydration errors).

- [ ] Vercel: check the project's Node.js version and that its `process.versions.tz` is 2026f or newer (2024b is too old).
- [ ] Supabase: `SELECT now() AT TIME ZONE 'Africa/Casablanca', now() AT TIME ZONE 'UTC';`. These should be equal today. If they differ by an hour, invoices issued between 23:00 and midnight get tomorrow's date.
- Don't "fix" this by hard-coding an offset. Update the runtime.

## Staging / new Supabase projects

- Newer Supabase stacks don't auto-grant table privileges on `public` to `anon`/`authenticated`/`service_role`, and production (older project) does. A fresh project built from these migrations needs explicit `GRANT`s, or every query fails with 42501. The local test stack used `GRANT ALL ON ALL TABLES/SEQUENCES/ROUTINES IN SCHEMA public …`, then re-applied the REVOKEs from 032/033/034.

## Facturation (factures + avoirs)

- [x] Apply `034_invoicing.sql` (done 2026-11-27). Tested end-to-end beforehand against a local Supabase: browser flows plus 29 per-role RLS/RPC checks (`scripts/local-test/check-roles.sh`).
- [ ] After PR #6 deploys: fill in Paramètres → Facturation for the property (raison sociale, ICE, IF, TVA, taxe de séjour rate), then issue one real invoice and check the PDF.
- [ ] Have an accountant (comptable) confirm the defaults before customers rely on them: 10 % TVA on accommodation, the same rate applied to extras, the taxe de séjour shown as "included in the price, outside the TVA base", and the wording of the legal mentions.
- Numbers are `F-YYYY-NNNN` / `AV-YYYY-NNNN`, gap-free per property and per year. Issued invoices can't be edited or deleted. Corrections go through an avoir (manager+).
- **Administratif page** (`/declarations`, manager+): taxe de séjour summary, tourism statistics, police register, accounting pack (zip). It needs no migration, except for two things that need 034: the tax rate per nuitée (in `property_legal`) and the invoices inside the pack. Before 034, it shows nuitées without an amount, and a pack without invoices. Every output is labelled "Récapitulatif"/working document. Check the official forms with the commune / Délégation du Tourisme before advertising it as the declaration itself.

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
