// "Récapitulatif" PDFs for the monthly administrative paperwork. These are
// working documents to copy onto / attach to the official forms — not the
// official forms themselves.
//
// jsPDF's Helvetica is WinAnsi-only: latin1() replaces anything it cannot draw
// (Arabic, Cyrillic, CJK names…) instead of printing garbage.

import type { jsPDF as JsPDF } from 'jspdf'
import { formatAmount } from '@/lib/invoicing'
import { touristTaxDue, type StayStats } from '@/lib/declarations'
import { formatISODate, todayISO } from '@/lib/dates'

const TEAL: [number, number, number] = [15, 110, 86]
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

export type DeclarationProperty = {
  name: string
  city: string | null
  address: string | null
  police_prefecture?: string | null
  legal_name?: string | null
  ice?: string | null
  if_number?: string | null
}

// WinAnsi covers Latin-1 plus a few typographic signs; everything else → "?".
const WIN_ANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'.split(''))
export function latin1(s: string | null | undefined): string {
  if (!s) return ''
  return [...s.normalize('NFC')].map((c) => (c.charCodeAt(0) <= 0xff || WIN_ANSI_EXTRA.has(c) ? c : '?')).join('')
}

export const monthLabel = (month: string) => {
  const [y, m] = month.split('-').map(Number)
  return `${MONTHS[m - 1]} ${y}`
}
const fr = (iso: string) => formatISODate(iso, { day: '2-digit', month: '2-digit', year: 'numeric' })

async function newDoc(orientation: 'p' | 'l' = 'p') {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  return { doc: new jsPDF({ unit: 'mm', format: 'a4', orientation }), autoTable }
}

function header(doc: JsPDF, title: string, subtitle: string, p: DeclarationProperty): number {
  const W = doc.internal.pageSize.getWidth()
  doc.setFont('helvetica', 'bold').setFontSize(15).setTextColor(...TEAL)
  doc.text(latin1(title), 14, 18)
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(90, 90, 90)
  doc.text(latin1(subtitle), 14, 24)
  doc.setTextColor(0, 0, 0).setFontSize(10)
  const left = [
    `Établissement : ${p.name}${p.legal_name && p.legal_name !== p.name ? ` (${p.legal_name})` : ''}`,
    [p.address, p.city].filter(Boolean).join(', '),
    [p.ice && `ICE : ${p.ice}`, p.if_number && `IF : ${p.if_number}`].filter(Boolean).join('   '),
  ].filter(Boolean)
  left.forEach((l, i) => doc.text(latin1(l), 14, 33 + i * 5))
  doc.setFontSize(9).setTextColor(120, 120, 120)
  doc.text(`Édité le ${fr(todayISO())}`, W - 14, 18, { align: 'right' })
  doc.setTextColor(0, 0, 0)
  return 33 + left.length * 5 + 4
}

function footerNote(doc: JsPDF, note: string) {
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(8).setTextColor(130, 130, 130).setFont('helvetica', 'normal')
    doc.text(latin1(note), 14, H - 10)
    if (pages > 1) doc.text(`${i} / ${pages}`, W - 14, H - 10, { align: 'right' })
  }
  doc.setTextColor(0, 0, 0)
}

/** Header and total rows follow the right alignment of numeric body columns. */
const alignNumericHeads = (d: { section: string; column: { index: number }; cell: { styles: { halign: string } } }) => {
  if (d.section !== 'body' && d.column.index > 0) d.cell.styles.halign = 'right'
}

function finalY(doc: JsPDF): number {
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
}

function provisionalLine(stats: StayStats): string | null {
  return stats.provisional ? `PROVISOIRE : mois en cours, nuitées comptées jusqu'au ${fr(stats.countedUntil)} inclus.` : null
}

