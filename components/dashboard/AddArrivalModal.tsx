'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { BOOKING_SOURCES, NATIONALITIES } from '@/lib/constants'
import { toast } from 'sonner'
import { logActivity } from '@/lib/activity'
import {
  X,
  User,
  Phone,
  Globe,
  BedDouble,
  Calendar,
  DollarSign,
  FileText,
  Clock,
  Loader2,
  Sparkles,
  ChevronDown,
} from 'lucide-react'
import type { UserSession } from '@/types'
import { useT } from '@/app/context/LanguageContext'

// ── Types ────────────────────────────────────────────────────────────────────

interface RoomOption {
  id: string
  name: string
  type: string
}

interface BedOption {
  id: string
  name: string
  room_id: string
  base_price: number
  status: string
  room?: { name: string } | null
}

interface Props {
  open: boolean
  onClose: () => void
  propertyId: string
  session: UserSession | null
  rooms: RoomOption[]
  beds: BedOption[]
  onSuccess: () => void
}

// ── Component ────────────────────────────────────────────────────────────────

export function AddArrivalModal({
  open,
  onClose,
  propertyId,
  session,
  rooms,
  beds,
  onSuccess,
}: Props) {
  const supabase = createClient()
  const t = useT()

  // ── Form state ─────────────────────────────────────────────────────────
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [nationality, setNationality] = useState('')
  const [source, setSource] = useState('direct')
  const [selectedRoomId, setSelectedRoomId] = useState('')
  const [selectedBedId, setSelectedBedId] = useState('')
  const [checkInDate, setCheckInDate] = useState('')
  const [checkOutDate, setCheckOutDate] = useState('')
  const [totalPrice, setTotalPrice] = useState('')
  const [arrivalNotes, setArrivalNotes] = useState('')
  const [expectedTime, setExpectedTime] = useState('')
  const [saving, setSaving] = useState(false)

  // ── Filtered beds for selected room ────────────────────────────────────
  const filteredBeds = selectedRoomId
    ? beds.filter((b) => b.room_id === selectedRoomId)
    : beds

  const availableBeds = filteredBeds.filter(
    (b) => b.status === 'available' || b.status === 'dirty',
  )

  // ── Reset on open ──────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      const today = new Date().toISOString().split('T')[0]
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      setFirstName('')
      setLastName('')
      setPhone('')
      setNationality('')
      setSource('direct')
      setSelectedRoomId('')
      setSelectedBedId('')
      setCheckInDate(today)
      setCheckOutDate(tomorrow.toISOString().split('T')[0])
      setTotalPrice('')
      setArrivalNotes('')
      setExpectedTime('')
    }
  }, [open])

  // ── Auto-fill price from bed base_price × nights ───────────────────────
  useEffect(() => {
    if (selectedBedId && checkInDate && checkOutDate && !totalPrice) {
      const bed = beds.find((b) => b.id === selectedBedId)
      if (bed) {
        const nights = Math.max(
          1,
          Math.round(
            (new Date(checkOutDate).getTime() - new Date(checkInDate).getTime()) /
              86400000,
          ),
        )
        setTotalPrice(String(bed.base_price * nights))
      }
    }
  }, [selectedBedId, checkInDate, checkOutDate, beds, totalPrice])

  // ── Submit ─────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!firstName.trim() || !lastName.trim()) {
        toast.error(t('arrival.error.nameRequired'))
        return
      }
      if (!selectedBedId) {
        toast.error(t('arrival.error.bedRequired'))
        return
      }
      if (!checkInDate || !checkOutDate) {
        toast.error(t('arrival.error.datesRequired'))
        return
      }
      if (checkOutDate <= checkInDate) {
        toast.error(t('arrival.error.checkoutAfterCheckin'))
        return
      }

      setSaving(true)
      try {
        // 1. Create guest record
        const { data: guest, error: guestErr } = await supabase
          .from('guests')
          .insert({
            property_id: propertyId,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            phone: phone.trim() || null,
            whatsapp: phone.trim() || null,
            nationality: nationality || null,
          })
          .select('id, first_name, last_name')
          .single()

        if (guestErr) throw guestErr

        // 2. Create booking with status 'confirmed'
        const price = parseFloat(totalPrice) || 0
        const { data: booking, error: bookingErr } = await supabase
          .from('bookings')
          .insert({
            property_id: propertyId,
            guest_id: guest.id,
            bed_id: selectedBedId,
            source,
            status: 'confirmed',
            check_in_date: checkInDate,
            check_out_date: checkOutDate,
            total_price: price,
            arrival_notes: arrivalNotes.trim() || null,
            expected_arrival_time: expectedTime || null,
          })
          .select('id')
          .single()

        if (bookingErr) throw bookingErr

        // 3. Log activity
        const guestName = `${guest.first_name} ${guest.last_name}`
        logActivity({
          propertyId,
          userId: session?.userId ?? null,
          staffName: session?.staffName ?? null,
          actionType: 'booking_created',
          entityType: 'booking',
          entityId: booking.id,
          description: `Nouvelle arrivée prévue : ${guestName} (${new Date(checkInDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })})`,
          meta: {
            guest_name: guestName,
            check_in_date: checkInDate,
            source,
          },
        })

        toast.success(t('arrival.toast.saved').replace('{name}', guest.first_name), {
          description: `${new Date(checkInDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}`,
        })

        onSuccess()
        onClose()
      } catch (err) {
        console.error('Error creating arrival:', err)
        toast.error(t('arrival.toast.error'))
      } finally {
        setSaving(false)
      }
    },
    [
      firstName,
      lastName,
      phone,
      nationality,
      source,
      selectedBedId,
      checkInDate,
      checkOutDate,
      totalPrice,
      arrivalNotes,
      expectedTime,
      propertyId,
      session,
      supabase,
      onSuccess,
      onClose,
      t,
    ],
  )

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white w-full max-w-lg rounded-t-[28px] sm:rounded-[28px] shadow-2xl animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-2 fade-in duration-300 max-h-[90vh] flex flex-col">
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="w-9 h-[4px] rounded-full bg-black/10" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#E8ECF0]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#0F6E56]/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-[#0F6E56]" />
            </div>
            <div>
              <h2 className="text-lg font-black text-[#0A1F1C] tracking-tight">
                {t('arrival.title')}
              </h2>
              <p className="text-[11px] text-muted-foreground font-medium">
                {t('arrival.subtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-muted/50 hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Guest Info Section */}
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#94A3B8] flex items-center gap-2">
              <User className="w-3.5 h-3.5" />
              {t('arrival.section.guestInfo')}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-muted-foreground mb-1 block">
                  {t('checkin.step2.firstName')} *
                </label>
                <Input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Jean"
                  className="h-11 rounded-xl border-[#E8ECF0] text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-muted-foreground mb-1 block">
                  {t('checkin.step2.lastName')} *
                </label>
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Dupont"
                  className="h-11 rounded-xl border-[#E8ECF0] text-sm"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-muted-foreground mb-1 block">
                  <Phone className="w-3 h-3 inline mr-1" />
                  {t('checkin.step2.phone')}
                </label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+212 6XX XXX XXX"
                  className="h-11 rounded-xl border-[#E8ECF0] text-sm"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-muted-foreground mb-1 block">
                  <Globe className="w-3 h-3 inline mr-1" />
                  {t('checkin.step2.nationality')}
                </label>
                <div className="relative">
                  <select
                    value={nationality}
                    onChange={(e) => setNationality(e.target.value)}
                    className="w-full h-11 rounded-xl border border-[#E8ECF0] bg-white text-sm px-3 pr-8 appearance-none cursor-pointer focus:ring-0 focus:border-[#0F6E56]/30 transition-colors"
                  >
                    <option value="">{t('arrival.select')}</option>
                    {NATIONALITIES.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* Booking Details Section */}
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#94A3B8] flex items-center gap-2">
              <BedDouble className="w-3.5 h-3.5" />
              {t('arrival.section.bookingDetails')}
            </p>

            {/* Source */}
            <div>
              <label className="text-[11px] font-bold text-muted-foreground mb-2 block">
                {t('common.source')}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(BOOKING_SOURCES).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSource(key)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all',
                      source === key
                        ? 'bg-[#0F6E56] border-[#0F6E56] text-white'
                        : 'bg-white border-[#E8ECF0] text-muted-foreground hover:border-[#0F6E56]/30',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Room + Bed Selection */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-muted-foreground mb-1 block">
                  {t('arrival.room')}
                </label>
                <div className="relative">
                  <select
                    value={selectedRoomId}
                    onChange={(e) => {
                      setSelectedRoomId(e.target.value)
                      setSelectedBedId('')
                    }}
                    className="w-full h-11 rounded-xl border border-[#E8ECF0] bg-white text-sm px-3 pr-8 appearance-none cursor-pointer focus:ring-0 focus:border-[#0F6E56]/30 transition-colors"
                  >
                    <option value="">{t('arrival.allRooms')}</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-muted-foreground mb-1 block">
                  {t('arrival.bed')} *
                </label>
                <div className="relative">
                  <select
                    value={selectedBedId}
                    onChange={(e) => setSelectedBedId(e.target.value)}
                    className="w-full h-11 rounded-xl border border-[#E8ECF0] bg-white text-sm px-3 pr-8 appearance-none cursor-pointer focus:ring-0 focus:border-[#0F6E56]/30 transition-colors"
                    required
                  >
                    <option value="">{t('arrival.select')}</option>
                    {availableBeds.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.room?.name ? `${b.room.name} — ` : ''}
                        {b.name} ({b.base_price} MAD/nuit)
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-muted-foreground mb-1 block">
                  <Calendar className="w-3 h-3 inline mr-1" />
                  {t('arrival.checkinDate')} *
                </label>
                <Input
                  type="date"
                  value={checkInDate}
                  onChange={(e) => setCheckInDate(e.target.value)}
                  className="h-11 rounded-xl border-[#E8ECF0] text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-muted-foreground mb-1 block">
                  <Calendar className="w-3 h-3 inline mr-1" />
                  {t('arrival.checkoutDate')} *
                </label>
                <Input
                  type="date"
                  value={checkOutDate}
                  onChange={(e) => setCheckOutDate(e.target.value)}
                  min={checkInDate}
                  className="h-11 rounded-xl border-[#E8ECF0] text-sm"
                  required
                />
              </div>
            </div>

            {/* Price */}
            <div>
              <label className="text-[11px] font-bold text-muted-foreground mb-1 block">
                <DollarSign className="w-3 h-3 inline mr-1" />
                {t('arrival.totalPrice')}
              </label>
              <Input
                type="number"
                value={totalPrice}
                onChange={(e) => setTotalPrice(e.target.value)}
                placeholder="0"
                min="0"
                step="10"
                className="h-11 rounded-xl border-[#E8ECF0] text-sm"
              />
            </div>
          </div>

          {/* Notes Section */}
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#94A3B8] flex items-center gap-2">
              <FileText className="w-3.5 h-3.5" />
              {t('arrival.section.notes')}
            </p>

            <div>
              <label className="text-[11px] font-bold text-muted-foreground mb-1 block">
                <Clock className="w-3 h-3 inline mr-1" />
                {t('arrival.expectedTime')}
              </label>
              <Input
                type="time"
                value={expectedTime}
                onChange={(e) => setExpectedTime(e.target.value)}
                className="h-11 rounded-xl border-[#E8ECF0] text-sm"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-muted-foreground mb-1 block">
                {t('arrival.notesLabel')}
              </label>
              <textarea
                value={arrivalNotes}
                onChange={(e) => setArrivalNotes(e.target.value)}
                placeholder="Ex: Vol Ryanair FR4521, arrivée ~16h. Demande lit bas."
                rows={2}
                className="w-full rounded-xl border border-[#E8ECF0] bg-white text-sm px-3 py-2.5 resize-none focus:ring-0 focus:border-[#0F6E56]/30 transition-colors placeholder:text-muted-foreground/50"
              />
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#E8ECF0] flex items-center justify-between gap-3 bg-[#F8FAFC] rounded-b-[28px]">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="rounded-xl font-bold text-muted-foreground"
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || !firstName.trim() || !lastName.trim() || !selectedBedId}
            className="bg-[#0F6E56] hover:bg-[#0c5a46] text-white rounded-xl h-11 px-8 font-black text-xs uppercase tracking-wider shadow-lg hover:shadow-[#0F6E56]/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t('arrival.saving')}
              </>
            ) : (
              t('arrival.submit')
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
