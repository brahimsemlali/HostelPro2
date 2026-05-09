# HostelPro — Handoff Brief for New Claude Session
# Read this FIRST before touching any code.

---

## WHAT THIS IS

**Sweet Reservation** (formerly HostelPro) — a hostel/auberge management SaaS for the Moroccan market.
Production-grade, not a prototype. French UI, MAD currency, Moroccan police form (fiche de police) generation.
Stack: Next.js App Router · Supabase (Postgres + RLS + Auth) · **@base-ui/react** · Tailwind CSS v3 · TypeScript strict.

Working directory: `/Users/strapexmaroc/Stayy/hostelpro`
Dev server: `npm run dev` (port 3000)
GitHub: `https://github.com/brahimsemlali/HostelPro2`
Live domain: `https://www.sweetreservation.com` (Vercel, verified on Google Search Console)

---

## ACTUAL NEXT.JS VERSION

This project runs **Next.js 16.2.2** (not 14 as the original spec says).
The App Router is used. Do NOT use Pages Router patterns.

---

## ⚠️ CRITICAL — MIDDLEWARE FILE NAME

Next.js 16 uses **`proxy.ts`** (not `middleware.ts`) as the edge middleware file.
The function must be named `export async function proxy(request: NextRequest)`.
Do NOT create or rename to `middleware.ts` — Next.js 16 will error if both exist.

### Auth logic in `proxy.ts`
- `'/'` is **exact-matched** (`pathname === '/'`), not prefix-matched — putting `'/'` in a `startsWith` array would make every route public (all paths start with `/`)
- Authenticated users hitting `/`, `/login`, or `/register` are redirected to `/dashboard`
- Unauthenticated users hitting protected routes are redirected to `/login?next=<pathname>`
- Public prefixes: `/login`, `/register`, `/forgot-password`, `/reset-password`, `/accept-invite`, `/checkin`, `/api/auth`, `/api/staff/accept-invite`, `/api/webhooks/lemonsqueezy`
- Marketing/SEO pages are public: `/blog`, `/logiciel-hostel-*`, `/sitemap.xml`, `/robots.txt`, `/og-image`

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
- **Navigation loader**: `hp-nav-spin` + `hp-nav-pulse` keyframes in `globals.css`, used by `NavigationLoader`
- **Color space**: `oklch()` used for muted text (`oklch(0.42 0 0)`, `oklch(0.55 0 0)`, `oklch(0.65 0 0)`)
- **Border radius global**: `0.75rem`
- **Typography**: system font stack, font-weight 500 for headings (never 700). Black weight (`font-black`) used for metric values and emphasis.
- **Text color**: `#0A1F1C` for primary headings (near-black teal), `text-muted-foreground` for secondary

Do NOT introduce generic/purple gradient aesthetics. Keep the Apple-minimal direction.

---

## BILLING — LEMONSQUEEZY (LIVE)

LemonSqueezy is the payment processor. Stripe is NOT used.

### Store details
- Store ID: `370406`
- Store URL: `https://sweetreservation.lemonsqueezy.com`
- Variant IDs (in `lib/constants.ts`):
  - Starter: `1633090`
  - Pro: `1633110`

### Environment variables (all set in Vercel + `.env.local`)
```env
LEMONSQUEEZY_API_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9...
LEMONSQUEEZY_STORE_ID=370406
LEMONSQUEEZY_WEBHOOK_SECRET=sweetreservation2026secret
LEMONSQUEEZY_STARTER_VARIANT_ID=1633090
LEMONSQUEEZY_PRO_VARIANT_ID=1633110
```

### API routes
- `POST /api/billing/checkout` — owner-only, creates a LS checkout with `property_id` in `custom_data`, returns `{ url }` for redirect
- `POST /api/webhooks/lemonsqueezy` — **public** (no auth), verifies HMAC-SHA256 (`X-Signature` header), upserts `subscriptions` table via service-role client

