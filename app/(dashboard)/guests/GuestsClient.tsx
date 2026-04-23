'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDateShort } from '@/lib/utils'
import { buildWhatsAppLink } from '@/lib/whatsapp/templates'
import {
  Search, Plus, Users, Star, X, Flag, MessageSquare,
  TrendingUp, ArrowUpDown, ShieldAlert,
} from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useT } from '@/app/context/LanguageContext'

// ── Types ────────────────────────────────────────────────────────────────────

interface Guest {
  id: string
  first_name: string
  last_name: string
  nationality: string | null
  document_number: string | null
  phone: string | null
  whatsapp: string | null
  total_stays: number
  total_spent: number
  is_flagged: boolean
  created_at: string
}

interface Props {
  guests: Guest[]
  checkedInGuestIds: string[]
  page: number
  totalPages: number
  totalCount: number
}

// ── Nationality flags ─────────────────────────────────────────────────────────

const NAT_FLAG: Record<string, string> = {
  'Marocaine': '🇲🇦', 'Marocain': '🇲🇦',
  'Française': '🇫🇷', 'Français': '🇫🇷',
  'Espagnole': '🇪🇸', 'Espagnol': '🇪🇸',
  'Allemande': '🇩🇪', 'Allemand': '🇩🇪',
  'Italienne': '🇮🇹', 'Italien': '🇮🇹',
  'Portugaise': '🇵🇹', 'Portugais': '🇵🇹',
  'Britannique': '🇬🇧', 'Anglais': '🇬🇧',
  'Américaine': '🇺🇸', 'Américain': '🇺🇸',
  'Belge': '🇧🇪',
  'Néerlandaise': '🇳🇱', 'Néerlandais': '🇳🇱',
  'Suisse': '🇨🇭',
  'Canadienne': '🇨🇦', 'Canadien': '🇨🇦',
  'Algérienne': '🇩🇿', 'Algérien': '🇩🇿',
  'Tunisienne': '🇹🇳', 'Tunisien': '🇹🇳',
  'Égyptienne': '🇪🇬', 'Égyptien': '🇪🇬',
  'Brésilienne': '🇧🇷', 'Brésilien': '🇧🇷',
  'Japonaise': '🇯🇵', 'Japonais': '🇯🇵',
  'Australienne': '🇦🇺', 'Australien': '🇦🇺',
}

function natFlag(n: string | null) { return n ? (NAT_FLAG[n] ?? '🌍') : '🌍' }

// ── Sort options ──────────────────────────────────────────────────────────────

type SortKey = 'recent' | 'stays' | 'spent' | 'alpha'

// ── Status filter ─────────────────────────────────────────────────────────────

type StatusFilter = 'all' | 'staying' | 'loyal' | 'flagged'

// ── Component ────────────────────────────────────────────────────────────────

