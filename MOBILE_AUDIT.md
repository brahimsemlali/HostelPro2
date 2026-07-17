# Mobile Responsiveness Audit — 2026-07-17

Audit of the dashboard's mobile experience. Findings are ordered by severity.
**STATUS: all fixes applied 2026-07-17 on branch `fix/staff-access-and-menage` (tsc + eslint clean).**

Applied:
- HIGH — bed status sheet rebuilt on the portaled shared `Sheet` primitive (`BedMapClient.tsx`) → stacks above the nav, internal scroll, safe-area padding.
- MEDIUM — `AddArrivalModal` panel gets `max-h-[calc(90vh-62px)] mb-[calc(62px+safe-area)]` on mobile so its footer clears the nav.
- LOW — dashboard 7-day strip `gap-1.5 sm:gap-3` (more width on 375px).
- LOW — calendar booking card `touch-none` so touch drag resizes instead of scrolling.
- Shared `Sheet` bottom variant left as-is (portal already handles stacking; safe-area pad applied per-sheet where it matters).

## Root cause of the #1 complaint

The mobile nav (`components/layout/MobileNav.tsx`) is `position: fixed; bottom: 0; height: 62px` (+ iOS safe-area) at `z-50`.

`<main>` correctly reserves space for it with `pb-20` (`app/(dashboard)/layout.tsx:40`), so **page-scroll content clears the nav fine**.

**The bug is specific to INLINE overlays, not portaled ones — this distinction matters:**

- **Inline overlays** (`fixed inset-0` returned directly from a page/client component) render in-tree, *before* `<MobileNav />` in the DOM, at the same `z-50`. Later-painted, equal-z elements win → **the nav paints on top of the overlay's bottom strip.** The bed status sheet and `AddArrivalModal` are inline. This is the real bug.
- **Portaled sheets** (`BookingDetailSheet`, `PaymentModal`, anything on the shared `Sheet`/`Dialog` primitive) render through base-ui's `Portal` to `document.body`, i.e. *after* the nav. They + their backdrop stack **above** the nav (which base-ui also makes inert). These are NOT hidden behind the nav — at most they need bottom safe-area padding.

So "if I click a bed I have to scroll down to see and change the condition" = the bed status sheet is inline, its status buttons + "Nouveau check-in ici" button are painted under the nav bar, and it has no internal scroll to bring them up. On a short phone they're fully covered.

---

## HIGH — Bed status sheet hidden behind the nav bar (the reported bug)

**File:** `app/(dashboard)/beds/BedMapClient.tsx:408–499`

The status sheet for an available/dirty/maintenance bed is a **hand-rolled overlay**, not the shared `Sheet` primitive. It is missing everything a mobile bottom sheet needs:

- `fixed inset-0 flex items-end` → content pinned to `bottom-0`, **under** the 62px nav.
- **No `max-height` + no `overflow-y-auto`** → on a small screen the 2×2 status grid + "Nouveau check-in ici" button overflow off-screen with no way to scroll inside the sheet.
- No drag handle, no bottom safe-area padding.

**Fix (next session) — recommended:** convert this to the shared `<Sheet side={isMobile ? 'bottom' : 'right'}>` used by `BookingDetailSheet`. This single change **also fixes the stacking**, because the shared Sheet is portaled to `document.body` → it lifts above the nav instead of being painted under it. You get: consistency, portal stacking, internal scroll, and base-ui making the page inert, for free. Add `pb-[max(20px,env(safe-area-inset-bottom))]` for the home-indicator gap and a drag handle (`w-9 h-1 rounded-full bg-black/10`) to match `AddArrivalModal` / `MoreDrawer`.

(If for some reason the hand-rolled overlay is kept, the minimum fix is: `max-h-[calc(88vh-62px)] overflow-y-auto` on the inner panel + `mb-[62px] sm:mb-0` so it clears the nav + safe-area bottom padding. But porting to `Sheet` is strictly better.)

