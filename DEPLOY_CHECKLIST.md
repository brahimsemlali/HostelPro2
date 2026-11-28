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
| 036 | ⏳ New (branch `feat/channex-ready`). Room types, rate plans, rate calendar, oversell guard. See "Channel-manager foundation" below. |
| 037 | ⏳ New (same branch). Channel sync queue, inert until a property has an *active* `channel_connections` row. Apply after 036. |
| 038 | ⏳ New (same branch). Booking-revision import RPC, `channel_alerts`, iCal dedupe index scoped to iCal rows. Apply after 037. |
| 039 | ⏳ New (same branch). Worker helpers (queue lease, rate per night, full sync). Apply after 038. |

```sql
-- 029 is applied if has_active_subscription shows a search_path in proconfig
-- and create_property_with_setup shows trial_fixed = true
SELECT proname, proconfig, prosrc LIKE '%14 days%' AS trial_fixed
FROM pg_proc WHERE proname IN ('has_active_subscription', 'create_property_with_setup');

-- 030 is applied if this returns a row instead of an error
SELECT 'enforce_housekeeping_bed_columns'::regproc;
```

After 031: once the pre-flight queries in it return no rows, run its `VALIDATE CONSTRAINT` lines.

## Channel-manager foundation (migrations 036–039)

Built and tested on 2026-11-28 against the local stack (`scripts/local-test/sql/run.sh`: 19 SQL tests + a two-transaction race for the last bed; `check-roles.sh` covers the new RLS). Order:

- [ ] Run the pre-flight query at the top of `036_room_types_inventory.sql` (unknown booking statuses). It must return 0 rows.
- [ ] Apply `036_room_types_inventory.sql`, `037_channel_sync_queue.sql`, `038_channel_booking_import.sql`, `039_channel_worker.sql`, in that order. All are safe with the code currently deployed: old write paths are covered by triggers.
- [ ] Deploy the branch. Settings › Chambres then shows "Types de chambre"; before 036 the section is hidden.
- [ ] Check: `SELECT count(*) FROM rooms WHERE room_type_id IS NULL;` returns 0.

What changes for users right away:
- Every room got its own type (no merging). Owners can group identical rooms and set a price per type; `beds.base_price` stays the live price in the app.
- A booking can no longer push a room type past its capacity on any night (error `SR409`, toast "Complet…"). Bed-level conflicts behave as before (`23P01`).
- A booking without a bed (online, or iCal import) shows a "Pas encore de lit" card on its page to place it in a free bed of the right type.
- Nothing is sent anywhere until the Channex steps below are done: the queue only fills for properties with an active connection, and the worker and webhook answer 401 without their secrets.

### Turning on Channex (after the Phase 0 answers and a staging account)

1. Vercel env (Production): `CHANNEX_API_KEY` (staging key first), `CHANNEX_BASE_URL` (leave unset for staging; production URL after certification), `CHANNEX_WEBHOOK_SECRET`, `CHANNEL_WORKER_SECRET` (two long random alphanumeric strings).
2. In Channex, create the webhook: `callback_url` = `https://www.sweetreservation.com/api/webhooks/channex`, `event_mask` `*`, `send_data` on, header `X-Channex-Webhook-Secret: <CHANNEX_WEBHOOK_SECRET>`.
3. Scheduler: the Vercel plan runs crons at most daily, so Supabase calls the worker every minute. In the Supabase SQL editor (enable the `pg_cron` and `pg_net` extensions first):
   ```sql
   SELECT cron.schedule('channel-worker', '* * * * *', $$
     SELECT net.http_post(
       url := 'https://www.sweetreservation.com/api/channel/worker',
       headers := jsonb_build_object('Authorization', 'Bearer <CHANNEL_WORKER_SECRET>')
     );
   $$);
   ```
4. Per property (until the connection screen exists): create the property, room types and rate plans in Channex, then store the ids:
   `INSERT INTO channel_connections (property_id, channex_property_id, status) VALUES ('<uuid>', '<channex id>', 'active');` and set `room_types.channex_room_type_id` / `rate_plans.channex_rate_plan_id`. Then `SELECT channel_enqueue_full('<uuid>');` once for the initial push.
5. Watch `channel_sync_log` and `channel_alerts` for the first hours.

Tests: `scripts/local-test/sql/run.sh` (28 SQL tests + race), `check-roles.sh`, `npx vitest run` (unit), and the worker end to end against the local stack with a simulated Channex: see the header of `tests/channex-worker.local.test.ts`.

## Staff accounts locked out (migration 035)

Found while testing on 2026-11-27 against a local Supabase built from these migrations. The only SELECT policy on `subscriptions` is owner-only (015). A manager/receptionist/housekeeping session therefore reads no subscription, `isSubscriptionBlocked(null)` is true, and every staff page redirects to `/settings/billing` ("Abonnement suspendu"), even on an active plan.

- [x] Apply `035_staff_subscription_gate.sql` (done 2026-11-27).
- [ ] **Merge and deploy PR #6.** Staff stay locked out until the app code that calls `subscription_gate()` is live.
- [ ] After the deploy, log in once with a staff account and check it reaches the dashboard.
- Background: migration 035 adds `subscription_gate()`, which returns only status/period end/provider to the property's owner or active staff. Staff still can't read the row, which holds the billing-portal link. The app code falls back to the old behaviour where 035 is missing.

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
