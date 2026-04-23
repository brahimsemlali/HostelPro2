import { redirect } from 'next/navigation'
import { createClient, getUserSession } from '@/lib/supabase/server'
import { WhatsAppClient } from './WhatsAppClient'

export default async function WhatsAppPage() {
  const session = await getUserSession()
  if (!session) redirect('/login')
  // WhatsApp requires receptionist or above — housekeeping cannot access
  if (session.role === 'housekeeping') redirect('/dashboard')

  const supabase = await createClient()

  const { data: property } = await supabase
    .from('properties').select('id, name, phone, wifi_password, check_out_time').eq('id', session.propertyId).single()
  if (!property) redirect('/onboarding')

  const { data: messages } = await supabase
    .from('whatsapp_messages')
    .select('*, guest:guest_id(first_name, last_name)')
    .eq('property_id', property.id)
    .order('sent_at', { ascending: false })
    .limit(50)

  // Active bookings for sending messages
  const today = new Date().toISOString().split('T')[0]
  const { data: activeBookings } = await supabase
    .from('bookings')
    .select('*, guest:guest_id(first_name, last_name, phone, whatsapp)')
    .eq('property_id', property.id)
    .eq('status', 'checked_in')
    .gte('check_out_date', today)

  return (
    <WhatsAppClient
      property={property}
      messages={messages ?? []}
      activeBookings={activeBookings ?? []}
    />
  )
}
