import { notFound, redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/superadmin'
import { isMissingTable, PLAN_BY_VARIANT } from '@/lib/admin/metrics'
import { isStrictSuperAdmin } from '@/lib/admin/server'
import { netReceived } from '@/lib/money'
import { TenantClient } from './TenantClient'

const DAY_MS = 24 * 60 * 60 * 1000

export default async function TenantPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isSuperAdmin(user)) redirect('/dashboard')

  const { id } = await params
  const admin = createAdminClient()
  // eslint-disable-next-line react-hooks/purity
  const since30 = new Date(Date.now() - 30 * DAY_MS).toISOString()

  const { data: property } = await admin
    .from('properties')
    .select('id, name, city, address, phone, email, owner_id, created_at')
    .eq('id', id)
    .maybeSingle()
  if (!property) notFound()

  const [
    ownerRes, { data: sub }, { data: staff },
    { count: roomCount }, { count: bedCount }, { count: guestCount }, { count: bookingCount },
    { count: bookings30 }, { data: payments30 }, { data: activity },
    ledgerRes, tenantAdminRes, auditRes,
  ] = await Promise.all([
    admin.auth.admin.getUserById(property.owner_id),
    admin.from('subscriptions').select('status, provider, ls_variant_id, current_period_end, created_at, updated_at').eq('property_id', id).maybeSingle(),
    admin.from('staff').select('id, name, role, is_active, user_id, phone, created_at').eq('property_id', id).order('created_at'),
    admin.from('rooms').select('id', { count: 'exact', head: true }).eq('property_id', id),
    admin.from('beds').select('id', { count: 'exact', head: true }).eq('property_id', id),
    admin.from('guests').select('id', { count: 'exact', head: true }).eq('property_id', id),
    admin.from('bookings').select('id', { count: 'exact', head: true }).eq('property_id', id),
    admin.from('bookings').select('id', { count: 'exact', head: true }).eq('property_id', id).gte('created_at', since30),
    admin.from('payments').select('amount, type, status').eq('property_id', id).gte('payment_date', since30).limit(10000),
    admin.from('activity_log').select('id, action_type, description, staff_name, created_at').eq('property_id', id).order('created_at', { ascending: false }).limit(15),
    admin.from('platform_payments').select('id, amount, method, months, variant_id, period_end, reference, note, paid_at, recorded_by').eq('property_id', id).order('paid_at', { ascending: false }).limit(200),
    admin.from('tenant_admin').select('notes, suspended_at, suspended_reason').eq('property_id', id).maybeSingle(),
    admin.from('admin_audit_log').select('id, action, actor_email, details, created_at').eq('property_id', id).order('created_at', { ascending: false }).limit(30),
  ])

  const owner = ownerRes.data.user
  const staffWithLogin = await Promise.all((staff ?? []).map(async (s) => {
    if (!s.user_id) return { ...s, email: null, last_sign_in_at: null }
    const { data } = await admin.auth.admin.getUserById(s.user_id)
    return { ...s, email: data.user?.email ?? null, last_sign_in_at: data.user?.last_sign_in_at ?? null }
  }))

  const ledger = (ledgerRes.data ?? []).map((r) => ({ ...r, amount: Number(r.amount) }))
  const plan = sub?.ls_variant_id ? PLAN_BY_VARIANT[sub.ls_variant_id] ?? null : null

  return (
    <TenantClient
      property={property}
      owner={{
        email: owner?.email ?? null,
        createdAt: owner?.created_at ?? null,
        lastSignIn: owner?.last_sign_in_at ?? null,
      }}
      subscription={sub ?? null}
      planName={plan?.name ?? (sub?.provider === 'manual_wire' ? 'Manuel' : null)}
      staff={staffWithLogin}
      usage={{
        rooms: roomCount ?? 0,
        beds: bedCount ?? 0,
        guests: guestCount ?? 0,
        bookings: bookingCount ?? 0,
        bookings30: bookings30 ?? 0,
        guestRevenue30: netReceived(payments30),
      }}
      activity={activity ?? []}
      ledger={ledger}
      ledgerTotal={ledger.reduce((s, r) => s + r.amount, 0)}
      tenantAdmin={tenantAdminRes.data ?? null}
      audit={auditRes.data ?? []}
      migrationMissing={isMissingTable(ledgerRes.error) || isMissingTable(tenantAdminRes.error)}
      canUseStrictActions={isStrictSuperAdmin(user)}
    />
  )
}
