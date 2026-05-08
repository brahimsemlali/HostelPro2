import { redirect } from 'next/navigation'
import { createClient, getUserSession } from '@/lib/supabase/server'
import { IntegrationsClient } from './IntegrationsClient'

export default async function IntegrationsPage() {
  const session = await getUserSession()
  if (!session) redirect('/login')
  if (!session.isOwner) redirect('/dashboard')

  const supabase = await createClient()

  // Use select('*') so missing columns don't cause query failure before migration is run
  // Fetch property + existing booking refs in parallel
  const [propertyRes, existingRefsRes] = await Promise.all([
    supabase.from('properties').select('*').eq('id', session.propertyId).single(),
    supabase.from('bookings').select('external_booking_id').eq('property_id', session.propertyId).eq('source', 'booking_com').not('external_booking_id', 'is', null),
  ])

  const { data: property, error: propError } = propertyRes
  if (!property || propError) redirect('/onboarding')

  const { data: existingRefs } = existingRefsRes

  const importedRefs = new Set((existingRefs ?? []).map((b) => b.external_booking_id))

  const p = property as Record<string, unknown>

  return (
    <IntegrationsClient
      propertyId={property.id}
      savedIcalUrl={typeof p.booking_com_ical_url === 'string' ? p.booking_com_ical_url : null}
      lastSync={typeof p.last_ical_sync === 'string' ? p.last_ical_sync : null}
      importedRefs={Array.from(importedRefs)}
    />
  )
}
