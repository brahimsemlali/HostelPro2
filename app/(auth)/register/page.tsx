'use client'

import { useState } from 'react'
import Link from 'next/link'
import { registerAction } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, Shield, Zap, Globe, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react'
import { AppLogo } from '@/components/shared/AppLogo'
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher'
import { useT } from '@/app/context/LanguageContext'

function translateAuthError(msg: string): string {
  if (msg.includes('User already registered')) return 'Un compte existe déjà avec cet email'
  if (msg.includes('Password should be at least')) return 'Le mot de passe doit contenir au moins 8 caractères'
  if (msg.includes('Unable to validate email')) return 'Adresse email invalide'
  if (msg.includes('Too many requests')) return 'Trop de tentatives. Réessayez dans quelques minutes'
  return msg
}

export default function RegisterPage() {
  const t = useT()
  const [loading, setLoading] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (password !== confirm) {
      toast.error(t('register.passwordsMismatch'))
      return
    }
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const result = await registerAction(formData)
    if (result?.error) {
      toast.error(translateAuthError(result.error))
      setLoading(false)
    } else if (result?.needsConfirmation) {
      toast.success('Compte créé! Vérifiez votre email.')
      window.location.href = '/login'
    } else if (result?.success) {
      window.location.href = result.redirect ?? '/onboarding'
    }
  }

  const highlights = [
    { icon: Zap,    text: t('register.highlight.ready') },
    { icon: Shield, text: t('register.highlight.secure') },
    { icon: Globe,  text: t('register.highlight.multilingual') },
  ]

  return (
    <div className="min-h-screen flex bg-white">

      {/* ── Left Panel ── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[42%] p-10 relative overflow-hidden"
        style={{ background: 'linear-gradient(150deg, #072b1f 0%, #0F6E56 50%, #0d8f6b 100%)' }}
      >
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: `radial-gradient(circle, white 1px, transparent 1px)`,
            backgroundSize: '28px 28px',
          }}
        />
        <div
          className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #5DCAA5, transparent 70%)' }}
        />

        <div className="relative flex items-center gap-3">
          <AppLogo size={40} className="rounded-[12px]" />
          <span className="font-semibold text-white text-[18px] tracking-tight">HostelPro</span>
        </div>

        <div className="relative space-y-6">
          <div className="space-y-2">
            <h2 className="text-[36px] font-medium text-white leading-tight tracking-tight">
              {t('register.branding.headline').split('\n').map((line, i) => (
                <span key={i}>{line}{i === 0 && <br />}</span>
              ))}
            </h2>
            <p className="text-white/50 text-[15px] leading-relaxed">
              {t('register.branding.subtitle')}
            </p>
          </div>
          <div className="space-y-3">
            {highlights.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-3.5 h-3.5 text-white/80" />
                </div>
                <span className="text-white/70 text-[13px]">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-white/30 text-[12px]">
          {t('register.footer')}
        </p>
      </div>

      {/* ── Right Panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[oklch(0.972_0_0)]">

        {/* Language switcher */}
        <div className="absolute top-4 right-4">
          <LanguageSwitcher variant="pill" />
        </div>

        <div className="lg:hidden flex items-center gap-2.5 mb-8">
          <AppLogo size={40} className="rounded-[12px]" />
          <span className="font-semibold text-[18px] tracking-tight">HostelPro</span>
        </div>

        <div className="w-full max-w-[380px]">
          <div className="mb-8">
            <h1 className="text-[26px] font-semibold tracking-tight text-foreground leading-tight">
              {t('register.heading')}
            </h1>
            <p className="text-[14px] text-[oklch(0.52_0_0)] mt-1.5 leading-snug">
              {t('register.subheading')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[13px] font-medium">{t('register.email')}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="vous@exemple.com"
                required
                autoComplete="email"
                autoFocus
                className="h-11 text-[14px] bg-white border-[oklch(0.88_0_0)] rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[13px] font-medium">{t('register.password')}</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPass ? 'text' : 'password'}
                  placeholder={t('register.passwordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="h-11 text-[14px] bg-white border-[oklch(0.88_0_0)] rounded-xl pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[oklch(0.55_0_0)] hover:text-[oklch(0.35_0_0)] transition-colors"
                  aria-label={showPass ? t('register.hidePassword') : t('register.showPassword')}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm" className="text-[13px] font-medium">{t('register.confirmPassword')}</Label>
              <div className="relative">
                <Input
                  id="confirm"
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="h-11 text-[14px] bg-white border-[oklch(0.88_0_0)] rounded-xl pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[oklch(0.55_0_0)] hover:text-[oklch(0.35_0_0)] transition-colors"
                  aria-label={showConfirm ? t('register.hidePassword') : t('register.showPassword')}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {confirm.length > 0 && (
              <div className={`flex items-center gap-1.5 text-[12px] font-medium ${password === confirm ? 'text-emerald-600' : 'text-red-500'}`}>
                {password === confirm
                  ? <><CheckCircle2 className="w-3.5 h-3.5" /> {t('register.passwordsMatch')}</>
                  : <><XCircle className="w-3.5 h-3.5" /> {t('register.passwordsMismatch')}</>
                }
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 text-[14px] font-semibold rounded-xl mt-1"
              disabled={loading}
              style={{
                background: loading
                  ? '#0a5240'
                  : 'linear-gradient(135deg, #0F6E56 0%, #16a37d 100%)',
                border: 'none',
                boxShadow: loading ? 'none' : '0 2px 12px rgba(15,110,86,0.28)',
              }}
            >
              {loading
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('register.submitting')}</>
                : t('register.submit')
              }
            </Button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-black/[0.08]" />
            <span className="text-[11px] text-[oklch(0.60_0_0)] font-medium">{t('common.or')}</span>
            <div className="flex-1 h-px bg-black/[0.08]" />
          </div>

          <p className="text-center text-[13px] text-[oklch(0.52_0_0)]">
            {t('register.hasAccount')}{' '}
            <Link href="/login" className="text-[#0F6E56] hover:underline font-semibold">
              {t('register.login')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
