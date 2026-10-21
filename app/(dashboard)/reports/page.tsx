import { redirect } from 'next/navigation'
import { createClient, getUserSession } from '@/lib/supabase/server'
import { addDaysISO, dayRangeUTC, todayISO } from '@/lib/dates'
import { ReportsClient } from './ReportsClient'

export default async function ReportsPage() {
  const session = await getUserSession()
  if (!session) redirect('/login')
  if (!session.isOwner && session.role !== 'manager') redirect('/dashboard')
  if (session.hideRevenue) redirect('/dashboard')

  const supabase = await createClient()

  const thirtyDaysAgoStr = addDaysISO(todayISO(), -29)

  const [propertyRes, bedsRes, paymentsRes, bookingsRes] = await Promise.all([
    supabase.from('properties').select('id, name, currency').eq('id', session.propertyId).single(),

    supabase.from('beds').select('id').eq('property_id', session.propertyId),

    supabase
      .from('payments')
      .select('amount, method, payment_date, type')
      .eq('property_id', session.propertyId)
      .eq('status', 'completed')
      .gte('payment_date', dayRangeUTC(thirtyDaysAgoStr).start),

    supabase
      .from('bookings')
      .select('id, source, commission_rate, total_price, net_revenue, nights, check_in_date, check_out_date')
      .eq('property_id', session.propertyId)
      .gte('check_in_date', thirtyDaysAgoStr)
      .in('status', ['checked_in', 'checked_out', 'confirmed']),
  ])

  if (!propertyRes.data) {
    if (propertyRes.error?.code === 'PGRST116') redirect('/onboarding')
    else redirect('/login?error=service_unavailable')
  }

  return (
    <ReportsClient
      totalBeds={bedsRes.data?.length ?? 0}
      payments={paymentsRes.data ?? []}
      bookings={bookingsRes.data ?? []}
      propertyId={session.propertyId}
    />
  )
}
