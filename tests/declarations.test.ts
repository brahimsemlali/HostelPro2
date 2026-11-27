import { describe, it, expect } from 'vitest'
import { unzipSync, zipSync, strFromU8 } from 'fflate'
import {
  monthRange, overlapNights, normalizeNationality, isResident, computeStayStats, touristTaxDue,
  statsToCsv, summarizePack, buildAccountingPackFiles, isValidMonth, type StayRow, type PackPayment, type PackExpense,
} from '@/lib/declarations'
import type { Invoice } from '@/lib/invoicing'

const stay = (ci: string, co: string, extra: Partial<StayRow> = {}): StayRow =>
  ({ check_in_date: ci, check_out_date: co, adults: 1, nationality: 'Française', country_of_residence: 'France', ...extra })

describe('month helpers', () => {
  it('monthRange handles December and validation', () => {
    expect(monthRange('2026-12')).toEqual({ start: '2026-12-01', end: '2027-01-01' })
    expect(monthRange('2026-02')).toEqual({ start: '2026-02-01', end: '2026-03-01' })
    expect(isValidMonth('2026-13')).toBe(false)
    expect(isValidMonth('2026-07')).toBe(true)
  })
  it('overlapNights splits a stay across months', () => {
    expect(overlapNights('2026-11-30', '2026-12-03', '2026-11-01', '2026-12-01')).toBe(1)
    expect(overlapNights('2026-11-30', '2026-12-03', '2026-12-01', '2027-01-01')).toBe(2)
    expect(overlapNights('2026-10-01', '2026-10-05', '2026-11-01', '2026-12-01')).toBe(0)
  })
  it('February of a leap year has 29 nights', () => {
    expect(overlapNights('2028-01-20', '2028-03-10', '2028-02-01', '2028-03-01')).toBe(29)
    expect(overlapNights('2027-01-20', '2027-03-10', '2027-02-01', '2027-03-01')).toBe(28)
  })
})

describe('nationality and residence', () => {
  it('normalizes free text and empty values', () => {
    expect(normalizeNationality('  FRANÇAISE ')).toBe('Française')
    expect(normalizeNationality('allemande')).toBe('Allemande')
    expect(normalizeNationality(null)).toBe('Non renseignée')
    expect(normalizeNationality('  ')).toBe('Non renseignée')
  })
  it('residence country wins over nationality', () => {
    expect(isResident({ nationality: 'Française', country_of_residence: 'Maroc' })).toBe(true)
    expect(isResident({ nationality: 'Marocaine', country_of_residence: 'France' })).toBe(false)
    expect(isResident({ nationality: 'Marocaine', country_of_residence: null })).toBe(true)
    expect(isResident({ nationality: 'Allemande', country_of_residence: '' })).toBe(false)
    expect(isResident({ nationality: null, country_of_residence: 'morocco' })).toBe(true)
  })
})

describe('computeStayStats', () => {
  const rows = [
    stay('2026-10-29', '2026-11-02', { adults: 2 }),                          // 1 night in Nov × 2 people, arrived in Oct
    stay('2026-11-10', '2026-11-13', { nationality: 'allemande', country_of_residence: 'Allemagne' }), // 3 nights
    stay('2026-11-28', '2026-12-04', { nationality: 'Marocaine', country_of_residence: 'Maroc' }),    // 3 nights in Nov
    stay('2026-11-15', '2026-11-16', { nationality: null, country_of_residence: null }),              // 1 night
  ]

  it('counts nuitées per night of the month and arrivals in the month (closed month)', () => {
    const s = computeStayStats(rows, '2026-11', '2026-12-15')
    expect(s.provisional).toBe(false)
    expect(s.countedUntil).toBe('2026-11-30')
    expect(s.nights).toBe(2 + 3 + 3 + 1)
    expect(s.arrivals).toBe(3)
    expect(s.residents).toEqual({ arrivals: 1, nights: 3 })
    expect(s.nonResidents).toEqual({ arrivals: 2, nights: 6 })
    expect(s.byNationality.find((n) => n.nationality === 'Française')).toEqual({ nationality: 'Française', arrivals: 0, nights: 2 })
    expect(s.byNationality.find((n) => n.nationality === 'Non renseignée')?.nights).toBe(1)
    expect(s.byNationality[0].nights).toBeGreaterThanOrEqual(s.byNationality.at(-1)!.nights)
  })

  it('a running month only counts nights that already happened', () => {
    const s = computeStayStats(rows, '2026-11', '2026-11-29') // tonight (29th) not counted yet
    expect(s.provisional).toBe(true)
    expect(s.countedUntil).toBe('2026-11-28')
    // Moroccan guest checked in on the 28th: only the night of the 28th
    expect(s.residents.nights).toBe(1)
    expect(s.nights).toBe(2 + 3 + 1 + 1)
  })

  it('tax = nuitées × rate', () => {
    expect(touristTaxDue(9, 5.5)).toBe(49.5)
    expect(touristTaxDue(9, -1)).toBe(0)
  })

  it('CSV lists totals, residents and the amount due', () => {
    const csv = statsToCsv(computeStayStats(rows, '2026-11', '2026-12-15'), 5)
    expect(csv).toContain('TOTAL;3;9')
    expect(csv).toContain('Montant dû;45,00')
  })
})

