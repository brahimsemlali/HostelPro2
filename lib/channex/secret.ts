import { timingSafeEqual } from 'crypto'

/** Constant-time comparison of a presented secret with the configured one.
 *  Fails closed when the configured secret is missing or empty. */
export function secretMatches(presented: string | null | undefined, configured: string | undefined): boolean {
  if (!configured || !presented) return false
  const a = Buffer.from(presented)
  const b = Buffer.from(configured)
  return a.length === b.length && timingSafeEqual(a, b)
}
