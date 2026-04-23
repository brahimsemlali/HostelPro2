# HostelPro — SaaS Readiness Task List
# Instructions for Claude Code
# ============================================================
# READ THIS FIRST BEFORE TOUCHING ANY CODE.
#
# Working directory: /Users/strapexmaroc/Stayy/hostelpro
# Stack: Next.js 16.2.2 App Router · Supabase · Tailwind v4 · TypeScript strict
# Dev server: export PATH="/usr/local/bin:$PATH" && npm run dev (port 3000)
# Build check: export PATH="/usr/local/bin:$PATH" && npm run build
#
# RULES:
# - No `any` types — fix types properly
# - All Supabase calls wrapped in try/catch
# - No speculative features — only what's listed here
# - After every task group, run: npm run build to verify no TypeScript errors
# - Read node_modules/next/dist/docs/ before writing Next.js-specific code
# - Keep Apple-minimal design unchanged (do NOT alter UI styles)
# ============================================================

---

## TASK GROUP 1 — Next.js Middleware (CRITICAL — do first)

### Task 1.1 — Create `middleware.ts`

**File to create:** `/Users/strapexmaroc/Stayy/hostelpro/middleware.ts`

**Purpose:** This file must sit at the project root (not inside `app/` or `src/`).
It serves two functions:
1. Refresh the Supabase auth session cookie on every request (required for SSR)
2. Redirect unauthenticated users away from protected routes

**Implementation:**

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that DO NOT require authentication
const PUBLIC_ROUTES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/accept-invite',
  '/checkin',           // public pre-check-in page
  '/api/auth/login',
  '/api/auth/register',
  '/api/staff/accept-invite',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public routes and Next.js internals
  const isPublic =
    PUBLIC_ROUTES.some((r) => pathname.startsWith(r)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')

  // Create a response that we can mutate cookies on
  let response = NextResponse.next({ request })

  // Always refresh the Supabase session (keeps JWT fresh)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Redirect unauthenticated users to login for protected routes
  if (!user && !isPublic) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect authenticated users away from auth pages
  if (user && (pathname === '/login' || pathname === '/register')) {
    const homeUrl = request.nextUrl.clone()
    homeUrl.pathname = '/'
    return NextResponse.redirect(homeUrl)
  }

  return response
}

export const config = {
  // Match everything except static files
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

**After creating:** Run `npm run build` — should compile without errors.

---

### Task 1.2 — Add Security Headers to `next.config.ts`

**File to modify:** `/Users/strapexmaroc/Stayy/hostelpro/next.config.ts`

**Replace the entire file with:**

```typescript
import type { NextConfig } from 'next'

const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",  // unsafe-eval needed for Next.js dev
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL} wss://*.supabase.co`,
      "font-src 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
```

---

## TASK GROUP 2 — Rate Limiting

### Task 2.1 — Create Rate Limiting Utility

**File to create:** `/Users/strapexmaroc/Stayy/hostelpro/lib/rate-limit.ts`

**Purpose:** Simple in-memory rate limiter for API routes. Uses a sliding window approach.
For production at scale, replace with Redis/Upstash, but this is correct for initial SaaS launch.

```typescript
/**
 * Simple in-memory rate limiter using a sliding window.
 * For production scale, replace the store with Upstash Redis.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

// Store: key → { count, resetAt }
const store = new Map<string, RateLimitEntry>()

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) store.delete(key)
  }
}, 5 * 60 * 1000)

export interface RateLimitOptions {
  /** Unique key (e.g. IP + route) */
  key: string
  /** Max requests allowed in the window */
  limit: number
  /** Window size in seconds */
  windowSeconds: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

export function rateLimit({ key, limit, windowSeconds }: RateLimitOptions): RateLimitResult {
  const now = Date.now()
  const windowMs = windowSeconds * 1000

  const entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    // New window
    const resetAt = now + windowMs
    store.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: limit - 1, resetAt }
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count++
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt }
}

/**
 * Get the real client IP from Next.js request headers.
 * Handles proxies (Vercel, Cloudflare, etc.)
 */
