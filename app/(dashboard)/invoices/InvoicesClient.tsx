'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Download, FileSpreadsheet, FileText, AlertTriangle, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { round2 } from '@/lib/money'
import { byIssueOrder, formatAmount, invoicesToCsv, type Invoice } from '@/lib/invoicing'
import { downloadCsv } from '@/lib/csv'

type Props = { month: string; invoices: Invoice[]; unavailable: boolean; isOwner: boolean }

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const mad = (n: number) => `${formatAmount(n)} MAD`
const fmtDate = (d: string) => d.slice(0, 10).split('-').reverse().join('/')

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export function InvoicesClient({ month, invoices, unavailable, isOwner }: Props) {
  const router = useRouter()
  const [y, m] = month.split('-').map(Number)
  const label = `${MONTHS[m - 1]} ${y}`

  // Avoirs carry negative amounts, so plain sums give the net figures to declare.
  const sum = (f: (i: Invoice) => number) => round2(invoices.reduce((s, i) => s + f(i), 0))
  const kpis = [
    { label: 'Factures émises', value: String(invoices.filter((i) => i.kind === 'invoice').length), sub: `${invoices.filter((i) => i.kind === 'credit_note').length} avoir(s)` },
    { label: 'Chiffre d’affaires HT', value: mad(sum((i) => i.total_ht)), sub: 'net des avoirs' },
    { label: 'TVA collectée', value: mad(sum((i) => i.total_tva)), sub: 'à déclarer' },
    { label: 'Taxe de séjour facturée', value: mad(sum((i) => i.tourist_tax)), sub: 'à déclarer : voir Administratif' },
  ]

  function exportCsv() {
    // Chronological order is what the accountant expects in a sales journal.
    const sorted = [...invoices].sort(byIssueOrder)
    downloadCsv(invoicesToCsv(sorted), `journal-ventes-${month}.csv`)
  }

  async function downloadPdf(inv: Invoice) {
    try {
      const { downloadFacturePdf } = await import('@/lib/pdf/facture')
      await downloadFacturePdf(inv)
    } catch {
      toast.error('Impossible de générer le PDF')
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto bg-[#F4F6F8] min-h-full hp-page-in">
      {unavailable && (
        <div className="flex gap-3 p-4 rounded-[14px] bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          La facturation n&apos;est pas encore activée sur cette base de données (migration 034).
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 bg-white border border-[#E8ECF0] rounded-[12px] p-1">
          <button aria-label="Mois précédent" className="p-1.5 rounded-[8px] hover:bg-[#F4F6F8]" onClick={() => router.push(`/invoices?month=${shiftMonth(month, -1)}`)}>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-2 text-sm font-medium text-[#0A1F1C] capitalize min-w-[130px] text-center">{label}</span>
          <button aria-label="Mois suivant" className="p-1.5 rounded-[8px] hover:bg-[#F4F6F8]" onClick={() => router.push(`/invoices?month=${shiftMonth(month, 1)}`)}>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1" />
        {isOwner && (
          <Link href="/settings/invoicing" className="inline-flex items-center gap-1.5 text-sm text-[#475569] hover:text-[#0F6E56] px-2">
            <Settings2 className="w-4 h-4" />Infos légales
          </Link>
        )}
        <Button variant="outline" onClick={exportCsv} disabled={invoices.length === 0}>
          <FileSpreadsheet className="w-4 h-4 mr-1.5" />Journal des ventes (CSV)
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white border border-[#E8ECF0] rounded-[16px] p-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#94A3B8]">{k.label}</p>
            <p className="text-lg font-black text-[#0A1F1C] mt-1 tabular-nums">{k.value}</p>
            <p className="text-[11px] text-[#94A3B8]">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-[#E8ECF0] rounded-[16px] shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-hidden">
        {invoices.length === 0 ? (
          <div className="flex flex-col items-center text-center py-14 px-6">
            <div className="w-12 h-12 rounded-full bg-[#0F6E56]/10 flex items-center justify-center mb-3">
              <FileText className="w-5 h-5 text-[#0F6E56]" />
            </div>
            <p className="font-medium text-[#0A1F1C]">Aucune facture en {label}</p>
            <p className="text-sm text-[#94A3B8] mt-1 max-w-sm">
              Les factures s&apos;émettent depuis la fiche d&apos;une réservation, bouton « Émettre la facture ».
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#E8ECF0]">
            {invoices.map((i) => (
              <div key={i.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={cn('text-sm font-medium', i.cancelled_at ? 'line-through text-[#94A3B8]' : 'text-[#0A1F1C]')}>{i.number}</span>
                    {i.kind === 'credit_note' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">Avoir</span>}
                    {i.cancelled_at && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">Annulée</span>}
                  </div>
                  <p className="text-xs text-[#94A3B8] truncate">
                    {fmtDate(i.issue_date)} · {i.buyer.company_name ? `${i.buyer.company_name} (${i.buyer.name})` : i.buyer.name}
                  </p>
                </div>
                <span className={cn('text-sm tabular-nums', i.total_ttc < 0 ? 'text-red-600' : 'text-[#0A1F1C]')}>{mad(i.total_ttc)}</span>
                {i.booking_id && (
                  <Link href={`/bookings/${i.booking_id}`} className="hidden sm:inline text-xs text-[#0F6E56] hover:underline">Réservation</Link>
                )}
                <Button size="sm" variant="ghost" aria-label={`Télécharger ${i.number}`} onClick={() => downloadPdf(i)}>
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
