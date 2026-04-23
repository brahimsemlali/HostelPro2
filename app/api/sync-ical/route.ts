import { NextRequest, NextResponse } from 'next/server'
import { getRouteHandlerSession } from '@/lib/supabase/server'

interface IcalEvent {
  uid: string
  summary: string
  description: string
  start: string   // YYYY-MM-DD
  end: string     // YYYY-MM-DD
  status: string
}

function parseIcalDate(value: string): string {
  // DATE: YYYYMMDD  |  DATETIME: YYYYMMDDTHHMMSSZ
  const clean = value.replace(/[TZ].*/, '').replace(/[^0-9]/g, '').slice(0, 8)
  return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`
}

function parseIcal(text: string): IcalEvent[] {
  // Unfold continuation lines (RFC 5545)
  const unfolded = text.replace(/\r?\n[ \t]/g, '')
  const lines = unfolded.split(/\r?\n/)

  const events: IcalEvent[] = []
  let cur: Partial<IcalEvent> | null = null

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      cur = { uid: '', summary: '', description: '', start: '', end: '', status: 'CONFIRMED' }
    } else if (line === 'END:VEVENT' && cur) {
      if (cur.start && cur.end) events.push(cur as IcalEvent)
      cur = null
    } else if (cur) {
      const sep = line.indexOf(':')
      if (sep === -1) continue
      const prop = line.slice(0, sep).split(';')[0].toUpperCase()
      const val = line.slice(sep + 1)
        .replace(/\\n/g, ' ')
        .replace(/\\,/g, ',')
        .replace(/\\;/g, ';')
        .trim()

      if (prop === 'DTSTART')     cur.start = parseIcalDate(val)
      else if (prop === 'DTEND')  cur.end = parseIcalDate(val)
      else if (prop === 'SUMMARY')     cur.summary = val
      else if (prop === 'DESCRIPTION') cur.description = val
      else if (prop === 'UID')         cur.uid = val
      else if (prop === 'STATUS')      cur.status = val
    }
  }

  return events
}

function extractGuestName(summary: string): { first_name: string; last_name: string } | null {
  // Booking.com uses: "First Last" or "CLOSED" or "Blocked"
  const cleaned = summary.replace(/\(.*?\)/g, '').trim()
  if (!cleaned || /closed|blocked|unavailable|ferme/i.test(cleaned)) return null
  const parts = cleaned.split(/\s+/)
  if (parts.length === 0) return null
  const first_name = parts[0] ?? 'Inconnu'
  const last_name = parts.slice(1).join(' ') || '—'
  return { first_name, last_name }
}

function extractBookingRef(description: string, uid: string): string {
  // Try to extract reservation number from description
  const match = description.match(/(\d{8,12})/)
  if (match) return match[1]
  // Fall back to UID
  return uid.replace(/@.*/, '').replace(/[^a-zA-Z0-9-]/g, '')
}

export async function POST(req: NextRequest) {
  try {
    const session = await getRouteHandlerSession()
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { icalUrl } = await req.json() as { icalUrl: string }

    if (!icalUrl || !icalUrl.startsWith('http')) {
      return NextResponse.json({ error: 'URL invalide' }, { status: 400 })
    }

    // SSRF protection: only allow known OTA domains
    const ALLOWED_DOMAINS = [
      'booking.com', 'hostelworld.com', 'airbnb.com',
      'expedia.com', 'hotels.com', 'agoda.com',
    ]
    let parsedUrl: URL
    try {
      parsedUrl = new URL(icalUrl)
    } catch {
      return NextResponse.json({ error: 'URL invalide' }, { status: 400 })
    }
    const hostname = parsedUrl.hostname.toLowerCase()
    const isAllowed = ALLOWED_DOMAINS.some(d => hostname === d || hostname.endsWith(`.${d}`))
    if (!isAllowed) {
      return NextResponse.json({ error: 'Domaine non autorisé. Utilisez un lien iCal de Booking.com, Hostelworld ou Airbnb.' }, { status: 400 })
    }

    const response = await fetch(icalUrl, {
      headers: { 'User-Agent': 'HostelPro/1.0' },
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      return NextResponse.json({ error: `Impossible de récupérer le calendrier (${response.status})` }, { status: 400 })
    }

    const text = await response.text()

    if (!text.includes('BEGIN:VCALENDAR')) {
      return NextResponse.json({ error: 'Le lien ne contient pas un calendrier iCal valide' }, { status: 400 })
    }

    const events = parseIcal(text)

    const parsed = events.map((e) => {
      const guest = extractGuestName(e.summary)
      const ref = extractBookingRef(e.description, e.uid)
      const isBlocked = !guest
      return {
        uid: e.uid,
        external_booking_id: ref,
        check_in_date: e.start,
        check_out_date: e.end,
        guest_name: guest ? `${guest.first_name} ${guest.last_name}` : null,
        first_name: guest?.first_name ?? null,
        last_name: guest?.last_name ?? null,
        is_blocked: isBlocked,
        summary: e.summary,
      }
    }).filter((e) => e.check_in_date && e.check_out_date)

    return NextResponse.json({ events: parsed, total: parsed.length })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
