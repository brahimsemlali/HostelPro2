/**
 * Connect a property to Channex, or bring an existing connection up to date
 * (server only, service-role client). Idempotent: run it again after adding
 * rooms or after a failure and it only creates what is missing.
 *
 *  1. Channex property (MAD, Africa/Casablanca). Availability is NOT
 *     auto-released by Channex on modification/cancellation: our worker
 *     pushes the exact count instead.
 *  2. One Channex room type per room type that has units. Dorms are sold
 *     per bed (room_kind 'dorm', count = beds); private rooms per room.
 *  3. One "Standard" rate plan per room type (prices come from ARI later).
 *  4. Connection 'active' + one full sync (at most once per 24 h, per
 *     Channex rules — never on a timer).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ChannexClient, ChannexResult } from './client'

type TypeRow = {
  id: string
  name: string
  kind: 'dorm' | 'private'
  sell_unit: 'bed' | 'room'
  max_occupancy: number
  channex_room_type_id: string | null
}

export type ConnectResult =
  | { ok: true; channexPropertyId: string; roomTypesCreated: number; roomTypesUpdated: number; ratePlansCreated: number; skipped: string[]; fullSync: boolean }
  | { ok: false; error: string }

const FULL_SYNC_MIN_HOURS = 24

function fail(r: ChannexResult, what: string): string {
  return `${what} : Channex a répondu ${r.status || 'sans réponse'}${r.error ? ` (${r.error})` : ''}`
}

/** Units per room type: beds for per-bed types, rooms for per-room types. */
async function unitsByType(db: SupabaseClient, propertyId: string) {
  const [{ data: rooms }, { data: beds }] = await Promise.all([
    db.from('rooms').select('id, room_type_id').eq('property_id', propertyId),
    db.from('beds').select('room_id').eq('property_id', propertyId),
  ])
  const bedsPerRoom = new Map<string, number>()
  for (const b of beds ?? []) bedsPerRoom.set(b.room_id, (bedsPerRoom.get(b.room_id) ?? 0) + 1)
  const out = new Map<string, { rooms: number; beds: number; maxBedsPerRoom: number }>()
  for (const r of rooms ?? []) {
    if (!r.room_type_id) continue
    const n = bedsPerRoom.get(r.id) ?? 0
    const cur = out.get(r.room_type_id) ?? { rooms: 0, beds: 0, maxBedsPerRoom: 0 }
    cur.rooms += n > 0 ? 1 : 0
    cur.beds += n
    cur.maxBedsPerRoom = Math.max(cur.maxBedsPerRoom, n)
    out.set(r.room_type_id, cur)
  }
  return out
}

