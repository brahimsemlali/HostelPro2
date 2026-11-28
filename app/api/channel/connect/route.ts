import { NextResponse } from 'next/server'
import { createAdminClient, getRouteHandlerSession } from '@/lib/supabase/server'
import { isSessionBlocked } from '@/lib/billing'
import { rateLimit } from '@/lib/rate-limit'
import { ChannexClient } from '@/lib/channex/client'
import { connectProperty } from '@/lib/channex/connect'

// Owner only. Writes go through the service role: channel_connections and
// the Channex ids are server-managed (037 revokes client writes).
export async function POST(request: Request) {
  const session = await getRouteHandlerSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!session.isOwner) return NextResponse.json({ error: 'Réservé au propriétaire' }, { status: 403 })
  if (isSessionBlocked(session)) return NextResponse.json({ error: 'Abonnement inactif' }, { status: 402 })

  const rl = rateLimit({ key: `channel-connect:${session.propertyId}`, limit: 10, windowSeconds: 600 })
  if (!rl.allowed) return NextResponse.json({ error: 'Trop de tentatives. Réessayez dans quelques minutes.' }, { status: 429 })

  let action: string
  try {
    action = ((await request.json()) as { action?: string }).action ?? ''
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })
  }

  const db = createAdminClient()
  if (action === 'pause' || action === 'resume') {
    const { data, error } = await db.from('channel_connections')
      .update({ status: action === 'pause' ? 'paused' : 'active', updated_at: new Date().toISOString() })
      .eq('property_id', session.propertyId)
      .not('channex_property_id', 'is', null)
      .select('status')
    if (error || !data?.length) return NextResponse.json({ error: 'Aucune connexion à modifier' }, { status: 400 })
    // Changes made during a pause stayed queued (037): resuming sends them.
    if (action === 'resume') {
      await db.from('channel_ari_queue').update({ next_attempt_at: new Date().toISOString() })
        .eq('property_id', session.propertyId).is('processed_at', null)
    }
    return NextResponse.json({ status: data[0].status })
  }

  if (action !== 'connect') return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
  const cx = ChannexClient.fromEnv()
  if (!cx) return NextResponse.json({ error: 'La synchronisation en ligne n’est pas encore activée.' }, { status: 503 })

  const result = await connectProperty(db, cx, session.propertyId)
  return NextResponse.json(result, { status: result.ok ? 200 : 502 })
}
