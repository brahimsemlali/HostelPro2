import { redirect } from 'next/navigation'
import { createClient, getUserSession } from '@/lib/supabase/server'
import { NightAuditClient } from './NightAuditClient'

export default async function NightAuditPage() {
  const session = await getUserSession()
  if (!session) redirect('/login')
  // Night audit requires manager or owner
  if (!session.isOwner && session.role !== 'manager') redirect('/dashboard')

  const supabase = await createClient()

  const { data: property } = await supabase
    .from('properties').select('id, name, city, police_prefecture').eq('id', session.propertyId).single()
  if (!property) redirect('/onboarding')

  // Use local date to avoid UTC off-by-one at midnight in UTC+1 (Morocco)
  const today = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD

  const { data: beds } = await supabase
    .from('beds').select('id, status').eq('property_id', property.id)

  const { data: todayCheckIns } = await supabase
    .from('bookings')
    .select('*, guest:guest_id(first_name, last_name, nationality, document_number, gender, date_of_birth, country_of_residence)')
    .eq('property_id', property.id)
    .eq('check_in_date', today)
    .in('status', ['checked_in', 'confirmed'])

  const { data: todayCheckOuts } = await supabase
    .from('bookings')
    .select('*, guest:guest_id(first_name, last_name, nationality, document_number, gender, date_of_birth, country_of_residence)')
    .eq('property_id', property.id)
    .eq('check_out_date', today)
    .in('status', ['checked_out', 'checked_in'])

  const { data: todayPayments } = await supabase
    .from('payments')
    .select('amount, method, type')
    .eq('property_id', property.id)
    .eq('status', 'completed')
    .gte('payment_date', `${today}T00:00:00`)

  const { data: tomorrowArrivals } = await supabase
    .from('bookings')
    .select('*, guest:guest_id(first_name, last_name), bed:bed_id(name, room:room_id(name))')
    .eq('property_id', property.id)
    // eslint-disable-next-line react-hooks/purity
    .eq('check_in_date', new Date(Date.now() + 86400000).toISOString().split('T')[0])
    .in('status', ['confirmed', 'checked_in'])

  // Foreign guests checked in today
  const { data: foreignGuestsToday } = await supabase
    .from('bookings')
    .select('*, guest:guest_id(first_name, last_name, nationality, document_number, gender, date_of_birth, country_of_residence)')
    .eq('property_id', property.id)
    .eq('check_in_date', today)
    .eq('status', 'checked_in')

  // Check if tonight's audit was already completed
  const { data: existingAudit } = await supabase
    .from('night_audits')
    .select('id, created_at')
    .eq('property_id', property.id)
    .eq('audit_date', today)
    .maybeSingle()

  // Dirty beds
  const dirtyBeds = beds?.filter((b) => b.status === 'dirty') ?? []
  const totalBeds = beds?.length ?? 0
  const occupiedBeds = beds?.filter((b) => b.status === 'occupied').length ?? 0

  const cashToday = (todayPayments ?? [])
    .filter((p) => p.method === 'cash')
    .reduce((s, p) => s + (p.type === 'refund' ? -p.amount : p.amount), 0)
  const totalRevenue = (todayPayments ?? [])
    .reduce((s, p) => s + (p.type === 'refund' ? -p.amount : p.amount), 0)

  return (
    <NightAuditClient
      property={property}
      userId={session.userId}
      today={today}
      alreadyCompleted={!!existingAudit}
      stats={{
        checkInsToday: todayCheckIns?.length ?? 0,
        checkOutsToday: todayCheckOuts?.length ?? 0,
        occupiedBeds,
        totalBeds,
        cashToday,
        totalRevenue,
      }}
      tomorrowArrivals={tomorrowArrivals ?? []}
      dirtyBedsCount={dirtyBeds.length}
      foreignGuestsToday={foreignGuestsToday ?? []}
    />
  )
}
