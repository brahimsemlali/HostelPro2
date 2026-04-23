import { redirect } from 'next/navigation'
import { createClient, getUserSession } from '@/lib/supabase/server'
import { CheckInWizard } from '@/components/guests/CheckInWizard'

export default async function NewGuestPage({
  searchParams,
}: {
  searchParams: Promise<{ bed?: string; booking?: string }>
}) {
  const params = await searchParams
  const session = await getUserSession()
  if (!session) redirect('/login')

  const supabase = await createClient()

  const { data: property } = await supabase
    .from('properties')
    .select('*')
    .eq('id', session.propertyId)
    .single()
  if (!property) redirect('/onboarding')

  const { data: rooms } = await supabase
    .from('rooms')
    .select('*')
    .eq('property_id', property.id)
    .order('name')

  const { data: beds } = await supabase
    .from('beds')
    .select('*, room:room_id(*)')
    .eq('property_id', property.id)
    .order('name')

  return (
    <CheckInWizard
      property={property}
      rooms={rooms ?? []}
      beds={beds ?? []}
      preselectedBedId={params.bed}
    />
  )
}
