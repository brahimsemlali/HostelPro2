'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Shield, Search, TrendingUp, Users, CheckCircle2, Clock, MoreHorizontal, X, Copy,
  RefreshCw, Wallet, Repeat, Activity, AlertTriangle, MessageCircle, Download, Ban, Gift,
} from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { format, differenceInDays, formatDistanceToNowStrict } from 'date-fns'
import { fr } from 'date-fns/locale'
import { PLAN_OPTIONS, PaymentDialog, formatMAD, tenantAction, waLink, downloadCsv } from './admin-ui'

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
  phone: string | null
  created_at: string
  owner_id: string
  owner_email: string
  owner_last_sign_in: string | null
  subscription: Subscription | null
  plan_name: string | null
  plan_price: number
  bed_count: number
  bookings_30d: number
  last_activity: string | null
  suspended: boolean
}

interface Stats {
  total: number
  active: number
  trialing: number
  mrr: number
  arr: number
  cashThisMonth: number
  cashLastMonth: number
  conversionPct: number | null
  activeUsage: number
  atRisk: number
}

export interface ChaseItem {
  id: string
  name: string
  city: string
  phone: string | null
  ownerEmail: string
  bucket: 'grace' | 'ending_soon' | 'trial_ending' | 'trial_expired' | 'lapsed'
  label: string
  periodEnd: string | null
  monthlyPrice: number
  planName: string | null
}

interface Props {
  properties: Property[]
  stats: Stats
  signupsByWeek: { label: string; count: number }[]
  revenue: { month: string; amount: number; current: boolean }[]
  chase: ChaseItem[]
  migrationMissing: boolean
}

type FilterTab = 'all' | 'active' | 'trialing' | 'expired' | 'none' | 'suspended'

function isExpiredSub(sub: Subscription | null): boolean {
  return sub?.current_period_end ? new Date(sub.current_period_end) < new Date() : false
}

export function getSubStatus(sub: Subscription | null, suspended = false): { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' } {
  if (suspended) return { label: 'Suspendu', variant: 'destructive' }
  if (!sub) return { label: 'Aucun plan', variant: 'outline' }
  const expired = isExpiredSub(sub)
  if (sub.status === 'active' && !expired) return { label: 'Actif', variant: 'default' }
  if (sub.status === 'trialing' && !expired) return { label: 'Essai', variant: 'secondary' }
  if (sub.status === 'cancelled' && !expired) return { label: 'Annulé (accès jusqu’à la fin)', variant: 'outline' }
  if (expired || sub.status === 'expired' || sub.status === 'cancelled') return { label: 'Expiré', variant: 'destructive' }
  if (sub.status === 'past_due') return { label: 'En retard', variant: 'outline' }
  return { label: sub.status, variant: 'outline' }
}

