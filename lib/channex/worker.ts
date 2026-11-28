/**
 * Channel sync worker (server only, service-role Supabase client).
 *
 *  pushAri()        drains channel_ari_queue: claims slices (2-min lease),
 *                   groups them per property, reads availability / rates from
 *                   the DB, sends ONE availability and ONE restrictions call
 *                   per property (Channex: 10 calls/min/property), then marks
 *                   the slices done, or reschedules them with backoff.
 *  processRevision() stores + applies one booking revision, then acks it.
 *  pullBookings()   feed fallback for missed webhooks.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  availabilityValues, backoffMinutes, groupSlices, restrictionValues,
  type AvailabilityValue, type RateNight, type RestrictionValue, type Slice,
} from './ari'
import { isRetryable, type ChannexClient, type ChannexResult, type ChannexRevision } from './client'

const MAX_ATTEMPTS = 8

type QueueRow = Slice & { id: number; property_id: string; attempts: number }
type TypeRow = { id: string; channex_room_type_id: string | null; plans: { channex_rate_plan_id: string | null; is_default: boolean }[] }

export type PushSummary = { properties: number; slices: number; sent: number; failed: number; skipped: number }

async function log(db: SupabaseClient, propertyId: string | null, direction: 'out' | 'in', kind: string,
  r: Pick<ChannexResult, 'ok' | 'status' | 'warnings' | 'error'>, summary: string, detail?: unknown) {
  const ok = r.ok && r.warnings.length === 0
  await db.from('channel_sync_log').insert({
    property_id: propertyId, direction, kind, status_code: r.status, ok, summary,
    detail: detail ?? (r.warnings.length ? { warnings: r.warnings } : r.error ? { error: r.error } : null),
  })
}

async function alert(db: SupabaseClient, propertyId: string, message: string) {
  await db.from('channel_alerts').insert({ property_id: propertyId, kind: 'sync_error', message })
}

export async function pushAri(db: SupabaseClient, cx: ChannexClient): Promise<PushSummary> {
  const summary: PushSummary = { properties: 0, slices: 0, sent: 0, failed: 0, skipped: 0 }
  const { data: claimed, error } = await db.rpc('channel_claim_queue', { p_limit: 500 })
  if (error) throw new Error(`claim failed: ${error.message}`)
  const rows = (claimed ?? []) as QueueRow[]
  summary.slices = rows.length
  if (!rows.length) return summary

  const byProperty = new Map<string, QueueRow[]>()
  for (const r of rows) byProperty.set(r.property_id, [...(byProperty.get(r.property_id) ?? []), r])

  for (const [propertyId, slices] of byProperty) {
    summary.properties++
    const ids = slices.map((s) => s.id)
    const done = () => db.from('channel_ari_queue').update({ processed_at: new Date().toISOString(), last_error: null }).in('id', ids)

    const { data: conn } = await db.from('channel_connections')
      .select('channex_property_id, status').eq('property_id', propertyId).maybeSingle()
    if (conn?.status === 'paused') {
      // Held until the owner resumes: release the lease, check again later.
      await db.from('channel_ari_queue').update({ next_attempt_at: new Date(Date.now() + 5 * 60_000).toISOString() }).in('id', ids)
      summary.skipped += ids.length; continue
    }
    if (!conn || conn.status !== 'active' || !conn.channex_property_id) {
      await done(); summary.skipped += ids.length; continue
    }

    const { data: types } = await db.from('room_types')
      .select('id, channex_room_type_id, plans:rate_plans(channex_rate_plan_id, is_default)')
      .eq('property_id', propertyId)
    const typeById = new Map(((types ?? []) as TypeRow[]).map((t) => [t.id, t]))

    const avail: AvailabilityValue[] = []
    const restr: RestrictionValue[] = []
    for (const g of groupSlices(slices).values()) {
      const t = typeById.get(g.room_type_id)
      if (!t?.channex_room_type_id) continue             // not mapped: nothing to send
      for (const range of g.ranges) {
        if (g.kind === 'availability') {
          const { data, error: e } = await db.rpc('room_type_availability', {
            p_room_type_id: t.id, p_from: range.from, p_to: range.to,
          })
          if (e) throw new Error(`availability read failed: ${e.message}`)
          avail.push(...availabilityValues(conn.channex_property_id, t.channex_room_type_id,
            ((data ?? []) as { night: string; available: number }[])))
        } else {
          const planId = t.plans?.find((p) => p.is_default)?.channex_rate_plan_id
          if (!planId) continue
          const { data, error: e } = await db.rpc('channel_rate_nights', {
            p_room_type_id: t.id, p_from: range.from, p_to: range.to,
          })
          if (e) throw new Error(`rates read failed: ${e.message}`)
          restr.push(...restrictionValues(conn.channex_property_id, planId,
            ((data ?? []) as RateNight[]).map((n) => ({ ...n, rate: n.rate == null ? null : Number(n.rate) }))))
        }
      }
    }

    const calls: [string, ChannexResult][] = []
    if (avail.length) calls.push(['availability', await cx.postAvailability(avail)])
    if (restr.length) calls.push(['restrictions', await cx.postRestrictions(restr)])
    for (const [kind, r] of calls) {
      await log(db, propertyId, 'out', kind, r,
        `${kind}: ${kind === 'availability' ? avail.length : restr.length} value(s)`)
    }

    const failed = calls.find(([, r]) => !r.ok)
    if (!failed) {
      await done(); summary.sent += ids.length; continue
    }

    const [, r] = failed
    summary.failed += ids.length
    const attempts = Math.max(...slices.map((s) => s.attempts)) + 1
    if (!isRetryable(r) || attempts >= MAX_ATTEMPTS) {
      await db.from('channel_ari_queue').update({
        processed_at: new Date().toISOString(), attempts, last_error: r.error,
      }).in('id', ids)
      await alert(db, propertyId, `Synchronisation refusée par Channex (${r.status}) : ${r.error ?? 'erreur'}. Disponibilités à vérifier.`)
    } else {
      const waitMs = (r.retryAfterSec ?? backoffMinutes(attempts) * 60) * 1000
      await db.from('channel_ari_queue').update({
        attempts, last_error: r.error, next_attempt_at: new Date(Date.now() + waitMs).toISOString(),
      }).in('id', ids)
    }
  }
  return summary
}

export type RevisionOutcome = 'applied' | 'already_processed' | 'failed'

/**
 * Store (once) and apply a revision, then ack it. Guest contact details are
 * stripped by Channex after the ack, so the revision is stored first.
 */
