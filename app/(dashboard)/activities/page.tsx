import { redirect } from 'next/navigation'
import { createClient, getUserSession } from '@/lib/supabase/server'
import { ActivitiesClient } from './ActivitiesClient'

export default async function ActivitiesPage() {
  const session = await getUserSession()
  if (!session) redirect('/login')
  if (session.role === 'housekeeping') redirect('/beds')

  const supabase = await createClient()

  const { data: property } = await supabase
    .from('properties').select('id, name, currency').eq('id', session.propertyId).single()
  if (!property) redirect('/onboarding')

  // Fetch upcoming activities
  const today = new Date().toISOString().split('T')[0]
  
  const { data: activities } = await supabase
    .from('activities')
    .select('*')
    .eq('property_id', property.id)
    .gte('activity_date', today)
    .order('activity_date', { ascending: true })
    .order('start_time', { ascending: true })

  return (
    <ActivitiesClient 
      propertyId={property.id} 
      currency={property.currency ?? 'MAD'} 
      initialActivities={activities ?? []} 
    />
  )
}
