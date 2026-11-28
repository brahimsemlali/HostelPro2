import { redirect } from 'next/navigation'
import { createClient, getUserSession } from '@/lib/supabase/server'
import { IntegrationsClient } from './IntegrationsClient'
import { withoutSecrets } from '@/lib/constants'

export default async function IntegrationsPage() {
  const session = await getUserSession()
  if (!session) redirect('/login')
  if (!session.isOwner) redirect('/dashboard')

  const supabase = await createClient()

  // Use select('*') so missing columns don't cause query failure before migration is run
  // Fetch property + existing booking refs in parallel
  const [propertyRes, existingRefsRes, connectionRes] = await Promise.all([
    supabase.from('properties').select('*').eq('id', session.propertyId).single(),
    supabase.from('bookings').select('external_booking_id').eq('property_id', session.propertyId).eq('source', 'booking_com').not('external_booking_id', 'is', null),
    // A Channex connection replaces the iCal import (migration 037; errors before it).
    supabase.from('channel_connections').select('status').eq('property_id', session.propertyId).maybeSingle(),
  ])

  const property = propertyRes.data ? withoutSecrets(propertyRes.data) : null
  const propError = propertyRes.error
  if (!property) {
    if (propError?.code === 'PGRST116') redirect('/onboarding')
    else redirect('/login?error=service_unavailable')
  }

  const { data: existingRefs } = existingRefsRes
  const channelConnected = !connectionRes.error && connectionRes.data?.status === 'active'

  const importedRefs = new Set((existingRefs ?? []).map((b) => b.external_booking_id))

  const p = property as Record<string, unknown>

  return (
    <IntegrationsClient
      propertyId={property.id}
      savedIcalUrl={typeof p.booking_com_ical_url === 'string' ? p.booking_com_ical_url : null}
      lastSync={typeof p.last_ical_sync === 'string' ? p.last_ical_sync : null}
      importedRefs={Array.from(importedRefs)}
      channelConnected={channelConnected}
    />
  )
}
