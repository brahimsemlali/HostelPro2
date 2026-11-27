'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { FileCheck2, FileX2, Download, Loader2, AlertTriangle, Building2, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { round2 } from '@/lib/money'
import { logActivity } from '@/lib/activity'
import { useSession } from '@/app/context/SessionContext'
import {
  computeInvoice, formatAmount, invoiceErrorMessage, isValidIce, missingLegalFields,
  type Invoice, type PropertyLegal,
} from '@/lib/invoicing'

type Props = {
  booking: { id: string; property_id: string; total_price: number; nights: number; adults: number }
  bedLabel: string | null
  guestName: string
  extras: readonly { name: string; quantity: number; unit_price: number }[]
  legal: PropertyLegal | null
  invoices: Invoice[]
}

const fmtDate = (d: string) => d.slice(0, 10).split('-').reverse().join('/')
const mad = (n: number) => `${formatAmount(n)} MAD`

async function download(inv: Invoice) {
  try {
    const { downloadFacturePdf } = await import('@/lib/pdf/facture')
    await downloadFacturePdf(inv)
  } catch {
    toast.error('Impossible de générer le PDF')
  }
}

export function BookingInvoiceCard({ booking, bedLabel, guestName, extras, legal, invoices }: Props) {
  const router = useRouter()
  const session = useSession()
  // Mirrors invoice_caller_rank() in migration 034.
  const rank = session?.isOwner || session?.role === 'owner' ? 4 : session?.role === 'manager' ? 3 : 2
  const [issueOpen, setIssueOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [asCompany, setAsCompany] = useState(false)
  const [company, setCompany] = useState({ company_name: '', company_ice: '', company_address: '' })
  const [reason, setReason] = useState('')

  const active = invoices.find((i) => i.kind === 'invoice' && !i.cancelled_at) ?? null
  const history = invoices.filter((i) => i !== active)
  const missing = missingLegalFields(legal)

  const computed = useMemo(() => computeInvoice({
    accommodationLabel: `Hébergement${bedLabel ? ` - ${bedLabel}` : ''}`,
    nights: booking.nights,
    adults: booking.adults,
    accommodationTtc: booking.total_price,
    extras,
    legal,
  }), [booking.nights, booking.adults, booking.total_price, bedLabel, extras, legal])

  const outOfDate = active && Math.abs(round2(active.total_ttc) - computed.totals.total_ttc) > 0.009
  const companyIceBad = asCompany && company.company_ice.trim() !== '' && !isValidIce(company.company_ice)

  async function handleIssue() {
    if (asCompany && !company.company_name.trim()) return toast.error('Indiquez le nom de la société.')
    if (companyIceBad) return toast.error('ICE client invalide (15 chiffres).')
    setBusy(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('issue_invoice', {
        p_booking_id: booking.id,
        p_lines: computed.lines,
        p_totals: computed.totals,
        p_company: asCompany ? company : null,
      })
      if (error) throw error
      const inv = data as Invoice
      toast.success(`Facture ${inv.number} émise`)
      logActivity({
        propertyId: booking.property_id, userId: session?.userId ?? null, staffName: session?.staffName ?? null,
        actionType: 'invoice_issued', entityType: 'booking', entityId: booking.id,
        description: `Facture ${inv.number} : ${guestName}`, meta: { number: inv.number, total_ttc: inv.total_ttc },
      })
      setIssueOpen(false)
      await download(inv)
      router.refresh()
    } catch (err) {
      toast.error(invoiceErrorMessage(err as { message?: string; code?: string }))
    } finally {
      setBusy(false)
    }
  }

  async function handleCancel() {
    if (!active) return
    if (!reason.trim()) return toast.error('Indiquez le motif de l\'avoir.')
    setBusy(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('issue_credit_note', { p_invoice_id: active.id, p_reason: reason.trim() })
      if (error) throw error
      const avoir = data as Invoice
      toast.success(`Avoir ${avoir.number} émis, facture ${active.number} annulée`)
      logActivity({
        propertyId: booking.property_id, userId: session?.userId ?? null, staffName: session?.staffName ?? null,
        actionType: 'credit_note_issued', entityType: 'booking', entityId: booking.id,
        description: `Avoir ${avoir.number} (annule ${active.number}) : ${guestName}`, meta: { number: avoir.number, reason: reason.trim() },
      })
      setCancelOpen(false)
      setReason('')
      await download(avoir)
      router.refresh()
    } catch (err) {
      toast.error(invoiceErrorMessage(err as { message?: string; code?: string }))
    } finally {
      setBusy(false)
    }
  }

  const t = computed.totals

  return (
    <Card className="bg-white border border-[#E8ECF0] rounded-[16px] shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
      <CardHeader className="pb-3">
        <CardTitle className="text-[11px] font-semibold uppercase tracking-widest text-[#94A3B8]">Facturation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {active ? (
          <div className="flex flex-wrap items-center gap-3">
            <FileCheck2 className="w-5 h-5 text-[#0F6E56]" />
            <div className="flex-1 min-w-[160px]">
              <p className="text-sm font-medium text-[#0A1F1C]">Facture {active.number}</p>
              <p className="text-xs text-[#94A3B8]">Émise le {fmtDate(active.issue_date)} · {mad(active.total_ttc)}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => download(active)}>
              <Download className="w-3 h-3 mr-1" />PDF
            </Button>
            {rank >= 3 && (
              <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setCancelOpen(true)}>
                <FileX2 className="w-3 h-3 mr-1" />Annuler par avoir
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="flex-1 min-w-[160px] text-sm text-[#475569]">
              Aucune facture. Total à facturer : <span className="font-medium text-[#0A1F1C]">{mad(t.total_ttc)}</span>
            </p>
            <Button size="sm" className="bg-[#0F6E56] hover:bg-[#0c5a46]" onClick={() => setIssueOpen(true)}>
              <FileCheck2 className="w-3 h-3 mr-1" />Émettre la facture
            </Button>
          </div>
        )}

        {outOfDate && (
          <div className="flex gap-2 p-3 rounded-[10px] bg-amber-50 border border-amber-200 text-amber-800 text-xs">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>
              La réservation a changé depuis la facture ({mad(active.total_ttc)} facturé, {mad(t.total_ttc)} aujourd&apos;hui).
              {rank >= 3 ? ' Annulez-la par un avoir puis émettez une nouvelle facture.' : ' Demandez à un responsable d’émettre un avoir.'}
            </span>
          </div>
        )}

        {history.length > 0 && (
          <div className="border-t border-[#E8ECF0] pt-2 space-y-1">
            {history.map((i) => (
              <button key={i.id} onClick={() => download(i)}
                className="w-full flex items-center justify-between text-xs py-1.5 px-1 rounded hover:bg-[#F8FAFC] text-left">
                <span className={cn(i.cancelled_at && 'line-through text-[#94A3B8]')}>
                  {i.kind === 'credit_note' ? 'Avoir' : 'Facture'} {i.number} · {fmtDate(i.issue_date)}
                </span>
                <span className="flex items-center gap-2 text-[#475569]">{mad(i.total_ttc)}<Download className="w-3 h-3" /></span>
              </button>
            ))}
          </div>
        )}
      </CardContent>

      {/* Issue dialog */}
      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Émettre la facture</DialogTitle></DialogHeader>
          {missing.length > 0 ? (
            <div className="space-y-3">
              <div className="flex gap-2 p-3 rounded-[10px] bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Informations légales manquantes : {missing.join(', ')}.</span>
              </div>
              {session?.isOwner
                ? <Link href="/settings/invoicing" className="inline-flex text-sm font-medium text-[#0F6E56] hover:underline">Compléter dans Paramètres → Facturation</Link>
                : <p className="text-sm text-[#475569]">Demandez au propriétaire de les compléter.</p>}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-[10px] bg-[#F4F6F8] p-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-[#475569]">Client</span><span className="font-medium">{guestName}</span></div>
                {legal?.vat_registered && <>
                  <div className="flex justify-between text-[#475569]"><span>Total HT</span><span>{mad(t.total_ht)}</span></div>
                  <div className="flex justify-between text-[#475569]"><span>TVA</span><span>{mad(t.total_tva)}</span></div>
                </>}
                {t.tourist_tax > 0 && <div className="flex justify-between text-[#475569]"><span>Taxe de séjour</span><span>{mad(t.tourist_tax)}</span></div>}
                <div className="flex justify-between font-semibold pt-1 border-t border-[#E8ECF0]"><span>Total TTC</span><span>{mad(t.total_ttc)}</span></div>
              </div>

              <button type="button" onClick={() => setAsCompany((v) => !v)}
                className={cn('w-full flex items-center gap-2 px-3 py-2.5 rounded-[10px] border-2 text-sm text-left transition-colors',
                  asCompany ? 'border-[#0F6E56] bg-[#0F6E56]/5 text-[#0F6E56]' : 'border-[#E8ECF0] text-[#475569]')}>
                <Building2 className="w-4 h-4" />Facturer une société (agence, entreprise)
              </button>
              {asCompany && (
                <div className="space-y-3">
                  <div className="space-y-1"><Label className="text-xs">Raison sociale *</Label>
                    <Input value={company.company_name} onChange={(e) => setCompany((c) => ({ ...c, company_name: e.target.value }))} /></div>
                  <div className="space-y-1"><Label className="text-xs">ICE de la société</Label>
                    <Input value={company.company_ice} inputMode="numeric" placeholder="15 chiffres"
                      className={cn(companyIceBad && 'border-red-400')}
                      onChange={(e) => setCompany((c) => ({ ...c, company_ice: e.target.value }))} /></div>
                  <div className="space-y-1"><Label className="text-xs">Adresse</Label>
                    <Input value={company.company_address} onChange={(e) => setCompany((c) => ({ ...c, company_address: e.target.value }))} /></div>
                </div>
              )}

              <p className="flex gap-2 text-xs text-[#94A3B8]">
                <Lock className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
                Une facture reçoit un numéro définitif et ne peut plus être modifiée. Une erreur se corrige par un avoir.
              </p>
              <Button className="w-full bg-[#0F6E56] hover:bg-[#0c5a46]" onClick={handleIssue} disabled={busy}>
                {busy && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Émettre et télécharger
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Credit note dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Annuler la facture {active?.number}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-[#475569]">
              Un avoir de {active ? mad(-active.total_ttc) : ''} sera émis. Vous pourrez ensuite émettre une nouvelle facture corrigée.
            </p>
            <div className="space-y-1">
              <Label className="text-xs">Motif *</Label>
              <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. : erreur sur le nom, séjour écourté…" />
            </div>
            <Button className="w-full bg-red-600 hover:bg-red-700 text-white" onClick={handleCancel} disabled={busy}>
              {busy && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Émettre l&apos;avoir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
