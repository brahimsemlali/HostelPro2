'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { buildWhatsAppLink } from '@/lib/whatsapp/templates'
import { formatCurrency, formatDate, formatDateShort } from '@/lib/utils'
import { differenceInDays } from 'date-fns'
import type { Booking, Guest, Payment, Bed, Room } from '@/types'
import {
  User, Phone, MessageSquare, Calendar, CreditCard, FileText,
  MapPin, Briefcase, Globe, Navigation, Mail, Flag, BedDouble,
  AlertTriangle, ExternalLink, Clock, Users, Hash,
} from 'lucide-react'

// Full hydrated booking as returned from the detail fetch
export type FullBooking = Booking & {
  guest?: Guest | null
  bed?: (Bed & { room?: Room }) | null
}

interface Props {
  bookingId: string | null
  onClose: () => void
  isMobile?: boolean
}

function DetailRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <div className="mt-0.5 flex-shrink-0 w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center">
        <Icon className="w-3.5 h-3.5 text-slate-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">{label}</p>
        <p className="text-sm font-medium text-[#0A1F1C] leading-snug">{value}</p>
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 mt-5 mb-2 px-0.5">
      {children}
    </p>
  )
}

export function BookingDetailSheet({ bookingId, onClose, isMobile = false }: Props) {
  const [booking, setBooking] = useState<FullBooking | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    if (!bookingId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBooking(null)
      setPayments([])
      return
    }

    setLoading(true)

    Promise.all([
      supabase
        .from('bookings')
        .select('*, guest:guest_id(*), bed:bed_id(*, room:room_id(*))')
        .eq('id', bookingId)
        .single(),
      supabase
        .from('payments')
        .select('*')
        .eq('booking_id', bookingId)
        .order('payment_date', { ascending: false }),
    ]).then(([{ data: bk }, { data: pmts }]) => {
      if (bk) {
        const guest = Array.isArray(bk.guest) ? bk.guest[0] : bk.guest
        const bed = Array.isArray(bk.bed) ? bk.bed[0] : bk.bed
        if (bed) {
          const room = Array.isArray(bed.room) ? bed.room[0] : bed.room
          setBooking({ ...bk, guest, bed: { ...bed, room } })
        } else {
          setBooking({ ...bk, guest, bed: null })
        }
      }
      setPayments((pmts as Payment[]) ?? [])
      setLoading(false)
    })
  }, [bookingId])

  const guest = booking?.guest ?? null
  const bed = booking?.bed ?? null
  const room = bed?.room ?? null

  const amountPaid = payments.reduce(
    (s, p) => s + (p.type !== 'refund' ? p.amount : -p.amount),
    0,
  )
  const balance = booking ? booking.total_price - amountPaid : 0
  const daysLeft = booking
    ? differenceInDays(new Date(booking.check_out_date), new Date())
    : 0

  const docTypeLabel: Record<string, string> = {
    passport: 'Passeport',
    cin: 'CIN',
    id_card: 'Carte d’identité',
  }

  const sourceLabel: Record<string, string> = {
    direct: 'Direct',
    booking_com: 'Booking.com',
    hostelworld: 'Hostelworld',
    airbnb: 'Airbnb',
    phone: 'Téléphone',
    walkin: 'Walk-in',
  }

  const statusLabel: Record<string, string> = {
    pending: 'En attente',
    confirmed: 'Confirmé',
    checked_in: 'Checké in',
    checked_out: 'Checké out',
    cancelled: 'Annulé',
    no_show: 'No-show',
  }

  const statusColor: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700 border-amber-200',
    confirmed: 'bg-blue-100 text-blue-700 border-blue-200',
    checked_in: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    checked_out: 'bg-slate-100 text-slate-600 border-slate-200',
    cancelled: 'bg-red-100 text-red-600 border-red-200',
    no_show: 'bg-red-100 text-red-600 border-red-200',
  }

  const methodLabel: Record<string, string> = {
    cash: 'Espèces',
    virement: 'Virement',
    cmi: 'CMI',
    wave: 'Wave',
    other: 'Autre',
  }

  return (
    <Sheet open={!!bookingId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={[
          'overflow-y-auto',
          isMobile ? 'rounded-t-2xl max-h-[92vh]' : 'max-w-[420px]',
        ].join(' ')}
      >
        <SheetHeader className="pb-1">
          <SheetTitle className="text-base font-black text-[#0A1F1C]">
            {loading ? 'Chargement…' : guest ? `${guest.first_name} ${guest.last_name}` : 'Réservation'}
          </SheetTitle>
          <SheetDescription className="sr-only">
            {booking ? `Réservation de ${guest?.first_name ?? ''}` : 'Détails de la réservation'}
          </SheetDescription>
          <div className="flex items-center gap-2 flex-wrap mt-1">
            {booking && (
              <Badge className={['text-xs border', statusColor[booking.status] ?? ''].join(' ')}>
                {statusLabel[booking.status] ?? booking.status}
              </Badge>
            )}
            {booking?.source && (
              <Badge variant="outline" className="text-xs">
                {sourceLabel[booking.source] ?? booking.source}
              </Badge>
            )}
            {guest?.is_flagged && (
              <Badge className="text-xs bg-red-100 text-red-700 border border-red-200 gap-1">
                <AlertTriangle className="w-3 h-3" /> Signalé
              </Badge>
            )}
          </div>
        </SheetHeader>

        {loading && (
          <div className="mt-4 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-xl" />
            ))}
          </div>
        )}

        {!loading && booking && (
          <div className="mt-4 space-y-0 pb-6">
            {/* ── Flag warning ── */}
            {guest?.is_flagged && guest.flag_reason && (
              <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex gap-3 items-start">
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-red-700 mb-0.5">Client signalé</p>
                  <p className="text-xs text-red-600">{guest.flag_reason}</p>
                </div>
              </div>
            )}

            {/* ── Quick contact actions ── */}
            {guest && (
              <div className="flex gap-2 mb-4">
                {guest.phone && (
                  <a href={`tel:${guest.phone}`} className="flex-1">
                    <Button variant="outline" className="w-full h-10 text-sm gap-2">
                      <Phone className="w-3.5 h-3.5" />
                      Appeler
                    </Button>
                  </a>
                )}
                {(guest.whatsapp ?? guest.phone) && (
                  <a
                    href={buildWhatsAppLink(guest.whatsapp ?? guest.phone ?? '', '')}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1"
                  >
                    <Button variant="outline" className="w-full h-10 text-sm gap-2 text-[#25D366] border-[#25D366]/30">
                      <MessageSquare className="w-3.5 h-3.5" />
                      WhatsApp
                    </Button>
                  </a>
                )}
                {guest.id && (
                  <Link href={`/guests/${guest.id}`}>
                    <Button variant="outline" className="h-10 w-10 p-0" title="Voir profil complet">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                )}
              </div>
            )}

            {/* ─────────── STAY ─────────── */}
            <SectionTitle>Séjour</SectionTitle>
            <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden">
              {/* Timeline bar */}
              <div className="grid grid-cols-3 divide-x divide-slate-100 bg-slate-50/60">
                <div className="flex flex-col items-center py-3 px-2">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Arrivée</p>
                  <p className="text-sm font-black text-[#0A1F1C]">{formatDateShort(booking.check_in_date)}</p>
                  {booking.check_in_time && (
                    <p className="text-[10px] text-slate-400 mt-0.5">{booking.check_in_time.slice(11, 16)}</p>
                  )}
                </div>
                <div className="flex flex-col items-center py-3 px-2 bg-[#0F6E56] text-white">
                  <Calendar className="w-3.5 h-3.5 opacity-70 mb-1" />
                  <p className="text-base font-black leading-none">{booking.nights}</p>
                  <p className="text-[9px] opacity-70 mt-0.5">{booking.nights !== 1 ? 'nuits' : 'nuit'}</p>
                </div>
                <div className={['flex flex-col items-center py-3 px-2', daysLeft <= 1 ? 'bg-red-50' : ''].join(' ')}>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Départ</p>
                  <p className={['text-sm font-black', daysLeft <= 1 ? 'text-red-600' : 'text-[#0A1F1C]'].join(' ')}>
                    {formatDateShort(booking.check_out_date)}
                  </p>
                  {daysLeft === 0 && <p className="text-[9px] text-red-500 font-bold mt-0.5">Aujourd&apos;hui</p>}
                  {daysLeft > 0 && <p className="text-[9px] text-slate-400 mt-0.5">dans {daysLeft}j</p>}
                  {booking.check_out_time && (
                    <p className="text-[10px] text-slate-400 mt-0.5">{booking.check_out_time.slice(11, 16)}</p>
                  )}
                </div>
              </div>

              {/* Stay details */}
              <div className="px-4 py-1">
                <DetailRow icon={BedDouble} label="Lit" value={bed ? `${bed.name}${room ? ` — ${room.name}` : ''}` : '—'} />
                <DetailRow icon={Users} label="Adultes" value={booking.adults > 1 ? String(booking.adults) : null} />
                <DetailRow icon={Hash} label="Réf. externe" value={booking.external_booking_id} />
                <DetailRow icon={Clock} label="Arrivée prévue" value={booking.expected_arrival_time} />
                {booking.special_requests && (
                  <DetailRow icon={FileText} label="Demandes spéciales" value={booking.special_requests} />
                )}
                {booking.internal_notes && (
                  <DetailRow icon={FileText} label="Notes internes" value={booking.internal_notes} />
                )}
                {booking.arrival_notes && (
                  <DetailRow icon={FileText} label="Notes d&apos;arrivée" value={booking.arrival_notes} />
                )}
              </div>
            </div>

            {/* ─────────── GUEST IDENTITY ─────────── */}
            {guest && (
              <>
                <SectionTitle>Identité</SectionTitle>
                <div className="rounded-2xl border border-slate-100 bg-white px-4 py-1">
                  <DetailRow
                    icon={User}
                    label="Nom complet"
                    value={`${guest.last_name.toUpperCase()} ${guest.first_name}`}
                  />
                  <DetailRow
                    icon={Flag}
                    label="Nationalité"
                    value={guest.nationality}
                  />
                  <DetailRow
                    icon={User}
                    label="Genre"
                    value={guest.gender === 'M' ? 'Masculin' : guest.gender === 'F' ? 'Féminin' : null}
                  />
                  <DetailRow
                    icon={Calendar}
                    label="Date de naissance"
                    value={guest.date_of_birth ? formatDate(guest.date_of_birth) : null}
                  />
                  <DetailRow
                    icon={FileText}
                    label={docTypeLabel[guest.document_type] ?? guest.document_type}
                    value={guest.document_number}
                  />
                  <DetailRow icon={Briefcase} label="Profession" value={guest.profession} />
                  <DetailRow icon={Globe} label="Pays de résidence" value={guest.country_of_residence} />
                </div>

                {/* ─────────── CONTACT ─────────── */}
                <SectionTitle>Contact</SectionTitle>
                <div className="rounded-2xl border border-slate-100 bg-white px-4 py-1">
                  <DetailRow icon={Phone} label="Téléphone" value={guest.phone} />
                  <DetailRow icon={MessageSquare} label="WhatsApp" value={guest.whatsapp !== guest.phone ? guest.whatsapp : null} />
                  <DetailRow icon={Mail} label="Email" value={guest.email} />
                </div>

                {/* ─────────── MOROCCO INFO ─────────── */}
                {(guest.address_in_morocco ?? guest.next_destination) && (
                  <>
                    <SectionTitle>Séjour au Maroc</SectionTitle>
                    <div className="rounded-2xl border border-slate-100 bg-white px-4 py-1">
                      <DetailRow icon={MapPin} label="Adresse au Maroc" value={guest.address_in_morocco} />
                      <DetailRow icon={Navigation} label="Prochaine destination" value={guest.next_destination} />
                    </div>
                  </>
                )}

                {/* ─────────── HISTORY ─────────── */}
                <SectionTitle>Historique</SectionTitle>
                <div className="rounded-2xl border border-slate-100 bg-white px-4 py-1">
                  <DetailRow icon={Calendar} label="Séjours totaux" value={String(guest.total_stays)} />
                  <DetailRow icon={CreditCard} label="Total dépensé" value={guest.total_spent > 0 ? formatCurrency(guest.total_spent) : null} />
                  {guest.notes && <DetailRow icon={FileText} label="Notes client" value={guest.notes} />}
                </div>
              </>
            )}

            {/* ─────────── FINANCIAL ─────────── */}
            <SectionTitle>Finances</SectionTitle>
            <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden">
              <div className="px-4 py-3 space-y-2 border-b border-slate-100">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Total séjour</span>
                  <span className="text-sm font-bold text-[#0A1F1C]">{formatCurrency(booking.total_price)}</span>
                </div>
                {booking.commission_rate > 0 && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-400">Commission ({booking.commission_rate}%)</span>
                      <span className="text-xs text-slate-400">−{formatCurrency(booking.total_price * booking.commission_rate / 100)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500">Revenu net</span>
                      <span className="text-xs font-semibold text-[#0F6E56]">{formatCurrency(booking.net_revenue)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Encaissé</span>
                  <span className="text-sm font-bold text-[#0F6E56]">{formatCurrency(amountPaid)}</span>
                </div>
                {balance > 0.01 ? (
                  <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                    <span className="text-sm font-bold text-red-600">Solde dû</span>
                    <span className="text-sm font-black text-red-600">{formatCurrency(balance)}</span>
                  </div>
                ) : amountPaid > 0 ? (
                  <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                    <span className="text-sm font-bold text-[#0F6E56]">Soldé ✓</span>
                  </div>
                ) : null}
              </div>

              {/* Payments list */}
              {payments.length > 0 && (
                <div className="divide-y divide-slate-50">
                  {payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between px-4 py-2.5 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex-shrink-0 w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center">
                          <CreditCard className="w-3 h-3 text-slate-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#0A1F1C] truncate">
                            {methodLabel[p.method] ?? p.method}
                            {p.type === 'deposit' ? ' (acompte)' : p.type === 'refund' ? ' (remboursement)' : ''}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {new Date(p.payment_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                            {p.reference && ` · ${p.reference}`}
                          </p>
                        </div>
                      </div>
                      <span className={['text-sm font-bold flex-shrink-0', p.type === 'refund' ? 'text-red-500' : 'text-[#0A1F1C]'].join(' ')}>
                        {p.type === 'refund' ? '−' : '+'}{formatCurrency(p.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ─────────── POLICE FICHE ─────────── */}
            {booking.police_fiche_generated && (
              <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 flex items-center gap-3">
                <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="text-xs text-slate-600 flex-1">Fiche de police générée</span>
                {booking.police_fiche_url && (
                  <a href={booking.police_fiche_url} target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm" className="h-7 text-xs">Voir</Button>
                  </a>
                )}
              </div>
            )}

            {/* ─────────── LINKS ─────────── */}
            <div className="flex gap-2 mt-4">
              {guest?.id && (
                <Link href={`/guests/${guest.id}`} className="flex-1">
                  <Button variant="outline" className="w-full gap-2 h-10 text-sm">
                    <User className="w-3.5 h-3.5" />
                    Profil complet
                  </Button>
                </Link>
              )}
              {booking.id && (
                <Link href={`/bookings/${booking.id}`} className="flex-1">
                  <Button variant="outline" className="w-full gap-2 h-10 text-sm">
                    <FileText className="w-3.5 h-3.5" />
                    Réservation
                  </Button>
                </Link>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
