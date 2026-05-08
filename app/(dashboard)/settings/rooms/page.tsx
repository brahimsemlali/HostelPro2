import { redirect } from 'next/navigation'
import { createClient, getUserSession } from '@/lib/supabase/server'
import { RoomsClient } from './RoomsClient'

export default async function RoomsPage() {
  const session = await getUserSession()
  if (!session) redirect('/login')
  if (!session.isOwner) redirect('/dashboard')

  const supabase = await createClient()

  const [roomsRes, bedsRes] = await Promise.all([
    supabase.from('rooms').select('*').eq('property_id', session.propertyId).order('name'),
    supabase.from('beds').select('*').eq('property_id', session.propertyId).order('name'),
  ])

  return <RoomsClient propertyId={session.propertyId} rooms={roomsRes.data ?? []} beds={bedsRes.data ?? []} />
}
