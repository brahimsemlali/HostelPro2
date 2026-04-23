import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

// Service-role client bypasses RLS — used only after token validation
function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const ip = getClientIp(req)
  const rl = rateLimit({ key: `precheckin:${ip}`, limit: 10, windowSeconds: 300 })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Trop de requêtes.' }, { status: 429 })
  }

  const { token } = await params

  if (!token || token.length < 10) {
    return NextResponse.json({ error: 'Token invalide' }, { status: 400 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
  }

  const supabase = getServiceClient()

  // Validate the token — fetch the booking
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, guest_id, pre_checkin_completed, property_id')
    .eq('pre_checkin_token', token)
    .single()

  if (bookingError || !booking) {
    return NextResponse.json({ error: 'Réservation introuvable' }, { status: 404 })
  }

  if (booking.pre_checkin_completed) {
    return NextResponse.json({ error: 'Déjà complété' }, { status: 409 })
  }

  const {
    first_name, last_name, nationality, document_type, document_number,
    date_of_birth, gender, phone, country_of_residence, profession,
    address_in_morocco, next_destination,
  } = body as Record<string, string | null>

  // Validate required fields (police form requires these)
  if (!first_name || !last_name) {
    return NextResponse.json({ error: 'Prénom et nom obligatoires' }, { status: 400 })
  }
  if (!nationality || !document_number || !date_of_birth) {
    return NextResponse.json({ error: 'Nationalité, numéro de document et date de naissance sont obligatoires' }, { status: 400 })
  }
  if (date_of_birth && !/^\d{4}-\d{2}-\d{2}$/.test(date_of_birth)) {
    return NextResponse.json({ error: 'Format de date invalide (attendu : YYYY-MM-DD)' }, { status: 400 })
  }

  const guestData = {
    first_name: String(first_name).trim(),
    last_name: String(last_name).trim(),
    nationality: nationality ? String(nationality).trim() : null,
    document_type: document_type ?? 'passport',
    document_number: document_number ? String(document_number).trim() : null,
    date_of_birth: date_of_birth || null,
    gender: gender || null,
    phone: phone ? String(phone).trim() : null,
    country_of_residence: country_of_residence ? String(country_of_residence).trim() : null,
    profession: profession ? String(profession).trim() : null,
    address_in_morocco: address_in_morocco ? String(address_in_morocco).trim() : null,
    next_destination: next_destination ? String(next_destination).trim() : null,
  }

  try {
    if (booking.guest_id) {
      const { error: guestError } = await supabase
        .from('guests')
        .update(guestData)
        .eq('id', booking.guest_id)

      if (guestError) throw guestError
    } else {
      // No guest yet — create one and link to booking
      const { data: newGuest, error: createError } = await supabase
        .from('guests')
        .insert({ ...guestData, property_id: booking.property_id })
        .select('id')
        .single()

      if (createError || !newGuest) throw createError ?? new Error('Guest creation failed')

      const { error: linkError } = await supabase
        .from('bookings')
        .update({ guest_id: newGuest.id })
        .eq('id', booking.id)

      if (linkError) throw linkError
    }

    // Mark pre-checkin complete
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ pre_checkin_completed: true })
      .eq('id', booking.id)

    if (updateError) throw updateError

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[pre-checkin API]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
