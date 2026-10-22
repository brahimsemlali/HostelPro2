'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { format, formatDistanceToNowStrict } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  ArrowLeft, Wallet, Gift, CalendarClock, Clock, Ban, X, MessageCircle, Copy, KeyRound,
  LogIn, Download, PauseCircle, PlayCircle, Trash2, Save, Loader2, Users, Activity, ScrollText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { getSubStatus } from '../../AdminClient'
import { PLAN_OPTIONS, PaymentDialog, formatMAD, methodLabel, tenantAction, waLink } from '../../admin-ui'

type Props = {
  property: { id: string; name: string; city: string; address: string | null; phone: string | null; email: string | null; owner_id: string; created_at: string }
  owner: { email: string | null; createdAt: string | null; lastSignIn: string | null }
  subscription: { status: string; provider: string; ls_variant_id: string | null; current_period_end: string | null; created_at: string | null; updated_at: string | null } | null
  planName: string | null
  staff: { id: string; name: string; role: string; is_active: boolean; email: string | null; phone: string | null; last_sign_in_at: string | null }[]
  usage: { rooms: number; beds: number; guests: number; bookings: number; bookings30: number; guestRevenue30: number }
  activity: { id: string; action_type: string; description: string; staff_name: string | null; created_at: string }[]
  ledger: { id: string; amount: number; method: string; months: number; variant_id: string | null; period_end: string | null; reference: string | null; note: string | null; paid_at: string; recorded_by: string }[]
  ledgerTotal: number
  tenantAdmin: { notes: string | null; suspended_at: string | null; suspended_reason: string | null } | null
  audit: { id: string; action: string; actor_email: string | null; details: Record<string, unknown> | null; created_at: string }[]
  migrationMissing: boolean
  canUseStrictActions: boolean
}

const ROLE_LABELS: Record<string, string> = { owner: 'Propriétaire', manager: 'Manager', receptionist: 'Réception', housekeeping: 'Ménage' }
const ACTION_LABELS: Record<string, string> = {
  record_payment: 'Paiement encaissé', delete_payment: 'Paiement supprimé', extend: 'Mois offert(s)',
  set_end_date: 'Date de fin modifiée', set_plan: 'Plan modifié', trial: 'Essai accordé', cancel: 'Annulé à échéance',
  expire: 'Accès coupé', suspend: 'Compte suspendu', unsuspend: 'Compte réactivé', save_notes: 'Notes modifiées',
  update_property: 'Infos modifiées', recovery_link: 'Lien mot de passe généré', login_as: 'Connexion en tant que propriétaire',
  export_tenant: 'Export des données', delete_tenant: 'Client supprimé',
}

const card = 'bg-white rounded-2xl border border-[#E8ECF0] shadow-sm'
const h2 = 'text-sm font-semibold text-[#0A1F1C]'
const ago = (d: string | null) => d ? `il y a ${formatDistanceToNowStrict(new Date(d), { locale: fr })}` : 'jamais'
const day = (d: string | null) => d ? format(new Date(d), 'd MMM yyyy', { locale: fr }) : '—'

