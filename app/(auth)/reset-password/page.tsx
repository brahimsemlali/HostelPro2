'use client'

import { useState, useEffect, useRef } from 'react'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { AppLogo } from '@/components/shared/AppLogo'

export default function ResetPasswordPage() {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [sessionReady, setSessionReady] = useState(false)
  const [sessionError, setSessionError] = useState(false)

  // The recovery one-time token. When the email template links to
  //   /reset-password?token_hash=...&type=recovery
  // we DO NOT verify it on load — we only consume it when the user submits the
  // form below. Passive link scanners (Gmail, corporate mail security) do a GET
  // but never submit, so they can no longer burn the token before the real click.
  const tokenHashRef = useRef<string | null>(null)
  const recoveryTypeRef = useRef<EmailOtpType>('recovery')
  const readyRef = useRef(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const th = params.get('token_hash')
    const ty = params.get('type')

    // Preferred, prefetch-safe path: a token_hash is present in the URL.
    if (th) {
      tokenHashRef.current = th
      if (ty) recoveryTypeRef.current = ty as EmailOtpType
      readyRef.current = true
      // The token lives only in the client URL (absent during SSR), so we reveal
      // the form once on mount. One extra render is fine here.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSessionReady(true)
      return
    }

    // Legacy fallback: older links deliver the session via a URL hash
    // (#access_token=...) or a ?code=... that @supabase/ssr exchanges on load.
    const supabase = createClient()

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        readyRef.current = true
        setSessionReady(true)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        readyRef.current = true
        setSessionReady(true)
      }
    })

    // If no recovery session materialised, the link is genuinely invalid/expired.
    const timeout = setTimeout(() => {
      if (!readyRef.current) setSessionError(true)
    }, 4000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (password !== confirm) {
      toast.error('Les mots de passe ne correspondent pas')
      return
    }
    if (password.length < 8) {
      toast.error('Le mot de passe doit contenir au moins 8 caractères')
      return
    }

    setLoading(true)
    const supabase = createClient()

    try {
      // Consume the recovery token now (only on explicit submit).
      if (tokenHashRef.current) {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          type: recoveryTypeRef.current,
          token_hash: tokenHashRef.current,
        })
        if (verifyError) {
          setSessionError(true)
          setLoading(false)
          return
        }
      }

      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        toast.error('Impossible de mettre à jour le mot de passe. Le lien a peut-être expiré.')
        setLoading(false)
        return
      }

      setDone(true)
      toast.success('Mot de passe mis à jour!')
      setTimeout(() => {
        window.location.href = '/'
      }, 2000)
    } catch {
      toast.error('Une erreur est survenue. Réessayez.')
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="flex justify-center">
              <CheckCircle2 className="w-16 h-16 text-[#0F6E56]" />
            </div>
            <CardTitle className="text-xl font-medium">Mot de passe mis à jour!</CardTitle>
            <CardDescription>Vous allez être redirigé vers le tableau de bord...</CardDescription>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (sessionError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="flex justify-center">
              <XCircle className="w-16 h-16 text-destructive" />
            </div>
            <CardTitle className="text-xl font-medium">Lien invalide ou expiré</CardTitle>
            <CardDescription>
              Ce lien de réinitialisation n&apos;est plus valide. Les liens expirent après 1 heure.
            </CardDescription>
            <Button
              className="w-full bg-[#0F6E56] hover:bg-[#0c5a46]"
              onClick={() => { window.location.href = '/forgot-password' }}
            >
              Demander un nouveau lien
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!sessionReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#0F6E56]" />
            <CardDescription>Vérification du lien...</CardDescription>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-3">
            <AppLogo size={48} className="rounded-xl" />
          </div>
          <CardTitle className="text-2xl font-medium">Nouveau mot de passe</CardTitle>
          <CardDescription>Choisissez un mot de passe sécurisé (8 caractères minimum)</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nouveau mot de passe</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="8 caractères minimum"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoFocus
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirmer le mot de passe</Label>
              <Input
                id="confirm"
                type="password"
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-[#0F6E56] hover:bg-[#0c5a46]"
              disabled={loading}
            >
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Mise à jour...</>
              ) : (
                'Mettre à jour le mot de passe'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
