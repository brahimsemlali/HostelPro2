# Security Audit — Sweet Reservation (HostelPro)

**Date:** 2026-07-30 · **Method:** 4 parallel sub-agents (auth/API, RLS/database, secrets/exposure, public/injection) + lead verification.
**Overall posture: strong.** Every mutating API route checks the session server-side, scopes writes to the caller's property, and validates roles; the LemonSqueezy webhook does timing-safe HMAC and fails closed; no IDOR, no unauthenticated write, no cross-tenant hole was found in the application layer. The material risks are (1) a **database RLS gap** that makes role limits UI-only, (2) a **billing bypass**, and (3) a **committed webhook secret**. Fix those three first.

Severity legend: 🔴 Critical · 🟠 High · 🟡 Medium · ⚪ Low

---

## Remediation status (2026-07-30)

**Fixed in code (this branch, `tsc`/eslint/build/tests all green):**
- #4 Open redirect → origin comparison in `app/api/auth/callback/route.ts`.
- #5 SSRF → `redirect:'manual'` + 3xx rejected + per-tenant rate limit in `app/api/sync-ical/route.ts`.
- #6 Pre-check-in token → expires after checkout day; WiFi withheld until completion; passport/PII no longer re-served after completion (`app/api/checkin/[token]/route.ts`).
- #11 Rate-limit IP → prefer proxy-set `x-real-ip` (`lib/rate-limit.ts`, `app/actions/auth.ts`).
- #12 `.or()` filter injection → `sanitizeSearchTerm()` in `lib/utils.ts`, applied in `CommandPalette.tsx` + `PaymentsClient.tsx`.
- #13 Register enumeration → "already registered" now returns the neutral needs-confirmation response (`app/actions/auth.ts`).
- #3 (partial) Webhook secret → scrubbed from `CLAUDE.md` and replaced with placeholders. **Rotation still required — see below.**

**Fixed in migrations (written, NOT yet applied to prod):**
- #2 Trial self-grant + #9 `has_active_subscription` search_path → `029_security_fixes_safe.sql` (safe to apply now; depends only on already-applied 015/027).
- #10 `booking_extras`/`activities` role gate + #7 (beds column tampering only) → `030_role_gate_extras_beds.sql` (**apply only after 023 & 026** — see its header; run the verification queries first).

**Requires your action (cannot be done from code):**
- 🔴 **#1 — apply migration `026` in prod** (verify with the `pg_policy` query first). This is the single most important step; the RLS role gap is otherwise live.
- 🟠 **#3 — rotate `LEMONSQUEEZY_WEBHOOK_SECRET`** in the LemonSqueezy dashboard, then update Vercel env + `.env.local`. Scrubbing the doc does NOT remove it from git history, so rotation is mandatory.
- **Apply migrations `029` then (after 023+026) `030`** in the Supabase SQL editor.

**Deferred (documented, need an app-layer refactor — not faked):**
- #7 residual — housekeeping can still SELECT guest passport/DOB columns; #12-class — receptionist can SELECT all payments. A Postgres column GRANT/REVOKE can't discriminate by app-role (all logged-in users share the `authenticated` role); closing these needs a column-restricted view/RPC for housekeeping + moving balance math server-side. See the note at the bottom of `030`.
- #8 (unverified-JWT `isSuperAdmin`) and #14 (CSP `unsafe-inline`) — left as-is by design: #8 is safe under the proxy invariant (a forged token returns no RLS rows → null session), #14's nonce refactor risks breaking the app for little gain.

---

## Priority fix list

