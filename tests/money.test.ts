import { describe, it, expect } from 'vitest'
import { balanceDue, netReceived } from '@/lib/money'

describe('netReceived', () => {
  it('subtracts refunds and ignores pending/failed payments', () => {
    expect(
      netReceived([
        { amount: 300, type: 'payment', status: 'completed' },
        { amount: 100, type: 'deposit', status: 'completed' },
        { amount: 50, type: 'refund', status: 'completed' },
        { amount: 999, type: 'payment', status: 'pending' },
        { amount: 999, type: 'payment', status: 'failed' },
      ]),
    ).toBe(350)
  })

  it('treats rows without a status as completed (pre-filtered queries)', () => {
    expect(netReceived([{ amount: 120, type: 'payment' }])).toBe(120)
  })

  it('rounds float sums to centimes', () => {
    expect(netReceived([{ amount: 0.1, type: 'payment' }, { amount: 0.2, type: 'payment' }])).toBe(0.3)
  })
})

describe('balanceDue', () => {
  it('includes extras and goes negative when overpaid', () => {
    const extras = [{ quantity: 2, unit_price: 30 }]
    expect(balanceDue(360, extras, [{ amount: 200, type: 'deposit', status: 'completed' }])).toBe(220)
    expect(balanceDue(100, [], [{ amount: 150, type: 'payment', status: 'completed' }])).toBe(-50)
  })
})
