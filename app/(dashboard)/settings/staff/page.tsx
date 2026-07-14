import { redirect } from 'next/navigation'
import { createClient, getUserSession } from '@/lib/supabase/server'
import { StaffClient } from './StaffClient'

export default async function StaffPage() {
  const session = await getUserSession()
  if (!session) redirect('/login')
  if (!session.isOwner) redirect('/settings')

  const supabase = await createClient()

  const { data: staff } = await supabase
    .from('staff')
    .select('id, name, role, phone, is_active, hide_revenue, user_id, created_at')
    .eq('property_id', session.propertyId)
    .neq('role', 'owner')
    .order('created_at')

  return <StaffClient staff={staff ?? []} />
}
