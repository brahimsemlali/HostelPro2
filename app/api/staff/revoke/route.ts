import { NextResponse } from 'next/server'
import { createClient, getUserSession } from '@/lib/supabase/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req)
    const { allowed } = rateLimit({ key: `revoke:${ip}`, limit: 30, windowSeconds: 3600 })
    if (!allowed) return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 })

    const session = await getUserSession()
    if (!session?.isOwner) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const { staffId } = await req.json()
    if (!staffId) return NextResponse.json({ error: 'staffId manquant' }, { status: 400 })

    const supabase = await createClient()

    const { error } = await supabase
      .from('staff')
      .update({ is_active: false })
      .eq('id', staffId)
      .eq('property_id', session.propertyId) // RLS double-check

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[revoke]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
