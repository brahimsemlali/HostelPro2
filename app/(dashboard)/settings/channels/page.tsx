import { redirect } from 'next/navigation'
import { createClient, getUserSession } from '@/lib/supabase/server'
import { ChannelsClient, type ChannelsData } from './ChannelsClient'

// Settings › Ventes en ligne — connect the property to Channex (owner only).
export default async function ChannelsPage() {
  const session = await getUserSession()
  if (!session) redirect('/login')
  if (!session.isOwner) redirect('/dashboard')

  const supabase = await createClient()
  const [connRes, typesRes, roomsRes, bedsRes, logRes, alertsRes] = await Promise.all([
    supabase.from('channel_connections').select('status, channex_property_id, last_full_sync_at, last_error, updated_at')
      .eq('property_id', session.propertyId).maybeSingle(),
    supabase.from('room_types').select('id, name, sell_unit, channex_room_type_id')
      .eq('property_id', session.propertyId).order('name'),
    // '*' on purpose: room_type_id only exists after migration 036.
    supabase.from('rooms').select('*').eq('property_id', session.propertyId),
    supabase.from('beds').select('room_id').eq('property_id', session.propertyId),
    supabase.from('channel_sync_log').select('id, direction, kind, ok, summary, created_at')
      .eq('property_id', session.propertyId).order('created_at', { ascending: false }).limit(10),
    supabase.from('channel_alerts').select('id', { count: 'exact', head: true })
      .eq('property_id', session.propertyId).is('resolved_at', null),
  ])

  // Before migrations 036–039 the tables do not exist.
  if (connRes.error || typesRes.error) {
    return <ChannelsClient data={null} enabled={false} />
  }

  const bedsPerRoom = new Map<string, number>()
  for (const b of bedsRes.data ?? []) bedsPerRoom.set(b.room_id, (bedsPerRoom.get(b.room_id) ?? 0) + 1)
  const rooms = (roomsRes.data ?? []) as { id: string; room_type_id?: string | null }[]

  const data: ChannelsData = {
    connection: connRes.data ?? null,
    roomTypes: (typesRes.data ?? []).map((t) => {
      const typeRooms = rooms.filter((r) => r.room_type_id === t.id)
      const beds = typeRooms.reduce((n, r) => n + (bedsPerRoom.get(r.id) ?? 0), 0)
      const units = t.sell_unit === 'bed' ? beds : typeRooms.filter((r) => (bedsPerRoom.get(r.id) ?? 0) > 0).length
      return { id: t.id, name: t.name, sellUnit: t.sell_unit as 'bed' | 'room', units, mapped: !!t.channex_room_type_id }
    }),
    log: logRes.error ? [] : (logRes.data ?? []),
    openAlerts: alertsRes.error ? 0 : (alertsRes.count ?? 0),
  }

  return <ChannelsClient data={data} enabled={!!process.env.CHANNEX_API_KEY} />
}
