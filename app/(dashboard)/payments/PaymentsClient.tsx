'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatCurrency, formatTime } from '@/lib/utils'
import { PAYMENT_METHODS } from '@/lib/constants'
import { buildWhatsAppLink, WHATSAPP_TEMPLATES } from '@/lib/whatsapp/templates'
import { Plus, DollarSign, MessageSquare, Loader2, Banknote, CheckCircle2, ShoppingBag, Trash2, X } from 'lucide-react'
import type { Guest, Booking, Payment } from '@/types'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/shared/EmptyState'
import { useSession, useCanDo } from '@/app/context/SessionContext'
import { logActivity } from '@/lib/activity'
import { useT } from '@/app/context/LanguageContext'

interface PendingBooking {
  id: string
  total_price: number
  check_out_date: string
  amount_paid: number
  balance_due: number
  guest: { first_name: string; last_name: string; phone?: string; whatsapp?: string } | null
  bed: { name: string; room: { name: string } | null } | null
}

export interface CurrentGuestBooking {
  id: string
  check_in_date: string
  check_out_date: string
  guest: { id: string; first_name: string; last_name: string } | null
  bed: { name: string; room: { name: string } | null } | null
  extras: { id: string; name: string; quantity: number; unit_price: number; created_at: string }[]
}

type CatalogItem = {
  id: string
  name: string
  emoji: string
  default_price: number
}

interface Props {
  propertyId: string
  todayPayments: (Payment & { guest?: Guest | null; booking?: Booking | null })[]
  pendingBookings: PendingBooking[]
  bookingsForModal: { id: string; check_in_date: string; check_out_date: string; total_price: number; guest: { first_name: string; last_name: string } | null }[]
  currentGuests: CurrentGuestBooking[]
  catalog: CatalogItem[]
}

