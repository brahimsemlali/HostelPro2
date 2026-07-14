import { redirect } from 'next/navigation'
import { createClient, getUserSession } from '@/lib/supabase/server'
import { isSubscriptionBlocked } from '@/lib/billing'
import { BillingClient } from './BillingClient'
import { SubscriptionSuspendedNotice } from './SubscriptionSuspendedNotice'

export default async function BillingPage() {
  const session = await getUserSession()
  if (!session) redirect('/login')

  // Non-owner staff can't manage billing. But if the subscription is blocked,
  // the dashboard layout redirects everyone here — so we must NOT bounce them
  // back to /dashboard (that would ping-pong into an infinite redirect loop).
  // Instead show a read-only "contact the owner" notice.
  if (!session.isOwner) {
    if (isSubscriptionBlocked(session.subscriptionStatus, session.subscriptionPeriodEnd, session.isSuperAdmin)) {
      return <SubscriptionSuspendedNotice />
    }
    redirect('/dashboard')
  }

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
