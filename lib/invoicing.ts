// Facturation — pure logic shared by the UI, the PDF and the tests.
//
// Prices in the app are what the guest agreed to pay (TTC). An invoice never
// adds tax on top: it splits each TTC amount into HT + TVA so the invoice total
// always equals what was collected. The database (issue_invoice RPC, migration
// 034) re-checks the totals against the booking before assigning a number.

import { round2 } from '@/lib/money'
import { csvNumber, toCsv } from '@/lib/csv'

export type TouristTaxMode = 'none' | 'included'

/** Seller legal identity + tax settings (table property_legal). */
export type PropertyLegal = {
  property_id: string
  legal_name: string | null
  legal_form: string | null
  ice: string | null
  if_number: string | null
  rc: string | null
  patente: string | null
  cnss: string | null
  legal_address: string | null
  vat_registered: boolean
  vat_rate: number
  tourist_tax_mode: TouristTaxMode
  tourist_tax_per_night: number
  bank_details: string | null
  invoice_footer: string | null
  updated_at: string
}

export const PROPERTY_LEGAL_COLUMNS =
  'property_id, legal_name, legal_form, ice, if_number, rc, patente, cnss, legal_address, vat_registered, vat_rate, tourist_tax_mode, tourist_tax_per_night, bank_details, invoice_footer, updated_at'

export type InvoiceLineKind = 'accommodation' | 'extra' | 'tourist_tax'

export type InvoiceLine = {
  kind: InvoiceLineKind
  label: string
  quantity: number
  /** Unit price TTC (what the guest sees). */
  unit_ttc: number
  vat_rate: number
  total_ht: number
  total_tva: number
  total_ttc: number
}

export type VatBreakdown = { rate: number; base_ht: number; tva: number }

export type InvoiceTotals = {
  total_ht: number
  total_tva: number
  tourist_tax: number
  total_ttc: number
  vat_breakdown: VatBreakdown[]
}

export type InvoiceKind = 'invoice' | 'credit_note'

export type InvoiceSeller = {
  name: string
  legal_name: string | null
  legal_form: string | null
  address: string | null
  city: string | null
  phone: string | null
  email: string | null
  ice: string | null
  if_number: string | null
  rc: string | null
  patente: string | null
  cnss: string | null
  bank_details: string | null
  invoice_footer: string | null
  vat_registered: boolean
}

export type InvoiceBuyer = {
  name: string
  document: string | null
  nationality: string | null
  company_name: string | null
  company_ice: string | null
  company_address: string | null
}

export type InvoiceStay = {
  check_in_date: string
  check_out_date: string
  nights: number
  adults: number
  bed: string | null
  source: string | null
  external_ref: string | null
}

/** Row of the invoices table (immutable snapshot). */
export type Invoice = {
  id: string
  property_id: string
  booking_id: string | null
  guest_id: string | null
  kind: InvoiceKind
  year: number
  seq: number
  number: string
  issue_date: string
  credited_invoice_id: string | null
  /** Number of the cancelled invoice (credit notes only). */
  credited_number: string | null
  cancelled_at: string | null
  cancel_reason: string | null
  notes: string | null
  seller: InvoiceSeller
  buyer: InvoiceBuyer
  stay: InvoiceStay
  lines: InvoiceLine[]
  vat_breakdown: VatBreakdown[]
  total_ht: number
  total_tva: number
  tourist_tax: number
  total_ttc: number
  amount_paid: number
  payment_methods: string[]
  vat_registered: boolean
  issued_by_name: string | null
  created_at: string
}

export const INVOICE_COLUMNS =
  'id, property_id, booking_id, guest_id, kind, year, seq, number, issue_date, credited_invoice_id, credited_number, cancelled_at, cancel_reason, notes, seller, buyer, stay, lines, vat_breakdown, total_ht, total_tva, tourist_tax, total_ttc, amount_paid, payment_methods, vat_registered, issued_by_name, created_at'

// ── Validation ────────────────────────────────────────────────────────────────

/** ICE = Identifiant Commun de l'Entreprise, 15 digits. */
export function isValidIce(ice: string | null | undefined): boolean {
  return !!ice && /^[0-9]{15}$/.test(ice.trim())
}

/** Fields the RPC requires before it will number an invoice. */
export function missingLegalFields(legal: PropertyLegal | null): string[] {
  const missing: string[] = []
  if (!legal?.legal_name?.trim()) missing.push('Raison sociale')
  if (!isValidIce(legal?.ice)) missing.push('ICE (15 chiffres)')
  if (!legal?.if_number?.trim()) missing.push('Identifiant fiscal (IF)')
  return missing
}

// ── Computation ───────────────────────────────────────────────────────────────

/** Split a TTC amount into HT + TVA. TVA absorbs the rounding so HT + TVA = TTC exactly. */
export function splitTtc(ttc: number, vatRate: number): { ht: number; tva: number } {
  const ttcR = round2(ttc)
  if (vatRate <= 0) return { ht: ttcR, tva: 0 }
  const ht = round2(ttcR / (1 + vatRate / 100))
  return { ht, tva: round2(ttcR - ht) }
}

