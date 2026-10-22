import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

// Server-side one-time-token sign-in: /api/auth/confirm?token_hash=…&type=magiclink&next=/dashboard
// Used by the superadmin "log in as owner" link (a magic link generated with
// the admin API). The token is single-use and short-lived; verifying it sets
// the session cookies, which REPLACES whatever session this browser had.
// No sign-out before verifying: that would let any page log visitors out by
// embedding this URL.
const ALLOWED_TYPES: EmailOtpType[] = ['magiclink', 'email']

export async function GET(req: NextRequest) {
  const tokenHash = req.nextUrl.searchParams.get('token_hash')
  const type = req.nextUrl.searchParams.get('type') as EmailOtpType | null
  const rawNext = req.nextUrl.searchParams.get('next') ?? '/dashboard'

  // Same-origin redirect only (see /api/auth/callback).
  let next = '/dashboard'
  try {
    const dest = new URL(rawNext, req.url)
    if (dest.origin === req.nextUrl.origin) next = dest.pathname + dest.search
  } catch {
    // keep the default
  }

  if (tokenHash && type && ALLOWED_TYPES.includes(type)) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          },
        },
      },
    )
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (!error) return NextResponse.redirect(new URL(next, req.url))
  }

  return NextResponse.redirect(new URL('/login?error=link_invalid', req.url))
}
