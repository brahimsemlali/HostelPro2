'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { BOOKING_SOURCES } from '@/lib/constants'
import { buildWhatsAppLink } from '@/lib/whatsapp/templates'
import {
  LogIn,
  CheckCircle2,
  Loader2,
  MessageSquare,
  ClipboardList,
  Plus,
  Clock,
  CalendarDays,
  ChevronRight,
  Plane,
  Send,
} from 'lucide-react'
import Link from 'next/link'
import { useT } from '@/app/context/LanguageContext'

// ── Types ────────────────────────────────────────────────────────────────────

interface GuestRef {
  first_name: string
  last_name: string
  nationality?: string | null
  phone?: string | null
  whatsapp?: string | null
}

interface BedRef {
  name: string
  room?: { name: string } | null
}

export interface ArrivalBooking {
  id: string
  bed_id: string | null
  status: string
  source: string
  check_in_date: string
  check_out_date: string
  pre_checkin_completed?: boolean
  pre_checkin_token?: string | null
  arrival_notes?: string | null
  expected_arrival_time?: string | null
  guest: GuestRef | null
  bed: BedRef | null
}

type ArrivalTab = 'today' | 'tomorrow' | 'week'

// ── Source badge colours ─────────────────────────────────────────────────────

const sourceColors: Record<string, string> = {
  direct: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  booking_com: 'bg-blue-100 text-blue-800 border-blue-200',
  hostelworld: 'bg-orange-100 text-orange-800 border-orange-200',
  airbnb: 'bg-rose-100 text-rose-800 border-rose-200',
  phone: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  walkin: 'bg-gray-100 text-gray-800 border-gray-200',
}

// ── Nationality flags ────────────────────────────────────────────────────────

const NAT_FLAG: Record<string, string> = {
  'Marocaine': '🇲🇦', 'Marocain': '🇲🇦',
  'Française': '🇫🇷', 'Français': '🇫🇷',
  'Espagnole': '🇪🇸', 'Allemande': '🇩🇪',
  'Italienne': '🇮🇹', 'Portugaise': '🇵🇹',
  'Britannique': '🇬🇧', 'Américaine': '🇺🇸',
  'Belge': '🇧🇪', 'Néerlandaise': '🇳🇱',
  'Suisse': '🇨🇭', 'Canadienne': '🇨🇦',
  'Algérienne': '🇩🇿', 'Tunisienne': '🇹🇳',
  'Brésilienne': '🇧🇷', 'Japonaise': '🇯🇵',
  'Australienne': '🇦🇺',
}

function natFlag(n: string | null | undefined) {
  return n ? (NAT_FLAG[n] ?? '🌍') : '🌍'
}

// ── Status helpers ───────────────────────────────────────────────────────────

function getArrivalStatus(booking: ArrivalBooking, t: (key: string) => string): {
  label: string
  color: string
  bgColor: string
  borderColor: string
  icon: React.ElementType
} {
  if (booking.status === 'checked_in') {
    return {
      label: t('arrival.status.arrived'),
      color: 'text-[#0F6E56]',
      bgColor: 'bg-[#0F6E56]/10',
      borderColor: 'border-[#0F6E56]/30',
      icon: CheckCircle2,
    }
  }
  if (booking.pre_checkin_completed) {
    return {
      label: t('arrival.status.preChecked'),
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      icon: ClipboardList,
    }
  }
  return {
    label: t('arrival.status.confirmed'),
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    icon: Clock,
  }
}

// ── Date helpers ─────────────────────────────────────────────────────────────

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function groupByDate(bookings: ArrivalBooking[]): Record<string, ArrivalBooking[]> {
  const groups: Record<string, ArrivalBooking[]> = {}
  for (const b of bookings) {
    if (!groups[b.check_in_date]) groups[b.check_in_date] = []
    groups[b.check_in_date].push(b)
  }
  return groups
}

// ── Component ────────────────────────────────────────────────────────────────

interface ArrivalsProps {
  arrivalsToday: ArrivalBooking[]
  arrivalsTomorrow: ArrivalBooking[]
  arrivalsWeek: ArrivalBooking[]
  checkingIn: Set<string>
  onQuickCheckIn: (booking: ArrivalBooking) => void
  onOpenAddArrival: () => void
  propertyName: string
  appUrl: string
}

