import { NextResponse } from 'next/server'
import { getRouteHandlerSession, createAdminClient } from '@/lib/supabase/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { isSessionBlocked } from '@/lib/billing'

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req)
    const { allowed } = rateLimit({ key: `revoke:${ip}`, limit: 30, windowSeconds: 3600 })
    if (!allowed) return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 })

    const session = await getRouteHandlerSession()
    if (!session?.isOwner) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }
    if (isSessionBlocked(session)) {
      return NextResponse.json({ error: 'Abonnement inactif' }, { status: 402 })
    }

    const { staffId } = await req.json()
    if (!staffId) return NextResponse.json({ error: 'staffId manquant' }, { status: 400 })

    const admin = createAdminClient()

    const { data: revoked, error } = await admin
      .from('staff')
      .update({ is_active: false })
      .eq('id', staffId)
      .eq('property_id', session.propertyId)
      .select('user_id')
      .maybeSingle()

    if (error) throw error
    if (!revoked) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

    // is_active=false only hides them from RLS checks that test it; the auth
    // account itself stayed usable. Ban it so a revoked employee can no longer
    // sign in or refresh a session (there is no re-activation flow — the owner
    // creates a new account instead).
    if (revoked.user_id) {
      const { error: banErr } = await admin.auth.admin.updateUserById(revoked.user_id, { ban_duration: '876000h' })
      if (banErr) return NextResponse.json({ error: 'Accès révoqué, mais la session n’a pas pu être bloquée' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