export async function processRevision(db: SupabaseClient, cx: ChannexClient, rev: ChannexRevision): Promise<RevisionOutcome> {
  const { error: insErr } = await db.from('channel_booking_revisions').upsert(
    { revision_id: rev.id, channel_booking_id: rev.booking_id, ota_name: rev.ota_name ?? null, status: rev.status, payload: rev },
    { onConflict: 'revision_id', ignoreDuplicates: true },
  )
  if (insErr) throw new Error(`store revision failed: ${insErr.message}`)

  const { data, error } = await db.rpc('apply_channel_revision', { p_revision_id: rev.id })
  if (error) {
    const { data: row } = await db.from('channel_booking_revisions')
      .select('attempts, property_id').eq('revision_id', rev.id).single()
    const attempts = (row?.attempts ?? 0) + 1
    await db.from('channel_booking_revisions').update({ attempts, error: error.message }).eq('revision_id', rev.id)
    if (attempts === 3 && row?.property_id) {
      await alert(db, row.property_id, `Réservation en ligne non importée (${rev.ota_name ?? 'OTA'} ${rev.ota_reservation_code ?? ''}) : ${error.message}`)
    }
    return 'failed'
  }

  const ack = await cx.ack(rev.id)
  if (ack.ok) {
    await db.from('channel_booking_revisions').update({ acked_at: new Date().toISOString() }).eq('revision_id', rev.id)
  }
  const outcome = (data as { skipped?: string } | null)?.skipped ? 'already_processed' : 'applied'
  await log(db, (data as { property_id?: string } | null)?.property_id ?? null, 'in', 'booking_revision', ack,
    `${rev.status} ${rev.ota_name ?? ''} ${rev.ota_reservation_code ?? rev.booking_id}: ${outcome}${ack.ok ? '' : ' (ack failed)'}`)
  return outcome
}

/**
 * Fallback for missed webhooks and for revisions that failed earlier.
 *  1. Revisions already stored but not applied (failed RPC, crash before
 *     apply) are retried straight from the DB, up to MAX_REVISION_ATTEMPTS.
 *  2. The Channex feed (unacked revisions, ~10 per page) is read in a few
 *     passes; applied ones are acked and leave the feed, so each pass sees
 *     newer ones. Stops when a pass makes no progress, so revisions that keep
 *     failing cannot loop forever (they stay in step 1 with an alert).
 */
const MAX_REVISION_ATTEMPTS = 10
const MAX_FEED_PASSES = 5

export async function pullBookings(db: SupabaseClient, cx: ChannexClient) {
  const out = { fetched: 0, applied: 0, failed: 0, retried: 0, error: null as string | null }

  const { data: pending } = await db.from('channel_booking_revisions')
    .select('payload').is('processed_at', null).lt('attempts', MAX_REVISION_ATTEMPTS)
    .order('received_at').limit(20)
  for (const row of (pending ?? []) as { payload: ChannexRevision }[]) {
    out.retried++
    const r = await processRevision(db, cx, row.payload)
    if (r === 'failed') out.failed++
    else out.applied++
  }

  for (let pass = 0; pass < MAX_FEED_PASSES; pass++) {
    const feed = await cx.getFeed()
    if (!feed.ok || !feed.data) { out.error = feed.error; break }
    if (feed.data.length === 0) break
    out.fetched += feed.data.length
    let progress = 0
    for (const rev of feed.data) {
      const r = await processRevision(db, cx, rev)
      if (r === 'failed') out.failed++
      else { out.applied++; progress++ }
    }
    if (progress === 0) break
  }
  return out
}
