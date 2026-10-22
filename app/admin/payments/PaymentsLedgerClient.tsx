'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Download, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { dateOfInstant } from '@/lib/dates'
import { PAYMENT_METHODS, downloadCsv, formatMAD, methodLabel } from '../admin-ui'

type Row = {
  id: string
  property_id: string | null
  property_name: string
  amount: number
  method: string
  months: number
  reference: string | null
  note: string | null
  paid_at: string
  recorded_by: string
}

export function PaymentsLedgerClient({ rows, migrationMissing }: { rows: Row[]; migrationMissing: boolean }) {
  const months = Array.from(new Set(rows.map((r) => dateOfInstant(r.paid_at).slice(0, 7))))
  const [month, setMonth] = useState<string>('all')
  const [method, setMethod] = useState<string>('all')

  const shown = rows.filter((r) =>
    (month === 'all' || dateOfInstant(r.paid_at).startsWith(month)) &&
    (method === 'all' || r.method === method))
  const total = shown.reduce((s, r) => s + r.amount, 0)
  const byMethod = PAYMENT_METHODS.map((m) => ({ ...m, total: shown.filter((r) => r.method === m.id).reduce((s, r) => s + r.amount, 0) }))
    .filter((m) => m.total > 0)

  const select = 'h-9 rounded-xl border border-[#E8ECF0] bg-white px-3 text-sm'

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6 hp-page-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#0F6E56]/10 flex items-center justify-center"><Wallet className="w-5 h-5 text-[#0F6E56]" /></div>
          <div>
            <h1 className="text-xl font-bold text-[#0A1F1C]">Encaissements</h1>
            <p className="text-xs text-[#94A3B8]">Tout l&apos;argent reçu des clients (virement, espèces, carte)</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className={select} value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="all">Tous les mois</option>
            {months.map((m) => <option key={m} value={m}>{format(new Date(`${m}-15T12:00:00Z`), 'MMMM yyyy', { locale: fr })}</option>)}
          </select>
          <select className={select} value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="all">Tous les modes</option>
            {PAYMENT_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          <Button
            variant="outline"
            className="h-9 rounded-xl"
            disabled={shown.length === 0}
            onClick={() => downloadCsv(
              `encaissements-${month}-${new Date().toISOString().slice(0, 10)}.csv`,
              ['Date', 'Établissement', 'Montant (MAD)', 'Mode', 'Mois', 'Référence', 'Note', 'Enregistré par'],
              shown.map((r) => [dateOfInstant(r.paid_at), r.property_name, r.amount, methodLabel(r.method), r.months, r.reference, r.note, r.recorded_by]),
            )}
          >
            <Download className="w-4 h-4" /> CSV (comptable)
          </Button>
        </div>
      </div>

      {migrationMissing && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <b>Migration 033 non appliquée.</b> Exécutez <code className="font-mono text-xs">033_admin_console.sql</code> pour activer le journal des encaissements.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-[#E8ECF0] p-4">
          <p className="text-[11px] text-[#94A3B8]">Total ({shown.length} paiement{shown.length !== 1 ? 's' : ''})</p>
          <p className="text-xl font-black text-[#0A1F1C] mt-1">{formatMAD(total)}</p>
        </div>
        {byMethod.map((m) => (
          <div key={m.id} className="bg-white rounded-2xl border border-[#E8ECF0] p-4">
            <p className="text-[11px] text-[#94A3B8]">{m.label}</p>
            <p className="text-xl font-black text-[#0A1F1C] mt-1">{formatMAD(m.total)}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-[#E8ECF0] shadow-sm overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-[#F8FAFC] border-b border-[#E8ECF0]">
              {['Date', 'Établissement', 'Montant', 'Mode', 'Durée', 'Référence / note', 'Par'].map((h) => (
                <th key={h} className="px-5 py-3 text-[11px] font-bold text-[#64748B] uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F5F9]">
            {shown.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-[#94A3B8]">Aucun encaissement — utilisez « Encaisser » sur un client.</td></tr>
            )}
            {shown.map((r) => (
              <tr key={r.id}>
                <td className="px-5 py-3 text-[#475569] whitespace-nowrap">{format(new Date(r.paid_at), 'd MMM yyyy', { locale: fr })}</td>
                <td className="px-5 py-3">
                  {r.property_id
                    ? <Link href={`/admin/tenants/${r.property_id}`} className="font-medium text-[#0A1F1C] hover:text-[#0F6E56]">{r.property_name}</Link>
                    : <span className="text-[#94A3B8]">{r.property_name} (supprimé)</span>}
                </td>
                <td className="px-5 py-3 font-semibold text-[#0A1F1C] whitespace-nowrap">{formatMAD(r.amount)}</td>
                <td className="px-5 py-3"><span className={cn('text-xs px-2 py-0.5 rounded-full', r.method === 'cash' ? 'bg-amber-50 text-amber-700' : 'bg-[#0F6E56]/10 text-[#0F6E56]')}>{methodLabel(r.method)}</span></td>
                <td className="px-5 py-3 text-[#475569]">{r.months ? `${r.months} mois` : '—'}</td>
                <td className="px-5 py-3 text-xs text-[#94A3B8] max-w-56 truncate">{[r.reference, r.note].filter(Boolean).join(' · ') || '—'}</td>
                <td className="px-5 py-3 text-xs text-[#94A3B8]">{r.recorded_by}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