function makeLine(kind: InvoiceLineKind, label: string, quantity: number, totalTtc: number, vatRate: number): InvoiceLine {
  const { ht, tva } = splitTtc(totalTtc, vatRate)
  return {
    kind,
    label,
    quantity,
    unit_ttc: quantity > 0 ? round2(totalTtc / quantity) : round2(totalTtc),
    vat_rate: vatRate,
    total_ht: ht,
    total_tva: tva,
    total_ttc: round2(totalTtc),
  }
}

/** Taxe de séjour contained in the accommodation price (never more than the price). */
export function touristTaxAmount(
  legal: Pick<PropertyLegal, 'tourist_tax_mode' | 'tourist_tax_per_night'> | null,
  nights: number,
  adults: number,
  accommodationTtc: number,
): number {
  if (!legal || legal.tourist_tax_mode !== 'included' || legal.tourist_tax_per_night <= 0) return 0
  const tax = round2(legal.tourist_tax_per_night * Math.max(0, nights) * Math.max(1, adults))
  return Math.min(tax, round2(accommodationTtc))
}

export function computeInvoice(input: {
  accommodationLabel: string
  nights: number
  adults: number
  accommodationTtc: number
  extras: readonly { name: string; quantity: number; unit_price: number }[]
  legal: Pick<PropertyLegal, 'vat_registered' | 'vat_rate' | 'tourist_tax_mode' | 'tourist_tax_per_night'> | null
}): { lines: InvoiceLine[]; totals: InvoiceTotals } {
  const vatRate = input.legal?.vat_registered ? Number(input.legal.vat_rate) : 0
  const tax = touristTaxAmount(input.legal, input.nights, input.adults, input.accommodationTtc)

  // Show "N nuits × prix" only when the per-night price is exact to the centime;
  // otherwise one line (e.g. 100 MAD over 3 nights would print 33,33 × 3 ≠ 100).
  const accTtc = round2(input.accommodationTtc - tax)
  const nights = Math.max(1, input.nights)
  const perNightExact = round2(round2(accTtc / nights) * nights) === accTtc
  const lines: InvoiceLine[] = [
    perNightExact
      ? makeLine('accommodation', input.accommodationLabel, nights, accTtc, vatRate)
      : makeLine('accommodation', `${input.accommodationLabel} (${nights} nuit${nights > 1 ? 's' : ''})`, 1, accTtc, vatRate),
    ...input.extras.map((e) => makeLine('extra', e.name, e.quantity, e.quantity * e.unit_price, vatRate)),
  ]
  // Taxe de séjour is a pass-through collected for the commune: outside the TVA base.
  if (tax > 0) lines.push(makeLine('tourist_tax', 'Taxe de séjour', Math.max(1, input.nights), tax, 0))

  const byRate = new Map<number, VatBreakdown>()
  for (const l of lines) {
    if (l.kind === 'tourist_tax') continue
    const row = byRate.get(l.vat_rate) ?? { rate: l.vat_rate, base_ht: 0, tva: 0 }
    row.base_ht = round2(row.base_ht + l.total_ht)
    row.tva = round2(row.tva + l.total_tva)
    byRate.set(l.vat_rate, row)
  }

  const sum = (f: (l: InvoiceLine) => number) => round2(lines.reduce((s, l) => s + f(l), 0))
  return {
    lines,
    totals: {
      total_ht: sum((l) => (l.kind === 'tourist_tax' ? 0 : l.total_ht)),
      total_tva: sum((l) => l.total_tva),
      tourist_tax: tax,
      total_ttc: sum((l) => l.total_ttc),
      vat_breakdown: [...byRate.values()],
    },
  }
}

// ── Formatting ────────────────────────────────────────────────────────────────

/**
 * "12 345,50" with plain ASCII spaces. Intl output varies by runtime (narrow
 * no-break spaces that jsPDF's Helvetica cannot draw), so the PDF and the CSV
 * use this instead.
 */
export function formatAmount(n: number): string {
  const neg = n < 0
  const [int, dec] = Math.abs(round2(n)).toFixed(2).split('.')
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return `${neg ? '-' : ''}${grouped},${dec}`
}

const UNITS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
  'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf']
const TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante']

function below100(n: number): string {
  if (n < 20) return UNITS[n]
  if (n < 70) {
    const t = Math.floor(n / 10), u = n % 10
    if (u === 0) return TENS[t]
    return `${TENS[t]}${u === 1 ? ' et un' : `-${UNITS[u]}`}`
  }
  if (n < 80) return n === 71 ? 'soixante et onze' : `soixante-${UNITS[n - 60]}`
  if (n === 80) return 'quatre-vingts'
  return `quatre-vingt-${UNITS[n - 80]}`
}