export function getClientIp(req: Request): string {
  const headers = req instanceof Request ? req.headers : new Headers()
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  )
}
```

---

### Task 2.2 — Apply Rate Limiting to Auth API Routes

**File to modify:** `/Users/strapexmaroc/Stayy/hostelpro/app/api/auth/login/route.ts`

Apply rate limit: **10 attempts per IP per 15 minutes** for login.

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  // Rate limiting: 10 login attempts per IP per 15 minutes
  const ip = getClientIp(req)
  const rl = rateLimit({ key: `login:${ip}`, limit: 10, windowSeconds: 900 })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
        },
      }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
  }

  const { email, password } = body as Record<string, unknown>
  if (typeof email !== 'string' || !email.includes('@') || typeof password !== 'string' || password.length < 6) {
    return NextResponse.json({ error: 'Email ou mot de passe invalide' }, { status: 400 })
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return NextResponse.json({ error: error.message }, { status: 401 })
  return NextResponse.json({ ok: true, email: data.user?.email })
}
```

---

**File to modify:** `/Users/strapexmaroc/Stayy/hostelpro/app/api/auth/register/route.ts`

Apply rate limit: **5 registrations per IP per hour**.

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  // Rate limiting: 5 registrations per IP per hour
  const ip = getClientIp(req)
  const rl = rateLimit({ key: `register:${ip}`, limit: 5, windowSeconds: 3600 })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Trop de tentatives. Réessayez dans une heure.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
  }

  const { email, password } = body as Record<string, unknown>
  if (
    typeof email !== 'string' ||
    !email.includes('@') ||
    typeof password !== 'string' ||
    password.length < 8
  ) {
    return NextResponse.json(
      { error: 'Email invalide ou mot de passe trop court (8 caractères minimum)' },
      { status: 400 }
    )
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  if (data.session) {
    return NextResponse.json({ ok: true, needsConfirmation: false })
  }

  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
  if (!signInError && signInData.session) {
    return NextResponse.json({ ok: true, needsConfirmation: false })
  }

  return NextResponse.json({ ok: true, needsConfirmation: true })
}
```

---

### Task 2.3 — Apply Rate Limiting to Staff Invite API

**File to modify:** `/Users/strapexmaroc/Stayy/hostelpro/app/api/staff/invite/route.ts`

Add at the top of the POST handler (before the `getUserSession()` call):

```typescript
import { rateLimit, getClientIp } from '@/lib/rate-limit'

// Inside POST, add BEFORE getUserSession():
const ip = getClientIp(req)
const rl = rateLimit({ key: `invite:${ip}`, limit: 20, windowSeconds: 3600 })
if (!rl.allowed) {
  return NextResponse.json({ error: 'Trop de requêtes.' }, { status: 429 })
}
```

---

## TASK GROUP 3 — Input Validation on Server Actions

### Task 3.1 — Harden `loginAction` and `registerAction`

**File to modify:** `/Users/strapexmaroc/Stayy/hostelpro/app/actions/auth.ts`

Add input validation to `loginAction` and `registerAction`:

- `loginAction`: validate email is non-empty string, password is non-empty
- `registerAction`: validate email contains `@`, password is at least 8 characters

Add these checks at the top of each action, before any Supabase call:

```typescript
// loginAction validation:
if (!email || typeof email !== 'string' || !email.includes('@')) {
  return { error: 'Email invalide' }
}
if (!password || typeof password !== 'string' || password.length < 1) {
  return { error: 'Mot de passe requis' }
}

// registerAction validation:
if (!email || typeof email !== 'string' || !email.includes('@')) {
  return { error: 'Email invalide' }
}
if (!password || typeof password !== 'string' || password.length < 8) {
  return { error: 'Le mot de passe doit contenir au moins 8 caractères' }
}
```

---

## TASK GROUP 4 — Pagination for Large Data Lists

### Task 4.1 — Paginate Guests List

**File to modify:** `/Users/strapexmaroc/Stayy/hostelpro/app/(dashboard)/guests/page.tsx`

**Problem:** Currently loads ALL guests for a property with no limit. A hostel with years of data could load thousands of records.

**Fix:** Add server-side pagination with a page size of 100. Accept a `?page=N` search param.

The page component now receives `{ searchParams }` and uses `.range(offset, offset + PAGE_SIZE - 1)`:

```typescript
import { redirect } from 'next/navigation'
import { createClient, getUserSession } from '@/lib/supabase/server'
import { GuestsClient } from './GuestsClient'