describe('accounting pack', () => {
  const inv = (number: string, kind: 'invoice' | 'credit_note', ttc: number) => ({
    id: number, number, kind, issue_date: '2026-11-0' + (kind === 'invoice' ? '2' : '5'), credited_number: kind === 'credit_note' ? 'F-2026-0001' : null,
    cancelled_at: null, buyer: { name: 'X', company_name: null, company_ice: null },
    total_ht: ttc / 1.1, total_tva: ttc - ttc / 1.1, tourist_tax: 0, total_ttc: ttc, amount_paid: 0, payment_methods: [],
  }) as unknown as Invoice
  const invoices = [inv('F-2026-0001', 'invoice', 110), inv('AV-2026-0001', 'credit_note', -110), inv('F-2026-0002', 'invoice', 220)]
  const payments: PackPayment[] = [
    { payment_date: '2026-11-02T10:00:00Z', amount: 200, type: 'payment', method: 'cash', status: 'completed', reference: null, guest_name: 'Hans' },
    { payment_date: '2026-11-03T10:00:00Z', amount: 50, type: 'payment', method: 'cmi', status: 'completed', reference: 'T1', guest_name: 'Ana' },
    { payment_date: '2026-11-04T10:00:00Z', amount: 30, type: 'refund', method: 'cash', status: 'completed', reference: null, guest_name: 'Hans' },
    { payment_date: '2026-11-04T10:00:00Z', amount: 999, type: 'payment', method: 'cash', status: 'pending', reference: null, guest_name: 'Z' },
  ]
  const expenses: PackExpense[] = [
    { expense_date: '2026-11-03', category: 'menage', description: 'Javel', amount: 40, payment_method: 'cash', notes: null },
    { expense_date: '2026-11-08', category: 'alimentation', description: 'Pain; lait', amount: 60, payment_method: 'cash', notes: null },
  ]

  it('summary reconciles invoiced, received and spent', () => {
    const s = summarizePack(invoices, payments, expenses)
    expect(s).toMatchObject({ invoiceCount: 2, creditNoteCount: 1, totalTtc: 220, refunds: 30, netReceived: 220, totalExpenses: 100 })
    expect(s.receivedByMethod).toEqual([{ method: 'cash', amount: 200 }, { method: 'cmi', amount: 50 }])
  })

  it('zips CSVs and one PDF per invoice and avoir', async () => {
    let progress = 0
    const files = await buildAccountingPackFiles({
      month: '2026-11', propertyName: 'Auberge Atlas', invoices, payments, expenses,
      dateOf: (iso) => iso.slice(0, 10),
      invoicePdf: async (i) => new TextEncoder().encode(`%PDF ${i.number}`).buffer as ArrayBuffer,
      onProgress: (d) => { progress = d },
    })
    const unzipped = unzipSync(zipSync(files))
    expect(Object.keys(unzipped).sort()).toEqual([
      'depenses-2026-11.csv', 'encaissements-2026-11.csv',
      'factures/AV-2026-0001.pdf', 'factures/F-2026-0001.pdf', 'factures/F-2026-0002.pdf',
      'journal-ventes-2026-11.csv', 'synthese-2026-11.csv',
    ])
    expect(progress).toBe(3)
    const pay = strFromU8(unzipped['encaissements-2026-11.csv'])
    expect([...unzipped['encaissements-2026-11.csv'].slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]) // UTF-8 BOM for Excel
    expect(pay.startsWith('Date;Type;Mode;Montant')).toBe(true) // strFromU8 drops the BOM
    expect(pay).toContain('Remboursement;Espèces;-30,00')
    expect(pay).not.toContain('999') // pending payment is not a receipt
    expect(pay.trim().split('\r\n')).toHaveLength(4) // header + 3 completed rows
    expect(strFromU8(unzipped['depenses-2026-11.csv'])).toContain('"Pain; lait"')
    expect(strFromU8(unzipped['depenses-2026-11.csv'])).toContain('2026-11-03;Ménage;Javel;40,00;Espèces;')
    expect(strFromU8(unzipped['synthese-2026-11.csv'])).toContain('Alimentation;60,00')
    expect(strFromU8(unzipped['synthese-2026-11.csv'])).toContain('Total encaissé net;220,00')
    expect(strFromU8(unzipped['factures/F-2026-0002.pdf'])).toBe('%PDF F-2026-0002')
  })
})
