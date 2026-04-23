'use client'

import { useState, useMemo, useCallback } from 'react'
import type { SubmitHandler } from 'react-hook-form'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { format, subDays, startOfMonth, isWithinInterval, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { cn } from '@/lib/utils'
import {
  UtensilsCrossed,
  Sparkles,
  Wrench,
  Droplets,
  Zap,
  Users,
  Package,
  Plus,
  Trash2,
  ChevronDown,
  AlertTriangle,
  Minus,
  Receipt,
  Archive,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/shared/EmptyState'
import { useT } from '@/app/context/LanguageContext'

// ─── Types ────────────────────────────────────────────────────────────────────

type Expense = {
  id: string
  category: string
  description: string
  amount: number
  payment_method: string
  expense_date: string
  notes: string | null
  created_at: string
}

type InventoryItem = {
  id: string
  name: string
  category: string
  unit: string
  current_stock: number
  reorder_level: number
  notes: string | null
  updated_at: string
}

// ─── Category config ──────────────────────────────────────────────────────────

type CategoryKey =
  | 'alimentation'
  | 'menage'
  | 'maintenance'
  | 'toiletries'
  | 'utilities'
  | 'personnel'
  | 'autre'

const CATEGORIES: Record<
  CategoryKey,
  { labelKey: string; icon: React.ElementType; color: string; bg: string }
> = {
  alimentation: { labelKey: 'expenses.cat.alimentation', icon: UtensilsCrossed, color: 'text-orange-600', bg: 'bg-orange-100' },
  menage:       { labelKey: 'expenses.cat.menage',       icon: Sparkles,        color: 'text-blue-600',   bg: 'bg-blue-100' },
  maintenance:  { labelKey: 'expenses.cat.maintenance',  icon: Wrench,          color: 'text-red-600',    bg: 'bg-red-100' },
  toiletries:   { labelKey: 'expenses.cat.toiletries',   icon: Droplets,        color: 'text-purple-600', bg: 'bg-purple-100' },
  utilities:    { labelKey: 'expenses.cat.utilities',    icon: Zap,             color: 'text-yellow-600', bg: 'bg-yellow-100' },
  personnel:    { labelKey: 'expenses.cat.personnel',    icon: Users,           color: 'text-teal-600',   bg: 'bg-teal-100' },
  autre:        { labelKey: 'expenses.cat.autre',        icon: Package,         color: 'text-gray-600',   bg: 'bg-gray-100' },
}

const CATEGORY_KEYS = Object.keys(CATEGORIES) as CategoryKey[]

function getCat(key: string) {
  return CATEGORIES[key as CategoryKey] ?? CATEGORIES.autre
}

// ─── Currency formatter ───────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(n)

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const expenseSchema = z.object({
  description: z.string().min(2, 'Description obligatoire'),
  category: z.string().min(1, 'Catégorie obligatoire'),
  amount: z.number().positive('Montant invalide'),
  payment_method: z.string().min(1),
  expense_date: z.string().min(1, 'Date obligatoire'),
  notes: z.string().optional(),
})
type ExpenseForm = z.infer<typeof expenseSchema>

const inventorySchema = z.object({
  name: z.string().min(2, 'Nom obligatoire'),
  category: z.string().min(1, 'Catégorie obligatoire'),
  unit: z.string().min(1, 'Unité obligatoire'),
  current_stock: z.number().min(0, 'Stock invalide'),
  reorder_level: z.number().min(0, 'Seuil invalide'),
  notes: z.string().optional(),
})
type InventoryForm = z.infer<typeof inventorySchema>

// ─── Date range options ───────────────────────────────────────────────────────

const DATE_RANGE_VALUES = ['7d', '30d', 'month', '90d'] as const
type DateRange = (typeof DATE_RANGE_VALUES)[number]

function getDateRange(range: DateRange): { start: Date; end: Date } {
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  let start: Date
  switch (range) {
    case '7d':
      start = subDays(new Date(), 6)
      break
    case '30d':
      start = subDays(new Date(), 29)
      break
    case 'month':
      start = startOfMonth(new Date())
      break
    case '90d':
      start = subDays(new Date(), 89)
      break
  }
  start.setHours(0, 0, 0, 0)
  return { start, end }
}

// ─── Expense modal ────────────────────────────────────────────────────────────

function ExpenseModal({
  open,
  propertyId,
  onClose,
  onSave,
}: {
  open: boolean
  propertyId: string
  onClose: () => void
  onSave: (expense: Expense) => void
}) {
  const t = useT()
  const [saving, setSaving] = useState(false)
  const supabase = createClient()
  const today = new Date().toISOString().split('T')[0]

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ExpenseForm>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      expense_date: today,
      category: 'alimentation',
      payment_method: 'cash',
    },
  })

  const category = watch('category')

  const onSubmit: SubmitHandler<ExpenseForm> = async (data) => {
    setSaving(true)
    try {
      const { data: saved, error } = await supabase
        .from('expenses')
        .insert({
          property_id: propertyId,
          description: data.description,
          category: data.category,
          amount: data.amount,
          payment_method: data.payment_method,
          expense_date: data.expense_date,
          notes: data.notes ?? null,
        })
        .select()
        .single()

      if (error) throw error
      onSave(saved as Expense)
      toast.success(t('expenses.saved'))
      reset({ expense_date: today, category: 'alimentation', payment_method: 'cash' })
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`${t('common.error')}: ${msg}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[#0F6E56]" />
            {t('expenses.newExpense')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-1">
          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description">{t('common.description')}</Label>
            <Input
              id="description"
              placeholder={t('expenses.descPlaceholder')}
              {...register('description')}
            />
            {errors.description && (
              <p className="text-xs text-destructive">{errors.description.message}</p>
            )}
          </div>

          {/* Category + Amount */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('expenses.category')}</Label>
              <Select value={(category ?? '') as string} onValueChange={(v) => setValue('category', v ?? '')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_KEYS.map((k) => {
                    const c = CATEGORIES[k]
                    return (
                      <SelectItem key={k} value={k}>
                        <span className="flex items-center gap-2">
                          <c.icon className={cn('w-3.5 h-3.5', c.color)} />
                          {t(c.labelKey)}
                        </span>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="amount">{t('payments.amountMad')}</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                {...register('amount', { valueAsNumber: true })}
              />
              {errors.amount && (
                <p className="text-xs text-destructive">{errors.amount.message}</p>
              )}
            </div>
          </div>

          {/* Date + Method */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="expense_date">{t('common.date')}</Label>
              <Input id="expense_date" type="date" {...register('expense_date')} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('payments.method')}</Label>
              <Select defaultValue="cash" onValueChange={(v) => setValue('payment_method', v ?? '')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{t('payments.cash')}</SelectItem>
                  <SelectItem value="virement">{t('payments.virement')}</SelectItem>
                  <SelectItem value="card">{t('expenses.card')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">{t('expenses.notesOptional')}</Label>
            <Textarea
              id="notes"
              placeholder={t('housekeeping.taskDescPlaceholder')}
              rows={2}
              {...register('notes')}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={saving} className="bg-[#0F6E56] hover:bg-[#0a5240]">
              {saving ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Inventory item modal ─────────────────────────────────────────────────────

function InventoryModal({
  open,
  propertyId,
  item,
  onClose,
  onSave,
}: {
  open: boolean
  propertyId: string
  item?: InventoryItem | null
  onClose: () => void
  onSave: (item: InventoryItem) => void
}) {
  const t = useT()
  const [saving, setSaving] = useState(false)
  const supabase = createClient()
  const isEdit = !!item

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<InventoryForm>({
    resolver: zodResolver(inventorySchema),
    defaultValues: item
      ? {
          name: item.name,
          category: item.category,
          unit: item.unit,
          current_stock: item.current_stock,
          reorder_level: item.reorder_level,
          notes: item.notes ?? '',
        }
      : {
          category: 'menage',
          unit: 'pièce',
          current_stock: 0,
          reorder_level: 5,
        },
  })

  const category = watch('category')

  const onSubmit: SubmitHandler<InventoryForm> = async (data) => {
    setSaving(true)
    try {
      if (isEdit && item) {
        const { data: saved, error } = await supabase
          .from('inventory_items')
          .update({
            name: data.name,
            category: data.category,
            unit: data.unit,
            current_stock: data.current_stock,
            reorder_level: data.reorder_level,
            notes: data.notes ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id)
          .select()
          .single()
        if (error) throw error
        onSave(saved as InventoryItem)
        toast.success(t('expenses.itemUpdated'))
      } else {
        const { data: saved, error } = await supabase
          .from('inventory_items')
          .insert({
            property_id: propertyId,
            name: data.name,
            category: data.category,
            unit: data.unit,
            current_stock: data.current_stock,
            reorder_level: data.reorder_level,
            notes: data.notes ?? null,
          })
          .select()
          .single()
        if (error) throw error
        onSave(saved as InventoryItem)
        toast.success(t('expenses.itemAdded'))
      }
      reset()
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`${t('common.error')}: ${msg}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="w-4 h-4 text-[#0F6E56]" />
            {isEdit ? t('expenses.editItem') : t('expenses.newItem')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-1">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="inv-name">{t('expenses.itemName')}</Label>
            <Input id="inv-name" placeholder={t('expenses.itemNamePlaceholder')} {...register('name')} />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Category + Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('expenses.category')}</Label>
              <Select value={(category ?? '') as string} onValueChange={(v) => setValue('category', v ?? '')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_KEYS.map((k) => {
                    const c = CATEGORIES[k]
                    return (
                      <SelectItem key={k} value={k}>
                        <span className="flex items-center gap-2">
                          <c.icon className={cn('w-3.5 h-3.5', c.color)} />
                          {t(c.labelKey)}
                        </span>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('expenses.unit')}</Label>
              <Select
                defaultValue={(item?.unit ?? 'pièce') as string}
                onValueChange={(v) => setValue('unit', v ?? '')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pièce">{t('expenses.unit.piece')}</SelectItem>
                  <SelectItem value="litre">{t('expenses.unit.litre')}</SelectItem>
                  <SelectItem value="kg">{t('expenses.unit.kg')}</SelectItem>
                  <SelectItem value="paquet">{t('expenses.unit.paquet')}</SelectItem>
                  <SelectItem value="rouleau">{t('expenses.unit.rouleau')}</SelectItem>
                  <SelectItem value="boîte">{t('expenses.unit.boite')}</SelectItem>
                  <SelectItem value="sac">{t('expenses.unit.sac')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Stock + Reorder level */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="current_stock">{t('expenses.currentStock')}</Label>
              <Input
                id="current_stock"
                type="number"
                step="0.5"
                min="0"
                {...register('current_stock', { valueAsNumber: true })}
              />
              {errors.current_stock && (
                <p className="text-xs text-destructive">{errors.current_stock.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reorder_level">{t('expenses.reorderLevel')}</Label>
              <Input
                id="reorder_level"
                type="number"
                step="0.5"
                min="0"
                {...register('reorder_level', { valueAsNumber: true })}
              />
              {errors.reorder_level && (
                <p className="text-xs text-destructive">{errors.reorder_level.message}</p>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="inv-notes">{t('expenses.notesOptional')}</Label>
            <Textarea
              id="inv-notes"
              placeholder={t('expenses.invNotesPlaceholder')}
              rows={2}
              {...register('notes')}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={saving} className="bg-[#0F6E56] hover:bg-[#0a5240]">
              {saving ? t('common.saving') : isEdit ? t('common.update') : t('common.add')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Inventory card ───────────────────────────────────────────────────────────

function InventoryCard({
  item,
  onUpdate,
  onEdit,
  onDelete,
}: {
  item: InventoryItem
  onUpdate: (id: string, newStock: number) => void
  onEdit: (item: InventoryItem) => void
  onDelete: (id: string) => void
}) {
  const t = useT()
  const [adjusting, setAdjusting] = useState(false)
  const supabase = createClient()

  const isOut = item.current_stock <= 0
  const isLow = !isOut && item.current_stock <= item.reorder_level
  const isOk = item.current_stock > item.reorder_level
  const cat = getCat(item.category)
  const CatIcon = cat.icon

  async function adjust(delta: number) {
    const newVal = Math.max(0, item.current_stock + delta)
    if (newVal === item.current_stock) return
    setAdjusting(true)
    onUpdate(item.id, newVal) // optimistic
    const { error } = await supabase
      .from('inventory_items')
      .update({ current_stock: newVal, updated_at: new Date().toISOString() })
      .eq('id', item.id)
    if (error) {
      onUpdate(item.id, item.current_stock) // rollback
      toast.error(t('expenses.updateError'))
    }
    setAdjusting(false)
  }

  return (
    <div
      className={cn(
        'rounded-[14px] border p-4 flex flex-col gap-3 transition-colors shadow-[0_1px_4px_rgba(0,0,0,0.04)]',
        isOut && 'border-red-300 bg-red-50/50',
        isLow && 'border-amber-300 bg-amber-50/50',
        isOk && 'border-[#E8ECF0] bg-white',
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
              cat.bg,
            )}
          >
            <CatIcon className={cn('w-4 h-4', cat.color)} />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{item.name}</p>
            <p className="text-xs text-muted-foreground">{t(cat.labelKey)}</p>
          </div>
        </div>
        {isOut && (
          <Badge variant="destructive" className="text-[11px] flex-shrink-0">
            {t('expenses.stockOut')}
          </Badge>
        )}
        {isLow && (
          <Badge className="text-[11px] bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200 flex-shrink-0">
            {t('expenses.stockLow')}
          </Badge>
        )}
        {isOk && (
          <Badge className="text-[11px] bg-green-100 text-green-800 hover:bg-green-100 border-green-200 flex-shrink-0">
            {t('expenses.stockOk')}
          </Badge>
        )}
      </div>

      {/* Stock value */}
      <div className="flex items-center justify-between">
        <div>
          <span
            className={cn(
              'text-2xl font-semibold tabular-nums',
              isOut && 'text-red-600',
              isLow && 'text-amber-700',
            )}
          >
            {item.current_stock % 1 === 0
              ? item.current_stock
              : item.current_stock.toFixed(1)}
          </span>
          <span className="text-sm text-muted-foreground ml-1">{item.unit}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {t('expenses.threshold')}: {item.reorder_level} {item.unit}
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <div className="flex items-center border rounded-lg overflow-hidden flex-1">
          <button
            onClick={() => adjust(-1)}
            disabled={adjusting || item.current_stock <= 0}
            className="flex-1 h-8 flex items-center justify-center hover:bg-muted disabled:opacity-40 transition-colors"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-5 bg-border" />
          <button
            onClick={() => adjust(1)}
            disabled={adjusting}
            className="flex-1 h-8 flex items-center justify-center hover:bg-muted transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        <button
          onClick={() => onEdit(item)}
          className="h-8 w-8 flex items-center justify-center rounded-lg border hover:bg-muted transition-colors"
          title={t('common.edit')}
        >
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
        <button
          onClick={() => onDelete(item.id)}
          className="h-8 w-8 flex items-center justify-center rounded-lg border hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors"
          title={t('common.delete')}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  propertyId: string
  initialExpenses: Expense[]
  initialInventory: InventoryItem[]
}

export function ExpensesClient({ propertyId, initialExpenses, initialInventory }: Props) {
  const t = useT()
  const supabase = createClient()
  const [tab, setTab] = useState<'expenses' | 'inventory'>('expenses')
  const [dateRange, setDateRange] = useState<DateRange>('30d')
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses)
  const [inventory, setInventory] = useState<InventoryItem[]>(initialInventory)
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [showInventoryModal, setShowInventoryModal] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)

  // ─── Filtered expenses ─────────────────────────────────────────────────

  const filteredExpenses = useMemo(() => {
    const { start, end } = getDateRange(dateRange)
    return expenses.filter((e) => {
      const d = parseISO(e.expense_date)
      return isWithinInterval(d, { start, end })
    })
  }, [expenses, dateRange])

  // ─── Summary stats ─────────────────────────────────────────────────────

  const totalSpent = useMemo(
    () => filteredExpenses.reduce((s, e) => s + e.amount, 0),
    [filteredExpenses],
  )

  const byCategory = useMemo(() => {
    const acc: Record<string, number> = {}
    filteredExpenses.forEach((e) => {
      acc[e.category] = (acc[e.category] ?? 0) + e.amount
    })
    return Object.entries(acc)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
  }, [filteredExpenses])

  // ─── Grouped by date ────────────────────────────────────────────────────

  const grouped = useMemo(() => {
    const groups: Record<string, Expense[]> = {}
    filteredExpenses.forEach((e) => {
      if (!groups[e.expense_date]) groups[e.expense_date] = []
      groups[e.expense_date].push(e)
    })
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
  }, [filteredExpenses])

  // ─── Inventory alerts ──────────────────────────────────────────────────

  const lowStockItems = useMemo(
    () => inventory.filter((i) => i.current_stock <= i.reorder_level),
    [inventory],
  )

  // ─── Handlers — expenses ──────────────────────────────────────────────

  const handleExpenseSaved = useCallback((expense: Expense) => {
    setExpenses((prev) => [expense, ...prev])
  }, [])

  const handleExpenseDelete = useCallback(
    async (id: string) => {
      setExpenses((prev) => prev.filter((e) => e.id !== id))
      const { error } = await supabase.from('expenses').delete().eq('id', id)
      if (error) {
        toast.error(t('common.deleteError'))
      } else {
        toast.success(t('expenses.expenseDeleted'))
      }
    },
    [supabase],
  )

  // ─── Handlers — inventory ────────────────────────────────────────────

  const handleInventoryUpdate = useCallback((id: string, newStock: number) => {
    setInventory((prev) =>
      prev.map((i) => (i.id === id ? { ...i, current_stock: newStock } : i)),
    )
  }, [])

  const handleInventorySaved = useCallback((item: InventoryItem) => {
    setInventory((prev) => {
      const idx = prev.findIndex((i) => i.id === item.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = item
        return next
      }
      return [...prev, item]
    })
  }, [])

  const handleInventoryDelete = useCallback(
    async (id: string) => {
      setInventory((prev) => prev.filter((i) => i.id !== id))
      const { error } = await supabase.from('inventory_items').delete().eq('id', id)
      if (error) {
        toast.error(t('common.deleteError'))
      } else {
        toast.success(t('expenses.itemDeleted'))
      }
    },
    [supabase],
  )

  const handleEditItem = useCallback((item: InventoryItem) => {
    setEditingItem(item)
    setShowInventoryModal(true)
  }, [])

  const handleCloseInventoryModal = useCallback(() => {
    setShowInventoryModal(false)
    setEditingItem(null)
  }, [])

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <>
      <ExpenseModal
        open={showExpenseModal}
        propertyId={propertyId}
        onClose={() => setShowExpenseModal(false)}
        onSave={handleExpenseSaved}
      />
      <InventoryModal
        open={showInventoryModal}
        propertyId={propertyId}
        item={editingItem}
        onClose={handleCloseInventoryModal}
        onSave={handleInventorySaved}
      />

      <div className="flex flex-col h-full bg-[#F4F6F8] min-h-full hp-page-in">
        {/* Page header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E8ECF0] bg-white">
          <div>
            <h1 className="text-xl font-medium text-[#0A1F1C]">{t('expenses.title')}</h1>
            <p className="text-sm text-[#475569] mt-0.5">
              {t('expenses.subtitle')}
            </p>
          </div>
          <Button
            onClick={() =>
              tab === 'expenses' ? setShowExpenseModal(true) : setShowInventoryModal(true)
            }
            className="bg-[#0F6E56] hover:bg-[#0a5240] gap-2 rounded-[10px]"
          >
            <Plus className="w-4 h-4" />
            {tab === 'expenses' ? t('expenses.addExpense') : t('expenses.addItem')}
          </Button>
        </div>

        {/* Low stock alert banner */}
        {lowStockItems.length > 0 && tab === 'inventory' && (
          <div className="mx-6 mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-amber-800">
                {lowStockItems.length} {t('expenses.lowStockAlert')}
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                {lowStockItems.map((i) => i.name).join(', ')}
              </p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="px-6 pt-4 pb-2">
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'expenses' | 'inventory')}>
            <TabsList>
              <TabsTrigger value="expenses" className="gap-2">
                <Receipt className="w-3.5 h-3.5" />
                {t('expenses.tabExpenses')}
              </TabsTrigger>
              <TabsTrigger value="inventory" className="gap-2">
                <Archive className="w-3.5 h-3.5" />
                {t('expenses.tabInventory')}
                {lowStockItems.length > 0 && (
                  <span className="ml-1 bg-amber-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1">
                    {lowStockItems.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* ─── EXPENSES TAB ──────────────────────────────────────── */}
          {tab === 'expenses' && (
            <div className="px-6 pb-8 space-y-5">
              {/* Date range filter + total */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex gap-1.5 flex-wrap">
                  {DATE_RANGE_VALUES.map((value) => (
                    <button
                      key={value}
                      onClick={() => setDateRange(value)}
                      className={cn(
                        'px-3 py-1.5 rounded-[8px] text-xs font-medium transition-colors border',
                        dateRange === value
                          ? 'bg-[#0F6E56] text-white border-[#0F6E56]'
                          : 'bg-white text-[#94A3B8] border-[#E8ECF0] hover:bg-[#F8FAFC] hover:text-[#475569]',
                      )}
                    >
                      {t(`reports.range.${value}`)}
                    </button>
                  ))}
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{t('expenses.totalPeriod')}</p>
                  <p className="text-lg font-semibold tabular-nums">{fmt(totalSpent)}</p>
                </div>
              </div>

              {/* Category breakdown */}
              {byCategory.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {byCategory.map(([key, amount]) => {
                    const c = getCat(key)
                    const CatIcon = c.icon
                    const pct = totalSpent > 0 ? (amount / totalSpent) * 100 : 0
                    return (
                      <div key={key} className="bg-white border border-[#E8ECF0] rounded-[16px] p-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
                        <div className="flex items-center gap-2 mb-2">
                          <div
                            className={cn(
                              'w-7 h-7 rounded-xl flex items-center justify-center',
                              c.bg,
                            )}
                          >
                            <CatIcon className={cn('w-3.5 h-3.5', c.color)} />
                          </div>
                          <span className="text-xs text-[#475569]">{t(c.labelKey)}</span>
                        </div>
                        <p className="font-semibold text-sm tabular-nums text-[#0A1F1C]">{fmt(amount)}</p>
                        <p className="text-xs text-[#94A3B8] mt-0.5">
                          {pct.toFixed(0)}% {t('expenses.ofTotal')}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Expense list */}
              {grouped.length === 0 ? (
                <EmptyState
                  icon={Receipt}
                  iconColor="text-muted-foreground"
                  iconBg="bg-muted"
                  title={t('expenses.emptyTitle')}
                  description={t('expenses.emptyDesc')}
                  action={{
                    label: t('expenses.addExpense'),
                    onClick: () => setShowExpenseModal(true),
                  }}
                />
              ) : (
                <div className="space-y-4">
                  {grouped.map(([date, dayExpenses]) => {
                    const dayTotal = dayExpenses.reduce((s, e) => s + e.amount, 0)
                    const parsedDate = parseISO(date)
                    return (
                      <div key={date}>
                        {/* Day header */}
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-widest">
                            {format(parsedDate, 'EEEE d MMMM', { locale: fr })}
                          </p>
                          <p className="text-xs font-semibold text-[#475569]">
                            {fmt(dayTotal)}
                          </p>
                        </div>

                        {/* Day entries */}
                        <div className="bg-white border border-[#E8ECF0] rounded-[16px] overflow-hidden divide-y divide-[#F0F4F7]">
                          {dayExpenses.map((expense) => {
                            const c = getCat(expense.category)
                            const CatIcon = c.icon
                            return (
                              <div
                                key={expense.id}
                                className="flex items-center gap-3 px-4 py-3 hover:bg-[#F8FAFC] transition-colors group"
                              >
                                <div
                                  className={cn(
                                    'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                                    c.bg,
                                  )}
                                >
                                  <CatIcon className={cn('w-4 h-4', c.color)} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate text-[#0A1F1C]">
                                    {expense.description}
                                  </p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-xs text-[#94A3B8]">
                                      {t(c.labelKey)}
                                    </span>
                                    <span className="text-xs text-[#94A3B8]">·</span>
                                    <span className="text-xs text-[#94A3B8] capitalize">
                                      {expense.payment_method === 'cash'
                                        ? t('payments.cash')
                                        : expense.payment_method === 'virement'
                                          ? t('payments.virement')
                                          : t('expenses.card')}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <p className="text-sm font-semibold tabular-nums text-[#0A1F1C]">
                                    {fmt(expense.amount)}
                                  </p>
                                  <button
                                    onClick={() => handleExpenseDelete(expense.id)}
                                    className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded hover:bg-red-100 hover:text-red-600 transition-all"
                                    title={t('common.delete')}
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ─── INVENTORY TAB ─────────────────────────────────────── */}
          {tab === 'inventory' && (
            <div className="px-6 pb-8 space-y-4">
              {/* Stats row */}
              {inventory.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white border border-[#E8ECF0] rounded-[16px] p-4 text-center shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
                    <p className="text-2xl font-semibold text-[#0A1F1C]">{inventory.length}</p>
                    <p className="text-xs text-[#94A3B8] mt-0.5">{t('expenses.statsTracked')}</p>
                  </div>
                  <div
                    className={cn(
                      'rounded-[16px] border p-4 text-center shadow-[0_1px_4px_rgba(0,0,0,0.04)]',
                      lowStockItems.length > 0 ? 'border-amber-200 bg-amber-50' : 'bg-white border-[#E8ECF0]',
                    )}
                  >
                    <p
                      className={cn(
                        'text-2xl font-semibold',
                        lowStockItems.length > 0 ? 'text-amber-700' : 'text-[#0A1F1C]',
                      )}
                    >
                      {lowStockItems.length}
                    </p>
                    <p className="text-xs text-[#94A3B8] mt-0.5">{t('expenses.statsLowStock')}</p>
                  </div>
                  <div
                    className={cn(
                      'rounded-[16px] border p-4 text-center shadow-[0_1px_4px_rgba(0,0,0,0.04)]',
                      inventory.filter((i) => i.current_stock <= 0).length > 0
                        ? 'border-red-200 bg-red-50'
                        : 'bg-white border-[#E8ECF0]',
                    )}
                  >
                    <p
                      className={cn(
                        'text-2xl font-semibold',
                        inventory.filter((i) => i.current_stock <= 0).length > 0
                          ? 'text-red-600'
                          : 'text-[#0A1F1C]',
                      )}
                    >
                      {inventory.filter((i) => i.current_stock <= 0).length}
                    </p>
                    <p className="text-xs text-[#94A3B8] mt-0.5">{t('expenses.statsOutOfStock')}</p>
                  </div>
                </div>
              )}

              {/* Grid */}
              {inventory.length === 0 ? (
                <EmptyState
                  icon={Archive}
                  iconColor="text-muted-foreground"
                  iconBg="bg-muted"
                  title={t('expenses.invEmptyTitle')}
                  description={t('expenses.invEmptyDesc')}
                  action={{
                    label: t('expenses.addItem'),
                    onClick: () => setShowInventoryModal(true),
                  }}
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[...inventory]
                    .sort((a, b) => {
                      const scoreA =
                        a.current_stock <= 0 ? 0 : a.current_stock <= a.reorder_level ? 1 : 2
                      const scoreB =
                        b.current_stock <= 0 ? 0 : b.current_stock <= b.reorder_level ? 1 : 2
                      if (scoreA !== scoreB) return scoreA - scoreB
                      return a.name.localeCompare(b.name)
                    })
                    .map((item) => (
                      <InventoryCard
                        key={item.id}
                        item={item}
                        onUpdate={handleInventoryUpdate}
                        onEdit={handleEditItem}
                        onDelete={handleInventoryDelete}
                      />
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