const PAGE_SIZE = 100

export default async function GuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const session = await getUserSession()
  if (!session) redirect('/login')

  const supabase = await createClient()

  const { data: property } = await supabase
    .from('properties')
    .select('id')
    .eq('id', session.propertyId)
    .single()
  if (!property) redirect('/onboarding')

  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const offset = (page - 1) * PAGE_SIZE

  const [guestsRes, checkedInRes, countRes] = await Promise.all([
    supabase
      .from('guests')
      .select('id, first_name, last_name, nationality, document_number, phone, whatsapp, total_stays, total_spent, is_flagged, created_at')
      .eq('property_id', property.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1),

    supabase
      .from('bookings')
      .select('guest_id')
      .eq('property_id', property.id)
      .eq('status', 'checked_in'),

    supabase
      .from('guests')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', property.id),
  ])

  const checkedInGuestIds = new Set(
    (checkedInRes.data ?? []).map((b) => b.guest_id).filter(Boolean) as string[]
  )

  const totalCount = countRes.count ?? 0
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <GuestsClient
      guests={guestsRes.data ?? []}
      checkedInGuestIds={Array.from(checkedInGuestIds)}
      page={page}
      totalPages={totalPages}
      totalCount={totalCount}
    />
  )
}
```

**Also update `GuestsClient.tsx`** to accept and display the new pagination props:
- Add `page: number`, `totalPages: number`, `totalCount: number` to its props interface
- Add a simple "Page X of Y — Showing N guests" indicator below the table
- Add Previous/Next navigation buttons that change the `?page=N` URL param (use `router.push`)
- Do NOT change any styling — keep the existing look

---

### Task 4.2 — Paginate Bookings List

**File to modify:** `/Users/strapexmaroc/Stayy/hostelpro/app/(dashboard)/bookings/page.tsx`

**Problem:** Uses `.limit(200)` hardcoded. With hundreds of clients × hundreds of bookings each, this is unsustainable.

**Fix:** Same pattern as Task 4.1. PAGE_SIZE = 50. Accept `?page=N` from searchParams.

Use `.range(offset, offset + PAGE_SIZE - 1)` and pass `page`, `totalPages`, `totalCount` to `BookingsClient`.

Update `BookingsClient.tsx` to accept and display pagination props (same approach as Guests — a simple indicator + prev/next buttons). Keep all existing styling.

---

### Task 4.3 — Paginate Payments Today View & Add Date Range Filter

**File to modify:** `/Users/strapexmaroc/Stayy/hostelpro/app/(dashboard)/payments/page.tsx`

**Problem:** `todayPayments` is unbounded (could be hundreds for a busy hostel). `allBookings` and `allPayments` are completely unbounded — fetches every active booking and every completed payment for the property.

**Fix:**
- `todayPayments`: add `.limit(100)` — 100 payments in a single day is enough for any hostel
- `allBookings` (for pending calculation): add `.limit(500)` — reasonable upper bound for active bookings
- `allPayments` (for reconciliation): scope to last 90 days only: `.gte('payment_date', ninetyDaysAgo)`
  Compute `ninetyDaysAgo` as: `new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]`
- `guests` (for modal): add `.limit(200)` and select only `id, first_name, last_name`
- `bookingsForModal`: already scoped to active statuses — add `.limit(100)`

---

## TASK GROUP 5 — Replace `select('*')` on High-Traffic Pages

### Task 5.1 — Replace `select('*')` in Dashboard

**File to modify:** `/Users/strapexmaroc/Stayy/hostelpro/app/(dashboard)/page.tsx`

Line 14 fetches the property with `select('*')`. Replace with only the columns the dashboard actually uses:

```typescript
.select('id, name, city, check_in_time, check_out_time, currency, review_url')
```

---

### Task 5.2 — Replace `select('*')` in Payments Page

**File to modify:** `/Users/strapexmaroc/Stayy/hostelpro/app/(dashboard)/payments/page.tsx`

Line 12: `.from('properties').select('*')` → replace with:
```typescript
.select('id, name, currency')
```

---

### Task 5.3 — Replace `select('*')` in Night Audit Page

**File to modify:** `/Users/strapexmaroc/Stayy/hostelpro/app/(dashboard)/night-audit/page.tsx`

Line 14: `.from('properties').select('*')` → replace with:
```typescript
.select('id, name, city, police_prefecture')
```

Lines 24 & 30 — `guest:guest_id(*)` are selectd in the bookings joins. Replace with specific fields:
```typescript
'*, guest:guest_id(first_name, last_name, nationality, document_number, gender, date_of_birth, country_of_residence)'
```

---

### Task 5.4 — Replace `select('*')` in Reports Page

**File to modify:** `/Users/strapexmaroc/Stayy/hostelpro/app/(dashboard)/reports/page.tsx`

Line 15: `.from('properties').select('*')` → replace with:
```typescript
.select('id, name, currency')
```

---

### Task 5.5 — Replace `select('*')` in WhatsApp Page

**File to modify:** `/Users/strapexmaroc/Stayy/hostelpro/app/(dashboard)/whatsapp/page.tsx`

Line 14: `.from('properties').select('*')` → replace with:
```typescript
.select('id, name, phone')
```

Line 29: `guest:guest_id(*)` in activeBookings join → replace with:
```typescript
'*, guest:guest_id(first_name, last_name, phone, whatsapp)'
```

---

### Task 5.6 — Replace `select('*')` in Settings Page

**File to modify:** `/Users/strapexmaroc/Stayy/hostelpro/app/(dashboard)/settings/page.tsx`

Line 13: `.from('properties').select('*')` → keep as-is. Settings page needs all property fields for editing.

---

### Task 5.7 — Replace `select('*')` in Staff Settings Page

**File to modify:** `/Users/strapexmaroc/Stayy/hostelpro/app/(dashboard)/settings/staff/page.tsx`

Lines 15 & 21: `.select('*')` on `staff` and `staff_invitations`. Replace with:
```typescript
// staff:
.select('id, name, role, phone, is_active, hide_revenue, user_id, created_at')

