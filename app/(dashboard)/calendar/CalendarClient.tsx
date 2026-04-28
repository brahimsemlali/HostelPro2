'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/stores/app.store'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useT } from '@/app/context/LanguageContext'
import { BookingDetailSheet } from '@/components/shared/BookingDetailSheet'
import { useIsMobile } from '@/hooks/useIsMobile'

interface Room { id: string; name: string; type: string }
interface Bed { id: string; name: string; room_id: string; base_price: number; status: string }
interface Booking {
  id: string
  bed_id: string | null
  check_in_date: string
  check_out_date: string
  status: string
  total_price: number
  guest: { first_name: string; last_name: string; nationality: string | null; phone: string | null } | null
}

interface Props {
  propertyId: string
  rooms: Room[]
  beds: Bed[]
  bookings: Booking[]
  startDate: string
  endDate: string
}

const statusColors: Record<string, string> = {
  confirmed:   'bg-blue-400',
  checked_in:  'bg-[#0F6E56]',
  checked_out: 'bg-gray-400',
  pending:     'bg-yellow-400',
}

const CELL_WIDTH = 64
const ROW_HEIGHT = 48
const SIDEBAR_WIDTH = 200

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

function daysBetween(start: string, end: string) {
  const d1 = new Date(start)
  const d2 = new Date(end)
  return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24))
}

function getDates(start: string, end: string): string[] {
  const dates: string[] = []
  let cur = start
  while (cur <= end) {
    dates.push(cur)
    cur = addDays(cur, 1)
  }
  return dates
}

type GuestLike = { first_name: string; last_name: string; nationality: string | null; phone: string | null }

function normalizeGuest(raw: unknown): GuestLike | null {
  if (!raw) return null
  const g = Array.isArray(raw) ? raw[0] : raw
  if (!g || typeof g !== 'object') return null
  return g as GuestLike
}