function KpiCard({ label, value, sub, icon, color, tone }: {
  label: string
  value: string | number
  sub?: string
  icon: React.ReactNode
  color: string
  tone?: 'warn'
}) {
  return (
    <div className={cn('bg-white rounded-2xl p-5 border shadow-sm flex items-start gap-4', tone === 'warn' ? 'border-orange-200' : 'border-[#E8ECF0]')}>
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', color)}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-[#94A3B8] font-medium">{label}</p>
        <p className="text-2xl font-black text-[#0A1F1C] leading-tight mt-0.5">{value}</p>
        {sub && <p className="text-xs text-[#94A3B8] mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function Bars({ title, items, format: fmt }: {
  title: string
  items: { label: string; value: number; highlight?: boolean }[]
  format: (n: number) => string
}) {
  const max = Math.max(...items.map((w) => w.value), 1)
  return (
    <div className="bg-white rounded-2xl p-5 border border-[#E8ECF0] shadow-sm">
      <p className="text-sm font-semibold text-[#0A1F1C] mb-4">{title}</p>
      <div className="flex items-end gap-2 h-28">
        {items.map((w) => (
          <div key={w.label} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            {w.value > 0 && <span className="text-[9px] font-bold text-[#0F6E56] truncate max-w-full">{fmt(w.value)}</span>}
            <div
              className={cn('w-full rounded-t-md', w.highlight ? 'bg-[#0F6E56]' : 'bg-[#0F6E56]/20')}
              style={{ height: `${(w.value / max) * 76}px`, minHeight: w.value > 0 ? '4px' : '0px' }}
            />
            <span className="text-[9px] text-[#94A3B8] truncate max-w-full">{w.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const MONTHS_FR = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc']
const monthLabel = (key: string) => MONTHS_FR[Number(key.slice(5, 7)) - 1] ?? key

function renewalMessage(c: ChaseItem): string {
  const plan = c.planName && c.planName !== 'Manuel' ? ` ${c.planName}` : ''
  const date = c.periodEnd ? new Date(c.periodEnd).toLocaleDateString('fr-FR') : ''
  if (c.bucket === 'trial_ending' || c.bucket === 'trial_expired') {
    return `Bonjour, c'est Sweet Reservation 👋 Votre essai gratuit pour ${c.name} ${c.bucket === 'trial_ending' ? `se termine le ${date}` : 'est terminé'}. Pour continuer, le forfait Starter est à 350 MAD/mois, payable par virement ou en espèces. Voulez-vous que je l'active ?`
  }
  return `Bonjour, c'est Sweet Reservation 👋 Votre abonnement${plan} pour ${c.name} ${c.bucket === 'ending_soon' ? `arrive à échéance le ${date}` : `a expiré le ${date}`}. Le renouvellement est de ${formatMAD(c.monthlyPrice)}/mois, par virement ou en espèces. Merci !`
}

export function AdminClient({ properties, stats, signupsByWeek, revenue, chase, migrationMissing }: Props) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterTab>('all')
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [payFor, setPayFor] = useState<{ id: string; name: string; variant: string | null } | null>(null)
  const router = useRouter()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const q = query.trim().toLowerCase()
  const filtered = properties.filter((p) => {
    const matchQuery = !q ||
      p.name.toLowerCase().includes(q) ||
      p.city.toLowerCase().includes(q) ||
      p.owner_email.toLowerCase().includes(q) ||
      (p.phone ?? '').replace(/\s/g, '').includes(q.replace(/\s/g, '')) ||
      // the billing page's WhatsApp request carries the first 8 chars of the id
      p.id.toLowerCase().startsWith(q)
    if (!matchQuery) return false
    const expired = isExpiredSub(p.subscription)
    if (filter === 'suspended') return p.suspended
    if (filter === 'active') return p.subscription?.status === 'active' && !expired
    if (filter === 'trialing') return p.subscription?.status === 'trialing' && !expired
    if (filter === 'expired') return expired || p.subscription?.status === 'expired'
    if (filter === 'none') return !p.subscription
    return true
  })

  async function runAction(propertyId: string, action: string, payload: Record<string, unknown>, success: string) {
    setLoadingId(propertyId)
    setOpenMenuId(null)
    try {
      await tenantAction(propertyId, action, payload)
      toast.success(success)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setLoadingId(null)
    }
  }

  function exportCsv() {
    downloadCsv(
      `clients-sweet-reservation-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Propriété', 'Ville', 'Téléphone', 'Email propriétaire', 'Statut', 'Plan', 'Prix mensuel (MAD)', 'Fin de période', 'Lits', 'Réservations 30j', 'Dernière activité', 'Inscrit le', 'Réf'],
      filtered.map((p) => [
        p.name, p.city, p.phone, p.owner_email, getSubStatus(p.subscription, p.suspended).label,
        p.plan_name, p.plan_price || null, p.subscription?.current_period_end?.slice(0, 10) ?? null,
        p.bed_count, p.bookings_30d, p.last_activity?.slice(0, 10) ?? null, p.created_at.slice(0, 10), p.id.slice(0, 8),
      ]),
    )
  }

  const FILTER_TABS: { id: FilterTab; label: string; count: number }[] = [
    { id: 'all', label: 'Tous', count: properties.length },
    { id: 'active', label: 'Payants', count: stats.active },
    { id: 'trialing', label: 'Essai', count: stats.trialing },
    { id: 'expired', label: 'Expirés', count: properties.filter((p) => isExpiredSub(p.subscription) || p.subscription?.status === 'expired').length },
    { id: 'none', label: 'Sans plan', count: properties.filter((p) => !p.subscription).length },
    { id: 'suspended', label: 'Suspendus', count: properties.filter((p) => p.suspended).length },
  ]

  const cashDelta = stats.cashLastMonth > 0
    ? Math.round(((stats.cashThisMonth - stats.cashLastMonth) / stats.cashLastMonth) * 100)
    : null

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 hp-page-in">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#0F6E56] to-[#16a37d] flex items-center justify-center shadow-md">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#0A1F1C]">Command Center</h1>
            <p className="text-xs text-[#94A3B8]">Sweet Reservation — Superadmin</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => router.refresh()} className="text-[#94A3B8] hover:text-[#0A1F1C]">
          <RefreshCw className="w-4 h-4" />
          Actualiser
        </Button>
      </div>

      {migrationMissing && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <b>Migration 033 non appliquée.</b> Le journal des paiements, les notes, la suspension et l&apos;audit sont désactivés.
          Exécutez <code className="font-mono text-xs">supabase/migrations/033_admin_console.sql</code> dans l&apos;éditeur SQL Supabase.
        </div>
      )}

      {/* Money */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="MRR" value={formatMAD(stats.mrr)} sub={`ARR ${formatMAD(stats.arr)} · contrats en cours, mois offerts inclus`} icon={<TrendingUp className="w-5 h-5 text-emerald-600" />} color="bg-emerald-50" />
        <KpiCard
          label="Encaissé ce mois"
          value={formatMAD(stats.cashThisMonth)}
          sub={cashDelta === null ? `mois dernier ${formatMAD(stats.cashLastMonth)}` : `${cashDelta >= 0 ? '+' : ''}${cashDelta}% vs mois dernier`}
          icon={<Wallet className="w-5 h-5 text-[#0F6E56]" />}
          color="bg-[#0F6E56]/10"
        />
        <KpiCard label="Clients payants" value={stats.active} sub={`${stats.total} comptes au total`} icon={<CheckCircle2 className="w-5 h-5 text-[#0F6E56]" />} color="bg-[#0F6E56]/10" />
        <KpiCard
          label="À relancer"
          value={stats.atRisk}
          sub="échéance < 7 j ou en grâce"
          icon={<AlertTriangle className="w-5 h-5 text-orange-500" />}
          color="bg-orange-50"
          tone={stats.atRisk > 0 ? 'warn' : undefined}
        />
      </div>

      {/* Growth */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="En essai" value={stats.trialing} icon={<Clock className="w-5 h-5 text-blue-500" />} color="bg-blue-50" />
        <KpiCard
          label="Conversion essai → payant"
          value={stats.conversionPct === null ? '—' : `${stats.conversionPct}%`}
          sub="comptes inscrits depuis > 14 j"
          icon={<Repeat className="w-5 h-5 text-violet-500" />}
          color="bg-violet-50"
        />
        <KpiCard label="Actifs (7 j)" value={stats.activeUsage} sub="ont utilisé l’app cette semaine" icon={<Activity className="w-5 h-5 text-sky-500" />} color="bg-sky-50" />
        <KpiCard label="Comptes" value={stats.total} sub={`${signupsByWeek[signupsByWeek.length - 1]?.count ?? 0} inscrits cette semaine`} icon={<Users className="w-5 h-5 text-[#0A1F1C]" />} color="bg-[#0A1F1C]/8" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Bars
          title="Encaissements (6 derniers mois)"
          items={revenue.map((r) => ({ label: monthLabel(r.month), value: r.amount, highlight: r.current }))}
          format={(n) => n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n)}
        />
        <Bars
          title="Inscriptions (8 dernières semaines)"
          items={signupsByWeek.map((w, i) => ({ label: w.label, value: w.count, highlight: i === signupsByWeek.length - 1 }))}
          format={String}
        />
      </div>

      {/* Who to call today */}
      <div className="bg-white rounded-2xl border border-[#E8ECF0] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#F1F5F9] flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[#0A1F1C]">À relancer</p>
            <p className="text-xs text-[#94A3B8]">Renouvellements, fins d&apos;essai et comptes perdus récemment</p>
          </div>
          <span className="text-xs font-bold text-[#64748B]">{chase.length}</span>
        </div>
        {chase.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[#94A3B8]">Personne à relancer aujourd&apos;hui 🎉</p>
        ) : (
          <div className="divide-y divide-[#F1F5F9]">
            {chase.map((c) => {
              const wa = waLink(c.phone, renewalMessage(c))
              return (
                <div key={c.id} className="px-5 py-3 flex flex-wrap items-center gap-3">
                  <Badge
                    variant={c.bucket === 'grace' ? 'destructive' : 'outline'}
                    className={cn('text-[10px] font-bold shrink-0', c.bucket === 'ending_soon' && 'border-orange-200 text-orange-600', c.bucket === 'trial_ending' && 'border-blue-200 text-blue-600')}
                  >
                    {c.label}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/tenants/${c.id}`} className="text-sm font-semibold text-[#0A1F1C] hover:text-[#0F6E56]">{c.name}</Link>
                    <p className="text-xs text-[#94A3B8] truncate">
                      {c.city}{c.periodEnd ? ` · fin ${format(new Date(c.periodEnd), 'd MMM', { locale: fr })}` : ''}{c.phone ? ` · ${c.phone}` : ' · pas de téléphone'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {wa && (
                      <a href={wa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#25D366]/30 text-[#1da851] text-xs font-medium hover:bg-[#25D366]/5">
                        <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                      </a>
                    )}
                    <Button size="sm" className="h-8 rounded-lg bg-[#0F6E56] hover:bg-[#0c5a46] text-xs" onClick={() => setPayFor({ id: c.id, name: c.name, variant: null })} disabled={migrationMissing}>
                      <Wallet className="w-3.5 h-3.5" /> Encaisser
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Tenants */}
      <div className="bg-white rounded-2xl border border-[#E8ECF0] shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-[#F1F5F9]">
          <div className="flex items-center gap-1 overflow-x-auto">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap', filter === tab.id ? 'bg-[#0A1F1C] text-white' : 'text-[#64748B] hover:bg-[#F1F5F9]')}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={cn('ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-bold', filter === tab.id ? 'bg-white/20 text-white' : 'bg-[#F1F5F9] text-[#64748B]')}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" />
              <Input placeholder="Nom, email, tél, réf…" className="pl-8 h-8 w-56 text-sm bg-[#F8FAFC] border-[#E8ECF0]" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <Button size="sm" variant="outline" className="h-8 border-[#E8ECF0] text-[#475569]" onClick={exportCsv}>
              <Download className="w-3.5 h-3.5" /> CSV
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E8ECF0]">
                {['Propriété', 'Propriétaire', 'Plan', 'Statut', 'Expiration', 'Utilisation'].map((h) => (
                  <th key={h} className="px-5 py-3 text-[11px] font-bold text-[#64748B] uppercase tracking-wider">{h}</th>
                ))}
                <th className="px-5 py-3 text-[11px] font-bold text-[#64748B] uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-[#94A3B8]">Aucune propriété trouvée</td></tr>
              )}
              {filtered.map((p) => {
                const status = getSubStatus(p.subscription, p.suspended)
                const daysLeft = p.subscription?.current_period_end ? differenceInDays(new Date(p.subscription.current_period_end), new Date()) : null
                const isLoading = loadingId === p.id
                return (
                  <tr key={p.id} className="hover:bg-[#F8FAFC]/60 transition-colors">
                    <td className="px-5 py-3.5">
                      <Link href={`/admin/tenants/${p.id}`} className="font-semibold text-sm text-[#0A1F1C] hover:text-[#0F6E56]">{p.name}</Link>
                      <div className="text-xs text-[#94A3B8]">
                        {p.city} · {p.bed_count} lit{p.bed_count !== 1 ? 's' : ''} · inscrit le {format(new Date(p.created_at), 'd MMM yyyy', { locale: fr })}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        className="text-xs text-[#475569] hover:text-[#0F6E56] transition-colors flex items-center gap-1 group"
                        onClick={() => { navigator.clipboard.writeText(p.owner_email); toast.success('Email copié') }}
                      >
                        {p.owner_email || <span className="text-[#CBD5E1] italic">—</span>}
                        <Copy className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity shrink-0" />
                      </button>
                      {p.phone && <div className="text-[11px] text-[#94A3B8]">{p.phone}</div>}
                    </td>
                    <td className="px-5 py-3.5">
                      {p.plan_name ? (
                        <Badge variant="outline" className="text-[10px] font-bold border-[#E8ECF0] text-[#475569]">
                          {p.plan_name}{p.plan_price > 0 && ` · ${formatMAD(p.plan_price)}`}
                        </Badge>
                      ) : <span className="text-xs text-[#CBD5E1]">—</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant={status.variant} className={cn('text-[10px] font-bold', status.variant === 'default' && 'bg-[#0F6E56]/10 text-[#0F6E56] border-0')}>
                        {status.label}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      {p.subscription?.current_period_end ? (
                        <div>
                          <div className="text-xs text-[#475569]">{format(new Date(p.subscription.current_period_end), 'd MMM yyyy', { locale: fr })}</div>
                          {daysLeft !== null && (
                            <div className={cn('text-[10px] font-medium mt-0.5', daysLeft < 0 ? 'text-red-400' : daysLeft < 7 ? 'text-orange-400' : 'text-[#94A3B8]')}>
                              {daysLeft < 0 ? `Expiré il y a ${Math.abs(daysLeft)}j` : `${daysLeft}j restants`}
                            </div>
                          )}
                        </div>
                      ) : <span className="text-xs text-[#CBD5E1]">—</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="text-xs text-[#475569]">{p.bookings_30d} résa. / 30 j</div>
                      <div className="text-[10px] text-[#94A3B8]">
                        {p.last_activity ? `actif il y a ${formatDistanceToNowStrict(new Date(p.last_activity), { locale: fr })}` : 'aucune activité'}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="xs"
                          disabled={isLoading || migrationMissing}
                          onClick={() => setPayFor({ id: p.id, name: p.name, variant: p.subscription?.ls_variant_id ?? null })}
                          className="h-6 text-[10px] px-2 bg-[#0F6E56] hover:bg-[#0c5a46]"
                          title={migrationMissing ? 'Appliquez la migration 033' : undefined}
                        >
                          Encaisser
                        </Button>
                        <div className="relative" ref={openMenuId === p.id ? menuRef : undefined}>
                          <button
                            disabled={isLoading}
                            onClick={() => setOpenMenuId(openMenuId === p.id ? null : p.id)}
                            className="w-6 h-6 rounded-md flex items-center justify-center text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#0A1F1C] transition-colors disabled:opacity-40"
                            aria-label="Plus d'actions"
                          >
                            {isLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <MoreHorizontal className="w-3.5 h-3.5" />}
                          </button>
                          {openMenuId === p.id && (
                            <div className="absolute right-0 top-8 bg-white border border-[#E8ECF0] rounded-xl shadow-lg p-1.5 z-20 min-w-44">
                              <Link href={`/admin/tenants/${p.id}`} className="w-full text-left px-3 py-2 text-xs text-[#0A1F1C] font-semibold hover:bg-[#F8FAFC] rounded-lg flex items-center gap-2">
                                <Users className="w-3.5 h-3.5" /> Ouvrir la fiche client
                              </Link>
                              <div className="h-px bg-[#F1F5F9] my-1" />
                              <button onClick={() => runAction(p.id, 'extend', { months: 1 }, 'Mois offert')} className="w-full text-left px-3 py-2 text-xs text-[#475569] hover:bg-[#F8FAFC] rounded-lg flex items-center gap-2">
                                <Gift className="w-3.5 h-3.5" /> Offrir 1 mois
                              </button>
                              <button onClick={() => runAction(p.id, 'trial', { days: 14 }, 'Essai 14 jours activé')} className="w-full text-left px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 rounded-lg flex items-center gap-2">
                                <Clock className="w-3.5 h-3.5" /> Essai 14 jours
                              </button>
                              <div className="h-px bg-[#F1F5F9] my-1" />
                              <div className="px-3 pt-1 pb-1 text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider">Plan (MRR)</div>
                              {PLAN_OPTIONS.map((opt) => (
                                <button
                                  key={opt.id}
                                  onClick={() => runAction(p.id, 'set_plan', { variantId: opt.id }, 'Plan mis à jour')}
                                  className="w-full text-left px-3 py-2 text-xs text-[#475569] hover:bg-[#F8FAFC] rounded-lg flex items-center justify-between gap-2"
                                >
                                  <span>{opt.name} · {formatMAD(opt.price)}</span>
                                  {p.subscription?.ls_variant_id === opt.id && <CheckCircle2 className="w-3.5 h-3.5 text-[#0F6E56] shrink-0" />}
                                </button>
                              ))}
                              <div className="h-px bg-[#F1F5F9] my-1" />
                              <button onClick={() => runAction(p.id, 'cancel', {}, 'Abonnement annulé (accès jusqu’à la fin de période)')} className="w-full text-left px-3 py-2 text-xs text-orange-600 hover:bg-orange-50 rounded-lg flex items-center gap-2">
                                <X className="w-3.5 h-3.5" /> Annuler à échéance
                              </button>
                              <button onClick={() => runAction(p.id, 'expire', {}, 'Accès coupé')} className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50 rounded-lg flex items-center gap-2">
                                <Ban className="w-3.5 h-3.5" /> Couper l&apos;accès maintenant
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

        {filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-[#F1F5F9] flex items-center justify-between">
            <p className="text-xs text-[#94A3B8]">
              {filtered.length} propriété{filtered.length !== 1 ? 's' : ''}
              {q || filter !== 'all' ? ` (filtrées sur ${properties.length})` : ''}
            </p>
            {stats.mrr > 0 && (
              <p className="text-xs text-[#94A3B8]">MRR : <span className="font-bold text-[#0A1F1C]">{formatMAD(stats.mrr)}/mois</span></p>
            )}
          </div>
        )}
      </div>

      {payFor && (
        <PaymentDialog
          key={payFor.id}
          open
          onOpenChange={(o) => { if (!o) setPayFor(null) }}
          propertyId={payFor.id}
          propertyName={payFor.name}
          defaultVariant={payFor.variant}
          onDone={() => router.refresh()}
        />
      )}
    </div>
  )
}
