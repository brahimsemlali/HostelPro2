'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

// Catches errors in the root layout itself (the last-resort boundary). Renders
// its own <html>/<body> because the failing layout can't be relied on.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="fr">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#F5F5F7' }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            padding: 24,
            textAlign: 'center',
            color: '#0A1F1C',
          }}
        >
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Une erreur est survenue</h1>
          <p style={{ color: '#475569', maxWidth: 420, margin: 0, fontSize: 14 }}>
            Quelque chose s&apos;est mal passé. Nos équipes ont été notifiées. Réessayez dans un instant.
          </p>
          <button
            onClick={() => reset()}
            style={{
              marginTop: 8,
              background: '#0F6E56',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              padding: '10px 20px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  )
}
