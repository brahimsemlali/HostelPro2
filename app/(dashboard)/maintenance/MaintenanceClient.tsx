'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatDateShort } from '@/lib/utils'
import { MAINTENANCE_PRIORITIES } from '@/lib/constants'
import type { MaintenanceRequest } from '@/types'
import { Plus, Wrench, Loader2, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/shared/EmptyState'
import { useSession } from '@/app/context/SessionContext'
import { logActivity } from '@/lib/activity'
import { useT } from '@/app/context/LanguageContext'

interface MaintenanceWithJoins extends Omit<MaintenanceRequest, 'room' | 'bed'> {
  room?: { name: string } | null
  bed?: { name: string } | null
}

interface Props {
  propertyId: string
  requests: MaintenanceWithJoins[]
  rooms: { id: string; name: string }[]
  beds: { id: string; name: string; room_id: string }[]
}

const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  normal: 'bg-blue-100 text-blue-700',
  high: 'bg-amber-100 text-amber-700',
  urgent: 'bg-red-100 text-red-700',
}

export function MaintenanceClient({ propertyId, requests, rooms, beds }: Props) {
  const router = useRouter()
  const t = useT()
  const session = useSession()

  const columns = [
    { key: 'open', label: t('maintenance.open'), color: 'text-destructive' },
    { key: 'in_progress', label: t('maintenance.inProgress'), color: 'text-amber-600' },
    { key: 'resolved', label: t('maintenance.resolved'), color: 'text-[#0F6E56]' },
  ] as const
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'normal',
    room_id: '',
    bed_id: '',
    assigned_to: '',
  })

  async function handleCreate() {
    if (!form.title) return
    setLoading(true)
    try {
      const supabase = createClient()
      const { error: insertError } = await supabase.from('maintenance').insert({
        property_id: propertyId,
        title: form.title,
        description: form.description || null,
        priority: form.priority,
        room_id: form.room_id || null,
        bed_id: form.bed_id || null,
        assigned_to: form.assigned_to || null,
        status: 'open',
      })
      if (insertError) throw insertError
      // Mark bed as maintenance if urgent
      if (form.priority === 'urgent' && form.bed_id) {
        await supabase.from('beds').update({ status: 'maintenance' }).eq('id', form.bed_id)
      }
      logActivity({
        propertyId,
        userId: session?.userId ?? null,
        staffName: session?.staffName ?? null,
        actionType: 'maintenance_open',
        entityType: 'maintenance',
        description: `Maintenance signalée : ${form.title}`,
        meta: { priority: form.priority, assigned_to: form.assigned_to || null },
      })
      toast.success(t('maintenance.requestCreated'))
      setDialogOpen(false)
      setForm({ title: '', description: '', priority: 'normal', room_id: '', bed_id: '', assigned_to: '' })
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  async function handleStatusChange(id: string, status: string) {
    try {
      const supabase = createClient()
      const { error } = await supabase.from('maintenance').update({
        status,
        resolved_at: status === 'resolved' ? new Date().toISOString() : null,
      }).eq('id', id)
      if (error) throw error
      if (status === 'resolved') {
        const req = requests.find((r) => r.id === id)
        logActivity({
          propertyId,
          userId: session?.userId ?? null,
          staffName: session?.staffName ?? null,
          actionType: 'maintenance_resolved',
          entityType: 'maintenance',
          entityId: id,
          description: `Maintenance résolue : ${req?.title ?? id}`,
          meta: { title: req?.title },
        })
      }
      router.refresh()
    } catch {
      toast.error(t('maintenance.statusUpdateError'))
    }
  }

  const roomBeds = beds.filter((b) => b.room_id === form.room_id)

  return (
    <div className="p-6 max-w-7xl mx-auto hp-page-in bg-[#F4F6F8] min-h-full">
      <div className="flex justify-end mb-5">
        <Button className="bg-[#0F6E56] hover:bg-[#0c5a46]" onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          {t('maintenance.newReport')}
        </Button>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('maintenance.newRequest')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label>{t('common.name')} *</Label>
                <Input value={form.title} onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))} placeholder={t('maintenance.titlePlaceholder')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t('maintenance.room')}</Label>
                  <Select value={form.room_id} onValueChange={(v) => setForm(p => ({ ...p, room_id: v ?? '', bed_id: '' }))}>
                    <SelectTrigger>
                      <span className={form.room_id ? 'text-sm' : 'text-sm text-muted-foreground'}>
                        {form.room_id ? rooms.find(r => r.id === form.room_id)?.name : t('common.selectDots')}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {rooms.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t('maintenance.bed')}</Label>
                  <Select value={form.bed_id} onValueChange={(v) => setForm(p => ({ ...p, bed_id: v ?? '' }))}>
                    <SelectTrigger>
                      <span className={form.bed_id ? 'text-sm' : 'text-sm text-muted-foreground'}>
                        {form.bed_id ? roomBeds.find(b => b.id === form.bed_id)?.name : t('common.selectDots')}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {roomBeds.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t('maintenance.priority')}</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm(p => ({ ...p, priority: v ?? 'normal' }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(MAINTENANCE_PRIORITIES).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t('maintenance.assignedTo')}</Label>
                  <Input value={form.assigned_to} onChange={(e) => setForm(p => ({ ...p, assigned_to: e.target.value }))} placeholder={t('maintenance.technicianPlaceholder')} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{t('common.notes')}</Label>
                <Textarea value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} rows={3} className="resize-none" />
              </div>
              <Button className="w-full bg-[#0F6E56] hover:bg-[#0c5a46]" onClick={handleCreate} disabled={loading || !form.title}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wrench className="w-4 h-4 mr-2" />}
                {t('common.create')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* All-clear empty state */}
      {requests.length === 0 && (
        <div className="rounded-[16px] border-2 border-dashed border-[#E8ECF0] bg-white">
          <EmptyState
            icon={CheckCircle2}
            iconBg="bg-[#0F6E56]/10"
            iconColor="text-[#0F6E56]"
            title={t('maintenance.allClear')}
            description={t('maintenance.allClearDesc')}
            action={{
              label: t('maintenance.reportIssue'),
              onClick: () => setDialogOpen(true),
            }}
          />
        </div>
      )}

      {/* Kanban — only when there are requests */}
      {requests.length > 0 && (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {columns.map(({ key, label, color }) => {
          const columnRequests = requests.filter((r) => r.status === key)
          return (
            <div key={key} className="bg-white border border-[#E8ECF0] rounded-[16px] p-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
              <div className="flex items-center gap-2 mb-4">
                <h3 className={cn('text-[12px] font-bold uppercase tracking-wider', color)}>{label}</h3>
                <span className="text-xs text-[#94A3B8] bg-[#F4F6F8] rounded-full px-2 py-0.5">
                  {columnRequests.length}
                </span>
              </div>
              {columnRequests.length === 0 ? (
                <div className="rounded-[12px] border border-dashed border-[#E8ECF0] p-6 text-center">
                  <p className="text-sm text-[#94A3B8]">{t('maintenance.noRequests')}</p>
                </div>
              ) : (
                columnRequests.map((req) => (
                  <div key={req.id} className="bg-[#F8FAFC] border border-[#E8ECF0] rounded-[12px] p-3 mb-3 last:mb-0 cursor-pointer hover:border-[#D1D9E0] transition-colors">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm font-medium leading-snug text-[#0A1F1C]">{req.title}</p>
                      <span className={cn('text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex-shrink-0', priorityColors[req.priority])}>
                        {MAINTENANCE_PRIORITIES[req.priority]}
                      </span>
                    </div>
                    {(req.room || req.bed) && (
                      <p className="text-xs text-[#94A3B8] mb-1">
                        {req.room?.name}{req.bed ? ` · ${t('maintenance.bed')} ${req.bed.name}` : ''}
                      </p>
                    )}
                    {req.assigned_to && (
                      <p className="text-xs text-[#94A3B8] mb-1">{t('maintenance.assignedTo')}: {req.assigned_to}</p>
                    )}
                    <p className="text-xs text-[#94A3B8] mb-2">{formatDateShort(req.created_at)}</p>
                    <div className="flex gap-1.5">
                      {key !== 'in_progress' && key !== 'resolved' && (
                        <Button size="sm" variant="outline" className="h-7 text-xs flex-1 border-[#E8ECF0]" onClick={() => handleStatusChange(req.id, 'in_progress')}>
                          {t('maintenance.inProgress')}
                        </Button>
                      )}
                      {key !== 'resolved' && (
                        <Button size="sm" variant="outline" className="h-7 text-xs flex-1 text-[#0F6E56] border-[#0F6E56]/30" onClick={() => handleStatusChange(req.id, 'resolved')}>
                          {t('maintenance.resolved')}
                        </Button>
                      )}
                      {key === 'resolved' && (
                        <Button size="sm" variant="outline" className="h-7 text-xs flex-1 border-[#E8ECF0]" onClick={() => handleStatusChange(req.id, 'open')}>
                          {t('maintenance.reopen')}
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )
        })}
      </div>
      )}
    </div>
  )
}