export function ArrivalsPanel({
  arrivalsToday,
  arrivalsTomorrow,
  arrivalsWeek,
  checkingIn,
  onQuickCheckIn,
  onOpenAddArrival,
  appUrl,
}: ArrivalsProps) {
  const [activeTab, setActiveTab] = useState<ArrivalTab>('today')
  const t = useT()

  const tabs: { key: ArrivalTab; label: string; count: number }[] = [
    { key: 'today', label: t('common.today'), count: arrivalsToday.length },
    { key: 'tomorrow', label: t('arrival.tab.tomorrow'), count: arrivalsTomorrow.length },
    { key: 'week', label: t('arrival.tab.week'), count: arrivalsWeek.length },
  ]

  const currentBookings =
    activeTab === 'today'
      ? arrivalsToday
      : activeTab === 'tomorrow'
        ? arrivalsTomorrow
        : arrivalsWeek

  const isWeekView = activeTab === 'week'
  const dateGroups = isWeekView ? groupByDate(currentBookings) : null

  return (
    <Card className="rounded-[16px] border border-[#E8ECF0] shadow-[0_1px_4px_rgba(0,0,0,0.04)] bg-white overflow-hidden">
      <CardHeader className="p-6 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[13px] font-semibold uppercase tracking-widest text-[#94A3B8] flex items-center gap-2">
            <LogIn className="w-4 h-4 text-[#0F6E56]" />
            {t('dashboard.arrivals')}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenAddArrival}
            className="font-bold text-[#0F6E56] hover:bg-[#0F6E56]/5 rounded-xl text-xs gap-1.5"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            {t('common.add')}
          </Button>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1.5 mt-4">
          {tabs.map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold border-2 transition-all duration-200',
                activeTab === key
                  ? 'bg-[#0F6E56] border-[#0F6E56] text-white shadow-sm'
                  : 'bg-white border-[#E8ECF0] text-muted-foreground hover:border-[#0F6E56]/30 hover:text-[#0F6E56]',
              )}
            >
              <span>{label}</span>
              <span
                className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] tabular-nums font-black',
                  activeTab === key
                    ? 'bg-white/20 text-white'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {count}
              </span>
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="px-6 pb-6 space-y-3">
        {currentBookings.length === 0 ? (
          <div className="py-12 text-center bg-muted/5 rounded-2xl border-2 border-dashed border-muted/50 space-y-3">
            <CalendarDays className="w-8 h-8 text-muted-foreground/30 mx-auto" />
            <p className="text-sm font-bold text-muted-foreground">
              {activeTab === 'today'
                ? t('arrival.empty.today')
                : activeTab === 'tomorrow'
                  ? t('arrival.empty.tomorrow')
                  : t('arrival.empty.week')}
            </p>
            <button
              onClick={onOpenAddArrival}
              className="text-xs text-[#0F6E56] hover:underline font-bold"
            >
              + {t('arrival.addArrival')}
            </button>
          </div>
        ) : isWeekView && dateGroups ? (
          // Week view — grouped by date
          Object.entries(dateGroups)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, bookings]) => (
              <div key={date} className="space-y-2">
                <div className="flex items-center gap-2 pt-2 first:pt-0">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    {formatDateLabel(date)}
                  </span>
                  <span className="flex-1 h-px bg-muted/30" />
                  <span className="text-[10px] font-bold text-muted-foreground tabular-nums">
                    {bookings.length}
                  </span>
                </div>
                {bookings.map((booking, i) => (
                  <ArrivalCard
                    key={booking.id}
                    booking={booking}
                    isLoading={checkingIn.has(booking.id)}
                    onCheckIn={() => onQuickCheckIn(booking)}
                    canCheckIn={date <= new Date().toISOString().split('T')[0]}
                    appUrl={appUrl}
                    index={i}
                    t={t}
                  />
                ))}
              </div>
            ))
        ) : (
          // Today / Tomorrow — flat list
          currentBookings.map((booking, i) => (
            <ArrivalCard
              key={booking.id}
              booking={booking}
              isLoading={checkingIn.has(booking.id)}
              onCheckIn={() => onQuickCheckIn(booking)}
              canCheckIn={activeTab === 'today'}
              appUrl={appUrl}
              index={i}
              t={t}
            />
          ))
        )}
      </CardContent>
    </Card>
  )
}

// ── Arrival Card ─────────────────────────────────────────────────────────────

