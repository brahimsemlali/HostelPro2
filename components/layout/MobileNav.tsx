'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAppStore } from '@/stores/app.store'
import { useT } from '@/app/context/LanguageContext'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  BedDouble,
  Plus,
  DollarSign,
  Menu,
  Users,
  CalendarCheck,
  CalendarDays,
  BarChart3,
  MessageSquare,
  Wrench,
  Moon,
  Settings,
  X,
  Brush,
  Receipt,
  PartyPopper,
} from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

function MoreDrawer({ open, onClose, pathname }: { open: boolean; onClose: () => void; pathname: string }) {
  const t = useT()

  const moreItems = [
    { href: '/guests',       label: t('nav.guests'),       icon: Users },
    { href: '/bookings',     label: t('nav.bookings'),     icon: CalendarCheck },
    { href: '/calendar',     label: t('nav.calendar'),     icon: CalendarDays },
    { href: '/housekeeping', label: t('nav.housekeeping'), icon: Brush },
    { href: '/expenses',     label: t('nav.expenses'),     icon: Receipt },
    { href: '/activities',   label: t('nav.activities'),   icon: PartyPopper },
    { href: '/reports',      label: t('nav.reports'),      icon: BarChart3 },
    { href: '/whatsapp',     label: t('nav.whatsapp'),     icon: MessageSquare },
    { href: '/maintenance',  label: t('nav.maintenance'),  icon: Wrench },
    { href: '/night-audit',  label: t('nav.nightAudit'),   icon: Moon },
    { href: '/settings',     label: t('nav.settings'),     icon: Settings },
  ]

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="rounded-t-[28px] px-4 pb-8 pt-0 bg-white"
        style={{ border: 'none', boxShadow: '0 -8px 40px rgba(0,0,0,0.08)' }}
      >
        <div className="flex justify-center pt-3 pb-5">
          <div className="w-9 h-[4px] rounded-full bg-black/[0.10]" />
        </div>

        <SheetHeader className="flex flex-row items-center justify-between mb-5 px-1">
          <SheetTitle className="text-[16px] font-semibold tracking-tight">Navigation</SheetTitle>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-black/[0.07] text-[oklch(0.42_0_0)] hover:bg-black/[0.12] transition-colors active:scale-95"
            aria-label={t('common.close')}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </SheetHeader>

        <div className="grid grid-cols-4 gap-2.5">
          {moreItems.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={cn(
                  'flex flex-col items-center gap-2 py-3.5 rounded-2xl transition-all duration-200 active:scale-95',
                  active
                    ? 'bg-[#0F6E56]/[0.09] text-[#0F6E56]'
                    : 'bg-black/[0.035] text-[oklch(0.42_0_0)] hover:bg-black/[0.06]',
                )}
              >
                <Icon className="w-[19px] h-[19px]" />
                <span className="text-[10px] font-medium text-center leading-tight">{label}</span>
              </Link>
            )
          })}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Tab({
  href,
  label,
  icon: Icon,
  active,
  badge,
}: {
  href: string
  label: string
  icon: React.ElementType
  active: boolean
  badge?: number
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-[3px] min-w-[52px] py-2 relative active:opacity-70 transition-opacity"
      aria-label={label}
    >
      <div className="relative">
        {active && (
          <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-4 h-[2px] rounded-full bg-[#0F6E56]" />
        )}
        <div
          className={cn(
            'w-9 h-8 rounded-[10px] flex items-center justify-center transition-all duration-200',
            active ? 'bg-[#0F6E56]/[0.10]' : 'bg-transparent',
          )}
        >
          <Icon
            className={cn(
              'w-[19px] h-[19px] transition-colors',
              active ? 'text-[#0F6E56]' : 'text-[oklch(0.52_0_0)]',
            )}
          />
        </div>
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-1 -right-1.5 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[15px] h-[15px] flex items-center justify-center px-0.5 leading-none">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </div>
      <span
        className={cn(
          'text-[10px] font-medium transition-colors leading-none',
          active ? 'text-[#0F6E56] font-semibold' : 'text-[oklch(0.55_0_0)]',
        )}
      >
        {label}
      </span>
    </Link>
  )
}

export function MobileNav() {
  const pathname = usePathname()
  const t = useT()
  const [moreOpen, setMoreOpen] = useState(false)
  const dirtyBedsCount = useAppStore((s) => s.dirtyBedsCount)
  const showHousekeeping = dirtyBedsCount > 0

  const moreItemHrefs = [
    '/guests', '/bookings', '/calendar', '/housekeeping',
    '/expenses', '/activities', '/reports', '/whatsapp',
    '/maintenance', '/night-audit', '/settings',
  ]
  const moreActive = moreItemHrefs
    .filter((h) => h !== '/housekeeping')
    .some((h) => pathname.startsWith(h))

  return (
    <>
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 safe-area-bottom"
        style={{
          background: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderTop: '1px solid #E8ECF0',
        }}
      >
        <div className="flex items-end justify-around px-1 h-[62px]">
          <Tab href="/dashboard" label={t('nav.dashboard')} icon={LayoutDashboard} active={pathname === '/dashboard'} />
          <Tab href="/beds"     label={t('nav.beds')}       icon={BedDouble}       active={pathname.startsWith('/beds')} />

          {/* FAB — Check-in */}
          <Link
            href="/guests/new"
            className="flex flex-col items-center gap-[3px] relative -top-[20px] active:scale-95 transition-transform duration-150"
            aria-label={t('checkin.title')}
          >
            <div
              className="w-[54px] h-[54px] rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #0F6E56 0%, #16a37d 100%)',
                boxShadow: '0 4px 18px rgba(15,110,86,0.42), 0 2px 6px rgba(15,110,86,0.22)',
              }}
            >
              <Plus className="w-[22px] h-[22px] text-white" strokeWidth={2.5} />
            </div>
            <span className="text-[10px] font-medium text-[oklch(0.55_0_0)] leading-none">Check-in</span>
          </Link>

          <Tab href="/payments" label={t('nav.payments')} icon={DollarSign} active={pathname.startsWith('/payments')} />

          {showHousekeeping ? (
            <Tab
              href="/housekeeping"
              label={t('nav.housekeeping')}
              icon={Brush}
              active={pathname.startsWith('/housekeeping')}
              badge={dirtyBedsCount}
            />
          ) : (
            <button
              onClick={() => setMoreOpen(true)}
              className="flex flex-col items-center gap-[3px] min-w-[52px] py-2 active:opacity-70 transition-opacity"
              aria-label={t('nav.moreItems')}
            >
              <div
                className={cn(
                  'w-9 h-8 rounded-[10px] flex items-center justify-center transition-all duration-200',
                  moreActive || moreOpen ? 'bg-[#0F6E56]/[0.10]' : 'bg-transparent',
                )}
              >
                <Menu
                  className={cn(
                    'w-[19px] h-[19px]',
                    moreActive || moreOpen ? 'text-[#0F6E56]' : 'text-[oklch(0.52_0_0)]',
                  )}
                />
              </div>
              <span
                className={cn(
                  'text-[10px] font-medium leading-none',
                  moreActive || moreOpen ? 'text-[#0F6E56] font-semibold' : 'text-[oklch(0.55_0_0)]',
                )}
              >
                {t('nav.moreItems')}
              </span>
            </button>
          )}
        </div>
      </nav>

      <MoreDrawer open={moreOpen} onClose={() => setMoreOpen(false)} pathname={pathname} />
    </>
  )
}
