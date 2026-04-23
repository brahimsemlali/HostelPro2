'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { PricingRule } from '@/types'
import { Plus, Loader2, Trash2, TrendingUp, Zap, Calendar, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/app/context/LanguageContext'

const DAY_NAMES = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

export function PricingClient({ propertyId, rules: initialRules }: { propertyId: string; rules: PricingRule[] }) {
  const router = useRouter()
  const t = useT()
  const [rules, setRules] = useState<PricingRule[]>(initialRules)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<{
    name: string
    condition_type: PricingRule['condition_type']
    threshold: string
    days_of_week: number[]
    adjustment_type: 'percentage' | 'fixed'
    adjustment_value: string
  }>({
    name: '',
    condition_type: 'occupancy_above',
    threshold: '75',
    days_of_week: [5, 6],
    adjustment_type: 'percentage',
    adjustment_value: '20',
  })

  function toggleDay(d: number) {
    setForm((p) => ({
      ...p,
      days_of_week: p.days_of_week.includes(d)
        ? p.days_of_week.filter((x) => x !== d)
        : [...p.days_of_week, d],
    }))
  }

  async function handleCreate() {
    if (!form.name) return
    setLoading(true)
    try {
      const supabase = createClient()
      const payload = {
        property_id: propertyId,
        name: form.name,
        condition_type: form.condition_type,
        threshold: form.condition_type !== 'day_of_week' ? parseFloat(form.threshold) : null,
        days_of_week: form.condition_type === 'day_of_week' ? form.days_of_week : null,
        adjustment_type: form.adjustment_type,
        adjustment_value: parseFloat(form.adjustment_value),
        is_active: true,
      }
      const { data, error } = await supabase.from('pricing_rules').insert(payload).select().single()
      if (error) throw error
      setRules((prev) => [...prev, data as PricingRule])
      setDialogOpen(false)
      setForm({ name: '', condition_type: 'occupancy_above', threshold: '75', days_of_week: [5, 6], adjustment_type: 'percentage', adjustment_value: '20' })
      toast.success(t('pricing.ruleCreated'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.error'))
    } finally { setLoading(false) }
  }

  async function handleToggle(rule: PricingRule) {
    try {
      const supabase = createClient()
      const { error } = await supabase.from('pricing_rules').update({ is_active: !rule.is_active }).eq('id', rule.id)
      if (error) throw error
      setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, is_active: !r.is_active } : r))
    } catch { toast.error(t('common.error')) }
  }

  async function handleDelete(id: string) {
    try {
      const supabase = createClient()
      const { error } = await supabase.from('pricing_rules').delete().eq('id', id)
      if (error) throw error
      setRules((prev) => prev.filter((r) => r.id !== id))
      toast.success(t('pricing.ruleDeleted'))
    } catch { toast.error(t('common.error')) }
  }

  function ruleDescription(rule: PricingRule): string {
    const adj = rule.adjustment_type === 'percentage'
      ? `+${rule.adjustment_value}%`
      : `+${rule.adjustment_value} MAD`

    if (rule.condition_type === 'occupancy_above')
      return `${t('pricing.ifOccupancy')} ${rule.threshold}% → ${adj}`
    if (rule.condition_type === 'day_of_week') {
      const days = (rule.days_of_week ?? []).map((d) => DAY_NAMES[d]).join(', ')
      return `${days} → ${adj}`
    }
    if (rule.condition_type === 'days_before_arrival')
      return `${t('pricing.ifBookingBefore')} ${rule.threshold}${t('pricing.daysShort')} → ${adj}`
    return adj
  }

  const activeCount = rules.filter((r) => r.is_active).length

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-medium flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#0F6E56]" />
            {t('pricing.rulesTitle')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('pricing.rulesSubtitle')}
            {activeCount > 0 && ` ${activeCount} ${t('pricing.activeRules')}`}
          </p>
        </div>
        <Button size="sm" className="bg-[#0F6E56] hover:bg-[#0c5a46]" onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> {t('pricing.newRule')}
        </Button>
      </div>

      {/* How it works */}
      <div className="rounded-xl bg-[#0F6E56]/5 border border-[#0F6E56]/20 p-4 text-sm space-y-1.5">
        <p className="font-medium text-[#0F6E56]">{t('pricing.howItWorks')}</p>
        <p className="text-muted-foreground text-xs">
          {t('pricing.howItWorksDesc')}
        </p>
      </div>

      {rules.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border p-12 text-center">
          <TrendingUp className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-medium text-sm">{t('pricing.noRules')}</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            {t('pricing.noRulesExample')}
          </p>
          <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> {t('pricing.createRule')}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <Card key={rule.id} className={cn(!rule.is_active && 'opacity-60')}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className={cn(
                  'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                  rule.condition_type === 'occupancy_above' ? 'bg-blue-100' :
                  rule.condition_type === 'day_of_week' ? 'bg-purple-100' : 'bg-amber-100'
                )}>
                  {rule.condition_type === 'occupancy_above' && <Zap className="w-4 h-4 text-blue-600" />}
                  {rule.condition_type === 'day_of_week' && <Calendar className="w-4 h-4 text-purple-600" />}
                  {rule.condition_type === 'days_before_arrival' && <Clock className="w-4 h-4 text-amber-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{rule.name}</p>
                    <Badge className={cn(
                      'text-xs',
                      rule.adjustment_value > 0
                        ? 'bg-[#0F6E56]/10 text-[#0F6E56] hover:bg-[#0F6E56]/10'
                        : 'bg-red-100 text-red-700 hover:bg-red-100'
                    )}>
                      {rule.adjustment_type === 'percentage' ? `+${rule.adjustment_value}%` : `+${rule.adjustment_value} MAD`}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{ruleDescription(rule)}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleToggle(rule)}
                    className={cn(
                      'text-xs px-2.5 py-1 rounded-full transition-colors font-medium',
                      rule.is_active
                        ? 'bg-[#0F6E56]/10 text-[#0F6E56]'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {rule.is_active ? t('pricing.active') : t('pricing.inactive')}
                  </button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(rule.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t('pricing.newPriceRule')}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label>{t('pricing.ruleName')} *</Label>
              <Input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Ex: Weekend boost, Rush last minute…" />
            </div>

            <div className="space-y-1.5">
              <Label>{t('pricing.condition')}</Label>
              <Select value={form.condition_type} onValueChange={(v) => setForm(p => ({ ...p, condition_type: v as PricingRule['condition_type'] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="occupancy_above">{t('pricing.condOccupancy')}</SelectItem>
                  <SelectItem value="day_of_week">{t('pricing.condDayOfWeek')}</SelectItem>
                  <SelectItem value="days_before_arrival">{t('pricing.condDaysBefore')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.condition_type === 'occupancy_above' && (
              <div className="space-y-1.5">
                <Label>{t('pricing.occupancyThreshold')}</Label>
                <Input type="number" min="1" max="100" value={form.threshold}
                  onChange={(e) => setForm(p => ({ ...p, threshold: e.target.value }))} />
              </div>
            )}

            {form.condition_type === 'day_of_week' && (
              <div className="space-y-1.5">
                <Label>{t('pricing.daysOfWeek')}</Label>
                <div className="flex gap-1.5 flex-wrap">
                  {DAY_NAMES.map((d, i) => (
                    <button key={i} type="button"
                      onClick={() => toggleDay(i)}
                      className={cn(
                        'w-9 h-9 rounded-lg text-xs font-medium border transition-colors',
                        form.days_of_week.includes(i)
                          ? 'bg-[#0F6E56] text-white border-[#0F6E56]'
                          : 'border-border text-muted-foreground hover:border-[#0F6E56]/40'
                      )}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {form.condition_type === 'days_before_arrival' && (
              <div className="space-y-1.5">
                <Label>{t('pricing.daysBeforeArrival')}</Label>
                <Input type="number" min="1" value={form.threshold}
                  onChange={(e) => setForm(p => ({ ...p, threshold: e.target.value }))} />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('pricing.adjustmentType')}</Label>
                <Select value={form.adjustment_type} onValueChange={(v) => setForm(p => ({ ...p, adjustment_type: v as 'percentage' | 'fixed' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">{t('pricing.percentage')}</SelectItem>
                    <SelectItem value="fixed">{t('pricing.fixedAmount')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('pricing.value')}</Label>
                <Input type="number" min="0" value={form.adjustment_value}
                  onChange={(e) => setForm(p => ({ ...p, adjustment_value: e.target.value }))}
                  placeholder={form.adjustment_type === 'percentage' ? '20' : '30'} />
              </div>
            </div>

            {form.adjustment_value && (
              <p className="text-sm text-[#0F6E56] bg-[#0F6E56]/5 rounded-lg p-2.5">
                💡 {ruleDescription({
                  ...form,
                  threshold: parseFloat(form.threshold),
                  adjustment_value: parseFloat(form.adjustment_value),
                } as PricingRule)}
              </p>
            )}

            <Button className="w-full bg-[#0F6E56] hover:bg-[#0c5a46]"
              onClick={handleCreate} disabled={loading || !form.name || !form.adjustment_value}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {t('pricing.createRule')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