---

## ~~MEDIUM — Shared `Sheet` bottom variant doesn't clear the nav~~ — CORRECTED: not a bug

**File:** `components/ui/sheet.tsx:56`

Original suspicion was that `BookingDetailSheet` (bottom variant) hides its last row under the nav. **This is wrong.** The shared `Sheet` uses `SheetPortal` → base-ui `Dialog.Portal` renders to `document.body`, *after* `<MobileNav />` in the DOM. The sheet + its `fixed inset-0` backdrop therefore paint **on top of** the nav (later DOM, equal z-index), and base-ui makes the underlying page inert. So its buttons are above the nav, fully reachable — not tucked behind it.

**Residual (LOW, cosmetic only):** on iPhones with a home indicator, a portaled bottom sheet's last row can sit in the safe-area gap. Add `pb-[max(1rem,env(safe-area-inset-bottom))]` to the bottom variant if desired. Do **not** rework `sheet.tsx` for nav clearance — there is nothing to clear.

---

## MEDIUM — `AddArrivalModal` bottom actions under the nav

**File:** `components/dashboard/AddArrivalModal.tsx:245, 253`

Better than the bed sheet (has drag handle + `max-h-[90vh] flex flex-col`), but it is also **inline** (returned directly as `fixed inset-0`, not portaled) → same real bug: `items-end` pins it to `bottom-0` and the nav paints over its footer/submit button. Fix: either portal it, or give it `mb-[62px] md:mb-0` + safe-area bottom padding so the footer clears the nav. (Opened from the dashboard, so lower frequency than the bed sheet.)

---

## LOW — Calendar drag-resize on touch

**File:** `app/(dashboard)/calendar/CalendarClient.tsx` (597 lines, `w-max` horizontally-scrollable grid with pointer drag-resize)

The grid degrades to horizontal scroll (`overflow-auto`), so it's usable, but drag-to-resize a booking on a touch screen competes with the scroll gesture. Verify `touch-action: none` is set on the drag handles specifically (not the scroll container) so a resize drag doesn't also pan the grid. Secondary surface (lives under "More", not a primary tab) — low priority.

---

## LOW — Dashboard 7-day forecast strip is tight on narrow phones

**File:** `components/dashboard/DashboardClient.tsx:202` (`grid grid-cols-7 gap-3`, no responsive prefix)

The 7-day occupancy strip forces 7 columns even at 375px → ~32px/column after `px-6` + `gap-3`. Thin bars + day label + percentage are borderline but probably legible by design. Eyeball on a small device; if cramped, drop to `gap-2`/`gap-1.5` on mobile or shrink the label. Not broken.

---

## Verified OK (no action needed)

- **Portaled sheets/modals** (`BookingDetailSheet`, `PaymentModal`, anything on shared `Sheet`/`Dialog`) — stack above the nav via the base-ui Portal; buttons reachable. Only optional safe-area padding.
- **Tables** — only `ReportsClient` uses a `<table>`, wrapped in `overflow-x-auto`. No horizontal body overflow elsewhere.
- **Fixed widths** — all `min-w-[Npx]` hits are small count badges, not layout-breaking.
- **Dashboard + Payments metric cards** — `grid-cols-2 lg:grid-cols-4` / `grid-cols-3` for small stats; stack fine on mobile.
- **Check-in wizard** (`components/guests/CheckInWizard.tsx`) — steps use `grid-cols-1 sm:grid-cols-2` (stacks on mobile); nav buttons scroll with the page inside `<main>`'s `pb-20`, so they clear the nav. Fine.
- **`<main>` bottom padding** — `pb-20 md:pb-0` correctly clears the nav for normal scroll content.

---

---

# Correctness sweep — 2026-07-17 (round 2, all APPLIED)

Beyond layout: date-label off-by-ones and money-input validation. All fixed + tsc/eslint clean.

