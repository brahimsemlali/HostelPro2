import { redirect } from 'next/navigation'
import { createClient, getUserSession } from '@/lib/supabase/server'
import { RoomsClient } from './RoomsClient'

export default async function RoomsPage() {
  const session = await getUserSession()
  if (!session) redirect('/login')
  if (!session.isOwner) redirect('/dashboard')

  const supabase = await createClient()

  const { data: property } = await supabase
    .from('properties').select('id').eq('id', session.propertyId).single()
  if (!property) redirect('/onboarding')

  const { data: rooms } = await supabase
    .from('rooms').select('*').eq('property_id', property.id).order('name')

  const { data: beds } = await supabase
    .from('beds').select('*').eq('property_id', property.id).order('name')

  return <RoomsClient propertyId={property.id} rooms={rooms ?? []} beds={beds ?? []} />
}
