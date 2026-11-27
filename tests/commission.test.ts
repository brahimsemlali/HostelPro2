import { describe, it, expect } from 'vitest'
import { defaultCommissionRate } from '@/lib/constants'

describe('defaultCommissionRate', () => {
  it('applies the OTA defaults', () => {
    expect(defaultCommissionRate('booking_com')).toBe(15)
    expect(defaultCommissionRate('hostelworld')).toBe(12)
  })

  it('charges nothing on commission-free and unknown sources', () => {
    expect(defaultCommissionRate('direct')).toBe(0)
    expect(defaultCommissionRate('walkin')).toBe(0)
    expect(defaultCommissionRate('phone')).toBe(0)
    expect(defaultCommissionRate('airbnb')).toBe(0)
    expect(defaultCommissionRate('something_else')).toBe(0)
  })
})
