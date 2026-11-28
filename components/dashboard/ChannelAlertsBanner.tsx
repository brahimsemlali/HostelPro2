'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { AlertTriangle, BedDouble, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useT } from '@/app/context/LanguageContext'
import { useHasRole } from '@/app/context/SessionContext'

export type ChannelAlert = { id: number; kind: string; message: string; booking_id: string | null }

interface Props {
  alerts: ChannelAlert[]
  /** Active bookings with no bed yet, soonest first (id + arrival date). */
  unassigned: { id: string; check_in_date: string }[]
}

/**
 * Online-sales problems the owner must act on: overbookings recorded from a
 * channel (never refused), unmapped room types, sync errors, and bookings
 * that still need a bed. Server data, rendered above the dashboard.
 */
export function ChannelAlertsBanner({ alerts, unassigned }: Props) {
  const t = useT()
  const canResolve = useHasRole('manager')
  const [resolved, setResolved] = useState<Set<number>>(new Set())
  const open = alerts.filter((a) => !resolved.has(a.id))

  async function resolve(id: number) {
    try {
      const { error } = await createClient().from('channel_alerts')
        .update({ resolved_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
      setResolved((s) => new Set(s).add(id))
    } catch {
      toast.error(t('common.error'))
    }
  }

  if (open.length === 0 && unassigned.length === 0) return null
  return (
    <div className="px-6 pt-6 max-w-7xl mx-auto space-y-2">
      {open.slice(0, 5).map((a) => (
        <div key={a.id} className="flex items-start gap-3 rounded-[14px] border border-red-200 bg-red-50 px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <p className="text-sm text-red-900 flex-1">{a.message}</p>
          {a.booking_id && (
            <Link href={`/bookings/${a.booking_id}`} className="text-sm font-medium text-red-700 underline shrink-0">
              {t('channelAlerts.open')}
            </Link>
          )}
          {canResolve && (
            <button
              type="button"
              onClick={() => resolve(a.id)}
              aria-label={t('channelAlerts.resolve')}
              title={t('channelAlerts.resolve')}
              className="text-red-700 hover:text-red-900 shrink-0 -m-2 p-2 rounded-lg"
            >
              <Check className="w-4 h-4" />
            </button>
          )}
        </div>
      ))}
      {unassigned.length > 0 && (
        <div className="flex items-start gap-3 rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3">
          <BedDouble className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-900 flex-1">
            {unassigned.length === 1 ? t('channelAlerts.unassignedOne') : `${unassigned.length} ${t('channelAlerts.unassignedMany')}`}
          </p>
          <Link href={`/bookings/${unassigned[0].id}`} className="text-sm font-medium text-amber-800 underline shrink-0">
            {t('channelAlerts.placeNext')}
          </Link>
        </div>
      )}
    </div>
  )
}
