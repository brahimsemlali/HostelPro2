import type { Guest, Booking, Property, Payment, BookingExtra } from '@/types'

function formatMAD(amount: number): string {
  return new Intl.NumberFormat('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount) + ' MAD'
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export async function generateInvoice(
  guest: Guest,
  booking: Booking & { bed?: { name: string; room?: { name: string } | null } | null },
  property: Property,
  payments: Payment[],
  invoiceNumber?: string,
  extras?: BookingExtra[]
): Promise<void> {
  const { default: jsPDF } = await import('jspdf')

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 210
  const margin = 14
  const rightCol = W - margin

  const extrasTotal = extras?.reduce((s, e) => s + e.quantity * e.unit_price, 0) ?? 0
  const grandTotal = booking.total_price + extrasTotal
  const totalPaid = payments.filter(p => p.type !== 'refund').reduce((s, p) => s + p.amount, 0)
  const balance = grandTotal - totalPaid
  const invoiceNum = invoiceNumber ?? `INV-${new Date().getFullYear()}-${booking.id.slice(0, 6).toUpperCase()}`

  // ── Header band ──────────────────────────────────────────────
  doc.setFillColor(15, 110, 86) // teal
  doc.rect(0, 0, W, 38, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text(property.name, margin, 16)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  const propLines = [
    property.address ?? '',
    property.city ?? '',
    property.phone ? `Tél: ${property.phone}` : '',
    property.email ?? '',
  ].filter(Boolean)
  doc.text(propLines.join('  ·  '), margin, 24)

  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('FACTURE / REÇU', rightCol, 16, { align: 'right' })
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`N° ${invoiceNum}`, rightCol, 24, { align: 'right' })
  doc.text(`Date: ${fmtDate(new Date().toISOString())}`, rightCol, 30, { align: 'right' })

  // ── Billing info ─────────────────────────────────────────────
  doc.setTextColor(0, 0, 0)
  let y = 50

  doc.setFillColor(245, 247, 246)
  doc.roundedRect(margin, y, 85, 36, 3, 3, 'F')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(100, 100, 100)
  doc.text('FACTURÉ À', margin + 4, y + 7)
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text(`${guest.first_name} ${guest.last_name.toUpperCase()}`, margin + 4, y + 16)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80, 80, 80)
  if (guest.document_number) doc.text(`${guest.document_type?.toUpperCase()} ${guest.document_number}`, margin + 4, y + 23)
  if (guest.nationality) doc.text(guest.nationality, margin + 4, y + 30)

  // Stay summary box
  doc.setFillColor(245, 247, 246)
  doc.roundedRect(W - margin - 85, y, 85, 36, 3, 3, 'F')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(100, 100, 100)
  doc.text('DÉTAILS DU SÉJOUR', W - margin - 81, y + 7)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(0, 0, 0)

  const bed = booking.bed
  const bedLabel = bed ? `${bed.room?.name ?? ''} — ${bed.name}` : '—'
  doc.text(`Lit: ${bedLabel}`, W - margin - 81, y + 16)
  doc.text(`Arrivée: ${fmtDate(booking.check_in_date)}`, W - margin - 81, y + 22)
  doc.text(`Départ: ${fmtDate(booking.check_out_date)}`, W - margin - 81, y + 28)
  doc.text(`Durée: ${booking.nights} nuit${(booking.nights ?? 0) > 1 ? 's' : ''}`, W - margin - 81, y + 34)

  // ── Line items ────────────────────────────────────────────────
  y += 46

  // Header row
  doc.setFillColor(15, 110, 86)
  doc.rect(margin, y, W - 2 * margin, 8, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('Description', margin + 3, y + 5.5)
  doc.text('Qté', 130, y + 5.5, { align: 'center' })
  doc.text('Prix unitaire', 158, y + 5.5, { align: 'center' })
  doc.text('Total', rightCol - 2, y + 5.5, { align: 'right' })

  y += 8
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'normal')

  // Accommodation line
  doc.setFillColor(250, 250, 250)
  doc.rect(margin, y, W - 2 * margin, 9, 'F')
  doc.setFontSize(9)
  const pricePerNight = (booking.nights ?? 1) > 0 ? booking.total_price / (booking.nights ?? 1) : booking.total_price
  doc.text(`Hébergement — ${bedLabel}`, margin + 3, y + 6)
  doc.text(`${booking.nights}`, 130, y + 6, { align: 'center' })
  doc.text(formatMAD(pricePerNight), 158, y + 6, { align: 'center' })
  doc.text(formatMAD(booking.total_price), rightCol - 2, y + 6, { align: 'right' })

  y += 9

  // Extras line items
  if (extras && extras.length > 0) {
    extras.forEach((extra, i) => {
      doc.setFillColor(i % 2 === 0 ? 245 : 255, i % 2 === 0 ? 247 : 255, i % 2 === 0 ? 246 : 255)
      doc.rect(margin, y, W - 2 * margin, 9, 'F')
      doc.setFontSize(9)
      doc.setTextColor(0, 0, 0)
      doc.text(extra.name, margin + 3, y + 6)
      doc.text(`${extra.quantity}`, 130, y + 6, { align: 'center' })
      doc.text(formatMAD(extra.unit_price), 158, y + 6, { align: 'center' })
      doc.text(formatMAD(extra.quantity * extra.unit_price), rightCol - 2, y + 6, { align: 'right' })
      y += 9
    })
  }

  // Commission note (if any)
  if (booking.commission_rate > 0) {
    doc.setFillColor(255, 255, 255)
    doc.rect(margin, y, W - 2 * margin, 7, 'F')
    doc.setTextColor(120, 120, 120)
    doc.setFontSize(8)
    doc.text(`Commission ${booking.source} (${booking.commission_rate}%)`, margin + 3, y + 5)
    doc.text(`−${formatMAD(booking.total_price - booking.net_revenue)}`, rightCol - 2, y + 5, { align: 'right' })
    y += 7
  }

  // ── Totals ────────────────────────────────────────────────────
  y += 4
  doc.setDrawColor(220, 220, 220)
  doc.line(margin, y, rightCol, y)
  y += 5

  const totalsX = 140
  const totalsW = rightCol - totalsX

  const addTotalRow = (label: string, value: string, bold = false, color?: [number, number, number]) => {
    if (bold) doc.setFont('helvetica', 'bold')
    else doc.setFont('helvetica', 'normal')
    if (color) doc.setTextColor(...color)
    else doc.setTextColor(0, 0, 0)
    doc.setFontSize(bold ? 10 : 9)
    doc.text(label, totalsX, y)
    doc.text(value, rightCol - 2, y, { align: 'right' })
    y += 6
  }

  addTotalRow('Hébergement', formatMAD(booking.total_price))
  if (extrasTotal > 0) addTotalRow('Suppléments', formatMAD(extrasTotal))
  if (extrasTotal > 0) addTotalRow('Sous-total', formatMAD(grandTotal), false, [0, 0, 0])
  addTotalRow('Montant payé', formatMAD(totalPaid), false, [15, 110, 86])
  y += 1
  doc.setDrawColor(200, 200, 200)
  doc.line(totalsX, y, rightCol, y)
  y += 4
  addTotalRow(
    balance <= 0 ? 'SOLDE (Réglé ✓)' : 'SOLDE DÛ',
    balance <= 0 ? formatMAD(0) : formatMAD(balance),
    true,
    balance <= 0 ? [15, 110, 86] : [200, 50, 50]
  )

  // ── Payments detail ───────────────────────────────────────────
  if (payments.length > 0) {
    y += 8
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('Détail des paiements:', margin, y)
    y += 5

    const methodLabels: Record<string, string> = {
      cash: 'Espèces', virement: 'Virement bancaire', cmi: 'CMI / TPE', wave: 'Wave', other: 'Autre'
    }

    payments.filter(p => p.type !== 'refund').forEach((p) => {
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(80, 80, 80)
      doc.setFontSize(8.5)
      const dateStr = fmtDate(p.payment_date)
      const ref = p.reference ? ` (Réf: ${p.reference})` : ''
      doc.text(`${methodLabels[p.method] ?? p.method}${ref} — ${dateStr}`, margin + 3, y)
      doc.text(formatMAD(p.amount), rightCol - 2, y, { align: 'right' })
      y += 5
    })
  }

  // ── Footer ────────────────────────────────────────────────────
  const footerY = 270
  doc.setFillColor(15, 110, 86)
  doc.rect(0, footerY, W, 27, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Merci pour votre séjour !', W / 2, footerY + 9, { align: 'center' })
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(200, 240, 230)
  const contactLine = [property.phone, property.email].filter(Boolean).join('  ·  ')
  if (contactLine) doc.text(contactLine, W / 2, footerY + 17, { align: 'center' })

  doc.save(`facture-${guest.last_name.toLowerCase()}-${booking.id.slice(0, 6)}.pdf`)
}
