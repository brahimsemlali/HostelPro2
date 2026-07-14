'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'
import { rateLimit } from '@/lib/rate-limit'

const RATE_LIMITED_MSG = 'Trop de tentatives. Réessayez dans quelques minutes.'

// Same header precedence as getClientIp() in lib/rate-limit.ts: Vercel
// sanitizes x-forwarded-for / x-real-ip; cf-connecting-ip is spoofable
// and only a last resort.
async function isRateLimited(route: string, limit: number, windowSeconds: number): Promise<boolean> {
  const h = await headers()
  const ip =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    h.get('cf-connecting-ip') ||
    'unknown'
  return !rateLimit({ key: `${route}:${ip}`, limit, windowSeconds }).allowed
}

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
  if (await isRateLimited('login', 10, 900)) return { error: RATE_LIMITED_MSG }

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

  // Superadmins have no property row — redirect them to /admin to avoid dashboard loop
  const superadminEmails = (process.env.SUPERADMIN_EMAILS ?? '').split(',').filter(Boolean)
  if (superadminEmails.includes(email)) {
    return { success: true, redirect: '/admin' }
  }

  // Return success — client will navigate with window.location.href
  // so the new cookie is committed before navigation
  return { success: true }
}

export async function registerAction(formData: FormData) {
  if (await isRateLimited('register', 5, 3600)) return { error: RATE_LIMITED_MSG }

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
  if (await isRateLimited('forgot-password', 5, 3600)) return { error: RATE_LIMITED_MSG }

  const email = formData.get('email') as string
  if (!email) return { error: 'Email requis' }

  const supabase = await getSupabase()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.sweetreservation.com'}/reset-password`,
  })

  // Always return success to avoid user enumeration (don't reveal if email exists)
  if (error && error.message !== 'User not found') {
    return { error: 'Une erreur est survenue. Réessayez.' }
  }

  return { success: true }
}

export async function resetPasswordAction(formData: FormData) {
  if (await isRateLimited('reset-password', 10, 3600)) return { error: RATE_LIMITED_MSG }

  const password = formData.get('password') as string
  if (!password || password.length < 8) {
    return { error: 'Le mot de passe doit contenir au moins 8 caractères' }
  }

  const supabase = await getSupabase()
  const { error } = await supabase.auth.updateUser({ password })

  if (error) return { error: 'Impossible de mettre à jour le mot de passe. Le lien a peut-être expiré.' }

  return { success: true }
}
