// ─────────────────────────────────────────────────────────────────────────────
// Business-date helpers. Every property is in Morocco, but the server (Vercel)
// runs in UTC and Morocco's offset is not fixed: it was UTC+1 with UTC+0 during
// Ramadan, and tzdata 2026f moves Morocco to UTC+0 from 20 Sep 2026. So never
// hard-code an offset: everything goes through the IANA zone via Intl, which
// means the RUNTIME's tz database must be current (stale ICU data = 1h error).
// Never derive a calendar date from local Date arithmetic (setDate/getDate +
// toISOString), which skips or repeats a day around offset changes.
//
// Calendar dates are plain 'YYYY-MM-DD' strings; arithmetic on them is done in
// UTC, where every day is exactly 24h. Instants (payment_date etc.) are bounded
// with dayRangeUTC(), which resolves the real Casablanca offset for that day.
// ─────────────────────────────────────────────────────────────────────────────

export const PROPERTY_TZ = 'Africa/Casablanca'

const ymdFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: PROPERTY_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: PROPERTY_TZ,
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
})

/** Today's date in Morocco, as 'YYYY-MM-DD'. */
export function todayISO(now: Date = new Date()): string {
  return ymdFormatter.format(now)
}

/** Add (or subtract) whole days to a 'YYYY-MM-DD' date. DST-proof. */
export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** Whole days from `from` to `to` (both 'YYYY-MM-DD'). */
export function diffDaysISO(from: string, to: string): number {
  const [y1, m1, d1] = from.split('-').map(Number)
  const [y2, m2, d2] = to.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000)
}

/** Morocco wall-clock minus UTC, in minutes, at the given instant. */
function offsetMinutes(at: number): number {
  const p: Record<string, number> = {}
  for (const part of partsFormatter.formatToParts(new Date(at))) {
    if (part.type !== 'literal') p[part.type] = Number(part.value)
  }
  const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return Math.round((wall - Math.floor(at / 1000) * 1000) / 60_000)
}

/** The UTC instant at which the given Morocco calendar day starts. */
export function dayStartUTC(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  const guess = Date.UTC(y, m - 1, d)
  let t = guess - offsetMinutes(guess) * 60_000
  // Re-resolve once in case the offset changed between the guess and the answer.
  t = guess - offsetMinutes(t) * 60_000
  return new Date(t)
}

/** [start, end) instants (ISO strings) covering a Morocco calendar day, for timestamptz filters. */
export function dayRangeUTC(iso: string): { start: string; end: string } {
  return { start: dayStartUTC(iso).toISOString(), end: dayStartUTC(addDaysISO(iso, 1)).toISOString() }
}

/** [start, end) instants covering the Morocco days `from`..`to` inclusive. */
export function rangeUTC(from: string, to: string): { start: string; end: string } {
  return { start: dayStartUTC(from).toISOString(), end: dayStartUTC(addDaysISO(to, 1)).toISOString() }
}

/** Current hour (0-23) in Morocco. */
export function hourInMorocco(now: Date = new Date()): number {
  const h = partsFormatter.formatToParts(now).find((p) => p.type === 'hour')
  return Number(h?.value ?? 0)
}

/**
 * The business day a night audit belongs to: work done after midnight but
 * before `cutoffHour` (default 05:00) still closes the previous day.
 */
export function businessDateISO(now: Date = new Date(), cutoffHour = 5): string {
  const today = todayISO(now)
  return hourInMorocco(now) < cutoffHour ? addDaysISO(today, -1) : today
}

/** Consecutive 'YYYY-MM-DD' dates starting at `start`. */
export function dateSeries(start: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDaysISO(start, i))
}

/** The Morocco calendar date of an instant (e.g. a payment_date timestamptz). */
export function dateOfInstant(instant: string | Date): string {
  return todayISO(typeof instant === 'string' ? new Date(instant) : instant)
}

/** Format a 'YYYY-MM-DD' date without the host timezone shifting it a day. */
export function formatISODate(iso: string, options: Intl.DateTimeFormatOptions, locale = 'fr-FR'): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(locale, { ...options, timeZone: 'UTC' })
}

/**
 * Minutes from `nowMs` until today's `hh:mm` wall-clock time in Morocco
 * (negative once it has passed). Independent of the runtime timezone, so the
 * server (UTC on Vercel) and the browser agree.
 */
export function minutesUntilMoroccoTime(hhmm: string, nowMs: number): number {
  const [h, m] = hhmm.split(':').map(Number)
  const target = dayStartUTC(todayISO(new Date(nowMs))).getTime() + ((h || 0) * 60 + (m || 0)) * 60_000
  return Math.round((target - nowMs) / 60_000)
}