// staff_invitations:
.select('id, email, name, role, token, expires_at, created_at')
```

---

## TASK GROUP 6 — Singleton Supabase Browser Client

### Task 6.1 — Singleton Pattern for Browser Supabase Client

**File to modify:** `/Users/strapexmaroc/Stayy/hostelpro/lib/supabase/client.ts`

**Problem:** Every component that imports `createClient()` creates a new Supabase browser client instance. This wastes memory and can cause realtime subscription duplicates.

**Replace with:**

```typescript
import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

export function createClient(): SupabaseClient {
  if (client) return client
  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  return client
}
```

---

## TASK GROUP 7 — TopBar Shows Staff Name

### Task 7.1 — Fix TopBar to Show Staff Identity

**File to modify:** `/Users/strapexmaroc/Stayy/hostelpro/components/layout/TopBar.tsx`

**Problem:** CLAUDE.md notes "TopBar shows staff name — currently shows owner info. Should show `session.staffName` for staff users."

Read the current `TopBar.tsx` first. Find where the user display name / email is rendered.

Apply this logic:
- Use `useSession()` from `@/app/context/SessionContext`
- If `session.isOwner` → show existing owner display (unchanged)
- If `!session.isOwner` → show `session.staffName` as the primary name, and the role badge next to it (e.g. "Réceptionniste")
- Do NOT change any styles — just the data being displayed

---

## TASK GROUP 8 — Database Migration for Indexes on New Tables

### Task 8.1 — Create Migration 009

**File to create:** `/Users/strapexmaroc/Stayy/hostelpro/supabase/migrations/009_performance_indexes.sql`

```sql
-- ============================================================
-- Migration 009: Additional performance indexes
-- Run this in your Supabase SQL Editor
-- ============================================================

