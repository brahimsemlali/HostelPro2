import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { User } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/superadmin'

/**
 * Verify the caller is a superadmin with a fresh network check (getUser), never
 * the locally-decoded cookie. Use in every /api/admin route.
 *
 * `strict` is for the most powerful actions (log in as a tenant, delete a
 * tenant): it requires SUPERADMIN_USER_IDS to be set and to contain the
 * caller's id. The email fallback is not enough there — signups are
 * auto-confirmed, so an email alone proves little.
 */
export async function requireSuperAdmin(opts: { strict?: boolean } = {}): Promise<User | null> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch { /* read-only in some contexts */ }
        },
      },
    },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isSuperAdmin(user)) return null
  if (opts.strict && !isStrictSuperAdmin(user)) return null
  return user
}

export function isStrictSuperAdmin(user: { id: string }): boolean {
  const ids = (process.env.SUPERADMIN_USER_IDS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  return ids.includes(user.id.toLowerCase())
}

/** Append to admin_audit_log. Never throws: auditing must not block the action (and 033 may be missing). */
export async function logAdminAction(
  actor: Pick<User, 'id' | 'email'>,
  action: string,
  property: { id: string; name: string } | null,
  details: Record<string, unknown> = {},
): Promise<void> {
  try {
    await createAdminClient().from('admin_audit_log').insert({
      actor_id: actor.id,
      actor_email: actor.email ?? null,
      action,
      property_id: property?.id ?? null,
      property_name: property?.name ?? null,
      details,
    })
  } catch {
    // ignore
  }
}
