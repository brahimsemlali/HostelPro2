'use client'

import { useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'
import { FlaskConical, Download, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/app/context/LanguageContext'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Payment {
  amount: number
  method: string
  payment_date: string
  type: string
}

interface Booking {
  id: string
  source: string
  commission_rate: number
  total_price: number
  net_revenue: number
  nights: number
  check_in_date: string
}

// ─── Date range config ────────────────────────────────────────────────────────

const DATE_RANGE_VALUES = ['7d', '30d', 'month', 'last_month', '90d'] as const
type RangeKey = (typeof DATE_RANGE_VALUES)[number]


function getDateBounds(range: RangeKey): { from: string; to: string; days: number } {
  const now = new Date()
  let from: Date
  let to: Date = new Date(now)
  to.setHours(23, 59, 59, 999)

  switch (range) {
    case '7d':
      from = new Date(now)
      from.setDate(from.getDate() - 6)
      break
    case '30d':
      from = new Date(now)
      from.setDate(from.getDate() - 29)
      break
    case 'month':
      from = new Date(now.getFullYear(), now.getMonth(), 1)
      break
    case 'last_month':
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      to = new Date(now.getFullYear(), now.getMonth(), 0)
      to.setHours(23, 59, 59, 999)
      break
    case '90d':
      from = new Date(now)
      from.setDate(from.getDate() - 89)
      break
  }
  from.setHours(0, 0, 0, 0)
  const diffMs = to.getTime() - from.getTime()
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
    days,
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COLORS = ['#0F6E56', '#5DCAA5', '#f59e0b', '#3b82f6', '#8b5cf6']

// sourceLabels built inside component with t()

// ─── Sample data ──────────────────────────────────────────────────────────────

function buildSampleDailyData() {
  const seed = [420, 560, 380, 700, 840, 980, 760, 450, 620, 530,
                390, 470, 810, 730, 650, 900, 1050, 880, 590, 460,
                350, 620, 780, 1120, 990, 840, 710, 480, 540, 660]
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (29 - i))
    return {
      day: d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
      revenue: seed[i],
      cash: Math.round(seed[i] * 0.6),
    }
  })
}

