'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getUserSession } from '@/lib/supabase/server'

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

export async function sendWhatsAppBroadcast(phones: string[], messageText: string, propertyId: string) {
  const session = await getUserSession()
  if (!session) return { success: false, error: 'Non autorisé' }
  if (session.propertyId !== propertyId) return { success: false, error: 'Accès refusé' }

  const supabase = await getSupabase()

  // Check property configuration first for Meta Custom API Keys
  const { data: propertyResponse } = await supabase
    .from('properties')
    .select('whatsapp_phone_number_id, whatsapp_access_token')
    .eq('id', propertyId)
    .single()

  const token = propertyResponse?.whatsapp_access_token || process.env.WHATSAPP_API_TOKEN
  const phoneId = propertyResponse?.whatsapp_phone_number_id || process.env.WHATSAPP_PHONE_NUMBER_ID

  if (!token || !phoneId || token === 'your_token') {
    return { success: false, error: 'WhatsApp API is not configured for this property.' }
  }

  const results = []

  for (const phone of phones) {
    // Clean phone number (remove non-digits)
    const cleaned = phone.replace(/\D/g, '')

    try {
      const response = await fetch(`https://graph.facebook.com/v17.0/${phoneId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleaned,
          type: 'text',
          text: {
            preview_url: false,
            body: messageText
          }
        }),
      })

      const data = await response.json()
      results.push({ phone, success: response.ok, data })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`Error sending to ${phone}:`, err)
      results.push({ phone, success: false, error: msg })
    }
  }

  return { success: true, results }
}
