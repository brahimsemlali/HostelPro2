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
 * Read the Supabase auth cookie directly and decode the user ID from the JWT.
 * Does NOT make any network call.
 */
export const getUserId = cache(async (): Promise<string | null> => {
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

    // Decode JWT payload (no verification needed — proxy already validated)
    const payload = JSON.parse(
      Buffer.from(accessToken.split('.')[1], 'base64url').toString('utf8')
    )
    return payload.sub as string
  } catch {
    return null
  }
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

  const [{ data: properties }, { data: staffMember }, { data: sub }] = await Promise.all([
    admin.from('properties').select('id, name, city').eq('owner_id', userId).order('created_at', { ascending: true }),
    admin.from('staff').select('id, property_id, role, name, hide_revenue').eq('user_id', userId).eq('is_active', true).limit(1).maybeSingle(),
    // subscription queried after we know property
    Promise.resolve({ data: null }),
  ])

  const propertyId = properties?.[0]?.id ?? staffMember?.property_id
  const { data: subData } = propertyId
    ? await admin.from('subscriptions').select('status').eq('property_id', propertyId).maybeSingle()
    : { data: null }

  const isSuperAdmin = (process.env.SUPERADMIN_EMAILS ?? '').split(',').includes(user.email ?? '')

  if (properties && properties.length > 0) {
    const activeFromCookie = cookieStore.get('hp-active-property')?.value
    const validCookieProperty = activeFromCookie ? properties.find((p) => p.id === activeFromCookie) : null
    const activeProperty = validCookieProperty ?? properties[0]
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

  // Use Supabase's validated getUser() — more reliable than manual JWT decoding
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return null

  const userId = user.id

  // 1. Property owner? Fetch ALL properties so we can power the multi-property switcher.
  const { data: properties } = await supabase
    .from('properties')
    .select('id, name, city')
    .eq('owner_id', userId)
    .order('created_at', { ascending: true })

  // 2. Active staff member?
  const { data: staffMember } = await supabase
    .from('staff')
    .select('id, property_id, role, name, hide_revenue')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  // 3. Subscription status?
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('property_id', staffMember?.property_id ?? properties?.[0]?.id)
    .maybeSingle()

  const isSuperAdmin = (process.env.SUPERADMIN_EMAILS ?? '')
    .split(',')
    .includes(user.email ?? '')

  if (properties && properties.length > 0) {
    // Determine active property from cookie (for multi-property switcher)
    const cookieStore = await cookies()
    const activeFromCookie = cookieStore.get('hp-active-property')?.value
    const validCookieProperty = activeFromCookie
      ? properties.find((p) => p.id === activeFromCookie)
      : null

    const activeProperty = validCookieProperty ?? properties[0]

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
      allProperties: [],
    }
  }

  return null
})
