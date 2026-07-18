import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { cache } from 'react'
import type { UserSession } from '@/types'

// cache() deduplicates calls within a single server render tree.
// Use ONLY in Server Components — React.cache() is not supported in Route Handlers.

export const createClient = cache(async () => {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from Server Component — ignored
          }
        },
      },
    }
  )
})

// Service-role client — bypasses RLS. Use only for admin/server-side operations.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/**
 * Identity decoded locally from the Supabase auth cookie's JWT.
 * `sub` is the user id; `email` powers the superadmin check.
 */
type CookieIdentity = { userId: string; email: string | null }

/**
 * Read the Supabase auth cookie and decode the access-token JWT payload.
 * Makes NO network call. Returns null if absent, malformed, or expired.
 *
 * SECURITY: the signature is NOT verified here. This is safe because every
 * caller runs behind `proxy.ts`, which calls `supabase.auth.getUser()` (full
 * signature validation + token refresh) on every non-public request before the
 * server component renders. A forged/expired token never reaches this code.
 * The `exp` check below is belt-and-suspenders against a stale cookie.
 */
const decodeCookieIdentity = cache(async (): Promise<CookieIdentity | null> => {
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()

  // Supabase SSR stores the session as sb-{projectRef}-auth-token
  // For large JWTs it may be chunked: .0, .1, etc.
  const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL!
    .replace('https://', '')
    .split('.')[0]

  const baseName = `sb-${projectRef}-auth-token`

  // Try single cookie first
  let raw = allCookies.find(c => c.name === baseName)?.value

  // Try chunked cookies
  if (!raw) {
    const chunks: string[] = []
    for (let i = 0; i < 10; i++) {
      const chunk = allCookies.find(c => c.name === `${baseName}.${i}`)
      if (!chunk) break
      chunks.push(chunk.value)
    }
    if (chunks.length > 0) raw = chunks.join('')
  }

  if (!raw) return null

  try {
    let decoded = raw
    if (decoded.startsWith('%')) decoded = decodeURIComponent(decoded)
    // base64 encoded value (used by some SSR versions)
    if (decoded.startsWith('base64-')) {
      // @supabase/ssr uses base64url (URL-safe: - and _ instead of + and _, no padding)
      const b64url = decoded.slice(7)
      const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
      decoded = Buffer.from(b64, 'base64').toString('utf8')
    }

    const parsed = JSON.parse(decoded)
    const accessToken: string = parsed.access_token
    if (!accessToken) return null

    // Decode JWT payload (signature validated upstream by proxy.ts — see note above)
    const payload = JSON.parse(
      Buffer.from(accessToken.split('.')[1], 'base64url').toString('utf8')
    )
    if (!payload.sub) return null
    // Reject expired tokens (exp is in seconds)
    if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) return null

    return { userId: payload.sub as string, email: (payload.email as string) ?? null }
  } catch {
    return null
  }
})

/**
 * Read the Supabase auth cookie directly and decode the user ID from the JWT.
 * Does NOT make any network call.
 */
export const getUserId = cache(async (): Promise<string | null> => {
  const identity = await decodeCookieIdentity()
  return identity?.userId ?? null
})

/**
 * Resolves the full session WITHOUT React.cache().
 * Use this in Route Handlers — React.cache() is not supported there and can
 * silently return undefined, causing false "Accès refusé" 403 errors.
 */
export async function getRouteHandlerSession(): Promise<UserSession | null> {
  // Create a fresh (non-cached) Supabase client for the current request's cookies
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch { /* ignored in Route Handlers */ }
        },
      },
    }
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return null

  const userId = user.id
  const admin = createAdminClient()

  const [{ data: properties }, { data: staffMember }] = await Promise.all([
    admin.from('properties').select('id, name, city').eq('owner_id', userId).order('created_at', { ascending: true }),
    admin.from('staff').select('id, property_id, role, name, hide_revenue').eq('user_id', userId).eq('is_active', true).limit(1).maybeSingle(),
  ])

  // Resolve the ACTIVE property first (cookie-selected for multi-property owners)
  // so the subscription check targets the property the session actually uses.
  const activeFromCookie = cookieStore.get('hp-active-property')?.value
  const validCookieProperty = properties && activeFromCookie ? properties.find((p) => p.id === activeFromCookie) : null
  const activeProperty = validCookieProperty ?? properties?.[0] ?? null

  const propertyId = activeProperty?.id ?? staffMember?.property_id
  const { data: subData } = propertyId
    ? await admin.from('subscriptions').select('status, current_period_end').eq('property_id', propertyId).maybeSingle()
    : { data: null }

  const isSuperAdmin = (process.env.SUPERADMIN_EMAILS ?? '').split(',').filter(Boolean).includes(user.email ?? '')

  if (properties && properties.length > 0 && activeProperty) {
    return {
      userId,
      role: 'owner',
      propertyId: activeProperty.id,
      isOwner: true,
      staffId: null,
      staffName: null,
      hideRevenue: false,
      isSuperAdmin,
      subscriptionStatus: subData?.status ?? null,
      subscriptionPeriodEnd: (subData as { status: string; current_period_end: string | null } | null)?.current_period_end ?? null,
      allProperties: properties,
    }
  }

  if (staffMember) {
    return {
      userId,
      role: staffMember.role as UserSession['role'],
      propertyId: staffMember.property_id,
      isOwner: false,
      staffId: staffMember.id,
      staffName: staffMember.name,
      hideRevenue: staffMember.hide_revenue ?? false,
      isSuperAdmin,
      subscriptionStatus: subData?.status ?? null,
      subscriptionPeriodEnd: (subData as { status: string; current_period_end: string | null } | null)?.current_period_end ?? null,
      allProperties: [],
    }
  }

  return null
}

