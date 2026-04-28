'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { formatCurrency, formatDateShort } from '@/lib/utils'
import { BOOKING_SOURCES } from '@/lib/constants'
import { generateFicheDePolice } from '@/lib/pdf/fiche-police'
import { generateInvoice } from '@/lib/pdf/invoice'
import { buildWhatsAppLink, WHATSAPP_TEMPLATES } from '@/lib/whatsapp/templates'
import {
  ArrowLeft, Phone, MessageSquare, FileText, Plus,
  CheckCircle2, XCircle, Loader2, Edit2, Check, X, Receipt,
  Star, Link2, AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Booking, Guest, Bed, Room, Payment, Property, BookingExtra } from '@/types'
import { useSession } from '@/app/context/SessionContext'
import { logActivity } from '@/lib/activity'
import { useT } from '@/app/context/LanguageContext'

type BedOption = { id: string; name: string; base_price: number; status: string; room: { name: string } | null }

interface Props {
  booking: Booking & { guest: Guest | null; bed: (Bed & { room: Room | null }) | null }
  payments: Payment[]
  extras: BookingExtra[]
  beds: BedOption[]
  property: Property
  totalPaid: number
  extrasTotal: number
}

export function BookingDetailClient({ booking, payments, extras, property, totalPaid, extrasTotal }: Props) {
  const router = useRouter()
  const t = useT()
  const session = useSession()

  const statusConfig: Record<string, { label: string; color: string }> = {
    pending:    { label: t('bookings.status.pending'),    color: 'bg-yellow-100 text-yellow-700' },
    confirmed:  { label: t('bookings.status.confirmed'),  color: 'bg-blue-100 text-blue-700' },
    checked_in: { label: t('bookings.status.checked_in'), color: 'bg-[#0F6E56]/10 text-[#0F6E56]' },
    checked_out:{ label: t('bookings.status.checked_out'),color: 'bg-gray-100 text-gray-600' },
    cancelled:  { label: t('bookings.status.cancelled'),  color: 'bg-red-100 text-red-700' },
    no_show:    { label: t('bookings.status.no_show'),    color: 'bg-amber-100 text-amber-700' },
  }

  const methodLabels: Record<string, string> = {
    cash: t('payments.cash'), virement: t('payments.virement'), cmi: t('payments.cmi'), wave: t('payments.wave'), other: t('payments.other'),
  }
  const [loading, setLoading] = useState(false)
  const [paymentDialog, setPaymentDialog] = useState(false)
  const [checkoutConfirmOpen, setCheckoutConfirmOpen] = useState(false)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notes, setNotes] = useState(booking.internal_notes ?? '')
  const [payForm, setPayForm] = useState({ amount: '', method: 'cash', reference: '', notes: '' })

  // Extras local state — allows add/delete without page reload
  const [localExtras, setLocalExtras] = useState<BookingExtra[]>(extras)
  const [addingExtra, setAddingExtra] = useState(false)
  const [savingExtra, setSavingExtra] = useState(false)
  const [extraForm, setExtraForm] = useState({ name: '', quantity: '1', unit_price: '' })
  const localExtrasTotal = localExtras.reduce((s, e) => s + e.quantity * e.unit_price, 0)

  // Ledger — includes extras in the balance
  const grandTotal = booking.total_price + localExtrasTotal
  const dynamicBalance = grandTotal - totalPaid
  
  function openPaymentDialog() {
    setPayForm({ amount: dynamicBalance !== 0 ? String(Math.abs(dynamicBalance)) : '', method: 'cash', reference: '', notes: '' })
    setPaymentDialog(true)
  }

  async function handleAddExtra(e: React.FormEvent) {
    e.preventDefault()
    const qty = parseInt(extraForm.quantity, 10)
    const price = parseFloat(extraForm.unit_price)
    if (!extraForm.name.trim() || isNaN(qty) || qty < 1 || isNaN(price) || price < 0) return
    setSavingExtra(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('booking_extras')
        .insert({ booking_id: booking.id, property_id: booking.property_id, name: extraForm.name.trim(), quantity: qty, unit_price: price })
        .select('id, name, quantity, unit_price, created_at, booking_id, property_id')
        .single()
      if (error || !data) throw error
      setLocalExtras((prev) => [...prev, data as BookingExtra])
      setExtraForm({ name: '', quantity: '1', unit_price: '' })
      setAddingExtra(false)
      toast.success('Supplément ajouté')
    } catch {
      toast.error('Erreur lors de l\'ajout')
    } finally {
      setSavingExtra(false)
    }
  }

  async function handleDeleteExtra(id: string) {
    setLocalExtras((prev) => prev.filter((e) => e.id !== id))
    const supabase = createClient()
    const { error } = await supabase.from('booking_extras').delete().eq('id', id)
    if (error) {
      toast.error('Erreur lors de la suppression')
      setLocalExtras((prev) => [...prev, extras.find((e) => e.id === id)!].filter(Boolean))
    }
  }

  // Pre-arrival form
  async function handleSendPreArrival() {
    const phone = guest?.whatsapp ?? guest?.phone
    if (!phone) return toast.error(t('bookings.noWhatsApp'))
    const token = booking.pre_checkin_token
    if (!token) return toast.error(t('bookings.noToken'))
    const url = `${window.location.origin}/checkin/${token}`
    const msg = `Bonjour ${guest?.first_name ?? ''} 👋\n\nPour accélérer votre check-in, veuillez remplir votre fiche en ligne avant votre arrivée :\n\n🔗 ${url}\n\nMerci et à bientôt chez *${property.name}*! 🏠`
    window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank')
    toast.success(t('bookings.preArrivalSent'))
  }

  // Review request
  function handleReviewRequest() {
    if (!guest) return toast.error(t('bookings.noGuestInfo'))
    const phone = guest.whatsapp ?? guest.phone
    if (!phone) return toast.error(t('whatsapp.noPhone'))
    const reviewUrl = property.review_url
    const msg = reviewUrl
      ? `Merci ${guest.first_name} d'avoir séjourné chez *${property.name}*! 🙏\n\nVotre avis nous aide énormément. Auriez-vous 2 minutes?\n\n⭐ ${reviewUrl}\n\nÀ bientôt! 🌟`
      : WHATSAPP_TEMPLATES.review_request.fr(guest, property)
    window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const guest = booking.guest
  const bed = booking.bed as (Bed & { room: Room | null }) | null

  async function handleStatusChange(status: string) {
    setLoading(true)
    try {
      const supabase = createClient()
      await supabase.from('bookings').update({ status }).eq('id', booking.id)
      // update bed status accordingly
      if (booking.bed_id) {
        if (status === 'checked_in') {
          await supabase.from('beds').update({ status: 'occupied' }).eq('id', booking.bed_id)
        } else if (status === 'checked_out') {
          await supabase.from('beds').update({ status: 'dirty' }).eq('id', booking.bed_id)
          // Auto-create housekeeping task so cleaning staff see it immediately
          await supabase.from('housekeeping_tasks').insert({
            property_id: booking.property_id,
            bed_id: booking.bed_id,
            title: `Nettoyage après départ — ${bed?.name ?? ''}`,
            status: 'pending',
            priority: 'normal',
          })
        } else if (status === 'cancelled' || status === 'no_show') {
          await supabase.from('beds').update({ status: 'available' }).eq('id', booking.bed_id)
        }
      }
      // Update guest loyalty counters on checkout
      if (status === 'checked_out' && booking.guest_id) {
        const [staysRes, paymentsRes] = await Promise.all([
          supabase
            .from('bookings')
            .select('id', { count: 'exact', head: true })
            .eq('guest_id', booking.guest_id)
            .not('status', 'in', '(cancelled,no_show)'),
          supabase
            .from('payments')
            .select('amount, type')
            .eq('guest_id', booking.guest_id)
            .eq('status', 'completed'),
        ])
        
        const totalSpent = (paymentsRes.data ?? []).reduce(
          (s, p) => s + (p.type === 'refund' ? -p.amount : p.amount), 
          0
        )
        
        await supabase.from('guests').update({
          total_stays: staysRes.count ?? 1,
          total_spent: totalSpent,
        }).eq('id', booking.guest_id)
      }
      const guestName = guest ? `${guest.first_name} ${guest.last_name}` : 'Client inconnu'
      const actionMap: Record<string, { type: Parameters<typeof logActivity>[0]['actionType']; desc: string }> = {
        checked_in:  { type: 'check_in',          desc: `Check-in : ${guestName}` },
        checked_out: { type: 'check_out',          desc: `Check-out : ${guestName}` },
        cancelled:   { type: 'booking_cancelled',  desc: `Réservation annulée : ${guestName}` },
        no_show:     { type: 'booking_cancelled',  desc: `No-show : ${guestName}` },
      }
      const mapped = actionMap[status]
      if (mapped) {
        logActivity({
          propertyId: booking.property_id,
          userId: session?.userId ?? null,
          staffName: session?.staffName ?? null,
          actionType: mapped.type,
          entityType: 'booking',
          entityId: booking.id,
          description: mapped.desc,
          meta: { guest_name: guestName, bed_name: booking.bed?.name },
        })
      }
      toast.success(t('bookings.statusUpdated'))
      router.refresh()
    } catch {
      toast.error(t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  async function handleAddPayment() {
    if (!payForm.amount) return
    setLoading(true)
    try {
      const supabase = createClient()
      const amount = parseFloat(payForm.amount)
      
      // If dynamicBalance is negative, this is a refund being processed.
      const isRefund = dynamicBalance < 0
      const paymentType = isRefund ? 'refund' : (amount < dynamicBalance ? 'deposit' : 'payment')

      await supabase.from('payments').insert({
        property_id: booking.property_id,
        booking_id: booking.id,
        guest_id: booking.guest_id,
        amount,
        method: payForm.method,
        type: paymentType,
        status: 'completed',
        reference: payForm.reference || null,
        notes: payForm.notes || null,
        payment_date: new Date().toISOString(),
      })
      const guestName = guest ? `${guest.first_name} ${guest.last_name}` : 'Client inconnu'
      logActivity({
        propertyId: booking.property_id,
        userId: session?.userId ?? null,
        staffName: session?.staffName ?? null,
        actionType: 'payment',
        entityType: 'payment',
        description: `Paiement ${amount} MAD (${payForm.method}) — ${guestName}`,
        meta: { amount, method: payForm.method, guest_name: guestName },
      })
      toast.success(t('payments.saved'))
      setPaymentDialog(false)
      setPayForm({ amount: '', method: 'cash', reference: '', notes: '' })
      router.refresh()
    } catch {
      toast.error(t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveNotes() {
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('bookings')
        .update({ internal_notes: notes })
        .eq('id', booking.id)
      if (error) throw error
      setEditingNotes(false)
      toast.success(t('bookings.notesSaved'))
      router.refresh()
    } catch {
      toast.error(t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  function handleGeneratePDF() {
    if (!guest) return toast.error(t('bookings.noGuestInfo'))
    generateFicheDePolice(guest, booking, property)
    toast.success(t('bookings.policeFormGenerated'))
  }

  function handleGenerateInvoice() {
    if (!guest) return toast.error(t('bookings.noGuestInfo'))
    generateInvoice(guest, booking, property, payments, undefined, extras)
    toast.success(t('bookings.invoiceGenerated'))
  }

  function handleWhatsApp(templateKey: 'welcome' | 'checkout_reminder' | 'payment_reminder') {
    if (!guest) return toast.error(t('bookings.noGuestInfo'))
    const phone = guest.whatsapp ?? guest.phone
    if (!phone) return toast.error(t('whatsapp.noPhone'))

    let msg = ''
    if (templateKey === 'welcome') msg = WHATSAPP_TEMPLATES.welcome.fr(guest, property, booking)
    else if (templateKey === 'checkout_reminder') msg = WHATSAPP_TEMPLATES.checkout_reminder.fr(guest, property)
    else if (templateKey === 'payment_reminder') {
      const extrasNote = extrasTotal > 0 ? ` (dont ${formatCurrency(extrasTotal)} de suppléments)` : ''
      msg = WHATSAPP_TEMPLATES.payment_reminder.fr(guest, dynamicBalance) + extrasNote
    }

    window.open(buildWhatsAppLink(phone, msg), '_blank')
  }

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto bg-[#F4F6F8] min-h-full hp-page-in">
      {/* Back */}
      <Link href="/bookings">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="w-4 h-4 mr-1" />
          {t('bookings.title')}
        </Button>
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-medium">
              {guest ? `${guest.first_name} ${guest.last_name}` : t('bookings.unknownGuest')}
            </h1>
            <span className={cn('text-xs px-2 py-0.5 rounded-full', statusConfig[booking.status]?.color)}>
              {statusConfig[booking.status]?.label ?? booking.status}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {formatDateShort(booking.check_in_date)} → {formatDateShort(booking.check_out_date)}
            {' · '}{booking.nights} {(booking.nights ?? 0) > 1 ? t('common.nights') : t('common.night')}
            {bed && ` · ${bed.room?.name} ${bed.name}`}
          </p>
        </div>

        {/* Quick guest contact */}
        {guest && (
          <div className="flex gap-2">
            {guest.phone && (
              <a href={`tel:${guest.phone}`}>
                <Button variant="outline" size="sm"><Phone className="w-3 h-3 mr-1" />{t('common.call')}</Button>
              </a>
            )}
            {(guest.whatsapp ?? guest.phone) && (
              <Button variant="outline" size="sm" className="text-[#25D366] border-[#25D366]/30"
                onClick={() => handleWhatsApp('welcome')}>
                <MessageSquare className="w-3 h-3 mr-1" />WhatsApp
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Booking info */}
        <Card className="bg-white border border-[#E8ECF0] rounded-[16px] shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
          <CardHeader className="pb-3"><CardTitle className="text-[11px] font-semibold uppercase tracking-widest text-[#94A3B8]">{t('bookings.detailsTitle')}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {([
              [t('bookings.source'), BOOKING_SOURCES[booking.source] ?? booking.source],
              [t('bookings.externalRef'), booking.external_booking_id ?? '—'],
              [t('bookings.adults'), String(booking.adults)],
              [t('bookings.commission'), `${booking.commission_rate}%`],
              [t('bookings.netRevenue'), formatCurrency(booking.net_revenue)],
              [t('bookings.policeFiche'), booking.police_fiche_generated ? t('bookings.ficheGenerated') : t('bookings.ficheNotGenerated')],
            ] as [string, string][]).map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <span className="text-[#475569]">{label}</span>
                <span className="font-medium text-right max-w-[180px] truncate text-[#0A1F1C]">{value}</span>
              </div>
            ))}
            {booking.special_requests && (
              <div className="pt-1 border-t border-[#F0F4F7]">
                <p className="text-[#94A3B8] text-xs mb-0.5">{t('bookings.specialRequests')}</p>
                <p className="text-xs text-[#0A1F1C]">{booking.special_requests}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment summary */}
        <Card className="bg-white border border-[#E8ECF0] rounded-[16px] shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-widest text-[#94A3B8]">{t('payments.title')}</CardTitle>
              {dynamicBalance !== 0 && (
                <Button
                  size="sm"
                  variant={dynamicBalance < 0 ? "destructive" : "outline"}
                  className={cn("h-7 text-xs rounded-[8px]", dynamicBalance < 0 ? "bg-red-600 hover:bg-red-700 text-white border-0" : "")}
                  onClick={openPaymentDialog}
                >
                  {dynamicBalance < 0 ? t('bookings.refund') : <><Plus className="w-3 h-3 mr-1" />{t('common.add')}</>}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between text-[#475569]">
              <span>{t('bookings.roomNights')} ({booking.nights} {booking.nights === 1 ? t('common.night') : t('common.nights')})</span>
              <span>{formatCurrency(booking.total_price)}</span>
            </div>

            {/* Extras list with delete + add */}
            {localExtras.map((e) => (
              <div key={e.id} className="flex justify-between items-center text-xs text-[#475569] pl-2 group">
                <span className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleDeleteExtra(e.id)}
                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity"
                    title="Supprimer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  {e.name} ×{e.quantity}
                </span>
                <span>{formatCurrency(e.quantity * e.unit_price)}</span>
              </div>
            ))}

            {/* Inline add extra form */}
            {addingExtra ? (
              <form onSubmit={handleAddExtra} className="pl-2 space-y-2 pt-1">
                <div className="grid grid-cols-5 gap-1.5">
                  <Input
                    className="col-span-2 h-7 text-xs"
                    placeholder="Nom (petit-déj…)"
                    value={extraForm.name}
                    onChange={(e) => setExtraForm((p) => ({ ...p, name: e.target.value }))}
                    autoFocus
                  />
                  <Input
                    className="h-7 text-xs"
                    type="number"
                    min={1}
                    placeholder="Qté"
                    value={extraForm.quantity}
                    onChange={(e) => setExtraForm((p) => ({ ...p, quantity: e.target.value }))}
                  />
                  <Input
                    className="h-7 text-xs"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Prix"
                    value={extraForm.unit_price}
                    onChange={(e) => setExtraForm((p) => ({ ...p, unit_price: e.target.value }))}
                  />
                  <div className="flex gap-1">
                    <button type="submit" disabled={savingExtra} className="flex-1 flex items-center justify-center rounded-[6px] bg-[#0F6E56] text-white hover:bg-[#0c5a46] transition-colors">
                      {savingExtra ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    </button>
                    <button type="button" onClick={() => setAddingExtra(false)} className="flex-1 flex items-center justify-center rounded-[6px] border hover:bg-gray-50 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setAddingExtra(true)}
                className="flex items-center gap-1 text-xs text-[#0F6E56] hover:text-[#0c5a46] pl-2 transition-colors"
              >
                <Plus className="w-3 h-3" /> Ajouter un supplément
              </button>
            )}
            <div className="flex justify-between font-bold text-[#0A1F1C] pt-1 border-t border-[#F0F4F7]">
              <span>{t('bookings.grandTotal')}</span>
              <span>{formatCurrency(grandTotal)}</span>
            </div>
            <div className="flex justify-between text-[#0F6E56]">
              <span>{t('bookings.totalPaid')}</span>
              <span>{formatCurrency(totalPaid)}</span>
            </div>
            <div className={cn('flex justify-between font-semibold border-t border-[#F0F4F7] pt-2', dynamicBalance > 0 ? 'text-amber-600' : dynamicBalance < 0 ? 'text-blue-600' : 'text-[#0F6E56]')}>
              <span>{t('bookings.balance')}</span>
              <span>{dynamicBalance > 0 ? `${t('bookings.remaining')} : ${formatCurrency(dynamicBalance)}` : dynamicBalance < 0 ? `${t('bookings.refundDue')} : ${formatCurrency(Math.abs(dynamicBalance))}` : t('bookings.settled')}</span>
            </div>

            {payments.length > 0 && (
              <div className="border-t border-[#F0F4F7] pt-2 space-y-1.5 mt-1">
                {payments.map((p) => (
                  <div key={p.id} className="flex justify-between text-xs">
                    <span className="text-[#94A3B8]">
                      {methodLabels[p.method]} · {new Date(p.payment_date).toLocaleDateString('fr-FR')}
                    </span>
                    <span className={p.type === 'refund' ? 'text-red-500' : 'text-[#0A1F1C]'}>
                      {p.type === 'refund' ? '−' : '+'}{formatCurrency(p.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Unpaid balance banner */}
      {dynamicBalance > 0 && booking.status === 'checked_in' && (
        <div className="flex items-center gap-3 rounded-[16px] border border-red-200 bg-red-50 p-4">
          <div className="w-10 h-10 bg-red-100 rounded-2xl flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-red-900">Paiement en attente : {formatCurrency(dynamicBalance)}</p>
            <p className="text-xs text-red-700 mt-0.5">Ce client doit encore payer avant le départ. Le checkout est bloqué.</p>
          </div>
          <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white rounded-[10px] flex-shrink-0" onClick={openPaymentDialog}>
            <Plus className="w-3 h-3 mr-1" />Encaisser
          </Button>
        </div>
      )}

      {/* Status actions */}
      <Card className="bg-white border border-[#E8ECF0] rounded-[16px] shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        <CardHeader className="pb-3"><CardTitle className="text-[11px] font-semibold uppercase tracking-widest text-[#94A3B8]">{t('bookings.changeStatus')}</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {booking.status !== 'checked_in' && booking.status !== 'checked_out' && booking.status !== 'cancelled' && (
              <Button size="sm" className="bg-[#0F6E56] hover:bg-[#0c5a46]" onClick={() => handleStatusChange('checked_in')} disabled={loading}>
                <CheckCircle2 className="w-3 h-3 mr-1" />{t('bookings.action.checkin')}
              </Button>
            )}
            {booking.status === 'checked_in' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (dynamicBalance > 0) {
                    setCheckoutConfirmOpen(true)
                    return
                  }
                  handleStatusChange('checked_out')
                }}
                disabled={loading}
              >
                <CheckCircle2 className="w-3 h-3 mr-1" />{t('bookings.action.checkout')}
              </Button>
            )}
            {booking.status !== 'confirmed' && booking.status !== 'checked_in' && booking.status !== 'checked_out' && (
              <Button size="sm" variant="outline" onClick={() => handleStatusChange('confirmed')} disabled={loading}>
                {t('bookings.action.confirm')}
              </Button>
            )}
            {booking.status !== 'cancelled' && booking.status !== 'checked_out' && (
              <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => handleStatusChange('cancelled')} disabled={loading}>
                <XCircle className="w-3 h-3 mr-1" />{t('bookings.action.cancel')}
              </Button>
            )}
            {booking.status !== 'no_show' && booking.status !== 'checked_in' && booking.status !== 'checked_out' && (
              <Button size="sm" variant="outline" className="text-amber-600 border-amber-200"
                onClick={() => handleStatusChange('no_show')} disabled={loading}>
                {t('bookings.action.noshow')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Documents & messaging */}
      <Card className="bg-white border border-[#E8ECF0] rounded-[16px] shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        <CardHeader className="pb-3"><CardTitle className="text-[11px] font-semibold uppercase tracking-widest text-[#94A3B8]">{t('bookings.documentsMessages')}</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={handleGenerateInvoice}>
              <Receipt className="w-3 h-3 mr-1" />{t('bookings.invoicePdf')}
            </Button>
            <Button size="sm" variant="outline" onClick={handleGeneratePDF}>
              <FileText className="w-3 h-3 mr-1" />{t('bookings.policeFicheBtn')}
            </Button>
            {(guest?.whatsapp ?? guest?.phone) && (
              <>
                <Button size="sm" variant="outline" className="text-[#25D366] border-[#25D366]/30"
                  onClick={() => handleWhatsApp('welcome')}>
                  <MessageSquare className="w-3 h-3 mr-1" />{t('bookings.wa.welcome')}
                </Button>
                {booking.status === 'confirmed' && (
                  <Button size="sm" variant="outline" className="text-blue-600 border-blue-200"
                    onClick={handleSendPreArrival}>
                    <Link2 className="w-3 h-3 mr-1" />{t('bookings.preArrivalForm')}
                    {booking.pre_checkin_completed && <span className="ml-1 text-[#0F6E56]">✓</span>}
                  </Button>
                )}
                <Button size="sm" variant="outline" className="text-[#25D366] border-[#25D366]/30"
                  onClick={() => handleWhatsApp('checkout_reminder')}>
                  <MessageSquare className="w-3 h-3 mr-1" />{t('bookings.wa.checkoutReminder')}
                </Button>
                {dynamicBalance > 0 && (
                  <Button size="sm" variant="outline" className="text-amber-600 border-amber-200"
                    onClick={() => handleWhatsApp('payment_reminder')}>
                    <MessageSquare className="w-3 h-3 mr-1" />{t('bookings.wa.paymentReminder')}
                  </Button>
                )}
                {booking.status === 'checked_out' && (
                  <Button size="sm" variant="outline" className="text-amber-500 border-amber-200"
                    onClick={handleReviewRequest}>
                    <Star className="w-3 h-3 mr-1" />{t('bookings.wa.reviewRequest')}
                  </Button>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Internal notes */}
      <Card className="bg-white border border-[#E8ECF0] rounded-[16px] shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-widest text-[#94A3B8]">{t('bookings.internalNotes')}</CardTitle>
            {!editingNotes ? (
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingNotes(true)}>
                <Edit2 className="w-3 h-3 mr-1" />{t('common.edit')}
              </Button>
            ) : (
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-[#0F6E56]" onClick={handleSaveNotes}>
                  <Check className="w-3 h-3" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500" onClick={() => { setEditingNotes(false); setNotes(booking.internal_notes ?? '') }}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {editingNotes ? (
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="resize-none text-sm" placeholder={t('bookings.notesPlaceholder')} />
          ) : (
            <p className="text-sm text-muted-foreground">{notes || t('bookings.noNotes')}</p>
          )}
        </CardContent>
      </Card>

      {/* Checkout with outstanding balance — confirm dialog */}
      <Dialog open={checkoutConfirmOpen} onOpenChange={setCheckoutConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Solde impayé — {formatCurrency(dynamicBalance)}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <p className="text-sm text-muted-foreground">
              Ce client a un solde en attente avant le départ. Que voulez-vous faire&nbsp;?
            </p>
            <div className="rounded-[10px] bg-[#F4F6F8] p-3 space-y-1 text-sm">
              <div className="flex justify-between text-[#475569]">
                <span>Hébergement</span>
                <span>{formatCurrency(booking.total_price)}</span>
              </div>
              {extrasTotal > 0 && (
                <div className="flex justify-between text-[#475569]">
                  <span>Suppléments</span>
                  <span>{formatCurrency(extrasTotal)}</span>
                </div>
              )}
              <div className="flex justify-between text-[#475569]">
                <span>Payé</span>
                <span className="text-[#0F6E56]">−{formatCurrency(totalPaid)}</span>
              </div>
              <div className="flex justify-between font-semibold text-amber-700 border-t border-[#E8ECF0] pt-1">
                <span>Reste dû</span>
                <span>{formatCurrency(dynamicBalance)}</span>
              </div>
            </div>
            <Button
              className="w-full bg-[#0F6E56] hover:bg-[#0c5a46]"
              onClick={() => { setCheckoutConfirmOpen(false); openPaymentDialog() }}
            >
              <Plus className="w-3 h-3 mr-1" />Encaisser le solde
            </Button>
            <Button
              variant="outline"
              className="w-full text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => { setCheckoutConfirmOpen(false); handleStatusChange('checked_out') }}
              disabled={loading}
            >
              Checkout sans paiement (annuler le solde)
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add payment dialog */}
      <Dialog open={paymentDialog} onOpenChange={setPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dynamicBalance < 0 ? t('bookings.processRefund') : t('payments.record')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>{t('payments.amountMad')} *</Label>
              <Input type="number" value={payForm.amount} onChange={(e) => setPayForm(p => ({ ...p, amount: e.target.value }))} placeholder="0" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('payments.method')}</Label>
                <Select value={payForm.method} onValueChange={(v) => setPayForm(p => ({ ...p, method: v ?? 'cash' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">{t('payments.cash')}</SelectItem>
                    <SelectItem value="virement">{t('payments.virement')}</SelectItem>
                    <SelectItem value="cmi">{t('payments.cmi')}</SelectItem>
                    <SelectItem value="wave">{t('payments.wave')}</SelectItem>
                    <SelectItem value="other">{t('payments.other')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('payments.reference')}</Label>
                <Input value={payForm.reference} onChange={(e) => setPayForm(p => ({ ...p, reference: e.target.value }))} placeholder={t('payments.referencePlaceholder')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t('common.notes')}</Label>
              <Input value={payForm.notes} onChange={(e) => setPayForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
            <Button className="w-full bg-[#0F6E56] hover:bg-[#0c5a46]" onClick={handleAddPayment} disabled={loading || !payForm.amount}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {t('common.save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