// ── Taxe de séjour ──────────────────────────────────────────────────────────
export async function buildTouristTaxPdf(stats: StayStats, ratePerNight: number, p: DeclarationProperty): Promise<JsPDF> {
  const { doc, autoTable } = await newDoc()
  let y = header(doc, 'Récapitulatif taxe de séjour', `Période : ${monthLabel(stats.month)}`, p)
  const prov = provisionalLine(stats)
  if (prov) { doc.setFontSize(9.5).setTextColor(200, 90, 0).text(prov, 14, y); doc.setTextColor(0, 0, 0); y += 6 }

  autoTable(doc, {
    startY: y,
    head: [['', 'Arrivées', 'Nuitées', 'Taux (MAD)', 'Montant (MAD)']],
    body: [
      ['Résidents (Maroc)', String(stats.residents.arrivals), String(stats.residents.nights), formatAmount(ratePerNight), formatAmount(touristTaxDue(stats.residents.nights, ratePerNight))],
      ['Non-résidents', String(stats.nonResidents.arrivals), String(stats.nonResidents.nights), formatAmount(ratePerNight), formatAmount(touristTaxDue(stats.nonResidents.nights, ratePerNight))],
    ],
    foot: [['TOTAL', String(stats.arrivals), String(stats.nights), '', formatAmount(touristTaxDue(stats.nights, ratePerNight))]],
    styles: { fontSize: 10, cellPadding: 3 },
    headStyles: { fillColor: TEAL },
    footStyles: { fillColor: [235, 242, 239], textColor: 0, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
    didParseCell: alignNumericHeads,
    margin: { left: 14, right: 14 },
  })
  y = finalY(doc) + 10
  doc.setFontSize(9.5)
  const notes = [
    'Nuitée = une personne pour une nuit. Chaque nuit est comptée dans le mois où elle tombe.',
    'Base : séjours enregistrés (clients arrivés ou partis), nombre d\'adultes de chaque réservation.',
    'Résident = pays de résidence Maroc (à défaut : nationalité marocaine).',
    'Vérifiez les exonérations applicables (mineurs, etc.) auprès de votre commune avant de déclarer.',
  ]
  notes.forEach((n, i) => doc.text(latin1(`• ${n}`), 14, y + i * 5.5))
  y += notes.length * 5.5 + 12
  doc.text('Signature et cachet :', 14, y)
  doc.rect(14, y + 3, 70, 24)
  footerNote(doc, 'Document de travail généré par Sweet Reservation. Ne remplace pas le formulaire officiel.')
  return doc
}

// ── Tourism statistics (arrivals & nuitées by nationality) ─────────────────
export async function buildTourismStatsPdf(stats: StayStats, p: DeclarationProperty): Promise<JsPDF> {
  const { doc, autoTable } = await newDoc()
  let y = header(doc, 'Statistiques de fréquentation', `Arrivées et nuitées par nationalité : ${monthLabel(stats.month)}`, p)
  const prov = provisionalLine(stats)
  if (prov) { doc.setFontSize(9.5).setTextColor(200, 90, 0).text(prov, 14, y); doc.setTextColor(0, 0, 0); y += 6 }

  autoTable(doc, {
    startY: y,
    head: [['Nationalité', 'Arrivées', 'Nuitées', '% nuitées']],
    body: stats.byNationality.map((n) => [
      latin1(n.nationality), String(n.arrivals), String(n.nights),
      stats.nights > 0 ? `${((n.nights / stats.nights) * 100).toFixed(1).replace('.', ',')} %` : '-',
    ]),
    foot: [
      ['Résidents (Maroc)', String(stats.residents.arrivals), String(stats.residents.nights), ''],
      ['Non-résidents', String(stats.nonResidents.arrivals), String(stats.nonResidents.nights), ''],
      ['TOTAL', String(stats.arrivals), String(stats.nights), stats.nights > 0 ? '100 %' : '-'],
    ],
    showFoot: 'lastPage',
    styles: { fontSize: 9.5, cellPadding: 2.5 },
    headStyles: { fillColor: TEAL },
    footStyles: { fillColor: [235, 242, 239], textColor: 0, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    didParseCell: alignNumericHeads,
    margin: { left: 14, right: 14, bottom: 18 },
  })
  footerNote(doc, 'Arrivées : clients dont la date d\'arrivée tombe dans le mois. Nuitées : personnes × nuits passées dans le mois.')
  return doc
}

// ── Police register (registre des voyageurs) ───────────────────────────────
export type RegisterRow = {
  check_in_date: string
  check_out_date: string
  first_name: string | null
  last_name: string | null
  nationality: string | null
  document_type: string | null
  document_number: string | null
  date_of_birth: string | null
  gender: string | null
  profession: string | null
  country_of_residence: string | null
  next_destination: string | null
  bed: string | null
}

const DOC_LABELS: Record<string, string> = { passport: 'Passeport', cin: 'CIN', id_card: 'Carte ID' }

export async function buildPoliceRegisterPdf(rows: readonly RegisterRow[], p: DeclarationProperty, from: string, to: string, foreignOnly: boolean): Promise<JsPDF> {
  const { doc, autoTable } = await newDoc('l')
  const y = header(
    doc,
    'Registre des voyageurs',
    `Du ${fr(from)} au ${fr(to)}${foreignOnly ? ' (clients étrangers)' : ''} · ${rows.length} voyageur${rows.length > 1 ? 's' : ''}${p.police_prefecture ? ` · ${p.police_prefecture}` : ''}`,
    p,
  )
  autoTable(doc, {
    startY: y,
    head: [['N°', 'Arrivée', 'Départ', 'Nom et prénom', 'Né(e) le', 'Sexe', 'Nationalité', 'Document', 'N° document', 'Profession', 'Résidence', 'Destination', 'Lit']],
    body: rows.map((r, i) => [
      String(i + 1),
      fr(r.check_in_date),
      fr(r.check_out_date),
      latin1(`${(r.last_name ?? '').toUpperCase()} ${r.first_name ?? ''}`.trim()),
      r.date_of_birth ? fr(r.date_of_birth) : '-',
      r.gender ?? '-',
      latin1(r.nationality) || '-',
      DOC_LABELS[r.document_type ?? ''] ?? (r.document_type ?? '-'),
      latin1(r.document_number) || '-',
      latin1(r.profession) || '-',
      latin1(r.country_of_residence) || '-',
      latin1(r.next_destination) || '-',
      latin1(r.bed) || '-',
    ]),
    styles: { fontSize: 7.5, cellPadding: 1.6, overflow: 'linebreak' },
    headStyles: { fillColor: TEAL, fontSize: 7.5 },
    alternateRowStyles: { fillColor: [247, 247, 247] },
    columnStyles: { 0: { cellWidth: 8, halign: 'right' }, 1: { cellWidth: 18 }, 2: { cellWidth: 18 }, 3: { cellWidth: 40 }, 4: { cellWidth: 18 }, 5: { cellWidth: 10, halign: 'center' } },
    margin: { left: 10, right: 10, bottom: 16 },
  })
  footerNote(doc, 'Registre généré par Sweet Reservation à partir des fiches clients enregistrées.')
  return doc
}