/**
 * Resolves the full session: owner first, then staff member.
 * Returns null if unauthenticated or not linked to any property.
 * NOTE: Uses React.cache() — only call from Server Components, not Route Handlers.
 */
export const getUserSession = cache(async (): Promise<UserSession | null> => {
  const supabase = await createClient()

  // Identity is decoded locally from the cookie (no network round-trip). This is
  // safe because proxy.ts already ran supabase.auth.getUser() — full signature
  // validation + token refresh — for every request that reaches a dashboard
  // server component. The data queries below still go through Supabase RLS, which
  // independently validates the JWT signature server-side.
  //
  // Fallback: if the cookie can't be decoded locally (unexpected format), fall
  // back to the network getUser() rather than returning null — a false negative
  // here would bounce a valid session into a /dashboard <-> /login redirect loop.
  let identity = await decodeCookieIdentity()
  if (!identity) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    identity = { userId: user.id, email: user.email ?? null }
  }

  const userId = identity.userId

  // 1. Property owner (ALL properties for the switcher) + 2. active staff member.
  //    These are independent — run them in parallel instead of a sequential waterfall.
  const [{ data: properties }, { data: staffMember }] = await Promise.all([
    supabase
      .from('properties')
      .select('id, name, city')
      .eq('owner_id', userId)
      .order('created_at', { ascending: true }),
    supabase
      .from('staff')
      .select('id, property_id, role, name, hide_revenue')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle(),
  ])

  // 3. Determine active property from cookie (for multi-property switcher)
  //    BEFORE the subscription query so billing status matches the active property.
  const cookieStore = await cookies()
  const activeFromCookie = cookieStore.get('hp-active-property')?.value
  const validCookieProperty = properties && activeFromCookie
    ? properties.find((p) => p.id === activeFromCookie)
    : null
  const activeProperty = validCookieProperty ?? properties?.[0] ?? null

  // 4. Subscription status + period end for the active property?
  const subPropertyId = activeProperty?.id ?? staffMember?.property_id
  const { data: sub } = subPropertyId
    ? await supabase
        .from('subscriptions')
        .select('status, current_period_end')
        .eq('property_id', subPropertyId)
        .maybeSingle()
    : { data: null }

  const isSuperAdmin = (process.env.SUPERADMIN_EMAILS ?? '')
    .split(',')
    .filter(Boolean)
    .includes(identity.email ?? '')

  if (properties && properties.length > 0 && activeProperty) {
    return {
      userId,
      role: 'owner',
      propertyId: activeProperty.id,
      isOwner: true,
      staffId: null,
      staffName: null,
      hideRevenue: false,
      isSuperAdmin,
      subscriptionStatus: sub?.status ?? null,
      subscriptionPeriodEnd: (sub as { status: string; current_period_end: string | null } | null)?.current_period_end ?? null,
      allProperties: properties,
    }
  }

  if (staffMember) {
    return {
      userId,
      role: staffMember.role as UserSession['role'],
      propertyId: staffMember.property_id,
      isOwner: false,
      staffId: staffMember.id,
      staffName: staffMember.name,
      hideRevenue: staffMember.hide_revenue ?? false,
      isSuperAdmin,
      subscriptionStatus: sub?.status ?? null,
      subscriptionPeriodEnd: (sub as { status: string; current_period_end: string | null } | null)?.current_period_end ?? null,
      allProperties: [],
    }
  }

  return null
})
