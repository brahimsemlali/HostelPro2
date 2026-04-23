'use client'

import { useState } from 'react'
import Link from 'next/link'
import { loginAction } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, BedDouble, Users, BarChart3, CheckCircle2, Eye, EyeOff } from 'lucide-react'
import { AppLogo } from '@/components/shared/AppLogo'
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher'
import { useT } from '@/app/context/LanguageContext'

function translateAuthError(msg: string, t: (k: string) => string): string {
  if (msg.includes('Invalid login credentials')) return t('login.error.invalidCredentials') !== 'login.error.invalidCredentials' ? t('login.error.invalidCredentials') : 'Email ou mot de passe incorrect'
  if (msg.includes('Email not confirmed')) return 'Veuillez confirmer votre email avant de vous connecter'
  if (msg.includes('Too many requests')) return 'Trop de tentatives. Réessayez dans quelques minutes'
  if (msg.includes('User not found')) return 'Aucun compte trouvé avec cet email'
  return msg
}

export default function LoginPage() {
  const t = useT()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const result = await loginAction(formData)
    if (result?.error) {
      toast.error(translateAuthError(result.error, t))
      setLoading(false)
    } else if (result?.success) {
      window.location.href = '/dashboard'
    }
  }

  const features = [
    { icon: BedDouble, text: t('login.feature.beds') },
    { icon: Users,     text: t('login.feature.checkin') },
    { icon: BarChart3, text: t('login.feature.reports') },
  ]

  return (
    <div className="min-h-screen flex bg-white">

      {/* ── Left branding panel ── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[42%] p-10 relative overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #061f16 0%, #0F6E56 55%, #0d8f6b 100%)',
        }}
      >
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `radial-gradient(circle, white 1px, transparent 1px)`,
            backgroundSize: '26px 26px',
          }}
        />
        <div
          className="absolute -bottom-28 -right-28 w-96 h-96 rounded-full pointer-events-none opacity-15"
          style={{ background: 'radial-gradient(circle, #5DCAA5, transparent 70%)' }}
        />
        <div
          className="absolute top-1/3 -left-16 w-56 h-56 rounded-full pointer-events-none opacity-[0.07]"
          style={{ background: 'radial-gradient(circle, white, transparent 70%)' }}
        />

        <div className="relative flex items-center gap-3">
          <AppLogo size={40} className="rounded-[12px]" />
          <span className="font-semibold text-white text-[18px] tracking-tight">HostelPro</span>
        </div>

        <div className="relative space-y-7">
          <div className="space-y-3">
            <h2 className="text-[38px] font-medium text-white leading-[1.15] tracking-tight">
              {t('login.branding.headline').split('\n').map((line, i) => (
                <span key={i}>{line}{i === 0 && <br />}</span>
              ))}
            </h2>
            <p className="text-white/50 text-[15px] leading-relaxed max-w-[300px]">
              {t('login.branding.subtitle').split('\n').map((line, i) => (
                <span key={i}>{line}{i === 0 && <br />}</span>
              ))}
            </p>
          </div>

          <div className="space-y-3">
            {features.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div
                  className="w-7 h-7 rounded-[8px] flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.12)' }}
                >
                  <Icon className="w-3.5 h-3.5 text-white/80" />
                </div>
                <span className="text-white/65 text-[13px]">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div
          className="relative rounded-2xl p-4 border border-white/[0.12]"
          style={{ background: 'rgba(255,255,255,0.07)' }}
        >
          <div className="flex items-start gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(93,202,165,0.25)' }}
            >
              <CheckCircle2 className="w-4 h-4 text-[#5DCAA5]" />
            </div>
            <div>
              <p className="text-white/75 text-[12px] leading-relaxed">
                &ldquo;{t('login.testimonial.text')}&rdquo;
              </p>
              <p className="text-white/35 text-[11px] mt-1.5 font-medium">{t('login.testimonial.author')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#F4F6F8]">

        {/* Language switcher */}
        <div className="absolute top-4 right-4">
          <LanguageSwitcher variant="pill" />
        </div>

        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2.5 mb-8">
          <AppLogo size={40} className="rounded-[12px]" />
          <span className="font-semibold text-[18px] tracking-tight">HostelPro</span>
        </div>

        <div className="w-full max-w-[380px]">
          <div className="mb-8">
            <h1 className="text-[26px] font-semibold tracking-tight text-foreground leading-tight">
              {t('login.heading')}
            </h1>
            <p className="text-[14px] text-[oklch(0.52_0_0)] mt-1.5 leading-snug">
              {t('login.subheading')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[13px] font-medium text-foreground">
                {t('login.email')}
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder={t('login.emailPlaceholder')}
                required
                autoComplete="email"
                autoFocus
                className="h-11 text-[14px] bg-white border-[#E8ECF0] rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-[13px] font-medium text-foreground">
                  {t('login.password')}
                </Label>
                <Link
                  href="/forgot-password"
                  className="text-[12px] text-[#0F6E56] hover:underline font-medium"
                >
                  {t('login.forgotPassword')}
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="h-11 text-[14px] bg-white border-[#E8ECF0] rounded-xl pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[oklch(0.55_0_0)] hover:text-[oklch(0.35_0_0)] transition-colors"
                  aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

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
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('login.submitting')}</>
              ) : (
                t('login.submit')
              )}
            </Button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-black/[0.08]" />
            <span className="text-[11px] text-[oklch(0.60_0_0)] font-medium">{t('common.or')}</span>
            <div className="flex-1 h-px bg-black/[0.08]" />
          </div>

          <p className="text-center text-[13px] text-[oklch(0.52_0_0)]">
            {t('login.noAccount')}{' '}
            <Link href="/register" className="text-[#0F6E56] hover:underline font-semibold">
              {t('login.createAccount')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
