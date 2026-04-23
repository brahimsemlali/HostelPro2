# HostelPro — Handoff Brief for New Claude Session
# Read this FIRST before touching any code.

---

## WHAT THIS IS

**HostelPro** — a hostel/auberge management SaaS for the Moroccan market.
Production-grade, not a prototype. French UI, MAD currency, Moroccan police form (fiche de police) generation.
Stack: Next.js App Router · Supabase (Postgres + RLS + Auth) · **@base-ui/react** · Tailwind CSS v3 · TypeScript strict.

Working directory: `/Users/strapexmaroc/Stayy/hostelpro`
Dev server: `npm run dev` (port 3000)

---

## ACTUAL NEXT.JS VERSION

This project runs **Next.js 16.2.2** (not 14 as the original spec says).
The App Router is used. Do NOT use Pages Router patterns.

---

## ⚠️ CRITICAL — UI COMPONENT LIBRARY

This project uses **`@base-ui/react`**, NOT Radix UI / shadcn/ui primitives.

**Consequences:**
- `Button`, `DropdownMenu`, `Dialog`, `Select`, etc. all come from `@base-ui/react/*`
- **No `asChild` prop** — base-ui does not support the Radix `asChild` pattern
- Do NOT write `<Button asChild><Link>...</Link></Button>` — it will cause a TypeScript error
- Instead wrap with `<Link className="...">` directly, or render the trigger with its own className
- Check existing components in `components/ui/` before assuming any API

---

## DESIGN SYSTEM — ALREADY APPLIED

The entire UI was overhauled to an **Apple-style** aesthetic. Key rules:

