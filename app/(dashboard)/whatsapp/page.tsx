import { redirect } from 'next/navigation'
import { createClient, getUserSession } from '@/lib/supabase/server'
import { WhatsAppClient } from './WhatsAppClient'

export default async function WhatsAppPage() {
  const session = await getUserSession()
  if (!session) redirect('/login')
  if (session.role === 'housekeeping' || session.role === 'receptionist') redirect('/dashboard')

  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  const [propertyRes, messagesRes, activeBookingsRes] = await Promise.all([
    supabase.from('properties').select('id, name, phone, wifi_password, check_out_time').eq('id', session.propertyId).single(),
    supabase.from('whatsapp_messages').select('*, guest:guest_id(first_name, last_name)').eq('property_id', session.propertyId).order('sent_at', { ascending: false }).limit(50),
    supabase.from('bookings').select('*, guest:guest_id(first_name, last_name, phone, whatsapp)').eq('property_id', session.propertyId).eq('status', 'checked_in').gte('check_out_date', today),
  ])

  const property = propertyRes.data
  if (!property) redirect('/onboarding')
  const messages = messagesRes.data
  const activeBookings = activeBookingsRes.data

  return (
    <WhatsAppClient
      property={property}
      messages={messages ?? []}
      activeBookings={activeBookings ?? []}
    />
  )
}
