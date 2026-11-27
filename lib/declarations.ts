// Monthly administrative figures (taxe de séjour, tourism statistics) and the
// accounting pack. Pure functions: the pages fetch rows, these compute.
//
// A "nuitée" is one person for one night. A stay's nights are attributed to
// the month each night falls in, so a 30 Nov → 3 Dec stay counts 1 nuitée in
// November and 2 in December (× adults).

import { addDaysISO, diffDaysISO } from '@/lib/dates'
import { round2, signedAmount } from '@/lib/money'
import { csvNumber, toCsv } from '@/lib/csv'
import { byIssueOrder, invoicesToCsv, PAYMENT_METHOD_LABELS, type Invoice } from '@/lib/invoicing'
import { createT } from '@/lib/i18n'

export type StayRow = {
  check_in_date: string
  check_out_date: string
  adults: number | null
  nationality: string | null
  country_of_residence: string | null
}

export const UNKNOWN_NATIONALITY = 'Non renseignée'

/** [start, end) of a 'YYYY-MM' month as 'YYYY-MM-DD' strings. */
export function monthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split('-').map(Number)
  const end = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
  return { start: `${month}-01`, end }
}

export function isValidMonth(month: string | undefined | null): month is string {
  return !!month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month)
}

/** Nights of [checkIn, checkOut) that fall inside [start, end). */
export function overlapNights(checkIn: string, checkOut: string, start: string, end: string): number {
  const from = checkIn > start ? checkIn : start
  const to = checkOut < end ? checkOut : end
  return Math.max(0, diffDaysISO(from, to))
}

