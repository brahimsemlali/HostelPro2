'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { logoutAction } from '@/app/actions/auth'
import { useSession } from '@/app/context/SessionContext'
import { useT } from '@/app/context/LanguageContext'
import { toast } from 'sonner'
import {
  LayoutDashboard, Bed, Users, CalendarCheck, CalendarDays,
  DollarSign, BarChart3, MessageSquare, Wrench, Moon,
  Brush, Receipt, Settings, LogOut, PartyPopper, ShoppingBag,
} from 'lucide-react'
import type { StaffRole } from '@/types'
import { AppLogo } from '@/components/shared/AppLogo'

type NavItem = { href: string; label: string; icon: React.ElementType }

const roleRank: Record<StaffRole, number> = {
  housekeeping: 1, receptionist: 2, manager: 3, owner: 4,
}

function NavItem({ href, label, icon: Icon, active }: NavItem & { active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        'group relative flex items-center gap-2.5 px-3 py-[7px] rounded-[8px]',
        'text-[13px] font-medium transition-all duration-200 select-none',
        active
          ? 'bg-[rgba(15,110,86,0.07)] text-[#0F6E56] font-semibold'
          : 'text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F2E28]',
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] rounded-full bg-[#0F6E56]" />
      )}
      <Icon className={cn(
        'w-[15px] h-[15px] flex-shrink-0 transition-colors',
        active ? 'text-[#0F6E56]' : 'text-[#94A3B8] group-hover:text-[#475569]',
      )} />
      <span className="truncate flex-1 leading-none">{label}</span>
    </Link>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const session = useSession()
  const t = useT()
  const role = session?.role ?? 'receptionist'
  const rank = roleRank[role] ?? 1

  async function handleSignOut() {
    await logoutAction()
    window.location.href = '/login'
    toast.success(t('common.logout'))
  }

  const allNavGroups: { labelKey: string; minRole: StaffRole; items: NavItem[] }[] = [
    {
      labelKey: 'nav.group.main',
      minRole: 'housekeeping',
      items: [
        { href: '/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
        { href: '/beds',      label: t('nav.beds'),      icon: Bed },
        { href: '/calendar',  label: t('nav.calendar'),  icon: CalendarDays },
      ],
    },
    {
      labelKey: 'nav.group.operations',
      minRole: 'receptionist',
      items: [
        { href: '/guests',       label: t('nav.guests'),       icon: Users },
        { href: '/bookings',     label: t('nav.bookings'),     icon: CalendarCheck },
        { href: '/payments',     label: t('nav.payments'),     icon: DollarSign },
        { href: '/extras',       label: t('nav.extras'),       icon: ShoppingBag },
        { href: '/housekeeping', label: t('nav.housekeeping'), icon: Brush },
        { href: '/activities',   label: t('nav.activities'),   icon: PartyPopper },
        { href: '/expenses',     label: t('nav.expenses'),     icon: Receipt },
      ],
    },
    {
      labelKey: 'nav.group.analysis',
      minRole: 'manager',
      items: [
        { href: '/reports',     label: t('nav.reports'),     icon: BarChart3 },
        { href: '/whatsapp',    label: t('nav.whatsapp'),    icon: MessageSquare },
        { href: '/maintenance', label: t('nav.maintenance'), icon: Wrench },
        { href: '/night-audit', label: t('nav.nightAudit'),  icon: Moon },
      ],
    },
  ]

  const visibleGroups = allNavGroups.filter(g => rank >= roleRank[g.minRole])

  const filteredGroups = role === 'housekeeping'
    ? [{ labelKey: 'nav.group.main', minRole: 'housekeeping' as StaffRole, items: [
        { href: '/beds',        label: t('nav.beds'),        icon: Bed },
        { href: '/housekeeping', label: t('nav.housekeeping'), icon: Brush },
      ]}]
    : visibleGroups

  return (
    <aside
      className="hidden md:flex flex-col w-[224px] h-screen sticky top-0 flex-shrink-0 overflow-hidden"
      style={{
        background: '#FFFFFF',
        borderRight: '1px solid #E8ECF0',
      }}
    >
      {/* ── Logo ── */}
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
        <AppLogo size={34} className="rounded-[9px]" />
        <div>
          <span className="font-semibold text-[14px] text-[#0A1F1C] tracking-tight leading-none">HostelPro</span>
          <p className="text-[10px] text-[#94A3B8] leading-none mt-1">{t('nav.hotelManagement')}</p>
        </div>
      </div>

      {/* Staff identity badge */}
      {!session?.isOwner && session?.staffName && (
        <div className="mx-3 mb-3 px-3 py-2.5 rounded-xl border border-[#E8ECF0] bg-[#F8FAFC]">
          <p className="text-[9px] font-bold text-[#94A3B8] uppercase tracking-widest mb-0.5">
            {t(`role.${role}` )}
          </p>
          <p className="text-[13px] font-medium text-[#0A1F1C] truncate leading-snug">{session.staffName}</p>
        </div>
      )}

      {/* Divider */}
      <div className="mx-4 h-px bg-[#E8ECF0] mb-3" />

      {/* ── Nav ── */}
      <nav className="flex-1 px-3 overflow-y-auto">
        <div className="space-y-4 py-1">
          {filteredGroups.map((group) => (
            <div key={group.labelKey}>
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">
                {t(group.labelKey)}
              </p>
              <div className="space-y-px">
                {group.items.map(({ href, label, icon }) => {
                  const active = href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)
                  return <NavItem key={href} href={href} label={label} icon={icon} active={active} />
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>

      {/* ── Bottom ── */}
      <div className="px-3 pt-3 pb-5 border-t border-[#E8ECF0] space-y-px">
        {rank >= roleRank['owner'] && (
          <Link
            href="/settings"
            className={cn(
              'group flex items-center gap-2.5 px-3 py-[7px] rounded-[8px] text-[13px] font-medium transition-all duration-200',
              pathname.startsWith('/settings')
                ? 'bg-[rgba(15,110,86,0.07)] text-[#0F6E56] font-semibold'
                : 'text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F2E28]',
            )}
          >
            <Settings className={cn(
              'w-[15px] h-[15px] flex-shrink-0 transition-colors',
              pathname.startsWith('/settings') ? 'text-[#0F6E56]' : 'text-[#94A3B8] group-hover:text-[#475569]',
            )} />
            <span className="flex-1 leading-none">{t('nav.settings')}</span>
          </Link>
        )}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2.5 px-3 py-[7px] rounded-[8px] text-[13px] font-medium text-[#94A3B8] hover:bg-red-50 hover:text-red-500 transition-all duration-200"
        >
          <LogOut className="w-[15px] h-[15px] flex-shrink-0" />
          <span className="leading-none">{t('nav.logout')}</span>
        </button>
      </div>
    </aside>
  )
}
