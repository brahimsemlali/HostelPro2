'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { Staff, StaffInvitation, StaffRole } from '@/types'

type StaffRow = Pick<Staff, 'id' | 'name' | 'role' | 'phone' | 'is_active' | 'hide_revenue' | 'user_id' | 'created_at'>
type InvitationRow = Pick<StaffInvitation, 'id' | 'email' | 'name' | 'role' | 'token' | 'expires_at' | 'created_at'>
import {
  Plus, Copy, Check, MessageCircle, UserX, Clock,
  UserCheck, Shield, Mail, Loader2, Users, Eye, EyeOff,
} from 'lucide-react'
import { useT } from '@/app/context/LanguageContext'

const roleConfig: Record<string, { color: string; icon: string }> = {
  manager: { color: 'bg-blue-50 text-blue-700 border-blue-100', icon: '🏢' },
  receptionist: { color: 'bg-[#0F6E56]/8 text-[#0F6E56] border-[#0F6E56]/15', icon: '🛎' },
  housekeeping: { color: 'bg-amber-50 text-amber-700 border-amber-100', icon: '🧹' },
}

interface Props {
  propertyId: string
  staff: StaffRow[]
  pendingInvitations: InvitationRow[]
}

export function StaffClient({ propertyId, staff, pendingInvitations }: Props) {
  const router = useRouter()
  const t = useT()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [togglingRevenue, setTogglingRevenue] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [inviteResult, setInviteResult] = useState<{ url: string; name: string; emailSent: boolean } | null>(null)
  const [form, setForm] = useState({ name: '', email: '', role: 'receptionist' as StaffRole })

  const activeStaff = staff.filter(s => s.is_active && s.user_id)
  const inactiveStaff = staff.filter(s => !s.is_active || !s.user_id)

  async function handleInvite() {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error(t('staff.nameEmailRequired'))
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/staff/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? t('common.error'))
      if (data.reused) toast.info(t('staff.invitePending'))
      setInviteResult({ url: data.inviteUrl, name: form.name.trim(), emailSent: data.emailSent ?? false })
      setForm({ name: '', email: '', role: 'receptionist' })
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  async function handleRevoke(staffId: string) {
    setRevoking(staffId)
    try {
      const res = await fetch('/api/staff/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId }),
      })
      if (!res.ok) throw new Error(t('common.error'))
      toast.success(t('staff.accessRevoked'))
      router.refresh()
    } catch {
      toast.error(t('staff.revokeError'))
    } finally {
      setRevoking(null)
    }
  }

  async function handleToggleRevenue(staffId: string, currentHideRevenue: boolean) {
    setTogglingRevenue(staffId)
    try {
      const res = await fetch('/api/staff/toggle-revenue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId, hideRevenue: !currentHideRevenue }),
      })
      if (!res.ok) throw new Error(t('common.error'))
      toast.success(!currentHideRevenue ? t('staff.revenueHidden') : t('staff.revenueVisible'))
      router.refresh()
    } catch {
      toast.error(t('staff.updateError'))
    } finally {
      setTogglingRevenue(null)
    }
  }

  async function copyInviteUrl(url: string) {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    toast.success(t('staff.linkCopied'))
    setTimeout(() => setCopied(false), 2000)
  }

  function shareViaWhatsApp(url: string, name: string) {
    const message = `Bonjour ${name} 👋\n\nVous êtes invité(e) à rejoindre notre équipe sur HostelPro.\n\nCliquez sur ce lien pour créer votre compte :\n${url}\n\nCe lien est valable 7 jours.`
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank')
  }

  function closeDialog() {
    setDialogOpen(false)
    setInviteResult(null)
    setForm({ name: '', email: '', role: 'receptionist' })
  }

  const totalActive = activeStaff.length
  const totalPending = pendingInvitations.length

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">{t('staff.team')}</h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            {totalActive} {t('staff.active')} · {totalPending} {t('staff.pendingInvites')}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setDialogOpen(true)}
          className="h-8 text-[13px] gap-1.5"
          style={{ background: 'linear-gradient(135deg, #0F6E56 0%, #16a37d 100%)' }}
        >
          <Plus className="w-3.5 h-3.5" />
          {t('staff.invite')}
        </Button>
      </div>

      {/* Pending invitations */}
      {pendingInvitations.length > 0 && (
        <section className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[oklch(0.65_0_0)] px-1">
            {t('staff.pendingInvitations')}
          </p>
          {pendingInvitations.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center justify-between px-4 py-3 rounded-[14px] bg-amber-50 border border-amber-100"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                </div>
                <div>
                  <p className="text-[13px] font-medium">{inv.name}</p>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    {inv.email}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${roleConfig[inv.role]?.color}`}>
                  {t(`role.${inv.role}`) ?? inv.role}
                </span>
                <button
                  onClick={() => shareViaWhatsApp(
                    `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/accept-invite?token=${inv.token}`,
                    inv.name
                  )}
                  className="p-1.5 rounded-lg text-[oklch(0.55_0_0)] hover:bg-green-50 hover:text-green-600 transition-colors"
                  title={t('whatsapp.send')}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Active staff */}
      <section className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[oklch(0.65_0_0)] px-1">
          {t('staff.activeMembers')}
        </p>
        {activeStaff.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-10 rounded-[16px] border border-dashed border-black/10"
            style={{ background: 'rgba(0,0,0,0.015)' }}
          >
            <Users className="w-8 h-8 text-[oklch(0.75_0_0)] mb-2" />
            <p className="text-[13px] text-muted-foreground">{t('staff.noActiveMembers')}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {t('staff.inviteToStart')}
            </p>
          </div>
        ) : (
          activeStaff.map((s) => (
            <StaffRow
              key={s.id}
              staff={s}
              revoking={revoking}
              onRevoke={handleRevoke}
              togglingRevenue={togglingRevenue}
              onToggleRevenue={handleToggleRevenue}
              t={t}
            />
          ))
        )}
      </section>

      {/* Inactive / not-yet-accepted staff */}
      {inactiveStaff.length > 0 && (
        <section className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[oklch(0.65_0_0)] px-1">
            {t('staff.revokedAccess')}
          </p>
          {inactiveStaff.map((s) => (
            <StaffRow
              key={s.id}
              staff={s}
              revoking={revoking}
              onRevoke={handleRevoke}
              dimmed
              t={t}
            />
          ))}
        </section>
      )}

      {/* Invite dialog */}
      <Dialog open={dialogOpen} onOpenChange={closeDialog}>
        <DialogContent
          className="max-w-sm rounded-[20px] p-0 overflow-hidden"
          style={{
            boxShadow: '0 8px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
          }}
        >
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="text-[16px] font-semibold tracking-tight">
              {inviteResult ? t('staff.inviteCreated') : t('staff.inviteEmployee')}
            </DialogTitle>
          </DialogHeader>

          {inviteResult ? (
            /* Success state — show invite URL */
            <div className="px-6 pb-6 pt-4 space-y-4">
              {inviteResult.emailSent && (
                <div className="flex items-center gap-2 rounded-[12px] px-3.5 py-2.5 bg-[#0F6E56]/8 border border-[#0F6E56]/15">
                  <Mail className="w-3.5 h-3.5 text-[#0F6E56] flex-shrink-0" />
                  <p className="text-[12px] text-[#0F6E56]">
                    Un email d&apos;invitation a été envoyé à <strong>{inviteResult.name}</strong>.
                  </p>
                </div>
              )}
              <div
                className="rounded-[14px] p-4"
                style={{ background: 'oklch(0.972 0 0)' }}
              >
                <p className="text-[12px] text-muted-foreground mb-2">
                  {inviteResult.emailSent
                    ? "Lien de secours si l'email n'arrive pas :"
                    : <>{t('staff.shareInviteWith')} <strong className="text-foreground">{inviteResult.name}</strong></>
                  }
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-[11px] bg-white border border-black/08 rounded-[8px] px-2.5 py-1.5 truncate font-mono text-[oklch(0.4_0_0)]">
                    {inviteResult.url}
                  </code>
                  <button
                    onClick={() => copyInviteUrl(inviteResult.url)}
                    className="p-2 rounded-[8px] bg-white border border-black/08 hover:bg-[#0F6E56]/5 transition-colors flex-shrink-0"
                  >
                    {copied
                      ? <Check className="w-3.5 h-3.5 text-[#0F6E56]" />
                      : <Copy className="w-3.5 h-3.5 text-[oklch(0.55_0_0)]" />
                    }
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground text-center">
                {t('staff.inviteValidity')}
              </p>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  className="h-10 text-[13px] gap-1.5"
                  onClick={() => shareViaWhatsApp(inviteResult.url, inviteResult.name)}
                >
                  <MessageCircle className="w-3.5 h-3.5 text-green-600" />
                  WhatsApp
                </Button>
                <Button
                  className="h-10 text-[13px]"
                  style={{ background: 'linear-gradient(135deg, #0F6E56 0%, #16a37d 100%)' }}
                  onClick={closeDialog}
                >
                  {t('staff.done')}
                </Button>
              </div>
            </div>
          ) : (
            /* Form state */
            <div className="px-6 pb-6 pt-4 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[12px]">{t('staff.fullName')} *</Label>
                <Input
                  placeholder="Ex: Sara Benali"
                  value={form.name}
                  onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                  className="h-10 text-[13px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">{t('common.email')} *</Label>
                <Input
                  type="email"
                  placeholder="sara@example.com"
                  value={form.email}
                  onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))}
                  className="h-10 text-[13px]"
                  onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">{t('staff.role')}</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) => setForm(p => ({ ...p, role: (v ?? 'receptionist') as StaffRole }))}
                >
                  <SelectTrigger className="h-10 text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manager">
                      <span className="flex items-center gap-2">🏢 {t('role.manager')}</span>
                    </SelectItem>
                    <SelectItem value="receptionist">
                      <span className="flex items-center gap-2">🛎 {t('role.receptionist')}</span>
                    </SelectItem>
                    <SelectItem value="housekeeping">
                      <span className="flex items-center gap-2">🧹 {t('role.housekeeping')}</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  {form.role === 'manager' && t('staff.roleDesc.manager')}
                  {form.role === 'receptionist' && t('staff.roleDesc.receptionist')}
                  {form.role === 'housekeeping' && t('staff.roleDesc.housekeeping')}
                </p>
              </div>
              <Button
                className="w-full h-10 text-[13px] mt-2"
                style={{ background: 'linear-gradient(135deg, #0F6E56 0%, #16a37d 100%)' }}
                onClick={handleInvite}
                disabled={loading || !form.name.trim() || !form.email.trim()}
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : null}
                {t('staff.sendInvitation')}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StaffRow({
  staff: s,
  revoking,
  onRevoke,
  togglingRevenue,
  onToggleRevenue,
  dimmed = false,
  t,
}: {
  staff: StaffRow
  revoking: string | null
  onRevoke: (id: string) => void
  togglingRevenue?: string | null
  onToggleRevenue?: (id: string, current: boolean) => void
  dimmed?: boolean
  t: (key: string) => string
}) {
  const initials = s.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
  const cfg = roleConfig[s.role]
  const isLinked = !!s.user_id

  return (
    <div
      className="flex items-center justify-between px-4 py-3 rounded-[14px] border transition-all"
      style={{
        background: dimmed ? 'rgba(0,0,0,0.01)' : 'white',
        borderColor: dimmed ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.07)',
        opacity: dimmed ? 0.55 : 1,
        boxShadow: dimmed ? 'none' : '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-semibold flex-shrink-0"
          style={{
            background: dimmed
              ? 'rgba(0,0,0,0.06)'
              : 'linear-gradient(135deg, #0F6E56 0%, #16a37d 100%)',
            color: dimmed ? 'oklch(0.55 0 0)' : 'white',
          }}
        >
          {initials}
        </div>
        <div>
          <p className="text-[13px] font-medium">{s.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${cfg?.color}`}>
              {cfg?.icon} {t(`role.${s.role}`) ?? s.role}
            </span>
            {isLinked ? (
              <span className="flex items-center gap-0.5 text-[10px] text-[#0F6E56]">
                <UserCheck className="w-2.5 h-2.5" /> {t('staff.accountLinked')}
              </span>
            ) : (
              <span className="flex items-center gap-0.5 text-[10px] text-amber-600">
                <Clock className="w-2.5 h-2.5" /> {t('staff.pending')}
              </span>
            )}
          </div>
        </div>
      </div>

      {s.is_active && (
        <div className="flex items-center gap-1.5">
          {onToggleRevenue && (
            <button
              onClick={() => onToggleRevenue(s.id, s.hide_revenue)}
              disabled={togglingRevenue === s.id}
              title={s.hide_revenue ? t('staff.showRevenue') : t('staff.hideRevenue')}
              className={`flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-[8px] transition-colors disabled:opacity-50 ${
                s.hide_revenue
                  ? 'text-amber-600 bg-amber-50 hover:bg-amber-100'
                  : 'text-[oklch(0.55_0_0)] hover:bg-gray-100'
              }`}
            >
              {togglingRevenue === s.id
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : s.hide_revenue
                  ? <EyeOff className="w-3 h-3" />
                  : <Eye className="w-3 h-3" />
              }
              {s.hide_revenue ? t('staff.revenueHidden') : t('staff.revenueVisible')}
            </button>
          )}
          <button
            onClick={() => onRevoke(s.id)}
            disabled={revoking === s.id}
            className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-[8px] text-[oklch(0.55_0_0)] hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
          >
            {revoking === s.id
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <UserX className="w-3 h-3" />
            }
            {t('staff.revoke')}
          </button>
        </div>
      )}

      {!s.is_active && (
        <span className="flex items-center gap-1 text-[11px] text-[oklch(0.6_0_0)] px-2">
          <Shield className="w-3 h-3" /> {t('staff.revoked')}
        </span>
      )}
    </div>
  )
}
