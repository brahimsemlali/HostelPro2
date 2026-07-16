import * as Sentry from '@sentry/nextjs'

// Next.js instrumentation hook — loads the right Sentry init per runtime.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

// Captures errors thrown in Server Components / route handlers / server actions
// (the paths where errors currently vanish into a Sonner toast at best).
export const onRequestError = Sentry.captureRequestError
