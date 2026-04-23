import { redirect } from 'next/navigation'
import { createClient, getUserSession } from '@/lib/supabase/server'
import { MaintenanceClient } from './MaintenanceClient'

export default async function MaintenancePage() {
  const session = await getUserSession()
  if (!session) redirect('/login')

  const supabase = await createClient()

  const [requestsRes, roomsRes, bedsRes] = await Promise.all([
    supabase
      .from('maintenance')
      .select('*, room:room_id(name), bed:bed_id(name)')
      .eq('property_id', session.propertyId)
      .order('created_at', { ascending: false }),

    supabase.from('rooms').select('id, name').eq('property_id', session.propertyId),

    supabase.from('beds').select('id, name, room_id').eq('property_id', session.propertyId),
  ])

  return (
    <MaintenanceClient
      propertyId={session.propertyId}
      requests={requestsRes.data ?? []}
      rooms={roomsRes.data ?? []}
      beds={bedsRes.data ?? []}
    />
  )
}
