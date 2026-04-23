'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn, formatCurrency, formatDateShort, daysBetween, todayISO, tomorrowISO } from '@/lib/utils'
import { generateFicheDePolice } from '@/lib/pdf/fiche-police'
import { buildWhatsAppLink, WHATSAPP_TEMPLATES } from '@/lib/whatsapp/templates'
import { NATIONALITIES, COUNTRIES, BOOKING_SOURCES, PAYMENT_METHODS } from '@/lib/constants'
import type { Property, Room, Bed, Guest, Booking } from '@/types'
import { useT } from '@/app/context/LanguageContext'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  ChevronRight,
  ChevronLeft,
  Search,
  Check,
  FileText,
  MessageSquare,
  Loader2,
  AlertTriangle,
  Flag,
  UserPlus
} from 'lucide-react'

interface BedWithRoom extends Bed {
  room?: Room
}

interface Props {
  property: Property
  rooms: Room[]
  beds: BedWithRoom[]
  preselectedBedId?: string
}

type Step = 1 | 2 | 3 | 4 | 5

// ─── Shared label + input sizing ─────────────────────────────────────────────
// All inputs are h-12 (48px) for comfortable mobile tap targets.

export function CheckInWizard({ property, beds, preselectedBedId }: Props) {
  const router = useRouter()
  const t = useT()
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)

  // Step 1 — guest search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Guest[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null)
  const [isNewGuest, setIsNewGuest] = useState(false)

  // Step 2 — guest form
  const [guestForm, setGuestForm] = useState({
    first_name: '',
    last_name: '',
    nationality: '',
    document_type: 'passport',
    document_number: '',
    date_of_birth: '',
    gender: '',
    phone: '',
    country_of_residence: '',
    profession: '',
    address_in_morocco: '',
    next_destination: '',
    email: '',
    notes: '',
  })

  // Step 3 — booking
  const [bookingForm, setBookingForm] = useState({
    check_in_date: todayISO(),
    check_out_date: tomorrowISO(),
    bed_id: preselectedBedId ?? '',
    source: 'direct',
    external_booking_id: '',
    total_price: '',
    special_requests: '',
  })

  // Step 4 — payment
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    method: 'cash',
    notes: '',
  })

  // Step 5 — result
  const [createdGuest, setCreatedGuest] = useState<Guest | null>(null)
  const [createdBooking, setCreatedBooking] = useState<Booking | null>(null)

  // Returning guest info (fetched lazily when a guest is selected)
  const [returningInfo, setReturningInfo] = useState<{
    stays: number
    lastDate: string
  } | null>(null)

  // Flagged guest warning
  const [flagWarningGuest, setFlagWarningGuest] = useState<Guest | null>(null)

  async function searchGuests() {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('guests')
        .select('*')
        .eq('property_id', property.id)
        .or(
          `first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,document_number.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`,
        )
        .limit(5)
      setSearchResults(data ?? [])
    } finally {
      setSearching(false)
    }
  }

  async function selectGuest(guest: Guest, bypassFlagCheck = false) {
    // If guest is flagged and we haven't acknowledged it yet, show warning first
    if (guest.is_flagged && !bypassFlagCheck) {
      setFlagWarningGuest(guest)
      return
    }

    setSelectedGuest(guest)
    setIsNewGuest(false)
    setReturningInfo(null)
    setGuestForm({
      first_name: guest.first_name,
      last_name: guest.last_name,
      nationality: guest.nationality ?? '',
      document_type: guest.document_type,
      document_number: guest.document_number ?? '',
      date_of_birth: guest.date_of_birth ?? '',
      gender: guest.gender ?? '',
      phone: guest.phone ?? '',
      country_of_residence: guest.country_of_residence ?? '',
      profession: guest.profession ?? '',
      address_in_morocco: guest.address_in_morocco ?? '',
      next_destination: guest.next_destination ?? '',
      email: guest.email ?? '',
      notes: guest.notes ?? '',
    })

    // Fetch previous stays to power the welcome-back card
    const supabase = createClient()
    const { data, count } = await supabase
      .from('bookings')
      .select('check_in_date', { count: 'exact' })
      .eq('guest_id', guest.id)
      .not('status', 'in', '(cancelled,no_show)')
      .order('check_in_date', { ascending: false })
      .limit(1)

    if (count && count > 0 && data?.[0]) {
      setReturningInfo({ stays: count, lastDate: data[0].check_in_date })
    }
  }

  function startNewGuest() {
    setSelectedGuest(null)
    setIsNewGuest(true)
    setReturningInfo(null)
    setGuestForm({
      first_name: '',
      last_name: '',
      nationality: '',
      document_type: 'passport',
      document_number: '',
      date_of_birth: '',
      gender: '',
      phone: '',
      country_of_residence: '',
      profession: '',
      address_in_morocco: '',
      next_destination: '',
      email: '',
      notes: '',
    })
  }

  function handleFlaggedConfirm() {
    if (!flagWarningGuest) return
    const guest = flagWarningGuest
    setFlagWarningGuest(null)
    selectGuest(guest, true)
  }

  const nights =
    bookingForm.check_in_date && bookingForm.check_out_date
      ? daysBetween(bookingForm.check_in_date, bookingForm.check_out_date)
      : 0

  const selectedBed = beds.find((b) => b.id === bookingForm.bed_id)
  const autoPrice = selectedBed ? selectedBed.base_price * nights : 0

  async function handleConfirm() {
    setLoading(true)
    try {
      const supabase = createClient()

      let guestId = selectedGuest?.id
      let guestData = selectedGuest

      if (isNewGuest || !selectedGuest) {
        const payload = {
          property_id: property.id,
          first_name: guestForm.first_name,
          last_name: guestForm.last_name,
          nationality: guestForm.nationality || null,
          document_type: guestForm.document_type as Guest['document_type'],
          document_number: guestForm.document_number || null,
          date_of_birth: guestForm.date_of_birth || null,
          gender: (guestForm.gender as Guest['gender']) || null,
          phone: guestForm.phone || null,
          whatsapp: guestForm.phone || null,
          country_of_residence: guestForm.country_of_residence || null,
          profession: guestForm.profession || null,
          address_in_morocco: guestForm.address_in_morocco || null,
          next_destination: guestForm.next_destination || null,
          email: guestForm.email || null,
          notes: guestForm.notes || null,
        }
        const { data: newGuest, error: guestErr } = await supabase
          .from('guests')
          .insert(payload)
          .select()
          .single()
        if (guestErr) throw guestErr
        guestId = newGuest.id
        guestData = newGuest
      }

      const price = parseFloat(bookingForm.total_price) || autoPrice
      const { data: booking, error: bookingErr } = await supabase
        .from('bookings')
        .insert({
          property_id: property.id,
          guest_id: guestId,
          bed_id: bookingForm.bed_id || null,
          source: bookingForm.source,
          external_booking_id: bookingForm.external_booking_id || null,
          status: 'checked_in',
          check_in_date: bookingForm.check_in_date,
          check_out_date: bookingForm.check_out_date,
          adults: 1,
          total_price: price,
          special_requests: bookingForm.special_requests || null,
        })
        .select()
        .single()
      if (bookingErr) throw bookingErr

      if (bookingForm.bed_id) {
        await supabase
          .from('beds')
          .update({ status: 'occupied' })
          .eq('id', bookingForm.bed_id)
      }

      const paymentAmount = parseFloat(paymentForm.amount)
      if (paymentAmount > 0) {
        const { error: payErr } = await supabase.from('payments').insert({
          property_id: property.id,
          booking_id: booking.id,
          guest_id: guestId,
          amount: paymentAmount,
          method: paymentForm.method,
          type: paymentAmount < price ? 'deposit' : 'payment',
          status: 'completed',
          notes: paymentForm.notes || null,
          payment_date: new Date().toISOString(),
        })
        if (payErr) throw new Error(`Paiement non enregistré : ${payErr.message}`)
      }

      setCreatedGuest(guestData)
      setCreatedBooking(booking)
      setStep(5)
      toast.success(t('checkin.checkedIn'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('checkin.error'))
    } finally {
      setLoading(false)
    }
  }

  async function handleGeneratePDF() {
    if (!createdGuest || !createdBooking) return
    try {
      await generateFicheDePolice(createdGuest, createdBooking, property)
      const supabase = createClient()
      await supabase
        .from('bookings')
        .update({ police_fiche_generated: true })
        .eq('id', createdBooking.id)
      toast.success(t('checkin.pdfGenerated'))
    } catch {
      toast.error(t('checkin.pdfError'))
    }
  }

  function handleSendWhatsApp() {
    if (!createdGuest || !createdBooking) return
    const phone = createdGuest.whatsapp ?? createdGuest.phone
    if (!phone) {
      toast.error(t('checkin.noWhatsApp'))
      return
    }
    const msg = WHATSAPP_TEMPLATES.welcome.fr(createdGuest, property, createdBooking)
    const link = buildWhatsAppLink(phone, msg)

    const supabase = createClient()
    supabase
      .from('whatsapp_messages')
      .insert({
        property_id: property.id,
        guest_id: createdGuest.id,
        booking_id: createdBooking.id,
        template_key: 'welcome',
        phone,
        message: msg,
        status: 'sent',
      })
      .then(({ error }) => {
        if (error) console.error('[WhatsApp log]', error.message)
      })

    window.open(link, '_blank')
  }

  const stepTitles = [
    t('checkin.step1.title'),
    t('checkin.step2.title'),
    t('checkin.step3.title'),
    t('checkin.step4.title'),
    t('checkin.step5.title'),
  ]

  // ── Nav buttons shared component ──
  // On mobile: stacked column (Next at top, Back below so thumb can reach Next)
  // On desktop: row with Back left, Next right
  function NavButtons({
    onBack,
    onNext,
    nextLabel,
    nextDisabled = false,
    nextIcon,
  }: {
    onBack?: () => void
    onNext?: () => void
    nextLabel?: string
    nextDisabled?: boolean
    nextIcon?: React.ReactNode
  }) {
    const defaultNextLabel = t('common.next')
    return (
      <div className="flex flex-col sm:flex-row sm:justify-between gap-3 pt-4">
        {onBack ? (
          <Button
            variant="outline"
            onClick={onBack}
            className="h-12 sm:h-10 sm:w-auto order-2 sm:order-1"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            {t('common.back')}
          </Button>
        ) : (
          <div className="hidden sm:block" />
        )}
        {onNext && (
          <Button
            className="h-12 sm:h-11 bg-[#0F6E56] hover:bg-[#0c5a46] order-1 sm:order-2 rounded-[12px] font-semibold"
            disabled={nextDisabled}
            onClick={onNext}
          >
            {nextIcon ?? null}
            {nextLabel ?? defaultNextLabel}
            {!nextIcon && <ChevronRight className="w-4 h-4 ml-1" />}
          </Button>
        )}
      </div>
    )
  }

  return (
    <>
    {/* ── Flagged guest warning dialog ── */}
    <Dialog open={!!flagWarningGuest} onOpenChange={(open) => { if (!open) setFlagWarningGuest(null) }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            {t('checkin.flagged.title')}
          </DialogTitle>
        </DialogHeader>
        <div className="py-2 space-y-3">
          <p className="text-sm">
            <span className="font-medium">{flagWarningGuest?.first_name} {flagWarningGuest?.last_name}</span> {t('checkin.flagged.body')}
          </p>
          {flagWarningGuest?.flag_reason && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
              <p className="text-xs text-red-500 font-medium mb-0.5">{t('checkin.flagged.reason')}</p>
              <p className="text-sm text-red-800">{flagWarningGuest.flag_reason}</p>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            {t('checkin.flagged.confirm')}
          </p>
        </div>
        <DialogFooter className="gap-2 flex-col sm:flex-row">
          <Button variant="outline" className="sm:flex-1" onClick={() => setFlagWarningGuest(null)}>
            {t('common.cancel')}
          </Button>
          <Button className="sm:flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={handleFlaggedConfirm}>
            {t('checkin.flagged.proceed')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 bg-[#F4F6F8] min-h-full">
      {/* ── Step indicator ── */}
      <div className="flex items-center justify-between mb-10 relative">
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[2px] bg-[#E8ECF0] -z-10" />
        {[1, 2, 3, 4, 5].map((s) => {
          const isActive = s === step;
          const isDone = s < step;
          const labels = [t('checkin.nav.guest'), t('checkin.nav.info'), t('checkin.nav.stay'), t('checkin.nav.payment'), t('checkin.nav.confirm')];
          return (
            <div key={s} className="flex flex-col items-center gap-2 relative bg-[#F4F6F8] px-2">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300',
                  isDone
                    ? 'bg-[#0F6E56] text-white'
                    : isActive
                      ? 'bg-[#0F6E56] text-white ring-4 ring-[#0F6E56]/20 scale-110'
                      : 'bg-white text-[#94A3B8] border-2 border-[#E8ECF0]',
                )}
              >
                {isDone ? <Check className="w-4 h-4" /> : s}
              </div>
              <span className={cn(
                "text-[11px] uppercase tracking-wider font-semibold absolute -bottom-6 w-max text-center transition-colors duration-300",
                isActive ? "text-[#0F6E56]" : isDone ? "text-[#0A1F1C]" : "text-[#94A3B8]"
              )}>
                {labels[s - 1]}
              </span>
            </div>
          )
        })}
      </div>

      {/* Main Card Wrapper */}
      <Card className="shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-[#E8ECF0] bg-white relative overflow-hidden rounded-[20px]">
        <div className="absolute top-0 left-0 h-1 bg-[#E8ECF0] right-0">
           <div className="h-full bg-[#0F6E56] transition-all duration-500 rounded-r-md" style={{ width: `${(step / 5) * 100}%` }} />
        </div>
        <CardContent className="p-6 md:p-8 pt-10">
          <div className="mb-8 text-center sm:text-left">
             <h2 className="text-xl font-semibold text-[#0A1F1C]">{stepTitles[step - 1]}</h2>
             <p className="text-[13px] font-medium text-[#94A3B8] mt-1">{t('checkin.stepOf').replace('{step}', String(step)).replace('{total}', '5')}</p>
          </div>

      {/* ── Step 1 — Find guest ── */}
      {step === 1 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-[#0F6E56] transition-colors duration-300" />
            <Input
              className="h-14 pl-12 pr-32 text-base rounded-2xl border-2 bg-muted/10 focus-visible:ring-0 focus-visible:border-[#0F6E56]/50 focus-visible:bg-white transition-all shadow-sm"
              placeholder={t('checkin.step1.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchGuests()}
            />
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
              <Button
                className="h-11 px-6 bg-[#0F6E56] hover:bg-[#0c5a46] rounded-xl font-medium shadow-sm"
                onClick={searchGuests}
                disabled={searching}
              >
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : t('checkin.step1.find')}
              </Button>
            </div>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-2">
              {searchResults.map((g) => (
                <Card
                  key={g.id}
                  className={cn(
                    'cursor-pointer hover:border-[#0F6E56]/30 transition-all active:scale-[0.99] border-2 rounded-xl',
                    selectedGuest?.id === g.id ? 'border-[#0F6E56] bg-[#0F6E56]/5 shadow-sm' : 'border-transparent shadow-none bg-muted/20 hover:bg-muted/40',
                  )}
                  onClick={() => selectGuest(g)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={cn('font-semibold flex items-center gap-1.5', g.is_flagged ? 'text-red-600' : 'text-[#0A1F1C]')}>
                          {g.is_flagged && <Flag className="w-3.5 h-3.5 flex-shrink-0" />}
                          {g.first_name} {g.last_name}
                        </p>
                        <p className="text-[13px] text-muted-foreground mt-1">
                          {g.nationality || t('checkin.step1.noNationality')} · {g.document_number || t('checkin.step1.noDocument')} · <span className="font-medium text-[#0F6E56]">{g.total_stays} {t('guests.stays')}</span>
                        </p>
                        {g.is_flagged && (
                          <div className="mt-2 inline-flex items-center gap-1.5 bg-red-50 text-red-600 font-semibold text-[11px] px-2 py-0.5 rounded-full border border-red-100">
                             ⚠ {t('checkin.step1.flagged')}
                          </div>
                        )}
                      </div>
                      {selectedGuest?.id === g.id && (
                        <div className="w-7 h-7 rounded-full bg-[#0F6E56] flex items-center justify-center text-white flex-shrink-0 shadow-sm animate-in zoom-in duration-200">
                          <Check className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Returning guest welcome card */}
          {selectedGuest && returningInfo && returningInfo.stays > 0 && (
            <div className="rounded-2xl border border-[#0F6E56]/30 bg-gradient-to-r from-[#0F6E56]/10 to-transparent px-5 py-4 flex items-start gap-4 animate-in fade-in slide-in-from-bottom-2">
              <span className="text-2xl leading-none mt-0.5">👋</span>
              <div>
                <p className="text-sm font-semibold text-[#0F6E56]">
                  {t('checkin.step1.welcomeBack').replace('{name}', selectedGuest.first_name)}
                </p>
                <p className="text-[13px] text-[#4A6560] mt-0.5 leading-relaxed">
                  {returningInfo.stays} {returningInfo.stays > 1 ? t('common.nights') : t('common.night')} {t('checkin.step1.registered')}.{' '}
                  {t('checkin.step1.lastVisit')} <span className="font-semibold text-[#0A1F1C]">{formatDateShort(returningInfo.lastDate)}</span>.
                </p>
              </div>
            </div>
          )}

          {searchResults.length === 0 && searchQuery && !searching && (
            <div className="text-center py-6 bg-muted/10 rounded-2xl border border-dashed border-muted/50">
               <p className="text-sm font-medium text-muted-foreground">{t('checkin.step1.noResult').replace('{query}', searchQuery)}</p>
            </div>
          )}

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-muted/60" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
              <span className="bg-white px-3">{t('common.or')}</span>
            </div>
          </div>

          <div 
            className={cn(
              "rounded-2xl border-2 border-dashed p-6 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-300 group",
              isNewGuest ? "border-[#0F6E56] bg-[#0F6E56]/5" : "border-muted-foreground/30 hover:border-[#0F6E56]/50 hover:bg-[#0F6E56]/5"
            )}
            onClick={startNewGuest}
          >
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center transition-colors duration-300",
              isNewGuest ? "bg-[#0F6E56] shadow-md" : "bg-muted/50 group-hover:bg-[#0F6E56]/20"
            )}>
              <UserPlus className={cn("w-5 h-5", isNewGuest ? "text-white" : "text-muted-foreground group-hover:text-[#0F6E56]")} />
            </div>
            <div className="text-center">
              <h3 className={cn("font-semibold text-base transition-colors", isNewGuest ? "text-[#0F6E56]" : "text-[#0A1F1C]")}>
                {isNewGuest ? t('checkin.step1.newSelected') : t('checkin.step1.newGuest')}
              </h3>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                {t('checkin.step1.firstTime')}
              </p>
            </div>
          </div>

          <div className="pt-4">
            <NavButtons
              onNext={() => setStep(2)}
              nextDisabled={!selectedGuest && !isNewGuest}
            />
          </div>
        </div>
      )}

      {/* ── Step 2 — Guest info ── */}
      {step === 2 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
          
          {/* Identité Section */}
          <div className="bg-[#F8FAFC] p-5 sm:p-6 rounded-[16px] border border-[#E8ECF0] space-y-4">
            <h3 className="text-[12px] font-semibold text-[#94A3B8] uppercase tracking-widest flex items-center gap-2 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#0F6E56]" /> {t('checkin.section.identity')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-muted-foreground font-medium">{t('checkin.step2.firstName')} *</Label>
                <Input
                  className="h-12 text-base rounded-xl bg-white"
                  value={guestForm.first_name}
                  onChange={(e) => setGuestForm((p) => ({ ...p, first_name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground font-medium">{t('checkin.step2.lastName')} *</Label>
                <Input
                  className="h-12 text-base rounded-xl bg-white"
                  value={guestForm.last_name}
                  onChange={(e) => setGuestForm((p) => ({ ...p, last_name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground font-medium flex items-center gap-1.5">{t('checkin.step2.nationality')} *</Label>
                <Select value={guestForm.nationality} onValueChange={(v) => setGuestForm((p) => ({ ...p, nationality: v ?? '' }))}>
                  <SelectTrigger className="h-12 text-base rounded-xl bg-white focus:ring-[#0F6E56]/30">
                    <SelectValue placeholder={t('checkin.step1.select')} />
                  </SelectTrigger>
                  <SelectContent>
                    {NATIONALITIES.map((n) => (<SelectItem key={n} value={n}>{n}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground font-medium">{t('checkin.step2.phone')} *</Label>
                <Input
                  className="h-12 text-base rounded-xl bg-white"
                  type="tel"
                  placeholder="+212 6XX XXX XXX"
                  value={guestForm.phone}
                  onChange={(e) => setGuestForm((p) => ({ ...p, phone: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-muted-foreground font-medium">{t('checkin.step2.dob')} *</Label>
                <Input
                  className="h-12 text-base rounded-xl bg-white block w-full"
                  type="date"
                  value={guestForm.date_of_birth}
                  onChange={(e) => setGuestForm((p) => ({ ...p, date_of_birth: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground font-medium">{t('checkin.step2.gender')} *</Label>
                <Select value={guestForm.gender} onValueChange={(v) => setGuestForm((p) => ({ ...p, gender: v ?? '' }))}>
                  <SelectTrigger className="h-12 text-base rounded-xl bg-white">
                    <SelectValue placeholder={t('checkin.step1.select')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">{t('checkin.gender.male')}</SelectItem>
                    <SelectItem value="F">{t('checkin.gender.female')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Documents Section */}
          <div className="bg-[#F8FAFC] p-5 sm:p-6 rounded-[16px] border border-[#E8ECF0] space-y-4">
            <h3 className="text-[12px] font-semibold text-[#94A3B8] uppercase tracking-widest flex items-center gap-2 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> {t('checkin.section.documents')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-muted-foreground font-medium">{t('checkin.step2.docType')} *</Label>
                <Select value={guestForm.document_type} onValueChange={(v) => setGuestForm((p) => ({ ...p, document_type: v ?? 'passport' }))}>
                  <SelectTrigger className="h-12 text-base rounded-xl bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="passport">{t('checkin.docType.passport')}</SelectItem>
                    <SelectItem value="cin">{t('checkin.docType.cin')}</SelectItem>
                    <SelectItem value="id_card">{t('checkin.docType.idCard')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground font-medium">{t('checkin.step2.docNumber')} *</Label>
                <Input
                  className="h-12 text-base rounded-xl bg-white"
                  value={guestForm.document_number}
                  onChange={(e) => setGuestForm((p) => ({ ...p, document_number: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground font-medium">{t('checkin.step2.residence')} *</Label>
                <Select value={guestForm.country_of_residence} onValueChange={(v) => setGuestForm((p) => ({ ...p, country_of_residence: v ?? '' }))}>
                  <SelectTrigger className="h-12 text-base rounded-xl bg-white">
                    <SelectValue placeholder={t('checkin.step1.select')} />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground font-medium">{t('checkin.step2.addressMorocco')}</Label>
                <Input
                  className="h-12 text-base rounded-xl bg-white"
                  placeholder={t('checkin.step2.addressPlaceholder')}
                  value={guestForm.address_in_morocco}
                  onChange={(e) => setGuestForm((p) => ({ ...p, address_in_morocco: e.target.value }))}
                />
              </div>
            </div>
            <div className="pt-2">
              <div className="space-y-1.5">
                <Label className="text-muted-foreground font-medium">{t('checkin.step2.nextDest')}</Label>
                <Input
                  className="h-12 text-base rounded-xl bg-white w-full"
                  value={guestForm.next_destination}
                  onChange={(e) => setGuestForm((p) => ({ ...p, next_destination: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Optional Info Section */}
          <div className="bg-[#F8FAFC] p-5 rounded-[16px] border border-[#E8ECF0]">
            <details className="group">
              <summary className="text-sm font-semibold text-[#0F6E56] cursor-pointer outline-none list-none flex items-center justify-between">
                <span>{t('checkin.section.optional')}</span>
                <span className="transition duration-300 group-open:rotate-180">
                  <ChevronRight className="w-4 h-4 text-[#0F6E56]/70" />
                </span>
              </summary>
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground font-medium">{t('checkin.step2.profession')}</Label>
                  <Input
                    className="h-12 text-base rounded-xl bg-white"
                    value={guestForm.profession}
                    onChange={(e) => setGuestForm((p) => ({ ...p, profession: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground font-medium">{t('common.email')}</Label>
                  <Input
                    className="h-12 text-base rounded-xl bg-white"
                    type="email"
                    value={guestForm.email}
                    onChange={(e) => setGuestForm((p) => ({ ...p, email: e.target.value }))}
                  />
                </div>
              </div>
            </details>
          </div>

          <div className="pt-4 border-t border-muted">
            <NavButtons
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
              nextDisabled={!guestForm.first_name || !guestForm.last_name}
            />
          </div>
        </div>
      )}

      {/* ── Step 3 — Booking ── */}
      {step === 3 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
          
          {/* Dates & Duration */}
          <div className="bg-[#F8FAFC] p-5 sm:p-6 rounded-[16px] border border-[#E8ECF0] space-y-4">
            <div className="flex items-center justify-between mb-2">
               <h3 className="text-[12px] font-semibold text-[#94A3B8] uppercase tracking-widest flex items-center gap-2">
                 <div className="w-1.5 h-1.5 rounded-full bg-amber-500" /> {t('checkin.section.dates')}
               </h3>
               {nights > 0 && (
                 <Badge variant="secondary" className="bg-[#0F6E56]/10 text-[#0F6E56] hover:bg-[#0F6E56]/20 font-bold px-3 py-1 text-xs">
                   {nights} {nights > 1 ? t('common.nights') : t('common.night')}
                 </Badge>
               )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-muted-foreground font-medium">{t('checkin.step3.checkin')} *</Label>
                <Input
                  className="h-12 text-base rounded-xl bg-white block w-full"
                  type="date"
                  value={bookingForm.check_in_date}
                  onChange={(e) => setBookingForm((p) => ({ ...p, check_in_date: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground font-medium">{t('checkin.step3.checkout')} *</Label>
                <Input
                  className="h-12 text-base rounded-xl bg-white block w-full"
                  type="date"
                  value={bookingForm.check_out_date}
                  onChange={(e) => setBookingForm((p) => ({ ...p, check_out_date: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Bed selection */}
          <div className="bg-[#F8FAFC] p-5 sm:p-6 rounded-[16px] border border-[#E8ECF0] space-y-4">
            <h3 className="text-[12px] font-semibold text-[#94A3B8] uppercase tracking-widest flex items-center gap-2 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> {t('checkin.step3.bedAssign')}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-56 overflow-y-auto px-1 pb-1">
              {beds
                .filter((b) => b.status === 'available' || b.id === bookingForm.bed_id)
                .map((bed) => (
                  <button
                    key={bed.id}
                    type="button"
                    onClick={() =>
                      setBookingForm((p) => ({
                        ...p,
                        bed_id: bed.id,
                        total_price: String(bed.base_price * (nights || 1)),
                      }))
                    }
                    className={cn(
                      'rounded-xl border-2 p-3 text-left transition-all min-h-[76px]',
                      bookingForm.bed_id === bed.id
                        ? 'border-[#0F6E56] bg-[#0F6E56]/5 shadow-sm'
                        : 'border-transparent bg-white shadow-sm hover:border-[#0F6E56]/30 hover:bg-muted/30',
                    )}
                  >
                    <div className={cn("font-bold text-sm", bookingForm.bed_id === bed.id ? "text-[#0F6E56]" : "text-[#0A1F1C]")}>{bed.name}</div>
                    <div className="text-[11px] text-muted-foreground leading-tight mt-0.5 truncate">
                      {bed.room?.name}
                    </div>
                    <div className="text-xs font-medium mt-1.5 opacity-80">{formatCurrency(bed.base_price)} / n</div>
                  </button>
                ))}
                {beds.filter((b) => b.status === 'available' || b.id === bookingForm.bed_id).length === 0 && (
                  <div className="col-span-full py-4 text-center text-sm text-muted-foreground">
                    {t('checkin.step3.noBeds')}
                  </div>
                )}
            </div>
          </div>

          {/* Pricing & Source */}
          <div className="bg-[#F8FAFC] p-5 sm:p-6 rounded-[16px] border border-[#E8ECF0] space-y-4">
            <h3 className="text-[12px] font-semibold text-[#94A3B8] uppercase tracking-widest flex items-center gap-2 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {t('checkin.section.pricing')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-muted-foreground font-medium">{t('checkin.step3.source')}</Label>
                <Select value={bookingForm.source} onValueChange={(v) => setBookingForm((p) => ({ ...p, source: v ?? 'direct' }))}>
                  <SelectTrigger className="h-12 text-base rounded-xl bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(BOOKING_SOURCES).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground font-medium">{t('checkin.step3.ref')}</Label>
                <Input
                  className="h-12 text-base rounded-xl bg-white"
                  placeholder="Ex: Booking.com ref"
                  value={bookingForm.external_booking_id}
                  onChange={(e) => setBookingForm((p) => ({ ...p, external_booking_id: e.target.value }))}
                />
              </div>
            </div>
            
            <div className="pt-2">
              <div className="space-y-1.5">
                <Label className="text-muted-foreground font-medium text-base">{t('checkin.step3.price')}</Label>
                <div className="relative">
                  <Input
                    className="h-14 text-lg font-bold rounded-xl bg-white border-2 border-emerald-500/20 focus-visible:border-emerald-500"
                    type="number"
                    placeholder={String(autoPrice)}
                    value={bookingForm.total_price}
                    onChange={(e) => setBookingForm((p) => ({ ...p, total_price: e.target.value }))}
                  />
                  {autoPrice > 0 && !bookingForm.total_price && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
                      {t('checkin.step3.auto')}: {formatCurrency(autoPrice)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-muted">
            <NavButtons
              onBack={() => setStep(2)}
              onNext={() => {
                if (!bookingForm.total_price && autoPrice > 0) {
                  setBookingForm((p) => ({ ...p, total_price: String(autoPrice) }))
                }
                setPaymentForm((p) => ({
                  ...p,
                  amount: bookingForm.total_price || String(autoPrice),
                }))
                setStep(4)
              }}
              nextDisabled={!bookingForm.check_in_date || !bookingForm.check_out_date}
            />
          </div>
        </div>
      )}

      {/* ── Step 4 — Payment ── */}
      {step === 4 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
          
          <div className="rounded-[16px] bg-[#F8FAFC] p-6 text-center space-y-2 border border-[#E8ECF0]">
            <p className="text-[12px] font-semibold text-[#94A3B8] uppercase tracking-widest">{t('checkin.step4.totalDue')}</p>
            <p className="text-4xl font-black text-[#0A1F1C] tracking-tight">
              {formatCurrency(parseFloat(bookingForm.total_price) || autoPrice)}
            </p>
          </div>

          <div className="bg-[#F8FAFC] p-5 sm:p-6 rounded-[16px] border border-[#E8ECF0] space-y-6 mt-4">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground font-medium">{t('checkin.step4.amount')}</Label>
              <Input
                className="h-14 text-lg font-bold rounded-xl bg-white border-2 border-muted/60 focus-visible:border-[#0F6E56]/50 transition-all font-mono"
                type="number"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm((p) => ({ ...p, amount: e.target.value }))}
                placeholder="0"
              />
            </div>

            {paymentForm.method === 'cash' &&
              parseFloat(paymentForm.amount) >
                (parseFloat(bookingForm.total_price) || autoPrice) && (
                <div className="rounded-xl bg-amber-50 border-2 border-amber-200/50 p-4 animate-in zoom-in-95 duration-200">
                  <p className="text-sm font-bold text-amber-800 flex items-center gap-2">
                    <span className="bg-amber-100 p-1 rounded-md text-lg leading-none">💵</span> {t('checkin.step4.change')}:
                    <span className="text-base text-amber-900 tracking-tight">
                    {formatCurrency(
                      parseFloat(paymentForm.amount) -
                        (parseFloat(bookingForm.total_price) || autoPrice),
                    )}
                    </span>
                  </p>
                </div>
              )}

            <div className="space-y-2.5">
              <Label className="text-muted-foreground font-medium">{t('checkin.step4.method')}</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.entries(PAYMENT_METHODS).map(([k, v]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setPaymentForm((p) => ({ ...p, method: k }))}
                    className={cn(
                      'rounded-xl border-2 p-3 text-sm text-center transition-all min-h-[56px] font-semibold tracking-wide',
                      paymentForm.method === k
                        ? 'border-[#0F6E56] bg-[#0F6E56]/10 text-[#0F6E56] shadow-sm scale-[1.02]'
                        : 'border-muted/50 bg-white hover:border-[#0F6E56]/30 text-muted-foreground hover:bg-muted/20 hover:text-foreground active:scale-[0.98]',
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-muted">
            <NavButtons
              onBack={() => setStep(3)}
              onNext={() => setStep(5)}
              nextLabel={t('checkin.step4.reviewLabel')}
            />
          </div>
        </div>
      )}

      {/* ── Step 5 — Summary before confirm ── */}
      {step === 5 && !createdBooking && (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
          <div className="text-center space-y-1.5 mb-6">
            <div className="w-12 h-12 bg-[#0F6E56]/10 text-[#0F6E56] rounded-full flex items-center justify-center mx-auto mb-3 ring-4 ring-[#0F6E56]/5">
               <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-[#0A1F1C]">{t('checkin.step5.summaryTitle')}</h3>
            <p className="text-sm text-muted-foreground">{t('checkin.step5.summaryHint')}</p>
          </div>

          <Card className="rounded-[16px] border border-[#E8ECF0] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden bg-white">
            <CardContent className="p-0">
               <div className="grid grid-cols-1 divide-y divide-[#F0F4F7]">
                 
                 <div className="p-5 flex items-center justify-between bg-white hover:bg-muted/5 transition-colors">
                   <div className="space-y-0.5">
                     <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{t('checkin.summary.guest')}</p>
                     <p className="font-semibold text-base text-[#0A1F1C]">
                       {guestForm.first_name} {guestForm.last_name}
                     </p>
                   </div>
                   <div className="text-right space-y-0.5">
                     <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{t('checkin.step2.nationality')}</p>
                     <p className="font-medium text-sm text-[#0F6E56] bg-[#0F6E56]/10 px-2 py-0.5 rounded-md inline-block mt-0.5">
                        {guestForm.nationality || '—'}
                     </p>
                   </div>
                 </div>

                 <div className="p-5 flex items-center justify-between hover:bg-muted/5 transition-colors">
                   <div className="space-y-0.5">
                     <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{t('checkin.summary.dates')}</p>
                     <p className="font-semibold text-sm text-[#0A1F1C]">
                       {formatDateShort(bookingForm.check_in_date)} <span className="text-muted-foreground mx-1 text-xs">→</span> {formatDateShort(bookingForm.check_out_date)}
                     </p>
                   </div>
                   <div className="text-right space-y-0.5">
                     <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{t('checkin.summary.bed')}</p>
                     <p className="font-semibold text-sm text-[#0A1F1C]">
                        {selectedBed ? `${selectedBed.room?.name} — ${selectedBed.name}` : t('checkin.summary.unassigned')}
                     </p>
                   </div>
                 </div>

                 <div className="p-5 flex items-center justify-between bg-white hover:bg-muted/5 transition-colors">
                   <div className="space-y-0.5">
                     <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{t('checkin.summary.totalAmount')}</p>
                     <p className="font-black text-xl text-[#0A1F1C]">
                       {formatCurrency(parseFloat(bookingForm.total_price) || autoPrice)}
                     </p>
                   </div>
                   <div className="text-right space-y-0.5">
                     <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{t('checkin.summary.initialPayment')}</p>
                     <p className="font-bold text-base text-[#0F6E56]">
                       {formatCurrency(parseFloat(paymentForm.amount) || 0)}
                     </p>
                     <p className="text-[10px] text-muted-foreground uppercase font-semibold mt-0.5 opacity-80 gap-1 flex items-center justify-end">{t('checkin.summary.via')} {PAYMENT_METHODS[paymentForm.method] ?? paymentForm.method}</p>
                   </div>
                 </div>

               </div>
            </CardContent>
          </Card>

          <div className="pt-4 mt-8">
            <NavButtons
              onBack={() => setStep(4)}
              onNext={handleConfirm}
              nextLabel={loading ? t('checkin.step5.saving') : t('checkin.step5.validate')}
              nextDisabled={loading}
              nextIcon={loading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Check className="w-5 h-5 mr-2" />}
            />
          </div>
        </div>
      )}

      {/* ── Step 5 — Post-confirm actions ── */}
      {step === 5 && createdBooking && (
        <div className="space-y-6 animate-in zoom-in-95 duration-500 max-w-md mx-auto py-6 sm:py-10">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-[#0F6E56] flex items-center justify-center mx-auto shadow-xl shadow-[#0F6E56]/20 ring-8 ring-[#0F6E56]/10">
              <Check className="w-10 h-10 text-white stroke-[3]" />
            </div>
            <div>
              <h3 className="font-black text-[#0F6E56] text-3xl tracking-tight mb-2">{t('checkin.step5.success')}</h3>
              <p className="text-muted-foreground text-[15px]">
                <span className="font-semibold text-foreground">{createdGuest?.first_name} {createdGuest?.last_name}</span> — {t('checkin.step5.subtitle')}
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-6 w-full">
            <Button
              size="lg"
              className="w-full h-14 bg-[#0F6E56] hover:bg-[#0c5a46] text-base font-semibold shadow-md rounded-xl transition-all hover:shadow-lg active:scale-[0.98]"
              onClick={handleGeneratePDF}
            >
              <FileText className="w-5 h-5 mr-2 fill-white/20" />
              {t('checkin.step5.generatePdf')}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full h-14 text-base font-bold text-[#25D366] border-[#25D366]/40 hover:bg-[#25D366]/10 rounded-xl transition-all shadow-sm active:scale-[0.98] bg-[#25D366]/5"
              onClick={handleSendWhatsApp}
            >
              <MessageSquare className="w-5 h-5 mr-2 fill-[#25D366]/20" />
              {t('checkin.step5.sendWhatsApp')}
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="w-full h-14 text-base font-semibold rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 mt-2 transition-colors"
              onClick={() => router.push('/dashboard')}
            >
              {t('checkin.returnDashboard')}
            </Button>
          </div>
        </div>
      )}
        </CardContent>
      </Card>
    </div>
    </>
  )
}