## Date-only strings parsed with `new Date()` → UTC-midnight skew (visible off-by-one)
`new Date("2026-07-18")` = UTC midnight = 01:00 local (Morocco UTC+1). Use `parseISO()` (date-fns parses date-only as *local*) or compare local `YYYY-MM-DD` strings.
- **`HousekeepingClient.tsx:139`** — tasks due *today* flagged overdue (red) all day. Fixed: `task.due_date < todayISO()` (todayISO is verified local). The display in the same block already used `parseISO` — the comparison didn't; now consistent.
- **`BookingDetailSheet.tsx:115`** — `differenceInDays(new Date(checkout), new Date())` made a checkout *tomorrow* read "Aujourd'hui" and every "dans Xj" under by one. Fixed: `differenceInCalendarDays(parseISO(checkout), new Date())`.
- Swept `components/dashboard` + `calendar` for twins — dashboard checkout-deadline uses local `setHours`, no third instance. `toLocaleDateString` display hits are Morocco-benign (left alone per no-speculative-code rule).

## Money inputs accept negative / NaN amounts
`type="number"` without `min` + weak `!amount` guard → negatives/NaN corrupt revenue and the now-triggered `guests.total_spent` (migration 025).
- **`PaymentsClient.tsx`** (add-payment) — handler now rejects non-finite/≤0 with a toast (`payments.invalidAmount`, added to fr+en); input gets `min="0" step="0.01"`; reuses validated value. `cashDiff` guarded against NaN.
- **`BookingDetailClient.tsx`** (record payment / refund) — same handler guard + input `min`.
- **`NightAuditClient.tsx`** — `cashDiff` + `actual_cash` insert guarded against NaN; cash input `min="0"`.
- **`CheckInWizard.tsx`** — already safe (`Number.isFinite ? Math.min(raw, price) : 0`, inserts only `if > 0`). Left as-is.

---

# Permission / data-exposure sweep — 2026-07-17 (round 3, all APPLIED)

