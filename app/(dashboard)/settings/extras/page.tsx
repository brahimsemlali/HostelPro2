import { redirect } from 'next/navigation'
import { createClient, getUserSession } from '@/lib/supabase/server'
import { ExtraCatalogClient } from './ExtraCatalogClient'

export default async function ExtraCatalogPage() {
  const session = await getUserSession()
  if (!session) redirect('/login')
  if (!session.isOwner) redirect('/dashboard')

  const supabase = await createClient()

  const [propertyRes, catalogRes] = await Promise.all([
    supabase
      .from('properties')
      .select('id, name')
      .eq('id', session.propertyId)
      .single(),

    supabase
      .from('extra_catalog')
      .select('*')
      .eq('property_id', session.propertyId)
      .order('sort_order')
      .order('created_at'),
  ])

  if (!propertyRes.data) {
    if (propertyRes.error?.code === 'PGRST116') redirect('/onboarding')
    else redirect('/login?error=service_unavailable')
  }

  return (
    <ExtraCatalogClient
      propertyId={propertyRes.data.id}
      catalog={catalogRes.data ?? []}
    />
  )
}
