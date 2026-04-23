'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/stores/app.store'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { OccupancyChart } from '@/components/dashboard/OccupancyChart'
import { ArrivalsPanel } from '@/components/dashboard/ArrivalsPanel'
import { AddArrivalModal } from '@/components/dashboard/AddArrivalModal'
import type { ArrivalBooking } from '@/components/dashboard/ArrivalsPanel'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatTime, cn } from '@/lib/utils'
import {
  BedDouble,
  DollarSign,
  LogIn,
  LogOut,
  Activity,
  Settings,
  CalendarPlus,
  BarChart3,
  ArrowRight,
  Sparkles,
  TriangleAlert,
  Brush,
  CheckCircle2,
  Clock,
  Loader2,
  TrendingUp,
  AlertCircle,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { BOOKING_SOURCES } from '@/lib/constants'
import type { Property } from '@/types'
import { AppLogo } from '@/components/shared/AppLogo'

import { useSession, useCanDo } from '@/app/context/SessionContext'
import { useT } from '@/app/context/LanguageContext'
import { logActivity } from '@/lib/activity'

type DashboardProperty = Pick<Property, 'id' | 'name' | 'city' | 'check_in_time' | 'check_out_time' | 'currency' | 'review_url'>

// ─── Types ────────────────────────────────────────────────────────────────────

interface BedSummary {
  id: string
  status: string
}

interface PaymentSummary {
  amount: number
  method: string
}

interface GuestRef { first_name: string; last_name: string; nationality?: string | null; phone?: string | null; whatsapp?: string | null }
interface BedRef { name: string; room?: { name: string } | null }

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

interface DepartureBooking {
  id: string
  bed_id: string | null
  status: string
  check_out_date: string
  total_price?: number
  balance_due?: number
  guest: GuestRef | null
  bed: BedRef | null
}

interface PendingPaymentBooking {
  id: string
  total_price: number
  total_paid: number
  balance: number
  check_out_date: string
  guest: { first_name: string; last_name: string } | null
}

interface RecentBookingItem {
  id: string
  status: string
  created_at: string
  guest: unknown
}

interface RecentPaymentItem {
  id: string
  amount: number
  method: string
  created_at: string
  guest: unknown
}

export interface ActivityEntry {
  id: string
  action_type: string
  description: string
  staff_name: string | null
  created_at: string
  meta: Record<string, unknown> | null
}

interface ChartDayData {
  day: string
  revenue: number
  cash: number
  virement: number
  cmi: number
}

interface ForecastDay {
  date: string
  label: string
  occupied: number
  total: number
}

export interface DashboardInitialData {
  beds: BedSummary[]
  todayPayments: PaymentSummary[]
  arrivalsToday: ArrivalBooking[]
  arrivalsTomorrow: ArrivalBooking[]
  arrivalsWeek: ArrivalBooking[]
  departuresToday: DepartureBooking[]
  recentBookings: RecentBookingItem[]
  recentPayments: RecentPaymentItem[]
  chartData: ChartDayData[]
  dirtyBedsWithArrivalsCount: number
  forecastDays: ForecastDay[]
  recentActivity: ActivityEntry[]
  rooms: RoomOption[]
  allBeds: BedOption[]
  pendingPayments: PendingPaymentBooking[]
}

// ─── Activity log config ──────────────────────────────────────────────────────

const ACTIVITY_CONFIG: Record<string, { Icon: React.ElementType; bg: string; color: string }> = {
  check_in:             { Icon: LogIn,     bg: 'bg-[#0F6E56]/10', color: 'text-[#0F6E56]' },
  check_out:            { Icon: LogOut,    bg: 'bg-gray-100',     color: 'text-gray-500' },
  payment:              { Icon: DollarSign,bg: 'bg-blue-50',      color: 'text-blue-600' },
  maintenance_open:     { Icon: Activity,  bg: 'bg-amber-50',     color: 'text-amber-600' },
  maintenance_resolved: { Icon: CheckCircle2, bg: 'bg-[#0F6E56]/10', color: 'text-[#0F6E56]' },
  booking_created:      { Icon: CalendarPlus, bg: 'bg-blue-50',   color: 'text-blue-600' },
  booking_cancelled:    { Icon: Activity,  bg: 'bg-red-50',       color: 'text-red-500' },
  bed_status:           { Icon: BedDouble, bg: 'bg-gray-100',     color: 'text-gray-500' },
  default:              { Icon: Activity,  bg: 'bg-gray-100',     color: 'text-gray-500' },
}

// ─── Source badge colours ─────────────────────────────────────────────────────

const sourceColors: Record<string, string> = {
  direct: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  booking_com: 'bg-blue-100 text-blue-800 border-blue-200',
  hostelworld: 'bg-orange-100 text-orange-800 border-orange-200',
  airbnb: 'bg-rose-100 text-rose-800 border-rose-200',
  phone: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  walkin: 'bg-gray-100 text-gray-800 border-gray-200',
}

// ─── Forecast bar strip ───────────────────────────────────────────────────────

function ForecastStrip({ days }: { days: ForecastDay[] }) {
  const t = useT()
  if (!days.length) return null
  return (
    <Card className="rounded-[16px] border border-[#E8ECF0] shadow-[0_1px_4px_rgba(0,0,0,0.04)] bg-white overflow-hidden group relative">
      <CardHeader className="pb-4 pt-5 px-6">
        <CardTitle className="text-[13px] font-semibold uppercase tracking-widest text-[#94A3B8] flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#0F6E56]" />
          {t('dashboard.forecast')}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-6 px-6">
        <div className="grid grid-cols-7 gap-3">
          {days.map((d, i) => {
            const pct = d.total > 0 ? Math.round((d.occupied / d.total) * 100) : 0
            const isToday = i === 0
            const color =
              pct >= 90
                ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]'
                : pct >= 70
                  ? 'bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                  : pct >= 40
                    ? 'bg-[#0F6E56] shadow-[0_0_15px_rgba(15,110,86,0.2)]'
                    : 'bg-[#5DCAA5]'
            return (
              <div key={d.date} className="flex flex-col items-center gap-2.5 group/day">
                <div className="w-full h-16 bg-muted/30 rounded-xl relative overflow-hidden transition-all duration-500 group-hover/day:bg-muted/50">
                  <div
                    className={cn(`absolute bottom-0 left-0 right-0 rounded-xl transition-all duration-700 ease-out-expo`, color)}
                    style={{ height: `${Math.max(8, pct)}%` }}
                  />
                  {pct > 0 && <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] font-black text-white/40 group-hover/day:text-white transition-colors">{pct}%</span>}
                </div>
                <div className="text-center">
                   <p className={cn("text-[10px] font-black uppercase tracking-tighter", isToday ? "text-[#0F6E56]" : "text-muted-foreground")}>{d.label}</p>
                   <p className="text-[9px] font-medium text-muted-foreground/60 tabular-nums">{d.occupied}/{d.total}</p>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  property: DashboardProperty
  initialData: DashboardInitialData
}

export function DashboardCommandCenter({ property, initialData }: Props) {
  const supabase = createClient()
  const session = useSession()
  const t = useT()
  const setRealtimeConnected = useAppStore((s) => s.setRealtimeConnected)
  const setDirtyBedsCount = useAppStore((s) => s.setDirtyBedsCount)

  // ── State seeded from SSR ──
  const [beds, setBeds] = useState<BedSummary[]>(initialData.beds)
  const [dirtyBedsWithArrivalsCount, setDirtyBedsWithArrivalsCount] = useState(
    initialData.dirtyBedsWithArrivalsCount,
  )
  const [todayPayments, setTodayPayments] = useState<PaymentSummary[]>(initialData.todayPayments)
  const [arrivalsToday, setArrivalsToday] = useState<ArrivalBooking[]>(initialData.arrivalsToday)
  const [arrivalsTomorrow, setArrivalsTomorrow] = useState<ArrivalBooking[]>(initialData.arrivalsTomorrow)
  const [arrivalsWeek, setArrivalsWeek] = useState<ArrivalBooking[]>(initialData.arrivalsWeek)
  const [departuresToday, setDeparturesToday] = useState<DepartureBooking[]>(
    initialData.departuresToday,
  )
  const [recentBookings, setRecentBookings] = useState<RecentBookingItem[]>(
    initialData.recentBookings,
  )
  const [recentPayments, setRecentPayments] = useState<RecentPaymentItem[]>(
    initialData.recentPayments,
  )
  const [chartData, setChartData] = useState<ChartDayData[]>(initialData.chartData)
  const [forecastDays, setForecastDays] = useState<ForecastDay[]>(initialData.forecastDays)
  const [recentActivity, setRecentActivity] = useState<ActivityEntry[]>(initialData.recentActivity)
  const [pendingPayments, setPendingPayments] = useState<PendingPaymentBooking[]>(initialData.pendingPayments)

  // ── Quick action loading states ──
  const [checkingIn, setCheckingIn] = useState<Set<string>>(new Set())
  const [checkingOut, setCheckingOut] = useState<Set<string>>(new Set())

  // ── Add arrival modal state ──
  const [addArrivalOpen, setAddArrivalOpen] = useState(false)

  // ── Seed store with initial dirty count ──
  useEffect(() => {
    setDirtyBedsCount(beds.filter((b) => b.status === 'dirty').length)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Derived metrics ──
  const totalBeds = beds.length
  const occupiedBeds = beds.filter((b) => b.status === 'occupied').length
  const occupancyPct = totalBeds ? Math.round((occupiedBeds / totalBeds) * 100) : 0
  const todayRevenue = todayPayments.reduce((s, p) => s + p.amount, 0)
  const cashToday = todayPayments
    .filter((p) => p.method === 'cash')
    .reduce((s, p) => s + p.amount, 0)
  
  const pendingCheckIns = arrivalsToday.filter((b) => b.status === 'confirmed')
  const pendingCheckouts = departuresToday.filter((b) => b.status === 'checked_in')
  
  const canViewRevenue = useCanDo('view_revenue')

  // ── Time & Alert Logic ──
  const now = new Date()
  const checkInTimeText = property.check_in_time ?? '14:00'
  const ctt_unique = property.check_out_time ?? '11:00'
  
  const [ciH, ciM] = checkInTimeText.split(':').map(Number)
  const [coH, coM] = ctt_unique.split(':').map(Number)

  const checkInDeadline = new Date()
  checkInDeadline.setHours(ciH, ciM, 0, 0)
  const checkoutDeadline = new Date()
  checkoutDeadline.setHours(coH, coM, 0, 0)

  const isPastCheckOutTime = now > checkoutDeadline
  const minsPastCheckout = isPastCheckOutTime ? Math.round((now.getTime() - checkoutDeadline.getTime()) / 60000) : 0
  const minutesUntilCheckInTime = Math.max(0, Math.round((checkInDeadline.getTime() - now.getTime()) / 60000))

  const firstUpcomingCheckin = pendingCheckIns[0]
  const showCheckinImminentAlert = pendingCheckIns.length > 0 && minutesUntilCheckInTime <= 120
  
  const overdueCheckoutsCount = pendingCheckouts.length
  const showOverdueCheckoutAlert = overdueCheckoutsCount > 0 && isPastCheckOutTime
  
  const displayHousekeepingAlert = dirtyBedsWithArrivalsCount > 0

  // ── Quick check-in (booking already confirmed, just update status) ──
  const handleQuickCheckIn = useCallback(
    async (booking: ArrivalBooking) => {
      if (checkingIn.has(booking.id)) return
      setCheckingIn((prev) => new Set(prev).add(booking.id))

      // Optimistic update
      setArrivalsToday((prev) =>
        prev.map((b) => (b.id === booking.id ? { ...b, status: 'checked_in' } : b)),
      )

      try {
        const now = new Date().toISOString()
        const [bkErr, bedErr] = await Promise.all([
          supabase
            .from('bookings')
            .update({ status: 'checked_in', check_in_time: now })
            .eq('id', booking.id)
            .then(({ error }) => error),
          booking.bed_id
            ? supabase
                .from('beds')
                .update({ status: 'occupied' })
                .eq('id', booking.bed_id)
                .then(({ error }) => error)
            : Promise.resolve(null),
        ])

        if (bkErr || bedErr) throw bkErr ?? bedErr

        const guest = booking.guest as { first_name: string; last_name?: string } | null
        const guestName = guest ? `${guest.first_name}${guest.last_name ? ' ' + guest.last_name : ''}` : 'Client inconnu'
        logActivity({
          propertyId: property.id,
          userId: session?.userId ?? null,
          staffName: session?.staffName ?? null,
          actionType: 'check_in',
          entityType: 'booking',
          entityId: booking.id,
          description: `Check-in : ${guestName}`,
          meta: { guest_name: guestName },
        })
        toast.success(`${guest?.first_name ?? t('dashboard.toast.defaultGuest')} ${t('dashboard.toast.checkedIn')}`)
      } catch {
        // Rollback
        setArrivalsToday((prev) =>
          prev.map((b) => (b.id === booking.id ? { ...b, status: 'confirmed' } : b)),
        )
        toast.error(t('dashboard.toast.checkinError'))
      } finally {
        setCheckingIn((prev) => {
          const next = new Set(prev)
          next.delete(booking.id)
          return next
        })
      }
    },
    [checkingIn, supabase],
  )

  // ── Quick check-out ──
  const handleQuickCheckOut = useCallback(
    async (booking: DepartureBooking) => {
      if (checkingOut.has(booking.id)) return
      if ((booking.balance_due ?? 0) > 0.01) {
        toast.error(`Checkout bloqué — ${formatCurrency(booking.balance_due ?? 0)} non encaissé`, {
          description: 'Ouvrez la réservation pour encaisser le solde.',
          action: { label: 'Voir', onClick: () => window.location.href = `/bookings/${booking.id}` },
        })
        return
      }
      setCheckingOut((prev) => new Set(prev).add(booking.id))

      // Optimistic: remove from list
      setDeparturesToday((prev) => prev.filter((b) => b.id !== booking.id))

      try {
        const now = new Date().toISOString()
        const [bkErr, bedErr] = await Promise.all([
          supabase
            .from('bookings')
            .update({ status: 'checked_out', check_out_time: now })
            .eq('id', booking.id)
            .then(({ error }) => error),
          booking.bed_id
            ? supabase
                .from('beds')
                .update({ status: 'dirty' })
                .eq('id', booking.bed_id)
                .then(({ error }) => error)
            : Promise.resolve(null),
        ])

        if (bkErr || bedErr) throw bkErr ?? bedErr

        const guest = booking.guest as { first_name: string; last_name?: string } | null
        const guestName = guest ? `${guest.first_name}${guest.last_name ? ' ' + guest.last_name : ''}` : 'Client inconnu'
        logActivity({
          propertyId: property.id,
          userId: session?.userId ?? null,
          staffName: session?.staffName ?? null,
          actionType: 'check_out',
          entityType: 'booking',
          entityId: booking.id,
          description: `Check-out : ${guestName}`,
          meta: { guest_name: guestName },
        })
        toast.success(`${guest?.first_name ?? t('dashboard.toast.defaultGuest')} ${t('dashboard.toast.checkedOut')}`)
      } catch {
        // Rollback
        setDeparturesToday((prev) => [...prev, booking])
        toast.error(t('dashboard.toast.checkoutError'))
      } finally {
        setCheckingOut((prev) => {
          const next = new Set(prev)
          next.delete(booking.id)
          return next
        })
      }
    },
    [checkingOut, supabase],
  )

  // ── Re-fetch helpers ──

  const refreshOccupancy = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0]
    const [bedsRes, arrivalsRes] = await Promise.all([
      supabase.from('beds').select('id, status').eq('property_id', property.id),
      supabase
        .from('bookings')
        .select('bed_id')
        .eq('property_id', property.id)
        .eq('check_in_date', today)
        .in('status', ['confirmed', 'pending']),
    ])
    if (bedsRes.data) {
      setBeds(bedsRes.data)
      const dirtyCount = bedsRes.data.filter((b) => b.status === 'dirty').length
      setDirtyBedsCount(dirtyCount)
      const dirtyIds = new Set(bedsRes.data.filter((b) => b.status === 'dirty').map((b) => b.id))
      const withArrivals = (arrivalsRes.data ?? []).filter(
        (b) => b.bed_id && dirtyIds.has(b.bed_id),
      ).length
      setDirtyBedsWithArrivalsCount(withArrivals)
    }
  }, [property.id, setDirtyBedsCount, supabase])

  const refreshRevenue = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('payments')
      .select('amount, method')
      .eq('property_id', property.id)
      .eq('status', 'completed')
      .gte('payment_date', `${today}T00:00:00`)
      .lt('payment_date', `${today}T23:59:59`)
    if (data) setTodayPayments(data)
  }, [property.id, supabase])

  const arrivalSelect = 'id, bed_id, status, source, check_in_date, check_out_date, pre_checkin_completed, pre_checkin_token, arrival_notes, expected_arrival_time, guest:guest_id(first_name, last_name, nationality, phone, whatsapp), bed:bed_id(name, room:room_id(name))'

  const refreshArrivals = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0]
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]
    const weekEnd = new Date()
    weekEnd.setDate(weekEnd.getDate() + 7)
    const weekEndStr = weekEnd.toISOString().split('T')[0]

    const [todayRes, tomorrowRes, weekRes] = await Promise.all([
      supabase
        .from('bookings')
        .select(arrivalSelect)
        .eq('property_id', property.id)
        .eq('check_in_date', today)
        .in('status', ['confirmed', 'checked_in'])
        .order('created_at'),
      supabase
        .from('bookings')
        .select(arrivalSelect)
        .eq('property_id', property.id)
        .eq('check_in_date', tomorrowStr)
        .in('status', ['confirmed', 'checked_in'])
        .order('created_at'),
      supabase
        .from('bookings')
        .select(arrivalSelect)
        .eq('property_id', property.id)
        .gte('check_in_date', today)
        .lt('check_in_date', weekEndStr)
        .in('status', ['confirmed', 'checked_in'])
        .order('check_in_date')
        .order('created_at'),
    ])
    if (todayRes.data) setArrivalsToday(todayRes.data as unknown as ArrivalBooking[])
    if (tomorrowRes.data) setArrivalsTomorrow(tomorrowRes.data as unknown as ArrivalBooking[])
    if (weekRes.data) setArrivalsWeek(weekRes.data as unknown as ArrivalBooking[])
  }, [property.id, supabase])

  const refreshDepartures = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('bookings')
      .select(
        'id, bed_id, status, check_out_date, guest:guest_id(first_name, last_name), bed:bed_id(name)',
      )
      .eq('property_id', property.id)
      .eq('check_out_date', today)
      .eq('status', 'checked_in')
    if (data) setDeparturesToday(data as unknown as DepartureBooking[])
  }, [property.id, supabase])

  const refreshActivity = useCallback(async () => {
    const { data } = await supabase
      .from('activity_log')
      .select('id, action_type, description, staff_name, created_at, meta')
      .eq('property_id', property.id)
      .order('created_at', { ascending: false })
      .limit(15)
    if (data) setRecentActivity(data as ActivityEntry[])
  }, [property.id, supabase])

  const refreshChart = useCallback(async () => {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
    const { data } = await supabase
      .from('payments')
      .select('amount, method, payment_date')
      .eq('property_id', property.id)
      .eq('status', 'completed')
      .gte('payment_date', sevenDaysAgo.toISOString())
    if (data) {
      const built = Array.from({ length: 7 }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (6 - i))
        const dayStr = d.toISOString().split('T')[0]
        const dayPayments = data.filter((p) => p.payment_date.startsWith(dayStr))
        return {
          day: d.toLocaleDateString('fr-FR', { weekday: 'short' }),
          revenue: dayPayments.reduce((s, p) => s + p.amount, 0),
          cash: dayPayments.filter((p) => p.method === 'cash').reduce((s, p) => s + p.amount, 0),
          virement: dayPayments
            .filter((p) => p.method === 'virement')
            .reduce((s, p) => s + p.amount, 0),
          cmi: dayPayments.filter((p) => p.method === 'cmi').reduce((s, p) => s + p.amount, 0),
        }
      })
      setChartData(built)
    }
  }, [property.id, supabase])

  const refreshForecast = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0]
    const sevenDaysLater = new Date()
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 6)
    const { data } = await supabase
      .from('bookings')
      .select('check_in_date, check_out_date')
      .eq('property_id', property.id)
      .in('status', ['confirmed', 'checked_in'])
      .lte('check_in_date', sevenDaysLater.toISOString().split('T')[0])
      .gt('check_out_date', today)
    if (data) {
      const total = beds.length
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() + i)
        const dayStr = d.toISOString().split('T')[0]
        const occupied = data.filter(
          (b) => b.check_in_date <= dayStr && b.check_out_date > dayStr,
        ).length
        return {
          date: dayStr,
          label: i === 0 ? t('dashboard.todayShort') : d.toLocaleDateString('fr-FR', { weekday: 'short' }),
          occupied,
          total,
        }
      })
      setForecastDays(days)
    }
  }, [property.id, beds.length, supabase])

  // ── Realtime subscriptions ──

  useEffect(() => {
    const channel = supabase
      .channel(`dashboard-live-${property.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings', filter: `property_id=eq.${property.id}` },
        () => {
          refreshOccupancy()
          refreshArrivals()
          refreshDepartures()
          refreshActivity()
          refreshForecast()
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments', filter: `property_id=eq.${property.id}` },
        () => {
          refreshRevenue()
          refreshChart()
          refreshActivity()
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_log', filter: `property_id=eq.${property.id}` },
        () => refreshActivity(),
      )
      .subscribe((status) => {
        setRealtimeConnected(status === 'SUBSCRIBED')
      })

    return () => {
      supabase.removeChannel(channel)
      setRealtimeConnected(false)
    }
  }, [
    property.id,
    supabase,
    setRealtimeConnected,
    refreshOccupancy,
    refreshArrivals,
    refreshDepartures,
    refreshActivity,
    refreshRevenue,
    refreshChart,
    refreshForecast,
  ])

  // ── Welcome screen ──
  if (totalBeds === 0) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-4 py-12">
        <div className="max-w-2xl w-full space-y-8 text-center">
          <div className="flex items-center justify-center">
            <AppLogo size={80} className="rounded-3xl" />
          </div>
          <div className="space-y-3">
            <h1 className="text-2xl font-semibold tracking-tight">{t('dashboard.welcome')}</h1>
            <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
              {t('dashboard.welcomeSubtitle')}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
            {[
              { step: '1', icon: Settings, label: t('dashboard.setup.step1'), desc: t('dashboard.setup.step1desc'), active: true },
              { step: '2', icon: CalendarPlus, label: t('dashboard.setup.step2'), desc: t('dashboard.setup.step2desc'), active: false },
              { step: '3', icon: BarChart3, label: t('dashboard.setup.step3'), desc: t('dashboard.setup.step3desc'), active: false },
            ].map(({ step, icon: Icon, label, desc, active }) => (
              <div key={step} className={`rounded-2xl border p-5 space-y-2 ${active ? 'border-[#0F6E56]/40 bg-[#0F6E56]/5' : ''}`}>
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${active ? 'text-[#0F6E56]' : 'text-muted-foreground'}`} />
                  <span className={`text-xs font-medium ${active ? 'text-[#0F6E56]' : 'text-muted-foreground'}`}>{t('dashboard.step')} {step}</span>
                </div>
                <p className="font-medium text-sm">{label}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/settings/rooms">
              <Button className="h-12 px-8 text-base bg-[#0F6E56] hover:bg-[#0c5a46]">
                {t('dashboard.setup.configureRooms')} <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link href="/guests/new">
              <Button variant="outline" className="h-12 px-6 text-base shadow-sm font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-muted/50 border-2">
                {t('dashboard.setup.startCheckin')}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }


  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 hp-page-in space-y-8 bg-[#F4F6F8] min-h-full">
      
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-[#0A1F1C] tracking-tight">{t('dashboard.greeting.hello')}, {session?.staffName || property.name} 👋</h1>
          <p className="text-sm font-medium text-muted-foreground">{t('dashboard.subtitle')}</p>
        </div>
        <div className="flex gap-2">
           <Link href="/calendar">
             <Button variant="outline" className="h-12 px-6 rounded-2xl border-2 font-black text-xs uppercase tracking-widest shadow-sm hover:shadow-md transition-all">
                {t('nav.calendar')}
             </Button>
           </Link>
           <Link href="/guests/new">
             <Button className="h-12 px-6 rounded-2xl bg-[#0F6E56] hover:bg-[#0c5a46] text-white font-black text-xs uppercase tracking-widest shadow-lg hover:shadow-[#0F6E56]/25 transition-all">
                {t('dashboard.newCheckin')}
             </Button>
           </Link>
        </div>
      </div>

      {/* Alerts Row */}
      <div className="space-y-3">
        {displayHousekeepingAlert && (
          <Link href="/housekeeping">
            <div className="group flex items-center gap-4 rounded-[24px] border border-amber-200 bg-amber-50/50 p-4 hover:bg-amber-50 hover:shadow-lg hover:shadow-amber-500/10 transition-all cursor-pointer animate-in slide-in-from-top-4 duration-500">
              <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center transition-transform group-hover:rotate-12">
                <TriangleAlert className="w-6 h-6 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-black text-amber-900 tracking-tight">
                  {dirtyBedsWithArrivalsCount > 1 ? t('dashboard.alert.dirtyBeds.plural').replace('{n}', String(dirtyBedsWithArrivalsCount)) : t('dashboard.alert.dirtyBeds.singular')}
                </p>
                <p className="text-xs font-medium text-amber-700 mt-1 uppercase tracking-wide">
                  ⏰ {t('dashboard.alert.arrivalsIn')}{' '}
                  {minutesUntilCheckInTime < 60
                    ? `${minutesUntilCheckInTime} min`
                    : `${Math.floor(minutesUntilCheckInTime / 60)}h${minutesUntilCheckInTime % 60 > 0 ? String(minutesUntilCheckInTime % 60).padStart(2, '0') : ''}`}
                </p>
              </div>
              <div className="px-4 py-2 bg-amber-100/50 rounded-xl group-hover:bg-amber-100 transition-colors">
                  <span className="text-xs font-black text-amber-700 uppercase tracking-widest">{t('dashboard.alert.manage')}</span>
              </div>
            </div>
          </Link>
        )}

        {showOverdueCheckoutAlert && (
          <div className="flex items-center gap-4 rounded-[24px] border border-red-200 bg-red-50/50 p-4 animate-in slide-in-from-top-4 duration-500">
            <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-base font-black text-red-900 tracking-tight">
                {overdueCheckoutsCount > 1 ? t('dashboard.alert.lateCheckouts.plural').replace('{n}', String(overdueCheckoutsCount)) : t('dashboard.alert.lateCheckouts.singular')}
              </p>
              <p className="text-xs font-medium text-red-700 mt-1 uppercase tracking-wide">
                🕒 {t('dashboard.alert.lateBy')}{' '}
                {minsPastCheckout < 60
                  ? `${minsPastCheckout} min`
                  : `${Math.floor(minsPastCheckout / 60)}h${minsPastCheckout % 60 > 0 ? String(minsPastCheckout % 60).padStart(2, '0') : ''}`}
              </p>
            </div>
          </div>
        )}

        {canViewRevenue && pendingPayments.length > 0 && (
          <div className="rounded-[24px] border border-orange-200 bg-orange-50/50 p-4 animate-in slide-in-from-top-4 duration-500">
            <div className="flex items-center gap-4 mb-3">
              <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-6 h-6 text-orange-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-black text-orange-900 tracking-tight">
                  {pendingPayments.length === 1
                    ? '1 client a un solde impayé'
                    : `${pendingPayments.length} clients ont un solde impayé`}
                </p>
                <p className="text-xs font-medium text-orange-700 mt-0.5 uppercase tracking-wide">
                  💰 Total à encaisser :{' '}
                  {formatCurrency(pendingPayments.reduce((s, p) => s + p.balance, 0))}
                </p>
              </div>
            </div>
            <div className="space-y-1.5 pl-16">
              {pendingPayments.slice(0, 5).map((p) => (
                <Link key={p.id} href={`/bookings/${p.id}`} className="flex items-center justify-between group">
                  <span className="text-sm font-semibold text-orange-800 group-hover:underline">
                    {p.guest?.first_name} {p.guest?.last_name}
                  </span>
                  <span className="text-sm font-black text-orange-700">
                    {formatCurrency(p.balance)}
                    {' '}
                    <span className="text-xs font-medium text-orange-500">→ checkout {new Date(p.check_out_date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title={t('dashboard.occupancy')}
          value={`${occupiedBeds}/${totalBeds}`}
          subtitle={`${occupancyPct}% ${t('dashboard.metric.filled')}`}
          icon={BedDouble}
          accentColor="#0F6E56"
          progress={occupancyPct}
          animate
        />
        {canViewRevenue && (
          <MetricCard
            title={t('dashboard.revenue')}
            value={formatCurrency(todayRevenue)}
            subtitle={`${formatCurrency(cashToday)} ${t('dashboard.metric.inCash')}`}
            icon={DollarSign}
            accentColor="#3b82f6"
            animate
          />
        )}
        <MetricCard
          title={t('dashboard.metric.checkinsToday')}
          value={String(arrivalsToday.length)}
          subtitle={`${pendingCheckIns.length} ${t('dashboard.metric.pendingOf')} ${arrivalsToday.length}`}
          icon={LogIn}
          accentColor="#f59e0b"
          animate
        />
        <MetricCard
          title={t('dashboard.pendingCheckouts')}
          value={String(departuresToday.length)}
          subtitle={`${pendingCheckouts.length} ${t('dashboard.metric.pending')}`}
          icon={LogOut}
          accentColor="#6366f1"
          animate
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Arrivals & Departures Overhaul */}
        <div className="space-y-6">
          <ArrivalsPanel
            arrivalsToday={arrivalsToday}
            arrivalsTomorrow={arrivalsTomorrow}
            arrivalsWeek={arrivalsWeek}
            checkingIn={checkingIn}
            onQuickCheckIn={handleQuickCheckIn}
            onOpenAddArrival={() => setAddArrivalOpen(true)}
            propertyName={property.name}
            appUrl={typeof window !== 'undefined' ? window.location.origin : ''}
          />

          <Card className="rounded-[16px] border border-[#E8ECF0] shadow-[0_1px_4px_rgba(0,0,0,0.04)] bg-white overflow-hidden">
             <CardHeader className="p-6 pb-4">
                <CardTitle className="text-[13px] font-semibold uppercase tracking-widest text-[#94A3B8] flex items-center gap-2">
                   <LogOut className="w-4 h-4 text-indigo-500" />
                   {t('dashboard.departures')}
                </CardTitle>
             </CardHeader>
             <CardContent className="px-6 pb-6 space-y-3">
                {departuresToday.length === 0 ? (
                  <div className="py-8 text-center bg-muted/5 rounded-2xl border-2 border-dashed border-muted/50">
                     <p className="text-sm font-bold text-muted-foreground opacity-60">{t('dashboard.noDepartures')}</p>
                  </div>
                ) : (
                  departuresToday.map((booking) => {
                    const guest = booking.guest
                    const isLoading = checkingOut.has(booking.id)
                    return (
                      <div key={booking.id} className="group flex items-center justify-between p-4 rounded-[14px] border bg-white border-[#E8ECF0] hover:border-indigo-500/30 transition-all hover:shadow-sm">
                         <div className="flex items-center gap-4">
                            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm", (booking.balance_due ?? 0) > 0.01 ? 'bg-orange-50 text-orange-600' : 'bg-indigo-50 text-indigo-600')}>
                              {guest?.first_name?.[0]}{guest?.last_name?.[0]}
                            </div>
                            <div>
                               <p className="font-bold tracking-tight text-[#0A1F1C]">{guest?.first_name} {guest?.last_name}</p>
                               <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t('dashboard.bedLabel')}: {booking.bed?.name ?? '?'}</p>
                               {(booking.balance_due ?? 0) > 0.01 && (
                                 <p className="text-[10px] font-black text-orange-600 uppercase tracking-wider mt-0.5">
                                   💰 {formatCurrency(booking.balance_due ?? 0)} à encaisser
                                 </p>
                               )}
                            </div>
                         </div>
                         <Button
                           variant="outline"
                           size="sm"
                           disabled={isLoading}
                           onClick={() => handleQuickCheckOut(booking)}
                           className={cn("border-2 rounded-xl h-9 font-black text-[10px] uppercase tracking-wider transition-all",
                             (booking.balance_due ?? 0) > 0.01
                               ? 'border-orange-200 text-orange-600 hover:bg-orange-600 hover:text-white'
                               : 'border-indigo-100 text-indigo-600 hover:bg-indigo-600 hover:text-white'
                           )}
                         >
                           {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (booking.balance_due ?? 0) > 0.01 ? '💰 Impayé' : t('dashboard.checkoutNow')}
                         </Button>
                      </div>
                    )
                  })
                )}
             </CardContent>
          </Card>
        </div>

        {/* Recent Activity Log — Overhauled */}
        <div className="space-y-6">
           <Card className="rounded-[16px] border border-[#E8ECF0] shadow-[0_1px_4px_rgba(0,0,0,0.04)] bg-white overflow-hidden h-full flex flex-col">
              <CardHeader className="p-6 pb-4">
                 <CardTitle className="text-[13px] font-semibold uppercase tracking-widest text-[#94A3B8] flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-500" />
                    {t('dashboard.activity')}
                 </CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-6 flex-1">
                 <div className="space-y-1 relative">
                    <div className="absolute left-[23px] top-6 bottom-6 w-0.5 bg-muted/20" />
                    
                    {recentActivity.slice(0, 10).map((log) => {
                      const { Icon, bg, color } = ACTIVITY_CONFIG[log.action_type] || ACTIVITY_CONFIG.default
                      return (
                        <div key={log.id} className="group relative flex gap-4 py-3 border-b border-[#F0F4F7] last:border-0 transition-all hover:bg-[#F8FAFC] px-2 rounded-[10px]">
                           <div className={cn("relative z-10 w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110", bg)}>
                              <Icon className={cn("w-4 h-4", color)} />
                           </div>
                           <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-0.5">
                                 <p className="text-[11px] font-semibold text-[#94A3B8] leading-none">{log.staff_name || t('dashboard.system')}</p>
                                 <p className="text-[10px] text-[#94A3B8]">{formatTime(log.created_at)}</p>
                              </div>
                              <p className="text-sm font-semibold text-[#0A1F1C] leading-snug">{log.description}</p>
                           </div>
                        </div>
                      )
                    })}
                 </div>

                 {canViewRevenue && (
                    <div className="mt-6 pt-6 border-t border-[#E8ECF0]">
                       <OccupancyChart data={chartData} />
                    </div>
                 )}
              </CardContent>
           </Card>
        </div>
      </div>

      {/* Add Arrival Modal */}
      <AddArrivalModal
        open={addArrivalOpen}
        onClose={() => setAddArrivalOpen(false)}
        propertyId={property.id}
        session={session}
        rooms={initialData.rooms}
        beds={initialData.allBeds}
        onSuccess={() => {
          refreshArrivals()
          refreshOccupancy()
          refreshForecast()
          refreshActivity()
        }}
      />
    </div>
  )
}
