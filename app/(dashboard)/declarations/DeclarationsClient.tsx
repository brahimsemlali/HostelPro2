'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  ChevronLeft, ChevronRight, Download, FileSpreadsheet, FileText, Landmark, Globe2,
  BookUser, Package, Loader2, AlertTriangle, Info,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { addDaysISO, dateOfInstant, diffDaysISO, rangeUTC, todayISO } from '@/lib/dates'
import { downloadBlob, downloadCsv } from '@/lib/csv'
import { formatAmount, INVOICE_COLUMNS, type Invoice, type PropertyLegal } from '@/lib/invoicing'
import {
  buildAccountingPackFiles, computeStayStats, isResident, monthRange, statsToCsv, touristTaxDue,
  type PackExpense, type PackPayment, type StayRow, type StayStats,
} from '@/lib/declarations'
import { monthLabel, type DeclarationProperty, type RegisterRow } from '@/lib/pdf/declarations'
import type { Booking, Guest } from '@/types'

type Props = {
  property: { id: string; name: string; city: string; address: string | null; police_prefecture: string | null }
  legal: PropertyLegal | null
  invoicingAvailable: boolean
  isOwner: boolean
}

type Tab = 'tax' | 'stats' | 'register' | 'pack'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'tax', label: 'Taxe de séjour', icon: Landmark },
  { id: 'stats', label: 'Statistiques', icon: Globe2 },
  { id: 'register', label: 'Registre de police', icon: BookUser },
  { id: 'pack', label: 'Pack comptable', icon: Package },
]

const MAX_REGISTER_DAYS = 92
const card = 'bg-white border border-[#E8ECF0] rounded-[16px] shadow-[0_1px_4px_rgba(0,0,0,0.04)]'
const mad = (n: number) => `${formatAmount(n)} MAD`
const frDate = (iso: string) => iso.split('-').reverse().join('/')

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Supabase returns embedded to-one relations as an object or a 1-item array. */
function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
}

async function savePdf(build: () => Promise<{ save: (name: string) => void }>, name: string) {
  try {
    const doc = await build()
    doc.save(name)
  } catch {
    toast.error('Impossible de générer le PDF')
  }
}

