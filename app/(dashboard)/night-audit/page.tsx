import { redirect } from 'next/navigation'
import { createClient, getUserSession } from '@/lib/supabase/server'
import { addDaysISO, businessDateISO, dayRangeUTC } from '@/lib/dates'
import { NightAuditClient } from './NightAuditClient'

export default async function NightAuditPage() {
  const session = await getUserSession()
  if (!session) redirect('/login')
  // Night audit requires manager or owner
  if (!session.isOwner && session.role !== 'manager') redirect('/dashboard')

  const supabase = await createClient()

  const { data: property, error: propertyError } = await supabase
    .from('properties').select('id, name, city, police_prefecture').eq('id', session.propertyId).single()
  if (!property) {
    if (propertyError?.code === 'PGRST116') redirect('/onboarding')
    else redirect('/login?error=service_unavailable')
  }

  // The audit closes a *business* day in Morocco: an audit finished at 01:30
  // still belongs to the previous day (the server runs in UTC — lib/dates).
  const today = businessDateISO()
  const dayRange = dayRangeUTC(today)

  // Every column the fiche-de-police PDF prints (lib/pdf/fiche-police.ts)
  const ficheGuest =
    'guest:guest_id(first_name, last_name, nationality, document_type, document_number, gender, date_of_birth, country_of_residence, profession, address_in_morocco, next_destination)'
  const bookingCols = 'id, bed_id, guest_id, status, check_in_date, check_out_date, source, total_price'

  const [bedsRes, checkInsRes, checkOutsRes, paymentsRes, tomorrowRes, auditRes] = await Promise.all([
    supabase.from('beds').select('id, status').eq('property_id', property.id),
    supabase
      .from('bookings')
      .select(`${bookingCols}, ${ficheGuest}`)
      .eq('property_id', property.id)
      .eq('check_in_date', today)
      .in('status', ['checked_in', 'confirmed']),
    supabase
      .from('bookings')
      .select('id')
      .eq('property_id', property.id)
      .eq('check_out_date', today)
      .in('status', ['checked_out', 'checked_in']),
    supabase
      .from('payments')
      .select('amount, method, type')
      .eq('property_id', property.id)
      .eq('status', 'completed')
      .gte('payment_date', dayRange.start)
      .lt('payment_date', dayRange.end),
    supabase
      .from('bookings')
      .select(`${bookingCols}, guest:guest_id(first_name, last_name), bed:bed_id(name, room:room_id(name))`)
      .eq('property_id', property.id)
      .eq('check_in_date', addDaysISO(today, 1))
      .in('status', ['confirmed', 'checked_in']),
    // limit(1): without the unique key from migration 023 two colleagues can
    // both have inserted; maybeSingle() would then error and offer a re-run.
    supabase
      .from('night_audits')
      .select('id, created_at')
      .eq('property_id', property.id)
      .eq('audit_date', today)
      .limit(1),
  ])

  const beds = bedsRes.data
  const todayCheckIns = checkInsRes.data
  const todayCheckOuts = checkOutsRes.data
  const todayPayments = paymentsRes.data
  const tomorrowArrivals = tomorrowRes.data
  const existingAudit = auditRes.data?.[0] ?? null

  // Police report: foreign guests who checked in today (Moroccan nationals
  // are not on the fiche-de-police register)
  const isMoroccan = (n: string | null | undefined) => !!n && /^(maroc|morocco|ma|marocaine?|moroccan|المغرب)$/i.test(n.trim())
  const foreignGuestsToday = (todayCheckIns ?? []).filter((b) => {
    const g = b.guest as unknown as { nationality?: string | null } | null
    return b.status === 'checked_in' && !isMoroccan(g?.nationality)
  })

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
      tomorrowArrivals={(tomorrowArrivals ?? []) as unknown as Parameters<typeof NightAuditClient>[0]['tomorrowArrivals']}
      dirtyBedsCount={dirtyBeds.length}
      foreignGuestsToday={foreignGuestsToday as unknown as Parameters<typeof NightAuditClient>[0]['foreignGuestsToday']}
    />
  )
}