### Webhook security
- Uses `crypto.timingSafeEqual` — never use string comparison for HMAC
- Raw body must be read with `request.text()` (not `request.json()`) before HMAC check
- Webhook secret must be alphanumeric-only — special chars (`!`, `#`) break LS webhook creation silently

### Subscriptions table
Schema: `id, property_id (unique), provider, status, ls_subscription_id, ls_variant_id, current_period_end, updated_at, created_at`

Key migration: `018_subscriptions_updated_at.sql` — adds `updated_at` column needed by webhook upsert.

### Plan-aware signup flow
Landing page CTA → `/register?plan=starter|pro` → onboarding wizard (passes `?plan=`) → billing page (`/settings/billing?checkout=starter|pro`) → auto-triggers checkout via `useEffect` on mount → LemonSqueezy hosted checkout → webhook fires → subscription activated.

`BillingClient.tsx` auto-trigger:
```typescript
useEffect(() => {
  const planKey = new URLSearchParams(window.location.search).get('checkout')
  if (!planKey) return
  const match = BILLING_PLANS.find(p => p.id.startsWith(planKey))
  if (match) handleCheckout(match.ls_variant_id)
  window.history.replaceState({}, '', window.location.pathname) // clean URL
}, [])
```

### LS store verification
As of May 2026, the LS store may still be in verification (1–3 business days). Live checkouts only work after verification. Test mode works immediately.

---

## MULTI-USER AUTH — FULLY IMPLEMENTED

The app supports **owner + staff sub-accounts**.

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

### Role-based login redirects
- **housekeeping** → redirected to `/beds` on login (not `/dashboard`)
- All other roles → `/dashboard`
This redirect is applied in `app/(dashboard)/dashboard/page.tsx` after `getUserSession()`.

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
| `009_performance_indexes.sql` | Performance indexes |
| `010_activities_and_automation.sql` | `activities` table (hostel events with WhatsApp broadcast) |
| `011_owner_whatsapp_api.sql` | Adds `whatsapp_phone_number_id`, `whatsapp_access_token` to `properties` |
| `016_payments_performance_index.sql` | Composite index on `payments(property_id, status, type, payment_date DESC)` |
| `017_fix_view_security.sql` | Security fix for views |
| `018_subscriptions_updated_at.sql` | Adds `updated_at TIMESTAMPTZ` to `subscriptions` table (needed by LS webhook upsert) |

### `subscriptions` table
Added for LemonSqueezy billing. Key columns:
`id, property_id (UNIQUE), provider ('lemonsqueezy'|'manual_wire'), status ('active'|'trialing'|'past_due'|'cancelled'|'expired'), ls_subscription_id, ls_variant_id, current_period_end, updated_at, created_at`

The billing page (`/settings/billing`) reads from this table to show current status.

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

### Public routes (in `proxy.ts`)
`/login`, `/register`, `/accept-invite`, `/checkin`, `/api/auth`, `/api/staff/accept-invite`, `/api/webhooks/lemonsqueezy` are public.
`/` is public for unauthenticated visitors (shows landing page); authenticated users are redirected to `/dashboard`.
Everything else requires auth.

---

## SEO & MARKETING PAGES — BUILT

### Domain
`www.sweetreservation.com` — verified on Google Search Console, sitemap submitted.

### City landing pages (6 cities)
Located at `app/logiciel-hostel-{city}/page.tsx`. All use the shared `components/marketing/CityPage.tsx` component.
Cities: `marrakech`, `agadir`, `casablanca`, `fes`, `tanger`, `chefchaouen`
Data source: `lib/city-data.ts` — hero content, challenges, stats, testimonials, FAQs, keywords per city.

Each city page exports:
- `generateMetadata()` with city-specific title/description/OG
- `SoftwareApplication` JSON-LD schema
- `BreadcrumbList` JSON-LD schema

