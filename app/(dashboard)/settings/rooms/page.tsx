import { redirect } from 'next/navigation'
import { createClient, getUserSession } from '@/lib/supabase/server'
import { RoomsClient } from './RoomsClient'

export default async function RoomsPage() {
  const session = await getUserSession()
  if (!session) redirect('/login')
  if (!session.isOwner) redirect('/dashboard')

  const supabase = await createClient()

  const [roomsRes, bedsRes, typesRes] = await Promise.all([
    supabase.from('rooms').select('*').eq('property_id', session.propertyId).order('name'),
    supabase.from('beds').select('*').eq('property_id', session.propertyId).order('name'),
    supabase
      .from('room_types')
      .select('id, property_id, name, kind, sell_unit, gender_policy, max_occupancy, default_rate, channex_room_type_id')
      .eq('property_id', session.propertyId)
      .order('name'),
  ])

  // room_types arrives with migration 036; before it is applied the query
  // errors and the section is simply not shown.
  const roomTypes = typesRes.error ? null : (typesRes.data ?? [])

  return (
    <RoomsClient
      propertyId={session.propertyId}
      rooms={roomsRes.data ?? []}
      beds={bedsRes.data ?? []}
      roomTypes={roomTypes}
    />
  )
}
