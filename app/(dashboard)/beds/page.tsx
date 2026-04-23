import { redirect } from 'next/navigation'
import { createClient, getUserSession } from '@/lib/supabase/server'
import { BedMapClient } from './BedMapClient'

export default async function BedsPage() {
  const session = await getUserSession()
  if (!session) redirect('/login')

  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  const [propertyRes, roomsRes, bedsRes, activeBookingsRes] = await Promise.all([
    supabase.from('properties').select('*').eq('id', session.propertyId).single(),
    supabase.from('rooms').select('*').eq('property_id', session.propertyId).order('name'),
    supabase.from('beds').select('*').eq('property_id', session.propertyId).order('name'),
    supabase
      .from('bookings')
      .select('*, guest:guest_id(*)')
      .eq('property_id', session.propertyId)
      .eq('status', 'checked_in')
      .gte('check_out_date', today),
  ])

  if (!propertyRes.data) redirect('/onboarding')

  return (
    <BedMapClient
      rooms={roomsRes.data ?? []}
      beds={bedsRes.data ?? []}
      activeBookings={activeBookingsRes.data ?? []}
      propertyId={session.propertyId}
    />
  )
}
