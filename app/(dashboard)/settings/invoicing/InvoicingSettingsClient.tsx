'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, AlertTriangle, FileText, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { isValidIce, missingLegalFields, type PropertyLegal, type TouristTaxMode } from '@/lib/invoicing'

type Props = {
  property: { id: string; name: string; address: string | null; city: string }
  legal: PropertyLegal | null
  unavailable: boolean
}

const card = 'bg-white border border-[#E8ECF0] rounded-[16px] p-6 shadow-[0_1px_4px_rgba(0,0,0,0.04)]'

export function InvoicingSettingsClient({ property, legal, unavailable }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    legal_name: legal?.legal_name ?? '',
    legal_form: legal?.legal_form ?? '',
    ice: legal?.ice ?? '',
    if_number: legal?.if_number ?? '',
    rc: legal?.rc ?? '',
    patente: legal?.patente ?? '',
    cnss: legal?.cnss ?? '',
    legal_address: legal?.legal_address ?? [property.address, property.city].filter(Boolean).join(', '),
    bank_details: legal?.bank_details ?? '',
    invoice_footer: legal?.invoice_footer ?? '',
  })
  const [vatRegistered, setVatRegistered] = useState(legal?.vat_registered ?? false)
  const [vatRate, setVatRate] = useState(String(legal?.vat_rate ?? 10))
  const [taxMode, setTaxMode] = useState<TouristTaxMode>(legal?.tourist_tax_mode ?? 'none')
  const [taxPerNight, setTaxPerNight] = useState(String(legal?.tourist_tax_per_night ?? 0))

  const iceError = form.ice.trim() !== '' && !isValidIce(form.ice)
  const missing = missingLegalFields({ ...form, ice: form.ice.trim() } as PropertyLegal)

  async function handleSave() {
    if (iceError) return toast.error('L\'ICE doit contenir exactement 15 chiffres.')
    const rate = Number(vatRate.replace(',', '.'))
    const tax = Number(taxPerNight.replace(',', '.'))
    if (vatRegistered && (!Number.isFinite(rate) || rate < 0 || rate > 30)) return toast.error('Taux de TVA invalide.')
    if (!Number.isFinite(tax) || tax < 0) return toast.error('Montant de taxe de séjour invalide.')

    setSaving(true)
    try {
      const clean = (v: string) => (v.trim() === '' ? null : v.trim())
      const supabase = createClient()
      const { error } = await supabase.from('property_legal').upsert({
        property_id: property.id,
        legal_name: clean(form.legal_name),
        legal_form: clean(form.legal_form),
        ice: clean(form.ice),
        if_number: clean(form.if_number),
        rc: clean(form.rc),
        patente: clean(form.patente),
        cnss: clean(form.cnss),
        legal_address: clean(form.legal_address),
        bank_details: clean(form.bank_details),
        invoice_footer: clean(form.invoice_footer),
        vat_registered: vatRegistered,
        vat_rate: vatRegistered ? rate : 10,
        tourist_tax_mode: taxMode,
        // Always kept: the monthly taxe de séjour declaration uses it even when
        // the tax is not printed on invoices.
        tourist_tax_per_night: tax,
        updated_at: new Date().toISOString(),
      })
      if (error) throw error
      toast.success('Informations de facturation enregistrées')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement')
    } finally {
      setSaving(false)
    }
  }

  const field = (key: keyof typeof form, label: string, opts: { placeholder?: string; hint?: string; error?: boolean; inputMode?: 'numeric' } = {}) => (
    <div className="space-y-1.5">
      <Label className="text-[13px] font-medium text-[#475569]">{label}</Label>
      <Input
        value={form[key]}
        placeholder={opts.placeholder}
        inputMode={opts.inputMode}
        onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
        className={cn('bg-white border-[#E8ECF0] rounded-[10px] h-10 px-3', opts.error && 'border-red-400')}
      />
      {opts.hint && <p className={cn('text-[11px]', opts.error ? 'text-red-500' : 'text-[#94A3B8]')}>{opts.hint}</p>}
    </div>
  )

  const choice = (active: boolean, onClick: () => void, title: string, desc: string) => (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-1 text-left px-4 py-3 rounded-[12px] border-2 transition-all',
        active ? 'border-[#0F6E56] bg-[#0F6E56]/5' : 'border-[#E8ECF0] hover:border-[#0F6E56]/30',
      )}
    >
      <p className={cn('text-sm font-medium', active ? 'text-[#0F6E56]' : 'text-[#0A1F1C]')}>{title}</p>
      <p className="text-[11px] text-[#94A3B8] mt-0.5">{desc}</p>
    </button>
  )

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-2xl mx-auto bg-[#F4F6F8] min-h-full hp-page-in">
      <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-[#475569] hover:text-[#0F6E56]">
        <ArrowLeft className="w-4 h-4" /> Paramètres
      </Link>

      {unavailable && (
        <div className="flex gap-3 p-4 rounded-[14px] bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          La facturation n&apos;est pas encore activée sur cette base de données (migration 034).
        </div>
      )}

      <div className={cn(card, 'flex items-start gap-3')}>
        {missing.length === 0
          ? <CheckCircle2 className="w-5 h-5 text-[#0F6E56] flex-shrink-0 mt-0.5" />
          : <FileText className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />}
        <div className="text-sm">
          <p className="font-medium text-[#0A1F1C]">
            {missing.length === 0 ? 'Prêt à émettre des factures' : 'Requis avant la première facture'}
          </p>
          <p className="text-[#94A3B8] mt-0.5">
            {missing.length === 0
              ? 'Ces informations apparaîtront sur chaque facture. Une facture émise ne change plus, même si vous modifiez ces champs ensuite.'
              : missing.join(' · ')}
          </p>
        </div>
      </div>

      <div className={card}>
        <p className="text-[15px] font-semibold text-[#0A1F1C] mb-4">Identité légale</p>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">{field('legal_name', 'Raison sociale *', { placeholder: 'ATLAS HOSPITALITY SARL' })}</div>
            {field('legal_form', 'Forme juridique', { placeholder: 'SARL, SARLAU, PP…' })}
          </div>
          {field('legal_address', 'Adresse du siège')}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {field('ice', 'ICE *', { placeholder: '15 chiffres', inputMode: 'numeric', error: iceError, hint: iceError ? 'L\'ICE contient exactement 15 chiffres' : 'Identifiant Commun de l\'Entreprise' })}
            {field('if_number', 'Identifiant fiscal (IF) *')}
            {field('rc', 'Registre de commerce (RC)', { placeholder: 'N° + ville' })}
            {field('patente', 'Patente / Taxe professionnelle')}
            {field('cnss', 'N° CNSS')}
          </div>
        </div>
      </div>

      <div className={card}>
        <p className="text-[15px] font-semibold text-[#0A1F1C] mb-1">TVA</p>
        <p className="text-sm text-[#94A3B8] mb-4">Vos prix restent TTC : la facture calcule la part HT et la TVA incluses dans le prix payé.</p>
        <div className="flex flex-col sm:flex-row gap-3">
          {choice(!vatRegistered, () => setVatRegistered(false), 'Non assujetti', 'La facture porte la mention « TVA non applicable »')}
          {choice(vatRegistered, () => setVatRegistered(true), 'Assujetti à la TVA', 'HT, TVA et TTC détaillés sur la facture')}
        </div>
        {vatRegistered && (
          <div className="mt-4 max-w-[200px] space-y-1.5">
            <Label className="text-[13px] font-medium text-[#475569]">Taux de TVA (%)</Label>
            <Input value={vatRate} inputMode="decimal" onChange={(e) => setVatRate(e.target.value)} className="bg-white border-[#E8ECF0] rounded-[10px] h-10 px-3" />
            <p className="text-[11px] text-[#94A3B8]">10 % est le taux usuel de l&apos;hébergement. Faites-le confirmer par votre comptable.</p>
          </div>
        )}
      </div>

      <div className={card}>
        <p className="text-[15px] font-semibold text-[#0A1F1C] mb-1">Taxe de séjour</p>
        <p className="text-sm text-[#94A3B8] mb-4">Montant par personne et par nuit fixé par votre commune.</p>
        <div className="max-w-[220px] space-y-1.5 mb-4">
          <Label className="text-[13px] font-medium text-[#475569]">MAD / personne / nuit</Label>
          <Input value={taxPerNight} inputMode="decimal" onChange={(e) => setTaxPerNight(e.target.value)} className="bg-white border-[#E8ECF0] rounded-[10px] h-10 px-3" />
          <p className="text-[11px] text-[#94A3B8]">Sert au récapitulatif mensuel (Administratif → Taxe de séjour).</p>
        </div>
        <p className="text-[13px] font-medium text-[#475569] mb-2">Sur la facture</p>
        <div className="flex flex-col sm:flex-row gap-3">
          {choice(taxMode === 'none', () => setTaxMode('none'), 'Ne pas afficher', 'Aucune ligne de taxe sur la facture')}
          {choice(taxMode === 'included', () => setTaxMode('included'), 'Incluse dans le prix', 'Ligne séparée, hors base TVA')}
        </div>
      </div>

      <div className={card}>
        <p className="text-[15px] font-semibold text-[#0A1F1C] mb-4">Mentions sur la facture</p>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[13px] font-medium text-[#475569]">Coordonnées bancaires (RIB)</Label>
            <Textarea value={form.bank_details} rows={2} onChange={(e) => setForm((p) => ({ ...p, bank_details: e.target.value }))} placeholder="Banque · RIB 24 chiffres" className="bg-white border-[#E8ECF0] rounded-[10px]" />
          </div>
          {field('invoice_footer', 'Message de pied de page', { placeholder: 'Merci pour votre séjour !' })}
        </div>
      </div>

      <Button
        className="bg-[#0F6E56] hover:bg-[#0c5a46] text-white rounded-[10px] px-5 h-10 w-full sm:w-auto"
        onClick={handleSave}
        disabled={saving || unavailable}
      >
        {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
        Enregistrer
      </Button>
    </div>
  )
}
