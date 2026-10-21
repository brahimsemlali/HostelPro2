/**
 * Simple in-memory rate limiter using a sliding window.
 * For production scale, replace the store with Upstash Redis.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

// Store: key → { count, resetAt }
const store = new Map<string, RateLimitEntry>()

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) store.delete(key)
  }
}, 5 * 60 * 1000)

export interface RateLimitOptions {
  /** Unique key (e.g. IP + route) */
  key: string
  /** Max requests allowed in the window */
  limit: number
  /** Window size in seconds */
  windowSeconds: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

export function rateLimit({ key, limit, windowSeconds }: RateLimitOptions): RateLimitResult {
  const now = Date.now()
  const windowMs = windowSeconds * 1000

  const entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    // New window
    const resetAt = now + windowMs
    store.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: limit - 1, resetAt }
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count++
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt }
}

/**
 * Get the real client IP from Next.js request headers.
 * Deployment is Vercel. Prefer `x-real-ip`: it is a SINGLE value overwritten by
 * Vercel's proxy, so a client cannot influence it. `x-forwarded-for` is a list a
 * client can prepend to (the leftmost token is attacker-controllable), so it is a
 * secondary source; `cf-connecting-ip` is unsanitized by Vercel and only a last
 * resort. This ordering stops an attacker rotating a spoofed header to defeat the
 * per-IP limiter.
 */
export function getClientIp(req: Request): string {
  const headers = req instanceof Request ? req.headers : new Headers()
  return (
    headers.get('x-real-ip')?.trim() ||
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('cf-connecting-ip') ||
    'unknown'
  )
}
