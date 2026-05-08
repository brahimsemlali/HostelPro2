import { redirect } from 'next/navigation'
import { createClient, getUserSession } from '@/lib/supabase/server'
import { PricingClient } from './PricingClient'

export default async function PricingRulesPage() {
  const session = await getUserSession()
  if (!session) redirect('/login')
  if (!session.isOwner) redirect('/dashboard')

  const supabase = await createClient()

  const [propertyRes, rulesRes] = await Promise.all([
    supabase.from('properties').select('id, name').eq('id', session.propertyId).single(),
    supabase.from('pricing_rules').select('*').eq('property_id', session.propertyId).order('created_at'),
  ])

  if (!propertyRes.data) redirect('/onboarding')

  return <PricingClient propertyId={session.propertyId} rules={rulesRes.data ?? []} />
}