export function GuestsClient({ guests, checkedInGuestIds, page, totalPages, totalCount }: Props) {
  const router = useRouter()
  const t = useT()
  const checkedInSet = useMemo(() => new Set(checkedInGuestIds), [checkedInGuestIds])

  const SORT_LABELS: Record<SortKey, string> = {
    recent: t('guests.sortRecent'),
    stays:  t('guests.sortStays'),
    spent:  t('guests.sortSpent'),
    alpha:  'A → Z',
  }

  const [query, setQuery]             = useState('')
  const [statusFilter, setStatus]     = useState<StatusFilter>('all')
  const [sort, setSort]               = useState<SortKey>('recent')
  const [selectedNat, setSelectedNat] = useState<string | null>(null)

  // ── Stats ──────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:   guests.length,
    staying: guests.filter((g) => checkedInSet.has(g.id)).length,
    loyal:   guests.filter((g) => g.total_stays >= 3 && !g.is_flagged).length,
    flagged: guests.filter((g) => g.is_flagged).length,
  }), [guests, checkedInSet])

  // ── Nationality list (top 8 by count) ─────────────────────────────────
  const existingNats = useMemo(() => {
    const counts: Record<string, number> = {}
    guests.forEach((g) => { if (g.nationality) counts[g.nationality] = (counts[g.nationality] ?? 0) + 1 })
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n]) => n)
  }, [guests])

  // ── Filtered + sorted list ─────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = guests.filter((g) => {
      if (q) {
        const name = `${g.first_name} ${g.last_name}`.toLowerCase()
        const doc = (g.document_number ?? '').toLowerCase()
        const phone = (g.phone ?? '').replace(/\D/g, '')
        const sq = q.replace(/\D/g, '')
        if (!name.includes(q) && !doc.includes(q) && !(sq && phone.includes(sq))) return false
      }
      if (selectedNat && g.nationality !== selectedNat) return false
      if (statusFilter === 'staying' && !checkedInSet.has(g.id)) return false
      if (statusFilter === 'loyal'   && (g.total_stays < 3 || g.is_flagged)) return false
      if (statusFilter === 'flagged' && !g.is_flagged) return false
      return true
    })

    list = [...list].sort((a, b) => {
      if (sort === 'stays') return b.total_stays - a.total_stays
      if (sort === 'spent') return b.total_spent - a.total_spent
      if (sort === 'alpha') return `${a.last_name}${a.first_name}`.localeCompare(`${b.last_name}${b.first_name}`)
      // 'recent' — checked-in first, then by created_at
      const aIn = checkedInSet.has(a.id) ? 1 : 0
      const bIn = checkedInSet.has(b.id) ? 1 : 0
      if (aIn !== bIn) return bIn - aIn
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    return list
  }, [guests, query, selectedNat, statusFilter, sort, checkedInSet])

  const STATUS_TABS: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'all',     label: t('common.all'),          count: stats.total },
    { key: 'staying', label: t('guests.staying'),       count: stats.staying },
    { key: 'loyal',   label: t('guests.loyal'),         count: stats.loyal },
    { key: 'flagged', label: t('guests.flaggedPlural'), count: stats.flagged },
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 hp-page-in space-y-8 bg-[#F4F6F8] min-h-full">

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-[#0A1F1C] tracking-tight">{t('guests.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('guests.subtitle')}</p>
        </div>
        <Link href="/guests/new">
          <Button className="bg-[#0F6E56] hover:bg-[#0c5c48] text-white shadow-md hover:shadow-lg transition-all rounded-xl h-11 px-6 font-semibold">
            <Plus className="w-4 h-4 mr-2 stroke-[3]" />
            {t('guests.new')}
          </Button>
        </Link>
      </div>

      {/* ── Stats Strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: t('guests.totalGuests'), value: stats.total,   icon: Users,       color: 'bg-emerald-50 text-[#0F6E56]', border: 'border-emerald-100' },
          { label: t('guests.staying'),     value: stats.staying, icon: TrendingUp,  color: 'bg-[#0F6E56]/10 text-[#0F6E56]', border: 'border-[#0F6E56]/20' },
          { label: t('guests.loyal'),       value: stats.loyal,   icon: Star,        color: 'bg-amber-50 text-amber-600', border: 'border-amber-100' },
          { label: t('guests.flaggedPlural'), value: stats.flagged, icon: ShieldAlert, color: 'bg-red-50 text-red-600', border: 'border-red-100' },
        ].map(({ label, value, icon: Icon, color, border }) => (
          <div
            key={label}
            className={cn("bg-white rounded-[16px] border p-4 flex flex-col gap-3 transition-all hover:shadow-md shadow-[0_1px_4px_rgba(0,0,0,0.04)]", border)}
          >
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", color)}>
                <Icon className="w-5 h-5 flex-shrink-0" />
            </div>
            <div>
              <p className="text-2xl font-black leading-none text-[#0A1F1C] tabular-nums">{value}</p>
              <p className="text-[11px] font-bold text-muted-foreground mt-1 uppercase tracking-wider">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Search & Filters Row ── */}
      <div className="bg-white rounded-[16px] border border-[#E8ECF0] p-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)] space-y-4">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-[#0F6E56] transition-colors" />
            <Input
              placeholder={t('guests.search')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-11 h-12 text-base rounded-[10px] border-[#E8ECF0] bg-white focus-visible:ring-0 focus-visible:border-[#0F6E56]/30 transition-all w-full"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-[#0A1F1C] p-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
             {/* Sort */}
            <DropdownMenu>
              <DropdownMenuTrigger className="h-12 px-5 rounded-xl border-2 font-semibold flex-1 sm:flex-none inline-flex items-center border border-border bg-background hover:bg-muted transition-all text-sm">
                <ArrowUpDown className="w-4 h-4 mr-2 opacity-60" />
                {SORT_LABELS[sort]}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl p-1">
                {(Object.entries(SORT_LABELS) as [SortKey, string][]).map(([k, label]) => (
                  <DropdownMenuItem
                    key={k}
                    onClick={() => setSort(k)}
                    className={cn("rounded-lg px-3 py-2 text-sm", sort === k && 'bg-[#0F6E56]/10 text-[#0F6E56] font-bold')}
                  >
                    {label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {STATUS_TABS.map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setStatus(key)}
              className={cn(
                'flex items-center gap-2 text-xs px-4 py-2 rounded-full transition-all border-2 font-bold',
                statusFilter === key
                  ? 'bg-[#0F6E56] border-[#0F6E56] text-white shadow-sm'
                  : 'bg-white border-muted text-muted-foreground hover:border-[#0F6E56]/30 hover:text-[#0F6E56]',
              )}
            >
              {label}
              <span className={cn(
                'text-[10px] px-2 py-0.5 rounded-full min-w-[20px] tabular-nums font-black',
                statusFilter === key ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground',
              )}>
                {count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Nationality chips ── */}
      {existingNats.length > 0 && (
        <div className="flex gap-2 flex-wrap items-center bg-muted/5 p-3 rounded-2xl border border-dashed border-muted">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-1">{t('guests.nationalityFilter')}:</span>
          {existingNats.map((nat) => (
            <button
              key={nat}
              onClick={() => setSelectedNat(selectedNat === nat ? null : nat)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all',
                selectedNat === nat
                  ? 'bg-[#0F6E56]/10 border-[#0F6E56] text-[#0F6E56]'
                  : 'bg-white border-transparent text-muted-foreground hover:border-muted-foreground/30',
              )}
            >
              <span className="text-sm scale-110">{natFlag(nat)}</span>
              {nat}
            </button>
          ))}
          {selectedNat && (
            <button
              onClick={() => setSelectedNat(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-red-50 text-red-600 border-2 border-red-100 hover:bg-red-100 transition-all animate-in fade-in zoom-in-95"
            >
              <X className="w-3 h-3" /> {t('guests.clear')}
            </button>
          )}
        </div>
      )}

      {/* ── Results count ── */}
      <p className="text-xs text-muted-foreground">
        {filtered.length !== guests.length
          ? `${filtered.length} / ${guests.length} ${t('guests.title').toLowerCase()}`
          : `${guests.length} ${t('guests.title').toLowerCase()}`}
      </p>

      {/* ── Guest list ── */}
      {guests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Users className="w-12 h-12 text-muted-foreground/40 mb-4" />
          <p className="font-medium">{t('guests.noGuests')}</p>
          <p className="text-sm text-muted-foreground mt-1">{t('guests.noGuestsDesc')}</p>
          <Link href="/guests/new" className="mt-4">
            <Button className="bg-[#0F6E56] hover:bg-[#0c5a46]">{t('guests.new')}</Button>
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <Search className="w-8 h-8 text-muted-foreground/40" />
          <p className="text-sm font-medium">{t('common.noResult')}</p>
          <button
            onClick={() => { setQuery(''); setSelectedNat(null); setStatus('all') }}
            className="text-xs text-[#0F6E56] hover:underline mt-1"
          >
            {t('bookings.resetFilters')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filtered.map((guest) => {
            const isStaying  = checkedInSet.has(guest.id)
            const isLoyal    = guest.total_stays >= 3 && !guest.is_flagged
            const contactNum = guest.whatsapp ?? guest.phone

            return (
              <Card
                key={guest.id}
                className={cn(
                  'transition-all duration-300 border bg-white rounded-[14px] group relative overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.04)]',
                  guest.is_flagged
                    ? 'border-red-200 bg-red-50/20 hover:border-red-400'
                    : isStaying
                      ? 'border-[#0F6E56]/30 hover:border-[#0F6E56] hover:shadow-md'
                      : 'border-[#E8ECF0] hover:border-[#0F6E56]/30 hover:shadow-md hover:-translate-y-0.5',
                )}
              >
                <CardContent className="p-0">
                  <Link href={`/guests/${guest.id}`} className="block p-4 sm:p-5">
                    <div className="flex items-center gap-4">

                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                        <div className={cn(
                          'w-12 h-12 rounded-2xl flex items-center justify-center text-base font-black transition-transform duration-300 group-hover:scale-110',
                          guest.is_flagged
                            ? 'bg-red-100 text-red-600'
                            : isStaying
                              ? 'bg-[#0F6E56] text-white'
                              : 'bg-muted text-[#0A1F1C]',
                        )}>
                          {guest.first_name?.[0] ?? '?'}{guest.last_name?.[0] ?? ''}
                        </div>
                        {isStaying && !guest.is_flagged && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#0F6E56] ring-2 ring-white border-[2px] border-white" />
                        )}
                        {guest.is_flagged && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 ring-2 ring-white border-[2px] border-white flex items-center justify-center">
                             <ShieldAlert className="w-2.5 h-2.5 text-white stroke-[3]" />
                          </span>
                        )}
                      </div>

                      {/* Name + meta */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={cn(
                            'font-bold text-base tracking-tight',
                            guest.is_flagged ? 'text-red-700' : 'text-[#0A1F1C]',
                          )}>
                            {guest.first_name} {guest.last_name}
                          </span>
                          <span className="text-base grayscale group-hover:grayscale-0 transition-all">{natFlag(guest.nationality)}</span>
                          {isLoyal && (
                            <div className="bg-amber-100 p-1 rounded-md">
                               <Star className="w-3 h-3 text-amber-600 fill-amber-600" />
                            </div>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <p className="text-[13px] font-medium text-muted-foreground">
                            {guest.nationality ?? t('guests.noNationality')}
                            {guest.document_number ? ` · ${guest.document_number}` : ''}
                          </p>
                          {isStaying && (
                            <div className="flex items-center gap-1.5 bg-[#0F6E56]/10 px-2 py-0.5 rounded-full">
                               <div className="w-1.5 h-1.5 rounded-full bg-[#0F6E56] animate-pulse" />
                               <span className="text-[10px] font-black uppercase text-[#0F6E56] tracking-widest">{t('guests.active')}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="hidden sm:flex flex-col items-end gap-1 flex-shrink-0 text-right pr-2">
                        <div className="bg-muted/50 rounded-lg px-2.5 py-1 text-xs font-bold text-[#0A1F1C] border border-muted">
                          {guest.total_stays} {guest.total_stays !== 1 ? t('guests.stays') : t('guests.stay')}
                        </div>
                        {guest.total_spent > 0 ? (
                          <span className="text-sm font-black text-[#0F6E56] tracking-tight">{formatCurrency(guest.total_spent)}</span>
                        ) : (
                          <span className="text-[11px] font-bold text-muted-foreground uppercase opacity-60 tracking-wider">{t('guests.registered')}: {formatDateShort(guest.created_at)}</span>
                        )}
                      </div>
                    </div>
                  </Link>

                  {/* Actions Row */}
                  {(contactNum || guest.is_flagged) && (
                    <div className="px-4 sm:px-5 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-3 border-t border-muted/30 bg-muted/5">
                      {contactNum && (
                        <div className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground flex-1">
                          <span className="bg-muted p-1 rounded-md">📱</span>
                          <span className="font-mono tabular-nums">{contactNum}</span>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2 w-full sm:w-auto ml-auto">
                        {contactNum && (
                          <a
                            href={buildWhatsAppLink(contactNum, '')}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 text-xs font-bold text-white bg-[#25D366] hover:bg-[#1da851] px-4 py-2 rounded-xl transition-all shadow-sm hover:shadow-md"
                          >
                            <MessageSquare className="w-3.5 h-3.5 fill-white/20" />
                            WhatsApp
                          </a>
                        )}
                        <Link
                          href={`/guests/${guest.id}`}
                          className="flex-1 sm:flex-none rounded-xl text-xs font-bold h-9 border border-muted hover:bg-white inline-flex items-center justify-center px-3 transition-colors"
                        >
                          {t('guests.viewProfile')}
                        </Link>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 pb-1 text-sm text-muted-foreground">
          <span>
            {t('common.page')} {page} / {totalPages} — {totalCount} {t('guests.title').toLowerCase()}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => router.push(`/guests?page=${page - 1}`)}
            >
              {t('common.previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => router.push(`/guests?page=${page + 1}`)}
            >
              {t('common.next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
