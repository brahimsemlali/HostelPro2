import { NextResponse } from 'next/server'
import { createAdminClient, getRouteHandlerSession } from '@/lib/supabase/server'
import { logActivityServer } from '@/lib/activity'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function authorize(guestId: string) {
  if (!UUID_RE.test(guestId)) {
    return { error: NextResponse.json({ error: 'ID invalide' }, { status: 400 }) }
  }
  const session = await getRouteHandlerSession()
  if (!session) {
    return { error: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) }
  }
  // GDPR operations are owner-only — they expose or destroy personal data
  if (!session.isOwner) {
    return { error: NextResponse.json({ error: 'Réservé au propriétaire' }, { status: 403 }) }
  }
  const admin = createAdminClient()
  const { data: guest } = await admin
    .from('guests')
    .select('id, property_id, first_name, last_name')
    .eq('id', guestId)
    .eq('property_id', session.propertyId)
    .maybeSingle()
  if (!guest) {
    return { error: NextResponse.json({ error: 'Client introuvable' }, { status: 404 }) }
  }
  return { session, admin, guest }
}

/**
 * GET — export every piece of data held about a guest (GDPR / Loi 09-08
 * data-portability). Returns a downloadable JSON file.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await authorize(id)
  if ('error' in auth) return auth.error
  const { admin, session } = auth

  const [{ data: guest }, { data: bookings }, { data: payments }, { data: messages }] = await Promise.all([
    admin
      .from('guests')
      .select('id, first_name, last_name, email, phone, whatsapp, nationality, document_type, document_number, date_of_birth, gender, country_of_residence, profession, address_in_morocco, next_destination, total_stays, total_spent, notes, is_flagged, flag_reason, created_at')
      .eq('id', id)
      .single(),
    admin
      .from('bookings')
      .select('id, source, status, check_in_date, check_out_date, nights, adults, total_price, special_requests, created_at')
      .eq('guest_id', id)
      .eq('property_id', session.propertyId)
      .order('check_in_date', { ascending: false }),
    admin
      .from('payments')
      .select('id, booking_id, amount, method, type, status, reference, payment_date')
      .eq('guest_id', id)
      .eq('property_id', session.propertyId)
      .order('payment_date', { ascending: false }),
    admin
      .from('whatsapp_messages')
      .select('id, template_key, phone, message, status, sent_at')
      .eq('guest_id', id)
      .eq('property_id', session.propertyId)
      .order('sent_at', { ascending: false }),
  ])

  const payload = {
    exported_at: new Date().toISOString(),
    format: 'sweet-reservation-guest-export-v1',
    guest,
    bookings: bookings ?? [],
    payments: payments ?? [],
    whatsapp_messages: messages ?? [],
  }

  const filename = `export-${(guest?.last_name ?? 'client').toLowerCase().replace(/[^a-z0-9]/g, '')}-${new Date().toISOString().slice(0, 10)}.json`
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

/**
 * POST — anonymize a guest (GDPR / Loi 09-08 right to erasure).
 * Strips all personally identifying fields but keeps the financial records
 * (bookings/payments) intact for accounting. Deletes WhatsApp message logs,
 * which contain the guest's phone number and message content.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await authorize(id)
  if ('error' in auth) return auth.error
  const { admin, session, guest } = auth

  const { error: updateError } = await admin
    .from('guests')
    .update({
      first_name: 'Client',
      last_name: 'Anonymisé',
      email: null,
      phone: null,
      whatsapp: null,
      document_number: null,
      date_of_birth: null,
      country_of_residence: null,
      profession: null,
      address_in_morocco: null,
      next_destination: null,
      notes: null,
      is_flagged: false,
      flag_reason: null,
    })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: 'Erreur lors de l\'anonymisation' }, { status: 500 })
  }

  // WhatsApp logs contain the phone number and personal message content
  await admin.from('whatsapp_messages').delete().eq('guest_id', id).eq('property_id', session.propertyId)

  await logActivityServer(admin, {
    propertyId: session.propertyId,
    userId: session.userId,
    staffName: session.staffName,
    actionType: 'guest_anonymized',
    description: `Client anonymisé (RGPD) : ${guest.first_name} ${guest.last_name}`,
  })

  return NextResponse.json({ ok: true })
}