export async function connectProperty(db: SupabaseClient, cx: ChannexClient, propertyId: string): Promise<ConnectResult> {
  const setError = async (msg: string) => {
    await db.from('channel_connections').update({ status: 'error', last_error: msg, updated_at: new Date().toISOString() })
      .eq('property_id', propertyId)
    return { ok: false as const, error: msg }
  }

  const { data: property } = await db.from('properties')
    .select('id, name, city, address, phone, email').eq('id', propertyId).single()
  if (!property) return { ok: false, error: 'Établissement introuvable.' }

  const { data: types } = await db.from('room_types')
    .select('id, name, kind, sell_unit, max_occupancy, channex_room_type_id').eq('property_id', propertyId).order('name')
  const roomTypes = (types ?? []) as TypeRow[]
  const units = await unitsByType(db, propertyId)
  if (!roomTypes.some((t) => (units.get(t.id)?.beds ?? 0) > 0)) {
    return { ok: false, error: 'Ajoutez au moins une chambre avec des lits avant de connecter.' }
  }

  // 1. Property
  const { data: existing } = await db.from('channel_connections')
    .select('channex_property_id, last_full_sync_at').eq('property_id', propertyId).maybeSingle()
  let channexPropertyId = existing?.channex_property_id ?? null
  if (!channexPropertyId) {
    const r = await cx.createProperty({
      title: property.name,
      currency: 'MAD',
      country: 'MA',
      city: property.city ?? undefined,
      address: property.address ?? undefined,
      phone: property.phone ?? undefined,
      email: property.email ?? undefined,
      timezone: 'Africa/Casablanca',
      property_type: roomTypes.some((t) => t.kind === 'dorm') ? 'hostel' : 'guest_house',
      settings: {
        allow_availability_autoupdate_on_modification: false,
        allow_availability_autoupdate_on_cancellation: false,
        min_stay_type: 'both',
        state_length: 500,
      },
    })
    if (!r.ok || !r.data?.id) {
      await db.from('channel_connections').upsert({ property_id: propertyId, status: 'error', last_error: fail(r, 'Création de l’établissement') })
      return { ok: false, error: fail(r, 'Création de l’établissement') }
    }
    channexPropertyId = r.data.id
    const { error } = await db.from('channel_connections').upsert({
      property_id: propertyId, channex_property_id: channexPropertyId, status: 'pending', last_error: null,
    })
    if (error) return { ok: false, error: `Enregistrement de la connexion : ${error.message}` }
  }

  // 2. Room types
  let roomTypesCreated = 0
  let roomTypesUpdated = 0
  const skipped: string[] = []
  for (const t of roomTypes) {
    const u = units.get(t.id)
    const count = t.sell_unit === 'bed' ? (u?.beds ?? 0) : (u?.rooms ?? 0)
    if (count <= 0) { skipped.push(t.name); continue }
    const occ = t.sell_unit === 'bed' ? 1 : Math.max(1, t.max_occupancy)
    const body = {
      property_id: channexPropertyId,
      title: t.name,
      count_of_rooms: count,
      occ_adults: occ,
      occ_children: 0,
      occ_infants: 0,
      default_occupancy: occ,
      room_kind: t.kind === 'dorm' ? ('dorm' as const) : ('room' as const),
      ...(t.kind === 'dorm' ? { capacity: Math.max(1, u?.maxBedsPerRoom ?? 1) } : {}),
    }
    if (t.channex_room_type_id) {
      const r = await cx.updateRoomType(t.channex_room_type_id, body)
      if (!r.ok) return setError(fail(r, `Mise à jour du type « ${t.name} »`))
      roomTypesUpdated++
    } else {
      const r = await cx.createRoomType(body)
      if (!r.ok || !r.data?.id) return setError(fail(r, `Création du type « ${t.name} »`))
      await db.from('room_types').update({ channex_room_type_id: r.data.id }).eq('id', t.id)
      t.channex_room_type_id = r.data.id
      roomTypesCreated++
    }
  }

  // 3. Rate plans (the default "Standard" plan of each mapped type)
  let ratePlansCreated = 0
  const mapped = roomTypes.filter((t) => t.channex_room_type_id)
  if (mapped.length) {
    const { data: plans } = await db.from('rate_plans')
      .select('id, room_type_id, name, channex_rate_plan_id').eq('property_id', propertyId).eq('is_default', true)
      .in('room_type_id', mapped.map((t) => t.id))
    for (const p of plans ?? []) {
      if (p.channex_rate_plan_id) continue
      const t = mapped.find((x) => x.id === p.room_type_id)!
      const occ = t.sell_unit === 'bed' ? 1 : Math.max(1, t.max_occupancy)
      const r = await cx.createRatePlan({
        property_id: channexPropertyId,
        room_type_id: t.channex_room_type_id!,
        // Channex wants unique titles per property.
        title: `${t.name} — ${p.name}`,
        currency: 'MAD',
        sell_mode: 'per_room',
        rate_mode: 'manual',
        options: [{ occupancy: occ, is_primary: true, rate: 0 }],
      })
      if (!r.ok || !r.data?.id) return setError(fail(r, `Création du tarif « ${t.name} »`))
      await db.from('rate_plans').update({ channex_rate_plan_id: r.data.id }).eq('id', p.id)
      ratePlansCreated++
    }
  }

  // 4. Active + full sync
  await db.from('channel_connections').update({ status: 'active', last_error: null, updated_at: new Date().toISOString() })
    .eq('property_id', propertyId)
  const last = existing?.last_full_sync_at ? new Date(existing.last_full_sync_at).getTime() : 0
  const fullSync = Date.now() - last >= FULL_SYNC_MIN_HOURS * 3600_000
  if (fullSync) {
    const { error } = await db.rpc('channel_enqueue_full', { p_property_id: propertyId })
    if (error) return setError(`Première synchronisation : ${error.message}`)
  }

  return { ok: true, channexPropertyId, roomTypesCreated, roomTypesUpdated, ratePlansCreated, skipped, fullSync }
}
