'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Shield, Search, TrendingUp, Users, CheckCircle2,
  Clock, AlertTriangle, MoreHorizontal, X, Copy,
  ChevronDown, RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { format, differenceInDays } from 'date-fns'
import { fr } from 'date-fns/locale'

interface Subscription {
  status: string
  provider: string
  ls_variant_id: string | null
  current_period_end: string | null
  updated_at: string | null
}

interface Property {
  id: string
  name: string
  city: string
  created_at: string
  owner_id: string
  owner_email: string
  subscription: Subscription | null
  plan_name: string | null
  plan_price: number
  bed_count: number
}

interface Stats {
  total: number
  active: number
  trialing: number
  mrr: number
}

interface SignupWeek {
  label: string
  count: number
}

interface Props {
  properties: Property[]
  stats: Stats
  signupsByWeek: SignupWeek[]
}

type FilterTab = 'all' | 'active' | 'trialing' | 'expired' | 'none'

function getSubStatus(p: Property): { label: string; color: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' } {
  const sub = p.subscription
  if (!sub) return { label: 'Aucun plan', color: 'text-gray-400', variant: 'outline' }
  const now = new Date()
  const isExpired = sub.current_period_end ? new Date(sub.current_period_end) < now : false
  if (sub.status === 'active' && !isExpired) return { label: 'Actif', color: 'text-[#0F6E56]', variant: 'default' }
  if (sub.status === 'trialing' && !isExpired) return { label: 'Essai', color: 'text-blue-600', variant: 'secondary' }
  if (isExpired || sub.status === 'expired') return { label: 'Expiré', color: 'text-red-500', variant: 'destructive' }
  if (sub.status === 'cancelled') return { label: 'Annulé', color: 'text-orange-500', variant: 'outline' }
  if (sub.status === 'past_due') return { label: 'En retard', color: 'text-orange-500', variant: 'outline' }
  return { label: sub.status, color: 'text-gray-400', variant: 'outline' }
}

function getDaysLeft(sub: Subscription | null): number | null {
  if (!sub?.current_period_end) return null
  return differenceInDays(new Date(sub.current_period_end), new Date())
}

