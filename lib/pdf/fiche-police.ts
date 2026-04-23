import type { Guest, Booking, Property } from '@/types'

type PropertyForPdf = Pick<Property, 'name' | 'city' | 'police_prefecture'>

// ─── helpers ─────────────────────────────────────────────────────────────────

function frDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function todayFr(): string {
  return new Date().toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function todayCompact(): string {
  return new Date().toLocaleDateString('fr-FR').replace(/\//g, '')
}

function genderLabel(gender: string | null | undefined): string {
  if (gender === 'M') return 'Masculin'
  if (gender === 'F') return 'Féminin'
  return '-'
}

function buildTableBody(guest: Guest, booking: Booking) {
  return [
    ['Nom complet',          `${(guest.last_name ?? '').toUpperCase()} ${guest.first_name ?? ''}`],
    ['Date de naissance',    guest.date_of_birth ? frDate(guest.date_of_birth) : '-'],
    ['Nationalité',          guest.nationality ?? '-'],
    ['Type de document',     (guest.document_type ?? '-').toUpperCase()],
    ['N° de document',       guest.document_number ?? '-'],
    ['Sexe',                 genderLabel(guest.gender)],
    ['Profession',           guest.profession ?? '-'],
    ['Pays de résidence',    guest.country_of_residence ?? '-'],
    ['Adresse au Maroc',     guest.address_in_morocco ?? '-'],
    ['Destination suivante', guest.next_destination ?? '-'],
    ['Date d\'arrivée',      frDate(booking.check_in_date)],
    ['Date de départ prévue',frDate(booking.check_out_date)],
  ]
}

function drawHeader(doc: InstanceType<typeof import('jspdf').default>, property: PropertyForPdf) {
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  // French only — jsPDF Helvetica has no Arabic glyphs
  doc.text('FICHE DE POLICE', 105, 20, { align: 'center' })

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100)
  doc.text('Formulaire d\'enregistrement des voyageurs — Royaume du Maroc', 105, 27, { align: 'center' })
  doc.setTextColor(0)

  doc.setFontSize(11)
  doc.text(`Établissement : ${property.name}`,                                          14, 38)
  doc.text(`Date : ${todayFr()}`,                                                       14, 45)
  doc.text(`Préfecture / Arrondissement : ${property.police_prefecture ?? property.city ?? ''}`, 14, 52)
}

// ─── single fiche ─────────────────────────────────────────────────────────────

export async function generateFicheDePolice(
  guest: Guest,
  booking: Booking,
  property: PropertyForPdf,
): Promise<void> {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF()

  drawHeader(doc, property)

  autoTable(doc, {
    startY: 60,
    head: [['Champ', 'Information']],
    body: buildTableBody(guest, booking),
    styles: {
      fontSize: 10,
      cellPadding: { top: 4, right: 6, bottom: 4, left: 6 },
    },
    headStyles: {
      fillColor: [15, 110, 86],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 10,
    },
    alternateRowStyles: { fillColor: [247, 247, 247] },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60, textColor: [40, 40, 40] } },
    margin: { left: 14, right: 14 },
  })

  // Signature + stamp zone
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = (doc as any).lastAutoTable.finalY + 18

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Signature du responsable :', 14, finalY)
  doc.rect(14, finalY + 4, 70, 22)

  doc.text('Cachet de l\'établissement :', 105, finalY)
  doc.rect(105, finalY + 4, 70, 22)

  doc.save(`fiche-police-${(guest.last_name ?? 'client').replace(/\s+/g, '-')}-${todayCompact()}.pdf`)
}

// ─── batch fiche (night audit) ────────────────────────────────────────────────

export async function generateBatchFiches(
  guests: { guest: Guest; booking: Booking }[],
  property: PropertyForPdf,
): Promise<void> {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF()

  for (let i = 0; i < guests.length; i++) {
    if (i > 0) doc.addPage()

    const { guest, booking } = guests[i]

    drawHeader(doc, property)

    autoTable(doc, {
      startY: 60,
      head: [['Champ', 'Information']],
      body: buildTableBody(guest, booking),
      styles: {
        fontSize: 10,
        cellPadding: { top: 4, right: 6, bottom: 4, left: 6 },
      },
      headStyles: {
        fillColor: [15, 110, 86],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 10,
      },
      alternateRowStyles: { fillColor: [247, 247, 247] },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60, textColor: [40, 40, 40] } },
      margin: { left: 14, right: 14 },
    })

    // Page number
    doc.setFontSize(9)
    doc.setTextColor(150)
    doc.text(`${i + 1} / ${guests.length}`, 196, 290, { align: 'right' })
    doc.setTextColor(0)
  }

  doc.save(`rapport-police-${todayCompact()}.pdf`)
}
