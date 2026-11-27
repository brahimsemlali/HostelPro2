import { describe, it, expect } from 'vitest'
import {
  splitTtc, computeInvoice, touristTaxAmount, formatAmount, numberToFrenchWords,
  amountInFrenchWords, isValidIce, missingLegalFields, invoicesToCsv, type Invoice, type PropertyLegal,
} from '@/lib/invoicing'

const VAT10 = { vat_registered: true, vat_rate: 10, tourist_tax_mode: 'none' as const, tourist_tax_per_night: 0 }
const NO_VAT = { ...VAT10, vat_registered: false }

describe('splitTtc', () => {
  it('HT + TVA always equals TTC to the centime', () => {
    for (const ttc of [1, 99.99, 100, 120, 333.33, 1234.56, 10000.01]) {
      for (const rate of [7, 10, 14, 20]) {
        const { ht, tva } = splitTtc(ttc, rate)
        expect(Math.round((ht + tva) * 100)).toBe(Math.round(ttc * 100))
      }
    }
  })
  it('back-computes HT (never adds tax on top)', () => {
    expect(splitTtc(110, 10)).toEqual({ ht: 100, tva: 10 })
    expect(splitTtc(120, 0)).toEqual({ ht: 120, tva: 0 })
  })
})

describe('computeInvoice', () => {
  const base = { accommodationLabel: 'Hébergement', nights: 3, adults: 1, accommodationTtc: 360 }

  it('invoice TTC equals the booking total + extras', () => {
    const { totals, lines } = computeInvoice({
      ...base, legal: VAT10,
      extras: [{ name: 'Petit-déjeuner', quantity: 3, unit_price: 33.33 }, { name: 'Serviette', quantity: 1, unit_price: 15 }],
    })
    expect(totals.total_ttc).toBe(360 + 99.99 + 15)
    expect(lines).toHaveLength(3)
    expect(Math.round((totals.total_ht + totals.total_tva + totals.tourist_tax) * 100)).toBe(Math.round(totals.total_ttc * 100))
    expect(totals.vat_breakdown).toEqual([{ rate: 10, base_ht: totals.total_ht, tva: totals.total_tva }])
  })

  it('non-VAT-registered: zero TVA, HT = TTC', () => {
    const { totals } = computeInvoice({ ...base, legal: NO_VAT, extras: [] })
    expect(totals).toMatchObject({ total_ht: 360, total_tva: 0, total_ttc: 360 })
  })

  it('carves the included taxe de séjour out of accommodation, outside the TVA base', () => {
    const legal = { ...VAT10, tourist_tax_mode: 'included' as const, tourist_tax_per_night: 5 }
    const { totals, lines } = computeInvoice({ ...base, adults: 2, legal, extras: [] })
    expect(totals.tourist_tax).toBe(30) // 5 × 3 nights × 2 adults
    expect(totals.total_ttc).toBe(360)
    expect(lines[0].total_ttc).toBe(330)
    expect(lines.at(-1)).toMatchObject({ kind: 'tourist_tax', vat_rate: 0, total_tva: 0, total_ttc: 30 })
    expect(totals.total_ht).toBe(300)
    expect(totals.total_tva).toBe(30)
  })

  it('uses a single accommodation line when the per-night price is not exact', () => {
    const { lines } = computeInvoice({ ...base, accommodationTtc: 100, legal: NO_VAT, extras: [] })
    expect(lines[0]).toMatchObject({ quantity: 1, unit_ttc: 100, total_ttc: 100, label: 'Hébergement (3 nuits)' })
    const exact = computeInvoice({ ...base, legal: NO_VAT, extras: [] })
    expect(exact.lines[0]).toMatchObject({ quantity: 3, unit_ttc: 120 })
  })

  it('taxe de séjour never exceeds the accommodation price', () => {
    expect(touristTaxAmount({ tourist_tax_mode: 'included', tourist_tax_per_night: 50 }, 3, 2, 100)).toBe(100)
    expect(touristTaxAmount({ tourist_tax_mode: 'none', tourist_tax_per_night: 50 }, 3, 2, 100)).toBe(0)
  })
})

