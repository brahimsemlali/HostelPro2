import { redirect, notFound } from 'next/navigation'
import { createClient, getUserSession } from '@/lib/supabase/server'
import { GuestDetailClient } from '@/components/guests/GuestDetailClient'

export default async function GuestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getUserSession()
  if (!session) redirect('/login')

  const supabase = await createClient()

  const { data: property } = await supabase
    .from('properties')
    .select('id')
    .eq('id', session.propertyId)
    .single()
  if (!property) redirect('/onboarding')

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

  // Group payment amounts by booking_id (exclude refunds)
  const amountPaidByBooking: Record<string, number> = {}
  payments?.forEach((p) => {
    if (p.booking_id && p.type !== 'refund') {
      amountPaidByBooking[p.booking_id] = (amountPaidByBooking[p.booking_id] ?? 0) + p.amount
    }
  })

  const totalPaid = payments
    ?.filter((p) => p.type !== 'refund')
    .reduce((s, p) => s + p.amount, 0) ?? 0

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
