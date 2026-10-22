// Pure superadmin business logic: subscription periods, MRR and the renewal
// "to chase" buckets. No I/O, so it is unit-tested in tests/admin.test.ts.

import { BILLING_PLANS } from '@/lib/constants'
import { GRACE_DAYS } from '@/lib/billing'
import { dateOfInstant } from '@/lib/dates'

const DAY_MS = 24 * 60 * 60 * 1000

export const PLAN_BY_VARIANT: Record<string, { name: string; price: number }> = Object.fromEntries(
  BILLING_PLANS.map((p) => [p.ls_variant_id, { name: p.name.replace(/ \(.*\)$/, ''), price: p.price }]),
)

/** Add calendar months, clamping the day (31 Jan + 1 month = 28/29 Feb, not 3 Mar). */
export function addMonthsClamped(date: Date, months: number): Date {
  const d = new Date(date.getTime())
  const day = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + months)
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(day, lastDay))
  return d
}

/**
 * New period end after paying `months`: extends from the current end while it
 * is still in the future (paying early never loses days), otherwise from now.
 */
export function extendPeriod(currentEnd: string | null | undefined, months: number, now: Date = new Date()): Date {
  const end = currentEnd ? new Date(currentEnd) : null
  const base = end && end.getTime() > now.getTime() ? end : now
  return addMonthsClamped(base, months)
}

export type SubLike = {
  status: string
  provider?: string | null
  ls_variant_id: string | null
  current_period_end: string | null
}

/** Paying now: active and not past its end date. */
export function isPaying(sub: SubLike | null | undefined, now: Date = new Date()): boolean {
  if (!sub || sub.status !== 'active') return false
  return !sub.current_period_end || new Date(sub.current_period_end).getTime() >= now.getTime()
}

export function monthlyPrice(sub: SubLike | null | undefined): number {
  return sub?.ls_variant_id ? PLAN_BY_VARIANT[sub.ls_variant_id]?.price ?? 0 : 0
}

export function computeMrr(subs: readonly SubLike[], now: Date = new Date()): number {
  return subs.filter((s) => isPaying(s, now)).reduce((sum, s) => sum + monthlyPrice(s), 0)
}

export type ChaseBucket = 'grace' | 'ending_soon' | 'trial_ending' | 'trial_expired' | 'lapsed'

export const CHASE_LABELS: Record<ChaseBucket, string> = {
  grace: 'En période de grâce',
  ending_soon: 'Renouvellement < 7 j',
  trial_ending: 'Essai se termine < 3 j',
  trial_expired: 'Essai terminé',
  lapsed: 'Expiré (< 30 j)',
}

/**
 * Which renewal follow-up an account needs, if any. Ordered by urgency:
 * accounts about to be locked out first, then upcoming renewals, then recent
 * losses still worth a call.
 */
export function chaseBucket(sub: SubLike | null | undefined, now: Date = new Date()): ChaseBucket | null {
  if (!sub?.current_period_end) return null
  if (sub.status === 'cancelled' || sub.status === 'expired') {
    // A cancellation keeps access until its end date: only chase once it's over.
    const since = now.getTime() - new Date(sub.current_period_end).getTime()
    return since >= 0 && since <= 30 * DAY_MS ? 'lapsed' : null
  }
  const left = new Date(sub.current_period_end).getTime() - now.getTime()
  if (sub.status === 'trialing') {
    if (left < 0) return -left <= 30 * DAY_MS ? 'trial_expired' : null
    return left <= 3 * DAY_MS ? 'trial_ending' : null
  }
  if (sub.status === 'active' || sub.status === 'past_due') {
    if (left < 0) return -left <= GRACE_DAYS * DAY_MS ? 'grace' : -left <= 30 * DAY_MS ? 'lapsed' : null
    return left <= 7 * DAY_MS ? 'ending_soon' : null
  }
  return null
}

const BUCKET_ORDER: ChaseBucket[] = ['grace', 'ending_soon', 'trial_ending', 'trial_expired', 'lapsed']
export function chaseRank(b: ChaseBucket): number {
  return BUCKET_ORDER.indexOf(b)
}

/** 'YYYY-MM' of an instant, in Morocco time. */
export function monthKey(instant: string | Date): string {
  return dateOfInstant(instant).slice(0, 7)
}

/** The last `count` month keys ending with the current one, oldest first. */
export function lastMonthKeys(count: number, now: Date = new Date()): string[] {
  const [y, m] = monthKey(now).split('-').map(Number)
  const keys: string[] = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1))
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
  }
  return keys
}

/** Sum amounts per Morocco month for the given keys. */
export function sumByMonth(rows: readonly { amount: number; paid_at: string }[], keys: readonly string[]): number[] {
  const totals = new Map(keys.map((k) => [k, 0]))
  for (const r of rows) {
    const k = monthKey(r.paid_at)
    if (totals.has(k)) totals.set(k, (totals.get(k) ?? 0) + Number(r.amount))
  }
  return keys.map((k) => Math.round((totals.get(k) ?? 0) * 100) / 100)
}

/** Postgres "relation does not exist" — migration 033 not applied yet. */
export function isMissingTable(error: { code?: string } | null | undefined): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}
