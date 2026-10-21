import { redirect, notFound } from 'next/navigation'
import { createClient, getUserSession } from '@/lib/supabase/server'
import { GuestDetailClient } from '@/components/guests/GuestDetailClient'
import { netReceived, signedAmount } from '@/lib/money'

export default async function GuestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getUserSession()
  if (!session) redirect('/login')
  if (session.role === 'housekeeping') redirect('/beds')

  const supabase = await createClient()

  const { data: property, error: propertyError } = await supabase
    .from('properties')
    .select('id')
    .eq('id', session.propertyId)
    .single()
  if (!property) {
    if (propertyError?.code === 'PGRST116') redirect('/onboarding')
    else redirect('/login?error=service_unavailable')
  }

  const [{ data: guest }, { data: bookings }, { data: payments }] = await Promise.all([
    supabase
      .from('guests')
      .select('*, is_flagged, flag_reason')
      .eq('id', id)
      .eq('property_id', property.id)
      .single(),
    supabase
      .from('bookings')
      .select('id, check_in_date, check_out_date, nights, status, source, total_price, bed:bed_id(name, room:room_id(name))')
      .eq('guest_id', id)
      .eq('property_id', property.id)
      .order('check_in_date', { ascending: false }),
    supabase
      .from('payments')
      .select('id, booking_id, amount, type')
      .eq('guest_id', id)
      .eq('property_id', property.id)
      .eq('status', 'completed'),
  ])

  if (!guest) notFound()

  // Net received per booking — refunds subtract (they used to be dropped,
  // overstating what a refunded guest had paid). See lib/money.
  const amountPaidByBooking: Record<string, number> = {}
  payments?.forEach((p) => {
    if (p.booking_id) {
      amountPaidByBooking[p.booking_id] = (amountPaidByBooking[p.booking_id] ?? 0) + signedAmount(p)
    }
  })

  const totalPaid = netReceived(payments)

  // Normalize Supabase join shape (bed can come back as object or array)
  type NormalizedBed = { name: string; room: { name: string } | null } | null
  const normalizedBookings = (bookings ?? []).map((b) => {
    const rawBed = b.bed as unknown
    let bed: NormalizedBed = null
    if (Array.isArray(rawBed)) {
      bed = rawBed[0] ?? null
    } else if (rawBed && typeof rawBed === 'object') {
      bed = rawBed as NormalizedBed
    }
    return {
      id: b.id,
      check_in_date: b.check_in_date,
      check_out_date: b.check_out_date,
      nights: b.nights,
      status: b.status,
      source: b.source,
      total_price: b.total_price,
      bed,
    }
  })

  return (
    <GuestDetailClient
      guest={guest}
      bookings={normalizedBookings}
      amountPaidByBooking={amountPaidByBooking}
      totalPaid={totalPaid}
    />
  )
}
