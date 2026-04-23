import { redirect } from 'next/navigation'
import { createClient, getUserSession } from '@/lib/supabase/server'
import { SettingsClient } from './SettingsClient'

export default async function SettingsPage() {
  const session = await getUserSession()
  if (!session) redirect('/login')
  if (!session.isOwner) redirect('/dashboard')

  const supabase = await createClient()

  const { data: property } = await supabase
    .from('properties').select('*').eq('id', session.propertyId).single()
  if (!property) redirect('/onboarding')

  return <SettingsClient property={property} />
}
