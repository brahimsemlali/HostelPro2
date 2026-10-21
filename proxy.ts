import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that DO NOT require authentication (prefix-matched except '/')
const PUBLIC_ROUTE_PREFIXES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/checkin',           // public pre-check-in page
  '/api/checkin',       // public pre-check-in submit endpoint
  '/api/auth',
  '/api/webhooks/lemonsqueezy',
  '/blog',              // public marketing/SEO pages
  '/logiciel-hostel',   // city landing pages (marrakech, agadir, ...)
]

// Pure-public routes that NEVER depend on auth state — no need to touch Supabase
// at all. Skipping getUser() here removes a needless auth round-trip from every
// marketing/SEO page load and lets those pages be served/cached statically.
// (Auth-aware public routes '/', '/login', '/register' are handled below because
//  they redirect *authenticated* users to /dashboard and so still need getUser.)
function isPurelyPublic(pathname: string): boolean {
  return (
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/checkin') ||
    pathname.startsWith('/api/checkin') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/webhooks/lemonsqueezy') ||
    pathname.startsWith('/blog') ||
    pathname.startsWith('/logiciel-hostel') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname === '/sitemap.xml' ||
    pathname === '/robots.txt' ||
    pathname === '/llms.txt' ||
    pathname === '/llms-full.md' ||
    pathname === '/opengraph-image' ||
    pathname.startsWith('/google')
  )
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Expose the pathname to server components (subscription gating in the
  // dashboard layout reads it via headers()). It must be set on the *request*
  // headers — response headers never reach headers() — and any client-sent
  // copy is dropped first so the paywall can't be skipped by spoofing it.
  const forwarded = new Headers(request.headers)
  forwarded.delete('x-pathname')
  forwarded.set('x-pathname', pathname)
  const next = () => NextResponse.next({ request: { headers: forwarded } })

  // Fast path: pure-public routes skip Supabase entirely (no auth round-trip).
  if (isPurelyPublic(pathname)) {
    return next()
  }

  // Allow public routes and Next.js internals
  // '/' is exact-matched to avoid making every path public (all paths start with '/')
  const isPublic =
    pathname === '/' ||
    PUBLIC_ROUTE_PREFIXES.some((r) => pathname.startsWith(r)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname === '/sitemap.xml' ||
    pathname === '/robots.txt' ||
    pathname === '/llms.txt' ||
    pathname === '/llms-full.md' ||
    pathname === '/opengraph-image' ||
    pathname.startsWith('/google')

  // Create a response that we can mutate cookies on
  let response = next()

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
          // Keep the refreshed cookies on the forwarded request headers too
          forwarded.set('cookie', request.cookies.toString())
          response = next()
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

  // Redirect authenticated users away from auth pages and the landing page
  if (isAuthenticated && (pathname === '/' || pathname === '/login' || pathname === '/register')) {
    const homeUrl = request.nextUrl.clone()
    homeUrl.pathname = '/dashboard'
    return NextResponse.redirect(homeUrl)
  }

  return response
}

export const config = {
  // Match everything except static files and PWA assets
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|glb)$).*)'],
}
