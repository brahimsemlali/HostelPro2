import { redirect } from 'next/navigation'
import { createClient, getUserSession } from '@/lib/supabase/server'
import { DashboardCommandCenter } from '@/components/dashboard/DashboardClient'
import type { DashboardInitialData } from '@/components/dashboard/DashboardClient'

export default async function DashboardPage() {
  const session = await getUserSession()
  if (!session) redirect('/login')

  // Housekeeping staff should not see the dashboard — send them to the bed map
  if (session.role === 'housekeeping') redirect('/beds')

  const supabase = await createClient()

  const { data: property } = await supabase
    .from('properties')
    .select('id, name, city, check_in_time, check_out_time, currency, review_url')
    .eq('id', session.propertyId)
    .single()

  if (!property) redirect('/onboarding')

  // Local date to avoid UTC off-by-one at midnight in UTC+1 (Morocco)
  const today = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toLocaleDateString('en-CA')
  const weekEnd = new Date()
  weekEnd.setDate(weekEnd.getDate() + 7)
  const weekEndStr = weekEnd.toISOString().split('T')[0]

  // Arrivals select — includes new arrival pipeline fields
  const arrivalSelect =
    'id, bed_id, status, source, check_in_date, check_out_date, pre_checkin_completed, pre_checkin_token, arrival_notes, expected_arrival_time, guest:guest_id(first_name, last_name, nationality, phone, whatsapp), bed:bed_id(name, room:room_id(name))'

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)

  // All data fetched in a single parallel round-trip.
  // Arrivals: one query covering today → weekEnd, split in JS below (saves 2 round-trips).
  // Checked-in bookings: payments embedded via nested select (eliminates sequential N+1 fetch).
  const [
    bedsRes,
    todayPaymentsRes,
    allArrivalsRes,
    departuresRes,
    recentBookingsRes,
    recentPaymentsRes,
    weekPaymentsRes,
    forecastRes,
    activityRes,
    roomsRes,
    allBedsRes,
    allCheckedInRes,
  ] = await Promise.all([
    supabase.from('beds').select('id, status').eq('property_id', property.id),

    supabase
      .from('payments')
      .select('amount, method')
      .eq('property_id', property.id)
      .eq('status', 'completed')
      .gte('payment_date', `${today}T00:00:00`)
      .lt('payment_date', `${today}T23:59:59`),

    // Single arrivals query — today through end of week — split by date in JS
    supabase
      .from('bookings')
      .select(arrivalSelect)
      .eq('property_id', property.id)
      .gte('check_in_date', today)
      .lt('check_in_date', weekEndStr)
      .in('status', ['confirmed', 'checked_in'])
      .order('check_in_date')
      .order('created_at'),

    supabase
      .from('bookings')
      .select('id, bed_id, status, check_out_date, total_price, guest:guest_id(first_name, last_name), bed:bed_id(name)')
      .eq('property_id', property.id)
      .eq('check_out_date', today)
      .eq('status', 'checked_in'),

    supabase
      .from('bookings')
      .select('id, status, created_at, guest:guest_id(first_name, last_name)')
      .eq('property_id', property.id)
      .order('created_at', { ascending: false })
      .limit(5),

    supabase
      .from('payments')
      .select('id, amount, method, created_at, guest:guest_id(first_name, last_name)')
      .eq('property_id', property.id)
      .order('created_at', { ascending: false })
      .limit(5),

    supabase
      .from('payments')
      .select('amount, method, type, payment_date')
      .eq('property_id', property.id)
      .eq('status', 'completed')
      .gte('payment_date', sevenDaysAgo.toISOString()),

    // Forecast: all active bookings overlapping the next 7 days
    supabase
      .from('bookings')
      .select('check_in_date, check_out_date')
      .eq('property_id', property.id)
      .in('status', ['confirmed', 'checked_in'])
      .lte('check_in_date', (() => { const d = new Date(); d.setDate(d.getDate() + 6); return d.toISOString().split('T')[0] })())
      .gt('check_out_date', today),

    supabase
      .from('activity_log')
      .select('id, action_type, description, staff_name, created_at, meta')
      .eq('property_id', property.id)
      .order('created_at', { ascending: false })
      .limit(15),

    // Rooms for AddArrivalModal
    supabase
      .from('rooms')
      .select('id, name, type')
      .eq('property_id', property.id)
      .order('name'),

    // All beds with room info for AddArrivalModal
    supabase
      .from('beds')
      .select('id, name, room_id, base_price, status, room:room_id(name)')
      .eq('property_id', property.id)
      .order('name'),

    // Checked-in bookings with payments embedded — eliminates the sequential N+1 fetch
    supabase
      .from('bookings')
      .select('id, total_price, check_out_date, guest:guest_id(first_name, last_name), extras:booking_extras(quantity, unit_price), booking_payments:payments(booking_id, amount, type, status)')
      .eq('property_id', property.id)
      .eq('status', 'checked_in'),
  ])

  // Split consolidated arrivals by date
  const allArrivals = allArrivalsRes.data ?? []
  const arrivalsRes = { data: allArrivals.filter((b) => b.check_in_date === today) }
  const arrivalsTomorrowRes = { data: allArrivals.filter((b) => b.check_in_date === tomorrowStr) }
  const arrivalsWeekRes = { data: allArrivals }

  // Compute paid totals from embedded payments (no second query needed)
  type EmbeddedPayment = { booking_id: string; amount: number; type: string; status: string }
  const totalPaidByBooking = (allCheckedInRes.data ?? []).reduce<Record<string, number>>((acc, b) => {
    const paid = (b.booking_payments as EmbeddedPayment[] | null)
      ?.filter((p) => p.status === 'completed')
      .reduce((s, p) => (p.type === 'refund' ? s - p.amount : s + p.amount), 0) ?? 0
    acc[b.id] = paid
    return acc
  }, {})

  const extrasTotalByBooking: Record<string, number> = {}
  ;(allCheckedInRes.data ?? []).forEach((b) => {
    extrasTotalByBooking[b.id] = (b.extras as { quantity: number; unit_price: number }[] | null)?.reduce((s, e) => s + e.quantity * e.unit_price, 0) ?? 0
  })

  const pendingPayments = (allCheckedInRes.data ?? [])
    .map((b) => ({
      id: b.id,
      total_price: b.total_price + (extrasTotalByBooking[b.id] ?? 0),
      total_paid: totalPaidByBooking[b.id] ?? 0,
      balance: (b.total_price + (extrasTotalByBooking[b.id] ?? 0)) - (totalPaidByBooking[b.id] ?? 0),
      check_out_date: b.check_out_date,
      guest: b.guest as unknown as { first_name: string; last_name: string } | null,
    }))
    .filter((b) => b.balance > 0.01)
    .sort((a, b) => a.check_out_date.localeCompare(b.check_out_date))

  // Build chart data server-side for initial render
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const dayStr = d.toLocaleDateString('en-CA')
    const dayPayments = (weekPaymentsRes.data ?? []).filter((p) => p.payment_date.startsWith(dayStr))
    return {
      day: d.toLocaleDateString('fr-FR', { weekday: 'short' }),
      revenue: dayPayments.reduce((s, p) => s + (p.type === 'refund' ? -p.amount : p.amount), 0),
      cash: dayPayments
        .filter((p) => p.method === 'cash')
        .reduce((s, p) => s + (p.type === 'refund' ? -p.amount : p.amount), 0),
      virement: dayPayments
        .filter((p) => p.method === 'virement')
        .reduce((s, p) => s + (p.type === 'refund' ? -p.amount : p.amount), 0),
      cmi: dayPayments
        .filter((p) => p.method === 'cmi')
        .reduce((s, p) => s + (p.type === 'refund' ? -p.amount : p.amount), 0),
    }
  })

  // Build 7-day occupancy forecast
  const forecastBookings = forecastRes.data ?? []
  const totalBeds = bedsRes.data?.length ?? 0
  const forecastDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    const dayStr = d.toISOString().split('T')[0]
    const occupied = forecastBookings.filter(
      (b) => b.check_in_date <= dayStr && b.check_out_date > dayStr,
    ).length
    return {
      date: dayStr,
      label: i === 0 ? "Auj'" : d.toLocaleDateString('fr-FR', { weekday: 'short' }),
      occupied,
      total: totalBeds,
    }
  })

  // Cross-reference: which dirty beds have confirmed arrivals today?
  const dirtyBedIds = new Set(
    (bedsRes.data ?? []).filter((b) => b.status === 'dirty').map((b) => b.id),
  )
  const dirtyBedsWithArrivalsCount = (arrivalsRes.data ?? []).filter(
    (b) => b.bed_id && dirtyBedIds.has(b.bed_id),
  ).length

  // Enrich departure bookings with balance_due (includes extras)
  const departuresWithBalance = (departuresRes.data ?? []).map((b) => ({
    ...b,
    balance_due: (b.total_price + (extrasTotalByBooking[b.id] ?? 0)) - (totalPaidByBooking[b.id] ?? 0),
  }))

  const initialData: DashboardInitialData = {
    beds: bedsRes.data ?? [],
    todayPayments: todayPaymentsRes.data ?? [],
    arrivalsToday: (arrivalsRes.data ?? []) as unknown as DashboardInitialData['arrivalsToday'],
    arrivalsTomorrow: (arrivalsTomorrowRes.data ?? []) as unknown as DashboardInitialData['arrivalsTomorrow'],
    arrivalsWeek: (arrivalsWeekRes.data ?? []) as unknown as DashboardInitialData['arrivalsWeek'],
    departuresToday: departuresWithBalance as unknown as DashboardInitialData['departuresToday'],
    recentBookings: (recentBookingsRes.data ?? []) as DashboardInitialData['recentBookings'],
    recentPayments: (recentPaymentsRes.data ?? []) as DashboardInitialData['recentPayments'],
    chartData,
    dirtyBedsWithArrivalsCount,
    forecastDays,
    recentActivity: (activityRes.data ?? []) as DashboardInitialData['recentActivity'],
    rooms: (roomsRes.data ?? []) as DashboardInitialData['rooms'],
    allBeds: (allBedsRes.data ?? []) as unknown as DashboardInitialData['allBeds'],
    pendingPayments,
  }

  return <DashboardCommandCenter property={property} initialData={initialData} />
}
