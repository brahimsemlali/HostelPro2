import * as Sentry from '@sentry/nextjs'

// Server-side (Node runtime) Sentry init. No-ops until NEXT_PUBLIC_SENTRY_DSN
// is set, and only reports in production so local/dev noise never reaches it.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN && process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.1,
  // Don't capture request bodies / headers that could contain guest PII.
  sendDefaultPii: false,
})
