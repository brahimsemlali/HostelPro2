'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/stores/app.store'
import { useSession, useCanDo } from '@/app/context/SessionContext'
import { useT } from '@/app/context/LanguageContext'
import {
  CommandDialog,
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command'
import {
  LayoutDashboard, Bed, Users, CalendarCheck, CalendarDays,
  DollarSign, BarChart3, MessageSquare, Wrench, Moon,
  Brush, Receipt, Settings, PartyPopper, ShoppingBag,
  UserPlus, User, CalendarRange,
} from 'lucide-react'
import type { StaffRole } from '@/types'

interface GuestHit {
  id: string
  first_name: string
  last_name: string
  phone: string | null
  nationality: string | null
}

interface BookingHit {
  id: string
  status: string
  check_in_date: string
  check_out_date: string
  guest: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null
}

const roleRank: Record<StaffRole, number> = {
  housekeeping: 1, receptionist: 2, manager: 3, owner: 4,
}

function guestOf(b: BookingHit): { first_name: string; last_name: string } | null {
  if (!b.guest) return null
  return Array.isArray(b.guest) ? (b.guest[0] ?? null) : b.guest
}

export function CommandPalette() {
  const router = useRouter()
  const t = useT()
  const session = useSession()
  const canCheckIn = useCanDo('check_in_guests')
  const open = useAppStore((s) => s.commandOpen)
  const setOpen = useAppStore((s) => s.setCommandOpen)

  const [query, setQuery] = useState('')
  const [guests, setGuests] = useState<GuestHit[]>([])
  const [bookings, setBookings] = useState<BookingHit[]>([])

  const role = session?.role ?? 'receptionist'
  const rank = roleRank[role] ?? 1
  const propertyId = session?.propertyId
  const canSearchData = rank >= roleRank.receptionist

  // ── Keyboard shortcut ──
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(!useAppStore.getState().commandOpen)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setOpen])

  // ── Reset on close ──
  useEffect(() => {
    if (!open) return
    return () => {
      setQuery('')
      setGuests([])
      setBookings([])
    }
  }, [open])

  // ── Debounced data search ──
  useEffect(() => {
    if (!open || !canSearchData || !propertyId) return
    const q = query.trim().replace(/[,%()]/g, '')

    const timer = setTimeout(async () => {
      if (q.length < 2) {
        setGuests([])
        setBookings([])
        return
      }
      const supabase = createClient()
      try {
        const [guestRes, bookingRes] = await Promise.all([
          supabase
            .from('guests')
            .select('id, first_name, last_name, phone, nationality')
            .eq('property_id', propertyId)
            .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%,document_number.ilike.%${q}%`)
            .limit(5),
          supabase
            .from('bookings')
            .select('id, status, check_in_date, check_out_date, guest:guest_id!inner(first_name, last_name)')
            .eq('property_id', propertyId)
            .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`, { referencedTable: 'guest' })
            .order('check_in_date', { ascending: false })
            .limit(5),
        ])
        setGuests((guestRes.data as GuestHit[]) ?? [])
        setBookings((bookingRes.data as unknown as BookingHit[]) ?? [])
      } catch {
        setGuests([])
        setBookings([])
      }
    }, q.length < 2 ? 0 : 250)

    return () => clearTimeout(timer)
  }, [query, open, canSearchData, propertyId])

  // ── Navigation entries (mirrors Sidebar role logic) ──
  const navItems = useMemo(() => {
    const all: { href: string; label: string; icon: React.ElementType; minRole: StaffRole }[] = [
      { href: '/dashboard',    label: t('nav.dashboard'),    icon: LayoutDashboard, minRole: 'housekeeping' },
      { href: '/beds',         label: t('nav.beds'),         icon: Bed,             minRole: 'housekeeping' },
      { href: '/calendar',     label: t('nav.calendar'),     icon: CalendarDays,    minRole: 'housekeeping' },
      { href: '/guests',       label: t('nav.guests'),       icon: Users,           minRole: 'receptionist' },
      { href: '/bookings',     label: t('nav.bookings'),     icon: CalendarCheck,   minRole: 'receptionist' },
      { href: '/payments',     label: t('nav.payments'),     icon: DollarSign,      minRole: 'receptionist' },
      { href: '/extras',       label: t('nav.extras'),       icon: ShoppingBag,     minRole: 'receptionist' },
      { href: '/housekeeping', label: t('nav.housekeeping'), icon: Brush,           minRole: 'housekeeping' },
      { href: '/activities',   label: t('nav.activities'),   icon: PartyPopper,     minRole: 'receptionist' },
      { href: '/expenses',     label: t('nav.expenses'),     icon: Receipt,         minRole: 'receptionist' },
      { href: '/reports',      label: t('nav.reports'),      icon: BarChart3,       minRole: 'manager' },
      { href: '/whatsapp',     label: t('nav.whatsapp'),     icon: MessageSquare,   minRole: 'manager' },
      { href: '/maintenance',  label: t('nav.maintenance'),  icon: Wrench,          minRole: 'manager' },
      { href: '/night-audit',  label: t('nav.nightAudit'),   icon: Moon,            minRole: 'manager' },
      { href: '/settings',     label: t('nav.settings'),     icon: Settings,        minRole: 'owner' },
    ]
    const visible = role === 'housekeeping'
      ? all.filter((i) => i.href === '/beds' || i.href === '/housekeeping')
      : all.filter((i) => rank >= roleRank[i.minRole])
    if (canCheckIn) {
      visible.unshift({ href: '/guests/new', label: t('beds.newCheckin'), icon: UserPlus, minRole: 'receptionist' })
    }
    return visible
  }, [t, role, rank, canCheckIn])

  const filteredNav = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return navItems
    return navItems.filter((i) => i.label.toLowerCase().includes(q))
  }, [navItems, query])

  const go = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  if (!session) return null

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title={t('common.search')}
      description={t('palette.placeholder')}
      className="max-w-lg"
    >
      <Command shouldFilter={false}>
        <CommandInput
          placeholder={t('palette.placeholder')}
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>{t('palette.noResults')}</CommandEmpty>

          {guests.length > 0 && (
            <CommandGroup heading={t('guests.title')}>
              {guests.map((g) => (
                <CommandItem key={g.id} value={`guest-${g.id}`} onSelect={() => go(`/guests/${g.id}`)}>
                  <User className="text-[#0F6E56]" />
                  <span className="font-medium">{g.first_name} {g.last_name}</span>
                  <span className="ml-auto text-xs text-muted-foreground truncate">
                    {[g.nationality, g.phone].filter(Boolean).join(' · ')}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {bookings.length > 0 && (
            <CommandGroup heading={t('bookings.title')}>
              {bookings.map((b) => {
                const g = guestOf(b)
                return (
                  <CommandItem key={b.id} value={`booking-${b.id}`} onSelect={() => go(`/bookings/${b.id}`)}>
                    <CalendarRange className="text-blue-500" />
                    <span className="font-medium">{g ? `${g.first_name} ${g.last_name}` : '—'}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {new Date(b.check_in_date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                      {' → '}
                      {new Date(b.check_out_date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                      {' · '}
                      {t(`bookings.status.${b.status}`)}
                    </span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          )}

          {filteredNav.length > 0 && (
            <CommandGroup heading={t('palette.pages')}>
              {filteredNav.map(({ href, label, icon: Icon }) => (
                <CommandItem key={href} value={`nav-${href}`} onSelect={() => go(href)}>
                  <Icon className="text-[#94A3B8]" />
                  {label}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>

        {/* Footer hint */}
        <div className="hidden sm:flex items-center gap-3 border-t border-black/[0.06] px-3 py-2 text-[11px] text-muted-foreground select-none">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-black/[0.08] bg-black/[0.03] px-1 font-sans">↑↓</kbd>
            {t('palette.hint')}
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-black/[0.08] bg-black/[0.03] px-1 font-sans">↵</kbd>
            {t('palette.hintSelect')}
          </span>
        </div>
      </Command>
    </CommandDialog>
  )
}
