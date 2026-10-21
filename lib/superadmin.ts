// Platform superadmin detection.
//
// Prefer SUPERADMIN_USER_IDS (auth user UUIDs): an email alone is not proof of
// identity here, because owners can create pre-confirmed staff accounts for
// any address — so an attacker could mint an account for a listed superadmin
// email that hasn't signed up yet. SUPERADMIN_EMAILS remains as a fallback
// only while SUPERADMIN_USER_IDS is unset, and staff creation refuses those
// addresses (see isReservedAdminEmail).

const list = (v: string | undefined) =>
  (v ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)

export function isSuperAdmin(user: { id?: string | null; email?: string | null } | null | undefined): boolean {
  if (!user) return false
  const ids = list(process.env.SUPERADMIN_USER_IDS)
  if (ids.length > 0) return !!user.id && ids.includes(user.id.toLowerCase())
  return !!user.email && list(process.env.SUPERADMIN_EMAILS).includes(user.email.toLowerCase())
}

/** Emails that must never be provisioned through tenant flows (staff/create). */
export function isReservedAdminEmail(email: string): boolean {
  return list(process.env.SUPERADMIN_EMAILS).includes(email.trim().toLowerCase())
}
