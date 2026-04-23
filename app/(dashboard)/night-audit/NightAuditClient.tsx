'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency } from '@/lib/utils'
import { generateBatchFiches } from '@/lib/pdf/fiche-police'
import type { Booking, Guest, Property } from '@/types'
import { useT } from '@/app/context/LanguageContext'

type AuditProperty = Pick<Property, 'id' | 'name' | 'city' | 'police_prefecture'>
import { cn } from '@/lib/utils'
import { Check, ChevronLeft, ChevronRight, Moon, FileText, Loader2 } from 'lucide-react'

type Step = 1 | 2 | 3 | 4

interface Props {
  property: AuditProperty
  userId: string
  today: string
  alreadyCompleted: boolean
  stats: {
    checkInsToday: number
    checkOutsToday: number
    occupiedBeds: number
    totalBeds: number
    cashToday: number
    totalRevenue: number
  }
  tomorrowArrivals: (Booking & { guest?: Guest | null; bed?: { name: string; room: { name: string } | null } | null })[]
  dirtyBedsCount: number
  foreignGuestsToday: (Booking & { guest?: Guest | null })[]
}

export function NightAuditClient({
  property,
  userId,
  today,
  alreadyCompleted,
  stats,
  tomorrowArrivals,
  dirtyBedsCount,
  foreignGuestsToday,
}: Props) {
  const router = useRouter()
  const t = useT()
  const [step, setStep] = useState<Step>(1)
  const [actualCash, setActualCash] = useState('')
  const [notes, setNotes] = useState('')
  const [policeReportSent, setPoliceReportSent] = useState(false)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  const cashDiff = actualCash ? parseFloat(actualCash) - stats.cashToday : null
  const occupancyRate = stats.totalBeds
    ? Math.round((stats.occupiedBeds / stats.totalBeds) * 100)
    : 0

  async function handleFinalize() {
    setSaving(true)
    try {
      const supabase = createClient()
      await supabase.from('night_audits').insert({
        property_id: property.id,
        audit_date: today,
        performed_by: userId,
        expected_cash: stats.cashToday,
        actual_cash: actualCash ? parseFloat(actualCash) : stats.cashToday,
        total_revenue: stats.totalRevenue,
        occupancy_rate: occupancyRate,
        notes: notes || null,
        police_report_sent: policeReportSent,
      })
      setDone(true)
      toast.success(t('nightAudit.done'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  async function handleGenerateBatchPDF() {
    const pairs = foreignGuestsToday
      .filter((b) => b.guest)
      .map((b) => ({ guest: b.guest as Guest, booking: b }))

    if (pairs.length === 0) {
      toast.error('Aucun client étranger aujourd\'hui')
      return
    }

    try {
      await generateBatchFiches(pairs, property)
      toast.success(`${pairs.length} fiche(s) générée(s)`)
    } catch {
      toast.error('Erreur lors de la génération')
    }
  }

  if (done || alreadyCompleted) {
    return (
      <div className="max-w-lg mx-auto p-6 bg-[#F4F6F8] min-h-full">
        <div className="rounded-[20px] border border-[#0F6E56]/30 bg-white p-8 text-center space-y-3 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
          <div className="w-14 h-14 rounded-full bg-[#0F6E56] flex items-center justify-center mx-auto">
            <Moon className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-xl font-medium text-[#0A1F1C]">{t('nightAudit.done')}</h2>
          <p className="text-sm text-[#94A3B8]">
            {alreadyCompleted && !done
              ? `L'audit de nuit du ${today} a déjà été complété.`
              : `${t('nightAudit.doneSubtitle')} ${t('nightAudit.title')} du ${today} ${t('common.success').toLowerCase()}.`}
          </p>
          <Button className="mt-2 bg-[#0F6E56] hover:bg-[#0c5a46] rounded-[10px]" onClick={() => router.push('/dashboard')}>
            {t('nightAudit.returnDashboard')}
          </Button>
        </div>
      </div>
    )
  }

  const stepTitles = [
    t('nightAudit.step1.title'),
    t('nightAudit.step2.title'),
    t('nightAudit.step3.title'),
    t('nightAudit.step4.title'),
  ]

  return (
    <div className="max-w-2xl mx-auto p-6 hp-page-in bg-[#F4F6F8] min-h-full">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium border-2 transition-colors',
                s < step ? 'border-[#0F6E56] bg-[#0F6E56] text-white'
                : s === step ? 'border-[#0F6E56] bg-[#0F6E56] text-white'
                : 'border-[#E8ECF0] bg-white text-[#94A3B8]'
              )}
            >
              {s < step ? <Check className="w-3 h-3" /> : s}
            </div>
            {s < 4 && <div className={cn('h-0.5 w-8', s < step ? 'bg-[#0F6E56]' : 'bg-[#E8ECF0]')} />}
          </div>
        ))}
      </div>

      <div className="bg-white border border-[#E8ECF0] rounded-[20px] p-8 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        <h2 className="text-lg font-semibold text-[#0A1F1C] mb-6">{stepTitles[step - 1]}</h2>

        {/* Step 1 — Day summary */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: t('nightAudit.checkins'),  value: String(stats.checkInsToday) },
                { label: t('nightAudit.checkouts'), value: String(stats.checkOutsToday) },
                { label: t('nightAudit.occupancy'), value: `${stats.occupiedBeds}/${stats.totalBeds}` },
                { label: t('nightAudit.revenue'),   value: formatCurrency(stats.totalRevenue) },
              ].map(({ label, value }) => (
                <div key={label} className="bg-[#F8FAFC] border border-[#E8ECF0] rounded-[12px] p-4">
                  <p className="text-xs text-[#94A3B8]">{label}</p>
                  <p className="text-xl font-semibold mt-1 text-[#0A1F1C]">{value}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <Button className="bg-[#0F6E56] hover:bg-[#0c5a46] rounded-[10px]" onClick={() => setStep(2)}>
                {t('common.next')} <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2 — Cash reconciliation */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-[#F8FAFC] border border-[#E8ECF0] rounded-[12px] p-4 space-y-1">
              <p className="text-sm text-[#475569]">{t('nightAudit.expected')}</p>
              <p className="text-3xl font-semibold text-[#0A1F1C]">{formatCurrency(stats.cashToday)}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] font-medium text-[#475569]">{t('nightAudit.actual')}</Label>
              <Input
                type="number"
                value={actualCash}
                onChange={(e) => setActualCash(e.target.value)}
                placeholder="0"
                className="text-xl border-[#E8ECF0] rounded-[10px] h-12"
              />
            </div>
            {cashDiff !== null && (
              <div className={cn(
                'rounded-[12px] p-4 text-center',
                cashDiff === 0 ? 'bg-[#0F6E56]/10 text-[#0F6E56]' : 'bg-destructive/10 text-destructive'
              )}>
                <p className="font-medium">
                  {cashDiff === 0 ? '✓ OK'
                  : cashDiff > 0 ? `+${formatCurrency(cashDiff)}`
                  : `-${formatCurrency(Math.abs(cashDiff))}`}
                </p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-[13px] font-medium text-[#475569]">{t('common.notes')} ({t('common.optional').toLowerCase()})</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="resize-none border-[#E8ECF0] rounded-[10px]"
              />
            </div>
            <div className="flex justify-between">
              <Button variant="outline" className="border-[#E8ECF0] rounded-[10px]" onClick={() => setStep(1)}>
                <ChevronLeft className="w-4 h-4 mr-1" /> {t('common.back')}
              </Button>
              <Button className="bg-[#0F6E56] hover:bg-[#0c5a46] rounded-[10px]" onClick={() => setStep(3)}>
                {t('common.next')} <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3 — Tomorrow */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-[#0A1F1C] mb-3">
                {t('dashboard.arrivals')} ({tomorrowArrivals.length})
              </p>
              {tomorrowArrivals.length === 0 ? (
                <p className="text-sm text-[#94A3B8]">{t('dashboard.noArrivals')}</p>
              ) : (
                <div className="bg-[#F8FAFC] border border-[#E8ECF0] rounded-[12px] overflow-hidden">
                  {tomorrowArrivals.map((b, i) => {
                    const g = b.guest as { first_name: string; last_name: string } | null
                    const bed = b.bed as { name: string; room: { name: string } | null } | null
                    return (
                      <div key={b.id} className={cn('flex items-center justify-between px-4 py-3', i < tomorrowArrivals.length - 1 && 'border-b border-[#E8ECF0]')}>
                        <div>
                          <p className="text-sm font-medium text-[#0A1F1C]">{g?.first_name} {g?.last_name}</p>
                          <p className="text-xs text-[#94A3B8]">{bed?.room?.name} {bed?.name}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {dirtyBedsCount > 0 && (
              <div className="rounded-[12px] bg-amber-50 border border-amber-200 p-3">
                <p className="text-sm font-medium text-amber-800">
                  {dirtyBedsCount} {t('housekeeping.bedsToclean')}
                </p>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" className="border-[#E8ECF0] rounded-[10px]" onClick={() => setStep(2)}>
                <ChevronLeft className="w-4 h-4 mr-1" /> {t('common.back')}
              </Button>
              <Button className="bg-[#0F6E56] hover:bg-[#0c5a46] rounded-[10px]" onClick={() => setStep(4)}>
                {t('common.next')} <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 4 — Police report */}
        {step === 4 && (
          <div className="space-y-4">
            <p className="text-sm text-[#475569]">
              {foreignGuestsToday.filter((b) => b.guest).length} {t('guests.stays')}
            </p>

            {foreignGuestsToday.filter((b) => b.guest).length > 0 && (
              <div className="bg-[#F8FAFC] border border-[#E8ECF0] rounded-[12px] overflow-hidden">
                {foreignGuestsToday.filter((b) => b.guest).map((b, i) => {
                  const g = b.guest as Guest
                  return (
                    <div key={b.id} className={cn('flex items-center gap-3 px-4 py-3', i < foreignGuestsToday.filter(x => x.guest).length - 1 && 'border-b border-[#E8ECF0]')}>
                      <div className="w-8 h-8 rounded-full bg-[#E8ECF0] flex items-center justify-center text-xs font-medium text-[#475569]">
                        {g.first_name?.[0] ?? '?'}{g.last_name?.[0] ?? ''}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#0A1F1C]">{g.first_name} {g.last_name}</p>
                        <p className="text-xs text-[#94A3B8]">{g.nationality} · {g.document_number}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <Button
              variant="outline"
              className="w-full border-[#E8ECF0] rounded-[10px]"
              onClick={handleGenerateBatchPDF}
            >
              <FileText className="w-4 h-4 mr-2" />
              {t('nightAudit.policeReport')}
            </Button>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={policeReportSent}
                onChange={(e) => setPoliceReportSent(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm text-[#475569]">{t('nightAudit.sent')}</span>
            </label>

            <div className="flex justify-between">
              <Button variant="outline" className="border-[#E8ECF0] rounded-[10px]" onClick={() => setStep(3)}>
                <ChevronLeft className="w-4 h-4 mr-1" /> {t('common.back')}
              </Button>
              <Button
                className="bg-[#0F6E56] hover:bg-[#0c5a46] rounded-[10px]"
                onClick={handleFinalize}
                disabled={saving}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                {t('nightAudit.finalize')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
