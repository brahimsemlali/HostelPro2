import { NextResponse } from 'next/server'
import { createAdminClient, getRouteHandlerSession } from '@/lib/supabase/server'
import { isSessionBlocked } from '@/lib/billing'
import { ChannexClient } from '@/lib/channex/client'

// Owner only: a single-use (15 min) Channex token for the embedded screen
// where the owner connects Booking.com / Hostelworld / Airbnb and maps rooms.
export async function POST() {
  const session = await getRouteHandlerSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!session.isOwner) return NextResponse.json({ error: 'Réservé au propriétaire' }, { status: 403 })
  if (isSessionBlocked(session)) return NextResponse.json({ error: 'Abonnement inactif' }, { status: 402 })

  const cx = ChannexClient.fromEnv()
  if (!cx) return NextResponse.json({ error: 'La synchronisation en ligne n’est pas encore activée.' }, { status: 503 })

  const { data: conn } = await createAdminClient().from('channel_connections')
    .select('channex_property_id').eq('property_id', session.propertyId).maybeSingle()
  if (!conn?.channex_property_id) return NextResponse.json({ error: 'Connectez d’abord l’établissement.' }, { status: 400 })

  const r = await cx.oneTimeToken(conn.channex_property_id, session.staffName ?? session.userId)
  if (!r.ok || !r.data?.token) {
    return NextResponse.json({ error: `Channex a répondu ${r.status || 'sans réponse'}` }, { status: 502 })
  }
  return NextResponse.json({ url: cx.iframeUrl(r.data.token, conn.channex_property_id) })
}