-- activity_log: used constantly on dashboard
CREATE INDEX IF NOT EXISTS activity_log_property_type
  ON activity_log(property_id, action_type, created_at DESC);

-- bookings: guest lookup (used in guest detail page)
CREATE INDEX IF NOT EXISTS bookings_guest_id_idx
  ON bookings(guest_id);

-- bookings: source reporting
CREATE INDEX IF NOT EXISTS bookings_source_idx
  ON bookings(property_id, source);

-- payments: booking reconciliation (used in payments page)
CREATE INDEX IF NOT EXISTS payments_booking_status_idx
  ON payments(booking_id, status);

-- guests: flagged guests filter
CREATE INDEX IF NOT EXISTS guests_flagged_idx
  ON guests(property_id, is_flagged)
  WHERE is_flagged = TRUE;

-- staff_invitations: token lookup (used during accept-invite flow)
CREATE INDEX IF NOT EXISTS staff_invitations_token_idx
  ON staff_invitations(token);

-- staff_invitations: email + property (used during invite creation)
CREATE INDEX IF NOT EXISTS staff_invitations_email_property_idx
  ON staff_invitations(property_id, email);
```

Note to Claude Code: This file does NOT auto-run. Tell the user to paste it into Supabase SQL Editor after all code tasks are complete.

---

## TASK GROUP 9 — Verification

### Task 9.1 — TypeScript Build Check

After completing all tasks above, run:
```bash
export PATH="/usr/local/bin:$PATH" && npm run build
```

Fix all TypeScript errors before considering the work done.

### Task 9.2 — Verify Middleware Works

Start the dev server:
```bash
export PATH="/usr/local/bin:$PATH" && npm run dev
```

Open http://localhost:3000 in a browser (using the browser tool if available).
Verify:
1. Visiting `http://localhost:3000/` while logged out redirects to `/login` ✓
2. Visiting `http://localhost:3000/login` while logged in redirects to `/` ✓
3. The app loads normally when logged in ✓

### Task 9.3 — Update CLAUDE.md

**File to modify:** `/Users/strapexmaroc/Stayy/hostelpro/CLAUDE.md`

At the bottom of the "WHAT'S BUILT (ALL WORKING)" table, add new rows:
| Security middleware | ✅ | `middleware.ts` |
| Security headers | ✅ | `next.config.ts` |
| Rate limiting | ✅ | `lib/rate-limit.ts` |
| Singleton Supabase client | ✅ | `lib/supabase/client.ts` |
| List pagination | ✅ | guests, bookings, payments pages |

Move these items from "WHAT STILL NEEDS TO BE BUILT" to "WHAT'S BUILT":
- TopBar shows staff name ✅

Add a new section:
```
## WHAT STILL NEEDS EXTERNAL SETUP (future SaaS work)

- Billing: Stripe integration (subscription plans, trial)
- Error monitoring: Sentry.io
- CI/CD: GitHub Actions → Vercel deployment pipeline
- Staging environment
- GDPR: data export + deletion flow
- Database migration 009_performance_indexes.sql → run in Supabase SQL Editor
```

---

## IMPORTANT NOTES FOR CLAUDE CODE

1. **Check Next.js docs first**: Before writing any API route or middleware code, read `node_modules/next/dist/docs/` to understand the current API surface. This is Next.js 16.2.2 — it differs from training data.
2. **Run `npm run build` after each task group** — don't batch all changes and build once at the end.
3. **Do NOT change any UI styling** — the Apple-minimal design is finalized. Only change logic.
4. **Do NOT add any new npm packages** — all tools needed are already installed.
5. **TypeScript strict mode** — no `any` types. If you need to type something unknown, use `unknown` and narrow it.
6. **The `GuestsClient` and `BookingsClient` prop changes** — when you add pagination props, you MUST update both the page component AND the client component. The client component must accept the new props or TypeScript build will fail.
7. **Middleware placement** — `middleware.ts` MUST be at `/Users/strapexmaroc/Stayy/hostelpro/middleware.ts`, NOT inside `app/` or `src/`.