- **Background**: `oklch(0.972 0 0)` (#F5F5F7 — Apple light gray)
- **Primary teal**: `#0F6E56` (dark) / `#16a37d` (light) — used for gradients
- **Cards**: white, `border-radius: 14–16px` (often `rounded-[28px]` or `rounded-[32px]`)
- **Frosted glass** sidebar/topbar: `backdrop-filter: blur(20px) saturate(180%); background: rgba(255,255,255,0.88)`
- **Shadows**: CSS variables `--shadow-xs` through `--shadow-xl` defined in `globals.css`
- **Animations**: `hp-fade-up` (keyframe), `hp-stagger` (nth-child delays 55ms), `hp-page-in` class on page root divs
- **Color space**: `oklch()` used for muted text (`oklch(0.42 0 0)`, `oklch(0.55 0 0)`, `oklch(0.65 0 0)`)
- **Border radius global**: `0.75rem`
- **Typography**: system font stack, font-weight 500 for headings (never 700). Black weight (`font-black`) used for metric values and emphasis.
- **Text color**: `#0A1F1C` for primary headings (near-black teal), `text-muted-foreground` for secondary

Do NOT introduce generic/purple gradient aesthetics. Keep the Apple-minimal direction.

---

## MULTI-USER AUTH — FULLY IMPLEMENTED

This is the most important architectural addition. The app supports **owner + staff sub-accounts**.

### Role hierarchy (lowest → highest)
```
housekeeping (1) < receptionist (2) < manager (3) < owner (4)
```

### Key types (`types/index.ts`)
```typescript
export type StaffRole = 'owner' | 'manager' | 'receptionist' | 'housekeeping'

export type UserSession = {
  userId: string
  role: StaffRole
  propertyId: string
  isOwner: boolean
  staffId: string | null
  staffName: string | null
}
```

### `getUserSession()` — always use this instead of `getUserId()`
Located at `lib/supabase/server.ts`. Returns a `UserSession | null`.
Checks owner first (via `properties.owner_id`), then staff member (via `staff.user_id`).
Use this in every server component / API route that needs auth context.

```typescript
import { getUserSession } from '@/lib/supabase/server'
const session = await getUserSession()
if (!session) redirect('/login')
```

### Client-side session
`app/context/SessionContext.tsx` wraps the dashboard layout.
Hooks: `useSession()`, `useHasRole(minRole)`, `useCanDo(permission)`

```typescript
import { useSession, useHasRole, useCanDo } from '@/app/context/SessionContext'
```

### Permissions map
```typescript
const PERMISSIONS = {
  owner:        [...all permissions],
  manager:      ['view_reports','view_revenue','manage_settings','check_in_guests','record_payments','manage_maintenance','update_bed_status','view_night_audit','send_whatsapp'],
  receptionist: ['check_in_guests','record_payments','update_bed_status','send_whatsapp'],
  housekeeping: ['update_bed_status'],
}
```

---

## DATABASE — WHAT EXISTS

### All migrations (applied in order)
| File | What it adds |
|------|-------------|
| `001_initial_schema.sql` | Core tables: `properties`, `rooms`, `beds`, `guests`, `bookings`, `payments`, `maintenance`, `whatsapp_messages`, `staff`, `night_audits` + RLS |
| `002_ical_integration.sql` | iCal feed support on properties |
| `003_expenses_inventory.sql` | `expenses`, `inventory_items` tables |
| `003_staff_auth.sql` | `staff_invitations` table + staff RLS policies on all tables |
| `004_new_features.sql` | `booking_extras`, `pricing_rules` tables; adds `is_flagged`/`flag_reason` on guests; `pre_checkin_token`/`pre_checkin_completed` on bookings; `review_url` on properties |
| `005_activity_log_revenue_control.sql` | `activity_log` table for the dashboard feed |
| `006_staff_rls_and_indexes.sql` | Improved RLS policies + indexes |
| `007_fix_rls_recursion.sql` | Adds `get_my_property_id()` helper function; fixes infinite recursion in RLS |
| `008_housekeeping_tasks.sql` | `housekeeping_tasks` table for assigned cleaning tasks |
| `009_performance_indexes.sql` | Performance indexes — **run in Supabase SQL Editor if not yet applied** |
| `010_activities_and_automation.sql` | `activities` table (hostel events with WhatsApp broadcast) |
| `011_owner_whatsapp_api.sql` | Adds `whatsapp_phone_number_id`, `whatsapp_access_token` to `properties` |

### Key extra columns added by migrations
- `guests.is_flagged` (BOOLEAN), `guests.flag_reason` (TEXT)
- `bookings.pre_checkin_token` (UUID), `bookings.pre_checkin_completed` (BOOLEAN)
- `properties.review_url`, `properties.whatsapp_phone_number_id`, `properties.whatsapp_access_token`

### Staff table columns
`id, property_id, user_id (nullable), name, role, phone, is_active, created_at`
- `user_id = null` → pre-created, invite not yet accepted
- `is_active = false` → revoked

---

## STAFF INVITE FLOW — COMPLETE

Owner goes to `/settings/staff` → clicks "Inviter" → fills name/email/role →
app calls `POST /api/staff/invite` → gets back an invite URL →
shows URL with Copy button + WhatsApp share button →
staff member opens URL `/accept-invite?token=XXX` →
creates password → account linked → can log in.

### API routes
- `POST /api/staff/invite` — owner only, creates invitation + pre-creates inactive staff record
- `POST /api/staff/revoke` — owner only, sets `is_active = false`
- `POST /api/staff/accept-invite` — public (called after signUp), links `user_id` to staff record

### Public routes (in `middleware.ts`)
`/login`, `/signup`, `/accept-invite`, `/api/staff/accept-invite` are public.
Everything else requires auth.

---

## SIDEBAR — ROLE-BASED

`components/layout/Sidebar.tsx` reads `useSession()` and filters nav groups by role rank.

- **housekeeping**: sees only "Plan des lits" + "Ménage"
- **receptionist**: sees Principal + Opérations groups
- **manager**: sees all three groups (Principal, Opérations, Analyse)
- **owner**: sees everything + Settings

Shows a staff identity badge (role + name) for non-owner users.

---

## DASHBOARD LAYOUT — STRUCTURE

`app/(dashboard)/layout.tsx` wraps every dashboard route with:
- `getUserSession()` → redirect to `/login` if unauthenticated
- `<SessionProvider session={session}>` — injects auth context for client components
- `<Sidebar />` — left nav (hidden on mobile)
- `<TopBar />` — frosted-glass header with live indicator + user chip
- `<main>` — scrollable content area
- `<MobileNav />` — bottom nav bar on mobile
- `<Toaster />` — Sonner toast notifications

**Do not simplify this layout.** All pieces are required.

---

## TOPBAR BEHAVIOUR

`components/layout/TopBar.tsx`:

- **Page title**: resolved by matching `pathname` against a sorted-by-length route map.
  More-specific routes (e.g. `/guests/new`) are matched before shorter prefixes (`/guests`).
- **Live indicator** (`LiveIndicator`): reads `realtimeConnected` from Zustand store.
  The store initialises to `null` (unknown). The indicator renders nothing until the first
  Supabase Realtime subscription fires `setRealtimeConnected(true/false)`.
  This avoids the "Reconnexion…" flicker on every page load.
- **User chip**: shows `staffName` if set, otherwise the role label (e.g. "Propriétaire").
  The role sub-label is only shown when `staffName` is non-null (prevents double "Propriétaire").

---

## WHAT'S BUILT (ALL WORKING)

| Feature | Status | Location |
|---|---|---|
| Login / Signup | ✅ | `app/(auth)/login/`, `app/(auth)/register/` |
| Onboarding wizard | ✅ | `app/onboarding/` |
| **Dashboard (command center)** | ✅ | `app/(dashboard)/dashboard/page.tsx` ← note: NOT root `/` |
| Live bed map | ✅ | `app/(dashboard)/beds/` |
| Calendar view (drag-resize) | ✅ | `app/(dashboard)/calendar/` |
| Guest list + detail | ✅ | `app/(dashboard)/guests/` |
| Check-in wizard (5 steps) | ✅ | `app/(dashboard)/guests/new/` |
| Bookings inbox + detail | ✅ | `app/(dashboard)/bookings/` |
| Payments + reconciliation | ✅ | `app/(dashboard)/payments/` |
| Reports / analytics | ✅ | `app/(dashboard)/reports/` |
| WhatsApp hub | ✅ | `app/(dashboard)/whatsapp/` |
| Maintenance log (kanban) | ✅ | `app/(dashboard)/maintenance/` |
| Night audit wizard | ✅ | `app/(dashboard)/night-audit/` |
| Fiche de police PDF | ✅ | `lib/pdf/fiche-police.ts` |
| Property settings | ✅ | `app/(dashboard)/settings/` |
| Room + bed configuration | ✅ | `app/(dashboard)/settings/rooms/` |
| Dynamic pricing rules | ✅ | `app/(dashboard)/settings/pricing/` |
| Integrations (WhatsApp API) | ✅ | `app/(dashboard)/settings/integrations/` |
| Staff management + invite flow | ✅ | `app/(dashboard)/settings/staff/` |
| Multi-user auth (owner + staff) | ✅ | `lib/supabase/server.ts`, `app/context/SessionContext.tsx` |
| Role-based sidebar | ✅ | `components/layout/Sidebar.tsx` |
| Accept-invite page | ✅ | `app/accept-invite/` |
| **Expenses tracking** | ✅ | `app/(dashboard)/expenses/` |
| **Housekeeping task management** | ✅ | `app/(dashboard)/housekeeping/` |
| **Activities & Events + WA broadcast** | ✅ | `app/(dashboard)/activities/` |
| Apple-style UI overhaul | ✅ | `app/globals.css`, all layout components |
| Mobile bottom nav | ✅ | `components/layout/MobileNav.tsx` |
| Real-time dashboard | ✅ | Supabase Realtime subscriptions |
| Activity log feed (dashboard) | ✅ | `activity_log` table + `lib/activity.ts` |
| Security middleware | ✅ | `proxy.ts` |
| Security headers | ✅ | `next.config.ts` |
| Rate limiting | ✅ | `lib/rate-limit.ts` |
| List pagination | ✅ | guests, bookings, payments pages |
| TopBar shows staff name | ✅ | `components/layout/TopBar.tsx` |

---

## WHAT STILL NEEDS TO BE BUILT

### HIGH PRIORITY
1. **Pre-arrival digital check-in flow** — Schema is ready (`bookings.pre_checkin_token`, `bookings.pre_checkin_completed`). Need a public page at `/checkin/[token]` where guests fill in their own data before arriving.

### MEDIUM PRIORITY
2. **Activity feed role filtering** — Staff shouldn't see revenue figures; housekeeping shouldn't see payment events.
3. **Inventory low-stock alerts** — `inventory_items.reorder_level` exists but no alert UI yet.
4. **Booking extras UI** — `booking_extras` table exists; no UI to add breakfast/extras to a booking.
5. **Guest blacklist enforcement** — `guests.is_flagged` exists; warning shown during check-in step 1 (`flagWarningGuest` state), but the UI for confirming and overriding the block needs review.
6. **Push notifications** — Supabase Realtime to notify receptionist when new booking comes in.

### NICE TO HAVE
7. **Dark mode** — CSS variables are set up, just needs a toggle + `dark:` Tailwind classes.
8. **Arabic RTL support** — Foundation exists (locale constant), just not wired up.
9. **Multi-property** — Schema supports it (`property_id` on everything), UI doesn't yet.

---

## WHAT STILL NEEDS EXTERNAL SETUP (future SaaS work)

- Billing: Stripe integration (subscription plans, trial)
- Error monitoring: Sentry.io
- CI/CD: GitHub Actions → Vercel deployment pipeline
- Staging environment
- GDPR: data export + deletion flow

---

## KEY FILES CHEAT SHEET

```
lib/supabase/server.ts               → getUserSession(), createClient()
lib/supabase/client.ts               → createClient() for browser (singleton)
app/context/SessionContext.tsx        → useSession(), useHasRole(), useCanDo()
lib/activity.ts                       → logActivity() — call after every important action
types/index.ts                        → All shared types (Staff, StaffRole, UserSession, Activity, etc.)
app/globals.css                       → Design system (shadows, animations, colors)
stores/app.store.ts                   → Zustand: realtimeConnected (null|bool), dirtyBedsCount, property
components/layout/Sidebar.tsx         → Role-based nav
components/layout/TopBar.tsx          → Frosted glass header + live indicator
components/layout/MobileNav.tsx       → Bottom navigation bar
components/dashboard/DashboardClient.tsx → Main dashboard component
app/actions/activities.ts             → Server actions: createActivityAction, deleteActivityAction, notifyGuestsAction
lib/whatsapp/templates.ts             → buildWhatsAppLink(), WHATSAPP_TEMPLATES
supabase/migrations/                  → All DB migrations (001–011)
```

---

## ACTIVITY LOGGING

Every significant action (check-in, check-out, payment, maintenance, etc.) must call `logActivity()`:

```typescript
import { logActivity } from '@/lib/activity'

logActivity({
  propertyId: property.id,
  userId: session?.userId ?? null,
  staffName: session?.staffName ?? null,
  actionType: 'check_in', // see activity_log table for valid types
  entityType: 'booking',
  entityId: booking.id,
  description: `Check-in : ${guestName}`,
  meta: { guest_name: guestName },
})
```

The dashboard feed reads from `activity_log` table via Supabase Realtime.

---

## ENVIRONMENT VARIABLES NEEDED

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
WHATSAPP_API_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
```

---

## CODING RULES

- No `any` types — use proper TypeScript
- All Supabase calls wrapped in try/catch
- Toast (Sonner) for all success/error feedback
- Currency: `new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(amount)` or `formatCurrency()` from `lib/utils`
- Dates: `format(date, 'dd MMMM yyyy', { locale: fr })` from date-fns
- Icons: Lucide React only
- Do NOT add features beyond what's asked — no speculative code
- Do NOT use `any` as a shortcut — fix the type properly
- Do NOT use `asChild` — this project uses @base-ui/react which doesn't support it
- Use `(e.target as Element).setPointerCapture(...)` not `e.target.setPointerCapture(...)` for pointer events
- JSX text containing apostrophes must use `&apos;`, quotes use `&ldquo;`/`&rdquo;` — raw `'` and `"` in JSX text are lint errors
- `Date.now()` in async server components is fine but ESLint flags it as `react-hooks/purity` — suppress with `// eslint-disable-next-line react-hooks/purity` on that line
- Recharts `YAxis tickFormatter`: use `v >= 1000 ? \`${(v/1000).toFixed(1).replace(/\.0$/,'')}k\` : String(v)` — the simple `(v/1000).toFixed(0)k` rounds small values incorrectly
- `realtimeConnected` in the Zustand store is `boolean | null`. `null` = still initialising (never connected yet). Components must guard against `null` before rendering connection status.

---

## KNOWN PATTERNS & GOTCHAS

### TopBar title resolution
Routes are sorted longest-first before matching so `/guests/new` → "Nouveau check-in" wins over `/guests` → "Clients". If you add a new nested route, add it to the `titles` map in `components/layout/TopBar.tsx`.

### Onboarding bed naming
Bed names are auto-generated as `{prefix}{n}`. The prefix is the trailing single letter of the room name if it exists ("Dortoir A" → "A", giving "A1"…"A6"), otherwise the first-two-initials fallback ("Chambre Privée 1" → "CP", giving "CP1"…"CP2"). This logic lives in `app/onboarding/page.tsx`.

### Dashboard greeting
`DashboardClient` greets with `session?.staffName || property.name`. Owners without a staff record see the property name as their greeting name.

### CalendarClient — refreshBookings order
`refreshBeds` and `refreshBookings` useCallbacks **must** be declared before the drag `useEffect` that calls `refreshBookings()` on rollback. Moving them after the effect causes a "used before declared" lint error and stale-closure bugs.