function KpiCard({ label, value, sub, icon, color }: {
  label: string
  value: string | number
  sub?: string
  icon: React.ReactNode
  color: string
}) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-[#E8ECF0] shadow-sm flex items-start gap-4">
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', color)}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-[#94A3B8] font-medium">{label}</p>
        <p className="text-2xl font-black text-[#0A1F1C] leading-tight mt-0.5">{value}</p>
        {sub && <p className="text-xs text-[#94A3B8] mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function SignupBar({ weeks }: { weeks: SignupWeek[] }) {
  const max = Math.max(...weeks.map((w) => w.count), 1)
  return (
    <div className="bg-white rounded-2xl p-5 border border-[#E8ECF0] shadow-sm">
      <p className="text-sm font-semibold text-[#0A1F1C] mb-4">Inscriptions (8 dernières semaines)</p>
      <div className="flex items-end gap-2 h-24">
        {weeks.map((w) => (
          <div key={w.label} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full bg-[#0F6E56]/15 rounded-t-md transition-all"
              style={{ height: `${(w.count / max) * 80}px`, minHeight: w.count > 0 ? '4px' : '0px' }}
            />
            {w.count > 0 && (
              <span className="text-[9px] font-bold text-[#0F6E56]">{w.count}</span>
            )}
            <span className="text-[9px] text-[#94A3B8]">{w.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AdminClient({ properties, stats, signupsByWeek }: Props) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterTab>('all')
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const router = useRouter()
  const menuRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filtered = properties.filter((p) => {
    const matchQuery =
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.city.toLowerCase().includes(query.toLowerCase()) ||
      p.owner_email.toLowerCase().includes(query.toLowerCase())

    if (!matchQuery) return false

    const now = new Date()
    const isExpired = p.subscription?.current_period_end
      ? new Date(p.subscription.current_period_end) < now
      : false

    if (filter === 'active') return p.subscription?.status === 'active' && !isExpired
    if (filter === 'trialing') return p.subscription?.status === 'trialing' && !isExpired
    if (filter === 'expired') return isExpired || p.subscription?.status === 'expired' || p.subscription?.status === 'cancelled'
    if (filter === 'none') return !p.subscription
    return true
  })

  async function handleAction(propertyId: string, action: 'extend' | 'trial' | 'cancel', months?: number) {
    setLoadingId(propertyId)
    setOpenMenuId(null)
    try {
      const res = await fetch('/api/admin/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, action, months }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur inconnue')

      const msgs: Record<string, string> = {
        extend: `Abonnement prolongé de ${months} mois`,
        trial: 'Essai 30 jours activé',
        cancel: 'Abonnement annulé',
      }
      toast.success(msgs[action])
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setLoadingId(null)
    }
  }

  const FILTER_TABS: { id: FilterTab; label: string; count: number }[] = [
    { id: 'all', label: 'Tous', count: properties.length },
    { id: 'active', label: 'Actifs', count: stats.active },
    { id: 'trialing', label: 'Essai', count: stats.trialing },
    {
      id: 'expired',
      label: 'Expirés',
      count: properties.filter((p) => {
        const isExpired = p.subscription?.current_period_end
          ? new Date(p.subscription.current_period_end) < new Date()
          : false
        return isExpired || p.subscription?.status === 'expired' || p.subscription?.status === 'cancelled'
      }).length,
    },
    { id: 'none', label: 'Sans plan', count: properties.filter((p) => !p.subscription).length },
  ]

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 hp-page-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#0F6E56] to-[#16a37d] flex items-center justify-center shadow-md">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#0A1F1C]">Command Center</h1>
            <p className="text-xs text-[#94A3B8]">Sweet Reservation — Superadmin</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.refresh()}
          className="text-[#94A3B8] hover:text-[#0A1F1C]"
        >
          <RefreshCw className="w-4 h-4" />
          Actualiser
        </Button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Propriétés"
          value={stats.total}
          sub="comptes inscrits"
          icon={<Users className="w-5 h-5 text-[#0A1F1C]" />}
          color="bg-[#0A1F1C]/8"
        />
        <KpiCard
          label="Abonnements actifs"
          value={stats.active}
          icon={<CheckCircle2 className="w-5 h-5 text-[#0F6E56]" />}
          color="bg-[#0F6E56]/10"
        />
        <KpiCard
          label="En essai"
          value={stats.trialing}
          icon={<Clock className="w-5 h-5 text-blue-500" />}
          color="bg-blue-50"
        />
        <KpiCard
          label="MRR"
          value={`$${stats.mrr}`}
          sub="abonnements LemonSqueezy"
          icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
          color="bg-emerald-50"
        />
      </div>

      {/* Signup chart */}
      <SignupBar weeks={signupsByWeek} />

      {/* Properties Table */}
      <div className="bg-white rounded-2xl border border-[#E8ECF0] shadow-sm overflow-hidden">
        {/* Table header controls */}
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-[#F1F5F9]">
          <div className="flex items-center gap-1 overflow-x-auto">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                  filter === tab.id
                    ? 'bg-[#0A1F1C] text-white'
                    : 'text-[#64748B] hover:bg-[#F1F5F9]'
                )}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={cn(
                    'ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-bold',
                    filter === tab.id ? 'bg-white/20 text-white' : 'bg-[#F1F5F9] text-[#64748B]'
                  )}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="relative shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" />
            <Input
              placeholder="Rechercher..."
              className="pl-8 h-8 w-52 text-sm bg-[#F8FAFC] border-[#E8ECF0]"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E8ECF0]">
                <th className="px-5 py-3 text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Propriété</th>
                <th className="px-5 py-3 text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Propriétaire</th>
                <th className="px-5 py-3 text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Plan</th>
                <th className="px-5 py-3 text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Statut</th>
                <th className="px-5 py-3 text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Expiration</th>
                <th className="px-5 py-3 text-[11px] font-bold text-[#64748B] uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-[#94A3B8]">
                    Aucune propriété trouvée
                  </td>
                </tr>
              )}
              {filtered.map((p) => {
                const status = getSubStatus(p)
                const daysLeft = getDaysLeft(p.subscription)
                const isLoading = loadingId === p.id

                return (
                  <tr key={p.id} className="hover:bg-[#F8FAFC]/60 transition-colors">
                    {/* Property */}
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-sm text-[#0A1F1C]">{p.name}</div>
                      <div className="text-xs text-[#94A3B8]">
                        {p.city} · {p.bed_count} lit{p.bed_count !== 1 ? 's' : ''} · inscrit le{' '}
                        {format(new Date(p.created_at), 'd MMM yyyy', { locale: fr })}
                      </div>
                    </td>

                    {/* Owner email */}
                    <td className="px-5 py-3.5">
                      <button
                        className="text-xs text-[#475569] hover:text-[#0F6E56] transition-colors flex items-center gap-1 group"
                        onClick={() => {
                          navigator.clipboard.writeText(p.owner_email)
                          toast.success('Email copié')
                        }}
                      >
                        {p.owner_email || <span className="text-[#CBD5E1] italic">—</span>}
                        <Copy className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity shrink-0" />
                      </button>
                    </td>

                    {/* Plan */}
                    <td className="px-5 py-3.5">
                      {p.plan_name ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] font-bold border-[#E8ECF0] text-[#475569]"
                        >
                          {p.plan_name}
                          {p.plan_price > 0 && ` · $${p.plan_price}`}
                        </Badge>
                      ) : (
                        <span className="text-xs text-[#CBD5E1]">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5">
                      <Badge
                        variant={status.variant}
                        className={cn(
                          'text-[10px] font-bold',
                          status.variant === 'default' && 'bg-[#0F6E56]/10 text-[#0F6E56] border-0'
                        )}
                      >
                        {status.label}
                      </Badge>
                    </td>

                    {/* Expiry + days left */}
                    <td className="px-5 py-3.5">
                      {p.subscription?.current_period_end ? (
                        <div>
                          <div className="text-xs text-[#475569]">
                            {format(new Date(p.subscription.current_period_end), 'd MMM yyyy', { locale: fr })}
                          </div>
                          {daysLeft !== null && (
                            <div className={cn(
                              'text-[10px] font-medium mt-0.5',
                              daysLeft < 0 ? 'text-red-400' :
                              daysLeft < 7 ? 'text-orange-400' :
                              'text-[#94A3B8]'
                            )}>
                              {daysLeft < 0 ? `Expiré il y a ${Math.abs(daysLeft)}j` : `${daysLeft}j restants`}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-[#CBD5E1]">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Quick extend buttons */}
                        <Button
                          size="xs"
                          variant="outline"
                          disabled={isLoading}
                          onClick={() => handleAction(p.id, 'extend', 1)}
                          className="h-6 text-[10px] px-2 border-[#E8ECF0] text-[#475569]"
                        >
                          +1m
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          disabled={isLoading}
                          onClick={() => handleAction(p.id, 'extend', 6)}
                          className="h-6 text-[10px] px-2 border-[#E8ECF0] text-[#475569]"
                        >
                          +6m
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          disabled={isLoading}
                          onClick={() => handleAction(p.id, 'extend', 12)}
                          className="h-6 text-[10px] px-2 border-[#E8ECF0] text-[#475569]"
                        >
                          +12m
                        </Button>

                        {/* More actions menu */}
                        <div className="relative" ref={openMenuId === p.id ? menuRef : undefined}>
                          <button
                            disabled={isLoading}
                            onClick={() => setOpenMenuId(openMenuId === p.id ? null : p.id)}
                            className="w-6 h-6 rounded-md flex items-center justify-center text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#0A1F1C] transition-colors disabled:opacity-40"
                          >
                            {isLoading ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <MoreHorizontal className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {openMenuId === p.id && (
                            <div className="absolute right-0 top-8 bg-white border border-[#E8ECF0] rounded-xl shadow-lg p-1.5 z-20 min-w-36">
                              <button
                                onClick={() => handleAction(p.id, 'trial')}
                                className="w-full text-left px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2"
                              >
                                <Clock className="w-3.5 h-3.5" />
                                Essai 30 jours
                              </button>
                              <button
                                onClick={() => handleAction(p.id, 'extend', 24)}
                                className="w-full text-left px-3 py-2 text-xs text-[#475569] hover:bg-[#F8FAFC] rounded-lg transition-colors flex items-center gap-2"
                              >
                                <ChevronDown className="w-3.5 h-3.5 rotate-180" />
                                Prolonger 24m
                              </button>
                              <div className="h-px bg-[#F1F5F9] my-1" />
                              <button
                                onClick={() => handleAction(p.id, 'cancel')}
                                className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
                              >
                                <X className="w-3.5 h-3.5" />
                                Annuler
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Table footer */}
        {filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-[#F1F5F9] flex items-center justify-between">
            <p className="text-xs text-[#94A3B8]">
              {filtered.length} propriété{filtered.length !== 1 ? 's' : ''}
              {query || filter !== 'all' ? ` (filtrées sur ${properties.length})` : ''}
            </p>
            {stats.mrr > 0 && (
              <p className="text-xs text-[#94A3B8]">
                MRR visible : <span className="font-bold text-[#0A1F1C]">${stats.mrr}/mois</span>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