function below1000(n: number, final: boolean): string {
  const h = Math.floor(n / 100), r = n % 100
  if (h === 0) return below100(r)
  const head = h === 1 ? 'cent' : `${UNITS[h]} cent${r === 0 && final ? 's' : ''}`
  return r === 0 ? head : `${head} ${below100(r)}`
}

/** Integer to French words (traditional spelling), e.g. 1280 → "mille deux cent quatre-vingts". */
export function numberToFrenchWords(n: number): string {
  n = Math.floor(Math.abs(n))
  if (n === 0) return 'zéro'
  const parts: string[] = []
  const billions = Math.floor(n / 1e9)
  const millions = Math.floor((n % 1e9) / 1e6)
  const thousands = Math.floor((n % 1e6) / 1e3)
  const rest = n % 1000
  if (billions) parts.push(`${below1000(billions, true)} milliard${billions > 1 ? 's' : ''}`)
  if (millions) parts.push(`${below1000(millions, true)} million${millions > 1 ? 's' : ''}`)
  // "quatre-vingts" / "deux cents" lose their s before "mille" (an adjective), not before million.
  if (thousands) parts.push(thousands === 1 ? 'mille' : `${below1000(thousands, false).replace(/vingts$/, 'vingt')} mille`)
  if (rest) parts.push(below1000(rest, true))
  return parts.join(' ')
}

/** "mille deux cent quatre-vingts dirhams et cinquante centimes" */
export function amountInFrenchWords(amount: number): string {
  const abs = Math.abs(round2(amount))
  const dh = Math.floor(abs)
  const cts = Math.round((abs - dh) * 100)
  const dhWords = `${numberToFrenchWords(dh)} dirham${dh > 1 ? 's' : ''}`
  return cts > 0 ? `${dhWords} et ${numberToFrenchWords(cts)} centime${cts > 1 ? 's' : ''}` : dhWords
}

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Espèces', virement: 'Virement bancaire', cmi: 'Carte bancaire (CMI)', wave: 'Wave', other: 'Autre',
}

// ── Sales journal (journal des ventes) CSV for the accountant ────────────────

/** Excel-FR friendly: ";" separator, decimal comma, UTF-8 BOM. */
export function invoicesToCsv(invoices: readonly Invoice[]): string {
  const header = ['Date', 'N° pièce', 'Type', 'Client', 'Société', 'ICE client', 'Total HT', 'TVA', 'Taxe de séjour', 'Total TTC', 'Encaissé', 'Mode de paiement', 'Facture d\'origine', 'Statut']
  const num = csvNumber
  const rows = invoices.map((i) => [
    i.issue_date,
    i.number,
    i.kind === 'invoice' ? 'Facture' : 'Avoir',
    i.buyer.name,
    i.buyer.company_name ?? '',
    i.buyer.company_ice ?? '',
    num(i.total_ht),
    num(i.total_tva),
    num(i.tourist_tax),
    num(i.total_ttc),
    i.kind === 'invoice' ? num(i.amount_paid) : '',
    i.payment_methods.map((m) => PAYMENT_METHOD_LABELS[m] ?? m).join(' + '),
    i.credited_number ?? '',
    i.cancelled_at ? 'Annulée par avoir' : '',
  ])
  return toCsv([header, ...rows])
}

/**
 * Journal order: issue date, then the order pieces were actually created
 * (an avoir always follows the invoice it cancels, whatever their prefixes).
 */
export function byIssueOrder(a: Pick<Invoice, 'issue_date' | 'created_at' | 'number'>, b: Pick<Invoice, 'issue_date' | 'created_at' | 'number'>): number {
  return a.issue_date.localeCompare(b.issue_date) || (a.created_at ?? '').localeCompare(b.created_at ?? '') || a.number.localeCompare(b.number)
}

/** Map RPC error messages (RAISE EXCEPTION codes in migration 034) to French. */
export function invoiceErrorMessage(err: { message?: string; code?: string } | null | undefined): string {
  const msg = err?.message ?? ''
  if (err?.code === '42P01' || err?.code === 'PGRST202' || err?.code === 'PGRST205' || /does not exist|schema cache/.test(msg))
    return 'La facturation n\'est pas encore activée (migration 034 à appliquer).'
  if (msg.includes('legal_info_missing')) return 'Complétez vos informations légales (raison sociale, ICE, IF) dans Paramètres → Facturation.'
  if (msg.includes('invoice_exists')) return 'Une facture existe déjà pour cette réservation.'
  if (msg.includes('total_mismatch')) return 'Le montant a changé entre-temps. Rechargez la page puis réessayez.'
  if (msg.includes('forbidden')) return 'Vous n\'avez pas les droits pour cette action.'
  if (msg.includes('already_cancelled')) return 'Cette facture est déjà annulée.'
  if (msg.includes('reason_required')) return 'Indiquez le motif de l\'avoir.'
  if (msg.includes('invalid_ice')) return 'ICE client invalide (15 chiffres).'
  return 'Erreur lors de l\'émission. Réessayez.'
}
