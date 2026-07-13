'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSession, useCanDo } from '@/app/context/SessionContext'
import { useT } from '@/app/context/LanguageContext'
import { cn, formatTime } from '@/lib/utils'
import {
  Bell,
  BellOff,
  LogIn,
  LogOut,
  DollarSign,
  Activity,
  CalendarPlus,
  CheckCircle2,
  BedDouble,
} from 'lucide-react'

interface NotificationEntry {
  id: string
  action_type: string
  description: string
  staff_name: string | null
  created_at: string
}

const REVENUE_ACTIONS = ['payment', 'booking_created']

const NOTIF_ICONS: Record<string, { Icon: React.ElementType; bg: string; color: string }> = {
  check_in:             { Icon: LogIn,        bg: 'bg-[#0F6E56]/10', color: 'text-[#0F6E56]' },
  check_out:            { Icon: LogOut,       bg: 'bg-gray-100',     color: 'text-gray-500' },
  payment:              { Icon: DollarSign,   bg: 'bg-blue-50',      color: 'text-blue-600' },
  maintenance_open:     { Icon: Activity,     bg: 'bg-amber-50',     color: 'text-amber-600' },
  maintenance_resolved: { Icon: CheckCircle2, bg: 'bg-[#0F6E56]/10', color: 'text-[#0F6E56]' },
  booking_created:      { Icon: CalendarPlus, bg: 'bg-blue-50',      color: 'text-blue-600' },
  booking_cancelled:    { Icon: Activity,     bg: 'bg-red-50',       color: 'text-red-500' },
  bed_status:           { Icon: BedDouble,    bg: 'bg-gray-100',     color: 'text-gray-500' },
  pre_checkin:          { Icon: CheckCircle2, bg: 'bg-[#0F6E56]/10', color: 'text-[#0F6E56]' },
  default:              { Icon: Activity,     bg: 'bg-gray-100',     color: 'text-gray-500' },
}

function notifTime(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return formatTime(d)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

export function NotificationBell() {
  const session = useSession()
  const canViewRevenue = useCanDo('view_revenue')
  const t = useT()
  const propertyId = session?.propertyId
  const seenKey = `hp-notif-seen-${propertyId}`

  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationEntry[]>([])
  // null = first visit ever (history is not flagged as unread)
  const [lastSeen, setLastSeen] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : localStorage.getItem(seenKey),
  )

  // Initial fetch + realtime inserts
  useEffect(() => {
    if (!propertyId) return
    // First visit: stamp now so history never counts as unread later
    if (!localStorage.getItem(seenKey)) {
      localStorage.setItem(seenKey, new Date().toISOString())
    }

    const supabase = createClient()
    let cancelled = false

    supabase
      .from('activity_log')
      .select('id, action_type, description, staff_name, created_at')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false })
      .limit(15)
      .then(({ data }) => {
        if (!cancelled && data) setItems(data as NotificationEntry[])
      })

    const channel = supabase
      .channel(`notif-bell-${propertyId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_log', filter: `property_id=eq.${propertyId}` },
        (payload) => {
          const entry = payload.new as NotificationEntry
          setItems((prev) => [entry, ...prev].slice(0, 15))
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [propertyId, seenKey])

  const visible = items.filter(
    (n) => canViewRevenue || !REVENUE_ACTIONS.includes(n.action_type),
  )
  const unread = lastSeen
    ? visible.filter((n) => n.created_at > lastSeen).length
    : 0

  const markSeen = useCallback(() => {
    const now = new Date().toISOString()
    localStorage.setItem(seenKey, now)
    setLastSeen(now)
  }, [seenKey])

  const toggle = () => {
    setOpen((v) => {
      if (!v) markSeen()
      return !v
    })
  }

  if (!session) return null

  return (
    <div className="relative">
      <button
        onClick={toggle}
        className="relative w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/[0.06] active:bg-black/[0.10] transition-colors"
        aria-label={t('notifications.title')}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Bell className="w-[15px] h-[15px] text-[oklch(0.42_0_0)]" />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[15px] h-[15px] flex items-center justify-center px-0.5 leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />

          {/* Panel */}
          <div
            className="absolute right-0 top-full mt-1.5 z-40 w-[320px] rounded-xl bg-white border border-black/[0.08] shadow-lg overflow-hidden"
            role="menu"
          >
            <div className="px-4 py-2.5 border-b border-black/[0.06]">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {t('notifications.title')}
              </p>
            </div>

            {visible.length === 0 ? (
              <div className="px-4 py-8 text-center space-y-2">
                <BellOff className="w-6 h-6 mx-auto text-muted-foreground/40" />
                <p className="text-[13px] font-medium text-[#0A1F1C]">{t('notifications.empty')}</p>
                <p className="text-[11px] text-muted-foreground">{t('notifications.emptyDesc')}</p>
              </div>
            ) : (
              <div className="max-h-[360px] overflow-y-auto">
                {visible.slice(0, 10).map((n) => {
                  const { Icon, bg, color } = NOTIF_ICONS[n.action_type] || NOTIF_ICONS.default
                  return (
                    <div
                      key={n.id}
                      className="flex gap-3 px-4 py-3 border-b border-[#F0F4F7] last:border-0 hover:bg-[#F8FAFC] transition-colors"
                    >
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', bg)}>
                        <Icon className={cn('w-4 h-4', color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <p className="text-[10px] font-semibold text-[#94A3B8] leading-none truncate">
                            {n.staff_name || t('dashboard.system')}
                          </p>
                          <p className="text-[10px] text-[#94A3B8] leading-none flex-shrink-0">
                            {notifTime(n.created_at)}
                          </p>
                        </div>
                        <p className="text-[13px] font-medium text-[#0A1F1C] leading-snug line-clamp-2">
                          {n.description}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
