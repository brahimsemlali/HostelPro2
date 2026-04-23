'use client'

import { useState, useEffect } from 'react'
import { resetPasswordAction } from '@/app/actions/auth'
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

  // Supabase sends the recovery token as a hash fragment (#access_token=...&type=recovery)
  // or as a query param (?code=...) depending on auth flow config.
  // We listen for the PASSWORD_RECOVERY auth event, which fires automatically when
  // @supabase/ssr detects the recovery token in the URL.
  useEffect(() => {
    const supabase = createClient()

    // Check if we already have a recovery session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionReady(true)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true)
      } else if (event === 'SIGNED_IN' && session) {
        // May fire after code exchange
        setSessionReady(true)
      }
    })

    // If no auth event within 3s, the link is invalid/expired
    const timeout = setTimeout(() => {
      if (!sessionReady) {
        setSessionError(true)
      }
    }, 3000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const formData = new FormData(e.currentTarget)
    const result = await resetPasswordAction(formData)
    if (result?.error) {
      toast.error(result.error)
      setLoading(false)
    } else {
      setDone(true)
      toast.success('Mot de passe mis à jour!')
      setTimeout(() => {
        window.location.href = '/'
      }, 2000)
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
