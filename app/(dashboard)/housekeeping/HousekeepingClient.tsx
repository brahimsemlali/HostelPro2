'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/stores/app.store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/EmptyState'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import {
  CheckCircle2, BedDouble, Clock, Plus, Trash2,
  ClipboardList, ChevronDown, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { HousekeepingTask, TaskStatus, TaskPriority, UserSession } from '@/types'
import { useT } from '@/app/context/LanguageContext'

// ── Types ────────────────────────────────────────────────────────────────────

interface CleaningBed {
  bedId: string
  bedName: string
  roomName: string
  roomId: string
  status: string
  isPriority: boolean
  incomingGuestName: string | null
}

interface StaffMember { id: string; name: string; role: string }
interface RoomItem    { id: string; name: string }

interface Props {
  propertyId: string
  checkInTime: string
  initialBeds: CleaningBed[]
  initialTasks: HousekeepingTask[]
  staffList: StaffMember[]
  roomList: RoomItem[]
  session: UserSession
}

// ── Config ───────────────────────────────────────────────────────────────────
// Labels are moved inside components to support i18n via useT()

// ── Helpers ───────────────────────────────────────────────────────────────────

function minutesUntilCheckIn(checkInTime: string): number {
  const [h, m] = checkInTime.split(':').map(Number)
  const now = new Date()
  const target = new Date()
  target.setHours(h, m, 0, 0)
  return Math.round((target.getTime() - now.getTime()) / 60000)
}

function formatMinutesRaw(mins: number): string | null {
  if (mins <= 0) return null // caller handles translation
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h}h` : `${h}h${m.toString().padStart(2, '0')}`
}

function canManageTasks(session: UserSession): boolean {
  return session.role === 'owner' || session.role === 'manager'
}

// ── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  canManage,
  onStatusChange,
  onDelete,
}: {
  task: HousekeepingTask
  canManage: boolean
  onStatusChange: (id: string, status: TaskStatus) => void
  onDelete: (id: string) => void
}) {
  const t = useT()
  const PRIORITY_CONFIG: Record<TaskPriority, { label: string; badgeClass: string }> = {
    low:    { label: t('maintenance.priority.low'),    badgeClass: 'bg-gray-100 text-gray-600 border-gray-200' },
    normal: { label: t('maintenance.priority.normal'), badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' },
    high:   { label: t('maintenance.priority.high'),   badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' },
    urgent: { label: t('maintenance.priority.urgent'), badgeClass: 'bg-red-50 text-red-700 border-red-200' },
  }
  const STATUS_CONFIG: Record<TaskStatus, { label: string; inactiveClass: string; activeClass: string }> = {
    pending:     { label: t('housekeeping.status.pending'),     inactiveClass: 'text-muted-foreground border-border hover:bg-muted/60', activeClass: 'bg-muted/80 text-foreground border-muted-foreground/30 font-medium' },
    in_progress: { label: t('housekeeping.status.in_progress'), inactiveClass: 'text-amber-700 border-amber-200 hover:bg-amber-50', activeClass: 'bg-amber-100 text-amber-800 border-amber-300 font-medium' },
    done:        { label: t('housekeeping.status.done'),        inactiveClass: 'text-[#0F6E56] border-[#0F6E56]/30 hover:bg-[#0F6E56]/10', activeClass: 'bg-[#0F6E56]/15 text-[#0F6E56] border-[#0F6E56]/40 font-medium' },
  }
  const priorityCfg = PRIORITY_CONFIG[task.priority]
  const isDone = task.status === 'done'

  return (
    <div className={cn('bg-white border border-[#E8ECF0] rounded-[14px] shadow-[0_1px_4px_rgba(0,0,0,0.04)] p-4 space-y-3 transition-all duration-300', isDone && 'opacity-60')}>
      <div className="space-y-3">

        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={cn('font-medium text-sm leading-snug text-[#0A1F1C]', isDone && 'line-through text-[#94A3B8]')}>
                {task.title}
              </p>
              <Badge variant="outline" className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold border', priorityCfg.badgeClass)}>
                {priorityCfg.label}
              </Badge>
            </div>

            {task.description && (
              <p className="text-xs text-[#475569] line-clamp-2">{task.description}</p>
            )}

            {/* Meta: room, due date, assignee */}
            <div className="flex items-center gap-3 flex-wrap text-[11px] text-[#94A3B8] pt-0.5">
              {(task.room?.name || task.bed?.name) && (
                <span>
                  {task.room?.name}
                  {task.bed?.name && ` · ${t('extras.bed')} ${task.bed.name}`}
                </span>
              )}
              {task.due_date && (
                <span className={cn(
                  new Date(task.due_date) < new Date() && !isDone
                    ? 'text-red-600 font-medium'
                    : '',
                )}>
                  {t('housekeeping.due')} {format(parseISO(task.due_date), 'dd MMM', { locale: fr })}
                </span>
              )}
              {canManage && task.assigned_to && (
                <span className="font-medium text-[#475569]">
                  → {task.assigned_to.name}
                </span>
              )}
            </div>
          </div>

          {/* Delete button — managers only */}
          {canManage && (
            <button
              onClick={() => onDelete(task.id)}
              className="flex-shrink-0 p-1.5 rounded-md text-[#94A3B8] hover:text-red-500 hover:bg-red-50 transition-colors"
              title={t('housekeeping.deleteTask')}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status selector */}
        <div className="flex gap-1.5">
          {(Object.entries(STATUS_CONFIG) as [TaskStatus, typeof STATUS_CONFIG[TaskStatus]][]).map(([s, cfg]) => (
            <button
              key={s}
              onClick={() => onStatusChange(task.id, s)}
              className={cn(
                'flex-1 text-[11px] px-2 py-1.5 rounded-lg border transition-all duration-150',
                task.status === s ? cfg.activeClass : cfg.inactiveClass,
              )}
            >
              {cfg.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Create Task Dialog ───────────────────────────────────────────────────────

interface CreateTaskForm {
  title: string
  description: string
  priority: TaskPriority
  assigned_to_staff_id: string
  room_id: string
  due_date: string
  notes: string
}

const DEFAULT_FORM: CreateTaskForm = {
  title: '',
  description: '',
  priority: 'normal',
  assigned_to_staff_id: '',
  room_id: '',
  due_date: '',
  notes: '',
}

function CreateTaskDialog({
  open,
  onClose,
  onCreated,
  staffList,
  roomList,
  propertyId,
  userId,
}: {
  open: boolean
  onClose: () => void
  onCreated: (task: HousekeepingTask) => void
  staffList: StaffMember[]
  roomList: RoomItem[]
  propertyId: string
  userId: string
}) {
  const t = useT()
  const [form, setForm] = useState<CreateTaskForm>(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)

  function set<K extends keyof CreateTaskForm>(k: K, v: CreateTaskForm[K]) {
    setForm((prev) => ({ ...prev, [k]: v }))
  }

  async function handleSubmit() {
    if (!form.title.trim()) {
      toast.error(t('housekeeping.titleRequired'))
      return
    }
    setSaving(true)
    try {
      const supabase = createClient()
      const payload = {
        property_id: propertyId,
        title: form.title.trim(),
        description: form.description.trim() || null,
        priority: form.priority,
        assigned_to_staff_id: form.assigned_to_staff_id || null,
        room_id: form.room_id || null,
        due_date: form.due_date || null,
        notes: form.notes.trim() || null,
        created_by: userId,
        status: 'pending' as TaskStatus,
      }
      const { data, error } = await supabase
        .from('housekeeping_tasks')
        .insert(payload)
        .select('*, assigned_to:assigned_to_staff_id(id, name, role), room:room_id(id, name)')
        .single()
      if (error) throw error
      onCreated(data as HousekeepingTask)
      toast.success(t('housekeeping.taskCreated'))
      setForm(DEFAULT_FORM)
      onClose()
    } catch {
      toast.error(t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('housekeeping.newTask')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="task-title">{t('housekeeping.taskTitle')} <span className="text-red-500">*</span></Label>
            <Input
              id="task-title"
              placeholder={t('housekeeping.taskTitlePlaceholder')}
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="task-desc">{t('common.description')}</Label>
            <Textarea
              id="task-desc"
              placeholder={t('housekeeping.taskDescPlaceholder')}
              rows={2}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </div>

          {/* Priority + Room (2 columns) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('maintenance.priority.label')}</Label>
              <Select value={form.priority} onValueChange={(v: string | null) => v && set('priority', v as TaskPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{t('maintenance.priority.low')}</SelectItem>
                  <SelectItem value="normal">{t('maintenance.priority.normal')}</SelectItem>
                  <SelectItem value="high">{t('maintenance.priority.high')}</SelectItem>
                  <SelectItem value="urgent">{t('maintenance.priority.urgent')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{t('maintenance.room')}</Label>
              <Select value={form.room_id} onValueChange={(v: string | null) => set('room_id', !v || v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder={t('common.none')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('common.none')}</SelectItem>
                  {roomList.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Assigned to + Due date (2 columns) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('housekeeping.assignTo')}</Label>
              <Select value={form.assigned_to_staff_id} onValueChange={(v: string | null) => set('assigned_to_staff_id', !v || v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder={t('housekeeping.nobody')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('housekeeping.nobody')}</SelectItem>
                  {staffList.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="task-due">{t('housekeeping.dueDate')}</Label>
              <Input
                id="task-due"
                type="date"
                value={form.due_date}
                onChange={(e) => set('due_date', e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-[#0F6E56] hover:bg-[#0c5a46] text-white"
          >
            {saving ? t('housekeeping.creating') : t('housekeeping.createTask')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function HousekeepingClient({
  propertyId,
  checkInTime,
  initialBeds,
  initialTasks,
  staffList,
  roomList,
  session,
}: Props) {
  const t = useT()
  const setDirtyBedsCount = useAppStore((s) => s.setDirtyBedsCount)
  const setRealtimeConnected = useAppStore((s) => s.setRealtimeConnected)

  const isManager = canManageTasks(session)

  // ── Tab state ────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'beds' | 'tasks'>('beds')

  // ── Beds state ───────────────────────────────────────────────────────────
  const [beds, setBeds] = useState<CleaningBed[]>(initialBeds)
  const bedsRef = useRef<CleaningBed[]>(initialBeds)
  useEffect(() => { bedsRef.current = beds }, [beds])
  const [justCleaned, setJustCleaned] = useState<Set<string>>(new Set())
  const animTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const [localCleanIds, setLocalCleanIds] = useState<Set<string>>(new Set())

  const totalBeds = beds.length
  const cleanedCount = beds.filter((b) => b.status === 'available' || localCleanIds.has(b.bedId)).length
  const minsToCheckIn = minutesUntilCheckIn(checkInTime)
  const priorityBeds = beds.filter((b) => b.isPriority && !localCleanIds.has(b.bedId) && b.status !== 'available')

  // ── Tasks state ──────────────────────────────────────────────────────────
  const [tasks, setTasks] = useState<HousekeepingTask[]>(initialTasks)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [doneExpanded, setDoneExpanded] = useState(false)

  const activeTasks = tasks.filter((t) => t.status !== 'done')
  const doneTasks = tasks.filter((t) => t.status === 'done')

  // Count for tab badges
  const pendingTaskCount = tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress').length

  // ── Keep global store in sync ────────────────────────────────────────────
  useEffect(() => {
    const remaining = beds.filter((b) => b.status !== 'available' && !localCleanIds.has(b.bedId)).length
    setDirtyBedsCount(remaining)
  }, [beds, localCleanIds, setDirtyBedsCount])

  // ── Re-fetch beds ────────────────────────────────────────────────────────
  const refreshBeds = useCallback(async () => {
    const supabase = createClient()
    const today = new Date().toISOString().split('T')[0]

    const [bedsRes, checkoutsRes, arrivalsRes] = await Promise.all([
      supabase.from('beds').select('id, name, status, room_id').eq('property_id', propertyId).order('name'),
      supabase.from('bookings').select('bed_id, guest:guest_id(first_name, last_name)').eq('property_id', propertyId).eq('check_out_date', today).eq('status', 'checked_out'),
      supabase.from('bookings').select('bed_id, guest:guest_id(first_name, last_name)').eq('property_id', propertyId).eq('check_in_date', today).in('status', ['confirmed', 'pending']),
    ])

    const allBeds = bedsRes.data ?? []
    const checkoutBedIds = new Set((checkoutsRes.data ?? []).map((b) => b.bed_id).filter(Boolean) as string[])
    const arrivalsByBedId = new Map<string, string>()
    ;(arrivalsRes.data ?? []).forEach((b) => {
      if (b.bed_id) {
        const g = Array.isArray(b.guest) ? b.guest[0] : b.guest
        const name = g ? `${(g as { first_name: string }).first_name} ${(g as { last_name: string }).last_name}` : ''
        arrivalsByBedId.set(b.bed_id, name)
      }
    })
    const roomMap = new Map(bedsRef.current.map((b) => [b.bedId, { roomName: b.roomName, roomId: b.roomId }]))

    const updated = allBeds
      .filter((bed) => bed.status === 'dirty' || checkoutBedIds.has(bed.id))
      .map((bed) => ({
        bedId: bed.id,
        bedName: bed.name,
        roomName: roomMap.get(bed.id)?.roomName ?? '—',
        roomId: bed.room_id,
        status: bed.status as string,
        isPriority: arrivalsByBedId.has(bed.id),
        incomingGuestName: arrivalsByBedId.get(bed.id) ?? null,
      }))
      .sort((a, b) => {
        if (a.isPriority !== b.isPriority) return a.isPriority ? -1 : 1
        if (a.roomName !== b.roomName) return a.roomName.localeCompare(b.roomName)
        return a.bedName.localeCompare(b.bedName)
      })

    setBeds(updated)
  }, [propertyId])

  // ── Realtime ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`housekeeping-${propertyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'beds', filter: `property_id=eq.${propertyId}` }, () => refreshBeds())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `property_id=eq.${propertyId}` }, () => refreshBeds())
      .subscribe((status) => setRealtimeConnected(status === 'SUBSCRIBED'))

    return () => {
      supabase.removeChannel(channel)
      setRealtimeConnected(false)
    }
  }, [propertyId, refreshBeds, setRealtimeConnected])

  useEffect(() => {
    const timers = animTimers.current
    return () => timers.forEach((t) => clearTimeout(t))
  }, [])

  // ── Mark bed clean ───────────────────────────────────────────────────────
  async function markClean(bedId: string) {
    setLocalCleanIds((prev) => new Set([...prev, bedId]))
    setJustCleaned((prev) => new Set([...prev, bedId]))
    const existing = animTimers.current.get(bedId)
    if (existing) clearTimeout(existing)
    const timer = setTimeout(() => {
      setJustCleaned((prev) => { const n = new Set(prev); n.delete(bedId); return n })
      animTimers.current.delete(bedId)
    }, 1800)
    animTimers.current.set(bedId, timer)

    try {
      const supabase = createClient()
      const { error } = await supabase.from('beds').update({ status: 'available' }).eq('id', bedId)
      if (error) throw error
    } catch {
      setLocalCleanIds((prev) => { const n = new Set(prev); n.delete(bedId); return n })
      toast.error(t('common.error'))
    }
  }

  // ── Task status change ───────────────────────────────────────────────────
  async function handleTaskStatusChange(taskId: string, newStatus: TaskStatus) {
    const prev = tasks
    setTasks((t) => t.map((task) =>
      task.id === taskId
        ? { ...task, status: newStatus, completed_at: newStatus === 'done' ? new Date().toISOString() : null }
        : task,
    ))
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('housekeeping_tasks')
        .update({ status: newStatus, completed_at: newStatus === 'done' ? new Date().toISOString() : null })
        .eq('id', taskId)
      if (error) throw error
    } catch {
      setTasks(prev)
      toast.error(t('common.error'))
    }
  }

  // ── Task delete ──────────────────────────────────────────────────────────
  async function handleTaskDelete(taskId: string) {
    const prev = tasks
    setTasks((ts) => ts.filter((task) => task.id !== taskId))
    try {
      const supabase = createClient()
      const { error } = await supabase.from('housekeeping_tasks').delete().eq('id', taskId)
      if (error) throw error
      toast.success(t('housekeeping.taskDeleted'))
    } catch {
      setTasks(prev)
      toast.error(t('common.error'))
    }
  }

  // ── Task created ─────────────────────────────────────────────────────────
  function handleTaskCreated(task: HousekeepingTask) {
    setTasks((prev) => [task, ...prev])
  }

  // ── Render ───────────────────────────────────────────────────────────────
  const allDone = totalBeds === 0 || cleanedCount >= totalBeds

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-5 hp-page-in bg-[#F4F6F8] min-h-full">

      {/* ── Page header ── */}
      <div>
        <h1 className="text-xl font-medium text-[#0A1F1C]">{t('housekeeping.title')}</h1>
        <p className="text-sm text-[#475569] mt-0.5">
          {t('housekeeping.checkinFrom')} {checkInTime}
          {minsToCheckIn > 0 && (
            <span className={cn('ml-2 font-medium', minsToCheckIn < 60 ? 'text-destructive' : 'text-muted-foreground')}>
              · {t('housekeeping.in')} {formatMinutesRaw(minsToCheckIn) ?? t('housekeeping.now')}
            </span>
          )}
        </p>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex gap-1 bg-white border border-[#E8ECF0] p-1 rounded-[12px]">
        <button
          onClick={() => setActiveTab('beds')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 text-sm py-2 px-3 rounded-[8px] transition-all',
            activeTab === 'beds'
              ? 'bg-[#0F6E56] text-white font-semibold shadow-sm'
              : 'text-[#94A3B8] hover:text-[#475569]',
          )}
        >
          <BedDouble className="w-4 h-4" />
          {t('housekeeping.bedsTab')}
          {totalBeds > 0 && (
            <span className={cn(
              'text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center',
              activeTab === 'beds' ? 'bg-white/20 text-white' : 'bg-[#F4F6F8] text-[#94A3B8]',
            )}>
              {totalBeds - cleanedCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('tasks')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 text-sm py-2 px-3 rounded-[8px] transition-all',
            activeTab === 'tasks'
              ? 'bg-[#0F6E56] text-white font-semibold shadow-sm'
              : 'text-[#94A3B8] hover:text-[#475569]',
          )}
        >
          <ClipboardList className="w-4 h-4" />
          {t('housekeeping.tasksTab')}
          {pendingTaskCount > 0 && (
            <span className={cn(
              'text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center',
              activeTab === 'tasks' ? 'bg-white/20 text-white' : 'bg-[#F4F6F8] text-[#94A3B8]',
            )}>
              {pendingTaskCount}
            </span>
          )}
        </button>
      </div>

      {/* ══════════════ BEDS TAB ══════════════ */}
      {activeTab === 'beds' && (
        <>
          {/* Progress bar */}
          {totalBeds > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {cleanedCount}/{totalBeds} {t('housekeeping.bedsCleaned')}
                </span>
                <span className="text-sm text-muted-foreground">
                  {totalBeds - cleanedCount} {t('housekeeping.remaining')}
                </span>
              </div>
              <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#0F6E56] transition-all duration-700"
                  style={{ width: `${totalBeds ? (cleanedCount / totalBeds) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Priority alert */}
          {priorityBeds.length > 0 && minsToCheckIn < 120 && minsToCheckIn > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                <span className="font-medium">
                  {priorityBeds.length} {t('housekeeping.priorityBeds')}
                </span>
                {' '}— {t('housekeeping.arrivalsIn')}{' '}
                <span className="font-medium">{formatMinutesRaw(minsToCheckIn) ?? t('housekeeping.now')}</span>
              </p>
            </div>
          )}

          {/* All done */}
          {allDone && (
            <div className="rounded-2xl border-2 border-dashed border-border">
              <EmptyState
                icon={CheckCircle2}
                iconBg="bg-[#0F6E56]/10"
                iconColor="text-[#0F6E56]"
                title={t('housekeeping.allClean')}
                description={t('housekeeping.allCleanDesc')}
              />
            </div>
          )}

          {/* Cleaning list */}
          {!allDone && (
            <div className="space-y-2">
              {beds.map((bed) => {
                const isDone = bed.status === 'available' || localCleanIds.has(bed.bedId)
                const isAnimating = justCleaned.has(bed.bedId)
                return (
                  <div
                    key={bed.bedId}
                    className={cn(
                      'bg-white rounded-[14px] shadow-[0_1px_4px_rgba(0,0,0,0.04)] p-4 flex items-center gap-4 transition-all duration-500',
                      isDone ? 'opacity-50 pointer-events-none' : '',
                      bed.isPriority && !isDone ? 'border border-amber-200/60' : 'border border-[#E8ECF0]',
                    )}
                  >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">
                            {bed.roomName}
                            <span className="text-muted-foreground font-normal mx-1">·</span>
                            {t('extras.bed')} {bed.bedName}
                          </p>
                          {bed.isPriority && !isDone && (
                            <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">
                              {t('housekeeping.arrivalToday')}
                            </Badge>
                          )}
                          {isDone && (
                            <Badge className="text-xs bg-[#0F6E56]/10 text-[#0F6E56] hover:bg-[#0F6E56]/10">
                              {t('housekeeping.clean')} ✓
                            </Badge>
                          )}
                        </div>
                        {bed.isPriority && bed.incomingGuestName && !isDone && (
                          <p className="text-xs text-muted-foreground mt-0.5">→ {bed.incomingGuestName}</p>
                        )}
                      </div>
                      {!isDone && (
                        <Button
                          size="sm"
                          onClick={() => markClean(bed.bedId)}
                          className={cn(
                            'h-11 px-4 flex-shrink-0 transition-all duration-300 gap-2 bg-[#0F6E56] hover:bg-[#0c5a46] text-white rounded-[10px]',
                            isAnimating && 'scale-95',
                          )}
                        >
                          <CheckCircle2 className={cn('w-4 h-4 transition-transform duration-300', isAnimating && 'scale-125')} />
                          <span className="hidden sm:inline">{isAnimating ? t('housekeeping.cleaned') : t('housekeeping.markClean')}</span>
                        </Button>
                      )}
                    </div>
                )
              })}
            </div>
          )}

          {totalBeds === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-border">
              <EmptyState
                icon={BedDouble}
                iconBg="bg-[#0F6E56]/10"
                iconColor="text-[#0F6E56]"
                title={t('housekeeping.noBeds')}
                description={t('housekeeping.noBedsDesc')}
              />
            </div>
          )}
        </>
      )}

      {/* ══════════════ TASKS TAB ══════════════ */}
      {activeTab === 'tasks' && (
        <>
          {/* Manager: header + create button */}
          {isManager && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#475569]">
                {activeTasks.length > 0
                  ? `${activeTasks.length} ${t('housekeeping.activeTasks')}`
                  : t('housekeeping.noActiveTasks')}
              </p>
              <Button
                size="sm"
                onClick={() => setShowCreateDialog(true)}
                className="gap-1.5 bg-[#0F6E56] hover:bg-[#0c5a46] text-white h-8 text-xs rounded-[10px]"
              >
                <Plus className="w-3.5 h-3.5" />
                {t('housekeeping.newTask')}
              </Button>
            </div>
          )}

          {/* Housekeeping: contextual header */}
          {!isManager && (
            <p className="text-sm text-[#475569]">
              {activeTasks.length > 0
                ? `${t('housekeeping.youHave')} ${activeTasks.length} ${t('housekeeping.tasksToDo')}`
                : t('housekeeping.noAssignedTasks')}
            </p>
          )}

          {/* Active tasks */}
          {activeTasks.length > 0 ? (
            <div className="space-y-2">
              {activeTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  canManage={isManager}
                  onStatusChange={handleTaskStatusChange}
                  onDelete={handleTaskDelete}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-border">
              <EmptyState
                icon={ClipboardList}
                iconBg="bg-[#0F6E56]/10"
                iconColor="text-[#0F6E56]"
                title={isManager ? t('housekeeping.noActiveTasks') : t('housekeeping.noAssignedTasks')}
                description={
                  isManager
                    ? t('housekeeping.createAndAssign')
                    : t('housekeeping.assignedHere')
                }
              />
            </div>
          )}

          {/* Done tasks (collapsible) */}
          {doneTasks.length > 0 && (
            <div className="space-y-2">
              <button
                onClick={() => setDoneExpanded((v) => !v)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
              >
                {doneExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                {doneTasks.length} {t('housekeeping.doneTasks')}
              </button>
              {doneExpanded && (
                <div className="space-y-2">
                  {doneTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      canManage={isManager}
                      onStatusChange={handleTaskStatusChange}
                      onDelete={handleTaskDelete}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Create task dialog ── */}
      {isManager && (
        <CreateTaskDialog
          open={showCreateDialog}
          onClose={() => setShowCreateDialog(false)}
          onCreated={handleTaskCreated}
          staffList={staffList}
          roomList={roomList}
          propertyId={propertyId}
          userId={session.userId}
        />
      )}
    </div>
  )
}
