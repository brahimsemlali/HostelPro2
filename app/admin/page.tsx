import { createAdminClient } from '@/lib/supabase/server'
import { AdminClient } from './AdminClient'

const PLAN_PRICES: Record<string, { name: string; price: number }> = {
  '1633090': { name: 'Starter', price: 19 },
  '1633110': { name: 'Pro', price: 49 },
}

export default async function AdminPage() {
  const admin = createAdminClient()

  // Fetch all data in parallel using service-role (bypasses RLS)
  const [
    { data: properties },
    { data: subscriptions },
    usersResult,
    bedsResult,
  ] = await Promise.all([
    admin
      .from('properties')
      .select('id, name, city, created_at, owner_id')
      .order('created_at', { ascending: false }),
    admin
      .from('subscriptions')
      .select('property_id, status, provider, ls_variant_id, current_period_end, updated_at'),
    // listUsers is paginated — 1000 covers MVP scale
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin
      .from('beds')
      .select('property_id'),
  ])

  const users = usersResult.data?.users ?? []
  const beds = bedsResult.data ?? []

  // Build lookup maps
  const subMap = new Map((subscriptions ?? []).map((s) => [s.property_id, s]))
  const emailMap = new Map(users.map((u) => [u.id, u.email ?? '']))

  // Count beds per property
  const bedCountMap = new Map<string, number>()
  for (const bed of beds) {
    bedCountMap.set(bed.property_id, (bedCountMap.get(bed.property_id) ?? 0) + 1)
  }

  // Enrich properties
  const enriched = (properties ?? []).map((p) => {
    const sub = subMap.get(p.id) ?? null
    const plan = sub?.ls_variant_id ? PLAN_PRICES[sub.ls_variant_id] ?? null : null
    return {
      ...p,
      owner_email: emailMap.get(p.owner_id) ?? '',
      subscription: sub,
      plan_name: sub?.provider === 'manual_wire' && !sub?.ls_variant_id ? 'Manuel' : (plan?.name ?? null),
      plan_price: plan?.price ?? 0,
      bed_count: bedCountMap.get(p.id) ?? 0,
    }
  })

  // Compute stats
  const now = new Date()
  const activeSubs = (subscriptions ?? []).filter((s) => {
    if (s.status !== 'active') return false
    if (s.current_period_end && new Date(s.current_period_end) < now) return false
    return true
  })
  const trialSubs = (subscriptions ?? []).filter((s) => {
    if (s.status !== 'trialing') return false
    if (s.current_period_end && new Date(s.current_period_end) < now) return false
    return true
  })

  const mrr = activeSubs.reduce((sum, s) => {
    const plan = s.ls_variant_id ? PLAN_PRICES[s.ls_variant_id] : null
    return sum + (plan?.price ?? 0)
  }, 0)

  // Signups per week (last 8 weeks)
  const signupsByWeek: { label: string; count: number }[] = []
  for (let i = 7; i >= 0; i--) {
    const weekStart = new Date(now)
    weekStart.setDate(weekStart.getDate() - i * 7 - 6)
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(now)
    weekEnd.setDate(weekEnd.getDate() - i * 7)
    weekEnd.setHours(23, 59, 59, 999)

    const count = enriched.filter((p) => {
      const d = new Date(p.created_at)
      return d >= weekStart && d <= weekEnd
    }).length

    const label = `S-${i}`
    signupsByWeek.push({ label, count })
  }

  const stats = {
    total: enriched.length,
    active: activeSubs.length,
    trialing: trialSubs.length,
    mrr,
  }

  return <AdminClient properties={enriched} stats={stats} signupsByWeek={signupsByWeek} />
}
