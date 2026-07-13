import { describe, it, expect } from 'vitest'
import { createHmac } from 'crypto'
import { isSubscriptionBlocked, verifyWebhookSignature, mapLsStatus, GRACE_DAYS } from '@/lib/billing'

const NOW = new Date('2026-07-08T12:00:00Z')
const daysFromNow = (d: number) => new Date(NOW.getTime() + d * 24 * 60 * 60 * 1000).toISOString()

describe('isSubscriptionBlocked — the paywall gate', () => {
  it('never blocks a super admin, even with no subscription', () => {
    expect(isSubscriptionBlocked(null, null, true, NOW)).toBe(false)
    expect(isSubscriptionBlocked('expired', daysFromNow(-100), true, NOW)).toBe(false)
  })

  it('never blocks an active subscription', () => {
    expect(isSubscriptionBlocked('active', null, false, NOW)).toBe(false)
    expect(isSubscriptionBlocked('active', daysFromNow(-30), false, NOW)).toBe(false)
  })

  describe('trialing', () => {
    it('allows during the trial', () => {
      expect(isSubscriptionBlocked('trialing', daysFromNow(10), false, NOW)).toBe(false)
    })
    it('allows within the grace period after trial end', () => {
      expect(isSubscriptionBlocked('trialing', daysFromNow(-(GRACE_DAYS - 1)), false, NOW)).toBe(false)
    })
    it('blocks after trial end + grace period', () => {
      expect(isSubscriptionBlocked('trialing', daysFromNow(-(GRACE_DAYS + 1)), false, NOW)).toBe(true)
    })
    it('allows a trial with no end date (legacy rows)', () => {
      expect(isSubscriptionBlocked('trialing', null, false, NOW)).toBe(false)
    })
  })

  describe('past_due', () => {
    it('allows within the grace period', () => {
      expect(isSubscriptionBlocked('past_due', daysFromNow(-(GRACE_DAYS - 1)), false, NOW)).toBe(false)
    })
    it('blocks beyond the grace period', () => {
      expect(isSubscriptionBlocked('past_due', daysFromNow(-(GRACE_DAYS + 1)), false, NOW)).toBe(true)
    })
    it('blocks when there is no period end at all', () => {
      expect(isSubscriptionBlocked('past_due', null, false, NOW)).toBe(true)
    })
  })

  describe('cancelled', () => {
    it('allows until the paid period ends', () => {
      expect(isSubscriptionBlocked('cancelled', daysFromNow(5), false, NOW)).toBe(false)
    })
    it('blocks immediately after the period ends (no grace)', () => {
      expect(isSubscriptionBlocked('cancelled', daysFromNow(-1), false, NOW)).toBe(true)
    })
    it('blocks when there is no period end', () => {
      expect(isSubscriptionBlocked('cancelled', null, false, NOW)).toBe(true)
    })
  })

  it('blocks expired subscriptions', () => {
    expect(isSubscriptionBlocked('expired', daysFromNow(10), false, NOW)).toBe(true)
  })

  it('blocks when no subscription row exists', () => {
    expect(isSubscriptionBlocked(null, null, false, NOW)).toBe(true)
  })
})

describe('verifyWebhookSignature — LemonSqueezy HMAC', () => {
  const secret = 'testsecret2026'
  const body = JSON.stringify({ meta: { event_name: 'subscription_created' }, data: { id: '1' } })
  const validSig = createHmac('sha256', secret).update(body).digest('hex')

  it('accepts a valid signature', () => {
    expect(verifyWebhookSignature(body, validSig, secret)).toBe(true)
  })

  it('rejects a tampered body', () => {
    expect(verifyWebhookSignature(body + ' ', validSig, secret)).toBe(false)
  })

  it('rejects a signature made with the wrong secret', () => {
    const wrongSig = createHmac('sha256', 'wrong-secret').update(body).digest('hex')
    expect(verifyWebhookSignature(body, wrongSig, secret)).toBe(false)
  })

  it('rejects an empty signature without throwing (timingSafeEqual length mismatch)', () => {
    expect(verifyWebhookSignature(body, '', secret)).toBe(false)
  })

  it('rejects a truncated signature without throwing', () => {
    expect(verifyWebhookSignature(body, validSig.slice(0, 10), secret)).toBe(false)
  })
})

describe('mapLsStatus — LemonSqueezy → internal status', () => {
  it('maps every known LS status', () => {
    expect(mapLsStatus('active')).toBe('active')
    expect(mapLsStatus('on_trial')).toBe('trialing')
    expect(mapLsStatus('past_due')).toBe('past_due')
    expect(mapLsStatus('unpaid')).toBe('past_due')
    expect(mapLsStatus('paused')).toBe('past_due')
    expect(mapLsStatus('cancelled')).toBe('cancelled')
    expect(mapLsStatus('expired')).toBe('expired')
  })

  it('defaults unknown statuses to active (never lock a paying customer out by accident)', () => {
    expect(mapLsStatus('some_new_ls_status')).toBe('active')
  })
})
