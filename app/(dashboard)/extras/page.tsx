import { redirect } from 'next/navigation'
import { createClient, getUserSession } from '@/lib/supabase/server'
import { ExtrasClient, CurrentGuestBooking } from './ExtrasClient'

export default async function ExtrasPage() {
  const session = await getUserSession()
  if (!session) redirect('/login')

  const supabase = await createClient()

  const [propertyRes, currentGuestsRes, catalogRes] = await Promise.all([
    supabase
      .from('properties')
      .select('id, name')
      .eq('id', session.propertyId)
      .single(),

    supabase
      .from('bookings')
      .select(`
        id, check_in_date, check_out_date,
        guest:guest_id(id, first_name, last_name),
        bed:bed_id(name, room:room_id(name)),
        extras:booking_extras(id, name, quantity, unit_price, created_at)
      `)
      .eq('property_id', session.propertyId)
      .eq('status', 'checked_in')
      .order('check_out_date'),

    supabase
      .from('extra_catalog')
      .select('id, name, emoji, default_price')
      .eq('property_id', session.propertyId)
      .order('sort_order')
      .order('created_at'),
  ])

  if (!propertyRes.data) redirect('/onboarding')

  return (
    <ExtrasClient
      propertyId={propertyRes.data.id}
      currentGuests={(currentGuestsRes.data ?? []) as unknown as CurrentGuestBooking[]}
      catalog={catalogRes.data ?? []}
    />
  )
}
