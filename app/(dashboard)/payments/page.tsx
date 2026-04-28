import { redirect } from 'next/navigation'
import { createClient, getUserSession } from '@/lib/supabase/server'
import { PaymentsClient, CurrentGuestBooking } from './PaymentsClient'

export default async function PaymentsPage() {
  const session = await getUserSession()
  if (!session) redirect('/login')

  const supabase = await createClient()

  const today = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD local time
  // eslint-disable-next-line react-hooks/purity
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA')

  const [
    propertyRes,
    todayPaymentsRes,
    allBookingsRes,
    allPaymentsRes,
    guestsRes,
    bookingsForModalRes,
    currentGuestsRes,
    catalogRes,
  ] = await Promise.all([
    supabase
      .from('properties')
      .select('id, name, currency')
      .eq('id', session.propertyId)
      .single(),

    supabase
      .from('payments')
      .select('*, guest:guest_id(first_name, last_name), booking:booking_id(check_in_date, check_out_date)')
      .eq('property_id', session.propertyId)
      .gte('payment_date', `${today}T00:00:00`)
      .order('payment_date', { ascending: false })
      .limit(100),

    supabase
      .from('bookings')
      .select('*, guest:guest_id(first_name, last_name, phone, whatsapp), bed:bed_id(name, room:room_id(name)), extras:booking_extras(quantity, unit_price)')
      .eq('property_id', session.propertyId)
      .in('status', ['confirmed', 'checked_in'])
      .order('check_out_date')
      .limit(500),

    supabase
      .from('payments')
      .select('booking_id, amount, type')
      .eq('property_id', session.propertyId)
      .eq('status', 'completed')
      .in('type', ['payment', 'deposit', 'refund'])
      .gte('payment_date', ninetyDaysAgo)
      .limit(2000),

    supabase
      .from('guests')
      .select('id, first_name, last_name')
      .eq('property_id', session.propertyId)
      .limit(200),

    supabase
      .from('bookings')
      .select('id, check_in_date, check_out_date, total_price, guest:guest_id(first_name, last_name)')
      .eq('property_id', session.propertyId)
      .in('status', ['confirmed', 'checked_in'])
      .limit(100),

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

  const property = propertyRes.data
  if (!property) redirect('/onboarding')

  // Calculate pending
  const paidByBooking: Record<string, number> = {}
  allPaymentsRes.data?.forEach((p) => {
    if (p.booking_id) {
      const amount = p.type === 'refund' ? -p.amount : p.amount
      paidByBooking[p.booking_id] = (paidByBooking[p.booking_id] ?? 0) + amount
    }
  })

  const pendingBookings = allBookingsRes.data?.filter((b) => {
    const paid = paidByBooking[b.id] ?? 0
    const extrasTotal = (b.extras as { quantity: number; unit_price: number }[] | null)?.reduce((s, e) => s + e.quantity * e.unit_price, 0) ?? 0
    return paid < b.total_price + extrasTotal
  }).map((b) => {
    const extrasTotal = (b.extras as { quantity: number; unit_price: number }[] | null)?.reduce((s, e) => s + e.quantity * e.unit_price, 0) ?? 0
    const paid = paidByBooking[b.id] ?? 0
    return {
      ...b,
      amount_paid: paid,
      extras_total: extrasTotal,
      balance_due: (b.total_price + extrasTotal) - paid,
    }
  }) ?? []

  return (
    <PaymentsClient
      propertyId={property.id}
      todayPayments={todayPaymentsRes.data ?? []}
      pendingBookings={pendingBookings}
      bookingsForModal={(bookingsForModalRes.data ?? []) as unknown as { id: string; check_in_date: string; check_out_date: string; total_price: number; guest: { first_name: string; last_name: string } | null }[]}
      currentGuests={(currentGuestsRes.data ?? []) as unknown as CurrentGuestBooking[]}
      catalog={catalogRes.data ?? []}
    />
  )
}
