import { describe, expect, it } from 'vitest'
import {
  availabilityValues, backoffMinutes, formatRate, groupSlices, mergeRanges, restrictionValues, type RateNight,
} from '@/lib/channex/ari'
import { ChannexClient, isRetryable } from '@/lib/channex/client'
import { secretMatches } from '@/lib/channex/secret'

const night = (n: string, over: Partial<RateNight> = {}): RateNight => ({
  night: n, rate: 120, min_stay_arrival: null, min_stay_through: null, max_stay: null,
  closed_to_arrival: false, closed_to_departure: false, stop_sell: false, ...over,
})

describe('mergeRanges', () => {
  it('merges overlapping and touching half-open ranges', () => {
    expect(mergeRanges([
      { from: '2027-01-05', to: '2027-01-08' },
      { from: '2027-01-01', to: '2027-01-03' },
      { from: '2027-01-03', to: '2027-01-04' },
      { from: '2027-01-06', to: '2027-01-10' },
    ])).toEqual([{ from: '2027-01-01', to: '2027-01-04' }, { from: '2027-01-05', to: '2027-01-10' }])
  })
  it('drops empty ranges', () => {
    expect(mergeRanges([{ from: '2027-01-02', to: '2027-01-02' }])).toEqual([])
  })
})

describe('groupSlices', () => {
  it('groups per room type and kind', () => {
    const g = groupSlices([
      { room_type_id: 'a', kind: 'availability', date_from: '2027-01-01', date_to: '2027-01-03' },
      { room_type_id: 'a', kind: 'availability', date_from: '2027-01-02', date_to: '2027-01-05' },
      { room_type_id: 'a', kind: 'rates', date_from: '2027-01-01', date_to: '2027-01-02' },
      { room_type_id: 'b', kind: 'availability', date_from: '2027-01-01', date_to: '2027-01-02' },
    ])
    expect(g.size).toBe(3)
    expect(g.get('a:availability')?.ranges).toEqual([{ from: '2027-01-01', to: '2027-01-05' }])
  })
})

describe('availabilityValues', () => {
  it('collapses equal consecutive nights into inclusive Channex ranges', () => {
    const v = availabilityValues('P', 'RT', [
      { night: '2027-01-01', available: 3 },
      { night: '2027-01-02', available: 3 },
      { night: '2027-01-03', available: 1 },
      { night: '2027-01-05', available: 1 },   // gap: new value
    ])
    expect(v).toEqual([
      { property_id: 'P', room_type_id: 'RT', date_from: '2027-01-01', date_to: '2027-01-02', availability: 3 },
      { property_id: 'P', room_type_id: 'RT', date_from: '2027-01-03', date_to: '2027-01-03', availability: 1 },
      { property_id: 'P', room_type_id: 'RT', date_from: '2027-01-05', date_to: '2027-01-05', availability: 1 },
    ])
  })
  it('never sends a negative availability', () => {
    expect(availabilityValues('P', 'RT', [{ night: '2027-01-01', available: -2 }])[0].availability).toBe(0)
  })
})

describe('restrictionValues', () => {
  it('sends the rate as a 2-decimal string and collapses equal nights', () => {
    const v = restrictionValues('P', 'RP', [night('2027-01-01'), night('2027-01-02'), night('2027-01-03', { rate: 150 })])
    expect(v).toHaveLength(2)
    expect(v[0]).toMatchObject({ rate: '120.00', date_from: '2027-01-01', date_to: '2027-01-02', stop_sell: false })
    expect(v[1]).toMatchObject({ rate: '150.00', date_from: '2027-01-03', date_to: '2027-01-03' })
  })
  it('includes restrictions only when set', () => {
    const [v] = restrictionValues('P', 'RP', [night('2027-01-01', { min_stay_arrival: 2, closed_to_arrival: true })])
    expect(v).toMatchObject({ min_stay_arrival: 2, closed_to_arrival: true })
    expect('max_stay' in v).toBe(false)
  })
  it('closes nights with no usable price instead of selling at 0', () => {
    const [v] = restrictionValues('P', 'RP', [night('2027-01-01', { rate: null })])
    expect(v.stop_sell).toBe(true)
    expect(v.rate).toBeUndefined()
  })
  it('formatRate rejects zero and negatives', () => {
    expect(formatRate(0)).toBeUndefined()
    expect(formatRate(-1)).toBeUndefined()
    expect(formatRate(99.5)).toBe('99.50')
  })
})

describe('backoff and retry', () => {
  it('backs off exponentially, capped at an hour', () => {
    expect([0, 1, 3, 10].map(backoffMinutes)).toEqual([1, 2, 8, 60])
  })
  it('retries network errors, 429 and 5xx only', () => {
    expect([0, 429, 500, 503].every((status) => isRetryable({ status }))).toBe(true)
    expect([400, 401, 422].some((status) => isRetryable({ status }))).toBe(false)
  })
})

describe('ChannexClient', () => {
  it('sends the API key header and surfaces ARI warnings returned with HTTP 200', async () => {
    let seen: { url: string; init?: RequestInit } | null = null
    const cx = new ChannexClient({
      apiKey: 'k', baseUrl: 'https://x.test/api/v1/',
      fetchImpl: async (url, init) => {
        seen = { url, init }
        return new Response(JSON.stringify({ data: [{ id: 't', type: 'task' }], meta: { message: 'Success', warnings: [{ warning: { rate: ['must be greater than 0'] } }] } }), { status: 200 })
      },
    })
    const r = await cx.postAvailability([])
    expect(seen!.url).toBe('https://x.test/api/v1/availability')
    expect((seen!.init?.headers as Record<string, string>)['user-api-key']).toBe('k')
    expect(r.ok).toBe(true)
    expect(r.warnings).toHaveLength(1)
  })
  it('reads Retry-After on 429', async () => {
    const cx = new ChannexClient({
      apiKey: 'k',
      fetchImpl: async () => new Response(JSON.stringify({ errors: { code: 'http_too_many_requests' } }), { status: 429, headers: { 'retry-after': '30' } }),
    })
    const r = await cx.postRestrictions([])
    expect(r.ok).toBe(false)
    expect(r.retryAfterSec).toBe(30)
  })
  it('turns a network failure into status 0', async () => {
    const cx = new ChannexClient({ apiKey: 'k', fetchImpl: async () => { throw new Error('ECONNRESET') } })
    const r = await cx.ack('x')
    expect(r).toMatchObject({ ok: false, status: 0, error: 'ECONNRESET' })
  })
  it('unwraps the JSON:API envelope of a revision', async () => {
    const cx = new ChannexClient({
      apiKey: 'k',
      fetchImpl: async () => new Response(JSON.stringify({ data: { id: 'r1', type: 'booking_revision', attributes: { id: 'r1', booking_id: 'b1', status: 'new' } } }), { status: 200 }),
    })
    const r = await cx.getRevision('r1')
    expect(r.data).toMatchObject({ id: 'r1', booking_id: 'b1', status: 'new' })
  })
})

describe('secretMatches', () => {
  it('fails closed on missing secrets and compares in constant time', () => {
    expect(secretMatches('a', undefined)).toBe(false)
    expect(secretMatches(null, 'a')).toBe(false)
    expect(secretMatches('abc', 'abd')).toBe(false)
    expect(secretMatches('abc', 'abc')).toBe(true)
  })
})
