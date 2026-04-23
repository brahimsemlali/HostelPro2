import { redirect } from 'next/navigation'
import { createClient, getUserSession } from '@/lib/supabase/server'
import { PricingClient } from './PricingClient'

export default async function PricingRulesPage() {
  const session = await getUserSession()
  if (!session) redirect('/login')
  if (!session.isOwner) redirect('/dashboard')

  const supabase = await createClient()

  const { data: property } = await supabase
    .from('properties').select('id, name').eq('id', session.propertyId).single()
  if (!property) redirect('/onboarding')

  const { data: rules } = await supabase
    .from('pricing_rules')
    .select('*')
    .eq('property_id', property.id)
    .order('created_at')

  return <PricingClient propertyId={property.id} rules={rules ?? []} />
}
