'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'
import { Plus, X, ShoppingBag, Loader2 } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { cn } from '@/lib/utils'
import { useT } from '@/app/context/LanguageContext'

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
  currentGuests: CurrentGuestBooking[]
  catalog: CatalogItem[]
}

export function ExtrasClient({ propertyId, currentGuests: initial, catalog }: Props) {
  const t = useT()
  const [guests, setGuests] = useState<CurrentGuestBooking[]>(initial)
  const [adding, setAdding] = useState<string | null>(null)
  const [customOpen, setCustomOpen] = useState<string | null>(null)
  const [customForm, setCustomForm] = useState({ name: '', quantity: '1', unit_price: '' })

  async function addPreset(bookingId: string, name: string, price: number) {
    setAdding(bookingId)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('booking_extras')
        .insert({ booking_id: bookingId, property_id: propertyId, name, quantity: 1, unit_price: price })
        .select()
        .single()
      if (error) throw error
      setGuests((prev) => prev.map((g) =>
        g.id === bookingId ? { ...g, extras: [...g.extras, data] } : g
      ))
      toast.success(t('extras.added'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setAdding(null)
    }
  }

  async function addCustom(bookingId: string) {
    if (!customForm.name || !customForm.unit_price) return
    setAdding(bookingId)
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
      setGuests((prev) => prev.map((g) =>
        g.id === bookingId ? { ...g, extras: [...g.extras, data] } : g
      ))
      setCustomForm({ name: '', quantity: '1', unit_price: '' })
      setCustomOpen(null)
      toast.success(t('extras.customAdded'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setAdding(null)
    }
  }

  async function deleteExtra(bookingId: string, extraId: string) {
    try {
      const supabase = createClient()
      const { error } = await supabase.from('booking_extras').delete().eq('id', extraId)
      if (error) throw error
      setGuests((prev) => prev.map((g) =>
        g.id === bookingId ? { ...g, extras: g.extras.filter((e) => e.id !== extraId) } : g
      ))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.error'))
    }
  }

  const totalExtrasToday = guests.reduce((s, g) =>
    s + g.extras.reduce((es, e) => es + e.quantity * e.unit_price, 0), 0
  )

  return (
    <div className="p-6 space-y-5 max-w-3xl mx-auto hp-page-in">
      {/* Header summary */}
      {guests.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border border-[#E8ECF0] rounded-[16px] p-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
            <p className="text-xs text-[#94A3B8] mb-1">{t('extras.guestsInStay')}</p>
            <p className="text-2xl font-black text-[#0A1F1C]">{guests.length}</p>
          </div>
          <div className="bg-white border border-[#E8ECF0] rounded-[16px] p-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
            <p className="text-xs text-[#94A3B8] mb-1">{t('extras.totalExtras')}</p>
            <p className="text-2xl font-black text-[#0F6E56]">{formatCurrency(totalExtrasToday)}</p>
          </div>
        </div>
      )}

      {guests.length === 0 ? (
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
          {guests.map((booking) => {
            const extrasTotal = booking.extras.reduce((s, e) => s + e.quantity * e.unit_price, 0)
            const isAdding = adding === booking.id
            const isCustomOpen = customOpen === booking.id

            return (
              <div key={booking.id} className="bg-white border border-[#E8ECF0] rounded-[20px] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
                {/* Guest header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="font-semibold text-[#0A1F1C] text-[15px]">
                      {booking.guest?.first_name} {booking.guest?.last_name}
                    </p>
                    <p className="text-xs text-[#94A3B8] mt-0.5">
                      {booking.bed?.room?.name} · {t('extras.bed')} {booking.bed?.name} · {t('extras.departure')} {booking.check_out_date}
                    </p>
                  </div>
                  {extrasTotal > 0 && (
                    <span className="text-sm font-semibold text-[#0F6E56] bg-[#0F6E56]/8 px-2.5 py-1 rounded-full">
                      {formatCurrency(extrasTotal)}
                    </span>
                  )}
                </div>

                {/* Existing extras */}
                {booking.extras.length > 0 && (
                  <div className="mb-4 space-y-1.5">
                    {booking.extras.map((extra) => (
                      <div key={extra.id} className="flex items-center justify-between bg-[#F8FAFC] rounded-[10px] px-3 py-2">
                        <span className="text-sm text-[#0A1F1C]">
                          {extra.quantity > 1 ? `${extra.quantity}× ` : ''}{extra.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[#0F6E56]">
                            {formatCurrency(extra.quantity * extra.unit_price)}
                          </span>
                          <button
                            onClick={() => deleteExtra(booking.id, extra.id)}
                            className="text-[#C0CBD7] hover:text-destructive transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Catalog quick-add buttons */}
                <div className="flex flex-wrap gap-2 mb-1">
                  {catalog.length === 0 ? (
                    <a
                      href="/settings/extras"
                      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-dashed border-[#0F6E56]/40 text-[#0F6E56] hover:bg-[#0F6E56]/5 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      Configurer mon catalogue de suppléments
                    </a>
                  ) : (
                    catalog.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => addPreset(booking.id, item.name, item.default_price)}
                        disabled={isAdding}
                        className={cn(
                          'inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all',
                          'border-[#E8ECF0] bg-white hover:border-[#0F6E56] hover:text-[#0F6E56] hover:bg-[#0F6E56]/5',
                          'disabled:opacity-40 disabled:cursor-not-allowed'
                        )}
                      >
                        <span>{item.emoji}</span>
                        {item.name}
                        <span className="text-[#94A3B8]">· {item.default_price} MAD</span>
                      </button>
                    ))
                  )}
                  <button
                    onClick={() => {
                      setCustomOpen(isCustomOpen ? null : booking.id)
                      setCustomForm({ name: '', quantity: '1', unit_price: '' })
                    }}
                    className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border border-dashed border-[#0F6E56]/40 text-[#0F6E56] hover:bg-[#0F6E56]/5 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    {t('extras.other')}
                  </button>
                </div>

                {/* Custom form */}
                {isCustomOpen && (
                  <div className="mt-3 pt-3 border-t border-[#E8ECF0]">
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        placeholder={t('common.name')}
                        value={customForm.name}
                        onChange={(e) => setCustomForm((p) => ({ ...p, name: e.target.value }))}
                        className="col-span-3 sm:col-span-1 text-sm h-9 border-[#E8ECF0] rounded-[10px]"
                      />
                      <Input
                        type="number"
                        placeholder={t('extras.qty')}
                        value={customForm.quantity}
                        onChange={(e) => setCustomForm((p) => ({ ...p, quantity: e.target.value }))}
                        className="text-sm h-9 border-[#E8ECF0] rounded-[10px]"
                      />
                      <Input
                        type="number"
                        placeholder={t('extras.priceMad')}
                        value={customForm.unit_price}
                        onChange={(e) => setCustomForm((p) => ({ ...p, unit_price: e.target.value }))}
                        className="text-sm h-9 border-[#E8ECF0] rounded-[10px]"
                      />
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Button
                        size="sm"
                        className="bg-[#0F6E56] hover:bg-[#0c5a46] h-8 text-xs"
                        onClick={() => addCustom(booking.id)}
                        disabled={isAdding || !customForm.name || !customForm.unit_price}
                      >
                        {isAdding ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
                        {t('common.add')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs border-[#E8ECF0]"
                        onClick={() => setCustomOpen(null)}
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
    </div>
  )
}
