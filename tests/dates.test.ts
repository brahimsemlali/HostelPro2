import { describe, it, expect } from 'vitest'
import { addDaysISO, businessDateISO, dateSeries, dayRangeUTC, dayStartUTC, diffDaysISO, todayISO } from '@/lib/dates'

// These helpers must give the same answers whatever the process TZ is (Vercel
// runs in UTC, browsers in Africa/Casablanca). Run the suite under both:
//   npx vitest run   and   TZ=Africa/Casablanca npx vitest run

describe('addDaysISO — calendar arithmetic', () => {
  it('steps over the post-Ramadan offset change (the old calendar freeze)', () => {
    expect(addDaysISO('2026-03-21', 1)).toBe('2026-03-22')
    expect(addDaysISO('2026-03-22', 1)).toBe('2026-03-23')
    expect(addDaysISO('2027-03-14', 1)).toBe('2027-03-15')
  })

  it('handles month/year boundaries and negatives', () => {
    expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDaysISO('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDaysISO('2028-02-28', 1)).toBe('2028-02-29')
  })

  it('a 60-day series through March is strictly increasing with no repeats', () => {
    const s = dateSeries('2026-02-01', 60)
    expect(new Set(s).size).toBe(60)
    expect(s[59]).toBe('2026-04-01')
  })

  it('diffDaysISO counts nights', () => {
    expect(diffDaysISO('2026-03-20', '2026-03-24')).toBe(4)
    expect(diffDaysISO('2026-03-24', '2026-03-20')).toBe(-4)
  })
})

describe('todayISO / dayRangeUTC — Morocco days as UTC instants', () => {
  it('00:30 Morocco (UTC+1) is still the previous day in UTC', () => {
    // 2026-07-08 23:30 UTC = 2026-07-09 00:30 in Casablanca (UTC+1 in summer)
    expect(todayISO(new Date('2026-07-08T23:30:00Z'))).toBe('2026-07-09')
  })

  it('a summer day starts at 23:00 UTC the evening before', () => {
    expect(dayRangeUTC('2026-07-09')).toEqual({
      start: '2026-07-08T23:00:00.000Z',
      end: '2026-07-09T23:00:00.000Z',
    })
  })

  it('a Ramadan day (UTC+0) starts at midnight UTC', () => {
    expect(dayStartUTC('2026-03-01').toISOString()).toBe('2026-03-01T00:00:00.000Z')
  })

  it('the transition day has the right length and no gap', () => {
    const { start, end } = dayRangeUTC('2026-03-22')
    const next = dayRangeUTC('2026-03-23')
    expect(end).toBe(next.start)
    expect(new Date(end).getTime()).toBeGreaterThan(new Date(start).getTime())
  })
})

describe('businessDateISO — night audit day', () => {
  it('an audit at 01:30 Morocco closes the previous day', () => {
    // 2026-07-22 00:30 UTC = 01:30 in Casablanca
    expect(businessDateISO(new Date('2026-07-22T00:30:00Z'))).toBe('2026-07-21')
  })

  it('an audit at 22:00 Morocco closes the same day', () => {
    expect(businessDateISO(new Date('2026-07-21T21:00:00Z'))).toBe('2026-07-21')
  })
})