export function CalendarClient({ propertyId, rooms, beds: initialBeds, bookings: initialBookings, startDate, endDate }: Props) {
  const router = useRouter()
  const t = useT()
  const isMobile = useIsMobile()
  const setRealtimeConnected = useAppStore((s) => s.setRealtimeConnected)

  const [beds, setBeds] = useState<Bed[]>(initialBeds)
  const [bookings, setBookings] = useState<Booking[]>(initialBookings)
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null)

  const dates = getDates(startDate, endDate)
  const today = new Date().toISOString().split('T')[0]

  // Flatten beds to assign deterministic Y indexes and insert room headers
  const flatBeds = useMemo(() => {
    const flat: Array<{ isRoomHeader?: boolean; id: string; name: string; type?: string; roomName?: string; room_id?: string; base_price?: number; status?: string }> = []
    rooms.forEach(room => {
      const roomBeds = beds.filter(b => b.room_id === room.id)
      if (roomBeds.length > 0) {
        flat.push({ isRoomHeader: true, id: `room-${room.id}`, name: room.name, type: room.type })
        roomBeds.forEach(b => {
          flat.push({ ...b, roomName: room.name })
        })
      }
    })
    return flat
  }, [rooms, beds])

  // ── Drag & Drop State ───────────────────────────────────────────────────────
  const [dragState, setDragState] = useState<{
    id: string
    type: 'move' | 'resize-start' | 'resize-end'
    startX: number
    startY: number
    initialCheckIn: string
    initialCheckOut: string
    initialBedId: string
    bedIndex: number
  } | null>(null)
  
  const [delta, setDelta] = useState({ xDays: 0, yBeds: 0 })

  // ── Data Fetches ─────────────────────────────────────────────────────────────
  const refreshBeds = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('beds').select('id, name, room_id, base_price, status').eq('property_id', propertyId).order('name')
    if (data) setBeds(data as Bed[])
  }, [propertyId])

  const refreshBookings = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('bookings')
      .select('id, bed_id, check_in_date, check_out_date, status, total_price, guest:guest_id(first_name, last_name, nationality, phone)')
      .eq('property_id', propertyId)
      .neq('status', 'cancelled')
      .neq('status', 'no_show')
      .lte('check_in_date', endDate)
      .gte('check_out_date', startDate)

    if (data) {
      setBookings(data.map((b) => ({ ...b, guest: normalizeGuest(b.guest) })))
    }
  }, [propertyId, startDate, endDate])

  function handlePointerDown(e: React.PointerEvent, booking: Booking, type: 'move' | 'resize-start' | 'resize-end') {
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    // eslint-disable-next-line react-hooks/immutability
    document.body.style.userSelect = 'none'

    const bedIndex = flatBeds.findIndex(b => b.id === booking.bed_id)
    const startX = e.clientX
    const startY = e.clientY

    setDragState({
      id: booking.id,
      type,
      startX,
      startY,
      initialCheckIn: booking.check_in_date,
      initialCheckOut: booking.check_out_date,
      initialBedId: booking.bed_id!,
      bedIndex,
    })
    setDelta({ xDays: 0, yBeds: 0 })

    // detect click: if pointer up fires with minimal movement, open detail sheet
    function onUp(ev: PointerEvent) {
      window.removeEventListener('pointerup', onUp)
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5 && type === 'move') {
        setSelectedBookingId(booking.id)
      }
    }
    window.addEventListener('pointerup', onUp, { once: true })
  }

  useEffect(() => {
    if (!dragState) return

    function handlePointerMove(e: PointerEvent) {
      if (!dragState) return
      const deltaXPixels = e.clientX - dragState.startX
      const deltaYPixels = e.clientY - dragState.startY

      const xDays = Math.round(deltaXPixels / CELL_WIDTH)
      const yBeds = Math.round(deltaYPixels / ROW_HEIGHT)

      setDelta({ xDays, yBeds })
    }

    async function handlePointerUp() {
      if (!dragState) return
      document.body.style.userSelect = '' // Restore selection
      
      const xMode = dragState.type === 'resize-start' ? 'start' : dragState.type === 'resize-end' ? 'end' : 'move'
      
      let newBedId = dragState.initialBedId
      let newCheckIn = dragState.initialCheckIn
      let newCheckOut = dragState.initialCheckOut

      if (xMode === 'move') {
        let newIndex = Math.max(0, Math.min(flatBeds.length - 1, dragState.bedIndex + delta.yBeds))
        if (flatBeds[newIndex].isRoomHeader) {
          if (delta.yBeds > 0 && newIndex + 1 < flatBeds.length) newIndex++
          else if (delta.yBeds < 0 && newIndex - 1 >= 0) newIndex--
          else newIndex = dragState.bedIndex
          
          if (flatBeds[newIndex].isRoomHeader) newIndex = dragState.bedIndex
        }
        newBedId = flatBeds[newIndex].id
        newCheckIn = addDays(dragState.initialCheckIn, delta.xDays)
        newCheckOut = addDays(dragState.initialCheckOut, delta.xDays)
      } else if (xMode === 'end') {
        newCheckOut = addDays(dragState.initialCheckOut, delta.xDays)
        if (newCheckOut <= newCheckIn) newCheckOut = addDays(newCheckIn, 1)
      } else if (xMode === 'start') {
        newCheckIn = addDays(dragState.initialCheckIn, delta.xDays)
        if (newCheckIn >= newCheckOut) newCheckIn = addDays(newCheckOut, -1)
      }

      // Check for collisions before saving
      const hasCollision = bookings.some(b => 
        b.id !== dragState.id && 
        b.bed_id === newBedId && 
        ((newCheckIn >= b.check_in_date && newCheckIn < b.check_out_date) || 
         (newCheckOut > b.check_in_date && newCheckOut <= b.check_out_date) ||
         (newCheckIn <= b.check_in_date && newCheckOut >= b.check_out_date))
      )

      setDragState(null)
      setDelta({ xDays: 0, yBeds: 0 })

      if (hasCollision) {
        toast.error(t('calendar.slotOccupied'))
        return
      }

      if (newBedId !== dragState.initialBedId || newCheckIn !== dragState.initialCheckIn || newCheckOut !== dragState.initialCheckOut) {
        // Recalculate price based on new dates and bed
        const newNights = Math.max(1, daysBetween(newCheckIn, newCheckOut))
        const targetBed = flatBeds.find(b => b.id === newBedId)
        const bedPrice = targetBed?.base_price ?? 0
        const newTotalPrice = newNights * bedPrice

        // Optimistic UI update
        setBookings(prev => prev.map(b => b.id === dragState.id ? {...b, bed_id: newBedId, check_in_date: newCheckIn, check_out_date: newCheckOut} : b))
        
        // Persist to DB (including recalculated price)
        const supabase = createClient()
        const updatePayload: Record<string, unknown> = { 
          bed_id: newBedId, 
          check_in_date: newCheckIn, 
          check_out_date: newCheckOut,
        }
        // Only update price if we have a valid bed price
        if (bedPrice > 0) {
          updatePayload.total_price = newTotalPrice
        }
        const { error } = await supabase.from('bookings').update(updatePayload).eq('id', dragState.id)

        if (error) {
          toast.error(t('calendar.updateError'))
          refreshBookings() // Rollback
        } else {
          const priceInfo = bedPrice > 0 ? ` · ${newNights} ${newNights > 1 ? t('common.nights') : t('common.night')} = ${newTotalPrice} MAD` : ''
          toast.success(`${t('calendar.bookingUpdated')}${priceInfo}`)
        }
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [dragState, delta, flatBeds, bookings, refreshBookings])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`calendar-live-${propertyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `property_id=eq.${propertyId}` }, () => refreshBookings())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'beds', filter: `property_id=eq.${propertyId}` }, () => refreshBeds())
      .subscribe((status) => setRealtimeConnected(status === 'SUBSCRIBED'))

    return () => { supabase.removeChannel(channel); setRealtimeConnected(false) }
  }, [propertyId, refreshBookings, refreshBeds, setRealtimeConnected])

  const currentDays = daysBetween(startDate, endDate) + 1
  function navigate(direction: 'prev' | 'next') {
    const newStart = addDays(startDate, direction === 'next' ? currentDays : -currentDays)
    router.push(`/calendar?from=${newStart}&days=${currentDays}`)
  }

  return (
    <div className="h-full flex flex-col bg-[#F8F9FA]">
      {/* ── Top Navigation — Premium ── */}
      <div className="flex items-center justify-between px-4 py-4 md:px-8 md:py-6 border-b bg-white sticky top-0 z-40 shadow-sm">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-black text-[#0A1F1C] tracking-tight">{t('nav.calendar')}</h1>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-muted/50" onClick={() => navigate('prev')}><ChevronLeft className="w-4 h-4" /></Button>
            <span className="text-[13px] font-black uppercase tracking-widest text-muted-foreground">
              {new Date(startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              {' — '}
              {new Date(endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-muted/50" onClick={() => navigate('next')}><ChevronRight className="w-4 h-4" /></Button>
            
            <Select value={String(currentDays)} onValueChange={(v) => router.push(`/calendar?from=${startDate}&days=${v}`)}>
              <SelectTrigger className="h-8 w-[110px] text-[11px] font-bold uppercase tracking-wider ml-2 bg-[#F8FAFC] border-muted/40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">{t('calendar.days7')}</SelectItem>
                <SelectItem value="14">{t('calendar.days14')}</SelectItem>
                <SelectItem value="30">{t('calendar.days30')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden lg:flex items-center gap-5">
            {[
              { label: t('bookings.status.checked_in'), color: 'bg-[#0F6E56]' },
              { label: t('bookings.status.confirmed'), color: 'bg-blue-500' },
              { label: t('bookings.status.pending'), color: 'bg-amber-500' },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-2">
                <div className={cn("w-2 h-2 rounded-full", l.color)} />
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{l.label}</span>
              </div>
            ))}
          </div>
          <div className="h-8 w-px bg-muted mx-2" />
          <Link href="/guests/new">
            <Button className="bg-[#0F6E56] hover:bg-[#0c5a46] rounded-2xl h-11 px-6 font-black text-xs uppercase tracking-widest shadow-lg shadow-[#0F6E56]/20 transition-all active:scale-95">
              <Plus className="w-4 h-4 mr-2 stroke-[3]" /> {t('dashboard.newCheckin')}
            </Button>
          </Link>
        </div>
      </div>

      {/* Calendar Grid Container */}
      <div className="flex-1 overflow-auto bg-white flex flex-col">
        {/* Header Row */}
        <div className="flex sticky top-0 bg-white border-b z-30 w-max">
          <div 
            className="shrink-0 sticky left-0 z-50 bg-white border-r flex items-center px-6 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 shadow-[4px_0_10px_rgba(0,0,0,0.02)]"
            style={{ width: SIDEBAR_WIDTH, height: ROW_HEIGHT }}
          >
            {t('calendar.rooms')}
          </div>
          {dates.map((d) => {
            const date = new Date(d)
            const isToday = d === today
            const isWeekend = date.getDay() === 0 || date.getDay() === 6
            return (
              <div 
                key={d} 
                className={cn(
                  'shrink-0 flex flex-col items-center justify-center border-r select-none transition-colors border-muted/30',
                  isToday ? 'bg-[#0F6E56]/5' : isWeekend ? 'bg-muted/5' : ''
                )}
                style={{ width: CELL_WIDTH, height: ROW_HEIGHT }}
              >
                <div className={cn("text-[9px] uppercase font-black tracking-widest", isToday ? "text-[#0F6E56]" : "text-muted-foreground/40")}>
                  {date.toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 3)}
                </div>
                <div className={cn('text-[15px] font-black tracking-tight leading-none', isToday ? 'text-[#0F6E56]' : 'text-[#0A1F1C]')}>
                  {date.getDate()}
                </div>
              </div>
            )
          })}
        </div>

        {/* Body Rows */}
        <div className="flex relative w-max flex-1">
          {/* Sticky Sidebar */}
          <div className="shrink-0 sticky left-0 z-20 bg-white border-r shadow-[8px_0_15px_-10px_rgba(0,0,0,0.05)]" style={{ width: SIDEBAR_WIDTH }}>
            {flatBeds.map(item => (
              item.isRoomHeader ? (
                <div key={item.id} className="flex flex-col justify-center px-4 border-b bg-[#F8FAFC] relative" style={{ height: ROW_HEIGHT }}>
                  <span className="text-[11px] font-black text-[#0F6E56] tracking-[0.1em] uppercase truncate">{item.name}</span>
                </div>
              ) : (
                <div key={item.id} className="flex flex-col justify-center px-6 border-b bg-white relative group" style={{ height: ROW_HEIGHT }}>
                  <div className="flex items-center gap-2">
                     <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/20 group-hover:bg-[#0F6E56] transition-colors" />
                     <div className="text-xs font-black text-[#0A1F1C] tracking-tight">{item.name}</div>
                  </div>
                </div>
              )
            ))}
          </div>

          {/* Grid Area */}
          <div className="relative" style={{ width: dates.length * CELL_WIDTH }}>
            {/* Background Cells */}
            <div className="absolute inset-0 z-0">
              {flatBeds.map(item => (
                <div key={item.id} className={cn("flex border-b", item.isRoomHeader ? "bg-[#F8FAFC] border-muted/30" : "border-muted/20")} style={{ height: ROW_HEIGHT }}>
                  {dates.map(date => (
                    item.isRoomHeader ? (
                      <div key={date} className="shrink-0 border-r border-muted/10" style={{ width: CELL_WIDTH, height: ROW_HEIGHT }} />
                    ) : (
                      <Link
                        key={date}
                        href={`/guests/new?bedId=${item.id}&date=${date}`}
                        className="shrink-0 border-r border-dotted border-muted/40 transition-colors hover:bg-[#0F6E56]/5 group flex items-center justify-center cursor-pointer"
                        style={{ width: CELL_WIDTH, height: ROW_HEIGHT }}
                      >
                        <Plus className="w-3.5 h-3.5 text-[#0F6E56]/0 group-hover:text-[#0F6E56]/40 transition-all font-black" />
                      </Link>
                    )
                  ))}
                </div>
              ))}
            </div>

            {/* Overlaid Bookings */}
            <div className="absolute inset-0 z-10 pointer-events-none">
              {bookings.map(booking => {
                const isDragged = dragState?.id === booking.id
                
                let checkIn = booking.check_in_date
                let checkOut = booking.check_out_date
                let bIndex = flatBeds.findIndex(b => b.id === booking.bed_id)
                let targetBedId = booking.bed_id

                if (isDragged) {
                  const xMode = dragState.type === 'resize-start' ? 'start' : dragState.type === 'resize-end' ? 'end' : 'move'
                  if (xMode === 'move') {
                    bIndex = Math.max(0, Math.min(flatBeds.length - 1, dragState.bedIndex + delta.yBeds))
                    checkIn = addDays(dragState.initialCheckIn, delta.xDays)
                    checkOut = addDays(dragState.initialCheckOut, delta.xDays)
                    targetBedId = flatBeds[bIndex]?.id
                  } else if (xMode === 'end') {
                    checkOut = addDays(dragState.initialCheckOut, delta.xDays)
                    if (checkOut <= checkIn) checkOut = addDays(checkIn, 1)
                  } else if (xMode === 'start') {
                    checkIn = addDays(dragState.initialCheckIn, delta.xDays)
                    if (checkIn >= checkOut) checkIn = addDays(checkOut, -1)
                  }
                }

                if (bIndex === -1) return null

                const left = daysBetween(startDate, checkIn) * CELL_WIDTH
                const width = Math.max(1, daysBetween(checkIn, checkOut)) * CELL_WIDTH
                const top = bIndex * ROW_HEIGHT

                // Simplified collision check for UI feedback
                const hasCollision = isDragged && bookings.some(b => 
                  b.id !== booking.id && 
                  b.bed_id === targetBedId && 
                  ((checkIn >= b.check_in_date && checkIn < b.check_out_date) || 
                   (checkOut > b.check_in_date && checkOut <= b.check_out_date) ||
                   (checkIn <= b.check_in_date && checkOut >= b.check_out_date))
                )

                return (
                  <React.Fragment key={booking.id}>
                    {/* GHOST ORIGINAL (visible during drag) */}
                    {isDragged && (
                      <div
                        className={cn(
                          "absolute rounded-[12px] opacity-20 border-2 border-dashed border-white",
                          statusColors[booking.status]
                        )}
                        style={{
                          top: (flatBeds.findIndex(b => b.id === booking.bed_id) * ROW_HEIGHT) + 6,
                          left: (daysBetween(startDate, booking.check_in_date) * CELL_WIDTH) + 2,
                          width: (daysBetween(booking.check_in_date, booking.check_out_date) * CELL_WIDTH) - 4,
                          height: ROW_HEIGHT - 12,
                        }}
                      />
                    )}

                    {/* ACTIVE BOOKING / DRAGGED PREVIEW */}
                    <div
                      className={cn(
                        "absolute rounded-[12px] flex items-center px-4 transition-all pointer-events-auto",
                        hasCollision ? "bg-red-500 shadow-lg shadow-red-200" : (statusColors[booking.status] || 'bg-gray-400'),
                        isDragged ? 'z-50 shadow-2xl scale-[1.02] ring-2 ring-white/30' : 'z-10 shadow-sm hover:translate-y-[-1px] hover:shadow-md cursor-grab active:cursor-grabbing'
                      )}
                      style={{
                        top: top + 6,
                        left: left + 2,
                        width: width - 4,
                        height: ROW_HEIGHT - 12,
                      }}
                      onPointerDown={(e) => handlePointerDown(e, booking, 'move')}
                    >
                      {/* Floating Tooltip during drag/resize */}
                      {isDragged && (() => {
                        const dragNights = daysBetween(checkIn, checkOut)
                        const dragBed = flatBeds.find(b => b.id === targetBedId)
                        const dragPrice = (dragBed?.base_price ?? 0) * dragNights
                        return (
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 bg-black/80 backdrop-blur-md text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-2xl whitespace-nowrap z-[100] animate-in fade-in slide-in-from-bottom-2">
                             {new Date(checkIn).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} 
                             {' → '} 
                             {new Date(checkOut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                             {' ('}{dragNights} {dragNights > 1 ? t('common.nights') : t('common.night')}{')'}
                             {dragPrice > 0 && <span className="ml-1 text-emerald-300"> · {dragPrice} MAD</span>}
                          </div>
                        )
                      })()}

                      {/* Left Resize Handle */}
                      <div 
                        className="absolute left-0 top-0 bottom-0 w-4 cursor-ew-resize hover:bg-white/20 flex items-center justify-center rounded-l-[12px]"
                        onPointerDown={e => { e.stopPropagation(); handlePointerDown(e, booking, 'resize-start') }}
                      >
                        <div className="w-1 h-3 bg-white/40 rounded-full" />
                      </div>

                      <div className="flex flex-col min-w-0 flex-1 justify-center leading-none">
                        <span className="text-[11px] font-black uppercase tracking-wider truncate text-white drop-shadow-sm">
                          {booking.guest ? `${booking.guest.first_name}` : '...'}
                        </span>
                        {width > CELL_WIDTH * 1.5 && (
                            <span className="text-[8px] font-bold text-white/70 uppercase tracking-tighter truncate leading-none">
                              {daysBetween(checkIn, checkOut)} {daysBetween(checkIn, checkOut) > 1 ? t('common.nights') : t('common.night')}
                            </span>
                        )}
                      </div>

                      {/* Right Resize Handle */}
                      <div 
                        className="absolute right-0 top-0 bottom-0 w-4 cursor-ew-resize hover:bg-white/20 flex items-center justify-center rounded-r-[12px]"
                        onPointerDown={e => { e.stopPropagation(); handlePointerDown(e, booking, 'resize-end') }}
                      >
                        <div className="w-1 h-3 bg-white/40 rounded-full" />
                      </div>
                    </div>
                  </React.Fragment>
                )
              })}
            </div>
          </div>
        </div>

        {flatBeds.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center w-full min-w-0 absolute left-0 right-0 z-50 pointer-events-none">
            <p className="font-medium">{t('beds.noBeds')}</p>
            <Link href="/settings/rooms" className="mt-4 pointer-events-auto">
              <Button className="bg-[#0F6E56] hover:bg-[#0c5a46]">{t('calendar.configureRooms')}</Button>
            </Link>
          </div>
        )}
      </div>

      <BookingDetailSheet
        bookingId={selectedBookingId}
        onClose={() => setSelectedBookingId(null)}
        isMobile={isMobile}
      />
    </div>
  )
}
