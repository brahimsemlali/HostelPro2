'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency, formatDateShort } from '@/lib/utils'
import { BOOKING_SOURCES } from '@/lib/constants'
import { buildWhatsAppLink } from '@/lib/whatsapp/templates'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  MessageSquare, Phone, Copy, Mail, ArrowLeft, Star, Flag, ShieldAlert,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/app/context/LanguageContext'

// ── Nationality → flag emoji ─────────────────────────────────────────────────
const NATIONALITY_FLAGS: Record<string, string> = {
  'Marocaine':       '🇲🇦', 'Française':      '🇫🇷', 'Espagnole':      '🇪🇸',
  'Allemande':       '🇩🇪', 'Italienne':      '🇮🇹', 'Portugaise':     '🇵🇹',
  'Britannique':     '🇬🇧', 'Américaine':     '🇺🇸', 'Canadienne':     '🇨🇦',
  'Belge':           '🇧🇪', 'Suisse':         '🇨🇭', 'Néerlandaise':   '🇳🇱',
  'Suédoise':        '🇸🇪', 'Norvégienne':    '🇳🇴', 'Danoise':        '🇩🇰',
  'Finlandaise':     '🇫🇮', 'Polonaise':      '🇵🇱', 'Russe':          '🇷🇺',
  'Algérienne':      '🇩🇿', 'Tunisienne':     '🇹🇳', 'Égyptienne':     '🇪🇬',
  'Sénégalaise':     '🇸🇳', 'Ivoirienne':     '🇨🇮', 'Nigériane':      '🇳🇬',
  'Sud-africaine':   '🇿🇦', 'Brésilienne':    '🇧🇷', 'Argentine':      '🇦🇷',
  'Mexicaine':       '🇲🇽', 'Japonaise':      '🇯🇵', 'Chinoise':       '🇨🇳',
  'Coréenne':        '🇰🇷', 'Indienne':       '🇮🇳', 'Australienne':   '🇦🇺',
  'Néo-zélandaise':  '🇳🇿',
}

function nationalityFlag(nationality: string | null | undefined): string {
  if (!nationality) return '🌍'
  return NATIONALITY_FLAGS[nationality] ?? '🌍'
}

// ── Types ────────────────────────────────────────────────────────────────────
interface GuestRecord {
  id: string
  first_name: string
  last_name: string
  nationality: string | null
  document_type: string
  document_number: string | null
  date_of_birth: string | null
  gender: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  country_of_residence: string | null
  profession: string | null
  notes: string | null
  total_stays: number
  total_spent: number
  is_flagged: boolean
  flag_reason: string | null
}

interface BookingRecord {
  id: string
  check_in_date: string
  check_out_date: string
  nights: number | null
  status: string
  source: string
  total_price: number
  bed: { name: string; room: { name: string } | null } | null
}

interface Props {
  guest: GuestRecord
  bookings: BookingRecord[]
  amountPaidByBooking: Record<string, number>
  totalPaid: number
}

// ── Status config (labels computed inside component via t()) ──────────────────
const statusStyles: Record<string, { dot: string; badge: string; labelKey: string }> = {
  pending:    { dot: 'bg-yellow-400', badge: 'bg-yellow-100 text-yellow-700', labelKey: 'bookings.status.pending' },
  confirmed:  { dot: 'bg-blue-400',   badge: 'bg-blue-100 text-blue-700',     labelKey: 'bookings.status.confirmed' },
  checked_in: { dot: 'bg-[#0F6E56]',  badge: 'bg-[#0F6E56]/10 text-[#0F6E56]', labelKey: 'bookings.status.checked_in' },
  checked_out:{ dot: 'bg-gray-400',   badge: 'bg-gray-100 text-gray-600',     labelKey: 'bookings.status.checked_out' },
  cancelled:  { dot: 'bg-red-400',    badge: 'bg-red-100 text-red-700',       labelKey: 'bookings.status.cancelled' },
  no_show:    { dot: 'bg-amber-400',  badge: 'bg-amber-100 text-amber-700',   labelKey: 'bookings.status.no_show' },
}