describe('formatAmount', () => {
  it('uses plain spaces and a decimal comma (Helvetica-safe)', () => {
    expect(formatAmount(1234567.5)).toBe('1 234 567,50')
    expect(formatAmount(-120)).toBe('-120,00')
    expect(formatAmount(0.1 + 0.2)).toBe('0,30')
    expect(/^[\x20-\x7E]+$/.test(formatAmount(98765.43))).toBe(true)
  })
})

describe('French amount in words', () => {
  it.each([
    [0, 'zéro'], [1, 'un'], [16, 'seize'], [21, 'vingt et un'], [71, 'soixante et onze'], [77, 'soixante-dix-sept'],
    [80, 'quatre-vingts'], [81, 'quatre-vingt-un'], [99, 'quatre-vingt-dix-neuf'], [100, 'cent'], [200, 'deux cents'],
    [201, 'deux cent un'], [1000, 'mille'], [1280, 'mille deux cent quatre-vingts'], [2000, 'deux mille'],
    [80000, 'quatre-vingt mille'], [200000, 'deux cent mille'], [1000000, 'un million'], [2500000, 'deux millions cinq cent mille'],
  ])('%i → %s', (n, words) => expect(numberToFrenchWords(n)).toBe(words))

  it('adds dirhams and centimes', () => {
    expect(amountInFrenchWords(1)).toBe('un dirham')
    expect(amountInFrenchWords(360.5)).toBe('trois cent soixante dirhams et cinquante centimes')
  })
})

describe('legal checks', () => {
  it('ICE is exactly 15 digits', () => {
    expect(isValidIce('001234567000089')).toBe(true)
    expect(isValidIce('12345')).toBe(false)
    expect(isValidIce('00123456700008A')).toBe(false)
    expect(isValidIce(null)).toBe(false)
  })
  it('lists what blocks invoicing', () => {
    expect(missingLegalFields(null)).toHaveLength(3)
    const ok = { legal_name: 'Atlas SARL', ice: '001234567000089', if_number: '12345678' } as PropertyLegal
    expect(missingLegalFields(ok)).toEqual([])
  })
})

describe('byIssueOrder', () => {
  it('keeps an avoir after the invoice it cancels on the same day', async () => {
    const { byIssueOrder } = await import('@/lib/invoicing')
    const rows = [
      { number: 'AV-2026-0001', issue_date: '2026-11-27', created_at: '2026-11-27T10:05:00Z' },
      { number: 'F-2026-0002', issue_date: '2026-11-27', created_at: '2026-11-27T10:06:00Z' },
      { number: 'F-2026-0001', issue_date: '2026-11-27', created_at: '2026-11-27T10:00:00Z' },
      { number: 'F-2026-0003', issue_date: '2026-11-28', created_at: '2026-11-28T08:00:00Z' },
    ]
    expect([...rows].sort(byIssueOrder).map((r) => r.number)).toEqual(['F-2026-0001', 'AV-2026-0001', 'F-2026-0002', 'F-2026-0003'])
  })
})

describe('invoicesToCsv', () => {
  it('writes an Excel-FR journal with escaped cells and credit-note links', () => {
    const inv = {
      id: 'a', kind: 'invoice', number: 'F-2026-0001', issue_date: '2026-11-27', credited_invoice_id: null,
      cancelled_at: '2026-11-28T10:00:00Z', buyer: { name: 'Müller; Hans', company_name: null, company_ice: null },
      total_ht: 100, total_tva: 10, tourist_tax: 0, total_ttc: 110, amount_paid: 110, payment_methods: ['cash'],
    } as unknown as Invoice
    const avoir = { ...inv, id: 'b', kind: 'credit_note', number: 'AV-2026-0001', credited_invoice_id: 'a', credited_number: 'F-2026-0001', cancelled_at: null, total_ttc: -110, total_ht: -100, total_tva: -10 } as Invoice
    const csv = invoicesToCsv([inv, avoir])
    expect(csv.startsWith('﻿')).toBe(true)
    const lines = csv.slice(1).split('\r\n')
    expect(lines[1]).toContain('"Müller; Hans"')
    expect(lines[1]).toContain(';110,00;')
    expect(lines[1]).toContain('Annulée par avoir')
    expect(lines[2]).toContain('Avoir')
    expect(lines[2]).toContain(';-110,00;')
    expect(lines[2]).toContain(';F-2026-0001;')
  })
})
