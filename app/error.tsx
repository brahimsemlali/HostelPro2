'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { RotateCw } from 'lucide-react'

// Catch-all in-app error boundary (renders inside the root layout). Any segment
// without its own error.tsx surfaces here instead of a blank crash, and the
// error is reported to Sentry rather than vanishing.
export default function Error({
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
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-semibold text-[#0A1F1C]">Une erreur est survenue</h1>
      <p className="text-sm text-[#475569] max-w-md">
        Quelque chose s&apos;est mal passé. Nos équipes ont été notifiées. Vous pouvez réessayer.
      </p>
      <Button className="bg-[#0F6E56] hover:bg-[#0c5a46] rounded-xl mt-1" onClick={() => reset()}>
        <RotateCw className="w-4 h-4 mr-2" />
        Réessayer
      </Button>
    </div>
  )
}
