import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { BILLING_PLANS } from '@/lib/constants'

const SUPERADMIN_EMAILS = (process.env.SUPERADMIN_EMAILS ?? '').split(',').filter(Boolean)

// Manual-wire subscriptions must carry a variant so they count toward MRR.
// Default to the first plan (Starter) when the caller doesn't specify one.
const VALID_VARIANT_IDS = new Set(BILLING_PLANS.map((p) => p.ls_variant_id))
const DEFAULT_VARIANT_ID = BILLING_PLANS[0].ls_variant_id

export async function POST(request: Request) {
  // Auth check — must be an authenticated superadmin.
  // Fresh (non-cached) client: React.cache()'d createClient is not reliable in Route Handlers.
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
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !SUPERADMIN_EMAILS.includes(user.email ?? '')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  let body: { propertyId?: string; action?: string; months?: number; variantId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
  }

  const { propertyId, action, months, variantId } = body

  if (!propertyId || !action) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
  }

  if (variantId && !VALID_VARIANT_IDS.has(variantId)) {
    return NextResponse.json({ error: 'Plan inconnu' }, { status: 400 })
  }

  const admin = createAdminClient()

  if (action === 'extend') {
    const monthsToAdd = Math.max(1, Math.min(60, Number(months) || 1))

    // Fetch current subscription to extend from its current end date
    const { data: existing } = await admin
      .from('subscriptions')
      .select('current_period_end, status, ls_variant_id')
      .eq('property_id', propertyId)
      .maybeSingle()

    const base = new Date()
    if (existing?.current_period_end) {
      const existingEnd = new Date(existing.current_period_end)
      // Extend from current end date if still in future, otherwise from now
      if (existingEnd > base) base.setTime(existingEnd.getTime())
    }
    base.setMonth(base.getMonth() + monthsToAdd)

    // Attribute a plan so this subscription counts toward MRR: caller's choice,
    // else keep the plan it already had, else default to Starter.
    const resolvedVariant = variantId ?? existing?.ls_variant_id ?? DEFAULT_VARIANT_ID

    const { error } = await admin.from('subscriptions').upsert(
      {
        property_id: propertyId,
        status: 'active',
        provider: 'manual_wire',
        ls_variant_id: resolvedVariant,
        current_period_end: base.toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'property_id' },
    )

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'set_plan') {
    if (!variantId) {
      return NextResponse.json({ error: 'Plan requis' }, { status: 400 })
    }

    // Only re-attribute the plan on an existing subscription — the period and
    // status are left untouched. Extend first if there is no subscription yet.
    const { data: existing } = await admin
      .from('subscriptions')
      .select('property_id')
      .eq('property_id', propertyId)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json(
        { error: 'Aucun abonnement — prolongez d\'abord' },
        { status: 400 },
      )
    }

    const { error } = await admin
      .from('subscriptions')
      .update({ ls_variant_id: variantId, updated_at: new Date().toISOString() })
      .eq('property_id', propertyId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'trial') {
    const expiry = new Date()
    expiry.setDate(expiry.getDate() + 14)

    const { error } = await admin.from('subscriptions').upsert(
      {
        property_id: propertyId,
        status: 'trialing',
        provider: 'manual_wire',
        current_period_end: expiry.toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'property_id' },
    )

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'cancel') {
    const { error } = await admin
      .from('subscriptions')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('property_id', propertyId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
}
