import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that DO NOT require authentication (prefix-matched except '/')
const PUBLIC_ROUTE_PREFIXES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/accept-invite',
  '/checkin',           // public pre-check-in page
  '/api/auth',
  '/api/staff/accept-invite',
  '/api/webhooks/lemonsqueezy',
]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public routes and Next.js internals
  // '/' is exact-matched to avoid making every path public (all paths start with '/')
  const isPublic =
    pathname === '/' ||
    PUBLIC_ROUTE_PREFIXES.some((r) => pathname.startsWith(r)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname === '/sitemap.xml' ||
    pathname === '/robots.txt' ||
    pathname === '/opengraph-image' ||
    pathname.startsWith('/google')

  // Create a response that we can mutate cookies on
  let response = NextResponse.next({ request })

  // Always refresh the Supabase session (keeps JWT fresh)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() validates the token with Supabase Auth server
  const { data: { user } } = await supabase.auth.getUser()
  const isAuthenticated = !!user

  // Redirect unauthenticated users to login for protected routes
  if (!isAuthenticated && !isPublic) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    // Only pass relative paths as ?next — prevents open redirect attacks
    if (pathname.startsWith('/') && !pathname.startsWith('//')) {
      loginUrl.searchParams.set('next', pathname)
    }
    return NextResponse.redirect(loginUrl)
  }

  // Redirect authenticated users away from auth pages
  if (isAuthenticated && (pathname === '/login' || pathname === '/register')) {
    const homeUrl = request.nextUrl.clone()
    homeUrl.pathname = '/dashboard'
    return NextResponse.redirect(homeUrl)
  }

  // Expose pathname to server components via header (used for subscription gating)
  response.headers.set('x-pathname', pathname)

  return response
}

export const config = {
  // Match everything except static files and PWA assets
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json)$).*)'],
}
