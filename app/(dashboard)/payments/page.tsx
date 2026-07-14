import { redirect } from 'next/navigation'
import { createClient, getUserSession } from '@/lib/supabase/server'
import { PaymentsClient, CurrentGuestBooking } from './PaymentsClient'

export default async function PaymentsPage() {
  const session = await getUserSession()
  if (!session) redirect('/login')

  const supabase = await createClient()

  const today = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD local time

  const [
    propertyRes,
    todayPaymentsRes,
    allBookingsRes,
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

    // Pending balances: payments embedded per booking so the computation is
    // always complete — a windowed bulk payments fetch silently drops rows
    // (old deposits, >2000 payments) and flags paid guests as owing money.
    supabase
      .from('bookings')
      .select('id, check_in_date, check_out_date, total_price, guest:guest_id(first_name, last_name, phone, whatsapp), bed:bed_id(name, room:room_id(name)), extras:booking_extras(quantity, unit_price), booking_payments:payments(amount, type, status)')
      .eq('property_id', session.propertyId)
      .in('status', ['confirmed', 'checked_in'])
      .order('check_out_date')
      .limit(500),

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
      .order('check_out_date')
      .limit(200),

    supabase
      .from('extra_catalog')
      .select('id, name, emoji, default_price')
      .eq('property_id', session.propertyId)
      .order('sort_order')
      .order('created_at'),
  ])

  const property = propertyRes.data
  if (!property) {
    if (propertyRes.error?.code === 'PGRST116') redirect('/onboarding')
    else redirect('/login?error=service_unavailable')
  }

  // Calculate pending from embedded payments
  const pendingBookings = (allBookingsRes.data ?? []).map((b) => {
    const paid = (b.booking_payments as { amount: number; type: string; status: string }[] | null)
      ?.filter((p) => p.status === 'completed' && ['payment', 'deposit', 'refund'].includes(p.type))
      .reduce((s, p) => s + (p.type === 'refund' ? -p.amount : p.amount), 0) ?? 0
    const extrasTotal = (b.extras as { quantity: number; unit_price: number }[] | null)
      ?.reduce((s, e) => s + e.quantity * e.unit_price, 0) ?? 0
    return {
      ...b,
      amount_paid: paid,
      extras_total: extrasTotal,
      balance_due: (b.total_price + extrasTotal) - paid,
    }
  }).filter((b) => b.balance_due > 0)

  return (
    <PaymentsClient
      propertyId={property.id}
      todayPayments={todayPaymentsRes.data ?? []}
      pendingBookings={pendingBookings as unknown as Parameters<typeof PaymentsClient>[0]['pendingBookings']}
      currentGuests={(currentGuestsRes.data ?? []) as unknown as CurrentGuestBooking[]}
      catalog={catalogRes.data ?? []}
    />
  )
}
