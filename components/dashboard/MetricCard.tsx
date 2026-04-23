import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface MetricCardProps {
  title: string
  value: string
  subtitle?: string
  icon: LucideIcon
  iconColor?: string
  iconBg?: string
  trend?: string
  trendUp?: boolean
  alert?: boolean
  animate?: boolean
  accentColor?: string
  progress?: number   // 0–100, shows a progress bar if set
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = '#0F6E56',
  iconBg,
  trend,
  trendUp,
  alert,
  animate,
  accentColor = '#0F6E56',
  progress,
}: MetricCardProps) {
  const resolvedIconBg = iconBg ?? (alert
    ? 'rgba(239,68,68,0.10)'
    : `color-mix(in srgb, ${accentColor} 12%, transparent)`)
  const resolvedIconColor = alert ? '#dc2626' : iconColor
  const resolvedAccent = alert ? '#ef4444' : accentColor

  return (
    <div
      className={cn(
        'group relative bg-white rounded-[16px] overflow-hidden cursor-default',
        'transition-all duration-300 ease-out',
        'hp-fade-up hp-stagger',
        animate && 'hp-fade-up',
      )}
      style={{
        border: alert ? '1px solid rgba(239,68,68,0.25)' : '1px solid #E8ECF0',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)'
        e.currentTarget.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      <div className="p-5">
        {/* Row: icon + trend */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110"
            style={{ background: resolvedIconBg }}
          >
            <Icon className="w-[18px] h-[18px]" style={{ color: resolvedIconColor }} />
          </div>

          {trend && (
            <div className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold',
              trendUp
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-red-50 text-red-600',
            )}>
              {trendUp
                ? <TrendingUp className="w-3 h-3" />
                : <TrendingDown className="w-3 h-3" />
              }
              {trend}
            </div>
          )}
        </div>

        {/* Dominant value */}
        <p
          className={cn(
            'text-[28px] font-black leading-none tracking-tight tabular-nums',
            alert ? 'text-red-600' : 'text-[#0A1F1C]',
          )}
        >
          {value}
        </p>

        {/* Title label */}
        <p className="text-[12px] font-medium text-[#94A3B8] uppercase tracking-wide mt-1.5">
          {title}
        </p>

        {/* Subtitle */}
        {subtitle && (
          <p className="text-xs text-[#475569] mt-1.5 leading-snug">
            {subtitle}
          </p>
        )}

        {/* Progress bar */}
        {progress !== undefined && (
          <div className="mt-3.5">
            <div className="h-1.5 bg-[#E8ECF0] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${Math.min(100, Math.max(0, progress))}%`,
                  background: alert
                    ? 'linear-gradient(90deg, #ef4444, #f87171)'
                    : `linear-gradient(90deg, ${accentColor}, #16a37d)`,
                }}
              />
            </div>
            <p className="text-[10px] font-medium text-[#94A3B8] mt-1 tabular-nums">
              {progress}% d&apos;occupation
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
