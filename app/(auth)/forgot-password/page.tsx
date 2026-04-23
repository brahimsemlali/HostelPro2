'use client'

import { useState } from 'react'
import Link from 'next/link'
import { forgotPasswordAction } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, ArrowLeft, CheckCircle2, KeyRound } from 'lucide-react'
import { AppLogo } from '@/components/shared/AppLogo'

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const result = await forgotPasswordAction(formData)
    if (result?.error) {
      toast.error(result.error)
      setLoading(false)
    } else {
      setSent(true)
    }
  }

  return (
    <div className="min-h-screen flex bg-white">

      {/* ── Left Panel ── */}
      <div
        className="hidden lg:flex flex-col justify-center items-center w-[42%] p-10 relative overflow-hidden"
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

        <div className="relative text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center mx-auto">
            <KeyRound className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-[28px] font-medium text-white tracking-tight">
            Mot de passe oublié?
          </h2>
          <p className="text-white/50 text-[14px] leading-relaxed max-w-[260px] mx-auto">
            Pas de panique. Entrez votre email et nous vous enverrons un lien de réinitialisation.
          </p>
        </div>
      </div>

      {/* ── Right Panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[oklch(0.972_0_0)]">
        <div className="lg:hidden flex items-center gap-2.5 mb-8">
          <AppLogo size={40} className="rounded-[12px]" />
          <span className="font-semibold text-[18px] tracking-tight">HostelPro</span>
        </div>

        <div className="w-full max-w-[380px]">
          {sent ? (
            <div className="text-center space-y-5">
              <div className="w-16 h-16 rounded-full bg-[#0F6E56]/10 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-[#0F6E56]" />
              </div>
              <div>
                <h1 className="text-[22px] font-medium tracking-tight text-foreground">Email envoyé!</h1>
                <p className="text-[14px] text-[oklch(0.55_0_0)] mt-2 leading-relaxed">
                  Si un compte existe pour cette adresse, vous recevrez un lien dans quelques minutes. Pensez à vérifier vos spams.
                </p>
              </div>
              <Button
                className="w-full h-10"
                onClick={() => { window.location.href = '/login' }}
                style={{ background: 'linear-gradient(135deg, #0F6E56 0%, #16a37d 100%)', border: 'none' }}
              >
                Retour à la connexion
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h1 className="text-[24px] font-medium tracking-tight text-foreground">Réinitialiser</h1>
                <p className="text-[14px] text-[oklch(0.55_0_0)] mt-1">
                  Entrez votre email pour recevoir un lien de réinitialisation.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-[13px] font-medium">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="vous@exemple.com"
                    required
                    autoComplete="email"
                    autoFocus
                    className="h-10 text-[14px] bg-white border-[oklch(0.88_0_0)]"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-10 text-[14px] font-medium"
                  disabled={loading}
                  style={{
                    background: 'linear-gradient(135deg, #0F6E56 0%, #16a37d 100%)',
                    border: 'none',
                  }}
                >
                  {loading
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Envoi...</>
                    : 'Envoyer le lien de réinitialisation'
                  }
                </Button>
              </form>

              <Link
                href="/login"
                className="flex items-center justify-center gap-1.5 text-[13px] text-[oklch(0.55_0_0)] hover:text-foreground transition-colors mt-5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Retour à la connexion
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
