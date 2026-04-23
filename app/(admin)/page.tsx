import { redirect } from 'next/navigation'
import { createClient, getUserSession } from '@/lib/supabase/server'
import { AdminClient } from './AdminClient'

export default async function AdminPage() {
  const session = await getUserSession()
  
  // Hard security: Only Superadmins can enter this route
  if (!session || !session.isSuperAdmin) {
    redirect('/dashboard')
  }

  const supabase = await createClient()

  // Fetch all properties with their subscription status
  const { data: properties } = await supabase
    .from('properties')
    .select(`
      id, name, city, created_at,
      subscriptions ( status, provider, current_period_end )
    `)
    .order('created_at', { ascending: false })

  return (
    <AdminClient 
      properties={(properties ?? []) as any} 
    />
  )
}
