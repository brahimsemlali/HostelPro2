'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import { AppLogo } from '@/components/shared/AppLogo'
import { useT } from '@/app/context/LanguageContext'

interface Props {
  token: string
  invitation: {
    id: string
    name: string
    email: string
    role: 'manager' | 'receptionist' | 'housekeeping'
    propertyName: string
  }
}

export function AcceptInviteClient({ token, invitation }: Props) {
  const router = useRouter()
  const t = useT()
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleAccept() {
    if (password.length < 8) {
      toast.error(t('acceptInvite.passwordTooShort'))
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()

      // 1. Create the Supabase auth account
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: invitation.email,
        password,
        options: {
          data: { full_name: invitation.name },
        },
      })

      if (signUpError) {
        // If user already exists, try signing in
        if (signUpError.message.includes('already registered')) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: invitation.email,
            password,
          })
          if (signInError) throw signInError
        } else {
          throw signUpError
        }
      }

      const userId = authData?.user?.id
      if (!userId && !authData?.session) {
        // Account created but needs email confirmation
        toast.success(t('acceptInvite.checkEmail'))
        return
      }

      // 2. Mark invitation as accepted + link user_id to staff record via API
      const res = await fetch('/api/staff/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })

      if (!res.ok) throw new Error(t('acceptInvite.linkError'))

      toast.success(t('acceptInvite.welcome').replace('{name}', invitation.name))
      router.push('/')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[oklch(0.972_0_0)] p-4">
      <div
        className="bg-white rounded-2xl p-8 max-w-sm w-full hp-fade-up"
        style={{
          boxShadow: '0 4px 24px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04)',
          border: '1px solid rgba(0,0,0,0.06)',
        }}
      >
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <AppLogo size={56} className="rounded-2xl" />
        </div>

        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-[20px] font-semibold tracking-tight mb-1">
            {t('acceptInvite.title')}
          </h1>
          <p className="text-[13px] text-muted-foreground">
            {t('acceptInvite.joinPrefix')}{' '}
            <strong className="text-foreground">{invitation.propertyName}</strong>{' '}
            {t('acceptInvite.joinSuffix')}{' '}
            <span className="px-1.5 py-0.5 bg-[#0F6E56]/10 text-[#0F6E56] rounded-full text-[12px] font-medium">
              {t(`role.${invitation.role}`)}
            </span>
          </p>
        </div>

        {/* Info card */}
        <div className="bg-[oklch(0.972_0_0)] rounded-xl p-4 mb-5 space-y-1.5">
          <div className="flex justify-between text-[13px]">
            <span className="text-muted-foreground">{t('common.name')}</span>
            <span className="font-medium">{invitation.name}</span>
          </div>
          <div className="flex justify-between text-[13px]">
            <span className="text-muted-foreground">{t('common.email')}</span>
            <span className="font-medium">{invitation.email}</span>
          </div>
          <div className="flex justify-between text-[13px]">
            <span className="text-muted-foreground">{t('staff.role')}</span>
            <span className="font-medium">{t(`role.${invitation.role}`)}</span>
          </div>
        </div>

        {/* Password */}
        <div className="space-y-1.5 mb-5">
          <Label className="text-[13px]">{t('acceptInvite.choosePassword')}</Label>
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('acceptInvite.passwordPlaceholder')}
              className="pr-10"
              onKeyDown={(e) => e.key === 'Enter' && handleAccept()}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <Button
          className="w-full h-11 text-[14px]"
          style={{ background: 'linear-gradient(135deg, #0F6E56 0%, #16a37d 100%)' }}
          onClick={handleAccept}
          disabled={loading || password.length < 8}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : null}
          {t('acceptInvite.createAndJoin')}
        </Button>

        <p className="text-center text-[11px] text-muted-foreground mt-4">
          {t('acceptInvite.alreadyHaveAccount')}{' '}
          <button
            onClick={() => router.push(`/login?redirect=/accept-invite?token=${token}`)}
            className="text-[#0F6E56] underline"
          >
            {t('login.submit')}
          </button>
        </p>
      </div>
    </div>
  )
}
