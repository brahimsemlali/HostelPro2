'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatDateShort, formatCurrency } from '@/lib/utils'
import { BOOKING_SOURCES } from '@/lib/constants'
import { CalendarCheck, Search, X } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { cn } from '@/lib/utils'
import { useT } from '@/app/context/LanguageContext'

interface Guest {
  first_name: string
  last_name: string
  nationality: string
}

interface Bed {
  name: string
  room: { name: string } | null
}

interface Booking {
  id: string
  status: string
  source: string
  check_in_date: string
  check_out_date: string
  total_price: number
  guest: Guest | null
  bed: Bed | null
}

interface Props {
  bookings: Booking[]
  page: number
  totalPages: number
  totalCount: number
}

type StatusFilterKey = 'all' | 'checked_in' | 'confirmed' | 'checked_out' | 'cancelled' | 'no_show'

const statusColors: Record<string, string> = {
  confirmed: 'bg-blue-100 text-blue-700',
  checked_in: 'bg-[#0F6E56]/10 text-[#0F6E56]',
  checked_out: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-700',
  no_show: 'bg-amber-100 text-amber-700',
  pending: 'bg-yellow-100 text-yellow-700',
}

export function BookingsClient({ bookings, page, totalPages, totalCount }: Props) {
  const router = useRouter()
  const t = useT()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilterKey>('all')

  const STATUS_FILTERS = [
    { key: 'all' as StatusFilterKey, label: t('bookings.allStatuses') },
    { key: 'checked_in' as StatusFilterKey, label: t('bookings.status.checked_in') },
    { key: 'confirmed' as StatusFilterKey, label: t('bookings.status.confirmed') },
    { key: 'checked_out' as StatusFilterKey, label: t('bookings.status.checked_out') },
    { key: 'cancelled' as StatusFilterKey, label: t('bookings.status.cancelled') },
    { key: 'no_show' as StatusFilterKey, label: t('bookings.status.no_show') },
  ]

  const statusLabels: Record<string, string> = {
    confirmed: t('bookings.status.confirmed'),
    checked_in: t('bookings.status.checked_in'),
    checked_out: t('bookings.status.checked_out'),
    cancelled: t('bookings.status.cancelled'),
    no_show: t('bookings.status.no_show'),
    pending: t('bookings.status.pending'),
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return bookings.filter((b) => {
      if (statusFilter !== 'all' && b.status !== statusFilter) return false
      if (q) {
        const guestName = b.guest ? `${b.guest.first_name} ${b.guest.last_name}`.toLowerCase() : ''
        const bedInfo = b.bed ? `${b.bed.room?.name ?? ''} ${b.bed.name}`.toLowerCase() : ''
        if (!guestName.includes(q) && !bedInfo.includes(q)) return false
      }
      return true
    })
  }, [bookings, query, statusFilter])

  // Count per status for badges
  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    bookings.forEach((b) => { c[b.status] = (c[b.status] ?? 0) + 1 })
    return c
  }, [bookings])

  return (
    <div className="p-6 space-y-4 max-w-4xl mx-auto hp-page-in bg-[#F4F6F8] min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
          <Input
            placeholder={t('bookings.search')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 h-10 bg-white border-[#E8ECF0] rounded-[12px] text-sm"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <Link href="/guests/new">
          <Button size="sm" className="bg-[#0F6E56] hover:bg-[#0c5a46]">+ Check-in</Button>
        </Link>
      </div>

      {/* Status filter chips */}
      <div className="flex gap-1.5 flex-wrap">
        {STATUS_FILTERS.map(({ key, label }) => {
          const count = key === 'all' ? bookings.length : (counts[key] ?? 0)
          if (key !== 'all' && count === 0) return null
          return (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium border transition-colors flex items-center gap-1.5',
                statusFilter === key
                  ? 'bg-[#0F6E56] text-white border-[#0F6E56]'
                  : 'bg-background text-muted-foreground border-border hover:bg-muted',
              )}
            >
              {label}
              <span
                className={cn(
                  'text-[10px] px-1.5 py-0 rounded-full font-bold',
                  statusFilter === key ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground',
                )}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Results */}
      <p className="text-xs text-muted-foreground">
        {filtered.length} {t('bookings.title').toLowerCase()}
        {statusFilter !== 'all' || query ? ` / ${bookings.length}` : ''}
      </p>

      {bookings.length === 0 ? (
        <div className="rounded-[16px] border-2 border-dashed border-[#E8ECF0] bg-white">
          <EmptyState
            icon={CalendarCheck}
            iconBg="bg-blue-50"
            iconColor="text-blue-500"
            title={t('bookings.noBookings')}
            description={t('bookings.noBookingsDesc')}
            action={{ label: `+ ${t('dashboard.newCheckin')}`, href: '/guests/new' }}
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <Search className="w-8 h-8 text-[#94A3B8]/40" />
          <p className="text-sm font-medium text-[#0A1F1C]">{t('common.noResult')}</p>
          <button
            onClick={() => { setQuery(''); setStatusFilter('all') }}
            className="text-xs text-[#0F6E56] hover:underline"
          >
            {t('bookings.resetFilters')}
          </button>
        </div>
      ) : (
        <div className="bg-white border border-[#E8ECF0] rounded-[16px] overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
          {filtered.map((b, i) => (
            <Link key={b.id} href={`/bookings/${b.id}`}>
              <div className={cn('px-4 py-3.5 flex items-center justify-between flex-wrap gap-2 transition-colors hover:bg-[#F8FAFC] cursor-pointer', i < filtered.length - 1 && 'border-b border-[#F0F4F7]')}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#F4F6F8] flex items-center justify-center text-sm font-medium text-[#475569] flex-shrink-0">
                    {b.guest
                      ? (b.guest.first_name?.[0] ?? '?') + (b.guest.last_name?.[0] ?? '')
                      : '?'}
                  </div>
                  <div>
                    <p className="font-medium text-sm text-[#0A1F1C]">
                      {b.guest
                        ? `${b.guest.first_name} ${b.guest.last_name}`
                        : t('bookings.unknownGuest')}
                    </p>
                    <p className="text-xs text-[#94A3B8] mt-0.5">
                      {formatDateShort(b.check_in_date)} → {formatDateShort(b.check_out_date)}
                      {b.bed ? ` · ${b.bed.room?.name} ${b.bed.name}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${statusColors[b.status] ?? ''}`}
                  >
                    {statusLabels[b.status] ?? b.status}
                  </span>
                  <span className="text-xs text-[#94A3B8] bg-[#F4F6F8] px-2.5 py-0.5 rounded-full">
                    {BOOKING_SOURCES[b.source] ?? b.source}
                  </span>
                  <span className="text-sm font-semibold text-[#0A1F1C]">{formatCurrency(b.total_price)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 pb-1 text-sm text-muted-foreground">
          <span>
            {t('common.page')} {page} / {totalPages} — {totalCount} {t('bookings.title').toLowerCase()}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => router.push(`/bookings?page=${page - 1}`)}
            >
              {t('common.previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => router.push(`/bookings?page=${page + 1}`)}
            >
              {t('common.next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
