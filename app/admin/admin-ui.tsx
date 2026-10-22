'use client'

// Shared client pieces for the superadmin console.

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BILLING_PLANS } from '@/lib/constants'
import { todayISO } from '@/lib/dates'

export const PLAN_OPTIONS = BILLING_PLANS.map((p) => ({
  id: p.ls_variant_id,
  name: p.name.replace(/ \(.*\)$/, ''),
  price: p.price,
}))

export const PAYMENT_METHODS: { id: string; label: string }[] = [
  { id: 'virement', label: 'Virement' },
  { id: 'cash', label: 'Espèces' },
  { id: 'card', label: 'Carte' },
  { id: 'other', label: 'Autre' },
]
export const methodLabel = (m: string) => PAYMENT_METHODS.find((x) => x.id === m)?.label ?? m

export function formatMAD(n: number): string {
  return `${new Intl.NumberFormat('fr-MA', { maximumFractionDigits: 2 }).format(n)} MAD`
}

/** wa.me link; Moroccan local numbers (06…/07…/05…) get the 212 prefix. */
export function waLink(phone: string | null | undefined, message?: string): string | null {
  if (!phone) return null
  let digits = phone.replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.length === 10 && digits.startsWith('0')) digits = `212${digits.slice(1)}`
  if (digits.length < 8) return null
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ''}`
}

/** POST an action to /api/admin/tenants/[id]. Throws with the server's message. */
export async function tenantAction<T = Record<string, unknown>>(
  propertyId: string,
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T & { ok: true }> {
  const res = await fetch(`/api/admin/tenants/${propertyId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  })
  // An expired session makes the proxy redirect to /login: fetch follows it and
  // gets 200 HTML, which must not be mistaken for success.
  if (res.redirected || !(res.headers.get('content-type') ?? '').includes('application/json')) {
    throw new Error('Session expirée — reconnectez-vous.')
  }
  const data = await res.json() as { error?: string }
  if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`)
  return data as T & { ok: true }
}

/** Download rows as a CSV file (Excel-friendly: BOM + semicolons). */
export function downloadCsv(filename: string, header: string[], rows: (string | number | null)[][]): void {
  const esc = (v: string | number | null) => {
    const s = v === null ? '' : String(v)
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = '﻿' + [header, ...rows].map((r) => r.map(esc).join(';')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const field = 'w-full h-10 rounded-xl border border-[#E8ECF0] bg-white px-3 text-sm text-[#0A1F1C] focus:outline-none focus:ring-2 focus:ring-[#0F6E56]/20'
const labelCls = 'text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]'

/** Record money received from a tenant: writes the ledger and extends access. */
export function PaymentDialog({
  open, onOpenChange, propertyId, propertyName, defaultVariant, onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string
  propertyName: string
  defaultVariant: string | null
  onDone: () => void
}) {
  const initialVariant = defaultVariant && PLAN_OPTIONS.some((p) => p.id === defaultVariant) ? defaultVariant : PLAN_OPTIONS[0].id
  const [variantId, setVariantId] = useState(initialVariant)
  const [months, setMonths] = useState(1)
  const [amount, setAmount] = useState(String(PLAN_OPTIONS.find((p) => p.id === initialVariant)!.price))
  const [method, setMethod] = useState('virement')
  const [paidAt, setPaidAt] = useState(todayISO())
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  function syncAmount(nextVariant: string, nextMonths: number) {
    const price = PLAN_OPTIONS.find((p) => p.id === nextVariant)?.price ?? 0
    setAmount(String(price * Math.max(nextMonths, 1)))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await tenantAction<{ periodEnd: string | null }>(propertyId, 'record_payment', {
        amount: Number(amount.replace(',', '.')), months, variantId, method, paidAt, reference, note,
      })
      toast.success(res.periodEnd
        ? `Paiement enregistré — accès jusqu'au ${new Date(res.periodEnd).toLocaleDateString('fr-FR')}`
        : 'Paiement enregistré')
      onOpenChange(false)
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-[20px] p-6">
        <DialogHeader>
          <DialogTitle className="text-[16px] font-semibold">Encaisser un paiement</DialogTitle>
          <DialogDescription>{propertyName} — l&apos;accès est prolongé automatiquement.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1.5">
              <span className={labelCls}>Plan</span>
              <select className={field} value={variantId} onChange={(e) => { setVariantId(e.target.value); syncAmount(e.target.value, months) }}>
                {PLAN_OPTIONS.map((p) => <option key={p.id} value={p.id}>{p.name} · {formatMAD(p.price)}</option>)}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className={labelCls}>Durée</span>
              <select className={field} value={months} onChange={(e) => { const m = Number(e.target.value); setMonths(m); syncAmount(variantId, m) }}>
                {[1, 2, 3, 6, 12].map((m) => <option key={m} value={m}>{m} mois</option>)}
                <option value={0}>Aucune (paiement seul)</option>
              </select>
            </label>
            <label className="space-y-1.5">
              <span className={labelCls}>Montant (MAD)</span>
              <Input className="h-10 rounded-xl" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </label>
            <label className="space-y-1.5">
              <span className={labelCls}>Mode</span>
              <select className={field} value={method} onChange={(e) => setMethod(e.target.value)}>
                {PAYMENT_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className={labelCls}>Date</span>
              <Input className="h-10 rounded-xl" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </label>
            <label className="space-y-1.5">
              <span className={labelCls}>Référence</span>
              <Input className="h-10 rounded-xl" placeholder="N° virement…" value={reference} onChange={(e) => setReference(e.target.value)} />
            </label>
          </div>
          <label className="block space-y-1.5">
            <span className={labelCls}>Note</span>
            <Input className="h-10 rounded-xl" placeholder="Optionnel" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <Button type="submit" disabled={saving} className="w-full h-11 rounded-xl bg-[#0F6E56] hover:bg-[#0c5a46]">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : `Enregistrer ${amount ? formatMAD(Number(amount.replace(',', '.')) || 0) : ''}`}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