const sourceColors: Record<string, string> = {
  direct:      'bg-[#0F6E56]/10 text-[#0F6E56]',
  booking_com: 'bg-blue-100 text-blue-700',
  hostelworld: 'bg-purple-100 text-purple-700',
  airbnb:      'bg-rose-100 text-rose-700',
  phone:       'bg-gray-100 text-gray-600',
  walkin:      'bg-amber-100 text-amber-700',
}

// ── Component ────────────────────────────────────────────────────────────────
export function GuestDetailClient({ guest, bookings, amountPaidByBooking, totalPaid }: Props) {
  const t = useT()
  const statusConfig: Record<string, { label: string; dot: string; badge: string }> = Object.fromEntries(
    Object.entries(statusStyles).map(([k, v]) => [k, { label: t(v.labelKey), dot: v.dot, badge: v.badge }])
  )
  const [notes, setNotes] = useState(guest.notes ?? '')
  const [savingNotes, setSavingNotes] = useState(false)
  const [isFlagged, setIsFlagged] = useState(guest.is_flagged)
  const [flagReason, setFlagReason] = useState(guest.flag_reason ?? '')
  const [flagDialog, setFlagDialog] = useState(false)
  const [flagInput, setFlagInput] = useState('')
  const [flagging, setFlagging] = useState(false)

  async function handleFlag() {
    setFlagging(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('guests')
        .update({ is_flagged: true, flag_reason: flagInput || null })
        .eq('id', guest.id)
      if (error) throw error
      setIsFlagged(true)
      setFlagReason(flagInput)
      setFlagDialog(false)
      toast.success(t('guest.flagged'))
    } catch { toast.error(t('guest.flagError')) }
    finally { setFlagging(false) }
  }

  async function handleUnflag() {
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('guests')
        .update({ is_flagged: false, flag_reason: null })
        .eq('id', guest.id)
      if (error) throw error
      setIsFlagged(false)
      setFlagReason('')
      toast.success(t('guest.unflagged'))
    } catch { toast.error(t('common.error')) }
  }

  const staysCount = bookings.filter(
    (b) => b.status !== 'cancelled' && b.status !== 'no_show',
  ).length
  const isLoyal = staysCount >= 3
  const flag = nationalityFlag(guest.nationality)

  const currentStay = bookings.find((b) => b.status === 'checked_in')

  // ── Handlers ────────────────────────────────────────────────────────────
  async function handleNotesBlur() {
    setSavingNotes(true)
    try {
      const supabase = createClient()
      await supabase
        .from('guests')
        .update({ notes: notes || null })
        .eq('id', guest.id)
      toast.success(t('guest.notesSaved'))
    } catch {
      toast.error(t('guest.notesSaveError'))
    } finally {
      setSavingNotes(false)
    }
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`${label} ${t('common.copied')}`)
    }).catch(() => {
      toast.error(t('guest.copyError'))
    })
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-3xl mx-auto bg-[#F4F6F8] min-h-full hp-page-in">

      {/* ── Back ── */}
      <Link href="/guests">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="w-4 h-4 mr-1" />
          {t('nav.guests')}
        </Button>
      </Link>

      {/* ── Flagged alert banner ── */}
      {isFlagged && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <ShieldAlert className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-700">{t('guest.flaggedAlert')}</p>
            {flagReason && <p className="text-xs text-red-600 mt-0.5">{flagReason}</p>}
          </div>
          <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-100 text-xs h-7"
            onClick={handleUnflag}>
            {t('guest.removeFlag')}
          </Button>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-start gap-4">
        <div className={cn(
          'w-16 h-16 rounded-2xl text-xl font-semibold flex items-center justify-center flex-shrink-0',
          isFlagged ? 'bg-red-100 text-red-600' : 'bg-[#0F6E56]/10 text-[#0F6E56]'
        )}>
          {guest.first_name?.[0] ?? '?'}{guest.last_name?.[0] ?? ''}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-xl font-medium">
              {guest.first_name} {guest.last_name.toUpperCase()}
            </h1>
            <span className="text-xl" title={guest.nationality ?? ''}>{flag}</span>
          </div>
          <p className="text-sm text-muted-foreground mb-2">
            {guest.nationality ?? '—'} · {guest.document_type?.toUpperCase()} {guest.document_number ?? ''}
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="text-xs font-normal">
              {staysCount} {t('guests.stays')}
            </Badge>
            <Badge variant="outline" className="text-xs font-normal text-[#0F6E56] border-[#0F6E56]/30">
              {formatCurrency(totalPaid)} {t('guest.spent')}
            </Badge>
            {isLoyal && !isFlagged && (
              <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 gap-1">
                <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                {t('guest.loyal')}
              </Badge>
            )}
            {isFlagged && (
              <Badge className="text-xs bg-red-100 text-red-700 border-red-200 hover:bg-red-100 gap-1">
                <Flag className="w-3 h-3" />
                {t('guests.flagged')}
              </Badge>
            )}
            {currentStay && (
              <Badge className="text-xs bg-[#0F6E56]/10 text-[#0F6E56] hover:bg-[#0F6E56]/10">
                {t('guest.currentlyStaying')}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* ── Contact section ── */}
      <Card className="bg-white border border-[#E8ECF0] rounded-[16px] shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-[11px] font-semibold uppercase tracking-widest text-[#94A3B8]">{t('guest.contact')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {(guest.whatsapp ?? guest.phone) && (
              <a
                href={buildWhatsAppLink((guest.whatsapp ?? guest.phone)!, '')}
                target="_blank"
                rel="noreferrer"
              >
                <Button variant="outline" className="h-10 text-[#25D366] border-[#25D366]/30 hover:bg-[#25D366]/5">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  {t('nav.whatsapp')}
                </Button>
              </a>
            )}
            {guest.phone && (
              <a href={`tel:${guest.phone}`}>
                <Button variant="outline" className="h-10">
                  <Phone className="w-4 h-4 mr-2" />
                  {t('guest.call')}
                </Button>
              </a>
            )}
            {guest.phone && (
              <Button
                variant="outline"
                className="h-10"
                onClick={() => copyToClipboard(guest.phone!, t('common.phone'))}
              >
                <Copy className="w-4 h-4 mr-2" />
                {t('guest.copyPhone')}
              </Button>
            )}
            {guest.email && (
              <Button
                variant="outline"
                className="h-10"
                onClick={() => copyToClipboard(guest.email!, t('common.email'))}
              >
                <Mail className="w-4 h-4 mr-2" />
                {t('guest.copyEmail')}
              </Button>
            )}
            {!guest.phone && !guest.whatsapp && !guest.email && (
              <p className="text-sm text-muted-foreground">{t('guest.noContact')}</p>
            )}
          </div>
          <div className="mt-3 pt-3 border-t">
            {!isFlagged ? (
              <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 text-xs"
                onClick={() => { setFlagInput(''); setFlagDialog(true) }}>
                <Flag className="w-3.5 h-3.5 mr-1.5" />
                {t('guest.flagGuest')}
              </Button>
            ) : (
              <Button size="sm" variant="ghost" className="text-muted-foreground hover:bg-muted h-8 text-xs"
                onClick={handleUnflag}>
                {t('guest.removeFlag')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Personal info ── */}
      <Card className="bg-white border border-[#E8ECF0] rounded-[16px] shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-[11px] font-semibold uppercase tracking-widest text-[#94A3B8]">{t('guest.personalInfo')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {[
            [t('checkin.step2.dob'), guest.date_of_birth ? formatDateShort(guest.date_of_birth) : '—'],
            [t('checkin.step2.gender'), guest.gender === 'M' ? t('checkin.gender.male') : guest.gender === 'F' ? t('checkin.gender.female') : '—'],
            [t('checkin.step2.residence'), guest.country_of_residence ?? '—'],
            [t('checkin.step2.profession'), guest.profession ?? '—'],
            [t('common.phone'), guest.phone ?? '—'],
            [t('common.email'), guest.email ?? '—'],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4">
              <span className="text-[#475569] flex-shrink-0">{label}</span>
              <span className="font-medium text-right truncate text-[#0A1F1C]">{value}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── Stays timeline ── */}
      <div className="space-y-3">
        <h2 className="text-[12px] font-semibold uppercase tracking-widest text-[#94A3B8] px-1">
          {t('guest.stayHistory')}
          <span className="text-[#94A3B8] font-normal ml-2">({bookings.length})</span>
        </h2>

        {bookings.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-sm text-muted-foreground">{t('guest.noStays')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[11px] top-3 bottom-3 w-px bg-border" />

            <div className="space-y-3">
              {bookings.map((b) => {
                const bed = b.bed
                const status = statusConfig[b.status] ?? { label: b.status, dot: 'bg-gray-400', badge: 'bg-gray-100 text-gray-600' }
                const paid = amountPaidByBooking[b.id] ?? 0
                const balance = b.total_price - paid

                return (
                  <div key={b.id} className="flex gap-4">
                    {/* Timeline dot */}
                    <div className="flex flex-col items-center flex-shrink-0 pt-3.5">
                      <div className={cn('w-[10px] h-[10px] rounded-full z-10 ring-2 ring-background', status.dot)} />
                    </div>

                    {/* Card */}
                    <Link href={`/bookings/${b.id}`} className="flex-1 min-w-0">
                      <Card className="bg-white border border-[#E8ECF0] rounded-[14px] shadow-[0_1px_4px_rgba(0,0,0,0.04)] hover:border-[#0F6E56]/30 transition-colors cursor-pointer">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div className="min-w-0">
                              <p className="font-medium text-sm">
                                {formatDateShort(b.check_in_date)}
                                <span className="text-muted-foreground font-normal mx-1.5">→</span>
                                {formatDateShort(b.check_out_date)}
                                <span className="text-muted-foreground font-normal text-xs ml-2">
                                  {b.nights ?? 0} {(b.nights ?? 0) > 1 ? t('common.nights') : t('common.night')}
                                </span>
                              </p>
                              {bed && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {bed.room?.name} · {bed.name}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 flex-shrink-0">
                              <span className={cn('text-xs px-2 py-0.5 rounded-full', status.badge)}>
                                {status.label}
                              </span>
                              <span className={cn('text-xs px-2 py-0.5 rounded-full', sourceColors[b.source] ?? 'bg-gray-100 text-gray-600')}>
                                {BOOKING_SOURCES[b.source] ?? b.source}
                              </span>
                            </div>
                          </div>

                          {/* Payment row */}
                          <div className="mt-3 pt-3 border-t flex items-center justify-between">
                            <div className="text-sm">
                              <span className="text-muted-foreground text-xs">{t('guest.paid')} </span>
                              <span className="font-medium text-[#0F6E56]">{formatCurrency(paid)}</span>
                              <span className="text-muted-foreground text-xs"> / {formatCurrency(b.total_price)}</span>
                            </div>
                            {balance > 0.01 && (
                              <span className="text-xs text-destructive font-medium">
                                {t('payments.balance')}: {formatCurrency(balance)}
                              </span>
                            )}
                            {balance <= 0.01 && paid > 0 && (
                              <span className="text-xs text-[#0F6E56] font-medium">{t('guest.settled')} ✓</span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Notes ── */}
      <Card className="bg-white border border-[#E8ECF0] rounded-[16px] shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-widest text-[#94A3B8]">{t('guest.internalNotes')}</CardTitle>
            {savingNotes && (
              <span className="text-xs text-muted-foreground">{t('guest.saving')}</span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
            placeholder={t('guest.notesPlaceholder')}
            className="resize-none text-sm min-h-[100px]"
            rows={4}
          />
          <p className="text-xs text-muted-foreground mt-2">{t('guest.autosave')}</p>
        </CardContent>
      </Card>

      {/* ── Flag dialog ── */}
      <Dialog open={flagDialog} onOpenChange={setFlagDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Flag className="w-4 h-4" />
              {t('guest.flagGuest')}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t('guest.flagDescription')}
          </p>
          <div className="space-y-1.5">
            <Label>{t('guest.flagReason')}</Label>
            <Input
              value={flagInput}
              onChange={(e) => setFlagInput(e.target.value)}
              placeholder={t('guest.flagReasonPlaceholder')}
              onKeyDown={(e) => e.key === 'Enter' && handleFlag()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFlagDialog(false)}>{t('common.cancel')}</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleFlag} disabled={flagging}>
              {flagging ? t('guest.flagging') : t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
