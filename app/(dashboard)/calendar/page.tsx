import { redirect } from 'next/navigation'
import { createClient, getUserSession } from '@/lib/supabase/server'
import { CalendarClient } from './CalendarClient'

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; days?: string }>
}) {
  const { from, days } = await searchParams
  const session = await getUserSession()
  if (!session) redirect('/login')
  if (session.role === 'housekeeping') redirect('/beds')

  const supabase = await createClient()

  const { data: property } = await supabase
    .from('properties').select('id').eq('id', session.propertyId).single()
  if (!property) redirect('/onboarding')

  // Default: today, show 14 days. Validate `from` is a real ISO date to prevent bad input.
  const todayStr = new Date().toISOString().split('T')[0]
  const isValidDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime())
  const startDate = (from && isValidDate(from)) ? from : todayStr
  
  const daysNum = parseInt(days ?? '14', 10)
  const safeDays = [7, 14, 30].includes(daysNum) ? daysNum : 14

  const endDate = (() => {
    const d = new Date(startDate)
    d.setDate(d.getDate() + safeDays - 1)
    return d.toISOString().split('T')[0]
  })()

  const { data: rooms } = await supabase
    .from('rooms')
    .select('id, name, type')
    .eq('property_id', property.id)
    .order('name')

  const { data: beds } = await supabase
    .from('beds')
    .select('id, name, room_id, base_price, status')
    .eq('property_id', property.id)
    .order('name')

  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, bed_id, check_in_date, check_out_date, status, total_price, guest:guest_id(first_name, last_name, nationality, phone)')
    .eq('property_id', property.id)
    .neq('status', 'cancelled')
    .neq('status', 'no_show')
    .lte('check_in_date', endDate)
    .gte('check_out_date', startDate)

  type CalBooking = {
    id: string; bed_id: string | null; check_in_date: string; check_out_date: string
    status: string; total_price: number
    guest: { first_name: string; last_name: string; nationality: string | null; phone: string | null } | null
  }
  const normalizedBookings: CalBooking[] = (bookings ?? []).map((b) => ({
    id: b.id,
    bed_id: b.bed_id,
    check_in_date: b.check_in_date,
    check_out_date: b.check_out_date,
    status: b.status,
    total_price: b.total_price,
    guest: Array.isArray(b.guest) ? (b.guest[0] ?? null) : (b.guest ?? null),
  }))

  return (
    <CalendarClient
      propertyId={property.id}
      rooms={rooms ?? []}
      beds={beds ?? []}
      bookings={normalizedBookings}
      startDate={startDate}
      endDate={endDate}
    />
  )
}