| # | Sev | Issue | Location | Live? |
|---|-----|-------|----------|-------|
| 1 | 🔴 | Staff RLS is not role-aware — any staff (incl. housekeeping) can read/fabricate payments, un-blacklist guests, rewrite bookings via the browser console | migration `007` (fix = `026`, **not applied**) | Verify prod, likely YES |
| 2 | 🟠 | Self-granted unlimited trial — onboarding RPC trusts a client-supplied `p_trial_end` | `027` `create_property_with_setup`; `app/onboarding/page.tsx:100` | YES |
| 3 | 🟠 | LemonSqueezy **webhook secret committed to git** in plaintext | `CLAUDE.md:89,542` (`sweetreservation2026secret`) | YES |
| 4 | 🟡 | Open-redirect bypass — `next` guard blocks `//evil.com` but not `/\evil.com` | `app/api/auth/callback/route.ts:11` | YES |
| 5 | 🟡 | SSRF — iCal fetch follows redirects without re-checking the OTA allowlist | `app/api/sync-ical/route.ts:92-111` | YES |
| 6 | 🟡 | Pre-check-in token never expires; GET serves passport + WiFi password forever | `app/api/checkin/[token]/route.ts:36-70` | YES |
| 7 | 🟠 | Housekeeping can read all guest PII columns (passport/DOB) — survives `026` | migration `026` `staff_read_guests`; `beds` update too | Design gap |
| 8 | ⚪ | `getUserSession()` derives `isSuperAdmin` from an **unverified** JWT | `lib/supabase/server.ts:60-115` | Safe today |
| 9 | ⚪ | `has_active_subscription()` DEFINER function missing `SET search_path` | migration `015` | Latent/unused |
| 10 | ⚪ | `booking_extras` / `activities` writable by housekeeping (no role gate) | migrations `023`, `010` | Depends on 023 |
| 11 | ⚪ | No rate limit on `sync-ical` / `billing/checkout`; limiter key `x-forwarded-for`-spoofable | `lib/rate-limit.ts:65` | YES |
| 12 | ⚪ | PostgREST `.or()` filter injection in guest search (authenticated, RLS-bounded) | `CommandPalette.tsx:108`, `PaymentsClient.tsx:194` | YES |
| 13 | ⚪ | Register endpoint may leak user-existence via raw Supabase error | `app/actions/auth.ts:85` | Config-dependent |
| 14 | ⚪ | CSP allows `script-src 'unsafe-inline'` (XSS defense-in-depth weakened) | `next.config.ts:35` | YES |

---

## 1. 🔴 Staff RLS is not role-aware (privilege escalation within a tenant)

Migration `007`'s `staff_*` policies scope only to the tenant (`property_id = get_my_property_id()`) with **no role predicate**. The role limits (`useCanDo`, Sidebar) live only in the UI. A housekeeping account gets a real Supabase JWT and can bypass the UI entirely via the browser console:

```js
await supabase.from('payments').select('*')                              // full cash book
await supabase.from('payments').insert({ property_id, amount:9999, method:'cash' })
await supabase.from('guests').update({ is_flagged:false }).eq('id', blacklistedGuest)
await supabase.from('bookings').update({ total_price: 0 }).eq('id', anyBooking)
```

Reads/writes cover `payments`, `guests`, `bookings`, `whatsapp_messages`, `night_audits`. Tenant-internal (not cross-tenant), but a live confidentiality/integrity hole for any property with a non-owner staff account.

**Migration `026` fixes this but is marked NOT applied — and `CLAUDE.md`'s migration table contradicts itself** (says both "Applied 2026-07-16" and "NOT yet applied"). **Action:** verify prod, then apply `026`:
```sql
SELECT pg_get_expr(polqual, polrelid) FROM pg_policy WHERE polname = 'staff_read_payments';
-- if it lacks get_my_role_rank(), 026 is NOT live → apply it now.
```

## 2. 🟠 Self-granted unlimited trial (billing bypass)

`create_property_with_setup` (`027`, SECURITY DEFINER, granted to `authenticated`) accepts `p_trial_end` **from the client** and writes it to `subscriptions.current_period_end`. This is the only client-reachable write path to `subscriptions` (no INSERT policy exists — correct). A fresh signup calls the RPC directly:

```js
await supabase.rpc('create_property_with_setup', { /* ... */ p_trial_end:'2099-01-01T00:00:00Z' })
```

→ `trialing` until 2099, reads as active forever, LemonSqueezy never involved. Lowest exploitation bar of any finding (any new user, zero preconditions). **Fix:** drop `p_trial_end` from the signature; compute `now() + INTERVAL '14 days'` inside the function; update the `onboarding/page.tsx:100` call.

## 3. 🟠 Webhook secret committed to git

