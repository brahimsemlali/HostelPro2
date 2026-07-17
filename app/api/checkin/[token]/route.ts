import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { logActivityServer } from '@/lib/activity'

// Service-role client bypasses RLS — used only after token validation
function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * GET — booking lookup for the public pre-check-in page.
 * The unguessable token IS the authorization: the holder may see this one
 * booking only. Runs with the service role so no public RLS policy is needed
 * on bookings/guests (see migration 019 which drops the insecure ones).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const ip = getClientIp(req)
  const rl = rateLimit({ key: `precheckin-view:${ip}`, limit: 30, windowSeconds: 300 })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Trop de requêtes.' }, { status: 429 })
  }

  const { token } = await params
  if (!token || token.length < 10) {
    return NextResponse.json({ error: 'Token invalide' }, { status: 400 })
  }

  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id, guest_id, pre_checkin_completed, check_in_date, check_out_date, status,
      property:property_id(name, wifi_password, check_in_time, check_out_time),
      bed:bed_id(name, room:room_id(name)),
      guest:guest_id(first_name, last_name, nationality, document_type, document_number, date_of_birth, gender, phone, country_of_residence, profession)
    `)
    .eq('pre_checkin_token', token)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ error: 'Réservation introuvable' }, { status: 404 })
  }
  if (data.status === 'cancelled' || data.status === 'no_show') {
    return NextResponse.json({ error: 'Réservation annulée' }, { status: 410 })
  }

  // Supabase returns single-record joins as arrays — normalise server-side
  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v)
  const rawBed = one(data.bed) as { name: string; room: { name: string } | { name: string }[] | null } | null

  return NextResponse.json({
    booking: {
      id: data.id,
      guest_id: data.guest_id,
      pre_checkin_completed: data.pre_checkin_completed,
      check_in_date: data.check_in_date,
      check_out_date: data.check_out_date,
      property: one(data.property),
      bed: rawBed ? { name: rawBed.name, room: one(rawBed.room) } : null,
    },
    guest: one(data.guest),
  })
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
    .select('id, guest_id, pre_checkin_completed, property_id, status')
    .eq('pre_checkin_token', token)
    .single()

  if (bookingError || !booking) {
    return NextResponse.json({ error: 'Réservation introuvable' }, { status: 404 })
  }

  // Mirror the GET guard: a cancelled/no-show booking must not accept a
  // pre-check-in submission (would rewrite guest PII + mark it complete).
  if (booking.status === 'cancelled' || booking.status === 'no_show') {
    return NextResponse.json({ error: 'Réservation annulée' }, { status: 410 })
  }

  if (booking.pre_checkin_completed) {
    return NextResponse.json({ error: 'Déjà complété' }, { status: 409 })
  }

  const {
    first_name, last_name, nationality, document_type, document_number,
    date_of_birth, gender, phone, country_of_residence, profession,
    address_in_morocco, next_destination,
  } = body as Record<string, string | null>

  // Public endpoint — every provided field must be a string of sane length
  // (rejects objects/arrays and multi-KB payloads being stored in the DB)
  const providedFields = [
    first_name, last_name, nationality, document_type, document_number,
    date_of_birth, gender, phone, country_of_residence, profession,
    address_in_morocco, next_destination,
  ]
  for (const value of providedFields) {
    if (value != null && (typeof value !== 'string' || value.length > 300)) {
      return NextResponse.json({ error: 'Champs invalides' }, { status: 400 })
    }
  }

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
  const validGenders = ['M', 'F']
  if (gender && !validGenders.includes(String(gender))) {
    return NextResponse.json({ error: 'Genre invalide (M ou F)' }, { status: 400 })
  }
  const validDocTypes = ['passport', 'cin', 'id_card']
  if (document_type && !validDocTypes.includes(String(document_type))) {
    return NextResponse.json({ error: 'Type de document invalide' }, { status: 400 })
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

    await logActivityServer(supabase, {
      propertyId: booking.property_id,
      userId: null,
      staffName: null,
      actionType: 'pre_checkin',
      entityType: 'booking',
      entityId: booking.id,
      description: `Pré check-in complété : ${guestData.first_name} ${guestData.last_name}`,
      meta: { guest_name: `${guestData.first_name} ${guestData.last_name}` },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
