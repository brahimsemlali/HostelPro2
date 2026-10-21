'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Activity } from '@/types'
import { getUserSession } from '@/lib/supabase/server'
import { isSessionBlocked } from '@/lib/billing'

async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}

type GuestPhone = { first_name: string; whatsapp: string | null; phone: string | null }
type GuestPhoneRow = { guest_id: string | null; guests: GuestPhone | GuestPhone[] | null }

const canManageActivities = (role: string) => role === 'owner' || role === 'manager' || role === 'receptionist'

export async function createActivityAction(formData: FormData) {
  const title = formData.get('title') as string
  const description = formData.get('description') as string
  const activity_date = formData.get('activity_date') as string
  const start_time = formData.get('start_time') as string
  const type = formData.get('type') as 'free' | 'paid'
  const price = formData.get('price') ? parseFloat(formData.get('price') as string) : null
  const sendWhatsapp = formData.get('sendWhatsapp') === 'true'
  if (!title || !activity_date || !start_time) {
    return { error: 'Missing required fields' }
  }

  const gate = await getUserSession()
  if (!gate || isSessionBlocked(gate)) return { error: 'Abonnement inactif' }
  // Activities + guest broadcasts are front-desk work (receptionist and up).
  if (!canManageActivities(gate.role)) return { error: 'Accès refusé' }
  // Tenant comes from the session, never from the form.
  const property_id = gate.propertyId
  if (price !== null && (!Number.isFinite(price) || price < 0)) return { error: 'Prix invalide' }

  const supabase = await getSupabase()
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // Insert Activity
  const { data: newActivity, error } = await supabase
    .from('activities')
    .insert({
      property_id,
      title,
      description,
      activity_date,
      start_time,
      type,
      price,
      created_by: user.id,
      whatsapp_message_sent: sendWhatsapp
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  // Handle WhatsApp Integration (wa.me queue payload)
  let phonesToNotify: string[] = []
  let message = ''

  if (sendWhatsapp) {
    // Find active guests during this activity
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('guest_id, guests(first_name, whatsapp, phone)')
      .eq('property_id', property_id)
      .lte('check_in_date', activity_date)
      .gt('check_out_date', activity_date)
      .in('status', ['confirmed', 'checked_in'])

    if (!bookingsError && bookings && bookings.length > 0) {
      const phones: string[] = []
      
      ;(bookings as unknown as GuestPhoneRow[]).forEach((b) => {
        const guest = Array.isArray(b.guests) ? b.guests[0] : b.guests
        if (guest && (guest.whatsapp || guest.phone)) {
           phones.push((guest.whatsapp || guest.phone)!)
        }
      })

      // Ensure unique phone numbers
      const uniquePhones = Array.from(new Set(phones))

      if (uniquePhones.length > 0) {
        phonesToNotify = uniquePhones
        message = `🎉 Nouvelle activité: *${title}* !\n\n📅 Date: ${new Date(`${activity_date}T00:00:00`).toLocaleDateString('fr-FR')}\n🕒 Heure: ${start_time}\n${type === 'paid' && price ? `💰 Prix: ${price} MAD` : '🆓 Gratuit !'}\n\n${description ? description + '\n\n' : ''}Nous espérons vous y voir ! 👋`
      }
    }
  }

  return { success: true, data: newActivity, phonesToNotify, message }
}

export async function deleteActivityAction(id: string) {
  const gate = await getUserSession()
  if (!gate || isSessionBlocked(gate)) return { error: 'Abonnement inactif' }
  if (!canManageActivities(gate.role)) return { error: 'Accès refusé' }
  const supabase = await getSupabase()
  const { error } = await supabase.from('activities').delete().eq('id', id).eq('property_id', gate.propertyId)
  if (error) return { error: error.message }
  return { success: true }
}

export async function notifyGuestsAction(activityId: string) {
  const gate = await getUserSession()
  if (!gate || isSessionBlocked(gate)) return { error: 'Abonnement inactif' }
  if (!canManageActivities(gate.role)) return { error: 'Accès refusé' }

  const supabase = await getSupabase()

  // 1. Get activity details
  const { data: activity, error: activityError } = await supabase
    .from('activities')
    .select('id, property_id, title, description, activity_date, start_time, type, price, currency')
    .eq('id', activityId)
    .eq('property_id', gate.propertyId)
    .single()

  if (activityError || !activity) return { error: 'Activité non trouvée' }

  // 2. Find active guests during this activity
  const { data: bookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('guest_id, guests(first_name, whatsapp, phone)')
    .eq('property_id', activity.property_id)
    .lte('check_in_date', activity.activity_date)
    .gt('check_out_date', activity.activity_date)
    .in('status', ['confirmed', 'checked_in'])

  if (bookingsError) return { error: bookingsError.message }
  if (!bookings || bookings.length === 0) return { error: 'Aucun client trouvé pour ces dates.' }

  const phones: string[] = []
  ;(bookings as unknown as GuestPhoneRow[]).forEach((b) => {
    const guest = Array.isArray(b.guests) ? b.guests[0] : b.guests
    if (guest && (guest.whatsapp || guest.phone)) {
       phones.push((guest.whatsapp || guest.phone)!)
    }
  })

  const uniquePhones = Array.from(new Set(phones))
  if (uniquePhones.length === 0) return { error: 'Aucun numéro WhatsApp trouvé.' }

  const message = `🎉 Rappel Activité: *${activity.title}* !\n\n📅 Date: ${new Date(`${activity.activity_date}T00:00:00`).toLocaleDateString('fr-FR')}\n🕒 Heure: ${activity.start_time}\n${activity.type === 'paid' ? `💰 Prix: ${activity.price} ${activity.currency || 'MAD'}` : '🆓 Gratuit !'}\n\n${activity.description ? activity.description + '\n\n' : ''}Nous espérons vous y voir ! 👋`

  // Update activity status
  await supabase.from('activities').update({ whatsapp_message_sent: true }).eq('id', activityId)

  return { success: true, phonesToNotify: uniquePhones, message, data: activity }
}
