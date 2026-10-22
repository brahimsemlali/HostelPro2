import { describe, it, expect } from 'vitest'
import {
  addMonthsClamped, extendPeriod, computeMrr, chaseBucket, lastMonthKeys, sumByMonth, monthKey,
} from '@/lib/admin/metrics'
import { BILLING_PLANS } from '@/lib/constants'
import { GRACE_DAYS } from '@/lib/billing'

const NOW = new Date('2026-07-08T12:00:00Z')
const days = (d: number) => new Date(NOW.getTime() + d * 24 * 60 * 60 * 1000).toISOString()
const STARTER = BILLING_PLANS[0].ls_variant_id
const PRO = BILLING_PLANS[1].ls_variant_id

describe('addMonthsClamped', () => {
  it('clamps month-end days instead of overflowing', () => {
    expect(addMonthsClamped(new Date('2026-01-31T10:00:00Z'), 1).toISOString()).toBe('2026-02-28T10:00:00.000Z')
    expect(addMonthsClamped(new Date('2028-01-31T10:00:00Z'), 1).toISOString()).toBe('2028-02-29T10:00:00.000Z')
    expect(addMonthsClamped(new Date('2026-03-31T10:00:00Z'), 1).toISOString()).toBe('2026-04-30T10:00:00.000Z')
  })
  it('crosses years', () => {
    expect(addMonthsClamped(new Date('2026-11-15T00:00:00Z'), 3).toISOString()).toBe('2027-02-15T00:00:00.000Z')
  })
})

describe('extendPeriod', () => {
  it('extends from the current end when still in the future (early payment keeps days)', () => {
    expect(extendPeriod(days(10), 1, NOW).toISOString()).toBe(addMonthsClamped(new Date(days(10)), 1).toISOString())
  })
  it('extends from now when the period already ended or never existed', () => {
    expect(extendPeriod(days(-20), 1, NOW).toISOString()).toBe('2026-08-08T12:00:00.000Z')
    expect(extendPeriod(null, 12, NOW).toISOString()).toBe('2027-07-08T12:00:00.000Z')
  })
})

describe('computeMrr', () => {
  it('counts only active, unexpired subscriptions at their plan price', () => {
    const mrr = computeMrr([
      { status: 'active', ls_variant_id: STARTER, current_period_end: days(5) },
      { status: 'active', ls_variant_id: PRO, current_period_end: days(30) },
      { status: 'active', ls_variant_id: PRO, current_period_end: days(-1) }, // lapsed
      { status: 'trialing', ls_variant_id: PRO, current_period_end: days(5) },
      { status: 'active', ls_variant_id: null, current_period_end: days(5) }, // no plan
    ], NOW)
    expect(mrr).toBe(BILLING_PLANS[0].price + BILLING_PLANS[1].price)
  })
})

describe('chaseBucket', () => {
  const sub = (status: string, end: string | null) => ({ status, ls_variant_id: STARTER, current_period_end: end })
  it('puts accounts past their end but inside the grace window first', () => {
    expect(chaseBucket(sub('active', days(-(GRACE_DAYS - 1))), NOW)).toBe('grace')
  })
  it('flags renewals due within 7 days, not later ones', () => {
    expect(chaseBucket(sub('active', days(6)), NOW)).toBe('ending_soon')
    expect(chaseBucket(sub('active', days(8)), NOW)).toBeNull()
  })
  it('treats active accounts past grace, and cancellations, as lapsed for 30 days', () => {
    expect(chaseBucket(sub('active', days(-(GRACE_DAYS + 1))), NOW)).toBe('lapsed')
    expect(chaseBucket(sub('cancelled', days(-10)), NOW)).toBe('lapsed')
    expect(chaseBucket(sub('cancelled', days(-40)), NOW)).toBeNull()
  })
  it('does not chase a cancellation that still has access', () => {
    expect(chaseBucket(sub('cancelled', days(10)), NOW)).toBeNull()
  })
  it('tracks trials ending soon and recently ended', () => {
    expect(chaseBucket(sub('trialing', days(2)), NOW)).toBe('trial_ending')
    expect(chaseBucket(sub('trialing', days(10)), NOW)).toBeNull()
    expect(chaseBucket(sub('trialing', days(-3)), NOW)).toBe('trial_expired')
  })
  it('ignores accounts without a subscription', () => {
    expect(chaseBucket(null, NOW)).toBeNull()
  })
})

describe('monthly revenue buckets (Morocco time)', () => {
  it('lists the last N months oldest first, across a year boundary', () => {
    expect(lastMonthKeys(3, new Date('2027-01-10T12:00:00Z'))).toEqual(['2026-11', '2026-12', '2027-01'])
  })
  it('a payment at 23:30 UTC on the last day counts in the next Morocco month', () => {
    // 2026-07-31 23:30 UTC = 2026-08-01 00:30 in Casablanca (UTC+1)
    expect(monthKey('2026-07-31T23:30:00Z')).toBe('2026-08')
  })
  it('sums amounts per month and ignores months outside the window', () => {
    const rows = [
      { amount: 350, paid_at: '2026-06-03T10:00:00Z' },
      { amount: 1000, paid_at: '2026-07-01T10:00:00Z' },
      { amount: 350, paid_at: '2026-07-20T10:00:00Z' },
      { amount: 999, paid_at: '2025-01-01T10:00:00Z' },
    ]
    expect(sumByMonth(rows, ['2026-06', '2026-07'])).toEqual([350, 1350])
  })
})
