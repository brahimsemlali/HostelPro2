'use client'

import { useState, useCallback } from 'react'
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
import type { Staff, StaffRole } from '@/types'
import {
  Plus, Copy, Check, MessageCircle, UserX, RefreshCw,
  UserCheck, Shield, Loader2, Users, Eye, EyeOff,
  KeyRound, AlertTriangle,
} from 'lucide-react'
import { useT } from '@/app/context/LanguageContext'
import { buildWhatsAppLink } from '@/lib/whatsapp/templates'

type StaffRow = Pick<Staff, 'id' | 'name' | 'role' | 'phone' | 'is_active' | 'hide_revenue' | 'user_id' | 'created_at'>

const roleConfig: Record<string, { color: string; icon: string }> = {
  manager:      { color: 'bg-blue-50 text-blue-700 border-blue-100',              icon: '🏢' },
  receptionist: { color: 'bg-[#0F6E56]/8 text-[#0F6E56] border-[#0F6E56]/15',   icon: '🛎' },
  housekeeping: { color: 'bg-amber-50 text-amber-700 border-amber-100',           icon: '🧹' },
}

const CHARS = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$'
function generatePassword(): string {
  return Array.from({ length: 12 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('')
}

interface Props {
  propertyId: string
  staff: StaffRow[]
  pendingInvitations: unknown[]  // kept for page.tsx compat — no longer displayed
}

type CreatedCredentials = { name: string; email: string; password: string; phone: string }

export function StaffClient({ staff }: Props) {
  const router = useRouter()
  const t = useT()

  const [dialogOpen, setDialogOpen]     = useState(false)
  const [loading, setLoading]           = useState(false)
  const [revoking, setRevoking]         = useState<string | null>(null)
  const [togglingRevenue, setTogglingRevenue] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [copiedField, setCopiedField]   = useState<'email' | 'password' | 'all' | null>(null)
  const [credentials, setCredentials]   = useState<CreatedCredentials | null>(null)
  const [confirmed, setConfirmed]       = useState(false)

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'receptionist' as StaffRole,
    password: generatePassword(),
  })

  const activeStaff   = staff.filter(s => s.is_active && s.user_id)
  const inactiveStaff = staff.filter(s => !s.is_active || !s.user_id)

  const refreshPassword = useCallback(() => {
    setForm(p => ({ ...p, password: generatePassword() }))
  }, [])

  async function handleCreate() {
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      toast.error('Nom, email et mot de passe sont requis')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/staff/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role,
          phone: form.phone.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur serveur')
      setCredentials({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        phone: form.phone.trim(),
      })
      setConfirmed(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur serveur')
    } finally {
      setLoading(false)
    }
  }

  async function copyField(text: string, field: 'email' | 'password' | 'all') {
    await navigator.clipboard.writeText(text)
    setCopiedField(field)
    toast.success('Copié !')
    setTimeout(() => setCopiedField(null), 2000)
  }

  function shareViaWhatsApp() {
    if (!credentials) return
    const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/login`
    const message =
      `Bonjour ${credentials.name} 👋\n\nVoici vos identifiants pour HostelPro :\n\n` +
      `📧 Email : ${credentials.email}\n` +
      `🔑 Mot de passe : ${credentials.password}\n\n` +
      `🔗 Se connecter : ${loginUrl}\n\n` +
      `Gardez ces informations en sécurité. Vous pouvez changer votre mot de passe dans les paramètres.`
    const phone = credentials.phone.replace(/\D/g, '')
    window.open(buildWhatsAppLink(phone || '', message), '_blank')
  }

  function closeDialog() {
    setDialogOpen(false)
    setCredentials(null)
    setConfirmed(false)
    setShowPassword(false)
    setForm({ name: '', email: '', phone: '', role: 'receptionist', password: generatePassword() })
  }

  async function handleRevoke(staffId: string) {
    setRevoking(staffId)
    try {
      const res = await fetch('/api/staff/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId }),
      })
      if (!res.ok) throw new Error()
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
      if (!res.ok) throw new Error()
      toast.success(!currentHideRevenue ? t('staff.revenueHidden') : t('staff.revenueVisible'))
      router.refresh()
    } catch {
      toast.error(t('staff.updateError'))
    } finally {
      setTogglingRevenue(null)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">{t('staff.team')}</h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            {activeStaff.length} {t('staff.active')}
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
            <p className="text-[11px] text-muted-foreground mt-0.5">{t('staff.inviteToStart')}</p>
          </div>
        ) : (
          activeStaff.map((s) => (
            <StaffMemberRow
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

      {/* Revoked staff */}
      {inactiveStaff.length > 0 && (
        <section className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[oklch(0.65_0_0)] px-1">
            {t('staff.revokedAccess')}
          </p>
          {inactiveStaff.map((s) => (
            <StaffMemberRow
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

      {/* Create staff dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog() }}>
        <DialogContent
          className="max-w-sm rounded-[20px] p-0 overflow-hidden"
          style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)' }}
        >
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="text-[16px] font-semibold tracking-tight">
              {credentials ? 'Identifiants créés' : 'Créer un compte employé'}
            </DialogTitle>
          </DialogHeader>

          {credentials ? (
            /* ── Credentials display ── */
            <div className="px-6 pb-6 pt-4 space-y-4">
              {/* Warning banner */}
              <div className="flex items-start gap-2.5 rounded-[12px] px-3.5 py-3 bg-amber-50 border border-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-[12px] text-amber-800 leading-relaxed">
                  <strong>Ce mot de passe ne sera plus affiché.</strong> Copiez-le ou partagez-le maintenant.
                </p>
              </div>

              {/* Email */}
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Email</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-[12px] bg-white border border-black/08 rounded-[8px] px-3 py-2 font-mono text-[oklch(0.3_0_0)]">
                    {credentials.email}
                  </code>
                  <button
                    onClick={() => copyField(credentials.email, 'email')}
                    className="p-2 rounded-[8px] bg-white border border-black/08 hover:bg-[#0F6E56]/5 transition-colors flex-shrink-0"
                  >
                    {copiedField === 'email'
                      ? <Check className="w-3.5 h-3.5 text-[#0F6E56]" />
                      : <Copy className="w-3.5 h-3.5 text-[oklch(0.55_0_0)]" />}
                  </button>
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Mot de passe</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-[13px] bg-white border border-black/08 rounded-[8px] px-3 py-2 font-mono font-semibold text-[oklch(0.2_0_0)] tracking-wider">
                    {showPassword ? credentials.password : '•'.repeat(credentials.password.length)}
                  </code>
                  <button
                    onClick={() => setShowPassword(v => !v)}
                    className="p-2 rounded-[8px] bg-white border border-black/08 hover:bg-gray-50 transition-colors flex-shrink-0"
                  >
                    {showPassword
                      ? <EyeOff className="w-3.5 h-3.5 text-[oklch(0.55_0_0)]" />
                      : <Eye className="w-3.5 h-3.5 text-[oklch(0.55_0_0)]" />}
                  </button>
                  <button
                    onClick={() => copyField(credentials.password, 'password')}
                    className="p-2 rounded-[8px] bg-white border border-black/08 hover:bg-[#0F6E56]/5 transition-colors flex-shrink-0"
                  >
                    {copiedField === 'password'
                      ? <Check className="w-3.5 h-3.5 text-[#0F6E56]" />
                      : <Copy className="w-3.5 h-3.5 text-[oklch(0.55_0_0)]" />}
                  </button>
                </div>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button
                  variant="outline"
                  className="h-10 text-[13px] gap-1.5"
                  onClick={() => copyField(
                    `Email: ${credentials.email}\nMot de passe: ${credentials.password}\nConnexion: ${process.env.NEXT_PUBLIC_APP_URL ?? ''}/login`,
                    'all'
                  )}
                >
                  {copiedField === 'all'
                    ? <Check className="w-3.5 h-3.5 text-[#0F6E56]" />
                    : <Copy className="w-3.5 h-3.5" />}
                  Tout copier
                </Button>
                <Button
                  variant="outline"
                  className="h-10 text-[13px] gap-1.5"
                  onClick={shareViaWhatsApp}
                >
                  <MessageCircle className="w-3.5 h-3.5 text-green-600" />
                  WhatsApp
                </Button>
              </div>

              {/* Confirmation checkbox */}
              <label className="flex items-start gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-0.5 accent-[#0F6E56]"
                />
                <span className="text-[12px] text-muted-foreground group-hover:text-foreground transition-colors">
                  J&apos;ai sauvegardé ou partagé les identifiants avec <strong className="text-foreground">{credentials.name}</strong>.
                </span>
              </label>

              <Button
                className="w-full h-10 text-[13px]"
                style={{ background: 'linear-gradient(135deg, #0F6E56 0%, #16a37d 100%)' }}
                disabled={!confirmed}
                onClick={closeDialog}
              >
                Fermer
              </Button>
            </div>
          ) : (
            /* ── Create form ── */
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
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[12px]">Téléphone (WhatsApp)</Label>
                <Input
                  type="tel"
                  placeholder="+212 6XX XXX XXX"
                  value={form.phone}
                  onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))}
                  className="h-10 text-[13px]"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[12px]">Mot de passe *</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={(e) => setForm(p => ({ ...p, password: e.target.value }))}
                      className="h-10 text-[13px] font-mono pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[oklch(0.6_0_0)] hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={refreshPassword}
                    title="Générer un nouveau mot de passe"
                    className="h-10 w-10 rounded-[8px] border border-black/10 flex items-center justify-center text-[oklch(0.55_0_0)] hover:bg-[#0F6E56]/5 hover:text-[#0F6E56] transition-colors flex-shrink-0"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <KeyRound className="w-3 h-3" />
                  Généré automatiquement — vous pourrez le partager à l&apos;étape suivante.
                </p>
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
                  {form.role === 'manager'      && t('staff.roleDesc.manager')}
                  {form.role === 'receptionist' && t('staff.roleDesc.receptionist')}
                  {form.role === 'housekeeping' && t('staff.roleDesc.housekeeping')}
                </p>
              </div>

              <Button
                className="w-full h-10 text-[13px] mt-2"
                style={{ background: 'linear-gradient(135deg, #0F6E56 0%, #16a37d 100%)' }}
                onClick={handleCreate}
                disabled={loading || !form.name.trim() || !form.email.trim() || !form.password}
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />}
                Créer le compte
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StaffMemberRow({
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
                Compte non lié
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
