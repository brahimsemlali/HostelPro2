import { redirect } from 'next/navigation'
import type { Property } from '@/types'
import { createClient, getUserSession } from '@/lib/supabase/server'
import { SettingsClient } from './SettingsClient'
import { withoutSecrets } from '@/lib/constants'

export default async function SettingsPage() {
  const session = await getUserSession()
  if (!session) redirect('/login')
  if (!session.isOwner) redirect('/dashboard')

  const supabase = await createClient()

  const { data: property, error: propertyError } = await supabase
    .from('properties').select('*').eq('id', session.propertyId).single()
  if (!property) {
    if (propertyError?.code === 'PGRST116') redirect('/onboarding')
    else redirect('/login?error=service_unavailable')
  }

  return <SettingsClient property={withoutSecrets(property) as Property} />
}