function ArrivalCard({
  booking,
  isLoading,
  onCheckIn,
  canCheckIn,
  appUrl,
  index,
  t,
}: {
  booking: ArrivalBooking
  isLoading: boolean
  onCheckIn: () => void
  canCheckIn: boolean
  appUrl: string
  index: number
  t: (key: string) => string
}) {
  const guest = booking.guest
  const bed = booking.bed
  const status = getArrivalStatus(booking, t)
  const StatusIcon = status.icon
  const isCheckedIn = booking.status === 'checked_in'
  const contactNum = guest?.whatsapp ?? guest?.phone

  // Pre-checkin form URL
  const preCheckinUrl = booking.pre_checkin_token
    ? `${appUrl}/checkin/${booking.pre_checkin_token}`
    : null

  return (
    <div
      className={cn(
        'group relative flex flex-col rounded-[14px] border transition-all hover:shadow-sm overflow-hidden',
        isCheckedIn
          ? 'bg-emerald-50/50 border-emerald-100/50'
          : 'bg-white border-[#E8ECF0] hover:border-[#0F6E56]/30',
      )}
      style={{
        animationDelay: `${index * 55}ms`,
        animation: 'hp-fade-up 0.4s ease-out both',
      }}
    >
      {/* Main Row */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          {/* Avatar */}
          <div
            className={cn(
              'w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm flex-shrink-0 transition-transform duration-300 group-hover:scale-105',
              isCheckedIn
                ? 'bg-[#0F6E56] text-white'
                : booking.pre_checkin_completed
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-muted text-foreground',
            )}
          >
            {guest?.first_name?.[0]}
            {guest?.last_name?.[0]}
          </div>

          {/* Name + Meta */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold tracking-tight text-[#0A1F1C] truncate">
                {guest?.first_name} {guest?.last_name}
              </span>
              <span className="text-base grayscale group-hover:grayscale-0 transition-all flex-shrink-0">
                {natFlag(guest?.nationality)}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="outline"
                className={cn(
                  'text-[8px] px-1.5 py-0 border-none leading-tight font-black uppercase tracking-[0.1em]',
                  sourceColors[booking.source],
                )}
              >
                {BOOKING_SOURCES[booking.source] ?? booking.source}
              </Badge>
              <span className="text-[10px] font-bold text-muted-foreground">
                {bed?.room?.name} {bed?.name}
              </span>
              {booking.expected_arrival_time && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md">
                  <Plane className="w-2.5 h-2.5" />
                  {booking.expected_arrival_time.slice(0, 5)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Status / Action */}
        <div className="flex-shrink-0 ml-3">
          {isCheckedIn ? (
            <div className="bg-[#0F6E56]/20 text-[#0F6E56] px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />
              <span className="text-[10px] font-black uppercase tracking-widest">
                OK
              </span>
            </div>
          ) : canCheckIn ? (
            <Button
              size="sm"
              disabled={isLoading}
              onClick={onCheckIn}
              className="bg-white border-2 border-[#0F6E56]/20 text-[#0F6E56] hover:bg-[#0F6E56] hover:text-white rounded-xl h-9 px-4 font-black text-[10px] uppercase tracking-wider transition-all"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#0F6E56]" />
              ) : (
                t('dashboard.checkinNow')
              )}
            </Button>
          ) : (
            <div
              className={cn(
                'px-3 py-1.5 rounded-xl flex items-center gap-1.5',
                status.bgColor,
                status.borderColor,
                'border',
              )}
            >
              <StatusIcon className={cn('w-3 h-3', status.color)} />
              <span
                className={cn(
                  'text-[10px] font-black uppercase tracking-widest',
                  status.color,
                )}
              >
                {status.label}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Notes row (if any) */}
      {booking.arrival_notes && (
        <div className="px-4 pb-2 -mt-1">
          <p className="text-[11px] text-muted-foreground bg-muted/30 rounded-lg px-3 py-1.5 leading-relaxed">
            📝 {booking.arrival_notes}
          </p>
        </div>
      )}

      {/* Actions row — only for non-checked-in bookings */}
      {!isCheckedIn && contactNum && (
        <div className="flex items-center gap-2 px-4 pb-3 pt-1">
          {/* WhatsApp message */}
          <a
            href={buildWhatsAppLink(contactNum, '')}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 text-[10px] font-bold text-[#25D366] hover:text-white bg-[#25D366]/10 hover:bg-[#25D366] px-3 py-1.5 rounded-lg transition-all"
          >
            <MessageSquare className="w-3 h-3" />
            WhatsApp
          </a>

          {/* Send pre-checkin form */}
          {preCheckinUrl && contactNum && (
            <a
              href={buildWhatsAppLink(
                contactNum,
                `Bonjour ${guest?.first_name ?? ''} ! Pour accélérer votre arrivée, remplissez ce formulaire : ${preCheckinUrl}`,
              )}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 hover:text-white bg-blue-50 hover:bg-blue-600 px-3 py-1.5 rounded-lg transition-all"
            >
              <Send className="w-3 h-3" />
              {t('arrival.form')}
            </a>
          )}

          {/* View booking */}
          <Link
            href={`/bookings/${booking.id}`}
            className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground hover:text-[#0A1F1C] ml-auto transition-colors"
          >
            {t('arrival.details')}
            <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      )}
    </div>
  )
}