## HIGH — `BookingDetailSheet` leaked guest PII + finances to housekeeping
`components/shared/BookingDetailSheet.tsx` was not role-aware. Housekeeping (only `update_bed_status`) can open an occupied bed on the map → the sheet rendered the guest **identity (passport #, DOB, profession)**, **contact**, a **Finances** section, and a **police-fiche PDF link** (the passport registration itself). Worse, RLS (migration 026) filters payments to rank≥2, so the finance numbers were *wrong* for housekeeping (0 encaissé → full balance due). This is the app-layer follow-up the 026 migration notes explicitly flagged.

Fixed by gating with `useCanDo`:
- `canSeeGuestDetails = useCanDo('check_in_guests')` (receptionist+) → hides quick-contact actions, identity/contact/Morocco/history, police-fiche block, and the profile/booking links.
- `canSeeFinances = useCanDo('record_payments') || useCanDo('view_revenue')` → hides the Finances section. (Both hooks called unconditionally per rules-of-hooks.)
- Housekeeping now sees only: name + status badges + stay (dates/bed/requests). Receptionist/manager/owner: unchanged.

## Verified OK (no action)
- **Server page guards** — `night-audit`/`reports` (manager+), `maintenance` (blocks housekeeping+receptionist), `payments` (blocks housekeeping) all redirect on direct URL. Consistent with migration 026 RLS ranks.
- **Realtime channel names** — all `` `x-${propertyId}` `` (stable); no date/page-state → no resubscribe loop.
- **Optimistic updates** — `BedMapClient.handleStatusChange`, `HousekeepingClient` task status/delete/bed-clean all snapshot + roll back on error.
- **`buildWhatsAppLink`** — strips `00`/leading-zeros → `212…`. A bare local `0612…` loses its country code, but auto-prepending `212` would corrupt foreign guests' numbers, so current behavior is the defensible choice (numbers are captured with a country-code selector).
- **`.single()` on settings pages** — keyed on `session.propertyId` which always exists; `select('*')` there is a style-rule violation, not a crash.

---

# Deep-dive on public / high-risk surfaces — 2026-07-17 (round 4)

Audited the surfaces most likely to hide production bugs. Mostly clean (good signal).

## LOW — pre-check-in POST accepted cancelled bookings (FIXED)
`app/api/checkin/[token]/route.ts` POST didn't re-check booking status (the GET does), so a direct POST to a cancelled/no-show booking's token could rewrite guest PII + mark it complete. Added the same `cancelled`/`no_show` → 410 guard. Otherwise this endpoint is well-hardened (rate-limit, token length, field type/length caps, required-field + date/gender/doctype validation, idempotency, service-role only after token validation).

## Verified clean (no action)
- **Calendar drag-resize persist** (`CalendarClient.tsx`) — client collision check + 022 exclusion-constraint backstop with `isBedConflictError` rollback; rack-rate price protection so a drag never resets a negotiated OTA total; optimistic update rolls back on error. `addDays`/`daysBetween` return strings/numbers and are correct in UTC+1.
- **`formatCurrency` call sites** — all fed non-null generated/defaulted columns (`net_revenue`, `total_spent`, `total_price`); no `NaN MAD` path.
- **Housekeeping optimistic mutations** — snapshot + rollback on every path.

---

# Backend / auth / IDOR sweep — 2026-07-17 (round 5)

Audited every mutating endpoint + server action for authentication, authorization, and property-scoping. **The backend is solid** — the one fix was a guest-facing formatting bug.

## LOW — guest-facing WhatsApp activity dates showed US format (FIXED)
`app/actions/activities.ts` (announcement + reminder) formatted the date with bare `toLocaleDateString()` (no locale). On the UTC server that renders `7/18/2026` to Moroccan guests. Fixed → `new Date(\`${date}T00:00:00\`).toLocaleDateString('fr-FR')` → `18/07/2026`. Swept the whole app — these were the only two locale-less date calls.

## Verified secure (no action) — every mutating route/action
- **Auth + role**: `admin/subscription` (superadmin), `staff/create|revoke|toggle-revenue` (owner), `billing/checkout` (owner), `gdpr` (owner). `staff/create` validates role against `['manager','receptionist','housekeeping']` — **no escalation to owner** — password ≥8, and rolls back the auth user if the staff insert fails.
- **Property-scoping (no IDOR)**: `switch-property` verifies owner-or-active-staff of the target property before setting the cookie; `sendWhatsAppBroadcast` checks `session.propertyId === propertyId` + role + only sends to numbers already belonging to the property's guests (open-relay protection); the `activities` actions rely on RLS, and `activities` RLS (`FOR ALL USING`, Postgres copies USING→WITH CHECK for INSERT) correctly blocks cross-tenant insert/delete.
- **SSRF**: `sync-ical` restricts fetch to an OTA-domain allowlist + 10s timeout, and only parses (no DB write).
- **Check-in wizard** (`CheckInWizard.tsx`): idempotent retry guard (`createdBookingRef`), correct returning-guest reuse (update, no duplicate), future stays → `confirmed` (don't occupy the bed), `todayISO()` local boundary.

---

## Suggested implementation order for next session

1. **Rebuild the bed status sheet** (`BedMapClient.tsx:408`) on the shared `Sheet` primitive — this is the reported bug and porting to the portaled primitive fixes the stacking for free. (Do NOT touch `sheet.tsx` for nav clearance — the portal already handles it.)
2. **Fix `AddArrivalModal`** — portal it, or `mb-[62px] md:mb-0` + safe-area padding so its footer clears the nav.
3. (Optional) add `pb-[max(1rem,env(safe-area-inset-bottom))]` to the shared `Sheet` bottom variant for the iPhone home-indicator gap.
4. Eyeball the dashboard 7-day strip + calendar touch drag-resize `touch-action` on a real device.