const SAMPLE_PIE_DATA = [
  { name: 'Direct', value: 14400 },
  { name: 'Booking.com', value: 18600 },
  { name: 'Walk-in', value: 6800 },
  { name: 'Hostelworld', value: 7200 },
]
const SAMPLE_METHOD_DATA = [
  { name: 'Espèces', value: 28500 },
  { name: 'Virement', value: 12400 },
  { name: 'CMI', value: 6600 },
]
const SAMPLE_DOW_DATA = [
  { name: 'Dim', réservations: 12 }, { name: 'Lun', réservations: 8 },
  { name: 'Mar', réservations: 7 }, { name: 'Mer', réservations: 9 },
  { name: 'Jeu', réservations: 11 }, { name: 'Ven', réservations: 18 },
  { name: 'Sam', réservations: 22 },
]
const SAMPLE_SOURCES = [
  { key: 'direct', count: 24, gross: 14400, net: 14400, commission_rate: 0 },
  { key: 'booking_com', count: 31, gross: 18600, net: 15810, commission_rate: 15 },
  { key: 'hostelworld', count: 12, gross: 7200, net: 6336, commission_rate: 12 },
  { key: 'walkin', count: 14, gross: 6800, net: 6800, commission_rate: 0 },
]

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportPaymentsCSV(payments: Payment[], from: string, to: string) {
  const header = 'Date,Montant (MAD),Méthode,Type\n'
  const rows = payments
    .map((p) => {
      const methodLabels: Record<string, string> = {
        cash: 'Espèces', virement: 'Virement', cmi: 'CMI', wave: 'Wave', other: 'Autre',
      }
      const typeLabels: Record<string, string> = {
        payment: 'Paiement', deposit: 'Acompte', refund: 'Remboursement',
      }
      return [
        p.payment_date.split('T')[0],
        p.amount.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        methodLabels[p.method] ?? p.method,
        typeLabels[p.type] ?? p.type,
      ].join(',')
    })
    .join('\n')

  const csv = header + rows
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `paiements_${from}_${to}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ReportsClient({
  totalBeds,
  payments: initialPayments,
  bookings: initialBookings,
  propertyId,
}: {
  totalBeds: number
  payments: Payment[]
  bookings: Booking[]
  propertyId: string
}) {
  const t = useT()

  const sourceLabels: Record<string, string> = {
    direct: t('reports.source.direct'),
    booking_com: 'Booking.com',
    hostelworld: 'Hostelworld',
    airbnb: 'Airbnb',
    phone: t('reports.source.phone'),
    walkin: t('reports.source.walkin'),
  }

  const DATE_RANGES = [
    { label: t('reports.range.7d'), value: '7d' as RangeKey },
    { label: t('reports.range.30d'), value: '30d' as RangeKey },
    { label: t('reports.range.month'), value: 'month' as RangeKey },
    { label: t('reports.range.lastMonth'), value: 'last_month' as RangeKey },
    { label: t('reports.range.90d'), value: '90d' as RangeKey },
  ]

  const supabase = createClient()
  const [selectedRange, setSelectedRange] = useState<RangeKey>('30d')
  const [payments, setPayments] = useState<Payment[]>(initialPayments)
  const [bookings, setBookings] = useState<Booking[]>(initialBookings)
  const [loading, setLoading] = useState(false)

  const isEmpty = payments.length === 0 && bookings.length === 0

  // ── Fetch when range changes ──────────────────────────────────────────────

  const fetchRange = useCallback(
    async (range: RangeKey) => {
      const { from, to } = getDateBounds(range)
      setLoading(true)
      try {
        const [pmRes, bkRes] = await Promise.all([
          supabase
            .from('payments')
            .select('amount, method, payment_date, type')
            .eq('property_id', propertyId)
            .eq('status', 'completed')
            .gte('payment_date', `${from}T00:00:00`)
            .lte('payment_date', `${to}T23:59:59`),
          supabase
            .from('bookings')
            .select('id, source, commission_rate, total_price, net_revenue, nights, check_in_date')
            .eq('property_id', propertyId)
            .not('status', 'in', '("cancelled","no_show")')
            .gte('check_in_date', from)
            .lte('check_in_date', to),
        ])
        if (pmRes.data) setPayments(pmRes.data as Payment[])
        if (bkRes.data) setBookings(bkRes.data as Booking[])
      } finally {
        setLoading(false)
      }
    },
    [propertyId, supabase],
  )

  const handleRangeChange = useCallback(
    (range: RangeKey) => {
      setSelectedRange(range)
      fetchRange(range)
    },
    [fetchRange],
  )

  // ── Metrics ───────────────────────────────────────────────────────────────

  const { from, to, days } = getDateBounds(selectedRange)

  const totalRevenue = payments.filter((p) => p.type !== 'refund').reduce((s, p) => s + p.amount, 0)
  const avgLOS = bookings.length
    ? bookings.reduce((s, b) => s + (b.nights ?? 0), 0) / bookings.length
    : 0
  const occupancyRate =
    totalBeds && bookings.length
      ? Math.min(100, Math.round((bookings.length / (totalBeds * days)) * 100))
      : 0
  const revPAR = totalBeds ? totalRevenue / (totalBeds * days) : 0

  // ── Chart data ────────────────────────────────────────────────────────────

  const dailyData = useMemo(() => {
    if (isEmpty) return buildSampleDailyData()
    const { days: numDays } = getDateBounds(selectedRange)
    const count = Math.min(numDays, 90)
    return Array.from({ length: count }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (count - 1 - i))
      const dayStr = d.toISOString().split('T')[0]
      const dayPayments = payments.filter((p) => p.payment_date.startsWith(dayStr))
      return {
        day: d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
        revenue: dayPayments.filter((p) => p.type !== 'refund').reduce((s, p) => s + p.amount, 0),
        cash: dayPayments.filter((p) => p.method === 'cash').reduce((s, p) => s + p.amount, 0),
      }
    })
  }, [isEmpty, payments, selectedRange])

  const sources: Record<string, { count: number; gross: number; net: number; commission_rate: number }> = {}
  bookings.forEach((b) => {
    if (!sources[b.source]) sources[b.source] = { count: 0, gross: 0, net: 0, commission_rate: b.commission_rate }
    sources[b.source].count++
    sources[b.source].gross += b.total_price
    sources[b.source].net += b.net_revenue
  })

  const pieData = isEmpty
    ? SAMPLE_PIE_DATA
    : Object.entries(sources).map(([k, v]) => ({ name: sourceLabels[k] ?? k, value: v.gross }))

  const methodData = isEmpty
    ? SAMPLE_METHOD_DATA
    : ['cash', 'virement', 'cmi', 'wave', 'other']
        .map((m) => ({
          name: ({
            cash: t('payments.cash'),
            virement: t('payments.virement'),
            cmi: t('payments.cmi'),
            wave: t('payments.wave'),
            other: t('payments.other'),
          } as Record<string, string>)[m] ?? m,
          value: payments.filter((p) => p.method === m).reduce((s, p) => s + p.amount, 0),
        }))
        .filter((d) => d.value > 0)

  const dowLabels = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
  const dowCounts = [0, 0, 0, 0, 0, 0, 0]
  const dowTotals = [0, 0, 0, 0, 0, 0, 0]
  bookings.forEach((b) => {
    const dow = new Date(b.check_in_date).getDay()
    dowCounts[dow]++
    dowTotals[dow] += b.total_price
  })
  const dowData = isEmpty
    ? SAMPLE_DOW_DATA
    : dowLabels.map((name, i) => ({ name, réservations: dowCounts[i], revenu: dowTotals[i] }))

  const displayedSources = isEmpty
    ? SAMPLE_SOURCES
    : Object.entries(sources).map(([k, v]) => ({ key: k, ...v }))

  const kpis = isEmpty
    ? [
        { label: t('reports.kpi.occupancy'), value: '72%' },
        { label: t('reports.kpi.revpar'), value: formatCurrency(95) },
        { label: t('reports.kpi.avgLos'), value: `2,8 ${t('common.nights')}` },
        { label: t('reports.kpi.totalRevenue'), value: formatCurrency(47000) },
      ]
    : [
        { label: t('reports.kpi.occupancy'), value: `${occupancyRate}%` },
        { label: t('reports.kpi.revpar'), value: formatCurrency(revPAR) },
        { label: t('reports.kpi.avgLos'), value: `${avgLOS.toFixed(1)} ${t('common.nights')}` },
        { label: t('reports.kpi.totalRevenue'), value: formatCurrency(totalRevenue) },
      ]

  const rangeLabel = DATE_RANGES.find((r) => r.value === selectedRange)?.label ?? ''

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto hp-page-in bg-[#F4F6F8] min-h-full">
      {/* Demo banner */}
      {isEmpty && (
        <div className="flex items-start gap-3 rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3">
          <FlaskConical className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            <span className="font-medium">{t('reports.sampleBanner')}</span> {t('reports.sampleBannerDesc')}
          </p>
        </div>
      )}

      {/* Controls row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {DATE_RANGES.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => handleRangeChange(value)}
              disabled={loading}
              className={cn(
                'px-3 py-1.5 rounded-[10px] text-xs font-medium border transition-colors',
                selectedRange === value
                  ? 'bg-[#0F6E56] text-white border-[#0F6E56]'
                  : 'bg-white text-[#475569] border-[#E8ECF0] hover:bg-[#F8FAFC]',
              )}
            >
              {label}
            </button>
          ))}
          {loading && <Loader2 className="w-4 h-4 animate-spin text-[#94A3B8] self-center" />}
        </div>
        {!isEmpty && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportPaymentsCSV(payments, from, to)}
            className="gap-2 h-8 text-xs bg-white border-[#E8ECF0] rounded-[10px]"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </Button>
        )}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map(({ label, value }) => (
          <div key={label} className={cn('bg-white border border-[#E8ECF0] rounded-[16px] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]', isEmpty && 'opacity-75')}>
            <p className="text-xs text-[#94A3B8]">{label}</p>
            <p className="text-2xl font-semibold mt-1 tabular-nums text-[#0A1F1C]">{value}</p>
            <p className="text-xs text-[#94A3B8] mt-1">{rangeLabel}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Daily revenue */}
        <div className={cn('bg-white border border-[#E8ECF0] rounded-[16px] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)] lg:col-span-2', isEmpty && 'opacity-75')}>
          <p className="text-[15px] font-semibold text-[#0A1F1C] mb-4">
            {t('reports.revenueChart')} — {rangeLabel}
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8ECF0" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} interval={Math.floor(dailyData.length / 8)} />
              <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} width={50} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(v)} />
              <Tooltip
                formatter={(v) => [formatCurrency(Number(v)), t('reports.revenue')]}
                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E8ECF0' }}
              />
              <Bar dataKey="revenue" fill="#0F6E56" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Source donut */}
        <div className={cn('bg-white border border-[#E8ECF0] rounded-[16px] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]', isEmpty && 'opacity-75')}>
          <p className="text-[15px] font-semibold text-[#0A1F1C] mb-4">{t('reports.bookingSources')}</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80}>
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip
                formatter={(v) => [formatCurrency(Number(v)), 'Revenu']}
                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E8ECF0' }}
              />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* DoW + payment method */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className={cn('bg-white border border-[#E8ECF0] rounded-[16px] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]', isEmpty && 'opacity-75')}>
          <p className="text-[15px] font-semibold text-[#0A1F1C] mb-4">{t('reports.bookingsByDay')}</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dowData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8ECF0" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} width={28} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E8ECF0' }} />
              <Bar dataKey="réservations" fill="#5DCAA5" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className={cn('bg-white border border-[#E8ECF0] rounded-[16px] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]', isEmpty && 'opacity-75')}>
          <p className="text-[15px] font-semibold text-[#0A1F1C] mb-4">{t('reports.paymentMethods')}</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={methodData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={75}>
                {methodData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip
                formatter={(v) => [formatCurrency(Number(v)), t('payments.amount')]}
                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E8ECF0' }}
              />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Channel profitability */}
      <div className={cn('bg-white border border-[#E8ECF0] rounded-[16px] overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.04)]', isEmpty && 'opacity-75')}>
        <div className="px-5 py-4 flex items-center justify-between border-b border-[#E8ECF0]">
          <p className="text-[15px] font-semibold text-[#0A1F1C]">{t('reports.channelProfitability')}</p>
          {!isEmpty && (
            <p className="text-xs text-[#94A3B8]">{rangeLabel}</p>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E8ECF0]">
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">{t('reports.col.source')}</th>
                <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">{t('reports.col.bookings')}</th>
                <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">{t('reports.col.gross')}</th>
                <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">{t('reports.col.commission')}</th>
                <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">{t('reports.col.net')}</th>
              </tr>
            </thead>
            <tbody>
              {displayedSources.map((s, i) => (
                <tr key={s.key} className={cn(i < displayedSources.length - 1 && 'border-b border-[#F0F4F7]')}>
                  <td className="px-5 py-3 font-medium text-[#0A1F1C]">{sourceLabels[s.key] ?? s.key}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-[#475569]">{s.count}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-[#475569]">{formatCurrency(s.gross)}</td>
                  <td className="px-5 py-3 text-right text-[#94A3B8]">{s.commission_rate}%</td>
                  <td className="px-5 py-3 text-right text-[#0F6E56] font-semibold tabular-nums">{formatCurrency(s.net)}</td>
                </tr>
              ))}
              {displayedSources.length > 1 && (
                <tr className="border-t-2 border-[#E8ECF0] bg-[#F8FAFC] font-semibold">
                  <td className="px-5 py-3 text-[#0A1F1C]">{t('common.total')}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-[#475569]">
                    {displayedSources.reduce((s, r) => s + r.count, 0)}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-[#475569]">
                    {formatCurrency(displayedSources.reduce((s, r) => s + r.gross, 0))}
                  </td>
                  <td className="px-5 py-3" />
                  <td className="px-5 py-3 text-right text-[#0F6E56] tabular-nums">
                    {formatCurrency(displayedSources.reduce((s, r) => s + r.net, 0))}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
