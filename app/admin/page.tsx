import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { AdminClient, type ChaseItem } from './AdminClient'
import { isSuperAdmin } from '@/lib/superadmin'
import {
  PLAN_BY_VARIANT, computeMrr, chaseBucket, chaseRank, CHASE_LABELS, isPaying,
  lastMonthKeys, sumByMonth, monthKey, monthlyPrice, isMissingTable,
} from '@/lib/admin/metrics'

const DAY_MS = 24 * 60 * 60 * 1000

export default async function AdminPage() {
  // Superadmin gate — this page loads every tenant's data via the service-role
  // client, so it must never render for a non-superadmin. Verify the user
  // server-side (getUser makes a network check) before any data is fetched.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isSuperAdmin(user)) {
    redirect('/dashboard')
  }

  const admin = createAdminClient()
  const now = new Date()
  const since12m = new Date(now.getTime() - 366 * DAY_MS).toISOString()

  const [
    { data: properties },
    { data: subscriptions },
    usersResult,
    usageRes,
    paymentsRes,
    tenantAdminRes,
  ] = await Promise.all([
    admin.from('properties').select('id, name, city, phone, created_at, owner_id').order('created_at', { ascending: false }),
    admin.from('subscriptions').select('property_id, status, provider, ls_variant_id, current_period_end, updated_at'),
    // listUsers is paginated — 1000 covers MVP scale
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.rpc('admin_tenant_usage'),
    admin.from('platform_payments').select('property_id, amount, paid_at').gte('paid_at', since12m).limit(10000),
    admin.from('tenant_admin').select('property_id, suspended_at'),
  ])

  const migrationMissing = isMissingTable(paymentsRes.error) || isMissingTable(tenantAdminRes.error) || !!usageRes.error
  const ledger = (paymentsRes.data ?? []).map((r) => ({ ...r, amount: Number(r.amount) }))
  const users = usersResult.data?.users ?? []

  const subMap = new Map((subscriptions ?? []).map((s) => [s.property_id, s]))
  const userMap = new Map(users.map((u) => [u.id, u]))
  const suspended = new Set((tenantAdminRes.data ?? []).filter((t) => t.suspended_at).map((t) => t.property_id))
  // Usage comes from the admin_tenant_usage() SQL function (033); before it is
  // applied these columns are simply empty.
  type Usage = { property_id: string; beds: number; bookings_30d: number; last_activity: string | null }
  const usage = new Map(((usageRes.data ?? []) as Usage[]).map((u) => [u.property_id, u]))
  const paidEver = new Set(ledger.map((r) => r.property_id).filter(Boolean))

  const enriched = (properties ?? []).map((p) => {
    const sub = subMap.get(p.id) ?? null
    const plan = sub?.ls_variant_id ? PLAN_BY_VARIANT[sub.ls_variant_id] ?? null : null
    const owner = userMap.get(p.owner_id)
    return {
      ...p,
      phone: p.phone ?? null,
      owner_email: owner?.email ?? '',
      owner_last_sign_in: owner?.last_sign_in_at ?? null,
      subscription: sub,
      plan_name: sub?.provider === 'manual_wire' && !sub?.ls_variant_id ? 'Manuel' : (plan?.name ?? null),
      plan_price: plan?.price ?? 0,
      bed_count: Number(usage.get(p.id)?.beds ?? 0),
      bookings_30d: Number(usage.get(p.id)?.bookings_30d ?? 0),
      last_activity: usage.get(p.id)?.last_activity ?? null,
      suspended: suspended.has(p.id),
    }
  })

  // ── Money ────────────────────────────────────────────────────────────────
  const subs = subscriptions ?? []
  const mrr = computeMrr(subs, now)
  const monthKeys = lastMonthKeys(6, now)
  const revenue = sumByMonth(ledger, monthKeys)
  const thisMonth = monthKey(now)
  const cashThisMonth = revenue[revenue.length - 1] ?? 0
  const cashLastMonth = revenue[revenue.length - 2] ?? 0

  // ── Growth ───────────────────────────────────────────────────────────────
  // Conversion: signups old enough to have finished the 14-day trial that are
  // paying now or have paid at least once.
  const matured = enriched.filter((p) => now.getTime() - new Date(p.created_at).getTime() > 14 * DAY_MS)
  const converted = matured.filter((p) => isPaying(p.subscription, now) || paidEver.has(p.id))
  const activeUsage = enriched.filter((p) => p.last_activity && now.getTime() - new Date(p.last_activity).getTime() <= 7 * DAY_MS)

  const signupsByWeek: { label: string; count: number }[] = []
  for (let i = 7; i >= 0; i--) {
    const end = now.getTime() - i * 7 * DAY_MS
    const start = end - 7 * DAY_MS
    signupsByWeek.push({
      label: i === 0 ? 'Cette sem.' : `S-${i}`,
      count: enriched.filter((p) => {
        const t = new Date(p.created_at).getTime()
        return t > start && t <= end
      }).length,
    })
  }

  // ── Who to call ──────────────────────────────────────────────────────────
  const chase: ChaseItem[] = enriched
    .map((p) => ({ p, bucket: chaseBucket(p.subscription, now) }))
    .filter((x): x is { p: typeof enriched[number]; bucket: NonNullable<typeof x.bucket> } => x.bucket !== null && !x.p.suspended)
    .sort((a, b) => chaseRank(a.bucket) - chaseRank(b.bucket)
      || new Date(a.p.subscription?.current_period_end ?? 0).getTime() - new Date(b.p.subscription?.current_period_end ?? 0).getTime())
    .map(({ p, bucket }) => ({
      id: p.id,
      name: p.name,
      city: p.city,
      phone: p.phone,
      ownerEmail: p.owner_email,
      bucket,
      label: CHASE_LABELS[bucket],
      periodEnd: p.subscription?.current_period_end ?? null,
      monthlyPrice: monthlyPrice(p.subscription) || PLAN_BY_VARIANT[Object.keys(PLAN_BY_VARIANT)[0]].price,
      planName: p.plan_name,
    }))

  const stats = {
    total: enriched.length,
    active: subs.filter((s) => isPaying(s, now)).length,
    trialing: subs.filter((s) => s.status === 'trialing' && s.current_period_end && new Date(s.current_period_end) >= now).length,
    mrr,
    arr: mrr * 12,
    cashThisMonth,
    cashLastMonth,
    conversionPct: matured.length ? Math.round((converted.length / matured.length) * 100) : null,
    activeUsage: activeUsage.length,
    atRisk: chase.filter((c) => c.bucket === 'grace' || c.bucket === 'ending_soon').length,
  }

  return (
    <AdminClient
      properties={enriched}
      stats={stats}
      signupsByWeek={signupsByWeek}
      revenue={monthKeys.map((k, i) => ({ month: k, amount: revenue[i], current: k === thisMonth }))}
      chase={chase}
      migrationMissing={migrationMissing}
    />
  )
}