### Blog
- Index: `app/blog/page.tsx`
- Articles: `app/blog/[slug]/page.tsx`
- Data: `lib/blog-posts.ts` — 4 articles:
  - `fiche-de-police-hostel-maroc`
  - `booking-com-vs-hostelworld-maroc`
  - `ouvrir-hostel-maroc-guide`
  - `excel-vs-logiciel-pms-hostel`

Each article exports `Article` + `BreadcrumbList` JSON-LD schemas.

### AI crawler discovery files
- `public/llms.txt` — plain-text product summary for LLMs (2025/2026 standard)
- `public/llms-full.md` — extended markdown version
- `public/.well-known/ai-plugin.json` — AI plugin manifest

### Sitemap
`app/sitemap.ts` dynamically includes city pages and blog slugs.

### Structured data in root layout
`app/layout.tsx` includes a `SoftwareApplication` JSON-LD schema with `UnitPriceSpecification` pricing for both plans.

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

## NAVIGATION LOADER

`components/shared/NavigationLoader.tsx` — replaces the old `NextTopLoader`.

- Client component registered in `app/layout.tsx`
- Listens for clicks on internal `<a>` tags
- Shows a frosted-glass overlay with a spinning Globe icon + pulse ring while the new page loads
- Hides as soon as `usePathname()` changes (new page rendered)
- Keyframes `hp-nav-spin` and `hp-nav-pulse` are defined in `app/globals.css`

Do NOT re-add `NextTopLoader` or any other page progress bar — `NavigationLoader` handles this.

The loader intercepts three navigation types:
1. Clicks on internal `<a>` / `<Link>` elements
2. `router.push()` / `router.replace()` — via `window.history.pushState` monkey-patch
3. Browser back / forward — via `popstate` event

---

## PERFORMANCE PATTERNS — ESTABLISHED

### Dynamic imports (use for heavy components)
All large components use `next/dynamic` with `ssr: false`:
```typescript
const OccupancyChart = dynamic(() => import('@/components/dashboard/OccupancyChart'), { ssr: false })
const ReportsClient = dynamic(() => import('./ReportsClient'), { ssr: false })
// Modals and sheets: always lazy-load
const CreateActivityModal = dynamic(() => import('./CreateActivityModal').then(m => ({ default: m.CreateActivityModal })), { ssr: false })
```

### Supabase query rules
- **Never use `select('*')`** — always list explicit columns. This keeps bundles smaller and avoids over-fetching.
- **Embed related data** instead of sequential fetches: use Supabase nested select syntax (`booking_payments:payments(booking_id, amount, type, status)`).
- **Unbounded queries** must have `.limit()` — e.g. payments page uses `.limit(2000)`.
- Supabase joins return **arrays** even for single-record relations. Use `as unknown as ExpectedType` at the JSX call site, not in the data-fetching layer.

### Realtime subscription stability
- Never put derived state (e.g. `beds.length`) in `useCallback` deps that feed a Realtime `useEffect`.
  Instead, use `useRef` updated in the same setter call: `bedsLengthRef.current = newBeds.length`.
- Realtime channel names must be stable — do NOT include date or page-state in channel names
  (e.g. `calendar-live-${propertyId}` not `calendar-live-${propertyId}-${startDate}`).