export function PaymentsClient({ propertyId, todayPayments, pendingBookings, bookingsForModal, currentGuests: initialCurrentGuests, catalog }: Props) {
  const router = useRouter()
  const t = useT()
  const session = useSession()
  const canViewRevenue = useCanDo('view_revenue')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  // Extras (Suppléments tab)
  const [currentGuests, setCurrentGuests] = useState<CurrentGuestBooking[]>(initialCurrentGuests)
  const [extraCustomOpen, setExtraCustomOpen] = useState<string | null>(null) // booking id
  const [customForm, setCustomForm] = useState({ name: '', quantity: '1', unit_price: '' })
  const [extraAdding, setExtraAdding] = useState<string | null>(null) // booking id being saved

  async function handleAddPreset(bookingId: string, name: string, price: number) {
    setExtraAdding(bookingId)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('booking_extras')
        .insert({ booking_id: bookingId, property_id: propertyId, name, quantity: 1, unit_price: price })
        .select()
        .single()
      if (error) throw error
      setCurrentGuests((prev) => prev.map((g) =>
        g.id === bookingId ? { ...g, extras: [...g.extras, data] } : g
      ))
      toast.success(t('extras.added'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setExtraAdding(null)
    }
  }

  async function handleAddCustomExtra(bookingId: string) {
    if (!customForm.name || !customForm.unit_price) return
    setExtraAdding(bookingId)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('booking_extras')
        .insert({
          booking_id: bookingId,
          property_id: propertyId,
          name: customForm.name,
          quantity: parseFloat(customForm.quantity) || 1,
          unit_price: parseFloat(customForm.unit_price),
        })
        .select()
        .single()
      if (error) throw error
      setCurrentGuests((prev) => prev.map((g) =>
        g.id === bookingId ? { ...g, extras: [...g.extras, data] } : g
      ))
      setCustomForm({ name: '', quantity: '1', unit_price: '' })
      setExtraCustomOpen(null)
      toast.success(t('extras.customAdded'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setExtraAdding(null)
    }
  }

  async function handleDeleteExtra(bookingId: string, extraId: string) {
    try {
      const supabase = createClient()
      const { error } = await supabase.from('booking_extras').delete().eq('id', extraId)
      if (error) throw error
      setCurrentGuests((prev) => prev.map((g) =>
        g.id === bookingId ? { ...g, extras: g.extras.filter((e) => e.id !== extraId) } : g
      ))
      toast.success(t('bookings.extraDeleted'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.error'))
    }
  }

  // Cash reconciliation
  const [actualCash, setActualCash] = useState('')

  const [form, setForm] = useState({
    booking_id: '',
    amount: '',
    method: 'cash',
    reference: '',
    notes: '',
  })

  const totalToday = todayPayments.reduce((s, p) => s + (p.type === 'refund' ? -p.amount : p.amount), 0)
  const cashToday = todayPayments
    .filter((p) => p.method === 'cash')
    .reduce((s, p) => s + (p.type === 'refund' ? -p.amount : p.amount), 0)
  const virementToday = todayPayments
    .filter((p) => p.method === 'virement')
    .reduce((s, p) => s + (p.type === 'refund' ? -p.amount : p.amount), 0)
  const cmiToday = todayPayments
    .filter((p) => p.method === 'cmi')
    .reduce((s, p) => s + (p.type === 'refund' ? -p.amount : p.amount), 0)

  const cashDiff = actualCash ? parseFloat(actualCash) - cashToday : null

  async function handleAddPayment() {
    if (!form.amount) return
    setLoading(true)
    try {
      const supabase = createClient()
      await supabase.from('payments').insert({
        property_id: propertyId,
        booking_id: form.booking_id || null,
        guest_id: null,
        amount: parseFloat(form.amount),
        method: form.method,
        type: 'payment',
        status: 'completed',
        reference: form.reference || null,
        notes: form.notes || null,
        payment_date: new Date().toISOString(),
      })
      const bk = bookingsForModal.find((b) => b.id === form.booking_id)
      const guestName = bk?.guest ? `${bk.guest.first_name} ${bk.guest.last_name}` : null
      logActivity({
        propertyId,
        userId: session?.userId ?? null,
        staffName: session?.staffName ?? null,
        actionType: 'payment',
        entityType: 'payment',
        description: `Paiement ${parseFloat(form.amount)} MAD (${form.method})${guestName ? ` — ${guestName}` : ''}`,
        meta: { amount: parseFloat(form.amount), method: form.method, guest_name: guestName },
      })
      toast.success(t('payments.saved'))
      setDialogOpen(false)
      setForm({ booking_id: '', amount: '', method: 'cash', reference: '', notes: '' })
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto hp-page-in bg-[#F4F6F8] min-h-full">
      {/* Summary row — hidden when revenue is restricted */}
      {canViewRevenue && (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: t('payments.totalToday'), value: formatCurrency(totalToday), highlight: true },
          { label: t('payments.cash'), value: formatCurrency(cashToday) },
          { label: t('payments.virement'), value: formatCurrency(virementToday) },
          { label: t('payments.cmi'), value: formatCurrency(cmiToday) },
        ].map(({ label, value, highlight }) => (
          <div key={label} className="bg-white border border-[#E8ECF0] rounded-[16px] p-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
            <p className="text-xs text-[#94A3B8] mb-1">{label}</p>
            <p className={cn('text-xl font-semibold', highlight ? 'text-[#0F6E56]' : 'text-[#0A1F1C]')}>{value}</p>
          </div>
        ))}
      </div>
      )}

      <div className="flex justify-end">
        <Button className="bg-[#0F6E56] hover:bg-[#0c5a46]" onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          {t('payments.addPayment')}
        </Button>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('payments.record')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label>{t('payments.bookingOptional')}</Label>
                <Select value={form.booking_id} onValueChange={(v) => setForm((p) => ({ ...p, booking_id: v ?? '' }))}>
                  <SelectTrigger>
                    <span className={form.booking_id ? 'text-sm truncate' : 'text-sm text-muted-foreground'}>
                      {form.booking_id
                        ? (() => { const b = bookingsForModal.find(b => b.id === form.booking_id); return b ? `${b.guest?.first_name ?? ''} ${b.guest?.last_name ?? ''} — ${b.check_in_date}` : t('common.selectDots') })()
                        : t('payments.selectBooking')}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {bookingsForModal.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.guest?.first_name} {b.guest?.last_name} — {b.check_in_date} → {b.check_out_date}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('payments.amountMad')} *</Label>
                <Input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('payments.method')}</Label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(PAYMENT_METHODS).map(([k, v]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, method: k }))}
                      className={cn(
                        'rounded-lg border p-2 text-sm text-center transition-colors',
                        form.method === k
                          ? 'border-[#0F6E56] bg-[#0F6E56]/10 text-[#0F6E56] font-medium'
                          : 'hover:border-[#0F6E56]/30'
                      )}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              {form.method !== 'cash' && (
                <div className="space-y-1.5">
                  <Label>{t('payments.reference')}</Label>
                  <Input
                    value={form.reference}
                    onChange={(e) => setForm((p) => ({ ...p, reference: e.target.value }))}
                    placeholder={t('payments.referencePlaceholder')}
                  />
                </div>
              )}
              <Button
                className="w-full bg-[#0F6E56] hover:bg-[#0c5a46]"
                onClick={handleAddPayment}
                disabled={loading || !form.amount}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <DollarSign className="w-4 h-4 mr-2" />}
                {t('common.save')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="today">
        <TabsList className="bg-white border border-[#E8ECF0] rounded-[14px] p-1 flex gap-1 h-auto flex-wrap">
          <TabsTrigger value="today" className="rounded-[10px] px-4 py-2 text-sm data-[state=active]:bg-[#0F6E56] data-[state=active]:text-white data-[state=inactive]:text-[#94A3B8] transition-colors">{t('payments.tabToday')} ({todayPayments.length})</TabsTrigger>
          <TabsTrigger value="pending" className="rounded-[10px] px-4 py-2 text-sm data-[state=active]:bg-[#0F6E56] data-[state=active]:text-white data-[state=inactive]:text-[#94A3B8] transition-colors">{t('payments.tabPending')} ({pendingBookings.length})</TabsTrigger>
          <TabsTrigger value="extras" className="rounded-[10px] px-4 py-2 text-sm data-[state=active]:bg-[#0F6E56] data-[state=active]:text-white data-[state=inactive]:text-[#94A3B8] transition-colors">{t('payments.tabExtras')} ({currentGuests.length})</TabsTrigger>
          <TabsTrigger value="reconciliation" className="rounded-[10px] px-4 py-2 text-sm data-[state=active]:bg-[#0F6E56] data-[state=active]:text-white data-[state=inactive]:text-[#94A3B8] transition-colors">{t('payments.tabReconciliation')}</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="mt-4">
          {todayPayments.length === 0 ? (
            <div className="rounded-[16px] border-2 border-dashed border-[#E8ECF0] bg-white">
              <EmptyState
                icon={Banknote}
                iconBg="bg-[#0F6E56]/10"
                iconColor="text-[#0F6E56]"
                title={t('payments.noPaymentsToday')}
                description={t('payments.noPaymentsTodayDesc')}
                action={{
                  label: t('payments.record'),
                  onClick: () => setDialogOpen(true),
                }}
              />
            </div>
          ) : (
            <div className="bg-white border border-[#E8ECF0] rounded-[16px] overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
              {todayPayments.map((p, i) => {
                const guest = p.guest as { first_name: string; last_name: string } | null
                return (
                  <div key={p.id} className={cn('px-4 py-3.5 flex items-center justify-between', i < todayPayments.length - 1 && 'border-b border-[#F0F4F7]')}>
                    <div>
                      <p className="font-medium text-sm text-[#0A1F1C]">
                        {guest ? `${guest.first_name} ${guest.last_name}` : t('payments.payment')}
                      </p>
                      <p className="text-xs text-[#94A3B8] mt-0.5">
                        {PAYMENT_METHODS[p.method] ?? p.method} · {formatTime(p.payment_date)}
                      </p>
                    </div>
                    <p className="font-semibold text-[#0F6E56]">{formatCurrency(p.amount)}</p>
                  </div>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pending" className="mt-4">
          {pendingBookings.length === 0 ? (
            <div className="rounded-[16px] border-2 border-dashed border-[#E8ECF0] bg-white">
              <EmptyState
                icon={CheckCircle2}
                iconBg="bg-[#0F6E56]/10"
                iconColor="text-[#0F6E56]"
                title={t('payments.allPaid')}
                description={t('payments.allPaidDesc')}
              />
            </div>
          ) : (
            <div className="bg-white border border-[#E8ECF0] rounded-[16px] overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
              {pendingBookings.map((b, i) => (
                <div key={b.id} className={cn('px-4 py-3.5 flex items-center justify-between', i < pendingBookings.length - 1 && 'border-b border-[#F0F4F7]')}>
                  <div>
                    <p className="font-medium text-sm text-[#0A1F1C]">
                      {b.guest?.first_name} {b.guest?.last_name}
                    </p>
                    <p className="text-xs text-[#94A3B8] mt-0.5">
                      {t('bookings.checkout')}: {b.check_out_date} · {t('payments.paid')}: {formatCurrency(b.amount_paid)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-destructive">{formatCurrency(b.balance_due)}</p>
                    {b.guest?.whatsapp && (
                      <a
                        href={buildWhatsAppLink(
                          b.guest.whatsapp,
                          WHATSAPP_TEMPLATES.payment_reminder.fr(
                            { first_name: b.guest.first_name } as Guest,
                            b.balance_due
                          )
                        )}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Button variant="outline" size="sm" className="text-[#25D366] border-[#25D366]/30">
                          <MessageSquare className="w-3 h-3" />
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="extras" className="mt-4">
          {currentGuests.length === 0 ? (
            <div className="rounded-[16px] border-2 border-dashed border-[#E8ECF0] bg-white">
              <EmptyState
                icon={ShoppingBag}
                iconBg="bg-[#0F6E56]/10"
                iconColor="text-[#0F6E56]"
                title={t('extras.noGuests')}
                description={t('extras.noGuestsDesc')}
              />
            </div>
          ) : (
            <div className="space-y-3">
              {currentGuests.map((booking) => {
                const extrasTotal = booking.extras.reduce((s, e) => s + e.quantity * e.unit_price, 0)
                const isAddingThis = extraAdding === booking.id
                const isCustomOpen = extraCustomOpen === booking.id
                return (
                  <div key={booking.id} className="bg-white border border-[#E8ECF0] rounded-[16px] p-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
                    {/* Guest header */}
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-semibold text-[#0A1F1C]">
                          {booking.guest?.first_name} {booking.guest?.last_name}
                        </p>
                        <p className="text-xs text-[#94A3B8] mt-0.5">
                          {booking.bed?.room?.name} · {t('extras.bed')} {booking.bed?.name} · {t('extras.departure')} {booking.check_out_date}
                        </p>
                      </div>
                      {extrasTotal > 0 && (
                        <span className="text-sm font-semibold text-[#0F6E56]">{formatCurrency(extrasTotal)}</span>
                      )}
                    </div>

                    {/* Existing extras */}
                    {booking.extras.length > 0 && (
                      <div className="mb-3 space-y-1.5">
                        {booking.extras.map((extra) => (
                          <div key={extra.id} className="flex items-center justify-between bg-[#F8FAFC] rounded-[10px] px-3 py-2">
                            <span className="text-sm text-[#0A1F1C]">
                              {extra.quantity > 1 ? `${extra.quantity}× ` : ''}{extra.name}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-[#0F6E56]">{formatCurrency(extra.quantity * extra.unit_price)}</span>
                              <button
                                onClick={() => handleDeleteExtra(booking.id, extra.id)}
                                className="text-[#94A3B8] hover:text-destructive transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Catalog quick-add buttons */}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {catalog.length === 0 ? (
                        <a
                          href="/settings/extras"
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full border border-dashed border-[#0F6E56]/40 text-[#0F6E56] hover:bg-[#0F6E56]/5 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          Configurer mon catalogue
                        </a>
                      ) : catalog.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleAddPreset(booking.id, item.name, item.default_price)}
                          disabled={isAddingThis}
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full border border-[#E8ECF0] bg-white hover:border-[#0F6E56] hover:text-[#0F6E56] hover:bg-[#0F6E56]/5 transition-colors disabled:opacity-50"
                        >
                          <span>{item.emoji}</span>
                          {item.name} · {item.default_price} MAD
                        </button>
                      ))}
                      <button
                        onClick={() => {
                          setExtraCustomOpen(isCustomOpen ? null : booking.id)
                          setCustomForm({ name: '', quantity: '1', unit_price: '' })
                        }}
                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full border border-dashed border-[#0F6E56]/40 text-[#0F6E56] hover:bg-[#0F6E56]/5 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        {t('extras.other')}
                      </button>
                    </div>

                    {/* Custom extra form */}
                    {isCustomOpen && (
                      <div className="mt-2 pt-3 border-t border-[#E8ECF0]">
                        <div className="grid grid-cols-3 gap-2">
                          <div className="col-span-3 sm:col-span-1">
                            <Input
                              placeholder={t('common.name')}
                              value={customForm.name}
                              onChange={(e) => setCustomForm((p) => ({ ...p, name: e.target.value }))}
                              className="text-sm h-9 bg-white border-[#E8ECF0] rounded-[10px]"
                            />
                          </div>
                          <Input
                            type="number"
                            placeholder={t('extras.qty')}
                            value={customForm.quantity}
                            onChange={(e) => setCustomForm((p) => ({ ...p, quantity: e.target.value }))}
                            className="text-sm h-9 bg-white border-[#E8ECF0] rounded-[10px]"
                          />
                          <Input
                            type="number"
                            placeholder={t('extras.priceMad')}
                            value={customForm.unit_price}
                            onChange={(e) => setCustomForm((p) => ({ ...p, unit_price: e.target.value }))}
                            className="text-sm h-9 bg-white border-[#E8ECF0] rounded-[10px]"
                          />
                        </div>
                        <div className="flex gap-2 mt-2">
                          <Button
                            size="sm"
                            className="bg-[#0F6E56] hover:bg-[#0c5a46] h-8 text-xs"
                            onClick={() => handleAddCustomExtra(booking.id)}
                            disabled={isAddingThis || !customForm.name || !customForm.unit_price}
                          >
                            {isAddingThis ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                            {t('common.add')}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs border-[#E8ECF0]"
                            onClick={() => setExtraCustomOpen(null)}
                          >
                            {t('common.cancel')}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="reconciliation" className="mt-4">
          <div className="bg-white border border-[#E8ECF0] rounded-[16px] p-6 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
            <p className="text-[15px] font-semibold text-[#0A1F1C] mb-4">{t('payments.cashReconciliation')}</p>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-[#E8ECF0]">
                <span className="text-sm text-[#475569]">{t('payments.expectedCash')}</span>
                <span className="font-semibold text-[#0A1F1C]">{formatCurrency(cashToday)}</span>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px] font-medium text-[#475569]">{t('payments.actualCash')}</Label>
                <Input
                  type="number"
                  value={actualCash}
                  onChange={(e) => setActualCash(e.target.value)}
                  placeholder="0"
                  className="text-lg bg-white border-[#E8ECF0] rounded-[10px] h-10"
                />
              </div>
              {cashDiff !== null && (
                <div className={cn(
                  'rounded-[12px] p-4 text-center',
                  cashDiff === 0 ? 'bg-[#0F6E56]/10 text-[#0F6E56]' : 'bg-destructive/10 text-destructive'
                )}>
                  <p className="text-sm font-medium">
                    {cashDiff === 0
                      ? t('payments.balanced')
                      : cashDiff > 0
                      ? `${t('payments.surplus')}: ${formatCurrency(cashDiff)}`
                      : `${t('payments.shortage')}: ${formatCurrency(Math.abs(cashDiff))}`}
                  </p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
