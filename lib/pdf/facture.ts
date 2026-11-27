// Legal invoice / credit note PDF, rendered ONLY from the immutable snapshot
// stored in `invoices` (never from live booking data), so a re-download years
// later prints exactly what was issued.
//
// Helvetica (jsPDF built-in) is WinAnsi-only: keep this document Latin-script
// and format numbers with formatAmount() (plain spaces), never Intl.

import type { jsPDF as JsPDF } from 'jspdf'
import { amountInFrenchWords, formatAmount, PAYMENT_METHOD_LABELS, type Invoice } from '@/lib/invoicing'

const TEAL: [number, number, number] = [15, 110, 86]
const GREY: [number, number, number] = [100, 100, 100]

function isoToFr(d: string | null | undefined): string {
  if (!d) return '-'
  const [y, m, day] = d.slice(0, 10).split('-')
  return `${day}/${m}/${y}`
}

const mad = (n: number) => `${formatAmount(n)} MAD`

/** City only when the address does not already end with / contain it. */
function cityIfMissing(address: string | null, city: string | null): string | null {
  if (!city) return null
  return address && address.toLowerCase().includes(city.trim().toLowerCase()) ? null : city
}

export async function buildFacturePdf(inv: Invoice): Promise<JsPDF> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 210, M = 14, R = W - M
  const isAvoir = inv.kind === 'credit_note'
  const s = inv.seller

  // ── Seller (top-left) ─────────────────────────────────────────
  doc.setTextColor(...TEAL)
  doc.setFont('helvetica', 'bold').setFontSize(16)
  doc.text(s.legal_name || s.name, M, 20)
  doc.setTextColor(60, 60, 60)
  doc.setFont('helvetica', 'normal').setFontSize(9)
  let y = 26
  const sellerLines = [
    s.legal_name && s.legal_name !== s.name ? `${s.name}${s.legal_form ? ` · ${s.legal_form}` : ''}` : s.legal_form,
    s.address, cityIfMissing(s.address, s.city),
    [s.phone && `Tél : ${s.phone}`, s.email].filter(Boolean).join('  ·  '),
  ].filter((l): l is string => !!l)
  for (const l of sellerLines) { doc.text(l, M, y); y += 4.5 }

  // ── Document title (top-right) ───────────────────────────────
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'bold').setFontSize(20)
  doc.text(isAvoir ? 'AVOIR' : 'FACTURE', R, 20, { align: 'right' })
  doc.setFont('helvetica', 'normal').setFontSize(10)
  doc.text(`N° ${inv.number}`, R, 27, { align: 'right' })
  doc.text(`Date : ${isoToFr(inv.issue_date)}`, R, 32, { align: 'right' })
  if (isAvoir && inv.credited_number) {
    doc.setFontSize(9)
    doc.text(`Annule la facture N° ${inv.credited_number}`, R, 37, { align: 'right' })
  }

  // ── Buyer + stay boxes ────────────────────────────────────────
  y = Math.max(y, 40) + 4
  const boxW = (W - 2 * M - 6) / 2
  const b = inv.buyer
  const buyerLines: [string, boolean][] = []
  if (b.company_name) {
    buyerLines.push([b.company_name, true])
    if (b.company_ice) buyerLines.push([`ICE : ${b.company_ice}`, false])
    if (b.company_address) buyerLines.push([b.company_address, false])
    buyerLines.push([`Occupant : ${b.name}`, false])
  } else {
    buyerLines.push([b.name, true])
  }
  if (b.document) buyerLines.push([b.document, false])
  if (b.nationality) buyerLines.push([b.nationality, false])

  const st = inv.stay
  const stayLines = [
    `Arrivée : ${isoToFr(st.check_in_date)}`,
    `Départ : ${isoToFr(st.check_out_date)}`,
    `${st.nights} nuit${st.nights > 1 ? 's' : ''} · ${st.adults} personne${st.adults > 1 ? 's' : ''}`,
    st.bed ? `Lit : ${st.bed}` : null,
    st.external_ref ? `Réf. réservation : ${st.external_ref}` : null,
  ].filter((l): l is string => !!l)

  const boxH = 10 + Math.max(buyerLines.length, stayLines.length) * 5
  doc.setFillColor(245, 247, 246)
  doc.roundedRect(M, y, boxW, boxH, 2, 2, 'F')
  doc.roundedRect(M + boxW + 6, y, boxW, boxH, 2, 2, 'F')
  doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(...GREY)
  doc.text('FACTURÉ À', M + 4, y + 6)
  doc.text('SÉJOUR', M + boxW + 10, y + 6)
  doc.setTextColor(0, 0, 0).setFontSize(9.5)
  buyerLines.forEach(([l, bold], i) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.text(doc.splitTextToSize(l, boxW - 8)[0], M + 4, y + 12 + i * 5)
  })
  doc.setFont('helvetica', 'normal')
  stayLines.forEach((l, i) => doc.text(l, M + boxW + 10, y + 12 + i * 5))
  y += boxH + 8

  // ── Lines ─────────────────────────────────────────────────────
  const showVat = inv.vat_registered
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, bottom: 30 }, // keep clear of the legal footer
    head: [showVat
      ? ['Désignation', 'Qté', 'P.U. TTC', 'TVA', 'Total HT', 'Total TTC']
      : ['Désignation', 'Qté', 'Prix unitaire', 'Total']],
    body: inv.lines.map((l) => showVat
      ? [l.label, String(l.quantity), formatAmount(l.unit_ttc), l.kind === 'tourist_tax' ? 'Hors TVA' : `${l.vat_rate} %`, formatAmount(l.total_ht), formatAmount(l.total_ttc)]
      : [l.label, String(l.quantity), formatAmount(l.unit_ttc), formatAmount(l.total_ttc)]),
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 2.2 },
    headStyles: { fillColor: TEAL, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    didParseCell: (d) => {
      if (d.section !== 'head' || d.column.index === 0) return
      const centered = d.column.index === 1 || (showVat && d.column.index === 3)
      d.cell.styles.halign = centered ? 'center' : 'right'
    },
    columnStyles: showVat
      ? { 1: { halign: 'center', cellWidth: 14 }, 2: { halign: 'right', cellWidth: 26 }, 3: { halign: 'center', cellWidth: 20 }, 4: { halign: 'right', cellWidth: 28 }, 5: { halign: 'right', cellWidth: 28 } }
      : { 1: { halign: 'center', cellWidth: 16 }, 2: { halign: 'right', cellWidth: 32 }, 3: { halign: 'right', cellWidth: 34 } },
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6

  // Every block below is drawn by hand: break to a new page before it would
  // run into the footer zone (y ≥ 270).
  const ensure = (h: number) => { if (y + h > 268) { doc.addPage(); y = 20 } }

  // ── Totals ────────────────────────────────────────────────────
  ensure(6 * (inv.vat_breakdown.length + 5))
  const tx = 118
  const row = (label: string, value: string, bold = false, color: [number, number, number] = [0, 0, 0]) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(bold ? 10.5 : 9.5).setTextColor(...color)
    doc.text(label, tx, y)
    doc.text(value, R, y, { align: 'right' })
    y += bold ? 7 : 5.5
  }
  if (showVat) {
    row('Total HT', mad(inv.total_ht))
    for (const v of inv.vat_breakdown) row(`TVA ${v.rate} %`, mad(v.tva))
  }
  if (inv.tourist_tax !== 0) row('Taxe de séjour', mad(inv.tourist_tax))
  doc.setDrawColor(200, 200, 200).line(tx, y - 3, R, y - 3)
  y += 1.5
  row(showVat ? 'TOTAL TTC' : 'TOTAL', mad(inv.total_ttc), true)
  if (!isAvoir) {
    row('Montant encaissé', mad(inv.amount_paid), false, TEAL)
    const due = Math.round((inv.total_ttc - inv.amount_paid) * 100) / 100
    if (due > 0) row('Reste à payer', mad(due), true, [200, 50, 50])
  }

  // ── Legal mentions ───────────────────────────────────────────
  y += 4
  doc.setTextColor(0, 0, 0).setFont('helvetica', 'normal').setFontSize(9)
  const words = `${isAvoir ? 'Arrêté le présent avoir' : 'Arrêtée la présente facture'} à la somme de : ${amountInFrenchWords(inv.total_ttc)}${showVat ? ' TTC' : ''}.`
  const wrapped = doc.splitTextToSize(words, W - 2 * M) as string[]
  ensure(wrapped.length * 4.5 + 2)
  doc.text(wrapped, M, y)
  y += wrapped.length * 4.5 + 2

  doc.setFontSize(8.5).setTextColor(...GREY)
  const mentions = [
    !showVat ? 'TVA non applicable : établissement non assujetti à la TVA.' : null,
    !isAvoir && inv.payment_methods.length > 0
      ? `Mode de règlement : ${inv.payment_methods.map((m) => PAYMENT_METHOD_LABELS[m] ?? m).join(', ')}.` : null,
    isAvoir && inv.notes ? `Motif : ${inv.notes}` : null,
    s.bank_details ? `Coordonnées bancaires : ${s.bank_details}` : null,
  ].filter((l): l is string => !!l)
  for (const m of mentions) {
    const lines = doc.splitTextToSize(m, W - 2 * M) as string[]
    ensure(lines.length * 4.2)
    doc.text(lines, M, y)
    y += lines.length * 4.2
  }

  // ── Footer: identifiers required on every invoice ────────────
  const ids = [
    s.ice && `ICE : ${s.ice}`, s.if_number && `IF : ${s.if_number}`, s.rc && `RC : ${s.rc}`,
    s.patente && `Patente : ${s.patente}`, s.cnss && `CNSS : ${s.cnss}`,
  ].filter(Boolean).join('  ·  ')
  const fy = 280
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setDrawColor(...TEAL).setLineWidth(0.4).line(M, fy - 5, R, fy - 5)
    doc.setFontSize(8).setTextColor(60, 60, 60).setFont('helvetica', 'normal')
    doc.text(`${s.legal_name || s.name}${s.address ? ` · ${s.address}` : ''}${cityIfMissing(s.address, s.city) ? `, ${s.city}` : ''}`, W / 2, fy, { align: 'center' })
    if (ids) doc.text(ids, W / 2, fy + 4.5, { align: 'center' })
    if (s.invoice_footer) doc.text(doc.splitTextToSize(s.invoice_footer, W - 2 * M)[0], W / 2, fy + 9, { align: 'center' })
    if (pages > 1) doc.text(`${inv.number} · page ${p}/${pages}`, R, fy + 13, { align: 'right' })
  }

  return doc
}

export async function downloadFacturePdf(inv: Invoice): Promise<void> {
  const doc = await buildFacturePdf(inv)
  doc.save(`${inv.number}.pdf`)
}
