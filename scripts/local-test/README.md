# Local test stack

End-to-end testing against a **local** Supabase built from `supabase/migrations`.
`.env.local` points at production, so never test write flows with the normal `npm run dev`.

Requirements: Docker Desktop running (`open -a Docker`) and the Supabase CLI on PATH.

| Command | What it does |
|---|---|
| `scripts/local-test/setup.sh` | Creates (or resets) the stack on ports 554xx, applies every migration except 011 (not in prod), grants table privileges like prod, seeds test data |
| `scripts/local-test/dev.sh` | `next dev` on http://127.0.0.1:3100 against the local stack (env vars override `.env.local`; dummy WhatsApp/LemonSqueezy keys) |
| `scripts/local-test/check-roles.sh` | RLS / RPC checks for owner, manager, receptionist, housekeeping, anon and another tenant (invoicing + staff subscription gate) |
| `scripts/local-test/stop.sh` | Stops the dev server and the stack |
| `scripts/local-test/pglite-invoicing.mjs` | Docker-free check of migration 034 in PGlite (see header) |

Accounts (password `Test1234!`): `owner@test.local`, `manager@test.local`, `recep@test.local`, `menage@test.local`.

Gotchas
- Newer Supabase stacks don't auto-grant privileges on `public`; `setup.sh` mirrors production and re-applies the migrations' deliberate REVOKEs. Keep that list in sync when a migration revokes something.
- jsPDF downloads go straight to `~/Downloads` in browser tests.
- Node's bundled tz data may be older than the browser's (Morocco is UTC+0 since 2026-09-20 in tzdata 2026f). A one-hour server/browser hydration mismatch on times usually means stale runtime tz data, not app code.
- The stack lives in `scripts/local-test/.stack/` (gitignored).
