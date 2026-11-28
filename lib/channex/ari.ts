/**
 * Pure helpers that turn queued slices + per-night values into Channex ARI
 * payloads. No I/O here, so the batching rules are unit-tested
 * (tests/channex-ari.test.ts).
 *
 * Dates are 'YYYY-MM-DD' strings. Internal ranges are half-open
 * [from, to) like bookings; Channex `date_to` is the LAST night (inclusive).
 */

import { addDaysISO } from '@/lib/dates'

export type Slice = { room_type_id: string; kind: 'availability' | 'rates'; date_from: string; date_to: string }
export type Range = { from: string; to: string }

/** Union of half-open ranges; touching ranges ([a,b) + [b,c)) merge too. */
export function mergeRanges(ranges: Range[]): Range[] {
  const sorted = ranges.filter((r) => r.to > r.from).sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0))
  const out: Range[] = []
  for (const r of sorted) {
    const last = out.at(-1)
    if (last && r.from <= last.to) {
      if (r.to > last.to) last.to = r.to
    } else {
      out.push({ ...r })
    }
  }
  return out
}

/** Group slices per room type and kind, ranges merged. Key: `${room_type_id}:${kind}`. */
export function groupSlices(slices: Slice[]): Map<string, { room_type_id: string; kind: Slice['kind']; ranges: Range[] }> {
  const groups = new Map<string, { room_type_id: string; kind: Slice['kind']; ranges: Range[] }>()
  for (const s of slices) {
    const key = `${s.room_type_id}:${s.kind}`
    const g = groups.get(key) ?? { room_type_id: s.room_type_id, kind: s.kind, ranges: [] }
    g.ranges.push({ from: s.date_from, to: s.date_to })
    groups.set(key, g)
  }
  for (const g of groups.values()) g.ranges = mergeRanges(g.ranges)
  return groups
}

/** Collapse consecutive nights with an identical payload into one value. */
function compress<T extends { night: string }>(
  nights: T[],
  same: (a: T, b: T) => boolean,
): { first: T; from: string; last: string }[] {
  const out: { first: T; from: string; last: string }[] = []
  for (const n of [...nights].sort((a, b) => (a.night < b.night ? -1 : 1))) {
    const cur = out.at(-1)
    if (cur && addDaysISO(cur.last, 1) === n.night && same(cur.first, n)) {
      cur.last = n.night
    } else {
      out.push({ first: n, from: n.night, last: n.night })
    }
  }
  return out
}

export type AvailabilityNight = { night: string; available: number }
export type AvailabilityValue = {
  property_id: string
  room_type_id: string
  date_from: string
  date_to: string
  availability: number
}

export function availabilityValues(
  channexPropertyId: string,
  channexRoomTypeId: string,
  nights: AvailabilityNight[],
): AvailabilityValue[] {
  return compress(nights, (a, b) => a.available === b.available).map((r) => ({
    property_id: channexPropertyId,
    room_type_id: channexRoomTypeId,
    date_from: r.from,
    date_to: r.last,
    availability: Math.max(0, Math.trunc(r.first.available)),
  }))
}

export type RateNight = {
  night: string
  rate: number | null
  min_stay_arrival: number | null
  min_stay_through: number | null
  max_stay: number | null
  closed_to_arrival: boolean
  closed_to_departure: boolean
  stop_sell: boolean
}

export type RestrictionValue = {
  property_id: string
  rate_plan_id: string
  date_from: string
  date_to: string
  rate?: string
  min_stay_arrival?: number
  min_stay_through?: number
  max_stay?: number
  closed_to_arrival: boolean
  closed_to_departure: boolean
  stop_sell: boolean
}

/** Channex wants a rate > 0 as a decimal string ("120.00"). */
export function formatRate(rate: number | null): string | undefined {
  if (rate == null || !Number.isFinite(rate) || rate <= 0) return undefined
  return rate.toFixed(2)
}

const sameRate = (a: RateNight, b: RateNight) =>
  formatRate(a.rate) === formatRate(b.rate) &&
  a.min_stay_arrival === b.min_stay_arrival &&
  a.min_stay_through === b.min_stay_through &&
  a.max_stay === b.max_stay &&
  a.closed_to_arrival === b.closed_to_arrival &&
  a.closed_to_departure === b.closed_to_departure &&
  a.stop_sell === b.stop_sell

export function restrictionValues(
  channexPropertyId: string,
  channexRatePlanId: string,
  nights: RateNight[],
): RestrictionValue[] {
  return compress(nights, sameRate).map((r) => {
    const v: RestrictionValue = {
      property_id: channexPropertyId,
      rate_plan_id: channexRatePlanId,
      date_from: r.from,
      date_to: r.last,
      closed_to_arrival: r.first.closed_to_arrival,
      closed_to_departure: r.first.closed_to_departure,
      // No usable price → close the nights rather than sell at a wrong price.
      stop_sell: r.first.stop_sell || formatRate(r.first.rate) === undefined,
    }
    const rate = formatRate(r.first.rate)
    if (rate) v.rate = rate
    if (r.first.min_stay_arrival != null) v.min_stay_arrival = r.first.min_stay_arrival
    if (r.first.min_stay_through != null) v.min_stay_through = r.first.min_stay_through
    if (r.first.max_stay != null) v.max_stay = r.first.max_stay
    return v
  })
}

/** Exponential backoff for failed pushes: 1, 2, 4 … minutes, capped at 60. */
export function backoffMinutes(attempts: number): number {
  return Math.min(60, 2 ** Math.max(0, attempts))
}
