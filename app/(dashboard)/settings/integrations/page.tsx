import { redirect } from 'next/navigation'
import { createClient, getUserSession } from '@/lib/supabase/server'
import { IntegrationsClient } from './IntegrationsClient'

export default async function IntegrationsPage() {
  const session = await getUserSession()
  if (!session) redirect('/login')
  if (!session.isOwner) redirect('/dashboard')

  const supabase = await createClient()

  // Use select('*') so missing columns don't cause query failure before migration is run
  const { data: property, error: propError } = await supabase
    .from('properties')
    .select('*')
    .eq('id', session.propertyId)
    .single()
  if (!property || propError) redirect('/onboarding')

  // Fetch existing external bookings to detect duplicates
  const { data: existingRefs } = await supabase
    .from('bookings')
    .select('external_booking_id')
    .eq('property_id', property.id)
    .eq('source', 'booking_com')
    .not('external_booking_id', 'is', null)

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