export function TenantClient(props: Props) {
  const { property, owner, subscription: sub, staff, usage, ledger, tenantAdmin, migrationMissing } = props
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [payOpen, setPayOpen] = useState(false)
  const [endDate, setEndDate] = useState(sub?.current_period_end ? sub.current_period_end.slice(0, 10) : '')
  const [giftMonths, setGiftMonths] = useState(1)
  const [notes, setNotes] = useState(tenantAdmin?.notes ?? '')
  const [info, setInfo] = useState({ name: property.name, city: property.city ?? '', phone: property.phone ?? '', email: property.email ?? '', address: property.address ?? '' })
  const [suspendReason, setSuspendReason] = useState('')
  const [generatedLink, setGeneratedLink] = useState<{ kind: 'recovery' | 'login'; url: string } | null>(null)
  const [deleteName, setDeleteName] = useState('')

  const suspended = !!tenantAdmin?.suspended_at
  const status = getSubStatus(sub, suspended)

  async function run(action: string, payload: Record<string, unknown>, success: string, after?: (r: Record<string, unknown>) => void) {
    setBusy(action)
    try {
      const res = await tenantAction(property.id, action, payload)
      toast.success(success)
      after?.(res)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setBusy(null)
    }
  }

  async function makeLink(kind: 'recovery' | 'login') {
    setBusy(kind)
    try {
      const res = await tenantAction<{ url: string }>(property.id, kind === 'recovery' ? 'recovery_link' : 'login_as')
      setGeneratedLink({ kind, url: res.url })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setBusy(null)
    }
  }

  const spinner = (a: string) => busy === a ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null
  const ownerWa = waLink(property.phone, `Bonjour, c'est Sweet Reservation 👋`)

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 hp-page-in">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-xs text-[#94A3B8] hover:text-[#0A1F1C]">
        <ArrowLeft className="w-3.5 h-3.5" /> Tous les clients
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-bold text-[#0A1F1C]">{property.name}</h1>
            <Badge variant={status.variant} className={cn('text-[10px] font-bold', status.variant === 'default' && 'bg-[#0F6E56]/10 text-[#0F6E56] border-0')}>{status.label}</Badge>
            {props.planName && <Badge variant="outline" className="text-[10px] font-bold border-[#E8ECF0] text-[#475569]">{props.planName}</Badge>}
          </div>
          <p className="text-xs text-[#94A3B8] mt-1">
            {property.city} · inscrit le {day(property.created_at)} · réf. <span className="font-mono">{property.id.slice(0, 8)}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {ownerWa && (
            <a href={ownerWa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-[#25D366]/30 text-[#1da851] text-sm font-medium hover:bg-[#25D366]/5">
              <MessageCircle className="w-4 h-4" /> WhatsApp
            </a>
          )}
          <Button className="h-9 rounded-xl bg-[#0F6E56] hover:bg-[#0c5a46]" onClick={() => setPayOpen(true)} disabled={migrationMissing}>
            <Wallet className="w-4 h-4" /> Encaisser un paiement
          </Button>
        </div>
      </div>

      {migrationMissing && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <b>Migration 033 non appliquée</b> — encaissements, notes, suspension et historique désactivés.
        </div>
      )}
      {suspended && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
          <b>Compte suspendu</b> depuis le {day(tenantAdmin!.suspended_at)}{tenantAdmin?.suspended_reason ? ` — ${tenantAdmin.suspended_reason}` : ''}. L&apos;équipe voit une page de suspension.
        </div>
      )}

      {/* Snapshot */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Fin de période', value: day(sub?.current_period_end ?? null) },
          { label: 'Total encaissé', value: formatMAD(props.ledgerTotal) },
          { label: 'Lits', value: `${usage.beds} (${usage.rooms} ch.)` },
          { label: 'Réservations 30 j', value: `${usage.bookings30} / ${usage.bookings}` },
          { label: 'CA hôtes 30 j', value: formatMAD(usage.guestRevenue30) },
          { label: 'Dernière connexion', value: ago(owner.lastSignIn) },
        ].map((k) => (
          <div key={k.label} className={cn(card, 'p-4')}>
            <p className="text-[11px] text-[#94A3B8] font-medium">{k.label}</p>
            <p className="text-sm font-bold text-[#0A1F1C] mt-1">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: subscription + money + history */}
        <div className="lg:col-span-2 space-y-6">
          <section className={cn(card, 'p-5 space-y-4')}>
            <p className={h2}>Abonnement</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-end gap-2">
                <label className="flex-1 space-y-1">
                  <span className="text-[11px] text-[#94A3B8]">Offrir des mois (sans paiement)</span>
                  <select className="w-full h-9 rounded-xl border border-[#E8ECF0] px-2 text-sm" value={giftMonths} onChange={(e) => setGiftMonths(Number(e.target.value))}>
                    {[1, 2, 3, 6, 12].map((m) => <option key={m} value={m}>{m} mois</option>)}
                  </select>
                </label>
                <Button variant="outline" className="h-9 rounded-xl" disabled={!!busy} onClick={() => run('extend', { months: giftMonths }, `${giftMonths} mois offert(s)`)}>
                  {spinner('extend') ?? <Gift className="w-3.5 h-3.5" />} Offrir
                </Button>
              </div>
              <div className="flex items-end gap-2">
                <label className="flex-1 space-y-1">
                  <span className="text-[11px] text-[#94A3B8]">Accès jusqu&apos;au (inclus)</span>
                  <Input type="date" className="h-9 rounded-xl" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </label>
                <Button variant="outline" className="h-9 rounded-xl" disabled={!!busy || !endDate} onClick={() => run('set_end_date', { date: endDate }, 'Date de fin mise à jour')}>
                  {spinner('set_end_date') ?? <CalendarClock className="w-3.5 h-3.5" />} Fixer
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {PLAN_OPTIONS.map((p) => (
                <Button
                  key={p.id}
                  variant="outline"
                  size="sm"
                  className={cn('rounded-xl', sub?.ls_variant_id === p.id && 'border-[#0F6E56] text-[#0F6E56]')}
                  disabled={!!busy || sub?.ls_variant_id === p.id}
                  onClick={() => run('set_plan', { variantId: p.id }, `Plan ${p.name}`)}
                >
                  Plan {p.name} · {formatMAD(p.price)}
                </Button>
              ))}
              <Button variant="outline" size="sm" className="rounded-xl text-blue-600" disabled={!!busy} onClick={() => run('trial', { days: 14 }, 'Essai 14 jours accordé')}>
                <Clock className="w-3.5 h-3.5" /> Essai 14 j
              </Button>
              <Button variant="outline" size="sm" className="rounded-xl text-orange-600" disabled={!!busy || !sub} onClick={() => run('cancel', {}, 'Annulé à échéance')}>
                <X className="w-3.5 h-3.5" /> Annuler à échéance
              </Button>
              <Button variant="outline" size="sm" className="rounded-xl text-red-600" disabled={!!busy || !sub} onClick={() => run('expire', {}, 'Accès coupé')}>
                <Ban className="w-3.5 h-3.5" /> Couper l&apos;accès
              </Button>
            </div>
            {sub && (
              <p className="text-[11px] text-[#94A3B8]">
                Statut brut : {sub.status} · fournisseur : {sub.provider} · modifié {ago(sub.updated_at)}
              </p>
            )}
          </section>

          <section className={card}>
            <div className="px-5 py-4 border-b border-[#F1F5F9] flex items-center justify-between">
              <p className={h2}>Paiements reçus</p>
              <span className="text-xs font-bold text-[#0F6E56]">{formatMAD(props.ledgerTotal)}</span>
            </div>
            {ledger.length === 0 ? (
              <p className="px-5 py-6 text-sm text-[#94A3B8] text-center">Aucun paiement enregistré.</p>
            ) : (
              <div className="divide-y divide-[#F1F5F9]">
                {ledger.map((r) => (
                  <div key={r.id} className="px-5 py-3 flex items-center gap-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[#0A1F1C]">{formatMAD(r.amount)} <span className="font-normal text-[#94A3B8]">· {methodLabel(r.method)}{r.months ? ` · ${r.months} mois` : ''}</span></p>
                      <p className="text-xs text-[#94A3B8] truncate">
                        {day(r.paid_at)}{r.reference ? ` · réf. ${r.reference}` : ''}{r.note ? ` · ${r.note}` : ''} · par {r.recorded_by}
                      </p>
                    </div>
                    <button
                      className="text-[#CBD5E1] hover:text-red-500 p-1"
                      aria-label="Supprimer ce paiement"
                      disabled={!!busy}
                      onClick={() => { if (window.confirm('Supprimer ce paiement du journal ? (la date de fin ne change pas)')) run('delete_payment', { paymentId: r.id }, 'Paiement supprimé') }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className={card}>
            <div className="px-5 py-4 border-b border-[#F1F5F9] flex items-center gap-2"><Activity className="w-4 h-4 text-[#94A3B8]" /><p className={h2}>Activité récente dans l&apos;app</p></div>
            {props.activity.length === 0 ? (
              <p className="px-5 py-6 text-sm text-[#94A3B8] text-center">Aucune activité — le client n&apos;utilise pas encore l&apos;app.</p>
            ) : (
              <div className="divide-y divide-[#F1F5F9]">
                {props.activity.map((a) => (
                  <div key={a.id} className="px-5 py-2.5 flex items-center justify-between gap-3 text-sm">
                    <span className="text-[#475569] truncate">{a.description}{a.staff_name ? <span className="text-[#94A3B8]"> · {a.staff_name}</span> : null}</span>
                    <span className="text-[11px] text-[#94A3B8] shrink-0">{ago(a.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className={card}>
            <div className="px-5 py-4 border-b border-[#F1F5F9] flex items-center gap-2"><ScrollText className="w-4 h-4 text-[#94A3B8]" /><p className={h2}>Historique admin</p></div>
            {props.audit.length === 0 ? (
              <p className="px-5 py-6 text-sm text-[#94A3B8] text-center">Aucune action enregistrée.</p>
            ) : (
              <div className="divide-y divide-[#F1F5F9]">
                {props.audit.map((a) => (
                  <div key={a.id} className="px-5 py-2.5 flex items-center justify-between gap-3 text-sm">
                    <span className="text-[#475569]">{ACTION_LABELS[a.action] ?? a.action}<span className="text-[#94A3B8]"> · {a.actor_email}</span></span>
                    <span className="text-[11px] text-[#94A3B8] shrink-0">{format(new Date(a.created_at), 'd MMM yyyy HH:mm', { locale: fr })}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right: people, support, notes, danger */}
        <div className="space-y-6">
          <section className={cn(card, 'p-5 space-y-3')}>
            <p className={h2}>Propriétaire</p>
            <button className="text-sm text-[#475569] hover:text-[#0F6E56] flex items-center gap-1.5" onClick={() => { if (owner.email) { navigator.clipboard.writeText(owner.email); toast.success('Email copié') } }}>
              {owner.email ?? '—'} <Copy className="w-3 h-3 opacity-50" />
            </button>
            <p className="text-xs text-[#94A3B8]">Compte créé {ago(owner.createdAt)} · dernière connexion {ago(owner.lastSignIn)}</p>
            <div className="h-px bg-[#F1F5F9]" />
            <div className="flex items-center gap-2"><Users className="w-4 h-4 text-[#94A3B8]" /><p className="text-xs font-semibold text-[#64748B]">Équipe ({staff.length})</p></div>
            {staff.map((s) => (
              <div key={s.id} className="text-xs">
                <p className={cn('font-medium', s.is_active ? 'text-[#0A1F1C]' : 'text-[#CBD5E1] line-through')}>{s.name} <span className="font-normal text-[#94A3B8]">· {ROLE_LABELS[s.role] ?? s.role}</span></p>
                <p className="text-[#94A3B8]">{s.email ?? 'sans compte'} · {ago(s.last_sign_in_at)}</p>
              </div>
            ))}
          </section>

          <section className={cn(card, 'p-5 space-y-3')}>
            <p className={h2}>Support</p>
            <Button
              variant="outline"
              className="w-full justify-start rounded-xl"
              disabled={!!busy || !props.canUseStrictActions}
              title={props.canUseStrictActions ? undefined : 'Définissez SUPERADMIN_USER_IDS dans Vercel'}
              onClick={() => makeLink('recovery')}
            >
              {spinner('recovery') ?? <KeyRound className="w-4 h-4" />} Lien de nouveau mot de passe
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start rounded-xl"
              disabled={!!busy || !props.canUseStrictActions}
              title={props.canUseStrictActions ? undefined : 'Définissez SUPERADMIN_USER_IDS dans Vercel'}
              onClick={() => makeLink('login')}
            >
              {spinner('login') ?? <LogIn className="w-4 h-4" />} Se connecter en tant que propriétaire
            </Button>
            {props.canUseStrictActions ? (
              <a href={`/api/admin/tenants/${property.id}/export`} className="flex items-center gap-2 h-9 px-3 rounded-xl border border-[#E8ECF0] text-sm text-[#0A1F1C] hover:bg-[#F8FAFC]">
                <Download className="w-4 h-4" /> Exporter toutes les données (JSON)
              </a>
            ) : (
              <span className="flex items-center gap-2 h-9 px-3 rounded-xl border border-[#E8ECF0] text-sm text-[#CBD5E1] cursor-not-allowed">
                <Download className="w-4 h-4" /> Exporter toutes les données (JSON)
              </span>
            )}
            {!props.canUseStrictActions && (
              <p className="text-[11px] text-[#94A3B8]">Ces outils (et la suppression) donnent accès au compte et aux pièces d&apos;identité des clients : ils exigent votre identifiant dans <code>SUPERADMIN_USER_IDS</code> (Vercel).</p>
            )}
            {generatedLink && (
              <div className="rounded-xl bg-[#F8FAFC] border border-[#E8ECF0] p-3 space-y-2">
                <p className="text-[11px] text-[#475569]">
                  {generatedLink.kind === 'recovery'
                    ? 'Envoyez ce lien au client : il choisira un nouveau mot de passe. Usage unique, expire en 1 h.'
                    : 'Ouvrez ce lien dans une fenêtre privée : l’ouvrir ici remplace votre session admin. Usage unique, expire en 1 h.'}
                </p>
                <Input readOnly value={generatedLink.url} className="h-8 text-[11px] font-mono" onFocus={(e) => e.currentTarget.select()} />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="rounded-lg" onClick={() => { navigator.clipboard.writeText(generatedLink.url); toast.success('Lien copié') }}>
                    <Copy className="w-3.5 h-3.5" /> Copier
                  </Button>
                  {generatedLink.kind === 'recovery' && waLink(property.phone) && (
                    <a
                      className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-[#25D366]/30 text-[#1da851] text-xs font-medium"
                      href={waLink(property.phone, `Voici votre lien pour choisir un nouveau mot de passe Sweet Reservation (valable 1 h) : ${generatedLink.url}`)!}
                      target="_blank" rel="noreferrer"
                    >
                      <MessageCircle className="w-3.5 h-3.5" /> Envoyer
                    </a>
                  )}
                </div>
              </div>
            )}
          </section>

          <section className={cn(card, 'p-5 space-y-3')}>
            <p className={h2}>Notes internes</p>
            <textarea
              className="w-full min-h-28 rounded-xl border border-[#E8ECF0] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6E56]/20"
              placeholder="Contexte client, négociation, rappels… (visible uniquement par vous)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={migrationMissing}
            />
            <Button size="sm" className="rounded-xl bg-[#0A1F1C]" disabled={!!busy || migrationMissing} onClick={() => run('save_notes', { notes }, 'Notes enregistrées')}>
              {spinner('save_notes') ?? <Save className="w-3.5 h-3.5" />} Enregistrer
            </Button>
          </section>

          <section className={cn(card, 'p-5 space-y-3')}>
            <p className={h2}>Infos de l&apos;établissement</p>
            {([
              ['name', 'Nom'], ['city', 'Ville'], ['phone', 'Téléphone'], ['email', 'Email'], ['address', 'Adresse'],
            ] as const).map(([k, label]) => (
              <label key={k} className="block space-y-1">
                <span className="text-[11px] text-[#94A3B8]">{label}</span>
                <Input className="h-9 rounded-xl" value={info[k]} onChange={(e) => setInfo({ ...info, [k]: e.target.value })} />
              </label>
            ))}
            <Button size="sm" variant="outline" className="rounded-xl" disabled={!!busy} onClick={() => run('update_property', { property: info }, 'Infos mises à jour')}>
              {spinner('update_property') ?? <Save className="w-3.5 h-3.5" />} Enregistrer
            </Button>
          </section>

          <section className={cn(card, 'p-5 space-y-3 border-red-100')}>
            <p className={cn(h2, 'text-red-700')}>Zone sensible</p>
            {suspended ? (
              <Button variant="outline" className="w-full justify-start rounded-xl text-[#0F6E56]" disabled={!!busy || migrationMissing} onClick={() => run('unsuspend', {}, 'Compte réactivé')}>
                {spinner('unsuspend') ?? <PlayCircle className="w-4 h-4" />} Réactiver le compte
              </Button>
            ) : (
              <div className="space-y-2">
                <Input className="h-9 rounded-xl" placeholder="Raison (affichée au client)" value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} disabled={migrationMissing} />
                <Button variant="outline" className="w-full justify-start rounded-xl text-orange-600" disabled={!!busy || migrationMissing} onClick={() => run('suspend', { reason: suspendReason }, 'Compte suspendu')}>
                  {spinner('suspend') ?? <PauseCircle className="w-4 h-4" />} Suspendre le compte
                </Button>
              </div>
            )}
            <div className="h-px bg-[#F1F5F9]" />
            <p className="text-[11px] text-[#94A3B8]">
              Supprime définitivement l&apos;établissement, toutes ses données (clients, réservations, paiements…) et les comptes de l&apos;équipe. Exportez d&apos;abord. Tapez « {property.name} » pour confirmer.
            </p>
            <Input className="h-9 rounded-xl" placeholder={property.name} value={deleteName} onChange={(e) => setDeleteName(e.target.value)} disabled={!props.canUseStrictActions} />
            <Button
              variant="outline"
              className="w-full justify-start rounded-xl text-red-600 border-red-200 hover:bg-red-50"
              disabled={!!busy || !props.canUseStrictActions || deleteName.trim() !== property.name}
              onClick={async () => {
                setBusy('delete_tenant')
                try {
                  const res = await tenantAction<{ failedUsers: string[] }>(property.id, 'delete_tenant', { confirmName: deleteName })
                  toast.success(res.failedUsers.length ? `Supprimé (${res.failedUsers.length} compte(s) à supprimer à la main)` : 'Client supprimé')
                  router.push('/admin')
                  router.refresh()
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Erreur')
                  setBusy(null)
                }
              }}
            >
              {spinner('delete_tenant') ?? <Trash2 className="w-4 h-4" />} Supprimer définitivement
            </Button>
          </section>
        </div>
      </div>

      {payOpen && (
        <PaymentDialog
          open
          onOpenChange={setPayOpen}
          propertyId={property.id}
          propertyName={property.name}
          defaultVariant={sub?.ls_variant_id ?? null}
          onDone={() => router.refresh()}
        />
      )}
    </div>
  )
}
