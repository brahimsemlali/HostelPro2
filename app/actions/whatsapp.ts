'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getUserSession } from '@/lib/supabase/server'

// Guardrails: this action sends through the property's Meta WhatsApp token —
// abuse (arbitrary numbers, huge lists) risks a permanent token ban.
const MAX_RECIPIENTS = 100
const MAX_MESSAGE_LENGTH = 4096 // WhatsApp text message limit
const SEND_CHUNK_SIZE = 5
const ALLOWED_ROLES = ['owner', 'manager', 'receptionist'] // send_whatsapp permission

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
  if (!ALLOWED_ROLES.includes(session.role)) return { success: false, error: 'Accès refusé' }

  if (!Array.isArray(phones) || phones.length === 0) {
    return { success: false, error: 'Aucun destinataire' }
  }
  if (phones.length > MAX_RECIPIENTS) {
    return { success: false, error: `Maximum ${MAX_RECIPIENTS} destinataires par envoi` }
  }
  if (typeof messageText !== 'string' || !messageText.trim() || messageText.length > MAX_MESSAGE_LENGTH) {
    return { success: false, error: 'Message invalide' }
  }

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

  // Only allow numbers that belong to the property's guests — never
  // arbitrary caller-supplied numbers (open-relay abuse gets the Meta
  // token banned).
  const { data: guestRows } = await supabase
    .from('guests')
    .select('phone, whatsapp')
    .eq('property_id', propertyId)
    .limit(5000)

  const knownNumbers = new Set<string>()
  for (const g of guestRows ?? []) {
    if (g.phone) knownNumbers.add(g.phone.replace(/\D/g, ''))
    if (g.whatsapp) knownNumbers.add(g.whatsapp.replace(/\D/g, ''))
  }

  const cleanedPhones = Array.from(new Set(phones.map((p) => p.replace(/\D/g, ''))))
  const allowedPhones = cleanedPhones.filter((p) => p.length > 0 && knownNumbers.has(p))

  if (allowedPhones.length === 0) {
    return { success: false, error: 'Aucun destinataire valide (numéros inconnus)' }
  }

  const waApiVersion = process.env.WHATSAPP_API_VERSION ?? 'v20.0'

  async function sendOne(cleaned: string) {
    try {
      const response = await fetch(`https://graph.facebook.com/${waApiVersion}/${phoneId}/messages`, {
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
      return { phone: cleaned, success: response.ok, data }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { phone: cleaned, success: false, error: msg }
    }
  }

  // Chunked parallel sends: sequential awaits over a long list exceed the
  // serverless duration limit and lose all results mid-loop.
  const results = []
  for (let i = 0; i < allowedPhones.length; i += SEND_CHUNK_SIZE) {
    const chunk = allowedPhones.slice(i, i + SEND_CHUNK_SIZE)
    results.push(...(await Promise.all(chunk.map(sendOne))))
  }

  const skipped = cleanedPhones.length - allowedPhones.length
  return { success: true, results, skipped }
}