function norm(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** "  française " → "Française"; empty → "Non renseignée". */
export function normalizeNationality(n: string | null | undefined): string {
  const t = (n ?? '').trim().replace(/\s+/g, ' ')
  if (!t) return UNKNOWN_NATIONALITY
  return t.charAt(0).toLocaleUpperCase('fr') + t.slice(1).toLocaleLowerCase('fr')
}

const MOROCCO_COUNTRY = new Set(['maroc', 'morocco', 'ma', 'mar', 'royaume du maroc', 'al maghrib', 'marruecos'])
const MOROCCO_NATIONALITY = new Set(['marocaine', 'marocain', 'moroccan', 'maroc', 'morocco', 'marroqui', 'ma', 'mar'])

/**
 * Résident = lives in Morocco. Country of residence decides when filled;
 * otherwise fall back to a Moroccan nationality.
 */
export function isResident(row: Pick<StayRow, 'nationality' | 'country_of_residence'>): boolean {
  const country = norm(row.country_of_residence)
  if (country) return MOROCCO_COUNTRY.has(country)
  return MOROCCO_NATIONALITY.has(norm(row.nationality))
}

export type NationalityStat = { nationality: string; arrivals: number; nights: number }

export type StayStats = {
  month: string
  /** Last day counted (inclusive) — before month end while the month is running. */
  countedUntil: string
  provisional: boolean
  arrivals: number
  nights: number
  residents: { arrivals: number; nights: number }
  nonResidents: { arrivals: number; nights: number }
  byNationality: NationalityStat[]
}

/**
 * @param today Morocco calendar date. Nights after `today` have not happened
 *              yet, so a running month only counts up to last night.
 */
export function computeStayStats(rows: readonly StayRow[], month: string, today: string): StayStats {
  const { start, end: monthEnd } = monthRange(month)
  const provisional = today < monthEnd
  const end = provisional ? (today > start ? today : start) : monthEnd

  const byNat = new Map<string, NationalityStat>()
  const residents = { arrivals: 0, nights: 0 }
  const nonResidents = { arrivals: 0, nights: 0 }
  let arrivals = 0
  let nights = 0

  for (const r of rows) {
    const people = Math.max(1, r.adults ?? 1)
    const n = overlapNights(r.check_in_date, r.check_out_date, start, end) * people
    const arrived = r.check_in_date >= start && r.check_in_date < monthEnd && r.check_in_date <= today ? people : 0
    if (n === 0 && arrived === 0) continue

    const key = normalizeNationality(r.nationality)
    const stat = byNat.get(key) ?? { nationality: key, arrivals: 0, nights: 0 }
    stat.arrivals += arrived
    stat.nights += n
    byNat.set(key, stat)

    const bucket = isResident(r) ? residents : nonResidents
    bucket.arrivals += arrived
    bucket.nights += n
    arrivals += arrived
    nights += n
  }

  return {
    month,
    countedUntil: addDaysISO(end, -1),
    provisional,
    arrivals,
    nights,
    residents,
    nonResidents,
    byNationality: [...byNat.values()].sort((a, b) => b.nights - a.nights || a.nationality.localeCompare(b.nationality, 'fr')),
  }
}

export function touristTaxDue(nights: number, ratePerNight: number): number {
  return round2(nights * Math.max(0, ratePerNight))
}

export function statsToCsv(stats: StayStats, ratePerNight: number | null): string {
  const rows: (string | number)[][] = [
    ['Nationalité', 'Arrivées', 'Nuitées'],
    ...stats.byNationality.map((s) => [s.nationality, s.arrivals, s.nights]),
    ['TOTAL', stats.arrivals, stats.nights],
    [],
    ['Résidents (Maroc)', stats.residents.arrivals, stats.residents.nights],
    ['Non-résidents', stats.nonResidents.arrivals, stats.nonResidents.nights],
  ]
  if (ratePerNight != null) {
    rows.push([], ['Taxe de séjour (MAD / nuitée)', csvNumber(ratePerNight)], ['Montant dû', csvNumber(touristTaxDue(stats.nights, ratePerNight))])
  }
  if (stats.provisional) rows.push([], [`Provisoire : nuitées comptées jusqu'au ${stats.countedUntil}`])
  return toCsv(rows)
}

// ── Accounting pack ──────────────────────────────────────────────────────────

export type PackPayment = {
  payment_date: string
  amount: number
  type: string
  method: string
  status: string | null
  reference: string | null
  guest_name: string | null
}

export type PackExpense = {
  expense_date: string
  category: string
  description: string
  amount: number
  payment_method: string | null
  notes: string | null
}

const TYPE_LABELS: Record<string, string> = { payment: 'Paiement', deposit: 'Acompte', refund: 'Remboursement' }

const tFr = createT('fr')
/** 'menage' → 'Ménage' (same labels as the Dépenses page). */
export function expenseCategoryLabel(code: string): string {
  const key = `expenses.cat.${code}`
  const label = tFr(key)
  return label === key ? code : label
}
const EXPENSE_METHOD_LABELS: Record<string, string> = { ...PAYMENT_METHOD_LABELS, card: 'Carte bancaire' }

export function paymentsToCsv(payments: readonly PackPayment[], dateOf: (iso: string) => string): string {
  return toCsv([
    ['Date', 'Type', 'Mode', 'Montant', 'Référence', 'Client'],
    // Only money actually received: pending / failed rows are not receipts
    // (same rule as summarizePack, so the two files reconcile).
    ...payments.filter((p) => !p.status || p.status === 'completed').map((p) => [
      dateOf(p.payment_date), TYPE_LABELS[p.type] ?? p.type, PAYMENT_METHOD_LABELS[p.method] ?? p.method,
      csvNumber(signedAmount(p)), p.reference ?? '', p.guest_name ?? '',
    ]),
  ])
}

export function expensesToCsv(expenses: readonly PackExpense[]): string {
  return toCsv([
    ['Date', 'Catégorie', 'Description', 'Montant', 'Mode de paiement', 'Notes'],
    ...expenses.map((e) => [e.expense_date, expenseCategoryLabel(e.category), e.description, csvNumber(e.amount), e.payment_method ? (EXPENSE_METHOD_LABELS[e.payment_method] ?? e.payment_method) : '', e.notes ?? '']),
  ])
}

export type PackSummary = {
  invoiceCount: number
  creditNoteCount: number
  totalHt: number
  totalTva: number
  touristTaxInvoiced: number
  totalTtc: number
  receivedByMethod: { method: string; amount: number }[]
  refunds: number
  netReceived: number
  expensesByCategory: { category: string; amount: number }[]
  totalExpenses: number
}

export function summarizePack(invoices: readonly Invoice[], payments: readonly PackPayment[], expenses: readonly PackExpense[]): PackSummary {
  const sum = <T,>(xs: readonly T[], f: (x: T) => number) => round2(xs.reduce((s, x) => s + f(x), 0))
  const completed = payments.filter((p) => !p.status || p.status === 'completed')
  const byMethod = new Map<string, number>()
  for (const p of completed) if (p.type !== 'refund') byMethod.set(p.method, round2((byMethod.get(p.method) ?? 0) + p.amount))
  const byCat = new Map<string, number>()
  for (const e of expenses) byCat.set(e.category, round2((byCat.get(e.category) ?? 0) + e.amount))
  return {
    invoiceCount: invoices.filter((i) => i.kind === 'invoice').length,
    creditNoteCount: invoices.filter((i) => i.kind === 'credit_note').length,
    totalHt: sum(invoices, (i) => i.total_ht),
    totalTva: sum(invoices, (i) => i.total_tva),
    touristTaxInvoiced: sum(invoices, (i) => i.tourist_tax),
    totalTtc: sum(invoices, (i) => i.total_ttc),
    receivedByMethod: [...byMethod].map(([method, amount]) => ({ method, amount })).sort((a, b) => b.amount - a.amount),
    refunds: sum(completed.filter((p) => p.type === 'refund'), (p) => p.amount),
    netReceived: sum(completed, signedAmount),
    expensesByCategory: [...byCat].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
    totalExpenses: sum(expenses, (e) => e.amount),
  }
}

export function summaryToCsv(s: PackSummary, propertyName: string, month: string): string {
  return toCsv([
    [`Synthèse ${month}`, propertyName],
    [],
    ['FACTURATION', ''],
    ['Factures émises', s.invoiceCount],
    ['Avoirs émis', s.creditNoteCount],
    ['Chiffre d\'affaires HT (net des avoirs)', csvNumber(s.totalHt)],
    ['TVA collectée', csvNumber(s.totalTva)],
    ['Taxe de séjour facturée', csvNumber(s.touristTaxInvoiced)],
    ['Total facturé TTC', csvNumber(s.totalTtc)],
    [],
    ['ENCAISSEMENTS', ''],
    ...s.receivedByMethod.map((r) => [PAYMENT_METHOD_LABELS[r.method] ?? r.method, csvNumber(r.amount)]),
    ['Remboursements', csvNumber(-s.refunds)],
    ['Total encaissé net', csvNumber(s.netReceived)],
    [],
    ['DÉPENSES', ''],
    ...s.expensesByCategory.map((e) => [expenseCategoryLabel(e.category), csvNumber(e.amount)]),
    ['Total dépenses', csvNumber(s.totalExpenses)],
    [],
    ['Résultat de trésorerie (encaissé net - dépenses)', csvNumber(s.netReceived - s.totalExpenses)],
  ])
}

const enc = new TextEncoder()

/**
 * Builds the files of the monthly pack. `invoicePdf` renders one invoice
 * (injected so the zip logic stays testable without a PDF engine).
 */
export async function buildAccountingPackFiles(input: {
  month: string
  propertyName: string
  invoices: readonly Invoice[]
  payments: readonly PackPayment[]
  expenses: readonly PackExpense[]
  dateOf: (iso: string) => string
  invoicePdf: (inv: Invoice) => Promise<ArrayBuffer>
  onProgress?: (done: number, total: number) => void
}): Promise<Record<string, Uint8Array>> {
  const { month } = input
  const chronological = [...input.invoices].sort(byIssueOrder)
  const files: Record<string, Uint8Array> = {
    [`synthese-${month}.csv`]: enc.encode(summaryToCsv(summarizePack(input.invoices, input.payments, input.expenses), input.propertyName, month)),
    [`journal-ventes-${month}.csv`]: enc.encode(invoicesToCsv(chronological)),
    [`encaissements-${month}.csv`]: enc.encode(paymentsToCsv(input.payments, input.dateOf)),
    [`depenses-${month}.csv`]: enc.encode(expensesToCsv(input.expenses)),
  }
  // Sequential on purpose: jsPDF is CPU-bound, parallel renders only freeze the tab longer.
  for (let i = 0; i < chronological.length; i++) {
    const inv = chronological[i]
    files[`factures/${inv.number}.pdf`] = new Uint8Array(await input.invoicePdf(inv))
    input.onProgress?.(i + 1, chronological.length)
  }
  return files
}
