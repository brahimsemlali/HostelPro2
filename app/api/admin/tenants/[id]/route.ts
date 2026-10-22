import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { BILLING_PLANS } from '@/lib/constants'
import { addDaysISO, dayStartUTC } from '@/lib/dates'
import { extendPeriod, isMissingTable } from '@/lib/admin/metrics'
import { requireSuperAdmin, logAdminAction } from '@/lib/admin/server'

// Every superadmin action on one tenant goes through here, so each one is
// re-authorised with a fresh getUser() and written to admin_audit_log.

const VALID_VARIANTS = new Set(BILLING_PLANS.map((p) => p.ls_variant_id))
const DEFAULT_VARIANT = BILLING_PLANS[0].ls_variant_id
const METHODS = new Set(['virement', 'cash', 'card', 'other'])
// Account takeover, irreversible deletion: require an explicit superadmin id.
const STRICT_ACTIONS = new Set(['login_as', 'recovery_link', 'delete_tenant'])
const MIGRATION_033 = 'Appliquez la migration 033_admin_console.sql dans Supabase pour activer cette fonction.'

type Body = {
  action?: string
  months?: number
  days?: number
  variantId?: string
  amount?: number
  method?: string
  reference?: string
  note?: string
  paidAt?: string
  date?: string
  reason?: string
  notes?: string
  paymentId?: string
  confirmName?: string
  property?: { name?: string; city?: string; phone?: string; email?: string; address?: string }
}

const isoDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
const text = (v: unknown, max = 500): string | null => {
  if (typeof v !== 'string') return null
  const t = v.trim().slice(0, max)
  return t.length ? t : null
}
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status })

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: propertyId } = await params

  let body: Body
  try {
    body = await request.json() as Body
  } catch {
    return fail('Corps de requête invalide')
  }
  const action = body.action ?? ''

  const actor = await requireSuperAdmin({ strict: STRICT_ACTIONS.has(action) })
  if (!actor) {
    return fail(
      STRICT_ACTIONS.has(action)
        ? 'Action réservée : définissez SUPERADMIN_USER_IDS (votre identifiant) dans Vercel.'
        : 'Accès refusé',
      403,
    )
  }

  if (body.variantId && !VALID_VARIANTS.has(body.variantId)) return fail('Plan inconnu')

  const admin = createAdminClient()
  const { data: property } = await admin
    .from('properties')
    .select('id, name, owner_id')
    .eq('id', propertyId)
    .maybeSingle()
  if (!property) return fail('Propriété introuvable', 404)

  const audit = (details: Record<string, unknown> = {}) => logAdminAction(actor, action, property, details)
  const now = new Date()
  const origin = new URL(request.url).origin

  const { data: sub } = await admin
    .from('subscriptions')
    .select('status, provider, ls_variant_id, current_period_end')
    .eq('property_id', propertyId)
    .maybeSingle()

  async function upsertSub(fields: Record<string, unknown>) {
    return admin.from('subscriptions').upsert(
      { property_id: propertyId, updated_at: now.toISOString(), ...fields },
      { onConflict: 'property_id' },
    )
  }

  async function ownerEmail(): Promise<string | null> {
    const { data } = await admin.auth.admin.getUserById(property!.owner_id)
    return data.user?.email ?? null
  }

  switch (action) {
    // ── Money ────────────────────────────────────────────────────────────────
    case 'record_payment': {
      const amount = Number(body.amount)
      const months = Math.trunc(Number(body.months ?? 1))
      const method = body.method ?? ''
      if (!(amount > 0) || amount > 1_000_000) return fail('Montant invalide')
      if (!(months >= 0 && months <= 60)) return fail('Nombre de mois invalide (0–60)')
      if (!METHODS.has(method)) return fail('Mode de paiement invalide')
      const variantId = body.variantId ?? sub?.ls_variant_id ?? DEFAULT_VARIANT
      const paidAt = isoDate(body.paidAt) ? new Date(`${body.paidAt}T12:00:00Z`) : now
      const periodEnd = months > 0 ? extendPeriod(sub?.current_period_end, months, now) : null

      const { data: row, error: insErr } = await admin.from('platform_payments').insert({
        property_id: propertyId,
        property_name: property.name,
        amount,
        method,
        months,
        variant_id: variantId,
        period_end: periodEnd?.toISOString() ?? sub?.current_period_end ?? null,
        reference: text(body.reference, 120),
        note: text(body.note),
        paid_at: paidAt.toISOString(),
        recorded_by: actor.email ?? actor.id,
      }).select('id').single()
      if (insErr) return isMissingTable(insErr) ? fail(MIGRATION_033, 409) : fail(insErr.message, 500)

      if (periodEnd) {
        const { error } = await upsertSub({
          status: 'active',
          provider: 'manual_wire',
          ls_variant_id: variantId,
          current_period_end: periodEnd.toISOString(),
        })
        if (error) {
          // Keep ledger and subscription consistent: undo the payment row.
          await admin.from('platform_payments').delete().eq('id', row.id)
          return fail(error.message, 500)
        }
      }
      await audit({ amount, method, months, variantId, periodEnd: periodEnd?.toISOString() ?? null })
      return NextResponse.json({ ok: true, periodEnd: periodEnd?.toISOString() ?? null })
    }

    case 'delete_payment': {
      if (!body.paymentId) return fail('Paiement manquant')
      const { data: removed, error } = await admin
        .from('platform_payments')
        .delete()
        .eq('id', body.paymentId)
        .eq('property_id', propertyId)
        .select('amount, method, paid_at')
      if (error) return isMissingTable(error) ? fail(MIGRATION_033, 409) : fail(error.message, 500)
      if (!removed?.length) return fail('Paiement introuvable', 404)
      await audit({ paymentId: body.paymentId, ...removed[0] })
      return NextResponse.json({ ok: true })
    }

    // ── Subscription ─────────────────────────────────────────────────────────
    case 'extend': {
      const months = Math.max(1, Math.min(60, Math.trunc(Number(body.months) || 1)))
      const variantId = body.variantId ?? sub?.ls_variant_id ?? DEFAULT_VARIANT
      const end = extendPeriod(sub?.current_period_end, months, now)
      const { error } = await upsertSub({ status: 'active', provider: 'manual_wire', ls_variant_id: variantId, current_period_end: end.toISOString() })
      if (error) return fail(error.message, 500)
      await audit({ months, variantId, periodEnd: end.toISOString(), free: true })
      return NextResponse.json({ ok: true, periodEnd: end.toISOString() })
    }

    case 'set_end_date': {
      if (!isoDate(body.date)) return fail('Date invalide')
      // Access through the whole chosen day (Morocco time).
      const end = dayStartUTC(addDaysISO(body.date, 1))
      const status = sub?.status === 'trialing' ? 'trialing' : 'active'
      const { error } = await upsertSub({
        status,
        provider: sub?.provider ?? 'manual_wire',
        ls_variant_id: sub?.ls_variant_id ?? (status === 'active' ? DEFAULT_VARIANT : null),
        current_period_end: end.toISOString(),
      })
      if (error) return fail(error.message, 500)
      await audit({ date: body.date, status, previousEnd: sub?.current_period_end ?? null })
      return NextResponse.json({ ok: true })
    }

    case 'set_plan': {
      if (!body.variantId) return fail('Plan requis')
      if (!sub) return fail("Aucun abonnement — enregistrez d'abord un paiement")
      const { error } = await admin.from('subscriptions')
        .update({ ls_variant_id: body.variantId, updated_at: now.toISOString() })
        .eq('property_id', propertyId)
      if (error) return fail(error.message, 500)
      await audit({ variantId: body.variantId, previous: sub.ls_variant_id })
      return NextResponse.json({ ok: true })
    }

    case 'trial': {
      const days = Math.max(1, Math.min(90, Math.trunc(Number(body.days) || 14)))
      const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
      const { error } = await upsertSub({ status: 'trialing', provider: 'manual_wire', current_period_end: end.toISOString() })
      if (error) return fail(error.message, 500)
      await audit({ days })
      return NextResponse.json({ ok: true })
    }

    case 'cancel':   // access continues until the period end
    case 'expire': { // access stops now
      if (!sub) return fail('Aucun abonnement')
      const fields = action === 'cancel'
        ? { status: 'cancelled', updated_at: now.toISOString() }
        : { status: 'expired', current_period_end: now.toISOString(), updated_at: now.toISOString() }
      const { error } = await admin.from('subscriptions').update(fields).eq('property_id', propertyId)
      if (error) return fail(error.message, 500)
      await audit({ previous: sub.status })
      return NextResponse.json({ ok: true })
    }

    // ── Account ──────────────────────────────────────────────────────────────
    case 'suspend':
    case 'unsuspend': {
      const reason = text(body.reason)
      const { error } = await admin.from('tenant_admin').upsert({
        property_id: propertyId,
        suspended_at: action === 'suspend' ? now.toISOString() : null,
        suspended_reason: action === 'suspend' ? reason : null,
        updated_at: now.toISOString(),
      }, { onConflict: 'property_id' })
      if (error) return isMissingTable(error) ? fail(MIGRATION_033, 409) : fail(error.message, 500)
      await audit({ reason })
      return NextResponse.json({ ok: true })
    }

    case 'save_notes': {
      const { error } = await admin.from('tenant_admin').upsert({
        property_id: propertyId,
        notes: text(body.notes, 5000),
        updated_at: now.toISOString(),
      }, { onConflict: 'property_id' })
      if (error) return isMissingTable(error) ? fail(MIGRATION_033, 409) : fail(error.message, 500)
      await audit()
      return NextResponse.json({ ok: true })
    }

    case 'update_property': {
      const p = body.property ?? {}
      const name = text(p.name, 120)
      if (!name) return fail('Le nom est requis')
      const fields = {
        name,
        city: text(p.city, 80) ?? '',
        phone: text(p.phone, 40),
        email: text(p.email, 160),
        address: text(p.address, 300),
      }
      const { error } = await admin.from('properties').update(fields).eq('id', propertyId)
      if (error) return fail(error.message, 500)
      await audit({ fields })
      return NextResponse.json({ ok: true })
    }

    case 'recovery_link': {
      const email = await ownerEmail()
      if (!email) return fail('Email du propriétaire introuvable', 404)
      const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email })
      if (error || !data.properties?.hashed_token) return fail(error?.message ?? 'Lien impossible à générer', 500)
      await audit({ email })
      return NextResponse.json({
        ok: true,
        url: `${origin}/reset-password?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=recovery`,
      })
    }

    case 'login_as': {
      const email = await ownerEmail()
      if (!email) return fail('Email du propriétaire introuvable', 404)
      const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
      if (error || !data.properties?.hashed_token) return fail(error?.message ?? 'Lien impossible à générer', 500)
      await audit({ email })
      return NextResponse.json({
        ok: true,
        url: `${origin}/api/auth/confirm?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=magiclink&next=/dashboard`,
      })
    }

    case 'delete_tenant': {
      if ((body.confirmName ?? '').trim() !== property.name) return fail('Le nom saisi ne correspond pas')
      const { data: staffRows } = await admin.from('staff').select('user_id').eq('property_id', propertyId)
      const candidates = new Set((staffRows ?? []).map((s) => s.user_id).filter((u): u is string => !!u))
      candidates.add(property.owner_id)
      candidates.delete(actor.id)
      // Keep any account that still owns, or works at, another property
      // (onboarding gives the owner a staff row too).
      const ids = [...candidates]
      const [{ data: ownsElsewhere }, { data: staffElsewhere }] = ids.length
        ? await Promise.all([
            admin.from('properties').select('owner_id').in('owner_id', ids).neq('id', propertyId),
            admin.from('staff').select('user_id').in('user_id', ids).neq('property_id', propertyId),
          ])
        : [{ data: [] }, { data: [] }]
      const keep = new Set([
        ...(ownsElsewhere ?? []).map((r) => r.owner_id as string),
        ...(staffElsewhere ?? []).map((r) => r.user_id as string),
      ])
      const userIds = ids.filter((u) => !keep.has(u))

      // Every tenant table cascades from properties.
      const { error } = await admin.from('properties').delete().eq('id', propertyId)
      if (error) return fail(error.message, 500)

      const failedUsers: string[] = []
      for (const uid of userIds) {
        const { error: delErr } = await admin.auth.admin.deleteUser(uid)
        if (delErr) failedUsers.push(uid)
      }
      await audit({ deletedUsers: userIds.length - failedUsers.length, keptUsers: keep.size, failedUsers })
      return NextResponse.json({ ok: true, failedUsers })
    }

    default:
      return fail('Action inconnue')
  }
}
