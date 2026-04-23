'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}

export async function loginAction(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return { error: 'Email invalide' }
  }
  if (!password || typeof password !== 'string' || password.length < 1) {
    return { error: 'Mot de passe requis' }
  }

  const supabase = await getSupabase()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) return { error: error.message }

  // Return success — client will navigate with window.location.href
  // so the new cookie is committed before navigation
  return { success: true }
}

export async function registerAction(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return { error: 'Email invalide' }
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    return { error: 'Le mot de passe doit contenir au moins 8 caractères' }
  }

  const supabase = await getSupabase()
  const { data, error } = await supabase.auth.signUp({ email, password })

  if (error) return { error: error.message }

  if (data.session) {
    return { success: true, redirect: '/onboarding' }
  }

  return { needsConfirmation: true }
}

export async function logoutAction() {
  const supabase = await getSupabase()
  await supabase.auth.signOut()
  return { success: true }
}

export async function forgotPasswordAction(formData: FormData) {
  const email = formData.get('email') as string
  if (!email) return { error: 'Email requis' }

  const supabase = await getSupabase()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
  })

  // Always return success to avoid user enumeration (don't reveal if email exists)
  if (error && error.message !== 'User not found') {
    return { error: 'Une erreur est survenue. Réessayez.' }
  }

  return { success: true }
}

export async function resetPasswordAction(formData: FormData) {
  const password = formData.get('password') as string
  if (!password || password.length < 8) {
    return { error: 'Le mot de passe doit contenir au moins 8 caractères' }
  }

  const supabase = await getSupabase()
  const { error } = await supabase.auth.updateUser({ password })

  if (error) return { error: 'Impossible de mettre à jour le mot de passe. Le lien a peut-être expiré.' }

  return { success: true }
}
