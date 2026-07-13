import { createHmac, timingSafeEqual } from 'crypto'
import type { SubscriptionStatus } from '@/types'

export const GRACE_DAYS = 7

/**
 * Subscription gate — decides whether a property is locked out of the dashboard.
 * Pure function so the money path is unit-testable.
 */
export function isSubscriptionBlocked(
  status: SubscriptionStatus | null,
  periodEnd: string | null,
  isSuperAdmin: boolean,
  now: Date = new Date(),
): boolean {
  if (isSuperAdmin) return false
  if (status === 'active') return false

  const end = periodEnd ? new Date(periodEnd) : null
  const graceCutoff = end ? new Date(end.getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000) : null

  if (status === 'trialing') {
    if (!end) return false
    return now > graceCutoff!
  }
  if (status === 'past_due') {
    if (!graceCutoff) return true
    return now > graceCutoff
  }
  if (status === 'cancelled') {
    // Access until period ends, then hard wall
    if (!end) return true
    return now > end
  }
  if (status === 'expired') return true

  // null = no subscription row at all
  return true
}

/**
 * LemonSqueezy webhook HMAC-SHA256 verification (timing-safe).
 * Must be computed over the raw request body bytes.
 */
export function verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}

/** Map a LemonSqueezy subscription status to our internal status. */
export function mapLsStatus(lsStatus: string): string {
  const map: Record<string, string> = {
    active: 'active',
    past_due: 'past_due',
    unpaid: 'past_due',
    cancelled: 'cancelled',
    expired: 'expired',
    paused: 'past_due',  // paused = temporarily suspended, treat as past_due (grace period applies)
    on_trial: 'trialing',
  }
  return map[lsStatus] ?? 'active'
}
