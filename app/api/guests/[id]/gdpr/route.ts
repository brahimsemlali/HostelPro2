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

type ActivityRow = { id: string; action_type: string; description: string; meta: unknown; created_at: string }

/** Activity-log entries about this guest: their bookings, the guest record, or naming them. */
async function guestActivityLog(
  admin: ReturnType<typeof createAdminClient>,
  propertyId: string,
  guestId: string,
  guest: { first_name: string; last_name: string },
): Promise<ActivityRow[]> {
  const { data: bks } = await admin.from('bookings').select('id').eq('guest_id', guestId).eq('property_id', propertyId).limit(1000)
  const entityIds = [guestId, ...(bks ?? []).map((b) => b.id)]
  const cols = 'id, action_type, description, meta, created_at'
  const byEntity = await admin.from('activity_log').select(cols).eq('property_id', propertyId).in('entity_id', entityIds).limit(2000)
  const fullName = `${guest.first_name} ${guest.last_name}`.trim()
  const byName = fullName.length > 3
    ? await admin.from('activity_log').select(cols).eq('property_id', propertyId).ilike('description', `%${fullName.replace(/[%_\\]/g, '')}%`).limit(2000)
    : { data: [] as ActivityRow[] }
  const rows = new Map<string, ActivityRow>()
  for (const r of [...(byEntity.data ?? []), ...(byName.data ?? [])] as ActivityRow[]) rows.set(r.id, r)
  return Array.from(rows.values())
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

  const [{ data: guest }, { data: bookings }, { data: payments }, { data: messages }, activity] = await Promise.all([
    admin
      .from('guests')
      .select('id, first_name, last_name, email, phone, whatsapp, nationality, document_type, document_number, date_of_birth, gender, country_of_residence, profession, address_in_morocco, next_destination, total_stays, total_spent, notes, is_flagged, flag_reason, created_at')
      .eq('id', id)
      .single(),
    admin
      .from('bookings')
      .select('id, source, status, check_in_date, check_out_date, nights, adults, total_price, special_requests, internal_notes, arrival_notes, expected_arrival_time, created_at')
      .eq('guest_id', id)
      .eq('property_id', session.propertyId)
      .order('check_in_date', { ascending: false }),
    admin
      .from('payments')
      .select('id, booking_id, amount, method, type, status, reference, notes, payment_date')
      .eq('guest_id', id)
      .eq('property_id', session.propertyId)
      .order('payment_date', { ascending: false }),
    admin
      .from('whatsapp_messages')
      .select('id, template_key, phone, message, status, sent_at')
      .eq('guest_id', id)
      .eq('property_id', session.propertyId)
      .order('sent_at', { ascending: false }),
    guestActivityLog(admin, session.propertyId, id, auth.guest),
  ])

  const payload = {
    exported_at: new Date().toISOString(),
    format: 'sweet-reservation-guest-export-v1',
    guest,
    bookings: bookings ?? [],
    payments: payments ?? [],
    whatsapp_messages: messages ?? [],
    activity_log: activity.map(({ id: logId, action_type, description, created_at }) => ({ id: logId, action_type, description, created_at })),
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

  // Collect the activity entries that name this guest *before* the name is erased.
  const activity = await guestActivityLog(admin, session.propertyId, id, guest)

  const { error: updateError } = await admin
    .from('guests')
    .update({
      first_name: 'Client',
      last_name: 'Anonymisé',
      email: null,
      phone: null,
      whatsapp: null,
      nationality: null,
      gender: null,
      document_type: null,
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

  // Free-text fields on the stays and payments can hold personal data; the
  // pre-check-in link would keep exposing the (now empty) record.
  await admin
    .from('bookings')
    .update({ special_requests: null, internal_notes: null, arrival_notes: null, pre_checkin_token: null })
    .eq('guest_id', id)
    .eq('property_id', session.propertyId)
  await admin.from('payments').update({ notes: null }).eq('guest_id', id).eq('property_id', session.propertyId)

  // Activity-log descriptions embed the guest's name ("Check-in : Lena Hoffmann").
  const fullName = `${guest.first_name} ${guest.last_name}`.trim()
  for (const entry of activity) {
    const description = fullName ? entry.description.split(fullName).join('Client anonymisé') : entry.description
    const meta = entry.meta && typeof entry.meta === 'object' ? { ...(entry.meta as Record<string, unknown>) } : null
    if (meta) delete meta.guest_name
    await admin.from('activity_log').update({ description, meta }).eq('id', entry.id)
  }

  // The erasure log must not re-record the erased name.
  await logActivityServer(admin, {
    propertyId: session.propertyId,
    userId: session.userId,
    staffName: session.staffName,
    actionType: 'guest_anonymized',
    entityType: 'guest',
    entityId: id,
    description: 'Client anonymisé (RGPD)',
  })

  return NextResponse.json({ ok: true })
}
