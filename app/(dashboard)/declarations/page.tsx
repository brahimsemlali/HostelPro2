import { redirect } from 'next/navigation'
import { createClient, getUserSession } from '@/lib/supabase/server'
import { PROPERTY_LEGAL_COLUMNS, type PropertyLegal } from '@/lib/invoicing'
import { DeclarationsClient } from './DeclarationsClient'

export default async function DeclarationsPage() {
  const session = await getUserSession()
  if (!session) redirect('/login')
  if (session.role === 'housekeeping') redirect('/beds')
  if (session.role === 'receptionist') redirect('/dashboard')

  const supabase = await createClient()
  const [propertyRes, legalRes] = await Promise.all([
    supabase.from('properties').select('id, name, city, address, police_prefecture').eq('id', session.propertyId).single(),
    supabase.from('property_legal').select(PROPERTY_LEGAL_COLUMNS).eq('property_id', session.propertyId).maybeSingle(),
  ])

  if (!propertyRes.data) {
    if (propertyRes.error?.code === 'PGRST116') redirect('/onboarding')
    else redirect('/login?error=service_unavailable')
  }

  return (
    <DeclarationsClient
      property={propertyRes.data}
      legal={(legalRes.data as PropertyLegal | null) ?? null}
      // property_legal is missing until migration 034 is applied.
      invoicingAvailable={!legalRes.error}
      isOwner={session.isOwner}
    />
  )
}