export function DeclarationsClient({ property, legal, invoicingAvailable, isOwner }: Props) {
  const today = todayISO()
  // Declarations are filed for the month that just ended.
  const [month, setMonth] = useState(() => shiftMonth(today.slice(0, 7), -1))
  const [tab, setTab] = useState<Tab>('tax')

  const pdfProperty: DeclarationProperty = {
    name: property.name, city: property.city, address: legal?.legal_address || property.address,
    police_prefecture: property.police_prefecture, legal_name: legal?.legal_name, ice: legal?.ice, if_number: legal?.if_number,
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto bg-[#F4F6F8] min-h-full hp-page-in">
      <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-2 px-3.5 py-2 rounded-[10px] text-sm font-medium whitespace-nowrap transition-colors border',
              tab === id ? 'bg-[#0F6E56] text-white border-[#0F6E56]' : 'bg-white text-[#475569] border-[#E8ECF0] hover:border-[#0F6E56]/30',
            )}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {tab !== 'register' && (
        <div className="flex items-center gap-1 bg-white border border-[#E8ECF0] rounded-[12px] p-1 w-fit">
          <button aria-label="Mois précédent" className="p-1.5 rounded-[8px] hover:bg-[#F4F6F8]" onClick={() => setMonth((m) => shiftMonth(m, -1))}>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-2 text-sm font-medium text-[#0A1F1C] capitalize min-w-[130px] text-center">{monthLabel(month)}</span>
          <button aria-label="Mois suivant" className="p-1.5 rounded-[8px] hover:bg-[#F4F6F8] disabled:opacity-30"
            disabled={month >= today.slice(0, 7)} onClick={() => setMonth((m) => shiftMonth(m, 1))}>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {(tab === 'tax' || tab === 'stats') && (
        <StaysPanel tab={tab} month={month} today={today} propertyId={property.id} pdfProperty={pdfProperty}
          rate={legal?.tourist_tax_per_night ?? 0} invoicingAvailable={invoicingAvailable} isOwner={isOwner} />
      )}
      {tab === 'register' && <RegisterPanel propertyId={property.id} pdfProperty={pdfProperty} today={today} />}
      {tab === 'pack' && <PackPanel month={month} propertyId={property.id} propertyName={property.name} invoicingAvailable={invoicingAvailable} />}
    </div>
  )
}

// ── Taxe de séjour + tourism statistics (same data) ─────────────────────────
function StaysPanel({ tab, month, today, propertyId, pdfProperty, rate, invoicingAvailable, isOwner }: {
  tab: 'tax' | 'stats'; month: string; today: string; propertyId: string; pdfProperty: DeclarationProperty
  rate: number; invoicingAvailable: boolean; isOwner: boolean
}) {
  const [stats, setStats] = useState<StayStats | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { start, end } = monthRange(month)
      const { data, error } = await createClient()
        .from('bookings')
        .select('check_in_date, check_out_date, adults, guest:guest_id(nationality, country_of_residence)')
        .eq('property_id', propertyId)
        .in('status', ['checked_in', 'checked_out'])
        .lt('check_in_date', end)
        .gt('check_out_date', start)
        .limit(5000)
      if (error) throw error
      const rows: StayRow[] = (data ?? []).map((b) => {
        const g = one(b.guest as { nationality: string | null; country_of_residence: string | null } | { nationality: string | null; country_of_residence: string | null }[] | null)
        return { check_in_date: b.check_in_date, check_out_date: b.check_out_date, adults: b.adults, nationality: g?.nationality ?? null, country_of_residence: g?.country_of_residence ?? null }
      })
      setStats(computeStayStats(rows, month, today))
    } catch {
      toast.error('Impossible de charger les séjours')
      setStats(null)
    } finally {
      setLoading(false)
    }
  }, [month, today, propertyId])

  useEffect(() => { load() }, [load])

  if (loading) return <div className={cn(card, 'h-56 animate-pulse')} />
  if (!stats) return null

  const due = touristTaxDue(stats.nights, rate)
  const provisional = stats.provisional && (
    <div className="flex gap-2 p-3 rounded-[12px] bg-amber-50 border border-amber-200 text-amber-800 text-sm">
      <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
      Mois en cours : chiffres provisoires, nuitées comptées jusqu&apos;au {frDate(stats.countedUntil)} inclus.
    </div>
  )
  const base = `${tab === 'tax' ? 'taxe-sejour' : 'statistiques'}-${month}`

  if (tab === 'tax') {
    return (
      <div className="space-y-4">
        {provisional}
        {(!invoicingAvailable || rate <= 0) && (
          <div className="flex gap-2 p-3 rounded-[12px] bg-amber-50 border border-amber-200 text-amber-800 text-sm">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              {!invoicingAvailable ? 'Le taux n’est pas encore configurable (migration 034).' : 'Aucun taux de taxe de séjour enregistré.'}{' '}
              {isOwner && invoicingAvailable
                ? <Link href="/settings/invoicing" className="font-medium underline">Renseigner le taux par nuitée</Link>
                : 'Les nuitées ci-dessous restent exactes.'}
            </span>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Kpi label="Nuitées" value={String(stats.nights)} sub={`${stats.arrivals} arrivée(s)`} />
          <Kpi label="Taux" value={rate > 0 ? mad(rate) : '-'} sub="par personne et par nuit" />
          <Kpi label="Montant à déclarer" value={rate > 0 ? mad(due) : '-'} sub={monthLabel(month)} highlight />
        </div>
        <div className={cn(card, 'divide-y divide-[#E8ECF0]')}>
          <Row label="Résidents (Maroc)" a={stats.residents.arrivals} n={stats.residents.nights} amount={rate > 0 ? mad(touristTaxDue(stats.residents.nights, rate)) : '-'} />
          <Row label="Non-résidents" a={stats.nonResidents.arrivals} n={stats.nonResidents.nights} amount={rate > 0 ? mad(touristTaxDue(stats.nonResidents.nights, rate)) : '-'} />
        </div>
        <p className="text-xs text-[#94A3B8]">
          Nuitée = une personne pour une nuit, comptée dans le mois où elle tombe. Résident = pays de résidence Maroc (à défaut : nationalité marocaine).
          Vérifiez les exonérations (mineurs…) auprès de votre commune.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button className="bg-[#0F6E56] hover:bg-[#0c5a46]" disabled={rate <= 0}
            onClick={() => savePdf(async () => (await import('@/lib/pdf/declarations')).buildTouristTaxPdf(stats, rate, pdfProperty), `${base}.pdf`)}>
            <FileText className="w-4 h-4 mr-1.5" />Récapitulatif PDF
          </Button>
          <Button variant="outline" onClick={() => downloadCsv(statsToCsv(stats, rate > 0 ? rate : null), `${base}.csv`)}>
            <FileSpreadsheet className="w-4 h-4 mr-1.5" />CSV
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {provisional}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Arrivées" value={String(stats.arrivals)} sub="clients arrivés dans le mois" />
        <Kpi label="Nuitées" value={String(stats.nights)} sub="personnes × nuits" />
        <Kpi label="Résidents" value={String(stats.residents.nights)} sub={`${stats.residents.arrivals} arrivée(s)`} />
        <Kpi label="Non-résidents" value={String(stats.nonResidents.nights)} sub={`${stats.nonResidents.arrivals} arrivée(s)`} />
      </div>
      <div className={card}>
        {stats.byNationality.length === 0 ? (
          <Empty icon={Globe2} title={`Aucun séjour en ${monthLabel(month)}`} text="Les statistiques se basent sur les clients enregistrés (check-in effectué)." />
        ) : (
          <div className="divide-y divide-[#E8ECF0]">
            <div className="grid grid-cols-[1fr_80px_80px] gap-2 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-[#94A3B8]">
              <span>Nationalité</span><span className="text-right">Arrivées</span><span className="text-right">Nuitées</span>
            </div>
            {stats.byNationality.map((n) => (
              <div key={n.nationality} className="grid grid-cols-[1fr_80px_80px] gap-2 px-4 py-2.5 text-sm">
                <span className={cn('truncate', n.nationality === 'Non renseignée' ? 'text-[#94A3B8] italic' : 'text-[#0A1F1C]')}>{n.nationality}</span>
                <span className="text-right tabular-nums text-[#475569]">{n.arrivals}</span>
                <span className="text-right tabular-nums font-medium">{n.nights}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button className="bg-[#0F6E56] hover:bg-[#0c5a46]" disabled={stats.byNationality.length === 0}
          onClick={() => savePdf(async () => (await import('@/lib/pdf/declarations')).buildTourismStatsPdf(stats, pdfProperty), `${base}.pdf`)}>
          <FileText className="w-4 h-4 mr-1.5" />Récapitulatif PDF
        </Button>
        <Button variant="outline" disabled={stats.byNationality.length === 0} onClick={() => downloadCsv(statsToCsv(stats, null), `${base}.csv`)}>
          <FileSpreadsheet className="w-4 h-4 mr-1.5" />CSV
        </Button>
      </div>
    </div>
  )
}

// ── Police register ─────────────────────────────────────────────────────────
type RegisterBooking = {
  id: string; check_in_date: string; check_out_date: string; status: string
  guest: Guest | Guest[] | null
  bed: { name: string; room: { name: string } | { name: string }[] | null } | { name: string; room: { name: string } | { name: string }[] | null }[] | null
}

function RegisterPanel({ propertyId, pdfProperty, today }: { propertyId: string; pdfProperty: DeclarationProperty; today: string }) {
  const [from, setFrom] = useState(() => `${today.slice(0, 7)}-01`)
  const [to, setTo] = useState(today)
  const [foreignOnly, setForeignOnly] = useState(false)
  const [rows, setRows] = useState<{ booking: RegisterBooking; guest: Guest; bed: string | null }[] | null>(null)
  const [loading, setLoading] = useState(false)

  const span = diffDaysISO(from, to)
  const rangeError = !from || !to ? 'Choisissez deux dates.' : span < 0 ? 'La date de fin précède la date de début.' : span > MAX_REGISTER_DAYS ? `Période limitée à ${MAX_REGISTER_DAYS} jours.` : null

  const load = useCallback(async () => {
    if (rangeError) return
    setLoading(true)
    try {
      const { data, error } = await createClient()
        .from('bookings')
        .select('id, check_in_date, check_out_date, status, guest:guest_id(id, first_name, last_name, nationality, document_type, document_number, date_of_birth, gender, profession, country_of_residence, address_in_morocco, next_destination), bed:bed_id(name, room:room_id(name))')
        .eq('property_id', propertyId)
        .in('status', ['checked_in', 'checked_out'])
        .gte('check_in_date', from)
        .lte('check_in_date', to)
        .order('check_in_date')
        .limit(2000)
      if (error) throw error
      const list = ((data ?? []) as unknown as RegisterBooking[]).flatMap((b) => {
        const guest = one(b.guest)
        if (!guest) return []
        const bed = one(b.bed)
        const room = one(bed?.room ?? null)
        return [{ booking: b, guest, bed: bed ? [room?.name, bed.name].filter(Boolean).join(' - ') : null }]
      })
      setRows(list)
    } catch {
      toast.error('Impossible de charger les voyageurs')
    } finally {
      setLoading(false)
    }
  }, [from, to, propertyId, rangeError])

  useEffect(() => { load() }, [load])

  // Foreign = non-Moroccan nationality (residence does not matter for the police register).
  const visible = (rows ?? []).filter((r) => !foreignOnly || !isResident({ nationality: r.guest.nationality, country_of_residence: null }))

  const registerRows: RegisterRow[] = visible.map((r) => ({
    check_in_date: r.booking.check_in_date, check_out_date: r.booking.check_out_date,
    first_name: r.guest.first_name, last_name: r.guest.last_name, nationality: r.guest.nationality,
    document_type: r.guest.document_type, document_number: r.guest.document_number, date_of_birth: r.guest.date_of_birth,
    gender: r.guest.gender, profession: r.guest.profession, country_of_residence: r.guest.country_of_residence,
    next_destination: r.guest.next_destination, bed: r.bed,
  }))
  const incomplete = visible.filter((r) => !r.guest.document_number || !r.guest.date_of_birth || !r.guest.nationality).length
  const suffix = `${from}_${to}`

  return (
    <div className="space-y-4">
      <div className={cn(card, 'p-4 flex flex-wrap items-end gap-3')}>
        <div className="space-y-1"><Label className="text-xs">Arrivées du</Label>
          <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-10 w-[160px]" /></div>
        <div className="space-y-1"><Label className="text-xs">au</Label>
          <Input type="date" value={to} min={from} max={addDaysISO(today, 1)} onChange={(e) => setTo(e.target.value)} className="h-10 w-[160px]" /></div>
        <div className="flex rounded-[10px] border border-[#E8ECF0] p-0.5 h-10">
          {([false, true] as const).map((v) => (
            <button key={String(v)} onClick={() => setForeignOnly(v)}
              className={cn('px-3 rounded-[8px] text-sm', foreignOnly === v ? 'bg-[#0F6E56] text-white' : 'text-[#475569]')}>
              {v ? 'Étrangers' : 'Tous'}
            </button>
          ))}
        </div>
      </div>

      {rangeError && <p className="text-sm text-red-600">{rangeError}</p>}

      {!rangeError && (loading ? <div className={cn(card, 'h-40 animate-pulse')} /> : (
        <>
          {incomplete > 0 && (
            <div className="flex gap-2 p-3 rounded-[12px] bg-amber-50 border border-amber-200 text-amber-800 text-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {incomplete} fiche(s) incomplète(s) : document, date de naissance ou nationalité manquant. Complétez-les depuis la fiche client.
            </div>
          )}
          <div className={card}>
            {visible.length === 0 ? (
              <Empty icon={BookUser} title="Aucun voyageur sur cette période" text="Le registre liste les clients dont le check-in a été effectué." />
            ) : (
              <div className="divide-y divide-[#E8ECF0] max-h-[420px] overflow-y-auto">
                {visible.map((r) => (
                  <Link key={r.booking.id} href={`/guests/${r.guest.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#F8FAFC]">
                    <span className="text-xs tabular-nums text-[#94A3B8] w-[78px]">{frDate(r.booking.check_in_date)}</span>
                    <span className="flex-1 min-w-0 text-sm truncate">
                      <span className="font-medium">{(r.guest.last_name ?? '').toUpperCase()}</span> {r.guest.first_name}
                    </span>
                    <span className="hidden sm:block text-xs text-[#475569] w-[110px] truncate">{r.guest.nationality ?? '-'}</span>
                    <span className={cn('text-xs w-[110px] truncate text-right', r.guest.document_number ? 'text-[#475569]' : 'text-amber-600')}>
                      {r.guest.document_number ?? 'document manquant'}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button className="bg-[#0F6E56] hover:bg-[#0c5a46]" disabled={visible.length === 0}
              onClick={() => savePdf(async () => (await import('@/lib/pdf/declarations')).buildPoliceRegisterPdf(registerRows, pdfProperty, from, to, foreignOnly), `registre-voyageurs-${suffix}.pdf`)}>
              <FileText className="w-4 h-4 mr-1.5" />Registre PDF ({visible.length})
            </Button>
            <Button variant="outline" disabled={visible.length === 0} onClick={async () => {
              try {
                const { generateBatchFiches } = await import('@/lib/pdf/fiche-police')
                await generateBatchFiches(visible.map((r) => ({ guest: r.guest, booking: r.booking as unknown as Booking })), {
                  name: pdfProperty.name, city: pdfProperty.city ?? '', police_prefecture: pdfProperty.police_prefecture ?? null,
                })
              } catch {
                toast.error('Impossible de générer les fiches')
              }
            }}>
              <Download className="w-4 h-4 mr-1.5" />Fiches individuelles
            </Button>
          </div>
        </>
      ))}
    </div>
  )
}

// ── Accounting pack ─────────────────────────────────────────────────────────
function PackPanel({ month, propertyId, propertyName, invoicingAvailable }: {
  month: string; propertyId: string; propertyName: string; invoicingAvailable: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)

  async function build() {
    setBusy(true)
    setProgress('Chargement des données…')
    try {
      const supabase = createClient()
      const { start, end } = monthRange(month)
      const pay = rangeUTC(start, addDaysISO(end, -1))
      const [invRes, payRes, expRes] = await Promise.all([
        invoicingAvailable
          ? supabase.from('invoices').select(INVOICE_COLUMNS).eq('property_id', propertyId).gte('issue_date', start).lt('issue_date', end).limit(2000)
          : Promise.resolve({ data: [], error: null }),
        supabase.from('payments').select('payment_date, amount, type, method, status, reference, guest:guest_id(first_name, last_name)')
          .eq('property_id', propertyId).gte('payment_date', pay.start).lt('payment_date', pay.end).order('payment_date').limit(5000),
        supabase.from('expenses').select('expense_date, category, description, amount, payment_method, notes')
          .eq('property_id', propertyId).gte('expense_date', start).lt('expense_date', end).order('expense_date').limit(5000),
      ])
      if (payRes.error) throw payRes.error
      if (expRes.error) throw expRes.error
      if (invRes.error) toast.warning('Factures non incluses (facturation non activée).')

      const invoices = (invRes.error ? [] : (invRes.data ?? [])) as unknown as Invoice[]
      if (invoices.length >= 2000) toast.warning('Plus de 2000 factures : seules les 2000 premières sont incluses.')

      const payments: PackPayment[] = (payRes.data ?? []).map((p) => {
        const g = one(p.guest as { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null)
        return { payment_date: p.payment_date, amount: Number(p.amount), type: p.type, method: p.method, status: p.status, reference: p.reference, guest_name: g ? `${g.first_name} ${g.last_name}` : null }
      })
      const expenses = (expRes.data ?? []).map((e) => ({ ...e, amount: Number(e.amount) })) as PackExpense[]

      const { buildFacturePdf } = await import('@/lib/pdf/facture')
      const files = await buildAccountingPackFiles({
        month, propertyName, invoices, payments, expenses,
        dateOf: (iso) => dateOfInstant(iso),
        invoicePdf: async (inv) => (await buildFacturePdf(inv)).output('arraybuffer'),
        onProgress: (d, t) => setProgress(`Factures PDF : ${d} / ${t}`),
      })
      setProgress('Compression…')
      const { zipSync } = await import('fflate')
      const zip = zipSync(files, { level: 6 })
      const slug = propertyName.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      downloadBlob(new Blob([zip as BlobPart], { type: 'application/zip' }), `pack-comptable-${slug || 'hostel'}-${month}.zip`)
      toast.success(`Pack ${monthLabel(month)} téléchargé : ${invoices.length} facture(s), ${payments.length} encaissement(s), ${expenses.length} dépense(s)`)
    } catch {
      toast.error('Impossible de préparer le pack comptable')
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  const items = [
    ['synthese.csv', 'Facturé (HT, TVA, TTC), encaissé par mode, dépenses par catégorie, résultat de trésorerie'],
    ['journal-ventes.csv', 'Toutes les factures et avoirs du mois, dans l’ordre'],
    ['encaissements.csv', 'Chaque paiement et remboursement, avec mode et référence'],
    ['depenses.csv', 'Les dépenses saisies dans l’app'],
    ['factures/', 'Le PDF de chaque facture et avoir'],
  ]

  return (
    <div className="space-y-4">
      <div className={cn(card, 'p-5')}>
        <p className="text-[15px] font-semibold text-[#0A1F1C]">Tout ce que votre comptable demande, en un fichier</p>
        <p className="text-sm text-[#94A3B8] mt-1 mb-4">Un ZIP pour {monthLabel(month)}, à envoyer par e-mail ou WhatsApp.</p>
        <ul className="space-y-2 mb-5">
          {items.map(([f, d]) => (
            <li key={f} className="flex gap-3 text-sm">
              <code className="text-[12px] text-[#0F6E56] bg-[#0F6E56]/5 px-1.5 py-0.5 rounded h-fit whitespace-nowrap">{f}</code>
              <span className="text-[#475569]">{d}</span>
            </li>
          ))}
        </ul>
        {!invoicingAvailable && (
          <p className="text-xs text-amber-700 mb-3">La facturation n&apos;est pas encore activée : le pack contiendra les encaissements et les dépenses uniquement.</p>
        )}
        <Button className="bg-[#0F6E56] hover:bg-[#0c5a46]" onClick={build} disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Package className="w-4 h-4 mr-1.5" />}
          {busy ? progress : 'Télécharger le pack (.zip)'}
        </Button>
      </div>
    </div>
  )
}

// ── small pieces ────────────────────────────────────────────────────────────
function Kpi({ label, value, sub, highlight }: { label: string; value: string; sub: string; highlight?: boolean }) {
  return (
    <div className={cn(card, 'p-4', highlight && 'border-[#0F6E56]/30 bg-[#0F6E56]/[0.03]')}>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-[#94A3B8]">{label}</p>
      <p className={cn('text-lg font-black mt-1 tabular-nums', highlight ? 'text-[#0F6E56]' : 'text-[#0A1F1C]')}>{value}</p>
      <p className="text-[11px] text-[#94A3B8]">{sub}</p>
    </div>
  )
}

function Row({ label, a, n, amount }: { label: string; a: number; n: number; amount: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 text-sm">
      <span className="flex-1 text-[#0A1F1C]">{label}</span>
      <span className="hidden sm:block text-[#94A3B8] text-xs w-[90px] text-right">{a} arrivée(s)</span>
      <span className="tabular-nums w-[80px] text-right">{n} nuitées</span>
      <span className="tabular-nums w-[110px] text-right font-medium">{amount}</span>
    </div>
  )
}

function Empty({ icon: Icon, title, text }: { icon: React.ElementType; title: string; text: string }) {
  return (
    <div className="flex flex-col items-center text-center py-12 px-6">
      <div className="w-12 h-12 rounded-full bg-[#0F6E56]/10 flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-[#0F6E56]" />
      </div>
      <p className="font-medium text-[#0A1F1C]">{title}</p>
      <p className="text-sm text-[#94A3B8] mt-1 max-w-sm">{text}</p>
    </div>
  )
}
