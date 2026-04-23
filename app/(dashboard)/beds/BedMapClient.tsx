'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/stores/app.store'
import { useIsMobile } from '@/hooks/useIsMobile'
import { BedCard } from '@/components/beds/BedCard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import type { Bed, Room, Booking, Guest } from '@/types'
import { Plus, BedDouble, ArrowLeftRight, X, Wind, Wrench, Ban, Bed as BedIcon, Check } from 'lucide-react'
import Link from 'next/link'
import { EmptyState } from '@/components/shared/EmptyState'
import { BookingDetailSheet } from '@/components/shared/BookingDetailSheet'
import { useT } from '@/app/context/LanguageContext'

interface BedWithBooking extends Bed {
  room?: Room
  booking?: (Booking & { guest?: Guest }) | null
}

interface Props {
  rooms: Room[]
  beds: Bed[]
  activeBookings: (Booking & { guest?: Guest })[]
  propertyId: string
}

export function BedMapClient({ rooms, beds: initialBeds, activeBookings: initialBookings, propertyId }: Props) {
  const t = useT()
  const setRealtimeConnected = useAppStore((s) => s.setRealtimeConnected)

  const STATUS_OPTIONS = [
    {
      value: 'available',
      label: t('beds.available'),
      description: 'Prêt à accueillir',
      icon: BedIcon,
      activeBg: 'bg-emerald-50 border-emerald-300',
      activeText: 'text-emerald-700',
      activeIcon: 'text-emerald-600',
      activeDot: 'bg-emerald-500',
      idleBg: 'bg-white hover:bg-slate-50 border-slate-200',
      idleText: 'text-slate-700',
      idleIcon: 'text-slate-400',
      idleDot: 'bg-slate-300',
    },
    {
      value: 'dirty',
      label: t('beds.dirty'),
      description: 'Nettoyage requis',
      icon: Wind,
      activeBg: 'bg-amber-50 border-amber-300',
      activeText: 'text-amber-800',
      activeIcon: 'text-amber-500',
      activeDot: 'bg-amber-400',
      idleBg: 'bg-white hover:bg-amber-50/40 border-slate-200',
      idleText: 'text-slate-700',
      idleIcon: 'text-slate-400',
      idleDot: 'bg-slate-300',
    },
    {
      value: 'maintenance',
      label: t('beds.maintenance'),
      description: 'Hors service',
      icon: Wrench,
      activeBg: 'bg-red-50 border-red-300',
      activeText: 'text-red-700',
      activeIcon: 'text-red-500',
      activeDot: 'bg-red-400',
      idleBg: 'bg-white hover:bg-red-50/40 border-slate-200',
      idleText: 'text-slate-700',
      idleIcon: 'text-slate-400',
      idleDot: 'bg-slate-300',
    },
    {
      value: 'blocked',
      label: t('beds.blocked'),
      description: 'Non disponible',
      icon: Ban,
      activeBg: 'bg-slate-100 border-slate-400',
      activeText: 'text-slate-700',
      activeIcon: 'text-slate-500',
      activeDot: 'bg-slate-500',
      idleBg: 'bg-white hover:bg-slate-50 border-slate-200',
      idleText: 'text-slate-700',
      idleIcon: 'text-slate-400',
      idleDot: 'bg-slate-300',
    },
  ]

  const isMobile = useIsMobile()
  const [selectedBed, setSelectedBed] = useState<BedWithBooking | null>(null)
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null)
  const [filterRoom, setFilterRoom] = useState<string>('all')
  const [beds, setBeds] = useState<Bed[]>(initialBeds)
  const [activeBookings, setActiveBookings] = useState<(Booking & { guest?: Guest })[]>(initialBookings)
  const [swapMode, setSwapMode] = useState(false)
  const [swapSource, setSwapSource] = useState<BedWithBooking | null>(null)
  const [swapTarget, setSwapTarget] = useState<BedWithBooking | null>(null)
  const [swapping, setSwapping] = useState(false)

  // ── Re-fetch helpers triggered by realtime events ──

  const refreshBeds = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('beds')
      .select('*')
      .eq('property_id', propertyId)
      .order('name')
    if (data) setBeds(data as Bed[])
  }, [propertyId])

  const refreshBookings = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0]
    const supabase = createClient()
    const { data } = await supabase
      .from('bookings')
      .select('*, guest:guest_id(*)')
      .eq('property_id', propertyId)
      .eq('status', 'checked_in')
      .gte('check_out_date', today)
    if (data) setActiveBookings(data as (Booking & { guest?: Guest })[])
  }, [propertyId])

  // ── Bed swap ──
  async function handleSwapConfirm() {
    if (!swapSource?.booking || !swapTarget?.booking) return
    setSwapping(true)
    const supabase = createClient()

    const [r1, r2] = await Promise.all([
      supabase.from('bookings').update({ bed_id: swapTarget.id }).eq('id', swapSource.booking.id),
      supabase.from('bookings').update({ bed_id: swapSource.id }).eq('id', swapTarget.booking.id),
    ])

    setSwapping(false)
    if (r1.error || r2.error) {
      toast.error(t('beds.swapError'))
    } else {
      toast.success(`${t('beds.swapSuccess')}: ${swapSource.name} - ${swapTarget.name}`)
      await Promise.all([refreshBeds(), refreshBookings()])
    }
    setSwapMode(false)
    setSwapSource(null)
    setSwapTarget(null)
  }

  function handleBedClick(bed: BedWithBooking) {
    if (swapMode) {
      if (bed.id === swapSource?.id) {
        setSwapMode(false)
        setSwapSource(null)
        return
      }
      if (bed.booking) {
        setSwapTarget(bed)
      } else {
        toast.info(t('beds.swapSelectOccupied'))
      }
      return
    }
    if (bed.booking?.id) {
      setSelectedBookingId(bed.booking.id)
    } else {
      setSelectedBed(bed)
    }
  }

  // ── Realtime subscription on beds + bookings ──

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`beds-live-${propertyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'beds', filter: `property_id=eq.${propertyId}` },
        () => refreshBeds(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings', filter: `property_id=eq.${propertyId}` },
        () => {
          refreshBeds()
          refreshBookings()
        },
      )
      .subscribe((status) => {
        setRealtimeConnected(status === 'SUBSCRIBED')
      })

    return () => {
      supabase.removeChannel(channel)
      setRealtimeConnected(false)
    }
  }, [propertyId, setRealtimeConnected, refreshBeds, refreshBookings])

  // Map beds to include booking and room
  const bedsWithDetails: BedWithBooking[] = beds.map((bed) => {
    const room = rooms.find((r) => r.id === bed.room_id)
    const booking = activeBookings.find((b) => b.bed_id === bed.id) ?? null
    return { ...bed, room, booking }
  })

  const filteredBeds =
    filterRoom === 'all'
      ? bedsWithDetails
      : bedsWithDetails.filter((b) => b.room_id === filterRoom)

  const bedsByRoom = rooms
    .filter((r) => filterRoom === 'all' || r.id === filterRoom)
    .map((room) => ({
      room,
      beds: filteredBeds.filter((b) => b.room_id === room.id),
    }))

  async function handleStatusChange(bedId: string, newStatus: string) {
    // ── Optimistic update — UI changes instantly, no waiting ──
    const prevBeds = beds
    setBeds((prev) =>
      prev.map((b) =>
        b.id === bedId ? { ...b, status: newStatus as Bed['status'] } : b
      )
    )
    setSelectedBed((prev) =>
      prev ? { ...prev, status: newStatus as Bed['status'] } : null
    )

    const supabase = createClient()
    const { error } = await supabase
      .from('beds')
      .update({ status: newStatus })
      .eq('id', bedId)

    if (error) {
      // Rollback to previous state on failure
      setBeds(prevBeds)
      toast.error(t('common.error'))
    } else {
      toast.success(t('beds.statusUpdated'))
      setSelectedBed(null)
    }
  }

  const statsConfig = [
    { label: t('beds.available'), count: beds.filter((b) => b.status === 'available').length, color: 'bg-gray-200' },
    { label: t('beds.occupied'), count: beds.filter((b) => b.status === 'occupied').length, color: 'bg-[#0F6E56]' },
    { label: t('beds.dirty'), count: beds.filter((b) => b.status === 'dirty').length, color: 'bg-amber-400' },
    { label: t('beds.maintenance'), count: beds.filter((b) => b.status === 'maintenance').length, color: 'bg-red-400' },
  ]

  return (
    <div className="px-4 sm:px-6 py-5 sm:py-6 space-y-5 max-w-7xl mx-auto hp-page-in bg-[#F4F6F8] min-h-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          {/* Room filter */}
          <Button
            variant={filterRoom === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterRoom('all')}
            className={filterRoom === 'all' ? 'bg-[#0F6E56] hover:bg-[#0c5a46]' : ''}
          >
            {t('beds.filter.all')}
          </Button>
          {rooms.map((r) => (
            <Button
              key={r.id}
              variant={filterRoom === r.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterRoom(r.id)}
              className={filterRoom === r.id ? 'bg-[#0F6E56] hover:bg-[#0c5a46]' : ''}
            >
              {r.name}
            </Button>
          ))}
        </div>
        <Link href="/guests/new">
          <Button size="sm" className="bg-[#0F6E56] hover:bg-[#0c5a46]">
            <Plus className="w-4 h-4 mr-1" />
            Check-in
          </Button>
        </Link>
      </div>

      {/* ── Empty state: no beds configured ── */}
      {beds.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-border">
          <EmptyState
            icon={BedDouble}
            iconBg="bg-[#0F6E56]/10"
            iconColor="text-[#0F6E56]"
            title={t('beds.noBeds')}
            description={t('beds.configureFirst')}
            action={{ label: t('beds.configureRooms'), href: '/settings/rooms' }}
            secondaryAction={{ label: `+ ${t('beds.checkinNoBed')}`, href: '/guests/new', variant: 'outline' }}
          />
        </div>
      )}

      {/* Legend + room grids — only when beds exist */}
      {beds.length > 0 && (
        <>
          <div className="flex flex-wrap gap-4">
            {statsConfig.map(({ label, count, color }) => (
              <div key={label} className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${color}`} />
                <span className="text-sm text-muted-foreground">
                  {label} ({count})
                </span>
              </div>
            ))}
          </div>

          {/* Room grids */}
          {bedsByRoom.map(({ room, beds: roomBeds }) => (
            <div key={room.id} className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-[11px] font-semibold uppercase tracking-widest text-[#94A3B8]">{room.name}</h2>
                <Badge variant="outline" className="text-xs">
                  {room.type === 'dorm' ? t('beds.dorm') : t('beds.private')}
                </Badge>
                {room.gender_policy !== 'mixed' && (
                  <Badge variant="outline" className="text-xs">
                    {room.gender_policy === 'female' ? t('beds.female') : t('beds.male')}
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                {roomBeds.map((bed) => (
                  <BedCard
                    key={bed.id}
                    bed={bed}
                    onClick={handleBedClick}
                    swapMode={swapMode}
                    isSwapSource={swapSource?.id === bed.id}
                  />
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Swap mode banner */}
      {swapMode && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#0F6E56] text-white px-5 py-3 rounded-2xl shadow-xl">
          <ArrowLeftRight className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm font-medium">
            {t('beds.swapSelectDest')}{' '}
            <strong>{swapSource?.booking?.guest?.first_name}</strong>
          </span>
          <button
            onClick={() => { setSwapMode(false); setSwapSource(null) }}
            className="ml-1 opacity-70 hover:opacity-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Booking detail sheet (occupied beds) ── */}
      <BookingDetailSheet
        bookingId={selectedBookingId}
        onClose={() => setSelectedBookingId(null)}
        isMobile={isMobile}
      />

      {/* ── Status sheet (non-occupied beds) ── */}
      {selectedBed && !swapMode && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-end"
          onClick={() => setSelectedBed(null)}
        >
          <div
            className="relative bg-white rounded-t-2xl sm:rounded-2xl sm:mr-4 w-full sm:w-80 shadow-2xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-[#0A1F1C]">
                  {t('beds.bed')} {selectedBed.name}
                  {selectedBed.room && (
                    <span className="text-muted-foreground font-normal text-sm ml-1.5">
                      — {selectedBed.room.name}
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedBed.bunk_position === 'top'
                    ? t('beds.bunkTop')
                    : selectedBed.bunk_position === 'bottom'
                    ? t('beds.bunkBottom')
                    : t('beds.bed')}
                </p>
              </div>
              <button
                onClick={() => setSelectedBed(null)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-[oklch(0.60_0_0)]">
                {t('beds.changeStatus')}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {STATUS_OPTIONS.map((opt) => {
                  const isActive = selectedBed.status === opt.value
                  const Icon = opt.icon
                  return (
                    <button
                      key={opt.value}
                      onClick={() => !isActive && handleStatusChange(selectedBed.id, opt.value)}
                      disabled={isActive}
                      className={[
                        'relative flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-all duration-150',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F6E56]/50',
                        isActive
                          ? `${opt.activeBg} cursor-default shadow-sm`
                          : `${opt.idleBg} cursor-pointer active:scale-[0.97]`,
                      ].join(' ')}
                    >
                      <div className={[
                        'flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center',
                        isActive ? opt.activeBg : 'bg-slate-100',
                      ].join(' ')}>
                        <Icon className={['w-4 h-4', isActive ? opt.activeIcon : opt.idleIcon].join(' ')} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={['text-[13px] font-semibold leading-tight', isActive ? opt.activeText : opt.idleText].join(' ')}>
                          {opt.label}
                        </p>
                        <p className="text-[11px] text-[oklch(0.62_0_0)] leading-tight mt-0.5">
                          {opt.description}
                        </p>
                      </div>
                      {isActive && (
                        <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[#0F6E56] flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {selectedBed.status === 'available' && (
              <Link href={`/guests/new?bed=${selectedBed.id}`} className="block">
                <Button className="w-full bg-[#0F6E56] hover:bg-[#0c5a46]">
                  <Plus className="w-4 h-4 mr-2" />
                  {t('beds.newCheckinHere')}
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Swap confirmation dialog */}
      <Dialog open={!!swapTarget} onOpenChange={(o) => !o && setSwapTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('beds.swapConfirmTitle')}</DialogTitle>
            <DialogDescription>
              {t('beds.swapConfirmDesc')}
            </DialogDescription>
          </DialogHeader>
          {swapSource && swapTarget && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div className="rounded-xl border p-3 text-center">
                  <p className="font-semibold text-sm">{swapSource.booking?.guest?.first_name} {swapSource.booking?.guest?.last_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('beds.bed')} {swapSource.name}</p>
                </div>
                <ArrowLeftRight className="w-5 h-5 text-muted-foreground" />
                <div className="rounded-xl border p-3 text-center">
                  <p className="font-semibold text-sm">{swapTarget.booking?.guest?.first_name} {swapTarget.booking?.guest?.last_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('beds.bed')} {swapTarget.name}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setSwapTarget(null)}
                  disabled={swapping}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  className="flex-1 bg-[#0F6E56] hover:bg-[#0c5a46]"
                  onClick={handleSwapConfirm}
                  disabled={swapping}
                >
                  {swapping ? t('beds.swapping') : t('common.confirm')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
