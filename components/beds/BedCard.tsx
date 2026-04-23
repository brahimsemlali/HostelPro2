'use client'

import { cn } from '@/lib/utils'
import type { Bed, Room, Booking, Guest } from '@/types'
import { Wrench, Wind, Ban, Bed as BedIcon } from 'lucide-react'

interface BedWithDetails extends Bed {
  room?: Room
  booking?: (Booking & { guest?: Guest }) | null
}

const statusConfig = {
  available: {
    border: 'border border-dashed border-[oklch(0.84_0_0)]',
    bg: 'bg-white hover:bg-[oklch(0.975_0_0)]',
    accentColor: '#e5e7eb',
    icon: BedIcon,
    iconColor: 'text-[oklch(0.70_0_0)]',
    label: 'Disponible',
    labelColor: 'text-[oklch(0.60_0_0)]',
  },
  occupied: {
    border: 'border border-[#0F6E56]/20',
    bg: 'bg-[#0F6E56]/[0.04] hover:bg-[#0F6E56]/[0.07]',
    accentColor: '#0F6E56',
    icon: BedIcon,
    iconColor: 'text-[#0F6E56]',
    label: 'Occupé',
    labelColor: 'text-[#0F6E56]',
  },
  dirty: {
    border: 'border border-amber-200',
    bg: 'bg-amber-50/80 hover:bg-amber-100/60',
    accentColor: '#f59e0b',
    icon: Wind,
    iconColor: 'text-amber-500',
    label: 'À nettoyer',
    labelColor: 'text-amber-700',
  },
  maintenance: {
    border: 'border border-red-200',
    bg: 'bg-red-50/70 hover:bg-red-100/60',
    accentColor: '#ef4444',
    icon: Wrench,
    iconColor: 'text-red-500',
    label: 'Maintenance',
    labelColor: 'text-red-600',
  },
  blocked: {
    border: 'border border-[oklch(0.86_0_0)]',
    bg: 'bg-[oklch(0.95_0_0)] hover:bg-[oklch(0.93_0_0)]',
    accentColor: '#9ca3af',
    icon: Ban,
    iconColor: 'text-[oklch(0.62_0_0)]',
    label: 'Bloqué',
    labelColor: 'text-[oklch(0.55_0_0)]',
  },
}

interface BedCardProps {
  bed: BedWithDetails
  onClick: (bed: BedWithDetails) => void
  swapMode?: boolean
  isSwapSource?: boolean
}

export function BedCard({ bed, onClick, swapMode, isSwapSource }: BedCardProps) {
  const config = statusConfig[bed.status as keyof typeof statusConfig] ?? statusConfig.available
  const guest = bed.booking?.guest
  const checkOut = bed.booking?.check_out_date
  const StatusIcon = config.icon

  const isSwapTarget = swapMode && !isSwapSource && bed.status === 'occupied'

  return (
    <button
      onClick={() => onClick(bed)}
      className={cn(
        'relative rounded-[14px] text-left w-full overflow-hidden select-none',
        'transition-all duration-200 cursor-pointer group',
        'active:scale-[0.96]',
        isSwapSource ? 'ring-2 ring-[#0F6E56] ring-offset-2 opacity-60' : '',
        isSwapTarget ? 'ring-2 ring-[#0F6E56] ring-offset-2 animate-pulse' : '',
        swapMode && !isSwapSource && bed.status !== 'occupied' ? 'opacity-30 pointer-events-none' : '',
        config.bg,
        config.border,
      )}
      style={{
        minHeight: '88px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}
      aria-label={`Lit ${bed.name}${guest ? `, occupé par ${guest.first_name}` : `, ${config.label}`}`}
    >
      {/* Status accent top bar */}
      <div
        className="absolute top-0 left-0 right-0 h-[2.5px] transition-opacity duration-200"
        style={{ background: config.accentColor, opacity: bed.status === 'available' ? 0.3 : 0.7 }}
      />

      <div className="px-3 pt-4 pb-3">
        {/* Bed name + status icon row */}
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-[13px] text-foreground tracking-tight leading-none">
            {bed.name}
          </span>
          <StatusIcon className={cn('w-3.5 h-3.5 flex-shrink-0 opacity-80', config.iconColor)} />
        </div>

        {/* Guest info or status label */}
        {bed.status === 'occupied' && guest ? (
          <div>
            <p className="text-[13px] font-semibold text-[#0F6E56] truncate leading-snug">
              {guest.first_name ?? '—'}
              {guest.last_name?.[0] ? ` ${guest.last_name[0]}.` : ''}
            </p>
            {checkOut && (
              <p className="text-[11px] text-[oklch(0.56_0_0)] mt-0.5 leading-none tabular-nums">
                ↩{' '}
                {new Date(checkOut).toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: '2-digit',
                })}
              </p>
            )}
          </div>
        ) : (
          <p className={cn('text-[11px] font-medium leading-none', config.labelColor)}>
            {config.label}
          </p>
        )}

        {/* Bunk position pill */}
        {bed.bunk_position && (
          <span className="inline-flex items-center mt-2 px-1.5 py-0.5 rounded-md bg-black/[0.05] text-[10px] font-medium text-[oklch(0.48_0_0)] leading-none">
            {bed.bunk_position === 'top' ? '▲ Haut' : '▼ Bas'}
          </span>
        )}
      </div>
    </button>
  )
}
