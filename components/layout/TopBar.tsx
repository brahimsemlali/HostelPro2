'use client'

import { usePathname } from 'next/navigation'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/stores/app.store'
import { useSession } from '@/app/context/SessionContext'
import { useT } from '@/app/context/LanguageContext'
import { PropertySwitcher } from '@/components/layout/PropertySwitcher'
import type { StaffRole } from '@/types'

const routeKeys: [string, string][] = [
  ['/settings/rooms',        'topbar.title./settings/rooms'],
  ['/settings/staff',        'topbar.title./settings/staff'],
  ['/settings/integrations', 'topbar.title./settings/integrations'],
  ['/settings/pricing',      'topbar.title./settings/pricing'],
  ['/settings/extras',       'topbar.title./settings/extras'],
  ['/settings',              'topbar.title./settings'],
  ['/guests/new',            'topbar.title./guests/new'],
  ['/guests',                'topbar.title./guests'],
  ['/dashboard',             'topbar.title./dashboard'],
  ['/beds',                  'topbar.title./beds'],
  ['/bookings',              'topbar.title./bookings'],
  ['/calendar',              'topbar.title./calendar'],
  ['/payments',              'topbar.title./payments'],
  ['/extras',                'topbar.title./extras'],
  ['/reports',               'topbar.title./reports'],
  ['/whatsapp',              'topbar.title./whatsapp'],
  ['/maintenance',           'topbar.title./maintenance'],
  ['/housekeeping',          'topbar.title./housekeeping'],
  ['/expenses',              'topbar.title./expenses'],
  ['/night-audit',           'topbar.title./night-audit'],
]

const roleGradient: Record<StaffRole, string> = {
  owner:        'linear-gradient(135deg, #0F6E56 0%, #16a37d 100%)',
  manager:      'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)',
  receptionist: 'linear-gradient(135deg, #6d28d9 0%, #8b5cf6 100%)',
  housekeeping: 'linear-gradient(135deg, #b45309 0%, #f59e0b 100%)',
}

function getInitials(name: string): string {
  return name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

function LiveIndicator() {
  const t = useT()
  const connected = useAppStore((s) => s.realtimeConnected)
  if (connected === null) return null
  return (
    <div className="flex items-center gap-1.5 select-none" title={connected ? t('topbar.live') : t('topbar.reconnecting')}>
      <span className="relative flex h-[7px] w-[7px]">
        {connected ? (
          <>
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
            <span className="relative inline-flex rounded-full h-[7px] w-[7px] bg-emerald-500" />
          </>
        ) : (
          <span className="relative inline-flex rounded-full h-[7px] w-[7px] bg-amber-400" />
        )}
      </span>
      <span className={`text-[11px] font-medium hidden sm:block ${connected ? 'text-emerald-700' : 'text-amber-600'}`}>
        {connected ? t('topbar.live') : t('topbar.reconnecting')}
      </span>
    </div>
  )
}

export function TopBar() {
  const pathname = usePathname()
  const session = useSession()
  const t = useT()

  const titleKey = routeKeys.find(([key]) => pathname === key || pathname.startsWith(key + '/'))?.[1]
  const title = titleKey ? t(titleKey) : 'HostelPro'

  const displayName = session?.staffName ?? t(`role.${session?.role ?? 'owner'}`)
  const displayRole = session?.staffName ? t(`role.${session.role}`) : ''
  const initials = getInitials(displayName)
  const gradient = session ? roleGradient[session.role] : roleGradient.owner

  return (
    <header
      className="h-[54px] flex items-center justify-between px-5 sticky top-0 z-20 flex-shrink-0"
      style={{
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(16px) saturate(180%)',
        WebkitBackdropFilter: 'blur(16px) saturate(180%)',
        borderBottom: '1px solid #E8ECF0',
      }}
    >
      <h1 className="text-[15px] font-semibold tracking-tight text-[#0A1F1C] select-none leading-none">
        {title}
      </h1>

      <div className="flex items-center gap-3">
        <PropertySwitcher />
        <LiveIndicator />

        <div className="w-px h-4 bg-black/[0.09] flex-shrink-0" />

        <Button
          variant="ghost"
          size="icon"
          className="relative w-8 h-8 rounded-full hover:bg-black/[0.06] active:bg-black/[0.10]"
          aria-label="Notifications"
        >
          <Bell className="w-[15px] h-[15px] text-[oklch(0.42_0_0)]" />
        </Button>

        <div className="flex items-center gap-2 pl-0.5">
          <div className="hidden sm:flex flex-col items-end leading-none gap-[3px]">
            <span className="text-[13px] font-medium text-foreground leading-none">{displayName}</span>
            <span className="text-[10px] text-[oklch(0.56_0_0)] leading-none">{displayRole}</span>
          </div>

          <div
            className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-[11px] font-bold text-white select-none flex-shrink-0"
            style={{
              background: gradient,
              boxShadow: '0 0 0 2px rgba(255,255,255,0.9), 0 1px 3px rgba(0,0,0,0.12)',
            }}
            title={`${displayName} — ${displayRole}`}
            aria-label={`${displayName}, ${displayRole}`}
          >
            {initials}
          </div>
        </div>
      </div>
    </header>
  )
}