### Dashboard data fetching
- All arrivals (today / tomorrow / this week) fetched in one query, split in JS afterwards.
- `allCheckedInRes` runs inside the main `Promise.all`, not sequentially after it.
- Payments per booking computed from embedded data — no second round-trip.

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
| **Booking extras add/delete** | ✅ | `app/(dashboard)/bookings/[id]/BookingDetailClient.tsx` |
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
| **Billing page (LemonSqueezy)** | ✅ | `app/(dashboard)/settings/billing/` |
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
| **Activity feed role filtering** | ✅ | `components/dashboard/DashboardClient.tsx` |
| **Navigation loader (globe)** | ✅ | `components/shared/NavigationLoader.tsx` — catches clicks, `router.push()`, back/forward |
| **Landing page** | ✅ | `app/page.tsx` — public marketing page at `/`, CTAs link to `/register?plan=X` |
| **Plan-aware signup flow** | ✅ | Landing → `/register?plan=X` → onboarding → `/settings/billing?checkout=X` → LS checkout |
| **LemonSqueezy billing integration** | ✅ | `app/api/billing/checkout/route.ts`, `app/api/webhooks/lemonsqueezy/route.ts` |
| **Subscriptions table** | ✅ | Tracks active plan per property, read by billing page |
| **City SEO landing pages (6)** | ✅ | `app/logiciel-hostel-{city}/page.tsx` + `components/marketing/CityPage.tsx` |
| **Blog (index + articles)** | ✅ | `app/blog/page.tsx`, `app/blog/[slug]/page.tsx`, `lib/blog-posts.ts` |
| **AI crawler files** | ✅ | `public/llms.txt`, `public/llms-full.md`, `public/.well-known/ai-plugin.json` |
| **Sitemap (dynamic)** | ✅ | `app/sitemap.ts` — includes city pages + blog posts |
| **JSON-LD structured data** | ✅ | SoftwareApplication + BreadcrumbList + Article schemas |
| Security middleware | ✅ | `proxy.ts` (Next.js 16 convention — NOT middleware.ts) |
| Security headers | ✅ | `next.config.ts` |
| Rate limiting | ✅ | `lib/rate-limit.ts` |
| List pagination | ✅ | guests, bookings, payments pages |
| TopBar shows staff name | ✅ | `components/layout/TopBar.tsx` |

---

## WHAT STILL NEEDS TO BE BUILT

### HIGH PRIORITY
1. **Pre-arrival digital check-in flow** — Schema is ready (`bookings.pre_checkin_token`, `bookings.pre_checkin_completed`). Need a public page at `/checkin/[token]` where guests fill in their own data before arriving.

### MEDIUM PRIORITY
2. **Inventory low-stock alerts** — `inventory_items.reorder_level` exists but no alert UI yet.
3. **Guest blacklist enforcement** — `guests.is_flagged` exists; warning shown during check-in step 1 (`flagWarningGuest` state), but the UI for confirming and overriding the block needs review.
4. **Push notifications** — Supabase Realtime to notify receptionist when new booking comes in.

### NICE TO HAVE
5. **Dark mode** — CSS variables are set up, just needs a toggle + `dark:` Tailwind classes.
6. **Arabic RTL support** — Foundation exists (locale constant), just not wired up.
7. **Multi-property** — Schema supports it (`property_id` on everything), UI doesn't yet.

---

## WHAT STILL NEEDS EXTERNAL SETUP

- LemonSqueezy store verification — pending (1–3 business days). Live checkouts only after approval.
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
lib/constants.ts                      → BILLING_PLANS (with ls_variant_id), BANK_WIRE_DETAILS
lib/city-data.ts                      → Data for 6 city landing pages
lib/blog-posts.ts                     → Blog articles metadata + content
types/index.ts                        → All shared types (Staff, StaffRole, UserSession, Subscription, etc.)
app/globals.css                       → Design system (shadows, animations, colors, nav-loader keyframes)
stores/app.store.ts                   → Zustand: realtimeConnected (null|bool), dirtyBedsCount, property
components/layout/Sidebar.tsx         → Role-based nav
components/layout/TopBar.tsx          → Frosted glass header + live indicator
components/layout/MobileNav.tsx       → Bottom navigation bar
components/shared/NavigationLoader.tsx → Globe page-transition overlay (registered in app/layout.tsx)
components/marketing/CityPage.tsx     → Shared city landing page component (framer-motion, dark hero)
components/dashboard/DashboardClient.tsx → Main dashboard component
app/actions/activities.ts             → Server actions: createActivityAction, deleteActivityAction, notifyGuestsAction
app/api/billing/checkout/route.ts     → POST: creates LemonSqueezy checkout, returns redirect URL
app/api/webhooks/lemonsqueezy/route.ts → POST: public webhook, verifies HMAC, upserts subscriptions
app/(dashboard)/settings/billing/BillingClient.tsx → Billing UI with auto-checkout trigger
lib/whatsapp/templates.ts             → buildWhatsAppLink(), WHATSAPP_TEMPLATES
supabase/migrations/                  → All DB migrations (001–018)
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

