import { redirect } from 'next/navigation'
import { notFound } from 'next/navigation'
import { createClient, getUserSession } from '@/lib/supabase/server'
import { BookingDetailClient } from './BookingDetailClient'
import { withoutSecrets } from '@/lib/constants'
import { netReceived } from '@/lib/money'
import { INVOICE_COLUMNS, PROPERTY_LEGAL_COLUMNS, type Invoice, type PropertyLegal } from '@/lib/invoicing'
import type { FreeBed } from '@/components/bookings/AssignBedCard'

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getUserSession()
  if (!session) redirect('/login')
  if (session.role === 'housekeeping') redirect('/beds')

  const supabase = await createClient()

  // Fetch property + booking in parallel (security check via session.propertyId)
  const [propertyRes, bookingRes] = await Promise.all([
    supabase.from('properties').select('*').eq('id', session.propertyId).single(),
    supabase.from('bookings').select('id, status, source, external_booking_id, check_in_date, check_out_date, nights, adults, total_price, commission_rate, net_revenue, special_requests, internal_notes, check_in_time, check_out_time, police_fiche_generated, police_fiche_url, pre_checkin_completed, pre_checkin_token, arrival_notes, expected_arrival_time, bed_id, guest_id, property_id, created_at, guest:guest_id(id, first_name, last_name, email, phone, whatsapp, nationality, document_type, document_number, date_of_birth, gender, country_of_residence, profession, address_in_morocco, next_destination, notes, total_stays, total_spent, is_flagged, flag_reason, created_at), bed:bed_id(id, name, base_price, room_id, bunk_position, status, notes, property_id, created_at, room:room_id(id, name, type, gender_policy, floor, property_id, created_at))').eq('id', id).eq('property_id', session.propertyId).single(),
  ])

  const property = propertyRes.data ? withoutSecrets(propertyRes.data) : null
  if (!property) {
    if (propertyRes.error?.code === 'PGRST116') redirect('/onboarding')
    else redirect('/login?error=service_unavailable')
  }
  const booking = bookingRes.data
  if (!booking) notFound()
  let fromChannel = false

  const [{ data: payments }, { data: extras }, { data: beds }, legalRes, invoicesRes] = await Promise.all([
    supabase.from('payments').select('id, amount, method, type, status, reference, notes, payment_date, created_at, property_id, booking_id, guest_id, recorded_by').eq('booking_id', id).order('payment_date', { ascending: false }),
    supabase.from('booking_extras').select('id, name, quantity, unit_price, created_at, booking_id, property_id').eq('booking_id', id).order('created_at'),
    supabase.from('beds').select('id, name, base_price, status, room:room_id(name)').eq('property_id', session.propertyId).order('name'),
    supabase.from('property_legal').select(PROPERTY_LEGAL_COLUMNS).eq('property_id', session.propertyId).maybeSingle(),
    supabase.from('invoices').select(INVOICE_COLUMNS).eq('booking_id', id).order('created_at'),
  ])
  // Both error until migration 034 is applied: the invoicing card is then hidden.
  const invoicingEnabled = !legalRes.error && !invoicesRes.error

  // Completed payments only — a pending/failed payment is not money received.
  const totalPaid = netReceived(payments)
  const extrasTotal = extras?.reduce((s, e) => s + (e.quantity * e.unit_price), 0) ?? 0
  const balance = (booking.total_price + extrasTotal) - totalPaid

  // Bed-less booking (online / iCal import): offer the beds free for the whole
  // stay — of its room type when it has one (migration 036; before it, the
  // room_type_id read errors and every free bed is offered).
  let freeBeds: FreeBed[] | null = null
  if (!booking.bed_id && ['pending', 'confirmed', 'checked_in'].includes(booking.status)) {
    const [typeRes, roomsRes, busyRes] = await Promise.all([
      supabase.from('bookings').select('room_type_id, channel_booking_id').eq('id', id).single(),
      // '*' on purpose: room_type_id only exists after 036, an explicit list would error before it.
      supabase.from('rooms').select('*').eq('property_id', session.propertyId),
      supabase.from('bookings').select('bed_id')
        .eq('property_id', session.propertyId)
        .in('status', ['pending', 'confirmed', 'checked_in'])
        .not('bed_id', 'is', null)
        .lt('check_in_date', booking.check_out_date)
        .gt('check_out_date', booking.check_in_date),
    ])
    const typeId = typeRes.error ? null : (typeRes.data?.room_type_id as string | null)
    fromChannel = !typeRes.error && !!typeRes.data?.channel_booking_id
    const busy = new Set((busyRes.data ?? []).map((b) => b.bed_id as string))
    const rooms = (roomsRes.data ?? []) as { id: string; name: string; gender_policy: FreeBed['genderPolicy']; room_type_id?: string | null }[]
    const roomById = new Map(rooms.map((r) => [r.id, r]))
    const { data: allBeds } = await supabase.from('beds').select('id, name, room_id, status')
      .eq('property_id', session.propertyId).order('name')
    freeBeds = (allBeds ?? [])
      .filter((b) => !busy.has(b.id) && b.status !== 'blocked' && b.status !== 'maintenance')
      .filter((b) => !typeId || roomById.get(b.room_id)?.room_type_id === typeId)
      .map((b) => {
        const room = roomById.get(b.room_id)
        return { id: b.id, name: b.name, roomName: room?.name ?? '', genderPolicy: room?.gender_policy ?? 'mixed' }
      })
  }

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
      assignBed={freeBeds ? { freeBeds, fromChannel } : null}
      invoicing={invoicingEnabled ? {
        legal: (legalRes.data as PropertyLegal | null) ?? null,
        invoices: (invoicesRes.data ?? []) as unknown as Invoice[],
      } : null}
    />
  )
}
