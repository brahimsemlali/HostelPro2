/**
 * End-to-end worker test against the LOCAL Supabase stack with a simulated
 * Channex. Skipped unless LOCAL_SB_SERVICE is set:
 *
 *   scripts/local-test/setup.sh
 *   LOCAL_SB_SERVICE=$(cd scripts/local-test/.stack && supabase status -o env | sed -n 's/^SERVICE_ROLE_KEY=//p' | tr -d '"') \
 *     npx vitest run tests/channex-worker.local.test.ts
 *
 * Never point this at production: it writes and deletes rows.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { ChannexClient, type ChannexRevision } from '@/lib/channex/client'
import { processRevision, pullBookings, pushAri } from '@/lib/channex/worker'

const KEY = process.env.LOCAL_SB_SERVICE
const URL_ = 'http://127.0.0.1:55421'

type Call = { url: string; body: unknown }

function fakeChannex(handler: (url: string, body: unknown) => { status: number; json: unknown }) {
  const calls: Call[] = []
  const cx = new ChannexClient({
    apiKey: 'test', baseUrl: 'https://channex.test/api/v1',
    fetchImpl: async (url, init) => {
      const body = init?.body ? JSON.parse(String(init.body)) : null
      calls.push({ url, body })
      const r = handler(url, body)
      return new Response(JSON.stringify(r.json), { status: r.status })
    },
  })
  return { cx, calls }
}

const ok = { status: 200, json: { data: [{ id: 't', type: 'task' }], meta: { message: 'Success', warnings: [] } } }

describe.skipIf(!KEY)('channel worker (local stack)', () => {
  let db: SupabaseClient
  let prop: string
  let dorm: string
  const today = new Date().toISOString().slice(0, 10)

  beforeAll(async () => {
    db = createClient(URL_, KEY!, { auth: { persistSession: false } })
    const { data: p } = await db.from('properties').select('id').eq('name', 'Auberge Atlas').single()
    prop = p!.id
    const { data: t } = await db.from('room_types').select('id').eq('property_id', prop).eq('name', 'Dortoir A').single()
    dorm = t!.id
    await db.from('room_types').update({ channex_room_type_id: 'CX-DORM', default_rate: 130 }).eq('id', dorm)
    await db.from('rate_plans').update({ channex_rate_plan_id: 'CX-PLAN' }).eq('room_type_id', dorm).eq('is_default', true)
    await db.from('channel_connections').upsert({ property_id: prop, channex_property_id: 'CX-PROP', status: 'active' })
    await db.from('channel_ari_queue').delete().gte('id', 0)
  })

  afterAll(async () => {
    if (!db) return
    await db.from('bookings').delete().like('channel_booking_id', 'WK-%')
    await db.from('channel_booking_revisions').delete().like('revision_id', 'WK-%')
    await db.from('channel_alerts').delete().eq('property_id', prop)
    await db.from('channel_sync_log').delete().eq('property_id', prop)
    await db.from('channel_ari_queue').delete().gte('id', 0)
    await db.from('channel_connections').delete().eq('property_id', prop)
    await db.from('room_types').update({ channex_room_type_id: null, default_rate: null }).eq('id', dorm)
  })

  it('full sync sends one availability and one restrictions call, collapsed into ranges', async () => {
    const { data: n } = await db.rpc('channel_enqueue_full', { p_property_id: prop })
    expect(n).toBe(1)                                   // only the mapped type
    const { cx, calls } = fakeChannex(() => ok)
    const s = await pushAri(db, cx)
    expect(s.sent).toBeGreaterThan(0)
    expect(calls.map((c) => c.url.split('/').pop())).toEqual(['availability', 'restrictions'])
    const avail = (calls[0].body as { values: { availability: number; date_from: string }[] }).values
    expect(avail.length).toBeLessThan(20)               // 500 nights collapsed, not one per night
    expect(avail[0].date_from).toBe(today)
    const restr = (calls[1].body as { values: { rate: string }[] }).values
    expect(restr.every((v) => v.rate === '130.00')).toBe(true)
    const { count } = await db.from('channel_ari_queue').select('id', { count: 'exact', head: true }).is('processed_at', null)
    expect(count).toBe(0)
  })

  it('a webhook-style revision is stored, applied, acked, and queues availability', async () => {
    const d0 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10)
    const d1 = new Date(Date.now() + 32 * 864e5).toISOString().slice(0, 10)
    const rev: ChannexRevision = {
      id: 'WK-REV-1', property_id: 'CX-PROP', booking_id: 'WK-BK-1', ota_name: 'Hostelworld',
      ota_reservation_code: 'HW-9', status: 'new',
      customer: { name: 'Sam', surname: 'Lee', country: 'GB' },
      rooms: [{ room_type_id: 'CX-DORM', rate_plan_id: 'CX-PLAN', checkin_date: d0, checkout_date: d1, amount: '260.00', occupancy: { adults: 1, children: 0 } }],
    }
    const { cx, calls } = fakeChannex(() => ({ status: 200, json: { meta: { message: 'Success' } } }))
    expect(await processRevision(db, cx, rev)).toBe('applied')
    expect(calls.at(-1)?.url).toContain('/booking_revisions/WK-REV-1/ack')
    const { data: rows } = await db.from('bookings').select('source, bed_id, total_price').eq('channel_booking_id', 'WK-BK-1')
    expect(rows).toEqual([{ source: 'hostelworld', bed_id: null, total_price: 260 }])
    const { data: stored } = await db.from('channel_booking_revisions').select('acked_at, processed_at').eq('revision_id', 'WK-REV-1').single()
    expect(stored?.acked_at && stored?.processed_at).toBeTruthy()
    const { count } = await db.from('channel_ari_queue').select('id', { count: 'exact', head: true }).is('processed_at', null)
    expect(count).toBeGreaterThan(0)                    // the import queued an availability update

    // Same revision delivered again (webhook retry + feed): no duplicate rows.
    expect(await processRevision(db, cx, rev)).toBe('already_processed')
    const { count: n2 } = await db.from('bookings').select('id', { count: 'exact', head: true }).eq('channel_booking_id', 'WK-BK-1')
    expect(n2).toBe(1)
  })

  it('429 reschedules the slices; a 422 gives up with an alert', async () => {
    const { cx: limited } = fakeChannex(() => ({ status: 429, json: { errors: { code: 'http_too_many_requests' }, details: { retry_after: 30 } } }))
    const s1 = await pushAri(db, limited)
    expect(s1.failed).toBeGreaterThan(0)
    const { data: q } = await db.from('channel_ari_queue').select('attempts, next_attempt_at').is('processed_at', null)
    expect(q!.length).toBeGreaterThan(0)
    expect(q!.every((r) => r.attempts === 1 && new Date(r.next_attempt_at) > new Date())).toBe(true)

    await db.from('channel_ari_queue').update({ next_attempt_at: new Date().toISOString() }).is('processed_at', null)
    const { cx: rejecting } = fakeChannex(() => ({ status: 422, json: { errors: { code: 'validation_error' } } }))
    await pushAri(db, rejecting)
    const { count } = await db.from('channel_ari_queue').select('id', { count: 'exact', head: true }).is('processed_at', null)
    expect(count).toBe(0)
    const { data: alerts } = await db.from('channel_alerts').select('kind').eq('property_id', prop).eq('kind', 'sync_error')
    expect(alerts!.length).toBe(1)
  })

  it('feed pull applies missed revisions', async () => {
    const d0 = new Date(Date.now() + 40 * 864e5).toISOString().slice(0, 10)
    const d1 = new Date(Date.now() + 41 * 864e5).toISOString().slice(0, 10)
    let acked = false
    const { cx } = fakeChannex((url) => {
      if (url.endsWith('/ack')) { acked = true; return { status: 200, json: { meta: { message: 'Success' } } } }
      return url.includes('/feed') && !acked
      ? { status: 200, json: { meta: { total: 1 }, data: [{ id: 'WK-REV-2', type: 'booking_revision', attributes: {
          id: 'WK-REV-2', property_id: 'CX-PROP', booking_id: 'WK-BK-2', ota_name: 'Booking.com', status: 'new',
          rooms: [{ room_type_id: 'CX-DORM', rate_plan_id: 'CX-PLAN', checkin_date: d0, checkout_date: d1, amount: '120.00', occupancy: { adults: 1 } }],
        } }] } }
      : { status: 200, json: { meta: { message: 'Success' }, data: [] } }
    })
    const r = await pullBookings(db, cx)
    expect(r).toMatchObject({ fetched: 1, applied: 1, failed: 0 })
  })

  it('a revision that failed (property not linked yet) is retried from the DB once fixed', async () => {
    const d0 = new Date(Date.now() + 50 * 864e5).toISOString().slice(0, 10)
    const d1 = new Date(Date.now() + 51 * 864e5).toISOString().slice(0, 10)
    const rev: ChannexRevision = {
      id: 'WK-REV-3', property_id: 'CX-LATE', booking_id: 'WK-BK-3', ota_name: 'Airbnb', status: 'new',
      rooms: [{ room_type_id: 'CX-DORM', checkin_date: d0, checkout_date: d1, amount: '100.00', occupancy: { adults: 1 } }],
    }
    const { cx, calls } = fakeChannex((url) => url.includes('/feed')
      ? { status: 200, json: { data: [] } }
      : { status: 200, json: { meta: { message: 'Success' } } })
    expect(await processRevision(db, cx, rev)).toBe('failed')
    expect(calls.some((c) => c.url.endsWith('/ack'))).toBe(false)      // never acked while failing

    await db.from('channel_connections').update({ channex_property_id: 'CX-LATE' }).eq('property_id', prop)
    const r = await pullBookings(db, cx)
    expect(r).toMatchObject({ retried: 1, applied: 1 })
    const { count } = await db.from('bookings').select('id', { count: 'exact', head: true }).eq('channel_booking_id', 'WK-BK-3')
    expect(count).toBe(1)
    await db.from('channel_connections').update({ channex_property_id: 'CX-PROP' }).eq('property_id', prop)
  })
})
