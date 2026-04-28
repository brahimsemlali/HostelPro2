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
    .select('id, name, address, city, phone, email, check_in_time, check_out_time, currency, wifi_password, police_prefecture, default_language, review_url, owner_id, whatsapp_phone_number_id, whatsapp_access_token, booking_com_ical_url, last_ical_sync, created_at')
    .eq('id', session.propertyId)
    .single()
  if (!property) redirect('/onboarding')

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status, source, external_booking_id, check_in_date, check_out_date, nights, adults, total_price, commission_rate, net_revenue, special_requests, internal_notes, check_in_time, check_out_time, police_fiche_generated, police_fiche_url, pre_checkin_completed, pre_checkin_token, arrival_notes, expected_arrival_time, bed_id, guest_id, property_id, created_at, guest:guest_id(id, first_name, last_name, email, phone, whatsapp, nationality, document_type, document_number, date_of_birth, gender, country_of_residence, profession, address_in_morocco, next_destination, notes, total_stays, total_spent, is_flagged, flag_reason, created_at), bed:bed_id(id, name, base_price, room_id, bunk_position, status, notes, property_id, created_at, room:room_id(id, name, type, gender_policy, floor, property_id, created_at))')
    .eq('id', id)
    .eq('property_id', property.id)
    .single()

  if (!booking) notFound()

  const [{ data: payments }, { data: extras }] = await Promise.all([
    supabase.from('payments').select('id, amount, method, type, status, reference, notes, payment_date, created_at, property_id, booking_id, guest_id, recorded_by').eq('booking_id', id).order('payment_date', { ascending: false }),
    supabase.from('booking_extras').select('id, name, quantity, unit_price, created_at, booking_id, property_id').eq('booking_id', id).order('created_at'),
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
      booking={booking as unknown as Parameters<typeof BookingDetailClient>[0]['booking']}
      payments={(payments ?? []) as unknown as Parameters<typeof BookingDetailClient>[0]['payments']}
      extras={(extras ?? []) as unknown as Parameters<typeof BookingDetailClient>[0]['extras']}
      beds={normalizedBeds}
      property={property as unknown as Parameters<typeof BookingDetailClient>[0]['property']}
      totalPaid={totalPaid}
      extrasTotal={extrasTotal}
    />
  )
}
