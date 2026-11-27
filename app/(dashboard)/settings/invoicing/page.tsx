import { redirect } from 'next/navigation'
import { createClient, getUserSession } from '@/lib/supabase/server'
import { PROPERTY_LEGAL_COLUMNS, type PropertyLegal } from '@/lib/invoicing'
import { InvoicingSettingsClient } from './InvoicingSettingsClient'

export default async function InvoicingSettingsPage() {
  const session = await getUserSession()
  if (!session) redirect('/login')
  if (!session.isOwner) redirect('/dashboard')

  const supabase = await createClient()
  const [propertyRes, legalRes] = await Promise.all([
    supabase.from('properties').select('id, name, address, city').eq('id', session.propertyId).single(),
    supabase.from('property_legal').select(PROPERTY_LEGAL_COLUMNS).eq('property_id', session.propertyId).maybeSingle(),
  ])

  if (!propertyRes.data) {
    if (propertyRes.error?.code === 'PGRST116') redirect('/onboarding')
    else redirect('/login?error=service_unavailable')
  }

  return (
    <InvoicingSettingsClient
      property={propertyRes.data}
      legal={(legalRes.data as PropertyLegal | null) ?? null}
      // The table is missing until migration 034 is applied.
      unavailable={!!legalRes.error}
    />
  )
}
