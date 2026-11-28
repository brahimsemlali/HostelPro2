/**
 * connectProperty() end to end against the LOCAL Supabase stack with a
 * simulated Channex. Skipped unless LOCAL_SB_SERVICE is set (see
 * tests/channex-worker.local.test.ts for the command). Never run on prod.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { ChannexClient } from '@/lib/channex/client'
import { connectProperty } from '@/lib/channex/connect'

const KEY = process.env.LOCAL_SB_SERVICE

type Call = { method: string; path: string; body: Record<string, Record<string, unknown>> | null }

function fakeChannex(opts: { failRatePlans?: boolean } = {}) {
  const calls: Call[] = []
  let n = 0
  const cx = new ChannexClient({
    apiKey: 'test', baseUrl: 'https://staging.channex.test/api/v1',
    fetchImpl: async (url, init) => {
      const path = url.replace('https://staging.channex.test/api/v1', '')
      const body = init?.body ? JSON.parse(String(init.body)) : null
      calls.push({ method: init?.method ?? 'GET', path, body })
      if (opts.failRatePlans && path === '/rate_plans') {
        return new Response(JSON.stringify({ errors: { code: 'validation_error' } }), { status: 422 })
      }
      return new Response(JSON.stringify({ data: { id: `CX-${++n}`, type: 'x', attributes: {} } }), { status: 201 })
    },
  })
  return { cx, calls }
}

describe.skipIf(!KEY)('connectProperty (local stack)', () => {
  let db: SupabaseClient
  let prop: string

  beforeAll(async () => {
    db = createClient('http://127.0.0.1:55421', KEY!, { auth: { persistSession: false } })
    const { data: p } = await db.from('properties').select('id').eq('name', 'Auberge Atlas').single()
    prop = p!.id
    await db.from('channel_connections').delete().eq('property_id', prop)
    await db.from('room_types').update({ channex_room_type_id: null }).eq('property_id', prop)
    await db.from('rate_plans').update({ channex_rate_plan_id: null }).eq('property_id', prop)
    await db.from('channel_ari_queue').delete().gte('id', 0)
  })

  afterAll(async () => {
    if (!db) return
    await db.from('channel_ari_queue').delete().gte('id', 0)
    await db.from('channel_connections').delete().eq('property_id', prop)
    await db.from('room_types').update({ channex_room_type_id: null }).eq('property_id', prop)
    await db.from('rate_plans').update({ channex_rate_plan_id: null }).eq('property_id', prop)
  })

  it('a failure part-way leaves an error status and a retry finishes the job', async () => {
    const bad = fakeChannex({ failRatePlans: true })
    const r1 = await connectProperty(db, bad.cx, prop)
    expect(r1.ok).toBe(false)
    const { data: c1 } = await db.from('channel_connections').select('status, last_error, channex_property_id').eq('property_id', prop).single()
    expect(c1).toMatchObject({ status: 'error', channex_property_id: 'CX-1' })
    expect(c1!.last_error).toContain('tarif')

    const good = fakeChannex()
    const r2 = await connectProperty(db, good.cx, prop)
    expect(r2.ok).toBe(true)
    // property and room types already exist: no second property, types updated not recreated
    expect(good.calls.filter((c) => c.path === '/properties')).toHaveLength(0)
    expect(good.calls.filter((c) => c.method === 'POST' && c.path === '/room_types')).toHaveLength(0)
    expect(good.calls.filter((c) => c.method === 'PUT' && c.path.startsWith('/room_types/'))).toHaveLength(3)
    expect(good.calls.filter((c) => c.path === '/rate_plans')).toHaveLength(3)
  })

  it('sends dorms per bed and private rooms per room, MAD, Morocco time, no auto-release', async () => {
    const { data: conn } = await db.from('channel_connections').select('status').eq('property_id', prop).single()
    expect(conn!.status).toBe('active')

    // Inspect what the first (failed) run sent: rebuild it on a fresh fake.
    await db.from('channel_connections').delete().eq('property_id', prop)
    await db.from('room_types').update({ channex_room_type_id: null }).eq('property_id', prop)
    await db.from('rate_plans').update({ channex_rate_plan_id: null }).eq('property_id', prop)
    const { cx, calls } = fakeChannex()
    const r = await connectProperty(db, cx, prop)
    expect(r.ok).toBe(true)

    const property = calls.find((c) => c.path === '/properties')!.body!.property
    expect(property).toMatchObject({ currency: 'MAD', country: 'MA', timezone: 'Africa/Casablanca', property_type: 'hostel' })
    expect(property.settings).toMatchObject({
      allow_availability_autoupdate_on_modification: false,
      allow_availability_autoupdate_on_cancellation: false,
    })

    const types = calls.filter((c) => c.path === '/room_types').map((c) => c.body!.room_type)
    const dorm = types.find((t) => t.title === 'Dortoir A')!
    expect(dorm).toMatchObject({ room_kind: 'dorm', count_of_rooms: 4, capacity: 4, occ_adults: 1, default_occupancy: 1 })
    const priv = types.find((t) => t.room_kind === 'room')!
    expect(priv).toMatchObject({ count_of_rooms: 1 })

    const plan = calls.find((c) => c.path === '/rate_plans')!.body!.rate_plan
    expect(plan).toMatchObject({ currency: 'MAD', sell_mode: 'per_room', rate_mode: 'manual' })

    // every type and default plan is linked, the full sync is queued once
    const { data: unmapped } = await db.from('room_types').select('id').eq('property_id', prop).is('channex_room_type_id', null)
    expect(unmapped).toHaveLength(0)
    const { count } = await db.from('channel_ari_queue').select('id', { count: 'exact', head: true }).eq('reason', 'full_sync')
    expect(count).toBeGreaterThan(0)
  })

  it('running it again creates nothing and does not repeat the full sync within 24 h', async () => {
    await db.from('channel_ari_queue').delete().gte('id', 0)
    const { cx, calls } = fakeChannex()
    const r = await connectProperty(db, cx, prop)
    expect(r.ok && r.fullSync).toBe(false)
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0)
    const { count } = await db.from('channel_ari_queue').select('id', { count: 'exact', head: true })
    expect(count).toBe(0)
  })

  it('builds the iframe URL on the same host, restricted to our channels', () => {
    const { cx } = fakeChannex()
    const url = new URL(cx.iframeUrl('tok', 'CX-P'))
    expect(url.origin + url.pathname).toBe('https://staging.channex.test/auth/exchange')
    expect(url.searchParams.get('oauth_session_key')).toBe('tok')
    expect(url.searchParams.get('channels')).toBe('BDC,HWL,ABB,EXP')
    expect(url.searchParams.get('app_mode')).toBe('headless')
  })
})
