import { redirect } from 'next/navigation'
import { notFound } from 'next/navigation'
import { createClient, getUserSession } from '@/lib/supabase/server'
import { BookingDetailClient } from './BookingDetailClient'

export default async function BookingDetailPage({
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
    .select('*')
    .eq('id', session.propertyId)
    .single()
  if (!property) redirect('/onboarding')

  const { data: booking } = await supabase
    .from('bookings')
    .select('*, guest:guest_id(*), bed:bed_id(*, room:room_id(*))')
    .eq('id', id)
    .eq('property_id', property.id)
    .single()

  if (!booking) notFound()

  const [{ data: payments }, { data: extras }] = await Promise.all([
    supabase.from('payments').select('*').eq('booking_id', id).order('payment_date', { ascending: false }),
    supabase.from('booking_extras').select('*').eq('booking_id', id).order('created_at'),
  ])

  const { data: beds } = await supabase
    .from('beds')
    .select('id, name, base_price, status, room:room_id(name)')
    .eq('property_id', property.id)
    .order('name')

  const totalPaid = payments?.reduce((s, p) => p.type === 'refund' ? s - p.amount : s + p.amount, 0) ?? 0
  const extrasTotal = extras?.reduce((s, e) => s + (e.quantity * e.unit_price), 0) ?? 0
  const balance = (booking.total_price + extrasTotal) - totalPaid

  // Normalise room from array (Supabase join) to object
  type BedOption = { id: string; name: string; base_price: number; status: string; room: { name: string } | null }
  const normalizedBeds: BedOption[] = (beds ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    base_price: b.base_price,
    status: b.status,
    room: Array.isArray(b.room) ? (b.room[0] ?? null) : (b.room ?? null),
  }))

  return (
    <BookingDetailClient
      booking={booking}
      payments={payments ?? []}
      extras={extras ?? []}
      beds={normalizedBeds}
      property={property}
      totalPaid={totalPaid}
      extrasTotal={extrasTotal}
    />
  )
}
