import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const SUPERADMIN_EMAILS = (process.env.SUPERADMIN_EMAILS ?? '').split(',').filter(Boolean)

export async function POST(request: Request) {
  // Auth check — must be an authenticated superadmin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !SUPERADMIN_EMAILS.includes(user.email ?? '')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  let body: { propertyId?: string; action?: string; months?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
  }

  const { propertyId, action, months } = body

  if (!propertyId || !action) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
  }

  const admin = createAdminClient()

  if (action === 'extend') {
    const monthsToAdd = Math.max(1, Math.min(60, months ?? 1))

    // Fetch current subscription to extend from its current end date
    const { data: existing } = await admin
      .from('subscriptions')
      .select('current_period_end, status')
      .eq('property_id', propertyId)
      .maybeSingle()

    const base = new Date()
    if (existing?.current_period_end) {
      const existingEnd = new Date(existing.current_period_end)
      // Extend from current end date if still in future, otherwise from now
      if (existingEnd > base) base.setTime(existingEnd.getTime())
    }
    base.setMonth(base.getMonth() + monthsToAdd)

    const { error } = await admin.from('subscriptions').upsert({
      property_id: propertyId,
      status: 'active',
      provider: 'manual_wire',
      current_period_end: base.toISOString(),
      updated_at: new Date().toISOString(),
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'trial') {
    const expiry = new Date()
    expiry.setDate(expiry.getDate() + 30)

    const { error } = await admin.from('subscriptions').upsert({
      property_id: propertyId,
      status: 'trialing',
      provider: 'manual_wire',
      current_period_end: expiry.toISOString(),
      updated_at: new Date().toISOString(),
    })

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
