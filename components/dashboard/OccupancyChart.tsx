'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'
import { useT } from '@/app/context/LanguageContext'

interface DayRevenue {
  day: string
  revenue: number
  cash: number
  virement: number
  cmi: number
}

interface TooltipPayload {
  value: number
  name: string
  dataKey: string
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  const total = payload[0]?.value ?? 0
  return (
    <div
      className="text-[12px] min-w-[120px]"
      style={{
        background: 'rgba(255,255,255,0.97)',
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: '10px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
        padding: '8px 12px',
      }}
    >
      <p className="font-semibold text-foreground mb-1">{label}</p>
      <p className="text-[#0F6E56] font-semibold">{formatCurrency(total)}</p>
    </div>
  )
}

export function OccupancyChart({ data }: { data: DayRevenue[] }) {
  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1)
  const t = useT()

  return (
    <div
      className="bg-white rounded-[16px] p-5"
      style={{ border: '1px solid #E8ECF0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
    >
      <p className="text-[13px] font-semibold text-[#0A1F1C] mb-4">{t('dashboard.revenueChart')}</p>
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barCategoryGap="38%">
        <defs>
          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0F6E56" stopOpacity={0.95} />
            <stop offset="100%" stopColor="#16a37d" stopOpacity={0.65} />
          </linearGradient>
          <linearGradient id="barGradActive" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0a4f3c" stopOpacity={1} />
            <stop offset="100%" stopColor="#0F6E56" stopOpacity={0.85} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="rgba(0,0,0,0.05)" />
        <XAxis
          dataKey="day"
          tick={{ fontSize: 11, fill: 'oklch(0.56 0 0)', fontWeight: 500 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'oklch(0.56 0 0)' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${Math.round(v / 1000)}k`}
          width={36}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.035)', radius: 6 }} />
        <Bar dataKey="revenue" radius={[6, 6, 3, 3]}>
          {data.map((entry, i) => {
            const isMax = entry.revenue === maxRevenue && entry.revenue > 0
            return (
              <Cell
                key={`cell-${i}`}
                fill={isMax ? 'url(#barGradActive)' : 'url(#barGrad)'}
              />
            )
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
    </div>
  )
}