### Activity feed role filtering
`payment` and `booking_created` action types are filtered out for staff without `view_revenue`.
This is applied in `DashboardClient.tsx` using `canViewRevenue` from `useCanDo('view_revenue')`.

---

## ENVIRONMENT VARIABLES NEEDED

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=https://www.sweetreservation.com
WHATSAPP_API_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
LEMONSQUEEZY_API_KEY=
LEMONSQUEEZY_STORE_ID=370406
LEMONSQUEEZY_WEBHOOK_SECRET=sweetreservation2026secret
LEMONSQUEEZY_STARTER_VARIANT_ID=1633090
LEMONSQUEEZY_PRO_VARIANT_ID=1633110
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
- Do NOT use `select('*')` in Supabase queries — always list explicit columns
- Do NOT add `console.error` / `console.warn` — handle errors silently via toast or return values
- Use `(e.target as Element).setPointerCapture(...)` not `e.target.setPointerCapture(...)` for pointer events
- JSX text containing apostrophes must use `&apos;`, quotes use `&ldquo;`/`&rdquo;` — raw `'` and `"` in JSX text are lint errors
- `Date.now()` in async server components is fine but ESLint flags it as `react-hooks/purity` — suppress with `// eslint-disable-next-line react-hooks/purity` on that line
- Recharts `YAxis tickFormatter`: use `v >= 1000 ? \`${(v/1000).toFixed(1).replace(/\.0$/,'')}k\` : String(v)` — the simple `(v/1000).toFixed(0)k` rounds small values incorrectly
- `realtimeConnected` in the Zustand store is `boolean | null`. `null` = still initialising (never connected yet). Components must guard against `null` before rendering connection status.
- framer-motion `ease` arrays: cast as `[number, number, number, number]` not `number[]` — the Variants type is strict about this

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

### Supabase join type mismatch
Supabase JS returns embedded relations (e.g. `guest:guest_id(...)`, `bed:bed_id(...)`) as arrays even for single-record joins. At the JSX call site, use:
```typescript
booking={booking as unknown as Parameters<typeof BookingDetailClient>[0]['booking']}
```
Do not try to normalise these in the query layer — the `as unknown as` assertion at the prop boundary is the accepted pattern.

### Realtime re-subscription loop
Never put derived-from-state values (e.g. `beds.length`, `startDate`) inside `useCallback` deps that feed a Realtime `useEffect`. Use `useRef` instead:
```typescript
const bedsLengthRef = useRef(initialData.beds.length)
setBeds((prev) => { bedsLengthRef.current = next.length; return next })
// refreshForecast uses bedsLengthRef.current — not in deps → no loop
```

### LemonSqueezy webhook gotchas
- Always read body with `request.text()` before any `await request.json()` — HMAC must be over raw bytes
- Webhook signing secret must be alphanumeric only — LS silently fails to create webhooks with special characters
- `CREATE POLICY IF NOT EXISTS` is invalid PostgreSQL syntax — do not use it in migrations
- The service-role Supabase client bypasses RLS — always use it in webhook routes, never the anon client

### CityPage component (framer-motion)
`components/marketing/CityPage.tsx` uses framer-motion. The `fadeUpProps(i)` helper returns inline animation props — do NOT use a `Variants`-typed object because framer-motion's `Easing` type doesn't accept `number[]` directly. Use:
```typescript
ease: [0.22, 1, 0.36, 1] as [number, number, number, number]
```