`CLAUDE.md` (git-tracked) contains the **full** `LEMONSQUEEZY_WEBHOOK_SECRET=sweetreservation2026secret` at lines 89 and 542. Anyone with repo access can forge valid webhook HMACs and flip any property's subscription to `active` (billing bypass) or `cancelled` (deny a paying customer). The webhook's correct HMAC verification is moot once the secret is public. **Fix:** rotate the secret in LemonSqueezy → update Vercel + `.env.local` → scrub from `CLAUDE.md` (replace with a placeholder). Rotation is mandatory because it's in git history. (The `LEMONSQUEEZY_API_KEY` on line 87 is truncated, not usable — but same hygiene rule.)

## 4. 🟡 Open-redirect bypass in auth callback

`app/api/auth/callback/route.ts:11` guards with `startsWith('/') && !startsWith('//')`, which blocks `//evil.com` but not `/\evil.com` — the WHATWG URL parser normalizes the backslash to `https://evil.com/` (verified empirically). After a valid code exchange, the victim is redirected off-domain (phishing/token-relay). **Fix:** compare parsed origins, not string prefixes:
```ts
const dest = new URL(rawNext, req.url)
const next = dest.origin === new URL(req.url).origin ? dest.pathname + dest.search : '/dashboard'
```

## 5. 🟡 SSRF via iCal redirect-follow

`app/api/sync-ical/route.ts` validates the OTA-domain allowlist only on the initial URL; `fetch` uses default `redirect:'follow'`, so an open redirect on any allowlisted host (booking.com, airbnb.com…) pivots the server-side request to internal/metadata endpoints (`169.254.169.254`). Authenticated + subscribed, blind exfil, but a real internal-probe primitive. **Fix:** `redirect:'manual'`, reject non-2xx, re-validate every hop's `Location`, block private/link-local IPs. Add rate limiting.

## 6. 🟡 Pre-check-in token: no expiry, permanent PII leak

`app/api/checkin/[token]/route.ts` GET returns `document_number` (passport/CIN), `date_of_birth`, `phone`, and the property `wifi_password`. The token (a proper unguessable UUID) **never expires**; even after check-out the GET keeps serving full PII to anyone who ever obtained the URL (WhatsApp forward, link-preview bot, Referer/history leak). GDPR-relevant. **Fix:** reject once `check_out_date` has passed; stop returning `document_number`/`wifi_password` after `pre_checkin_completed`; ideally null the token on completion.

## 7. 🟠 Housekeeping reads all guest PII columns (survives `026`)

RLS is row-level — `026` keeps `staff_read_guests` open to all staff (rank ≥ 1) so the cleaning list can show names, but granting the row grants **every column** including `document_number`/`date_of_birth`. Same class: `staff_update_beds` (007, unchanged by 026) lets housekeeping UPDATE any `beds` column, not just `status`. **Fix (RLS can't filter columns):** expose housekeeping a column-restricted `security_invoker` view (name + bed only), `REVOKE` direct table SELECT for rank 1; use column-level GRANT on `beds`.

---

## Verified secure (checked, no action)

- No `.env*` tracked in git; `.gitignore` covers them. No server secret reaches the client bundle; service-role key read only in `lib/supabase/server.ts:39`; no `'use client'` file imports the server helpers. Logging clean (no secret/PII printed).
- `subscriptions` has **no** client INSERT/UPDATE policy — direct self-grant closed (only leak is via #2's DEFINER function).
- Both views (`current_occupancy`, `daily_revenue`) recreated `security_invoker=true` in `017`.
- Catastrophic anon holes from `004`/`003` (cross-tenant booking read/write, invitation leak) dropped by `019`/`021`/`024`. **Confirm `019` is applied in prod** — if not, it's Critical (anon key could read/update every booking).
- Webhook: raw body before parse, `timingSafeEqual`, fails closed to 401/`past_due`; `property_id` comes from the ownership-verified session, not the payload → no cross-tenant hijack.
- Check-in POST uses a strict field whitelist (no mass assignment) + type/length/enum validation; cancelled→410, completed→409 (no reuse).
- `staff/create` cannot mint an `owner`; `switch-property` verifies owner-or-active-staff; `gdpr` owner-only + ownership-checked; `admin/subscription` gated behind verified `getUser()` + superadmin allowlist.
- Security headers present: HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, `frame-ancestors 'none'`, scoped `connect-src`.
