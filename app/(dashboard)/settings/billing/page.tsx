import { redirect } from 'next/navigation'
import { createClient, getUserSession } from '@/lib/supabase/server'
import { BillingClient } from './BillingClient'

export default async function BillingPage() {
  const session = await getUserSession()
  if (!session) redirect('/login')
  if (!session.isOwner) redirect('/dashboard')

  const supabase = await createClient()

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('property_id', session.propertyId)
    .maybeSingle()

  return (
    <BillingClient
      propertyId={session.propertyId}
      subscription={subscription}
    />
  )
}
